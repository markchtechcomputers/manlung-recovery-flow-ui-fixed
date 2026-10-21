# Manlung Recovery — Full Project Documentation

**Project:** Manlung Recovery / Manlung Tech City Cyber Recovery Portal  
**Production domain:** https://manlungrecovery.manlungshop.co.ke  
**Source repository:** https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed  
**Hosting configuration:** Vercel (Node.js serverless API + static frontend)  
**Primary stack:** Node.js, Express, vanilla HTML/CSS/JavaScript, Supabase, Vercel  
**Document purpose:** Technical orientation, setup, operations, feature map, security, deployment, testing, and known limitations.

> **Accuracy note:** This document describes the repository structure and the features reflected in the current source and project notes. It is not a guarantee that every feature is enabled in the live production deployment. Verify Vercel deployment status, environment variables, Supabase schema/RLS, provider dashboards, and live smoke tests before treating any feature as production-ready.

---

## 1. Project overview

Manlung Recovery is a web portal for recovery and support workflows. It combines public information pages, client accounts and case workflows, an admin dashboard, Owner-level administration, recovery/security tools, messaging and notifications, and a calling/community platform.

The codebase is a multi-part application:
- **Frontend:** static HTML pages, CSS, and browser JavaScript in `public/`.
- **Backend:** an Express application in `server.js`, with business logic organized into `routes/`, `models/`, `middleware/`, `services/`, and `config/`.
- **Deployment adapters:** `api/` files and `vercel.json` adapt the Express app and selected endpoints to Vercel functions.
- **Database:** Supabase/Postgres, with SQL migrations under `db/migrations/` and additional remote-desktop migrations under `supabase/migrations/`.
- **Automated tests:** Node's built-in test runner using files in `tests/`.
- **Operational docs and workflows:** root Markdown reports, GitHub Actions under `.github/workflows/`, and `.env.example`.

## 2. Repository layout

| Path | Responsibility |
|---|---|
| `server.js` | Express app, middleware, HTTPS enforcement, route mounting, and shared backend entry point. |
| `api/index.js` | Vercel function entry point that re-exports the Express app. |
| `api/config-public.js` | Public client configuration endpoint. Only publish values intended for browsers. |
| `api/app-version.js` | App-version/update metadata endpoint. |
| `api/ai.js`, `api/ai-live.js` | Vercel entry points for AI-related endpoints. |
| `api/auth-google.js`, `api/auth-github.js` | OAuth callback/authentication entry points. |
| `routes/` | API endpoint groups and request handling. |
| `models/` | Database access and domain model logic. |
| `middleware/` | Authentication, input security, and session-revocation controls. |
| `services/` | Shared services used by routes and models. |
| `config/` | Supabase client, call subscription settings, official-site registry, and Telegram settings. |
| `db/migrations/` | SQL changes for the application's Postgres schema and policies. |
| `supabase/migrations/` | Additional Supabase migration files, including remote-desktop changes. Review overlap before applying migrations. |
| `public/` | Static pages, assets, stylesheets, browser scripts, PWA assets, and admin/client interfaces. |
| `public/admin/` | Admin login, dashboard, Owner controls, reports, tools, and admin workflows. |
| `public/client/` | Client dashboard, recovery center, requests, tracking, settings, connection and device-recovery pages. |
| `public/css/` | Shared stylesheets and page-specific visual systems. |
| `public/js/` | Shared browser features such as auth helpers, PWA, WebRTC, AI, navigation, live location, and scanning. |
| `tests/` | Unit, integration, regression, call, Owner/RBAC, platform-security, and scanner tests. |
| `scripts/` | Project maintenance and automation scripts. |
| `.github/workflows/` | CI tests, security audits, APK workflows, and completion/repair automation. |
| `.env.example` | Names and descriptions of supported environment variables; values here must be placeholders only. |
| `package.json`, `package-lock.json` | Node package metadata, scripts, dependencies, and lockfile. |
| `vercel.json` | Vercel build definitions, URL rewrites, headers, and cache policy. |
| `README.md` and root `*.md` | Feature notes, repair reports, setup guides, and historical implementation documentation. |

### Main backend modules

