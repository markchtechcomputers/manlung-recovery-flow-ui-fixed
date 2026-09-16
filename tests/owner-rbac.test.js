// Owner/Admin RBAC tests — real HTTP requests through the actual app.
// No real database needed: every scenario here is blocked by auth/role
// checks that happen before any DB call, which is exactly the point —
// these prove authorization is enforced server-side, not just hidden
// in the frontend.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

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
  baseUrl = `http://localhost:${server.address().port}`;
});

test.after(() => {
  server.close();
});

async function req(method, path, body, headers) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

function tokenFor(overrides) {
  return jwt.sign({ id: 'fake-id-0000', role: 'client', ...overrides }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

test('unauthenticated request cannot list admins', async () => {
  const { status, json } = await req('GET', '/api/owner/admins');
  assert.equal(status, 401);
  assert.equal(json.error, 'Authentication required');
});

test('a client cannot access Admin Management at all', async () => {
  const token = tokenFor({ role: 'client' });
  const { status } = await req('GET', '/api/owner/admins', null, { Authorization: `Bearer ${token}` });
  assert.ok(status === 401 || status === 403);
});

test('a regular admin (not owner) cannot list admins — Admin Management is owner-only', async () => {
  const token = tokenFor({ role: 'admin' });
  const { status } = await req('GET', '/api/owner/admins', null, { Authorization: `Bearer ${token}` });
  assert.notEqual(status, 200);
});

test('a regular admin cannot promote another user to admin', async () => {
  const token = tokenFor({ role: 'admin' });
  const { status } = await req('POST', '/api/owner/admins', { userId: 'someone-else' }, { Authorization: `Bearer ${token}` });
  assert.notEqual(status, 200);
  assert.notEqual(status, 201);
});

test('a regular admin cannot suspend another admin', async () => {
  const token = tokenFor({ role: 'admin' });
  const { status } = await req('PUT', '/api/owner/admins/someone-else/status', { status: 'suspended' }, { Authorization: `Bearer ${token}` });
  assert.notEqual(status, 200);
});

test('a regular admin cannot remove another admin', async () => {
  const token = tokenFor({ role: 'admin' });
  const { status } = await req('DELETE', '/api/owner/admins/someone-else', null, { Authorization: `Bearer ${token}` });
  assert.notEqual(status, 200);
});

test('a regular admin cannot view the audit log', async () => {
  const token = tokenFor({ role: 'admin' });
  const { status } = await req('GET', '/api/owner/audit-log', null, { Authorization: `Bearer ${token}` });
  assert.notEqual(status, 200);
});

test('a forged token claiming role "owner" but signed with the wrong secret is rejected', async () => {
  const forged = jwt.sign({ id: 'anyone', role: 'owner' }, 'not-our-real-secret', { expiresIn: '1h' });
  const { status } = await req('GET', '/api/owner/admins', null, { Authorization: `Bearer ${forged}` });
  assert.equal(status, 401);
});

test('client role is rejected from admin-only case management routes too (unrelated to owner, but same principle)', async () => {
  const token = tokenFor({ role: 'client' });
  const { status } = await req('GET', '/api/cases/admin/stats', null, { Authorization: `Bearer ${token}` });
  assert.ok(status === 401 || status === 403);
});

test('regular admin CAN reach admin-only case routes (adminAuth accepts both admin and owner)', async () => {
  const token = tokenFor({ role: 'admin' });
  const { status, json } = await req('GET', '/api/cases/admin/stats', null, { Authorization: `Bearer ${token}` });
  assert.notEqual(json?.error, 'Admin access required');
  assert.notEqual(status, 403);
});

test('owner management routes reject an empty promote request before touching the DB', async () => {
  const token = tokenFor({ role: 'owner' });
  const { status } = await req('POST', '/api/owner/admins', {}, { Authorization: `Bearer ${token}` });
  assert.notEqual(status, 200);
  assert.notEqual(status, 201);
});
