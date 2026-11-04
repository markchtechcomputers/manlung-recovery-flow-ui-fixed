# Manlung messaging reliability — implementation and QA

## Scope and assumptions

This change keeps the existing direct-message and group-message APIs, local app settings, Supabase service-role access, PWA UI, and current chat ordering. It adds recipient-scoped receipts and read cursors instead of inferring delivery/read state from presence.

Assumptions:
- A direct message is **delivered** when the recipient's active app sync has fetched it. Presence alone is not a delivery receipt.
- A direct message is **read** only after the recipient opens that conversation and the server records a read receipt.
- A manually marked-unread conversation gets a read cursor at the action time. Messages before that cursor are not made unread and do not produce a notification.
- For groups, aggregate ticks exclude the sender and consider all current group-member rows. Archived/muted membership still counts as a member; mute affects notifications, not delivery.
- Existing historical read state cannot be reconstructed where no receipt existed. Migration-time read cursors establish a safe baseline so legacy history is not replayed as new.
- The current app uses in-app notices and the browser Notification API while the app is running. This change does not add a remote Web Push provider/subscription backend for delivery while the browser is completely closed.
- The full emoji picker is the device/browser emoji keyboard (including OS shortcuts and paste), not a hard-coded reaction list.

## Implementation plan and status

1. **Unread/read cursors** — add a per-conversation manual unread marker and last-read timestamp; only message rows newer than the cursor can be read/unread candidates.
2. **Receipts** — persist recipient delivery/read timestamps in dedicated tables; direct ticks map to sent/delivered/read, and group ticks use an aggregate rule.
3. **Notifications** — maintain per-conversation notification cursors; only newly arrived, unread incoming rows can notify. App setting, per-chat mute, browser permission, and chat-open state are checked. Notification tags and one in-app card per conversation prevent duplicate popups.
4. **Avatars** — always render a fallback first; remote images overlay it and remove themselves on error. Profile update timestamps are appended to image URLs to invalidate stale caches.
5. **Themes** — store per-direct-chat preferences in `recovery_chat_preferences` and per-group preferences in `recovery_chat_group_members`; provide presets, custom color, reset, and apply-to-all.
6. **Reactions** — use one active reaction per member/message. New v2 tables copy the latest legacy reaction without deleting legacy rows. Selecting the same emoji removes it; selecting another replaces it.
7. **QA** — run the test cases below against Preview after applying migration 032, then promote only after all critical tests pass.

## Data model

### Direct conversations

`recovery_chat_preferences` adds:
- `manual_unread`, `manual_unread_at`
- `last_read_at`
- `chat_theme_id`, `background_color`, `background_image_url`

`recovery_chat_message_receipts` stores one row per `message_id + user_id`:
- `delivered_at`: recipient app sync fetched the message
- `read_at`: recipient opened/read the conversation

### Group conversations

`recovery_chat_group_members` adds the same manual unread/read cursor and theme fields, plus `last_read_at`.

`recovery_chat_group_message_receipts` stores one row per `message_id + user_id`, with delivery and read timestamps.

### Reactions

- `recovery_chat_message_reactions_v2`
- `recovery_chat_group_reactions_v2`

Both have primary key `(message_id, user_id)`. Migration copies the most recent legacy reaction per user/message into v2. Legacy reaction rows are left intact.

## API changes

### Direct messages

- `GET /api/community/inbox` returns messages with receipt state plus per-peer preferences; it records delivery for incoming messages.
- `GET /api/community/messages/:memberId` returns the latest 100 messages and receipt state.
- `POST /api/community/messages/:memberId/read` marks only incoming messages newer than the max of `last_read_at` and `manual_unread_at` as read, then advances `last_read_at`.
- `POST /api/community/messages/:memberId/unread` sets the manual unread cursor without modifying old message rows.
- `GET/PATCH /api/community/messages/:memberId/preferences` reads/updates mute, archive, pin, theme, and background preferences.
- `GET /api/community/messages/:memberId/reactions` returns real reactions.
- `POST /api/community/messages/:memberId/:messageId/reactions` adds, changes, or toggles off the caller's reaction.

### Groups

- `GET /api/community/group-inbox` returns group messages/preferences and records delivery without marking them read.
- `GET /api/community/groups/:groupId/messages` marks only messages newer than the group's read cursor as read and returns aggregate receipt state for the sender's messages.
- `POST /api/community/groups/:groupId/unread` marks the group unread without changing old messages.
- `GET/PATCH /api/community/groups/:groupId/preferences` reads/updates mute and theme preferences.
- `GET /api/community/groups/:groupId/reactions` and `POST /api/community/groups/:groupId/messages/:messageId/reactions` support reactions in regular groups as well as official channels.