- `routes/auth.js`: sign-in and account authentication.
- `routes/cases.js`: recovery cases and related workflow endpoints.
- `routes/config.js`: application configuration endpoints.
- `routes/notifications.js`: notifications.
- `routes/admin-documents.js`: admin document workflows.
- `routes/messages.js`: case/user messaging.
- `routes/community.js`: community and social interactions.
- `routes/analytics.js`: analytics endpoints.
- `routes/subscription.js`: calling entitlements and subscription/payment status.
- `routes/calls.js`: call lifecycle, availability, signaling and related call operations.
- `routes/donations.js`: donation-related operations.
- `routes/owner.js`: Owner-only administration and audit actions.
- `routes/careers.js`: careers and applications.
- `routes/platform.js`: platform-level features.
- `routes/operations.js`: operations and administrative workflows.
- `routes/ai.js`, `routes/ai-live.js`: AI integrations.
- `routes/youtube.js`: YouTube-related features.
- `routes/location.js`: location-related operations.
- `routes/remote-desktop.js`: remote desktop support flows.

### Main model modules

- `User.js`: account and role-related operations.
- `Case.js`, `CaseMessage.js`, `CaseTimeline.js`: recovery case data, messages and timeline.
- `Notification.js`: notifications.
- `AdminAuditLog.js`, `AdminInvitation.js`, `AdminPermission.js`, `AdminPresence.js`: administration, invitation, permission, audit and presence data.
- `CallEntitlement.js`, `CallSubscription.js`, `CallSession.js`, `CallSignal.js`: call access, billing/subscriptions, sessions and signaling.
- `RemoteDesktop.js`: remote desktop data.
- `SecurityMonitoring.js`: security monitoring data and operations.

## 3. User roles and access model

The documented role hierarchy is:

1. **Owner** — highest administrative role; manages administrators and protected platform operations.
2. **Admin** — handles permitted operational/recovery work; does not automatically receive Owner privileges.
3. **Client** — uses client-facing recovery, account, case, messaging, and support functions.

### Owner and admin security

- Role checks must be enforced on the server, not merely by hiding frontend buttons.
- Owner routes use Owner-specific authorization middleware (for example, `ownerAuth`).
- Admin-protected routes use admin authentication middleware (for example, `adminAuth`).
- Project notes document Owner promotion, suspension/reactivation, removal of admin privileges (reverting to client rather than deleting the account), and audit logging.
- Project notes document a server-side cap of 10 administrators.
- Suspended admins should be blocked from logging in or performing protected operations.
- A valid admin token must not grant Owner access; forged role claims must fail signature verification.

**Important limitation:** The README flags admin case claiming/assignment, the one-active-case-per-admin model, and full Owner reassignment as not yet implemented in the documented current feature set. Do not promise a completed “TAKE CASE” workflow until code and tests confirm it.

## 4. Feature inventory

Features represented in the source tree and project notes include:

### Public website
- Homepage and hero section.
- About, services, contact, FAQ, blog, careers, knowledge, trust, privacy, and terms pages.
- Donation information and donation workflows.
- Link-scanning and website-scanning tools.
- Download-app page and Android APK/update workflow.
- PWA manifest, service worker, icons, favicon, sitemap and robots file.
- Shared theme, responsive navigation, onboarding, support/contact floating controls and UI components.

### Client area
- Client dashboard and recovery center.
- Case/recovery request creation and tracking.
- Case messages and timeline-related experiences.
- Account settings and connection flows.
- Device-recovery, live-location and remote-support interfaces.
- Notifications and relevant client account verification flows, depending on configuration.
- Calling/community functionality where the associated entitlements and providers are configured.

### Admin area
- Admin login and invitation/registration-related pages.
- Admin dashboard and reports.
- Owner management page and audit log.
- Admin control center, operations, investigation notes and document tools.
- Link analysis, recovery evidence, device recovery, website scanner, security and remote-desktop tools.
- Admin presence and calling interfaces.

### Calling, community and billing
- WebRTC calling uses browser media APIs and signaling; the project notes identify Supabase Realtime Broadcast for serverless-compatible signaling.
- Call presence/availability and call-session models are present.
- Call entitlement/subscription checks are server-side.
- Paystack integration supports verified payment flow. Optional recurring plan codes can be configured; without configured recurring plans, the documented fallback is verified one-time checkout for the selected subscription period, not fake auto-renewal.
- Community messaging and social interaction modules are present.
- Live device location and remote-desktop support modules are present.

