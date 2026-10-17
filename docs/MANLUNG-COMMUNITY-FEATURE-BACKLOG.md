# Manlung Community — outstanding feature tracker

This is the working checklist for the remaining community/chat requests. Do not mark an item complete until the implementation is committed and its behavior is tested. A code change is not proof that production works.

## Requested feature backlog

- [ ] Real-time delivery across client/admin and across devices; verify server persistence and polling/realtime behavior.
- [ ] Accurate delivered/read receipts (gray double tick when delivered/unread, blue double tick only after the recipient reads); remove simulated local receipts.
- [ ] Online/last-seen presence in direct and group chats, respecting privacy settings.
- [ ] Sticker and GIF search/send/receive, with safe rendering and upload limits.
- [ ] Fix Status/blue-badge Paystack checkout when the signed-in account has no valid email; validate the payment email and preserve KSh 100 pricing.
- [ ] Verify official-channel/admin blue ticks and paid member badge behavior from the server-authenticated role/profile state.
- [ ] Invite up to 40 friends; track successful signups and grant the inviter a one-month badge only when all required invitees qualify; automatically expire it.
- [ ] Settings UI: language selection, account name/bio/username/birthday, privacy policy, notifications, privacy controls.
- [ ] Auto-search web font/theme catalogue and let users preview/apply text fonts and text sizing without breaking the default theme.
- [ ] Verify camera-to-Status capture on mobile and desktop fallback.
- [ ] Improve signup and initial load performance; measure before/after.
- [ ] Test mobile/desktop, client/admin, group/direct, failure/retry, permissions, and live production deployment.
- [ ] Verify every pending feature in the browser and record the results here.

## Work notes

- Keep the existing login/authentication flow unchanged.
- Keep client and admin roles authorized by the authenticated server-side role, never by URL or email.
- Preserve Settings navigation and existing theme preferences.
- Production deployment is not confirmed; do not state that a change is live until verified.
