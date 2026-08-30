# Manlung Recovery — Security + SEO Hardening

## Scope
Defensive hardening only. Existing Supabase authentication, WebRTC/call flow, payments and legitimate client/admin functionality were preserved.

## Security changes
- Hardened JWT verification to accept only HS256 and fail closed when production JWT configuration is missing.
- Added defense-in-depth Origin validation for state-changing requests carrying the admin HttpOnly session cookie.
- Hardened request inspection against prototype-pollution keys, excessive nesting and HTML markup.
- Strengthened password hashing for newly created/reset passwords to bcrypt cost 12; existing hashes remain compatible.
- Added MFA-login rate limiting.
- Lowered the general API rate-limit ceiling while retaining dedicated limits for sensitive operations.
- Restricted evidence uploads to PDF, JPG/JPEG and PNG only.
- Added MIME, extension and magic-byte agreement checks.
- Added per-format limits: PDF 10 MB maximum; JPG/JPEG/PNG 5 MB maximum.
- Added multipart field/file/part limits and safe Multer error handling.
- Evidence filenames are never used as storage paths; random UUID storage names are used.
- Added upload rollback cleanup when database/storage operations fail.
- Fixed a bulk-update authorization gap so regular admins can only bulk-update cases assigned to them.
- Added stricter bulk case-ID validation and owner admin-ID validation.
- Disabled TLS certificate bypass in the website scanner.
- Preserved DNS-resolution/pinning checks to reduce DNS-rebinding SSRF risk and added punycode warning detection.
- Production scanner errors no longer return internal exception details.
- Added a Supabase migration that enables RLS on application tables and makes the evidence bucket private.
- Revoked browser-role direct access to the evidence storage table; server-side service-role operations remain the intended path.
- Restricted execution of security-definer case/call functions to the server role.
- Confirmed the repository contains no detected real payment/service-role/JWT secrets; test-only JWT secrets remain in test files.

## SEO changes
- Added page-specific meta descriptions, canonical URLs and Open Graph/Twitter metadata to public pages.
- Added Organization and WebSite structured data to the home page.
- Added `robots.txt` and `sitemap.xml`.
- Marked admin, client, login and reset/OAuth pages as `noindex`.
- Added no-store/`X-Robots-Tag` protections for private routes in Vercel configuration.
- Kept private account/case APIs out of search indexing.

## Database
Run `db/migrations/012_security_lockdown.sql` in Supabase **after migration 011**.

This migration does not change Supabase Auth.

## Verification
- JavaScript syntax checks: passed.
- New security-hardening tests: 7 passed.
- Full existing test suite: not executable in this audit environment because the uploaded project did not contain installed dependencies and registry access was unavailable. Run `npm install` and then `npm test` in the deployment/CI environment.
- `npm audit`: could not retrieve the npm advisory endpoint because the audit environment had no working registry DNS/network access. Re-run `npm audit` after dependencies are installed in CI/deployment.

## Remaining risks / manual verification
- Rotate any production secret if it was ever committed to Git history, even if the current working tree is clean.
- Confirm the Supabase `recovery-evidence` bucket exists and remains private after migration 012.
- Confirm production `JWT_SECRET`, Supabase service-role key, Paystack secret and other service credentials exist only in server-side environment variables.
- Review Supabase RLS/storage policies in the live project before deployment.
- Run the full application integration/security tests after `npm install`.
- No application can honestly be described as 100% secure; this release is hardened against the audited classes of common web attacks, subject to production configuration and future code changes.

## Status
HARDENED
