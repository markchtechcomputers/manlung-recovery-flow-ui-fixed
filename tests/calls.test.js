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

// ---- Unit tests: paid Call Admin entitlement ----
test('entitlement: no subscription does not grant Call Admin access', () => {
  const result = CallEntitlement.evaluate(null, Date.now());
  assert.equal(result.access, false);
  assert.equal(result.status, 'expired');
  assert.equal(result.free, false);
  assert.equal(result.subscription, false);
});

test('entitlement: expired subscription does not grant Call Admin access', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const result = CallEntitlement.evaluate({ subscription_status: 'active', subscription_expires_at: past });
  assert.equal(result.access, false);
  assert.equal(result.status, 'expired');
  assert.equal(result.daysRemaining, 0);
});

test('entitlement: active paid subscription grants Call Admin access', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const result = CallEntitlement.evaluate({ subscription_status: 'active', subscription_plan: 'yearly', subscription_start_at: new Date().toISOString(), subscription_expires_at: future });
  assert.equal(result.access, true);
  assert.equal(result.status, 'active');
  assert.equal(result.subscriptionPlan, 'yearly');
  assert.ok(result.daysRemaining >= 1);
});

test('subscription plans use the requested KES prices', () => {
  const plans = require('../config/call-subscription').CALL_SUBSCRIPTION_PLANS;
  assert.equal(plans.monthly.amountKes, 300);
  assert.equal(plans.six_months.amountKes, 1800);
  assert.equal(plans.yearly.normalAmountKes, 3600);
  assert.equal(plans.yearly.discountPercent, 10);
  assert.equal(plans.yearly.amountKes, 3240);
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

test('call session API returns the authenticated participant identity for WebRTC signaling', () => {
  const routes = require('fs').readFileSync(require('node:path').join(__dirname, '..', 'routes', 'calls.js'), 'utf8');
  assert.match(routes, /participant_user_id:\s*req\.user\.id/);
});

test('WebRTC client does not infer signaling identity from initiator role when server identity is available', () => {
  const fs = require('fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'call-webrtc.js'), 'utf8');
  assert.match(source, /participant_user_id/);
  assert.match(source, /offerToReceiveVideo/);
  assert.match(source, /videoEnabled/);
});

test('Admin dashboard supplies the CSRF token for cookie-authenticated mutations', () => {
  const fs = require('fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'dashboard.html'), 'utf8');
  assert.match(source, /X-CSRF-Token/);
  assert.match(source, /__Host-mlc_csrf|mlc_csrf/);
});



test('WebRTC end performs durable authenticated session cleanup', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'js', 'call-webrtc.js'), 'utf8');
  assert.match(source, /\/api\/calls.*encodeURIComponent\(this\.sessionId\).*\/end/);
  assert.match(source, /reason:\s*'peer_hangup'/);
  assert.match(source, /keepalive:\s*true/);
});

test('active-call guard repairs an admin call after presence is lost', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'models', 'CallSession.js'), 'utf8');
  assert.match(source, /recovery_admin_presence/);
  assert.match(source, /AdminPresence\.STALE_MS/);
  assert.match(source, /admin_presence_lost_cleanup/);
  assert.match(source, /status:\s*'ended'/);
});
