# Safe Feature Update — 17 August 2026

## Protected functionality
The existing Admin ↔ Client phone-call/WebRTC/session/signaling flow was preserved. No replacement call system or `accept_recovery_call()` RPC was introduced.

## Added / hardened
- Client signup now supports Google, GitHub, and Facebook through Supabase OAuth while preserving the existing application JWT session system.
- Existing manual client registration remains available and now requires a phone number.
- Career applications continue using the existing `/api/careers` route and `career_applications` table.
- Owner-only career review remains in the Owner Dashboard; application fields are HTML-escaped before rendering.
- Client call availability now distinguishes `offline`, `busy`, and `available`.
- When all admins are offline, clients receive an unavailable message and no call session is created.
- When admins are online but all are busy, clients are notified and the existing queue behavior is preserved.
- Database trigger protection prevents the same admin from having two simultaneous active accepted calls, including concurrent acceptance attempts.
- Existing call callbacks are blocked while the admin already has an active call.

## SQL
Run `db/migrations/010_career_and_call_availability_hardening.sql` after the existing `009_careers_and_donation_names.sql` migration.

If the earlier migrations have not been installed on the target database, install the project's migrations in numeric order first. Do not run duplicate copies of the migrations.

## Social provider setup
In Supabase Authentication > Providers, enable Google, GitHub, and Facebook and configure their provider credentials. Add the deployed site's `/oauth-callback.html` URL to the Supabase redirect allow-list. The frontend uses `SUPABASE_ANON_KEY`; the service-role key remains server-side only.

## Verification
All JavaScript files pass `node --check`. Full automated tests could not execute in this environment because the ZIP does not contain installed Node dependencies and dependency installation was unavailable. No production database credentials were used during local verification.
