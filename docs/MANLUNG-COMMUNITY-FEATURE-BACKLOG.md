# Manlung Community — outstanding feature tracker

This is the working checklist for the remaining community/chat requests. Do not mark an item complete until the implementation is committed and its behavior is tested. A code change is not proof that production works.

## Requested feature backlog

- [ ] Real-time delivery across client/admin and across devices; verify server persistence and polling/realtime behavior.
- [ ] Accurate delivered/read receipts (gray double tick when delivered/unread, blue double tick only after the recipient reads); remove simulated local receipts.
- [ ] **Partially implemented:** direct chat headers now show online or last-seen time when the profile API exposes it. Group presence and full privacy/receipt verification remain pending.
- [ ] Sticker and GIF search/send/receive, with safe rendering and upload limits.
- [ ] **Code updated:** Status/blue-badge checkout accepts a valid payment email when the account email is missing/invalid and keeps KSh 100 pricing. Still needs a live Paystack test.
- [ ] Verify official-channel/admin blue ticks and paid member badge behavior from the server-authenticated role/profile state.
- [ ] Invite up to 40 friends; track successful signups and grant the inviter a one-month badge only when all required invitees qualify; automatically expire it.
- [ ] **Partially implemented:** username, birthday and preferred-language fields added to Settings and profile route; privacy policy link added. Apply `db/migrations/031_account_preferences.sql` to the correct Manlung app database, then test updates. Language is stored but the whole UI is not yet translated. Notifications/privacy controls still need a complete audit.
- [ ] **Code updated:** Settings can open Google Fonts search, apply a named font through Google Fonts CSS, adjust text size, and reset. Browser/device verification remains pending.
- [ ] Verify camera-to-Status capture on mobile and desktop fallback.
- [ ] Improve signup and initial load performance; measure before/after.
- [ ] Test mobile/desktop, client/admin, group/direct, failure/retry, permissions, database migration, and live production deployment.
- [ ] Verify every pending feature in the browser and record the results here.

## Work notes

- Keep the existing login/authentication flow unchanged.
- Keep client and admin roles authorized by the authenticated server-side role, never by URL or email.
- Preserve Settings navigation and existing theme preferences.
- Production deployment is not confirmed; do not state that a change is live until verified.

## Latest branch changes

- Text theme controls and Google Fonts CSS loader committed in both client/admin pages; inline JavaScript syntax checks passed.
- Checkout email fallback committed in client page and backend route; syntax checks passed. Live Paystack checkout has not been tested.
- Username, birthday and language preference controls committed in both pages; backend validation and migration file added. The migration has **not** been applied because the currently connected Supabase project has not been verified as the Manlung Recovery production database.
- Direct chat header now displays online/last-seen from the existing profile presence API when permitted by profile privacy settings.
- Privacy policy link added to Settings and points to the repository's existing `/privacy.html` page.
- Do not mark any of the above production-complete until browser and backend checks pass.
