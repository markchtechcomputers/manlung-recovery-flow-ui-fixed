# Manlung Recovery — Theme, Scanner & Security Update

## Updated
- Global light/dark theme controller shared by all pages.
- Light mode is the default when no preference is stored.
- Theme preference persists across pages and browser tabs using the existing `theme` localStorage key.
- Theme controls are added to pages that previously had no control; pages without a standard header receive a floating control.
- Responsive header/content guardrails added for smaller screens.
- Website Safety Scanner UI made more resilient on mobile and slow/error responses.
- Scanner client now validates input, handles non-JSON errors, and stops a stuck request after 30 seconds.
- Scanner server retries already-validated public DNS addresses so multi-address websites are less likely to fail because one address is unreachable.
- HTTPS sites with certificate trust problems can still be scanned and are reported as a TLS finding instead of making the entire scan unusable.
- Scanner continues to block localhost, internal/private/reserved destinations and non-standard ports to prevent SSRF/port-scanning abuse.
- Expanded reserved IP checks for scanner SSRF protection.
- Scanner rate-limit key no longer trusts a caller-supplied `X-Forwarded-For` value directly.
- Helmet Content Security Policy is enabled while preserving the external services already used by the application, including Supabase, Paystack, Font Awesome and jsDelivr.

## Call preservation
The core call implementation was intentionally left unchanged:
- `routes/calls.js`
- `models/CallEntitlement.js`
- `models/CallSession.js`
- `models/CallSignal.js`
- `models/CallSubscription.js`
- `public/js/call-webrtc.js`
- `public/js/call-widget.js`

Their SHA-256 hashes were compared before and after this update and are identical.

## Validation
- `node --check server.js` passed.
- `node --check public/js/theme.js` passed.
- `node --check public/js/link-scanner.js` passed.
- Full `npm test` could not be run because dependency installation timed out in the build environment.
