// Integration tests — spin up the real app and make real HTTP requests
// through it, the same way a browser would. Uses a fake Supabase URL, so
// these specifically test things that don't require a real database:
// routing, auth gating, input validation, and the honeypot.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'placeholder-key';
process.env.JWT_SECRET = 'test-secret-for-ci-only';
process.env.JWT_EXPIRE = '1d';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test-password';

const app = require('../server.js');

let server;
let baseUrl;

test.before(() => {
  server = http.createServer(app);
  server.listen(0);
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

test.after(() => {
  server.close();
});

async function req(method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* not JSON, fine for HTML pages */ }
  return { status: res.status, json };
}

test('GET / serves the homepage', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /Manlung Tech City/);
});

test('GET /admin/dashboard.html serves without crashing (static route)', async () => {
  const res = await fetch(`${baseUrl}/admin/dashboard.html`);
  assert.equal(res.status, 200);
});

test('security headers are present but inline scripts are NOT blocked (CSP off)', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('content-security-policy'), null); // must stay off — see server.js comment
});

test('protected routes reject requests with no auth token', async () => {
  const { status, json } = await req('GET', '/api/cases/admin/stats');
  assert.equal(status, 401);
  assert.equal(json.error, 'Authentication required');
});

test('protected routes reject requests with a garbage token', async () => {
  const res = await fetch(`${baseUrl}/api/cases/admin/stats`, {
    headers: { Authorization: 'Bearer not-a-real-token' },
  });
  assert.equal(res.status, 401);
});

test('admin login rejects missing username/password with a clear validation error (not a crash)', async () => {
  const { status, json } = await req('POST', '/api/auth/admin/login', {});
  assert.equal(status, 400);
  assert.match(json.error, /required/i);
});

test('client register rejects an invalid email', async () => {
  const { status, json } = await req('POST', '/api/auth/client/register', {
    email: 'not-an-email',
    password: 'somepassword123',
  });
  assert.equal(status, 400);
  assert.match(json.error, /valid email/i);
});

test('client register rejects a too-short password', async () => {
  const { status, json } = await req('POST', '/api/auth/client/register', {
    email: 'real@example.com',
    password: '123',
  });
  assert.equal(status, 400);
  assert.match(json.error, /6 characters/i);
});

test('case submit rejects missing required fields (never fakes success)', async () => {
  const { status, json } = await req('POST', '/api/cases/submit', {});
  assert.equal(status, 400);
  assert.ok(json.error);
  assert.equal(json.success, undefined); // must never be true on a validation failure
});

test('case submit honeypot: filled hp_confirm field is rejected, not faked as success', async () => {
  const { status, json } = await req('POST', '/api/cases/submit', {
    clientName: 'Bot', phone: '000', email: 'bot@example.com',
    caseType: 'Lost Phone Recovery', incidentDesc: 'test',
    hp_confirm: 'a bot filled this in',
  });
  assert.equal(status, 400);
  assert.equal(json.success, undefined);
  // Critically: must NOT return the old fake case ID behavior
  assert.notEqual(json.case?.caseId, 'MTC-0000-000');
});

test('unknown API route returns a clean 404, not a stack trace', async () => {
  const { status, json } = await req('GET', '/api/this-route-does-not-exist');
  assert.equal(status, 404);
  assert.equal(json.error, 'Not found');
});

test('GET /api/health reports server up even when the database is unreachable', async () => {
  // With the placeholder Supabase credentials above, the DB check inside
  // /api/health should fail gracefully and report database:"error" with a
  // 503 — not crash the whole server.
  const { status, json } = await req('GET', '/api/health');
  assert.equal(json.server, 'up');
  assert.ok(status === 200 || status === 503);
});
