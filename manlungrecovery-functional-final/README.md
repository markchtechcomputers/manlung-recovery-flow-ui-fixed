# Manlung Tech City — Cyber Recovery Portal

## Current Call Admin policy (August 25, 2026)

Call Admin voice calling is **free**. No phone-call subscription or Paystack payment is required to place a client-to-admin call. The existing authenticated call/session tables, WebRTC signaling, Admin presence, incoming-call flow, and callback flow remain in place; the database schema and existing files are not migrated or deleted. Clients and Admins can each choose from five local call ringtones.

Older subscription/trial notes later in this README describe previous builds and should not be treated as the current product behavior.

## Latest update: global launch trial window (Aug 12–25, 2026)

**Replaced the per-user 2-day trial with a single global promotional window**,
per explicit instruction that this must NOT be interpreted as "14 days from
each user's registration date." Every client — new or existing — gets free
Call Admin access during this window, and everyone loses free access at the
exact same moment when it ends.

- **Window**: 2026-08-12 00:00:00 through 2026-08-25 23:59:59.999,
  **Africa/Nairobi time**. Before verifying this was safe to hardcode, I
  confirmed directly (via Node's `Intl` timezone data, both in January and
  July) that Africa/Nairobi is a fixed UTC+3 offset with no daylight saving
  time — so the UTC boundaries (`2026-08-11T21:00:00.000Z` through
  `2026-08-25T20:59:59.999Z`) are exact, not approximated.
- **Server-time only, always** — `models/CallEntitlement.js`'s `evaluate()`
  function takes an optional time parameter purely so tests can simulate
  specific dates without mocking the system clock; every real call site in
  `routes/calls.js` and `routes/subscription.js` calls it with zero arguments,
  meaning it always uses the actual current server time. Verified by grep,
  not just asserted.
- **10 tests confirm the exact boundary dates from the spec**: Aug 11 → no
  trial, Aug 12 00:00:00 → trial active, Aug 25 → still active, Aug 25
  23:59:59.999 → still active (inclusive end), Aug 26 00:00:00 → trial ends,
  subscription required. Also covers a subscription remaining valid on Aug 26
  even though the trial has ended, and a subscription that expired outside
  the trial window correctly showing `status: "expired"` rather than
  `"subscription_required"` (distinct states, matching the spec).
- Removed the old per-user trial-start call from client registration — Call
  Admin eligibility during the launch period no longer depends on when
  someone signed up at all.
- `recovery_call_entitlements.trial_started_at`/`trial_expires_at` columns
  still exist in the database (from the old model) but are no longer read by
  any code — left in place rather than dropped, since removing columns is
  destructive and they're harmless sitting unused.

## Known conflicts with the newest full-redesign spec — not yet resolved

A much larger architectural document arrived in this conversation requesting
several things that directly conflict with what's already built and working:
- **Separate Owner credentials** (not reusing `ADMIN_USERNAME`/`ADMIN_PASSWORD`)
  — conflicts with the Owner migration already done.
- **Real case-claiming/assignment workflow** (one active case per admin,
  foreign-key assignment, Owner reassignment) — still not built, flagged
  multiple times now as a genuinely separate, large piece of work.
- **Admin self-registration with Owner approval** — doesn't exist yet; admins
  are currently only created by the Owner promoting an existing client.
- **Server-side call recording** — confirmed not buildable with the current
  peer-to-peer WebRTC architecture without adding a paid service (Daily.co,
  Twilio, Agora Cloud Recording, LiveKit) or self-hosting a media server.
  You said you'd research options for this yourself — that decision is still
  outstanding.

These are being tackled deliberately, one at a time, rather than rushed
together — ask when you're ready for the next piece.

## Latest update before that: Owner / Admin RBAC

**Role hierarchy**: `owner` → `admin` → `client`, enforced entirely server-side.
- Your existing bootstrap admin account (`manlung`, tied to `ADMIN_USERNAME`/
  `ADMIN_PASSWORD`) was migrated to **Owner** — confirmed via direct query
  against your live database.
- New `/admin/owner.html` page — Owner-only. Promote a client to Admin,
  suspend/reactivate an admin, remove admin privileges (reverts to client,
  **never deletes the account** or their case/call history), and view a full
  audit log of every action. A link to it only appears in the admin
  dashboard header for the Owner role.
