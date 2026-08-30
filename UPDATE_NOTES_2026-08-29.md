# Manlung Recovery UI, Client Access & Privacy Update — 2026-08-29

This update is intentionally additive and preserves the existing recovery/call functionality and API route structure.

## Client access
- Added a redesigned client Sign In / Create Account experience.
- Email/password authentication continues to use the existing `/api/auth/client/login` and `/api/auth/client/register` backend routes.
- Google and GitHub continue through the existing Supabase OAuth -> `/api/auth/client/oauth` exchange.
- OAuth browser flow now prefers PKCE and preserves a safe post-login destination.
- Added a theme-aware account section to the public header.
- Logged-in clients see their account and a Log Out control.
- Added a 30-minute browser inactivity timeout for client sessions.
- Client JWT lifetime defaults to 12 hours (`CLIENT_JWT_EXPIRE`) while Admin/Owner lifetime remains separately configurable.
- Stronger client/admin password creation/reset validation: 12+ characters, upper/lowercase, number and symbol.
- Existing login/register rate limits remain in place.

## Recovery request access
- The backend already requires authenticated client access for `/api/cases/submit`; this update does not weaken that control.
- Public request links now route unauthenticated visitors to Client Sign In/Create Account with a safe return destination.
- The request page displays a clear account-required notice.
- The server-side `auth` middleware remains the final enforcement point.

## Legal/privacy
- Added `/privacy.html` with a Kenya-focused Privacy & Data Protection Notice.
- Reworked `/terms.html` for current website/service use.
- Documents reference the Kenya Data Protection Act, 2019 and the 2021 Data Protection Regulations without claiming that publication alone proves regulatory registration/compliance.

## Footer and navigation
- Added a responsive site-wide footer with:
  - Home, About, Blog, Knowledge Centre, Careers
  - Client Portal, New Recovery Request, My Cases, Support Our Work
  - Terms and Privacy
  - YouTube: https://www.youtube.com/@manlungrecory
  - LinkedIn: https://www.linkedin.com/in/mark-ochiengke
  - GitHub: https://github.com/markchtechcomputers
  - Privacy/service contact details

## OAuth branding note
The website can use `SUPABASE_AUTH_URL` when a Supabase Auth custom domain is configured. The Google consent screen can still display the Supabase project hostname until Google OAuth branding and/or a Supabase Auth custom domain is configured in the provider/project settings. This cannot be fixed safely by changing frontend text alone.

## Important
The update does not remove or rewrite the Call Admin/WebRTC functionality, recovery case API, evidence upload pipeline, or existing Admin/Owner MFA controls.
