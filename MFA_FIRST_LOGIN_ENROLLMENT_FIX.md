# Owner MFA first-login enrollment fix

This build connects the Owner login flow to MFA enrollment.

Flow:
1. Owner enters username/password.
2. If MFA is already enabled, login returns a short-lived MFA ticket and asks for the 6-digit authenticator code.
3. If MFA is not enabled, the server creates the normal pre-MFA owner session and the login page immediately calls `/api/auth/admin/mfa/setup`.
4. The page displays the TOTP QR code and secret.
5. Owner scans the QR code and enters the current 6-digit code.
6. `/api/auth/admin/mfa/enable` verifies the code, enables MFA, creates recovery codes, and replaces the pre-MFA cookie with an MFA-verified session.
7. Subsequent admin/owner API requests require a JWT/session with `mfa: true`.

The QR image is generated in the browser using the QRCode.js package from jsDelivr. The TOTP secret itself is generated and stored by the server; the QR library only renders the otpauth URI.

Before production:
- Apply `db/migrations/011_admin_mfa.sql` to the production database.
- Run `npm install` / `npm ci`.
- Clear old browser cookies for the admin site if testing an older build.
- Log in once and complete enrollment.
- Save the displayed recovery codes securely.
