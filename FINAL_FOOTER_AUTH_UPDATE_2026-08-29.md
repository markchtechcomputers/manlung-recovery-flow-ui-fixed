# Final Footer & Social Authentication Update — 2026-08-29

Applied to the supplied Manlung Recovery project.

## Footer
- Replaced the duplicated footer markup across all public HTML pages.
- Removed the "Need help with a digital recovery case?" CTA from the footer.
- Removed decorative Font Awesome icons from footer navigation, social links, contact links and footer actions.
- Rebalanced desktop footer into four clear columns.
- Added responsive tablet and phone layouts.
- Moved social links to the far/right side of the desktop footer contact row.
- Kept social links as text buttons: YouTube, LinkedIn, GitHub.
- Kept the Manlung Recovery logo/brand mark.
- Ensured all 23 footer pages load `/css/footer.css`.

## Signed-in header
- Removed the visible `Signed in` status text.
- Removed the authenticated user icon and logout icon from the signed-in account controls.
- The authenticated account still links to the client dashboard and retains Log Out functionality.

## Social authentication
- Changed the browser Supabase OAuth flow from PKCE to implicit in `public/login.html` and `public/oauth-callback.html`.
- The existing callback already supports the OAuth hash token flow.

## Verification
- 23 footer instances found.
- 0 footer CTA instances remain.
- 0 `<i>` icon elements remain inside the footer markup.
- 0 `flowType: 'pkce'` occurrences remain in login/callback.
- 0 `Signed in` occurrences remain in `public/js/site-auth.js`.
- All 23 footer pages reference `/css/footer.css`.
