# Manlung Recovery – Requested Feature Update

This package changes only the highlighted areas from the supplied development brief. Existing authentication, case ownership, security middleware, Paystack, Supabase, and the existing WebRTC architecture are preserved rather than replaced.

## Implemented

### Calling
- Client call flow now creates a server-side ringing session first and only requests microphone access after an Admin accepts.
- Admins online and available are polled for incoming calls without page refresh.
- Incoming calls show a clear Accept/Decline panel with ringtone and device vibration where supported.
- Client call state shows ringing/connecting/connected/end states and uses vibration/ringtone while waiting.
- First-answer-wins remains server-side.
- WebRTC signaling now waits for the receiving peer's READY signal before the initiator sends the SDP offer.
- ICE candidates are queued until the remote description exists.
- Remote audio playback, mute, duration and cleanup are handled.
- Accepted calls have a stale-call safety timeout so an abandoned accepted session cannot block an Admin forever.
- Ending a call releases Admin busy state.

### Client cases and feedback
- Client case queries now prefer `client_user_id`, with a legacy email fallback for old rows.
- Client case tracking now sends the authenticated client token and enforces ownership server-side.
- Client dashboard surfaces current status, latest update and client-visible Admin feedback.
- Existing case timeline/public feedback continues to be the source of client-visible progress messages.
- Admins may continue to update client-facing feedback, but regular Admins cannot erase existing client-facing feedback.
- Owner-only endpoint added for deleting a client-facing case message.

### Owner controls
- Owner-only call-log clearing was added.
- Suspending or removing an Admin now releases their active case assignment and active call state so work is not silently orphaned.
- Owner-only message deletion is enforced server-side.
- Admin suspension/reactivation/removal continues to use the existing role/permission model.

### Database hardening
`db/migrations/003_owner_call_and_client_dashboard_hardening.sql` adds the required Admin status lifecycle and audit-action constraints, creates the audit table if missing, and adds useful call indexes.

Run this migration in Supabase before using the new Owner suspend/remove, audit, and call-log features in production.

### UI / responsive updates
- Home footer was polished with responsive grouped links/security indicators.
- Shared responsive CSS was strengthened for mobile/tablet layouts.
- Admin mobile tables/modal styling was improved.

## Files changed

- `models/AdminAuditLog.js`
- `models/CallSession.js`
- `models/Case.js`
- `routes/calls.js`
- `routes/cases.js`
- `routes/owner.js`
- `public/js/call-webrtc.js`
- `public/js/call-widget.js`
- `public/admin/dashboard.html`
- `public/admin/owner.html`
- `public/client/dashboard.html`
- `public/client/track.html`
- `public/index.html`
- `public/css/style.css`
- `public/css/admin.css`
- `db/migrations/003_owner_call_and_client_dashboard_hardening.sql`

## Validation

- Node syntax checks passed for all modified backend JavaScript files.
- Inline JavaScript blocks in the modified HTML pages passed `node --check` extraction checks.
- The project's automated tests could not be executed because the ZIP does not include `node_modules`; an attempted dependency installation timed out in the build environment.

Therefore automated end-to-end deployment verification is **INCOMPLETE** in this environment. The package is structured for deployment, but production Supabase/WebRTC testing still needs to be performed after applying migration 003.

## Final functional pass – August 13, 2026

### Client dashboard recovery
The supplied archive contained `public/client/dashboard.html` overwritten with Express route code. That was the direct cause of the client dashboard failing to render and producing the case-loading/network-error experience. The file has been restored as a real HTML dashboard and now calls `GET /api/cases/client/me` with the authenticated client JWT.

### Admin workflow
- Direct client-to-admin promotion is disabled.
- Owner invitation -> Admin registration -> Owner approval is the required access path.
- Pending Admin registrations are highlighted in the Owner portal and can be approved there.
- Owner-only suspend/reactivate/remove/permission/audit controls remain server-enforced.
- Each Admin may actively hold up to 10 cases. Atomic database enforcement is supplied in migration 004.

### Calling
- Client -> server ringing session -> available Admin/Owner queue -> first accepted Admin/Owner -> browser microphone -> WebRTC audio connection.
- Both sides have ringtone/vibration/accept/decline/end/mute states.
- STUN is included and TURN environment variables are already supported. TURN is required for the broadest connectivity across restrictive NAT/mobile/corporate networks.

### Responsive UI
The restored client dashboard includes a mobile-first header, responsive case cards, and a structured footer. Existing shared responsive CSS remains in place for the public and Admin pages.

### Validation
- Node syntax checks passed for the modified backend JavaScript files.
- Inline JavaScript extracted from the modified HTML pages passed `node --check`.
- Full automated tests could not run because dependencies are not present in the archive and `npm install` timed out in this environment. Production Supabase/WebRTC testing still requires the deployment environment and real credentials.


## Donation system hardening

The donation flow now supports both the Paystack browser callback and Paystack server webhook confirmation. Public totals remain aggregate-only, while successful payments are verified against the stored KES amount and currency before confirmation. The public donation page is linked from the home page, and the client dashboard displays the live confirmed donation total and count.

## 2026-08-15 call-signaling repair

Added `db/migrations/006_fix_call_signals_schema.sql` to repair deployments where Supabase/PostgREST reports `public.recovery_call_signals` is missing from the schema cache. The migration is idempotent and explicitly refreshes the PostgREST schema cache.
