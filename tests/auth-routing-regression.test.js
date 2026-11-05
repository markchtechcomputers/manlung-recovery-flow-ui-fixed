const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

test('root URL resolves to the public index document', () => {
  const route = vercel.routes.find(item => item.src === '^/$');
  assert.ok(route, 'root route is explicitly configured');
  assert.equal(route.dest, '/public/index.html');
});

test('extensionless public and client routes resolve to their HTML documents', () => {
  const route = vercel.routes.find(item => item.src === '^/((?:[^./]+/)*[^./]+)/?$');
  assert.ok(route, 'clean HTML route is configured');
  const matcher = new RegExp(route.src);
  assert.match('/about', matcher);
  assert.match('/client/dashboard', matcher);
  assert.doesNotMatch('/css/style.css', matcher);
  assert.doesNotMatch('/api/auth/verify', matcher);
  assert.equal(route.dest, '/public/$1.html');
});

test('special routes are evaluated before the generic clean HTML route', () => {
  const cleanIndex = vercel.routes.findIndex(item => item.src === '^/((?:[^./]+/)*[^./]+)/?$');
  const connectIndex = vercel.routes.findIndex(item => item.src === '^/client/connect/?$');
  const apiIndex = vercel.routes.findIndex(item => item.src === '/api/(.*)');
  const oauthIndex = vercel.routes.findIndex(item => item.dest === '/public/oauth-callback.html');
  assert.ok(apiIndex >= 0 && apiIndex < cleanIndex);
  assert.ok(oauthIndex >= 0 && oauthIndex < cleanIndex);
  assert.ok(connectIndex >= 0 && connectIndex < cleanIndex);
});

test('Supabase OAuth callback supports PKCE code exchange and provider errors', () => {
  const callback = fs.readFileSync(path.join(root, 'public/oauth-callback.html'), 'utf8');
  assert.match(callback, /exchangeCodeForSession\(authorizationCode\)/);
  assert.match(callback, /url\.searchParams\.get\('error_description'\)/);
});

test('GitHub OAuth function strips the rewritten public route prefix', () => {
  const github = fs.readFileSync(path.join(root, 'api/auth-github.js'), 'utf8');
  assert.match(github, /Strip the public/);
  assert.match(github, /timingSafeEqual\(suppliedState,expectedState\)/);
});
