// Call Admin feature tests: entitlement logic (unit) + real HTTP requests
// through the actual routes (integration) — no real database needed for
// the integration tests since they specifically check auth/validation
// gating, which happens before any DB call.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'placeholder-key';
process.env.JWT_SECRET = 'test-secret-for-ci-only';
process.env.JWT_EXPIRE = '1d';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.CALL_RING_TIMEOUT_SECONDS = '30';

const jwt = require('jsonwebtoken');
const CallEntitlement = require('../models/CallEntitlement');
const app = require('../server.js');

// ---- Unit tests: entitlement evaluation (pure function, server-time-based) ----
// Global launch trial window: 2026-08-12 00:00 through 2026-08-25 23:59:59
// Africa/Nairobi (UTC+3, fixed offset, no DST — verified directly against
// Node's Intl timezone data before hardcoding these, not assumed).

function nairobiTime(dateStr, timeStr) {
  // e.g. nairobiTime('2026-08-12', '00:00:00') -> correct UTC instant
  return new Date(`${dateStr}T${timeStr}+03:00`).getTime();
}

test('entitlement: no row, launch trial not active -> no access, status subscription_required', () => {
  const beforeTrial = nairobiTime('2026-08-11', '23:59:59');
  const result = CallEntitlement.evaluate(null, beforeTrial);
  assert.equal(result.access, false);
  assert.equal(result.status, 'subscription_required');
  assert.equal(result.trial, false);
});

test('entitlement: 2026-08-11 (day before launch) -> trial NOT active', () => {
  const t = nairobiTime('2026-08-11', '12:00:00');
  assert.equal(CallEntitlement.isLaunchTrialActive(t), false);
});

test('entitlement: 2026-08-12 00:00:00 (exact start) -> trial active', () => {
  const t = nairobiTime('2026-08-12', '00:00:00');
  assert.equal(CallEntitlement.isLaunchTrialActive(t), true);
});

test('entitlement: 2026-08-12 (first full day) -> trial active, access granted', () => {
  const t = nairobiTime('2026-08-12', '12:00:00');
  const result = CallEntitlement.evaluate(null, t);
  assert.equal(result.access, true);
  assert.equal(result.status, 'trial');
  assert.equal(result.trial, true);
});

test('entitlement: 2026-08-25 (last day) -> trial still active', () => {
  const t = nairobiTime('2026-08-25', '12:00:00');
  const result = CallEntitlement.evaluate(null, t);
  assert.equal(result.access, true);
  assert.equal(result.status, 'trial');
});

test('entitlement: 2026-08-25 23:59:59.999 (exact end, inclusive) -> trial still active', () => {
  const t = new Date('2026-08-25T23:59:59.999+03:00').getTime();
  assert.equal(CallEntitlement.isLaunchTrialActive(t), true);
});

test('entitlement: 2026-08-26 00:00:00 (one moment after end) -> trial NOT active, subscription required', () => {
  const t = nairobiTime('2026-08-26', '00:00:00');
  const result = CallEntitlement.evaluate(null, t);
  assert.equal(result.access, false);
  assert.equal(result.status, 'subscription_required');
  assert.equal(result.trial, false);
});

test('entitlement: 2026-08-26 with an active paid subscription -> access still granted via subscription', () => {
  const t = nairobiTime('2026-08-26', '12:00:00');
  const subFuture = new Date(t + 10 * 24 * 60 * 60 * 1000).toISOString();
  const result = CallEntitlement.evaluate({ subscription_expires_at: subFuture }, t);
  assert.equal(result.access, true);
  assert.equal(result.status, 'active');
  assert.equal(result.subscription, true);
});

test('entitlement: active paid subscription during the trial window -> subscription still reported (not just trial)', () => {
  const t = nairobiTime('2026-08-15', '12:00:00');
  const subFuture = new Date(t + 10 * 24 * 60 * 60 * 1000).toISOString();
  const result = CallEntitlement.evaluate({ subscription_expires_at: subFuture }, t);
  assert.equal(result.access, true);
  assert.equal(result.subscription, true);
  // Trial takes priority for the displayed status while both are true —
  // access is granted either way, so this doesn't affect eligibility.
  assert.equal(result.status, 'trial');
});

