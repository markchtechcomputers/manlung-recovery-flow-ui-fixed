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

test('nested admin HTML pages have explicit clean and .html routes', () => {
  const pages = [
    '/admin/dashboard',
    '/admin/tools',
    '/admin/tools/link-analysis',
    '/admin/tools/recovery-evidence',
    '/admin/tools/website-scanner',
    '/admin/owner',
    '/admin/reports'
  ];
  for (const page of pages) {
    const clean = vercel.routes.find(item => item.src === '^' + page + '/?$');
    const html = vercel.routes.find(item => item.src === '^' + page + '\\.html$');
    assert.ok(clean, 'clean admin route exists for ' + page);
    assert.ok(html, '.html admin route exists for ' + page);
    assert.equal(clean.dest, '/public' + page + '.html');
    assert.equal(html.dest, clean.dest);
  }
});



test('Vercel clean URL rewrites serve login, settings, and client portal pages', () => {
  const rewrites = vercel.rewrites || [];
  const expected = [
    ['/login', '/public/login'],
    ['/settings', '/public/settings'],
    ['/client/dashboard', '/public/client/dashboard'],
    ['/client/track', '/public/client/track'],
    ['/client/settings', '/public/client/settings'],
    ['/client/recovery-center', '/public/client/recovery-center'],
    ['/client/request', '/public/client/request']
  ];
  for (const [source, destination] of expected) {
    assert.ok(rewrites.some(item => item.source === source && item.destination === destination),
      'rewrite maps ' + source + ' to ' + destination);
  }
});

test('Vercel rewrites explicitly serve all admin pages and canonical verification links', () => {
  const rewrites = vercel.rewrites || [];
  const pages = [
    'connect', 'control-center', 'dashboard', 'index', 'investigation-notes',
    'login', 'music-player', 'music', 'operations', 'owner', 'register',
    'reset-password', 'reports', 'tools', 'tools/device-recovery',
    'tools/link-analysis', 'tools/recovery-evidence', 'tools/remote-desktop',
    'tools/security', 'tools/website-scanner'
  ];
  for (const page of pages) {
    const route = rewrites.find(item => item.source === '/admin/' + page);
    assert.ok(route, 'rewrite exists for /admin/' + page);
    assert.equal(route.destination, '/public/admin/' + page);
  }
  assert.ok(rewrites.some(item => item.source === '/verification/:token' && item.destination === '/public/selfie?id=:token'));
  assert.ok(rewrites.some(item => item.source === '/oauth-callback' && item.destination === '/public/oauth-callback'));
  assert.ok(rewrites.some(item => item.source === '/' && item.destination === '/public/index'));
});

test('Link Analysis generators create deployment-relative canonical verification links', () => {
  const tools = fs.readFileSync(path.join(root, 'public/admin/tools.html'), 'utf8');
  const standalone = fs.readFileSync(path.join(root, 'public/admin/tools/link-analysis.html'), 'utf8');
  const canonical = "new URL('/verification/'+encodeURIComponent(d.request.token),window.location.origin).href";
  assert.ok(tools.includes(canonical));
  assert.ok(standalone.includes(canonical));
  assert.ok(!tools.includes('https://manlungrecovery.manlungshop.co.ke/verification/'));
  assert.ok(!standalone.includes('selfie.html?id='));
});

test('verification token route resolves to the public selfie page before static fallback', () => {
  const index = vercel.routes.findIndex(item => item.src === '^/verification/([^/]+)/?$');
  const fallback = vercel.routes.findIndex(item => item.src === '/(.*)');
  assert.ok(index >= 0 && index < fallback);
  assert.equal(vercel.routes[index].dest, '/public/selfie.html?id=$1');
  assert.ok(fs.existsSync(path.join(root, 'public/selfie.html')));
  assert.equal(vercel.redirects, undefined);
});
