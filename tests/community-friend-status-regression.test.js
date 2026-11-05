const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const frontend = fs.readFileSync(path.join(root, 'public/client/connect.html'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes/community.js'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

test('friend request send confirms without waiting for a full community refresh', () => {
  const start = frontend.indexOf('window.requestFriendById=async function');
  const end = frontend.indexOf('\nwindow.openMemberProfileById', start);
  assert.ok(start >= 0 && end > start, 'friend request handler must exist');
  const handler = frontend.slice(start, end);
  assert.match(handler, /textContent='Sending…'/);
  assert.match(handler, /toast\('Friend request sent'\)/);
  assert.match(handler, /refresh\(true\)\.catch/);
  assert.doesNotMatch(handler, /await refresh\(true\);if\(result\.alreadyFriends/);
});

test('sent friend requests are listed and can be cancelled by their sender', () => {
  assert.match(frontend, /const sent=ML\.requests\.filter\(x=>x\.status==='pending'&&x\.direction==='sent'\)/);
  assert.match(frontend, /data-cancel=/);
  assert.match(frontend, /action:'cancel'/);
  assert.match(frontend, /Friend requests · Received/);
  assert.match(routes, /action === 'cancel'\s*\? request\.sender_user_id === req\.user\.id/);
});

test('status cards can resolve the poster name from the profile or account username', () => {
  assert.match(routes, /select\('id,username,avatar_path'\)/);
  assert.match(routes, /statusUserMap\.get\(String\(p\.user_id\)\)\?\.username/);
});

test('the privacy page has an explicit clean URL route and rewrite', () => {
  assert.match(vercel.routes, route => route.src === '^/privacy(?:\\.html)?/?$' && route.dest === '/public/privacy.html');
  assert.ok(vercel.rewrites.some(route => route.source === '/privacy' && route.destination === '/public/privacy'));
});

test('direct chats expose a close control that uses the shared back handler', () => {
  assert.match(frontend, /class="ib ml-chat-close" onclick="back\(\)" aria-label="Close chat"/);
});
