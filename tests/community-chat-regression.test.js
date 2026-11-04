const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const frontend = fs.readFileSync(path.join(root, 'public/client/connect.html'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes/community.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'db/migrations/032_whatsapp_messaging_consistency.sql'), 'utf8');
const avatarPlaceholder = fs.readFileSync(path.join(root, 'public/client/avatar-placeholder.svg'), 'utf8');

test('unread state and notification delivery use separate cursors', () => {
  assert.match(routes, /router\.post\('\/notifications\/session'/);
  assert.match(routes, /recovery_chat_notification_cursors/);
  assert.match(routes, /notification_messages/);
  assert.doesNotMatch(routes, /pref\.last_read_at\s*\|\|\s*notificationCursor/);
  assert.doesNotMatch(routes, /update\(\{\s*last_polled_at:\s*now/);
  assert.match(frontend, /startNotificationSession/);
  assert.match(frontend, /\/inbox\?device_id=/);
  assert.match(frontend, /notification_messages/);
  assert.match(frontend, /__mlNotifiedMessageIds/);
});

test('mark as unread changes a conversation boundary, not message history', () => {
  assert.match(frontend, /function markChatUnread\(/);
  assert.match(frontend, /markGroupUnread=async/);
  assert.match(routes, /body\.mark_unread === true/);
  assert.match(routes, /marked_unread_at/);
  assert.match(routes, /last_read_at/);
  assert.match(frontend, /Marked as unread/);
  const directPrefsStart = routes.indexOf("router.put('/preferences/:memberId'");
  const directPrefsEnd = routes.indexOf("router.post('/blocks/:memberId'", directPrefsStart);
  const groupPrefsStart = routes.indexOf("router.put('/groups/:groupId/preferences'");
  const groupPrefsEnd = routes.indexOf("router.get('/groups/:groupId/messages'", groupPrefsStart);
  assert.ok(directPrefsStart >= 0 && directPrefsEnd > directPrefsStart);
  assert.ok(groupPrefsStart >= 0 && groupPrefsEnd > groupPrefsStart);
  assert.doesNotMatch(routes.slice(directPrefsStart, directPrefsEnd), /recovery_community_messages|read_at:\\s*now/);
  assert.doesNotMatch(routes.slice(groupPrefsStart, groupPrefsEnd), /recovery_chat_group_message_receipts|read_at:\\s*now/);
});

test('opening a direct conversation marks only messages newer than the read cutoff', () => {
  assert.match(routes, /router\.post\('\/messages\/:memberId\/read'/);
  assert.match(routes, /\.gt\('created_at', new Date\(cutoff\)\.toISOString\(\)\)/);
  assert.match(routes, /read_at: now/);
  assert.match(frontend, /row\.read_at\?2:\(row\.delivered_at\?1:0\)/);
  assert.match(frontend, /clearChatNotifications/);
});

test('1:1 delivery and read ticks use persisted server timestamps', () => {
  assert.match(routes, /delivered_at/);
  assert.match(routes, /read_at/);
  assert.match(frontend, /row\.read_at\?2:\(row\.delivered_at\?1:0\)/);
  assert.match(migration, /add column if not exists delivered_at timestamptz/);
  assert.match(migration, /add column if not exists read_at timestamptz/);
});

test('direct and group reactions are persisted, replaceable and removable', () => {
  assert.match(routes, /router\.get\('\/messages\/:memberId\/reactions'/);
  assert.match(routes, /router\.post\('\/messages\/:memberId\/:messageId\/reactions'/);
  assert.match(routes, /router\.get\('\/groups\/:groupId\/reactions'/);
  assert.match(routes, /router\.post\('\/groups\/:groupId\/messages\/:messageId\/reactions'/);
  assert.match(routes, /onConflict: 'message_id,user_id'/);
  assert.match(routes, /\\p\{Emoji\}/);
  assert.match(migration, /recovery_chat_message_reactions_one_per_user_idx/);
  assert.match(migration, /recovery_chat_group_reactions_one_per_user_idx/);
});

test('message content renders reaction chips only when persisted reactions exist', () => {
  const start = frontend.indexOf('const bub=(m,i)=>');
  const end = frontend.indexOf('function paint(c)', start);
  assert.ok(start >= 0 && end > start, 'message renderer must be present');
  const renderer = frontend.slice(start, end);
  assert.match(renderer, /Array\.isArray\(m\[13\]\)&&m\[13\]\.length/);
  assert.doesNotMatch(renderer, /m\[7\]&&m\[7\]\.length/);
  assert.doesNotMatch(frontend, /rr\.className='rxr'/);
  assert.match(frontend, /function openMessageReactionPicker/);
  assert.match(frontend, /inputmode="text"/);
  assert.match(frontend, /const openPicker=\\(mid\\)=>/);
});

test('per-chat themes, mute and notification preferences persist through the API', () => {
  assert.match(frontend, /ML_CHAT_PALETTES/);
  assert.match(frontend, /function openChatThemePicker/);
  assert.match(frontend, /function applyChatTheme/);
  assert.match(frontend, /applyGroupTheme/);
  assert.match(routes, /router\.get\('\/preferences\/:memberId'/);
  assert.match(routes, /router\.put\('\/preferences\/:memberId'/);
  assert.match(routes, /router\.get\('\/groups\/:groupId\/preferences'/);
  assert.match(routes, /router\.put\('\/groups\/:groupId\/preferences'/);
  assert.match(routes, /theme_background_color/);
  assert.match(routes, /theme_background_image_url/);
  assert.match(routes, /notification_enabled/);
});

test('default avatars and cache-busted profile photos cover broken-image cases', () => {
  assert.match(frontend, /const defaultAvatar=/);
  assert.match(frontend, /function avatarSrc\(/);
  assert.match(frontend, /avatarVersion/);
  assert.match(frontend, /document\.addEventListener\('error',event=>/);
  assert.match(frontend, /img\.remove\(\);parent\.classList\.add\('ml-default-avatar'\)/);
  assert.match(frontend, /avatar-placeholder\.svg/);
  assert.match(avatarPlaceholder, /<svg/);
  assert.match(routes, /avatarUpdatedAt/);
});

test('group delivery/read receipts follow the documented active-recipient aggregate', () => {
  assert.match(routes, /recovery_chat_group_message_receipts/);
  assert.match(routes, /recipient_count: activeRecipientCount/);
  assert.match(routes, /status = activeRecipientCount > 0 && value\.read >= activeRecipientCount \? 2 : value\.delivered > 0 \? 1 : 0/);
  assert.match(routes, /canExposeRead = profile\?\.read_receipts_enabled !== false/);
  assert.match(frontend, /ml-group-receipt/);
  assert.match(frontend, /\/groups\/.*\/read/);
});

test('notification UI respects app setting, chat mute and browser permission', () => {
  assert.match(frontend, /if\(S\.notif\)/);
  assert.match(frontend, /pref\.muted===true\|\|pref\.notification_enabled===false/);
  assert.match(frontend, /Notification\.permission==='granted'/);
  assert.match(frontend, /icon:\(c\.avatar\|\|c\.avatar_url\)\?avatarSrc/);
  assert.match(frontend, /note\.onclick=\(\)=>/);
  assert.match(frontend, /clearChatNotifications/);
});

test('group message form targets its submit button rather than an auxiliary control', () => {
  assert.match(frontend, /form\.querySelector\('button\[type="submit"\]'\)/);
  assert.doesNotMatch(frontend, /const sendButton=form\.querySelector\('button'\)/);
});

test('messaging migration is additive and keeps browser access server-mediated', () => {
  assert.match(migration, /recovery_chat_notification_cursors/);
  assert.match(migration, /recovery_chat_group_message_receipts/);
  assert.match(migration, /marked_unread_at/);
  assert.match(migration, /theme_background_image_url/);
  assert.match(migration, /revoke all on table public\.recovery_chat_notification_cursors from anon, authenticated/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});
