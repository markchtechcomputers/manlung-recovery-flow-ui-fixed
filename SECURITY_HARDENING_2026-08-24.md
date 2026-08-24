# Manlung Recovery — Security Hardening 2026-08-24

This release is a security-hardening update. It does not intentionally change the existing WebRTC call flow, Supabase authentication, or call-session models.

## Included

- Content Security Policy and hardened security headers in Express and Vercel.
- HSTS, clickjacking protection, MIME-sniffing protection, referrer policy, permissions policy, and cross-domain policy headers.
- Restricted production CORS defaults instead of allowing every browser origin when `ALLOWED_ORIGINS` is absent.
- API responses are marked `no-store` before route handlers run.
- Production API errors no longer return internal exception messages.
- Public health checks no longer expose database error details in production.
- Public career submissions receive a dedicated rate limit.
- JSON/urlencoded request bodies are limited to 10 MB; multipart evidence uploads retain their existing route-specific 25 MB limit.
- Website scanner URL length and port restrictions.
- Website scanner blocks local/internal hostnames and private/reserved DNS destinations.
- Website scanner pins outbound HTTP(S) connections to the validated DNS address to reduce DNS-rebinding SSRF risk.
- Website scanner blocks IPv4-mapped private IPv6 destinations and multicast IPv6 destinations.
- Website scanner stops consuming oversized response bodies after 512 KB.
- Existing scanner HTML rendering continues to escape server-returned values before inserting them into the result view.
- The homepage Website Safety Scanner remains a single compact button.
- Scanner footer keeps Call Admin/YouTube and a centered copyright without the unwanted support text.

## Deliberately not changed

- `public/js/call-webrtc.js`
- `public/js/call-widget.js`
- `routes/calls.js`
- `models/CallSession.js`
- `models/CallSignal.js`
- `models/AdminPresence.js`
- `config/supabase.js`
- Supabase migrations

The production environment still needs its existing secret values kept only in Vercel/Supabase/server-side environment variables. Do not paste API keys, JWT secrets, service-role keys, or SautiKit credentials into source files or chat.

## Important limitation

No internet-facing application can honestly be guaranteed to be "100% secure". This release reduces several concrete attack surfaces, but production security also depends on Vercel configuration, Supabase RLS/policies, third-party provider settings, secret rotation, dependency updates, and ongoing monitoring.
