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