### AI and external services
- AI and live-AI routes are present; the optional upstream URL is configurable.
- Google and GitHub OAuth entry points are present.
- Telegram configuration is present.
- Resend/email-related configuration is present.
- Paystack, Cloudflare Turnstile and Google OAuth can be enabled with valid provider-side setup.
- Presence of a route or environment variable does not prove that a provider integration is fully configured in production.

## 5. Technology stack

### Runtime and server
- Node.js and Express 4.
- JSON Web Tokens for application sessions/tokens.
- bcryptjs for password hashing support.
- express-rate-limit for rate limiting.
- express-validator and project-specific input security middleware.
- Helmet and configured security response headers.
- Multer for supported file-upload workflows.
- Axios for outbound HTTP requests.
- Google authentication library for OAuth-related flows.
- Supabase JavaScript client for database and realtime functionality.

### Frontend
- Static HTML pages with CSS and vanilla browser JavaScript.
- Responsive CSS with shared styles and page-specific stylesheets.
- Progressive Web App support through manifest and service worker files.
- WebRTC APIs for browser calling where supported.

### Hosting and data
- Vercel functions and static asset hosting.
- Supabase/Postgres for application persistence and Realtime features.
- Paystack for payment processing when configured.
- Cloudflare Turnstile for challenge verification when configured.

Check `package.json` and `package-lock.json` for the exact dependency versions used by a given commit.

## 6. Local development setup

### Requirements
- A supported Node.js LTS version.
- npm.
- Git.
- A Supabase project with the expected schema and permissions.
- Provider accounts/keys only for features you intend to test locally.

### Clone and install

```bash
git clone https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed.git
cd manlung-recovery-flow-ui-fixed
npm ci
```

### Configure environment

Copy `.env.example` to `.env` and replace placeholders with real development values:

```bash
cp .env.example .env
```

On Windows Git Bash, use the same commands. Do not commit `.env`, real API keys, passwords, OAuth secrets, service-role keys, or encryption secrets.

### Start the application

```bash
npm start
```

The default Express port is determined by the implementation in `server.js` and environment configuration. Inspect the current source before assuming a port; open the local URL matching the startup message.

### Validate the source

```bash
npm test
npm run build
```

- `npm test` runs `node --test tests/*.test.js`.
- `npm run build` is a repository-level sanity check that verifies key files exist. It is **not** a full browser bundle, end-to-end, or production deployment test.

## 7. Environment variable reference

The authoritative list is `.env.example`. Configure secrets in local environment files or the hosting provider's encrypted environment settings.