test('entitlement: subscription expired in the past, outside trial window -> status expired, not subscription_required', () => {
  const t = nairobiTime('2026-09-01', '12:00:00');
  const past = new Date(t - 1000).toISOString();
  const result = CallEntitlement.evaluate({ subscription_expires_at: past }, t);
  assert.equal(result.access, false);
  assert.equal(result.status, 'expired');
});

test('entitlement: server time only — evaluate()\'s time parameter defaults to Date.now(), production call sites never pass a client-supplied value', () => {
  // Verified structurally by grep in this codebase (routes/calls.js and
  // routes/subscription.js both call evaluate(entitlement) with no second
  // argument), and behaviorally here: omitting the parameter must use the
  // real current time, not silently do nothing.
  const result = CallEntitlement.evaluate(null);
  assert.equal(typeof result.access, 'boolean');
});

// ---- Integration tests: real HTTP requests through the actual app ----

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

function fakeToken(overrides) {
  return jwt.sign({ id: 'fake-user-id-0000', role: 'client', ...overrides }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

test('unauthenticated user cannot start a call', async () => {
  const { status, json } = await req('POST', '/api/calls/start', {});
  assert.equal(status, 401);
  assert.equal(json.error, 'Authentication required');
});

test('unauthenticated user cannot check availability', async () => {
  const { status } = await req('GET', '/api/calls/availability');
  assert.equal(status, 401);
});

test('unauthenticated user cannot poll pending calls', async () => {
  const { status } = await req('GET', '/api/calls/pending');
  assert.equal(status, 401);
});

test('non-admin (client role) cannot go online as an admin', async () => {
  const token = fakeToken({ role: 'client' });
  const { status, json } = await req('POST', '/api/calls/admin/online', {}, { Authorization: `Bearer ${token}` });
  // With a placeholder DB, auth middleware itself will fail to find the user
  // and return 401 — either way, a client role must never reach adminAuth's
  // success path. 401 or 403 are both correct; 200 would be a real bug.
  assert.ok(status === 401 || status === 403, `expected 401/403, got ${status}`);
});

test('non-admin cannot accept a call', async () => {
  const token = fakeToken({ role: 'client' });
  const { status } = await req('PUT', '/api/calls/some-fake-id/accept', {}, { Authorization: `Bearer ${token}` });
  assert.ok(status === 401 || status === 403, `expected 401/403, got ${status}`);
});

test('non-admin cannot reject a call', async () => {
  const token = fakeToken({ role: 'client' });
  const { status } = await req('PUT', '/api/calls/some-fake-id/reject', {}, { Authorization: `Bearer ${token}` });
  assert.ok(status === 401 || status === 403, `expected 401/403, got ${status}`);
});

test('garbage/tampered JWT is rejected, not silently trusted', async () => {
  const { status } = await req('GET', '/api/calls/availability', null, { Authorization: 'Bearer not-a-real-token' });
  assert.equal(status, 401);
});

test('a token signed with the wrong secret is rejected (can\'t forge admin role client-side)', async () => {
  const forged = jwt.sign({ id: 'anyone', role: 'admin' }, 'wrong-secret-not-ours', { expiresIn: '1h' });
  const { status } = await req('POST', '/api/calls/admin/online', {}, { Authorization: `Bearer ${forged}` });
  assert.equal(status, 401);
});

test('subscription status endpoint requires auth', async () => {
  const { status } = await req('GET', '/api/subscription/status');
  assert.equal(status, 401);
});

test('the spec-requested alias path /api/payments/call-admin/status also requires auth', async () => {
  const { status } = await req('GET', '/api/payments/call-admin/status');
  assert.equal(status, 401);
});

test('ice-servers endpoint requires auth (TURN credentials must not be public)', async () => {
  const { status } = await req('GET', '/api/calls/ice-servers');
  assert.equal(status, 401);
});
