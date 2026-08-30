# Owner Authenticator MFA Update — 2026-08-24

This build updates the existing Owner MFA implementation.

## What changed

- Owner login now uses a two-step flow: password, then authenticator code.
- Successful Owner MFA login creates the HttpOnly `manlung_admin_session` cookie.
- Owner JWTs issued after MFA contain `mfa: true`.
- When an Owner has MFA enabled, `middleware/auth.js` rejects tokens without `mfa: true` with `403 MFA_REQUIRED`.
- This blocks old pre-MFA Owner tokens and direct API calls using those tokens.
- Owner MFA setup/enable/disable/status endpoints are Owner-only.
- MFA setup cannot silently replace an already-enabled authenticator.
- Owner dashboard now displays a QR code that can be scanned by a TOTP authenticator app, with manual-key fallback.
- Recovery codes remain supported and are consumed once.
- After enabling MFA, the current session is logged out so the Owner must prove MFA at the next login.
- Existing migration `db/migrations/011_admin_mfa.sql` provides the MFA database columns.

## Deployment

Run the existing database migration if it has not already been applied.

Then:

```bash
npm install
npm test
npm start
```

## Security test

1. Log in as Owner with password.
2. If MFA is enabled, the dashboard must not open until the 6-digit authenticator code succeeds.
3. Use an old Owner token issued before MFA was enabled against an Owner API endpoint. It must return `403` with `MFA_REQUIRED`.
4. Forge a token with `mfa: true` but sign it with a different secret. It must return `401 Invalid token`.
5. Use the valid post-MFA session. Owner APIs should work.
