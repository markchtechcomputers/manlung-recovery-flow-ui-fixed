# FINAL PRODUCTION HARDENING UPDATE — 2026-08-28

Applied to the supplied Manlung Recovery project.

## Updated
- Light mode remains the default; shared theme controller retained.
- PWA manifest and PWA registration are now included across the HTML pages.
- PWA manifest colors are aligned with the light-first default.
- Service worker caching is restricted to known public/static resources and never caches `/api/` responses.
- Offline navigation no longer substitutes the home page for private Client/Admin routes.
- Public offline fallback is provided.
- Global responsive/accessibility safeguards added.
- Scanner page retains safe public-URL scanning and SSRF protections; mobile layout safeguards retained.
- Professional 404, 500 and 503 pages added.
- HTML 404 fallback added without changing API 404 behavior.
- Health endpoint responses are explicitly `no-store`.
- Existing Helmet/security configuration is preserved.
- Existing database structure and migrations are preserved.

## Protected / intentionally unchanged
The following existing call files were verified byte-for-byte unchanged:
- routes/calls.js
- models/CallSession.js
- models/CallSignal.js
- models/CallEntitlement.js
- models/CallSubscription.js
- models/AdminPresence.js
- public/js/call-webrtc.js
- public/js/call-widget.js
- tests/calls.test.js

No database migration was performed. No calling provider or WebRTC architecture was replaced.

## Validation
Node syntax checks passed for server.js, theme.js, pwa.js and link-scanner.js.
The full test suite was not run because this clean build has no node_modules and dependency installation is outside this packaging step.
