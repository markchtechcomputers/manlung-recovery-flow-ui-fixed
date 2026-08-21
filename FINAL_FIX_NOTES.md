# Production fix notes

This build preserves the working WebRTC implementation from the Secure/Unique call stack:
- `public/js/call-webrtc.js` is unchanged from the working call build.
- `public/js/call-widget.js` is based on the working Unique call widget, with queue support, admin-name display, and admin callback handling added carefully.
- `routes/calls.js` retains the secure queue/callback backend.
- The client phone button remains the original floating Call Admin button.

## Required Supabase migration

Run `db/migrations/009_careers_and_donation_names.sql` once in the production Supabase SQL editor. This creates the careers table and adds `donor_name`.

The donation route also contains a backward-compatible fallback so an older `recovery_donations` table will not prevent Paystack initialization while `donor_name` is being migrated.

## Paystack production variables

Vercel Production must contain:
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_CALLBACK_URL`
- `PUBLIC_APP_URL`

Do not put the Paystack secret key in frontend code.

## Call production variables

Keep the existing working:
- `TURN_URL`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- JWT configuration

Do not replace the working TURN/WebRTC configuration.
