# Manlung messaging consistency — implementation notes

## Scope and compatibility

This implementation covers 1:1 Community chats, joined community groups and the official updates channel. It preserves the existing authentication, friendship/Chat Pass checks, voice messages, attachments, edit/unsend, search, status, PWA and call flows. It does not merge the separate experimental community redesign or group-approval branch.

The app's existing service worker does not register a Web Push subscription or handle push events. Therefore this implementation provides **foreground in-app notices and browser/local notifications while the Manlung page is running and permitted**. It does not claim background/closed-app push delivery. A Web Push service requires a VAPID key pair, subscription endpoint storage, a server sender and service-worker push/click handlers; that is a separate production capability.

## Data model

### 1:1 messages — `recovery_community_messages`

- `delivered_at`: set when the recipient has a fresh presence heartbeat (within 60 seconds) and the inbox/message API confirms delivery.
- `read_at`: set only by a read event when that recipient has read receipts enabled. Once set, it is never downgraded when presence changes.
- Existing `recovery_chat_message_receipts` values are copied into these columns by migration 032.

### Per-user 1:1 preferences — `recovery_chat_preferences`

Existing fields: `archived`, `muted`, `pinned`, `starred`, `cleared_before`.

Added fields:
- `last_read_at`: last conversation read boundary.
- `marked_unread_at`: explicit manual unread boundary.
- `notification_enabled`: per-chat notification preference.
- `theme_key`, `theme_background_color`, `theme_background_image_url`: per-chat appearance.

Unread counts use incoming, not-yet-read messages newer than the later of `last_read_at` and `marked_unread_at`. If the user manually marks a chat unread but there is no newer message, the inbox returns a manual unread marker (count 1). Marking unread does not update message rows, alter old receipts or move the conversation's last-message timestamp. The device notification cursor is deliberately not reset by this action.

### Device notification cursor — `recovery_chat_notification_cursors`

One row per user/device stores `last_polled_at`. The app initializes/resets this cursor at a fresh session and when returning to the foreground. The inbox returns notification candidates only newer than the device cursor and the conversation's read/manual-unread boundaries. This suppresses old history after app restart/reconnect/resume while leaving genuine unread counts independent.

### Group membership preferences — `recovery_chat_group_members`

Added per-member fields: `last_read_at`, `marked_unread_at`, `notification_enabled`, `theme_key`, `theme_background_color`, `theme_background_image_url`, and `updated_at`. Existing `muted` and `archived` remain authoritative.

### Group receipts — `recovery_chat_group_message_receipts`

Stores per-message/per-member `delivered_at` and `read_at`.

**Group aggregate rule (sender excluded; only active, non-archived members count):**
- Single gray tick: no other active member has fetched/delivered the message.
- Double gray tick: at least one other active member has received it, but not all active recipients have read it.
- Double blue tick: every other active member has read it.
- The sender also sees a read/recipient count. Archived members are excluded from the denominator.

### Reactions

- Direct: `recovery_chat_message_reactions`.
- Groups: `recovery_chat_group_reactions`.
- The app enforces one reaction per user/message. Choosing another emoji replaces it; an empty reaction removes it.
- Migration 032 deduplicates legacy rows and adds unique `(message_id,user_id)` indexes so concurrent changes cannot create multiple reactions for one user/message.
- The server accepts Unicode emoji input; the UI offers quick shortcuts plus a text field that opens the device emoji keyboard on mobile and accepts pasted emoji on desktop.

## API changes

- `POST /api/community/notifications/session`: initialize/reset one device's notification cursor.
- `GET /api/community/inbox?device_id=...`: history, per-chat preferences, unread counts and only eligible new-notification candidates.
- `GET /api/community/messages/:memberId`: returns delivery/read timestamps; records delivery when the current recipient is online.
- `POST /api/community/messages/:memberId/read`: marks only incoming messages newer than the later read/manual-unread boundary as read, advances `last_read_at`, clears the manual marker.
- `GET/PUT /api/community/preferences/:memberId`: mute, archive/pin/star, notification, unread and theme settings.
- `GET /api/community/messages/:memberId/reactions` and `POST /api/community/messages/:memberId/:messageId/reactions`: direct reactions.
- `GET/PUT /api/community/groups/:groupId/preferences`: group mute, notification, unread and theme settings.
- `GET /api/community/groups/:groupId/messages` and `POST /api/community/groups/:groupId/read`: group delivery/read receipts.
- Group reaction endpoints support joined groups, not only official channels.

## UI state definitions

- Direct tick state: `0 = sent/not delivered`, `1 = delivered`, `2 = read`.
- A read timestamp wins over later presence changes. Online status alone never creates a blue tick.
- Conversation unread: server unread count or a manual unread marker.
- Notification candidate: server-provided new message ID, not a frontend diff of message history. IDs are deduplicated in the current page session.
- Notification eligibility: app notifications enabled, chat not muted, chat notifications enabled, browser permission granted for OS notification. The in-app notice is shown only while app notifications are enabled.
- Avatar: versioned profile photo if available; neutral 👤 fallback for missing/failed images.
- Reaction chips: absent when no persisted reaction exists; otherwise grouped by emoji and count, with the current user's reaction highlighted.
- Theme: per-chat preset/custom color/image; direct chats also expose an explicit Apply to all action and Reset.

## QA acceptance matrix

1. Mark a conversation with old read history as unread. Confirm only the manual unread marker appears; no old message is rewritten, reordered or popped up.
2. Send a new message after the mark. Confirm only the new message increments unread and can produce a notice.
3. Open the conversation. Confirm the badge clears and only messages newer than the read/manual-unread boundary receive a read event.
4. Reload, reconnect and return from background with old messages present. Confirm old history does not produce pop-ups; existing unread state remains represented by the read cursor.
5. Send while recipient is offline: sender sees one gray tick. Bring recipient online and allow inbox polling: double gray. Open/read: double blue. Take recipient offline and restart sender app: double blue remains.
6. Disable recipient read receipts: online delivery may become double gray, but no blue tick is inferred from presence.
7. Independently disable app notifications, mute one chat, disable notifications for one chat and deny browser permission. Confirm each setting suppresses the appropriate in-app/OS notice.
8. Tap direct and group notifications. Confirm the correct conversation opens, its unread state clears, and its corresponding notice closes.
9. Test a missing avatar URL and a URL that returns 404 across list, header, member/profile and call surfaces. Confirm neutral fallback. Upload a new photo and confirm the version query changes and all surfaces refresh.
10. Set different themes on two chats. Confirm only the selected chat changes; Apply to all changes the default/all synced chats; Reset restores the default. Repeat with custom color and HTTPS image; check text, tick and reaction-chip contrast in light/dark mode.
11. Confirm no reaction row appears on a fresh message or broadcast. Add a quick reaction and an arbitrary emoji from the device keyboard; confirm chips/counts sync, change replaces, remove clears, and reload preserves state.
12. In a group, test no recipient delivered, one recipient delivered, some recipients read, all active recipients read, archived members and sender-excluded counts. Confirm aggregate tick rule.
13. Regression: text/voice/attachment send and receive, edit/unsend, chat search, chat list ordering, friendship/Chat Pass gating, PWA reload/offline shell and calls.
14. Confirm the production database has migration 032 applied before enabling the new API routes.

## Deployment order

1. Apply `db/migrations/032_whatsapp_messaging_consistency.sql` to the main Supabase project used by Manlung.
2. Deploy the branch to a Vercel Preview.
3. Test API health, direct messages, groups, receipts, notification cursor and static browser behavior.
4. Run `npm test` and the device/browser QA matrix.
5. Promote only after the migration and Preview checks pass.
