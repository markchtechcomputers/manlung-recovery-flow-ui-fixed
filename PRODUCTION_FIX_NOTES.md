# Production fixes applied

## 1. Paystack checkout
- Subscription checkout now initializes the transaction on the server and uses Paystack InlineJS v2 `resumeTransaction(access_code)`.
- Donation checkout already used server initialization; it now prefers the returned access code as well.
- Payment verification no longer marks a transaction as failed while Paystack reports `pending`, `ongoing`, or another in-progress state.
- Call Admin subscriptions now have a signed Paystack webhook backup path at `/api/subscription/webhook`.
- Donation webhook verification remains signed with the Paystack secret.
- All fulfillment still requires server-side verification of status, amount, and currency.

## 2. WebRTC calling
- Added ICE connection diagnostics so failures distinguish network/TURN problems from microphone problems.
- Added a 20-second connection timeout instead of leaving users stuck indefinitely after microphone permission.
- Improved remote-audio handling and added an explicit **Enable Audio** control for browsers that block autoplay.
- TURN credentials remain server-side and are only returned to authenticated call participants.

## 3. API/security hardening
- Added optional `ALLOWED_ORIGINS` CORS allowlist support.
- Added tighter rate limits for payment initialization/verification, call starts, and call signaling.
- No Paystack secret, Supabase service-role key, JWT secret, or TURN credential is placed in frontend code.

## Required Vercel settings

Set these in the Vercel project **Production** environment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`
- `PUBLIC_APP_URL`
- `PAYSTACK_CALLBACK_URL`
- `TURN_URL`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`
- `CALL_RING_TIMEOUT_SECONDS=30`
- `CALL_ACTIVE_TIMEOUT_SECONDS=21600`

Optional:
- `PAYSTACK_CALL_ADMIN_CALLBACK_URL`
- `ALLOWED_ORIGINS`

### Important Paystack checks

The public and secret keys must belong to the same Paystack mode:
- test public key + test secret key for testing
- live public key + live secret key for production

Configure the Paystack webhook URL as:

`https://YOUR_PRODUCTION_DOMAIN/api/donations/webhook`

and the Call Admin subscription webhook as:

`https://YOUR_PRODUCTION_DOMAIN/api/subscription/webhook`

### Important WebRTC check

If the browser grants microphone access but the call still fails to become connected, the first production setting to check is TURN. STUN alone does not work for every network. The Vercel environment must contain a working TURN URL, username, and credential.

## Verification

The modified JavaScript files pass `node --check`.

The full `npm test` suite could not be executed in this sandbox because the uploaded project did not have a usable installed dependency tree and package installation could not complete here. Run `npm ci && npm test` locally before deploying.


## Current Call + Payment deployment notes (2026-08-15)

- The live Supabase database must contain `public.recovery_call_signals`; migration `006_fix_call_signals_schema.sql` creates it and reloads PostgREST.
- Call signaling now resolves the participant identity from the authenticated call session instead of relying only on browser JWT decoding. This prevents a browser holding both client and admin tokens from skipping the remote offer.
- The client Call Admin panel and Admin incoming-call window both have an `X` close control. Closing an incoming Admin window declines the call; closing an active Admin call ends it cleanly.
- Paystack Call Admin checkout still uses server-side transaction initialization and Popup V2 `resumeTransaction(access_code)`, with the server verifying amount/currency/status before activating the 30-day entitlement. If the popup cannot be opened, the backend-provided authorization URL is available as a fallback.
- Paystack initialization errors now return the provider's useful message instead of a generic Axios error.
- The donation page uses the same server-initialized Paystack flow and has a secure authorization-URL fallback.
- The donation-page informational sentence about Paystack verification was removed as requested.
- Keep `PAYSTACK_SECRET_KEY` server-only. Use matching live/test key environments and ensure KES is enabled for the Paystack business.
- After changing Vercel environment variables, redeploy Production before testing.