- **Every one of those actions is gated by `ownerAuth` middleware**, not
  frontend visibility — an admin token, even a perfectly valid one, gets a
  403 on every single Admin Management endpoint. Proven with tests, not just
  asserted: 11 new RBAC tests confirm a regular admin cannot list admins,
  promote anyone, suspend anyone, remove anyone, or view the audit log — and
  that a forged token claiming `role: "owner"` but signed with the wrong
  secret is rejected.
- The Owner account itself is protected in the data layer, not just the
  route layer: `User.setAdminStatus()` and `User.removeAdminPrivileges()`
  both filter `.eq('role', 'admin')` in their SQL — even a bug in the route
  logic couldn't accidentally suspend or demote the Owner, because the
  update simply wouldn't match that row.
- **Fixed a real gap while building this**: the admin login route previously
  only ever looked up the one hardcoded `ADMIN_USERNAME` — meaning any admin
  the Owner promoted through this new panel could never have actually logged
  in. Now looks up by whatever username was submitted, restricted to
  accounts with role `admin`/`owner`, with suspended admins blocked at login
  with a clear message instead of a confusing failure.
- 10-admin cap enforced server-side on promotion, matching the spec.
- **57 automated tests pass total** (`npm test`).

## Recheck against everything requested across this conversation

| Spec | Status |
|---|---|
| Real WebRTC (RTCPeerConnection, getUserMedia, SDP/ICE) | ✅ Built, tested |
| Serverless-compatible signaling (not raw WebSockets) | ✅ Supabase Realtime Broadcast |
| Ring all available admins, first-accept-wins, atomic | ✅ Built, **proven against the live DB** (see below) |
| Admin busy/available state excludes them from ringing | ✅ |
| Configurable ring timeout (not hard-coded) | ✅ `CALL_RING_TIMEOUT_SECONDS` |
| 2-day trial → KES 400/30-day subscription, server-time-only | ✅ Built, tested |
| Manual renewal (Paystack recurring billing not implemented) | ⚠️ Deliberate choice — see note below |
| `GET /api/payments/call-admin/status` exact spec path | ✅ Mounted as alias, tested |
| No secrets in frontend code | ✅ Verified by direct file review |
| Owner/Admin RBAC, audit log, 10-admin cap | ✅ Built, tested |
| Admin case-claiming/ownership model ("TAKE CASE" workflow) | ❌ **Not built** — see below |

**On Paystack recurring billing**: the spec asked me to research Paystack's
current recurring-payment mechanism before implementing, and explicitly said
not to invent one. I implemented the documented, safe fallback (manual
re-subscribe after expiry) rather than the automatic-charge flow, because
true recurring billing needs a Paystack Plan configured in your dashboard
plus webhook signature verification infrastructure this project doesn't have
yet. The client dashboard clearly shows when manual renewal is needed —
nothing is silently faked as "auto-renewed."

**On the case-claiming/ownership model** (the "TAKE CASE," one-active-case-
per-admin, per-client case-ownership authorization tests from the example-
data document): this is still **not implemented**. It's a genuinely
different, large change to the *existing* case management system (shared
access today → per-admin claiming/locking), and I've deliberately kept it
separate rather than rush it alongside three other major features in the
same conversation. Flagging this clearly rather than letting it quietly
fall through — tell me when you want this built and it'll get the same
careful, tested treatment as everything above.

## Latest update before that: real WebRTC "Call Admin" (replaces the Agora-based calling)

**This is genuine peer-to-peer WebRTC audio** — `RTCPeerConnection`, `getUserMedia`,
real SDP offer/answer and ICE candidate exchange. Not a text-only fake, not a
third-party calling SDK. Audio never touches our server; only the connection
setup (signaling) does.

**Signaling architecture** (the serverless-compatible piece): Vercel functions
don't hold persistent connections, so a traditional WebSocket server won't
work here. Signaling uses **Supabase Realtime Broadcast** instead — an
ephemeral, unguessable channel named after each call's UUID, which both
browsers join to exchange SDP/ICE messages directly. Neither client PII nor
call history is readable through that channel (RLS has no anon policies on
the call tables) — it only ever carries WebRTC protocol data.

