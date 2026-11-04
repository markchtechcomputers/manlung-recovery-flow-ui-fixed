# Manlung WhatsApp-style messaging behavior

## Scope and assumptions

This change covers Manlung Community 1:1 conversations, community groups and the official updates channel. Existing auth, friendship/Chat Pass rules, attachments, voice messages, status, PWA and call flows remain in place.

Assumptions:
- The server is authoritative for message delivery/read state, per-chat unread state, preferences and reactions.
- The app uses authenticated local notifications while the app is running. The current deployment does not have a configured Web Push subscription pipeline, so background/closed-app push delivery is not claimed. The foreground app surfaces local notifications for direct and group messages.
- A device notification cursor is reset at app start and when the page resumes from the background. Messages that arrived before that session/resume boundary remain in history and unread counts but are not replayed as pop-ups.
- Group receipts use active, non-archived members as the recipient population.
- Group mute, notification, unread cursor and theme preferences are stored on each user's group-membership row.

## Data model

### 1:1 messages
`recovery_community_messages` (new `delivered_at` / `read_at` fields are backfilled from the earlier `recovery_chat_message_receipts` table):
- `delivered_at`: first successful delivery while the recipient has a fresh presence heartbeat.
- `read_at`: recipient read event. Once set, it remains set regardless of later presence changes.

### Per-user conversation preferences
`recovery_chat_preferences`:
- Existing: `archived`, `muted`, `pinned`, `starred`.
- Added: `last_read_at`, `marked_unread_at`, `notification_enabled`, `theme_key`, `theme_background_color`, `theme_background_image_url`.

Unread is computed from incoming messages newer than the later of `last_read_at` and `marked_unread_at`. A manual unread marker can show a badge even if there is no newer message. Marking unread does not edit message rows or alter old read receipts. Opening the chat advances `last_read_at`, clears `marked_unread_at`, and marks only incoming messages newer than the cutoff as read.

### Device notification cursor
`recovery_chat_notification_cursors` stores `user_id`, `device_id` and `last_polled_at`. Session start/resume moves the cursor to the current time; each inbox poll returns only incoming messages newer than the cursor and advances it. This is separate from the unread cursor.

### Reactions
- Direct-message reactions are stored in `recovery_chat_message_reactions`.
- Group reactions are stored in `recovery_chat_group_reactions`.
- One reaction per user/message is supported. Choosing a different emoji replaces the old reaction; an empty reaction removes it.
- The server accepts a Unicode emoji rather than enforcing a short allow-list.

### Group receipts
`recovery_chat_group_message_receipts` stores per-member `delivered_at` and `read_at`.
`recovery_chat_group_members` also stores per-member `last_read_at`, `marked_unread_at`, `notification_enabled` and theme settings.

Aggregate group tick rule for a message sent by the current user:
- **Single gray tick:** no active recipient has received it.
- **Double gray tick:** at least one active recipient has received it, but not every active recipient has read it.
- **Double blue tick:** every active, non-archived recipient has read it.
- The UI also displays read/recipient counts. The sender is excluded from the recipient population.

## API changes

- `POST /api/community/notifications/session`: initialize/reset this device's notification cursor.
- `GET /api/community/inbox?device_id=...`: returns message history, preferences, unread counts and only genuinely new notification candidates.
- `GET /api/community/messages/:memberId`: returns direct-message delivery/read timestamps and marks messages delivered when the recipient is online.
- `POST /api/community/messages/:memberId/read`: marks only messages newer than the conversation read cutoff as read; advances the cursor and clears manual unread.
- `GET /api/community/preferences/:memberId` and `PUT /api/community/preferences/:memberId`: read/update mute, notification, unread-marker and theme preferences.
- `GET /api/community/messages/:memberId/reactions` and `POST /api/community/messages/:memberId/:messageId/reactions`: direct reactions.
- `GET /api/community/groups/:groupId/preferences` and `PUT /api/community/groups/:groupId/preferences`: group mute, notification, unread-marker and theme preferences.
- `GET /api/community/groups/:groupId/messages` and `POST /api/community/groups/:groupId/read`: group history and receipts.
- Group reaction endpoints now work for all joined groups, not only official channels.

## UI states

- Message tick: `0 = sent`, `1 = delivered`, `2 = read`. Read is monotonic; it is not downgraded when presence changes.
- Conversation unread: server unread count, or a manual unread marker badge.
- Notification: only a server-provided notification candidate, and only when app notifications are enabled, the chat is not muted, and the chat-specific notification setting is enabled.
- Avatar: versioned profile image when available; neutral avatar fallback on missing URL or image-load failure.
- Reaction: no default emoji row. Only persisted reactions render as chips with counts. The picker accepts any emoji through the device's system emoji keyboard/input.
- Theme: per-chat preset/custom colour/image, with an explicit apply-to-all action and reset.

## QA acceptance tests

1. Mark an old conversation unread; confirm the badge appears but no old message is labelled new, reordered or popped up.
2. Send a message after marking unread; confirm only that message increments unread and can notify.
3. Open the conversation; confirm the badge clears and only messages newer than the read cutoff receive a read event.
4. Reload, reconnect and resume from background with old messages present; confirm no old notifications replay.
5. Deliver a message while recipient is offline, then online; confirm tick transitions single gray -> double gray -> double blue after a read event.
6. Restart the app after read; confirm double blue remains blue.
7. Disable app notifications, mute one chat, and disable notifications for one chat; confirm each setting independently suppresses pop-ups.
8. Tap a local notification; confirm the correct conversation opens and is marked read.
9. Remove/break a profile image URL; confirm all avatar surfaces show a neutral fallback. Upload a replacement; confirm the versioned URL refreshes.
10. Set different themes on two chats; confirm only the selected chat changes. Apply to all and reset; confirm persistence after reload.
11. React to direct and group messages with a quick emoji and an emoji from the system keyboard; change and remove reactions; confirm only actual reactions render and counts sync.
12. In a group, test one recipient delivered, some read, all read, archived member and sender-excluded counts; verify the aggregate tick rule above.
13. Regression: send/receive text, voice and attachments; edit/unsend; search; chat list order; friend/Chat Pass gating; PWA reload; calls.

## Deployment note

Apply `db/migrations/032_whatsapp_messaging_consistency.sql` to the main Supabase project before deploying the API/UI branch. This migration is additive. Verify the preview and run the QA cases before promoting to production.
