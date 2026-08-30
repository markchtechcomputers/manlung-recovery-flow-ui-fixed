# Manlung Recovery — Admin MFA + HttpOnly Session Deployment

## What changed
- Admin/Owner JWT is no longer returned to the browser or stored in `localStorage`.
- Successful admin login sets `manlung_admin_session` as an HttpOnly, Secure, SameSite=Strict cookie in production.
- MFA-enabled Admin/Owner accounts require a TOTP code before the session cookie is issued.
- Recovery codes are generated once and stored only as hashes.
- MFA secrets are encrypted at rest using a key derived from `JWT_SECRET`.
- Admin logout clears the HttpOnly cookie.
- Existing `Authorization: Bearer` support remains available for compatibility, but the admin frontend now relies on the HttpOnly cookie.

## Before deploying
1. Back up your Supabase database.
2. Confirm `JWT_SECRET` is set to a long random production secret. Do not change it during this migration unless you intend to invalidate all existing JWTs.
3. Run migration `db/migrations/011_admin_mfa.sql` in the Supabase SQL Editor.
4. Deploy the code.
5. Log in to `/admin/login.html`.
6. Open the Owner/Admin MFA section in `/admin/owner.html`.
7. Set up an authenticator app and save the recovery codes offline.
8. Log out and test a fresh login. MFA-enabled accounts should receive the MFA prompt before entering the dashboard.

## Git Bash
From your repository root:

```bash
git status
git add routes/auth.js middleware/auth.js models/User.js services/mfa.js db/migrations/011_admin_mfa.sql public/admin/login.html public/admin/dashboard.html public/admin/reports.html public/admin/owner.html MFA_DEPLOYMENT_GITBASH.md
git diff --cached --check
git commit -m "security: add admin MFA and HttpOnly sessions"
git push origin main
```

If your production branch is not `main`, replace `main` with the correct branch.

## Important
Do not enable MFA and then delete your recovery codes. If you lose the authenticator device and all recovery codes, account recovery will require a controlled database/admin recovery procedure.