**How admins discover an incoming call**: deliberately **polling** our own
authenticated REST API (`GET /api/calls/pending`, every 3s while online)
rather than a push/broadcast mechanism. This was a considered tradeoff: a
public Realtime channel broadcasting "new call from Jane Doe, jane@..." would
be readable by anyone holding the public anon key (which is, by design,
public). Polling keeps caller name/email/case behind our existing JWT auth.
Slightly less "instant" than a push notification, but correct.

**Ring-all-available-admins, first-accept-wins, enforced atomically**: when a
client calls, every online + not-already-busy admin sees the pending call via
polling. Whoever's "Accept" request reaches the database first wins — enforced
by a single conditional `UPDATE ... WHERE status='ringing' AND admin_user_id
IS NULL`, not application-level locking. **I proved this directly against the
live database**, not just by reading the code: created a real ringing call,
ran two competing accept updates back-to-back with the exact same SQL pattern
the code uses, and confirmed the second one matches zero rows while the first
succeeds and the assignment stays uncorrupted. Then cleaned up all test data.

**2-day free trial → KES 400 / 30-day subscription**:
- New client registration automatically starts a 2-day trial, recorded with
  a server timestamp (`recovery_call_entitlements.trial_started_at` /
  `trial_expires_at`) — cannot be reset by logging out, clearing storage,
  or switching browsers/devices, because it's tied to the account row in
  the database, not anything client-side. The 4 existing client accounts
  were backfilled with a fresh trial too.
- All entitlement math (`models/CallEntitlement.js`) is server-time-only —
  the function that decides trial/subscription/expired status takes no
  client-supplied "now" parameter at all (there's literally no argument
  for it — confirmed by a unit test asserting the function's arity).
- Every call-start request re-checks entitlement server-side
  (`routes/calls.js`) — the frontend button being enabled/disabled is just
  a reflection of that, never the actual gate.
- **Renewal is manual, not automatic**, by deliberate choice: Paystack does
  support recurring billing via its Plans/Subscriptions API, but that needs
  additional dashboard setup (a Plan) and webhook signature verification
  this project doesn't have yet. Manual re-subscribe (client clicks
  "Subscribe" again after expiry) is the safer, fully-working choice for a
  first version — the dashboard clearly shows when renewal is needed rather
  than silently pretending auto-renewal happened.
- `GET /api/subscription/status` matches the exact response shape
  requested (`access`, `status`, `trial`, `trialExpiresAt`, `subscription`,
  `subscriptionExpiresAt`), also mounted at `GET /api/payments/call-admin/status`
  as an alias for spec-path compatibility — same handler, both paths tested.

**Call states implemented**: client — requesting-mic, calling, connecting,
connected, reconnecting, ended, no-admin-answered (timeout), permission-denied,
connection-failed. Admin — incoming call, connecting, connected, client ended,
call rejected, connection failed. Configurable ring timeout (`CALL_RING_TIMEOUT_SECONDS`
in `.env`, defaults to 30s) — not hard-coded inline.

**Security, enforced server-side, not just hidden in the frontend**:
- Caller identity comes from the verified JWT, never a client-supplied ID.
- Entitlement and admin-availability checks happen in `POST /api/calls/start`
  itself — a client can't bypass the subscription by calling the API directly.
- `PUT /:id/accept`, `/reject`, `/end` all re-verify the requester is an
  actual participant in that specific call before allowing the action.
- TURN credentials (more sensitive than the Supabase anon key) are served
  from a route requiring auth, never hardcoded, never sent to unauthenticated
  requests.
- No secrets in any frontend file — verified by reading every new `public/js/*`
  file for anything beyond the public anon key / Paystack public key.

**Database changes** (all created and confirmed live in your Supabase
project, nothing else touched): `recovery_call_entitlements` (trial +
subscription state, one row per client), `recovery_admin_presence` (online/
busy tracking), `recovery_call_sessions` (the call record itself — status,
timestamps, `end_reason`). `recovery_call_subscriptions` (the Paystack
transaction log) stays as-is, now also feeding into the entitlement table
on verified payment.

