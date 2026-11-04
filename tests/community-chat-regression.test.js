const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const frontend = fs.readFileSync(path.join(root, 'public/client/connect.html'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes/community.js'), 'utf8');

test('group chat send state targets the submit button, not an auxiliary button', () => {
  assert.match(frontend, /form\.querySelector\('button\[type="submit"\]'\)/,
    'send state must target the form submit button');
  assert.doesNotMatch(frontend, /const sendButton=form\.querySelector\('button'\)/,
    'the first form button may be a sticker or other auxiliary action');
});

test('group chat Edit and Unsend actions have matching backend endpoints', () => {
  assert.match(frontend, /data-group-edit/);
  assert.match(frontend, /data-group-unsend/);
  assert.match(frontend, /\{method:'PATCH',body:JSON\.stringify\(\{message\}\)\}/);
  assert.match(frontend, /\{method:'DELETE'\}/);
  assert.match(routes, /router\.patch\('\/groups\/:groupId\/messages\/:messageId'/);
  assert.match(routes, /router\.delete\('\/groups\/:groupId\/messages\/:messageId'/);
});

test('group message mutations check membership and ownership', () => {
  const patchAt = routes.indexOf("router.patch('/groups/:groupId/messages/:messageId'");
  const deleteAt = routes.indexOf("router.delete('/groups/:groupId/messages/:messageId'");
  const reactionAt = routes.indexOf('// Group reactions are available');
  assert.ok(patchAt >= 0 && deleteAt > patchAt && reactionAt > deleteAt,
    'edit and unsend routes must be registered before reaction routes');
  const mutations = routes.slice(patchAt, reactionAt);
  assert.equal((mutations.match(/requireGroupMember\(gid, req\.user\.id\)/g) || []).length, 2);
  assert.equal((mutations.match(/String\(existing\.sender_user_id\) !== String\(req\.user\.id\) && !isAdmin\(req\.user\)/g) || []).length, 2);
  assert.match(mutations, /edited_at: new Date\(\)\.toISOString\(\)/);
  assert.match(mutations, /deleted_at: new Date\(\)\.toISOString\(\)/);
});


test('notification cursors suppress history and expose only post-session messages', () => {
  assert.match(routes, /router\.post\('\/notifications\/session'/);
  assert.match(routes, /notificationCursor/);
  assert.match(routes, /notification_messages/);
  assert.match(frontend, /startNotificationSession/);
  assert.match(frontend, /\/inbox\?device_id=/);
  assert.doesNotMatch(frontend, /incoming=next\.filter/);
});

test('mark-as-unread uses a separate cutoff and does not rewrite old messages', () => {
  assert.match(frontend, /function markChatUnread\(/);
  assert.match(routes, /marked_unread_at/);
  assert.match(routes, /body\.mark_unread === true/);
  assert.match(routes, /Math\.max\(a, b\)/);
  assert.match(frontend, /Marked as unread/);
});

test('direct read receipts are persisted and ticks distinguish delivered from read', () => {
  assert.match(routes, /router\.post\('\/messages\/:memberId\/read'/);
  assert.match(routes, /delivered_at: new Date\(\)\.toISOString\(\)/);
  assert.match(routes, /read_at: now/);
  assert.match(frontend, /tk\(m\[3\]\|0\)/);
  assert.match(frontend, /s>1\?'rd'/);
});

test('per-chat preferences include mute, notifications and theme settings', () => {
  assert.match(routes, /router\.put\('\/preferences\/:memberId'/);
  assert.match(routes, /theme_background_image_url/);
  assert.match(frontend, /openChatThemePicker/);
  assert.match(frontend, /markChatUnread/);
  assert.match(frontend, /notification_enabled/);
});

test('reactions render only persisted chips and support arbitrary Unicode emoji', () => {
  const start = frontend.indexOf('const bub=(m,i)=>');
  const end = frontend.indexOf('async function refreshDirectReactions', start);
  const renderer = frontend.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(renderer, /m\[13\]/);
  assert.doesNotMatch(renderer, /m\[7\]&&m\[7\]\.length/);
  assert.doesNotMatch(renderer, /ml-channel-reaction-picker/);
  assert.match(routes, /Extended_Pictographic|\\\\p\{Emoji\}/);
  assert.match(frontend, /inputmode="text"/);
});

test('group reactions, group themes and aggregate group receipts are supported', () => {
  assert.match(routes, /router\.get\('\/groups\/:groupId\/preferences'/);
  assert.match(routes, /router\.put\('\/groups\/:groupId\/preferences'/);
  assert.match(routes, /recovery_chat_group_message_receipts/);
  assert.match(routes, /recipient_count: activeRecipientCount/);
  assert.match(frontend, /ml-group-theme/);
  assert.match(frontend, /ml-group-mark-unread/);
  assert.match(frontend, /ml-group-receipt/);
});

test('messaging migration adds notification cursors, read state and theme fields', () => {
  const migration = fs.readFileSync(path.join(root, 'db/migrations/032_whatsapp_messaging_consistency.sql'), 'utf8');
  assert.match(migration, /recovery_chat_notification_cursors/);
  assert.match(migration, /recovery_chat_group_message_receipts/);
  assert.match(migration, /marked_unread_at/);
  assert.match(migration, /theme_background_image_url/);
  assert.match(migration, /delivered_at timestamptz/);
  assert.match(migration, /read_at timestamptz/);
});
