# Manlung Community — outstanding feature tracker

This is the working checklist for the remaining community/chat requests. Do not mark an item complete until the implementation is committed and its behavior is tested. A code change is not proof that production works.

## Requested feature backlog

- [ ] Real-time delivery across client/admin and across devices; verify server persistence and polling/realtime behavior.
- [x] Direct-message receipt backend and UI wiring added: GET marks incoming messages delivered, active open chat posts a read receipt, and ticks render gray for delivered/unread and blue for read. Requires migration `032_message_receipts.sql`; end-to-end behavior is not yet browser-tested. Simulated local receipt timers have now been removed. End-to-end behavior still needs browser verification.
- [ ] **Partially implemented:** direct chat headers now show online or last-seen time when the profile API exposes it. Group presence and full privacy/receipt verification remain pending.
- [x] Added direct/group sticker picker (emoji stickers), Tenor search launch plus direct HTTPS GIF URL sharing, and host/path allowlisted rendering in client/admin pages. Browser send/receive verification remains pending; the GIF flow currently requires pasting a direct .gif URL.
- [ ] **Code updated:** Status/blue-badge checkout accepts a valid payment email when the account email is missing/invalid and keeps KSh 100 pricing. Still needs a live Paystack test.
- [ ] Verify official-channel/admin blue ticks and paid member badge behavior from the server-authenticated role/profile state.
- [ ] Invite up to 40 friends; track successful signups and grant the inviter a one-month badge only when all required invitees qualify; automatically expire it.
- [ ] **Partially implemented:** username, birthday and preferred-language fields added to Settings and profile route; privacy policy link added. Apply `db/migrations/031_account_preferences.sql` and `db/migrations/032_message_receipts.sql` to the correct Manlung app database, then test updates and receipts. Language is stored but the whole UI is not yet translated. Notifications/privacy controls still need a complete audit.
- [ ] **Code updated:** Settings can open Google Fonts search, apply a named font through Google Fonts CSS, adjust text size, and reset. Browser/device verification remains pending.
- [ ] Verify camera-to-Status capture on mobile and desktop fallback.
- [x] Video status upload and playback added for MP4, WebM, and MOV files (8 MB max) using the existing private signed-URL bucket. The bucket migration now allows those MIME types and 10 MiB objects; the JSON body limit was raised to accommodate base64 payloads. Still requires the matching SQL migration and browser/device testing.
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
- Sticker/GIF controls and safe message rendering added to direct and group composers on both client/admin pages; inline JavaScript syntax checks passed. Simulated local receipt timers removed; receipt UI now depends on server timestamps. End-to-end sending and external GIF loading are not yet browser-tested.
- Checkout email fallback committed in client page and backend route; syntax checks passed. Live Paystack checkout has not been tested.
- Username, birthday and language preference controls committed in both pages; backend validation and migration file added. The migration has **not** been applied because the currently connected Supabase project has not been verified as the Manlung Recovery production database.
- Direct chat header now displays online/last-seen from the existing profile presence API when permitted by profile privacy settings.
- Direct message API now returns `delivered_at`/`read_at`, records delivery on message fetch, and has an authenticated read-receipt endpoint. Client/admin message mapping renders receipt states from server timestamps. SQL migration 032 is required before these API changes can work.
- Fixed double-escaped birthday-date and checkout-email validation patterns found during code review.
- Privacy policy link added to Settings and points to the repository's existing `/privacy.html` page.

- Added a video option to the status composer in client and admin views, maps server status types, and renders uploaded videos in the status viewer. Backend validates supported video MIME types and an 8 MiB payload cap before private upload. This is code-complete but not browser-tested; apply `db/migrations/032_private_status_media_storage.sql` to the correct Manlung app database first.
- Do not mark any of the above production-complete until browser and backend checks pass.


## New requests from 2026-10-17

- [x] Keep Manlung Updates at the top of the chat list regardless of manual pin state.
- [x] Hide statuses from the feed after they have been viewed, using the existing status-view records.
- [x] Add a reply action in the status viewer that sends a status comment/reply.
- [x] Add the requested Manlung Community card/icon, joined-group label, description, and member-count display.
- [x] Compact settings row spacing and improve admin chat layout isolation/scrolling; Enter sends in admin direct/group composer while Shift+Enter adds a newline.
- [ ] Message receipts must be verified end-to-end: one tick after send, two gray ticks after delivery, two blue ticks after read; verify offline recipient behavior on real accounts.
- [ ] Enable editing sent direct messages and confirm authorization/window rules server-side.
- [ ] Ensure admin and verified-client names/badges render consistently beside every direct/group message.
- [ ] Confirm admin/client chat layout, last-seen presence, realtime message arrival, status reply delivery, and settings on mobile/desktop.
- [ ] Run browser tests, apply any required migrations to the verified production database, and confirm deployment.