**42 automated tests pass** (`npm test`) — the original 25 plus 17 new ones
covering exactly what was asked: entitlement math for trial/subscription/
expired/no-access states, server-time-only enforcement, unauthenticated
users blocked from starting/accepting/rejecting calls, non-admins blocked
from admin-only actions, forged/tampered JWTs rejected, and both the
`/api/subscription/status` and spec-required `/api/payments/call-admin/status`
paths gated correctly.

**Environment variables needed** (add to `.env` locally *and* to Vercel's
dashboard for the live site — same rule as every other secret in this project):

| Variable | Required? | Notes |
|---|---|---|
| `PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` | Yes, for subscriptions to work | From Paystack dashboard |
| `SUPABASE_ANON_KEY` | Already filled in | Safe/public by design, pre-filled from your project |
| `CALL_RING_TIMEOUT_SECONDS` | No (defaults to 30) | How long a call rings before "no admin answered" |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | No, but recommended for production | See below |

**On TURN — read this before relying on calling working for every client.**
STUN alone (Google's public server, already hard-coded as a fallback) gets
most calls connected directly. Some callers on restrictive networks
(symmetric NAT, some corporate/mobile networks) **cannot connect without a
TURN relay server**. Without `TURN_URL` configured, those specific calls will
fail with "connection failed" — this isn't a bug, it's a fundamental WebRTC
limitation. Free-tier TURN is available from providers like metered.ca or
Twilio's TURN service; add the credentials to `.env` when you're ready.

## What was deliberately NOT built in this pass

**Owner/Super-Admin role hierarchy with RBAC, admin management UI, and audit
log** — a separate, large request that arrived in the same conversation.
This is a genuinely different, substantial piece of work (a new role tier
above admin, an admin-management UI, promote/demote/suspend flows, an audit
log of who-did-what) that touches authorization across the *entire*
application, not just calling. Bundling it into the same pass as finishing
WebRTC calling risked half-finishing both and destabilizing a system that
only just became reliable after a lot of earlier debugging. This is next,
clearly scoped as its own pass, not silently dropped.

## Testing — run this before every deploy

```bash
npm install
npm test
```

25 automated tests, no real database needed (they use placeholder Supabase
credentials — the tests that need a real DB are skipped/reported separately,
not silently passed). Covers:

- **Unit tests** (`tests/unit.test.js`) — the pure logic: Supabase URL
  normalization, form-field mapping, camelCase serialization, internal-notes
  exclusion for client-facing responses.
- **Integration tests** (`tests/integration.test.js`) — real HTTP requests
  through the actual Express app: routing, auth gating (401s where expected),
  input validation, the honeypot spam guard, 404 handling, health check.

**Why this matters concretely**: this suite would have caught the honeypot
bug that caused "case submits successfully but nothing is saved" — I proved
this by deliberately reintroducing that exact bug and running `npm test`;
it failed immediately with a clear message pointing at the right test. Then
restored the fix and confirmed all 25 pass again. Run `npm test` after any
future change, before deploying — it takes about 8 seconds and would catch
this entire class of bug before it reaches production.

Also added `GET /api/health` — checks the server is up *and* can actually
reach Supabase (not just that Node is running). Useful for an uptime monitor,
and used by the test suite itself.

## ⚠️ Security note
An earlier message in this project's history included a MongoDB Atlas private key
pasted directly into chat. That key should be **revoked in Atlas immediately** if you
haven't already — treat anything pasted into a chat as compromised. It was never used
in this project's code, and MongoDB is no longer part of this project at all.

## Latest fix: 404 on case submission when deployed to Vercel

**Root cause**: `server.js` only called `app.listen()` — it never exported the Express
`app`. That's fine for a normal Node host (Render, Railway, a VPS, or running locally),
but Vercel's serverless runtime needs the app *exported* so it can wrap it as a
function handler; it doesn't run a persistent listener at all. Without an export and
without a `vercel.json` telling Vercel how to route requests to it, Vercel's zero-config
detection behaved inconsistently — some routes happened to resolve, others (like
`/api/cases/submit`) 404'd.

**Fixed:**
- `server.js` now exports `app`, and only calls `.listen()` when run directly
  (`node server.js` — still works exactly the same locally/Render/Railway/VPS).
- Added `vercel.json` that routes every request through `server.js` as a single
  serverless function, since Express already handles all the internal routing
  (static files, pages, `/api/*`) itself.
- Verified locally: running `node server.js` still starts a normal listener, and
  `require('./server.js')` (simulating how Vercel loads it) exports the app without
  starting a listener — both confirmed with actual test runs, not just code review.

**⚠️ Still worth knowing if you're on Vercel**: this app currently allows file uploads
up to 100MB (`MAX_FILE_SIZE` in `.env`), but Vercel serverless functions cap request
body size around ~4.5MB regardless of that setting. Small evidence files should upload
fine now; anything larger will fail (with a size-limit error, not a 404). If you need
to support larger files on Vercel specifically, the fix is switching file uploads back
to direct browser → Supabase Storage (bypassing the Express server's body limit
entirely, similar to how the Cloudinary flow worked earlier in this project) — tell me
if you want that and I'll wire it in.

## Latest update: hardening + admin quality-of-life features

**A real bug from the Postgres migration got caught and fixed in this pass**: the API
was returning raw database rows in snake_case (`client_name`, `case_type`,
`admin_read`) but every front-end page was written expecting camelCase (`clientName`,
`caseType`, `adminRead`). In practice this meant the admin dashboard would have shown
blank/undefined fields instead of actual case data. Fixed via a `serializeCase()`
function in `routes/cases.js` that converts every DB row to the shape the front-end
actually expects — applied consistently across every endpoint that returns a case.

**New in this pass:**
- **Server-side validation** (`express-validator`, was installed but unused before) on
  registration, login, case submission, and bulk-update — rejects malformed/missing
  data with a clear message instead of trusting whatever the client sends.
- **Honeypot spam field** on the public request form — invisible to real users (CSS,
  `tabindex="-1"`), but bots that auto-fill every input will trip it; submissions with
  it filled are silently discarded.
- **Forgot / reset password** for clients (`routes/auth.js`, `public/reset-password.html`,
  linked from `login.html`). **Does not send an actual email yet** — no email provider
  is configured. In dev (`NODE_ENV !== 'production'`), the reset link is returned in
  the API response and logged to the server console so you can test the flow. Before
  going live, wire a real provider (Resend, SendGrid, etc.) into the
  `/api/auth/client/forgot-password` route where it currently just logs the link.
- **Internal notes** — a new `internalNotes` field on each case, admin-only, never
  sent to clients (separate from the existing `publicNotes` which clients do see).
- **Audit history** — every admin edit (status, investigator, notes) is appended to
  `admin_history` on the case: who changed what, and when. Visible in the case modal.
- **Bulk actions** — multi-select cases in the admin table, apply a status change to
  all of them at once.
- **CSV export** — exports whatever the current search/filter view shows.
- **"My cases only" filter** — filters to cases where `investigator` matches the
  logged-in admin's username.
- **24h+ escalation flag** — cases marked Emergency priority that are still "Pending
  Review" a day later get a red left-border + badge in the admin table (computed
  client-side from `priority`/`status`/`createdAt`, no new column needed).