## UI state definitions

### Direct ticks

| State | Server condition | UI |
|---|---|---|
| Sent / not delivered | no recipient receipt `delivered_at` | single gray tick |
| Delivered / not read | `delivered_at` set, `read_at` null | double gray ticks |
| Read | `read_at` set | double blue ticks |

A read receipt remains blue even if presence later changes.

### Group ticks

For a sender's message, consider every current group member except the sender:
- single gray: at least one member has no delivery receipt;
- double gray: every other member has a delivery receipt, but at least one has no read receipt;
- double blue: every other member has a read receipt.

If there are no other members, leave the message at single gray rather than implying it was read.

### Notification eligibility

A message is eligible only if all are true:
- incoming to the current user;
- newer than the saved notification cursor;
- newer than the read/manual-unread cursor;
- has no read receipt;
- conversation is not muted;
- app-level notifications are enabled.

Opening a chat advances its read cursor and closes its in-app/native notification. A manual unread action only sets a cursor/badge; it does not alter old messages.

## QA test cases

### Unread and new-message behavior

1. Open a direct chat, read the latest messages, then mark it unread. Confirm only the conversation badge changes; message timestamps, order, and read receipts remain unchanged.
2. Sync/reload/restart after marking unread. Confirm no old message popup appears and the badge remains.
3. Send a new incoming message after the marker. Confirm one popup/notification and unread count increments.
4. Open the chat. Confirm the badge clears and only messages newer than the marker receive a read receipt.
5. Repeat with a group chat; confirm the same cursor behavior.
6. Receive a backlog of more than 100 messages, open the conversation, and verify the paginated read operation records all post-cursor messages without touching pre-cursor history.

### Avatars

1. Test members with no photo in chat list, header, group bubble, search, profile, call, and in-app notification. Confirm initials/neutral fallback appears.
2. Test an invalid/broken photo URL. Confirm fallback remains and no broken-image icon is shown.
3. Upload a new profile photo. Confirm all surfaces refresh and URL cache version changes.
4. Remove a photo. Confirm fallback appears immediately.

### Message ticks

1. Send to an offline recipient. Confirm single gray tick.
2. Bring recipient app online without opening chat. Confirm double gray tick.
3. Open chat on recipient. Confirm double blue tick.
4. Take recipient offline after read. Confirm sender still sees double blue after refresh/restart.
5. Group: with multiple members, verify single gray until all are delivered, double gray when all are delivered, and double blue only when all have read.

### Notifications

1. Enable app notifications and grant browser permission. Send one new incoming message; confirm one notice only.
2. Mute a direct chat and a group separately. Confirm badges update but no notification is shown for muted conversations.
3. Disable app notifications. Confirm no in-app or browser notifications.
4. Deny browser permission. Confirm no OS notification; in-app notices remain available while the app is focused.
5. Tap an in-app/browser notification. Confirm it opens the correct chat, marks eligible messages read, and closes the matching notification.
6. Read a conversation from inside the app. Confirm its corresponding notice is cleared.
7. Reconnect/reload with old messages. Confirm no notification replay.

### Themes and backgrounds

1. Apply each preset to one direct chat. Confirm other chats are unchanged.
2. Apply a custom background color. Check contrast for message text, ticks, timestamps, and reaction chips.
3. Reset a chat. Confirm mint/default theme returns.
4. Apply to all chats. Confirm existing direct chats and joined groups receive the chosen theme.
5. Reload/restart. Confirm theme persists locally and server preferences restore it.
6. Where a custom background image URL is set through preferences, confirm it applies only to that chat and text remains readable.

### Reactions

1. Load a normal text message and an announcement/broadcast. Confirm no emoji row is appended by default.
2. Add a reaction from the full device emoji keyboard. Confirm only actual reactions appear with counts.
3. Change a reaction. Confirm the prior reaction is replaced, not duplicated.
4. Select the same reaction again. Confirm it is removed.
5. React from a second account. Confirm chips/counts sync in real time and persist after reload.
6. Repeat for a direct chat, regular group, and official channel.
7. Confirm existing legacy reactions remain in the old tables and the latest reaction is available through v2.

### Regression checks

1. Send/receive text, replies, edits, unsend, voice, image/document attachments.
2. Verify chat list ordering still follows the last message, not manual unread state.
3. Verify search, friend list, group membership, archive, mute, pin, calls, and PWA install behavior.
4. Verify no new API startup errors and no unexpected 500s in runtime logs.