| Variable | Purpose / notes |
|---|---|
| `NODE_ENV` | Runtime mode; use `production` in production. |
| `PUBLIC_APP_URL` | Canonical public HTTPS application origin used for redirects and links. |
| `ALLOWED_ORIGINS` | Allowed browser origins for CORS. Restrict to actual trusted origins. |
| `JWT_SECRET` | Secret used to sign/verify JWTs; use a long random value. |
| `JWT_EXPIRE` | Token lifetime, for example `7d`; align with session security requirements. |
| `MFA_ENCRYPTION_KEY` | Separate secret for MFA-related encryption. Do not reuse JWT secret. |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only elevated key; never expose in browser code or public configuration endpoints. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Bootstrap/initial Owner credentials where the implementation uses them. Use a strong password and rotate after initial setup. |
| `MAX_FILE_SIZE` | Upload size limit in bytes; example is 25 MiB. |
| `TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key. |
| `TURNSTILE_SECRET_KEY` | Private server-side Turnstile secret. |
| `PAYSTACK_PUBLIC_KEY` | Public Paystack key for checkout initialization/client integration. |
| `PAYSTACK_SECRET_KEY` | Private server-side Paystack key. |
| `PAYSTACK_PLAN_MONTHLY`, `PAYSTACK_PLAN_SIX_MONTHS`, `PAYSTACK_PLAN_YEARLY` | Optional recurring plan codes configured in Paystack. If absent, documented behavior falls back to verified one-time checkout. |
| `PAYSTACK_CALL_ADMIN_CALLBACK_URL` | Callback/return URL for the call subscription flow. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional email provider configuration. |
| `SAUTIKIT_API_KEY` | Optional Sauti/SMS provider key if used by the corresponding feature. |
| `DONATION_TARGET_KES` | Public donation progress target in KES. |
| `GOOGLE_CLIENT_ID` | Google OAuth/web client ID. The example currently contains a client ID; verify it is the correct intended ID for the deployment. |
| `GOOGLE_CLIENT_SECRET` | Server-side Google OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback/redirect URI; must match provider settings. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth credentials. |
| `GITHUB_REDIRECT_URI` | GitHub OAuth callback URI; must match provider settings. |
| `MANLUNG_RIPLE_AI_URL` | Optional AI upstream URL. |

Do not paste actual secret values into issue reports or documentation. If a secret is accidentally committed, rotate it at the provider and remove it from repository history where appropriate; deleting it from the latest file alone is insufficient.

## 8. Deployment on Vercel

The repository contains `vercel.json`, which defines serverless Node builds, static assets, response headers, caching, and rewrites.

### Deployment flow
1. Commit and push changes to the configured Git branch.
2. In Vercel, confirm the project is linked to the correct GitHub repository and branch.
3. Confirm the new deployment references the expected commit SHA.
4. Wait for the build to finish and verify the deployment is **Ready**.
5. Confirm the production domain is assigned to the intended production deployment.
6. Run smoke tests on the live domain, not only the generated preview URL.
7. Check Vercel function logs for runtime errors and Supabase/provider configuration problems.

### Deployment diagnosis
A successful GitHub push is not proof that production changed. Compare:
- current GitHub `main` commit;
- Vercel deployment's source commit;
- deployment target (Preview vs Production);
- production domain assignment;
- deployment build logs and function logs.

If Vercel reports Ready but the domain shows old code, verify the production alias/domain and browser/service-worker cache. Do not repeatedly create empty commits as a substitute for identifying a failed Git integration, build, or alias assignment.

### Security headers and caching
`vercel.json` sets headers such as CSP, HSTS, frame protection, content-type sniffing protection, referrer policy and permissions policy. It also applies no-cache rules to HTML and API responses with a special app-version cache policy. When adding a new third-party provider, update CSP deliberately and test the actual feature; avoid broadening policy without need.

## 9. Database and migrations

Database migration files are under:
- `db/migrations/`
- `supabase/migrations/`

The migration history includes changes for case timelines/messages, case claims and admin tables, Owner/admin workflows, calling/signaling, donations, careers, MFA, security hardening, client verification, community features, live location, subscriptions, remote desktop, and chat/voice storage.

### Safe migration process
1. Back up the database or ensure recovery is possible.
2. Inspect the exact SQL migration and its assumptions.
3. Confirm whether it has already been applied in the target Supabase project.
4. Apply migrations in the intended order using the project's established workflow.
5. Verify tables, columns, indexes, constraints, functions and policies after application.
6. Run the relevant application tests and smoke tests.
7. Check Row Level Security (RLS) on exposed tables and test both allowed and denied access.

**Caution:** The repository has migration files with overlapping numeric prefixes (for example, multiple `002`, `012`, `017`, `018`, `019`, `020`, `021`, and `022` names in `db/migrations/`). Do not infer migration order from the numeric prefix alone. Check the project's actual migration history and deployment process before applying or renaming anything. Avoid running both `db/migrations` and `supabase/migrations` blindly.

### Security requirements
- Enable RLS on exposed user-data tables.
- Make policies enforce ownership and role boundaries, not just signed-in status.
- Never place the Supabase service-role key in frontend JavaScript or public endpoints.
- Review views, triggers and privileged functions for RLS bypass.
- Test that clients cannot read or modify another client's cases, messages, files, locations, or call sessions.
- Do not run destructive schema changes without backup and explicit review.

## 10. Authentication and security controls

Security features represented in source/configuration include:
- JWT-based authentication and role middleware.
- Owner/Admin/Client role separation.
- Input security middleware and validation.
- Rate limiting on relevant endpoints.
- Password hashing support.
- Session revocation middleware.
- Optional Cloudflare Turnstile challenge.
- MFA-related models/migrations and deployment notes.
- Security headers and Content Security Policy.
- Audit log support for Owner actions.
- HTTPS canonicalization in production.
- OAuth routes for Google and GitHub.
- CI workflow for dependency/security auditing.

### Operational checklist
- [ ] Use unique high-entropy production secrets.
- [ ] Keep all server-side secrets out of static files and Git history.
- [ ] Confirm Turnstile server verification is enabled, not just its visual widget.
- [ ] Verify MFA enrollment and recovery paths.
- [ ] Test login rate limits and session revocation.
- [ ] Test Owner-only APIs using both Owner and ordinary Admin credentials.
- [ ] Verify password-reset links and email delivery in the actual provider environment.
- [ ] Review file upload type/size restrictions and storage access.
- [ ] Confirm CSP permits only the provider origins that are actually needed.
- [ ] Review Supabase RLS and storage policies.
- [ ] Rotate any leaked or previously shared keys.
- [ ] Keep backups and test restore procedures.

## 11. API map

The Express route groups are mounted by `server.js`. The following is a **module map**, not a complete list of every HTTP method/path. For the authoritative endpoints, inspect the route file and the route mounting section in `server.js`.

| Route module | Domain |
|---|---|
| `routes/auth.js` | Authentication and account sessions. |
| `routes/cases.js` | Recovery case creation, retrieval and workflow. |
| `routes/config.js` | Client-safe configuration. |
| `routes/notifications.js` | Notifications. |
| `routes/admin-documents.js` | Admin document management. |
| `routes/messages.js` | Messages and case communication. |
| `routes/community.js` | Community messaging and social actions. |
| `routes/analytics.js` | Analytics. |
| `routes/subscription.js` | Call entitlement and subscription/payment endpoints. |
| `routes/calls.js` | Call session lifecycle, signaling, availability and callbacks. |
| `routes/donations.js` | Donation flows. |
| `routes/owner.js` | Owner-only admin management and audit actions. |
| `routes/careers.js` | Careers and applications. |
| `routes/platform.js` | Platform services. |
| `routes/operations.js` | Operations workflows. |
| `routes/ai.js`, `routes/ai-live.js` | AI requests and live AI integration. |
| `routes/youtube.js` | YouTube integration. |
| `routes/location.js` | Location services. |
| `routes/remote-desktop.js` | Remote desktop support. |

To enumerate the exact API surface locally, search route files for `router.get`, `router.post`, `router.put`, `router.patch`, `router.delete`, and inspect where each router is mounted in `server.js`.

## 12. PWA and Android application

The web frontend includes PWA-related files such as:
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `public/js/pwa.js`
- icons under `public/icons/`
- Android APK/update workflow under `.github/workflows/android-apk.yml`
- setup notes in `APK_UPDATE_SETUP.md`

Check the manifest start URL, scope, icon paths, service-worker cache/versioning, and update behavior after changing routes or static assets. Test installability and updates on a real Android device. If an APK is built or distributed, document its source, version, signing process, and release location; do not commit private signing keys.

## 13. Automated testing and quality checks

Current test files include:
- `tests/unit.test.js`
- `tests/integration.test.js`
- `tests/calls.test.js`
- `tests/call-ui-regression.test.js`
- `tests/owner-rbac.test.js`
- `tests/platform-security.test.js`
- `tests/security-hardening.test.js`
- `tests/community-chat-regression.test.js`
- `tests/website-scanner-registry.test.js`

Run:

```bash
npm test
npm run build
```

For a release candidate, additionally test:
- Admin and client login/logout, invalid credentials, rate limiting, session expiry and reset flow.
- Owner-only operations with Admin credentials (expected denial).
- Client case isolation and unauthorized access attempts.
- File uploads and download permissions.
- Call entitlement checks, expired subscriptions, provider payment verification and callback handling.
- WebRTC permission-denied, unavailable-device, network interruption and call termination states.
- Community message authorization and real-time updates.
- PWA install/update behavior.
- Mobile layouts, especially login, dashboard and homepage hero.
- Live deployment source SHA and actual production routes.

A passing unit suite is valuable but does not prove provider keys, production database policies, browser integrations or deployment aliases are correct.

## 14. Troubleshooting guide

### Login fails
- Check browser Network panel and server/Vercel function logs.
- Confirm the correct API base URL, `PUBLIC_APP_URL`, JWT secret, Supabase URL/key and account role.
- For admin access, verify account status and role in the database without exposing credentials.
- For Turnstile failures, check both site key and server secret, hostname/widget settings, CSP and server-side verification response.

### Login or homepage shows old design
- Confirm the live Vercel deployment references the commit that includes the change.
- Confirm the deployment is Production and the custom domain points to it.
- Hard refresh and test in a private window; inspect service-worker cache if applicable.
- Inspect HTML response and browser console to identify CSS selector mismatches or blocked assets.

### API returns 500
- Inspect Vercel function logs for missing environment variables, schema mismatch or provider errors.
- Confirm migration state and expected database column names.
- Never “fix” a schema mismatch by inventing a column without inspecting the actual schema and related queries.

### Calls do not connect
- Confirm camera/microphone permissions and HTTPS.
- Inspect browser WebRTC errors and Supabase Realtime channel status.
- Verify availability/presence state, call entitlement, session lifecycle and relevant migrations.
- Test two separate authenticated browsers/devices. Local success in one tab alone is insufficient.

### Payments do not unlock access
- Verify checkout initialization and payment verification occur server-side.
- Check Paystack secret and callback configuration in the deployment environment.
- Confirm callback/webhook signature verification and idempotent fulfillment behavior.
- Do not manually mark a payment paid based solely on a browser redirect.

### GitHub updated but Vercel did not
- Compare the GitHub branch SHA with the Vercel deployment source SHA.
- Inspect Vercel build logs, Git integration settings, branch/production-branch settings and domain assignment.
- A successful push alone is not a deployment confirmation.

## 15. Known limitations and decisions to verify

The existing README and implementation reports call out these items:
- The full case-claiming/assignment workflow, one-active-case-per-admin enforcement and Owner reassignment were identified as not completed in the documented current state. Re-check current code/tests before planning work.
- Server-side call recording is not provided by basic peer-to-peer WebRTC alone; it would require a suitable media/recording service or self-hosted media infrastructure and explicit privacy/retention decisions.
- Recurring Paystack billing depends on valid plan codes and provider-side configuration. Without that setup, the documented flow uses verified one-time checkout for the selected period.
- The launch-trial policy and historical migration notes may refer to dated promotional windows; verify current entitlement logic before relying on any old date-based policy.
- The repository contains historical reports, backup files and multiple migration directories. Treat dated notes as historical unless confirmed against current code and production state.
- A feature existing in the frontend is not proof that its backend enforcement or external provider configuration is complete.

## 16. Recommended release checklist

Before every production release:
1. Review the diff and confirm no secrets, personal data or test credentials are included.
2. Run `npm ci`, `npm test`, and `npm run build`.
3. Review security-relevant changes and database migrations.
4. Apply only the required migrations after backup and history verification.
5. Verify environment variables in Vercel Production scope.
6. Confirm external provider keys, callback URLs and allowed domains.
7. Deploy and verify the deployment's source commit SHA.
8. Smoke-test public pages, client login, admin login, Owner-only endpoints, case APIs and any changed features.
9. Inspect browser console, Network panel, Vercel logs and Supabase logs.
10. Confirm rollback/recovery options before closing the release.

## 17. Useful links

- **Live website:** https://manlungrecovery.manlungshop.co.ke/
- **GitHub repository:** https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed
- **README:** https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed/blob/main/README.md
- **Vercel project:** https://vercel.com/12flocks-projects/manlungrecovery
- **Environment template:** https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed/blob/main/.env.example
- **Deployment configuration:** https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed/blob/main/vercel.json
- **Package scripts/dependencies:** https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed/blob/main/package.json

---

## 18. Keeping this document accurate

Update this document when:
- routes or role permissions change;
- database migrations are added or applied;
- new environment variables/providers are introduced;
- deployment configuration or domain ownership changes;
- a previously incomplete feature is implemented and covered by tests;
- the production deployment is verified to match a new commit.

**Never store production passwords, API secrets, service-role keys, private signing keys, MFA recovery codes, or customer case data in this document.**