- **Dark mode now persists** across page loads (`localStorage`) on every page that has
  the toggle.
- **Draft autosave** on the request form — text fields save to `localStorage` as you
  type; if the browser closes/crashes mid-form, reopening the page restores it with a
  dismissible banner. Files are never persisted this way (browsers can't do that), only
  text fields.
- **File preview thumbnails** for staged image uploads on the request form.
- **Completion progress bar** on the request form, tracking the 5 required fields.
- Login attempts are rate-limited separately (15 per 15 min) from general API traffic.

## Everything still standing from before
- `recovery_users` / `recovery_cases` tables in your Supabase project
  (`qpsiqaefsulqphsqkaau`, `eu-west-2`), RLS enabled, only reachable via the
  `service_role` key kept server-side.
- `recovery-evidence` Storage bucket — private, signed URLs generated fresh per view.
- Logins persist (JWT in `localStorage`), both login pages auto-redirect if already
  signed in. No OTP anywhere.
- Admin dashboard: NEW badge + highlighted row for unread cases, sorted newest-first,
  Unfinished/Finished and Read/Unread filters.

**You must still fill in `.env` yourself — I can't obtain these for you:**
1. `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Settings → API → reveal
   `service_role`.
2. `JWT_SECRET` — run `openssl rand -hex 32`.
3. `ADMIN_PASSWORD` — pick a real one.

## Setup

```bash
npm install
# edit .env: SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, ADMIN_PASSWORD
npm run dev
```

Visit:
- `/` — public homepage + case tracker
- `/login.html` — client sign in / create account / forgot password
- `/reset-password.html` — consumes the link from forgot-password
- `/client/request.html` — submit a new case (draft autosave, file previews, progress bar)
- `/client/dashboard.html` — client's own cases
- `/admin/login.html` — admin sign in
- `/admin/dashboard.html` — case management: bulk actions, CSV export, internal notes,
  audit history, unread/finished/my-cases filters, 24h+ escalation flags

## Still open (needs a decision from you, not just code)
- **Actual email delivery** for password resets and status-change notifications needs
  a provider (Resend, SendGrid, Africa's Talking for SMS, etc.) — pick one and I'll
  wire it in.
- **Real hosting + domain + HTTPS** — everything currently only runs on `localhost`.
- **Email verification on registration** — anyone can currently register with any
  email address, including one they don't own.

## What I could not verify from this sandbox
My sandbox's network only reaches package registries (npm, pip, GitHub), not
`supabase.co` — so the schema/bucket were confirmed live via a separate direct
connection, and the Node server was boot-tested and confirmed to serve every page
and correctly reject unauthenticated API calls, but a full register → submit →
upload → admin-view flow against your live database has not been run end-to-end.
That first real test needs to happen on your machine. If something errors, the
message will say what actually failed — send me that and I'll debug from there.




## Security / architecture update

Run `db/migrations/002_security_case_claims_admins.sql` in Supabase before deploying this version. It adds client ownership, atomic Admin case claiming/completion, Admin permissions, and Admin invitations.

Optional email delivery uses Resend via `RESEND_API_KEY`, `EMAIL_FROM`, and `PUBLIC_APP_URL`. If those are not configured, password-reset links remain available only in non-production development responses and invitation links are returned to the Owner for manual delivery.

Call recording is intentionally NOT claimed as implemented: the current WebRTC media path is peer-to-peer. A recording provider/server-side media architecture must be selected and configured before production recording can be enabled.

Paystack webhook/production credentials remain deployment configuration and are not fabricated by this update.


## Capacity and Owner approval update

- `public/client/dashboard.html` is a real client dashboard again: authenticated case loading, status cards, Admin feedback, tracking links, responsive header/footer, dark mode, and the Call Admin widget.
- Admin access is invitation + Owner approval only. Pending Admin registrations are highlighted in the Owner portal.
- The Owner remains the only role that can invite, approve, suspend/reactivate, remove Admin privileges, change Admin permissions, delete client-facing messages, delete cases, and clear call logs.
- Each Admin may claim up to 10 active cases. Run `db/migrations/004_admin_case_capacity_and_workflow.sql` after the earlier migrations.
- Calls remain browser-to-browser WebRTC audio. For reliable connectivity across restrictive mobile/corporate networks, configure a TURN server with `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL`; STUN alone is not a universal relay.

## Donation system

The project now has `/donate.html`. Donations are initialized and verified on
the server with Paystack. The public total and Admin donation dashboard count
only transactions whose status has been verified as successful by Paystack.
Set `PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY` as deployment environment
variables; never hard-code the secret key in browser JavaScript. Set
`PAYSTACK_CALLBACK_URL` to your public `/donate.html` URL (or use
`PUBLIC_APP_URL`). Successful Paystack webhooks are signature-checked and
can confirm a donation even if the donor closes the browser before the
callback finishes.

Run `db/migrations/005_donations_and_call_signaling.sql` in Supabase before
using the donation form.

## Worldwide Call Admin

Call signaling is persisted through authenticated `/api/calls/:id/signals`
endpoints instead of relying on browser Realtime timing. For the best global
connectivity, configure a production TURN provider using `TURN_URL`,
`TURN_USERNAME`, and `TURN_CREDENTIAL`. STUN alone cannot guarantee a
connection through every NAT/firewall.
