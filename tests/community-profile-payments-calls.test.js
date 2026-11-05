const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const frontend = fs.readFileSync(path.join(root, 'public/client/connect.html'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes/community.js'), 'utf8');
const statusMigration = fs.readFileSync(path.join(root, 'db/migrations/034_status_plan_priority.sql'), 'utf8');

test('stored private-bucket profile photos are signed for member views and respect avatar privacy', () => {
  assert.match(routes, /CLIENT_PROFILE_PHOTO_BUCKET = 'client-profile-photos'/);
  assert.match(routes, /createSignedUrl\(user\.avatar_path, 60 \* 60\)/);
  assert.match(routes, /profile\?\.avatar_visibility === 'private' && !includePrivate\) return null/);
  assert.match(routes, /resolveAvatarMap\(users, profiles\)/);
  assert.match(frontend, /window\.communityAvatar/);
  assert.match(frontend, /avatar:x\.owner&&x\.owner\.avatar/);
});

test('status plans use Paystack checkout rather than the former demo payment prompt', () => {
  assert.match(routes, /PAYSTACK_PLAN_PRO/);
  assert.match(routes, /if\(planCode\)payload\.plan=planCode/);
  assert.match(routes, /billing_mode:planCode\?'recurring':'one_time'/);
  assert.doesNotMatch(routes, /The matching monthly Paystack plan is not configured/);
  assert.match(frontend, /window\.apiReq\('\/plans\/initialize'/);
  assert.doesNotMatch(frontend, /M-Pesa number \(demo, no real charge\)/);
  assert.match(frontend, /planOf\(\)==='free'&&!credits\.freeAvailable/);
  assert.match(frontend, /activeStatusPlan/);
});

test('database status allowance enforces the paid Plus and Pro tiers', () => {
  assert.match(statusMigration, /when 'plus' then 3 when 'pro' then 100/);
  assert.match(statusMigration, /order by case p\.plan_code when 'pro' then 2 when 'plus' then 1/);
  assert.match(statusMigration, /STATUS_ALLOWANCE_EXHAUSTED/);
});

test('registered member profiles expose direct voice and video call actions', () => {
  assert.match(frontend, /data-ml-action="voice"/);
  assert.match(frontend, /data-ml-action="video"/);
  assert.match(frontend, /window\.call\?\.\(name,false\)/);
  assert.match(frontend, /window\.call\?\.\(name,true\)/);
});

test('peer calling supports registered roles, accepted friends, online presence and durable signaling', () => {
  assert.match(routes, /if\(!roles\.includes\(req\.user\.role\)\)/);
  assert.match(routes, /!roles\.includes\(callee\.role\)/);
  assert.match(routes, /areAcceptedFriends\(req\.user\.id,other\)/);
  assert.match(routes, /recovery_chat_presence/);
  assert.match(routes, /recovery_peer_call_signals/);
  assert.match(routes, /status:'missed'/);
});
