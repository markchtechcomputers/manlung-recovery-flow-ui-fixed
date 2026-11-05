const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const login = read('public/login.html');
const copyOtp = read('public/copy-otp.html');
const turnstile = read('services/turnstile.js');
const statusMigration = read('db/migrations/034_status_plan_priority.sql');
const community = read('routes/community.js');

test('Turnstile SDK remains lazy and server verification reuses TLS connections', () => {
  assert.match(login, /script\.src = 'https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit'/);
  assert.match(login, /loadClientTurnstileApi\(\)\.then/);
  assert.match(turnstile, /new https\.Agent\(\{ keepAlive: true/);
  assert.match(turnstile, /timeout: 7000/);
});

test('email OTP notification can open the inbox and clipboard paste is supported', () => {
  assert.match(login, /function notifyOtpSent\(\)/);
  assert.match(login, /notification\.onclick = \(\) =>/);
  assert.match(login, /openOtpInbox\(\)/);
  assert.match(login, /navigator\.clipboard\?\.readText/);
  assert.match(login, /function enableOtpNotifications\(\)/);
});

test('standalone OTP helper copies the code with a legacy browser fallback', () => {
  assert.match(copyOtp, /navigator\.clipboard\.writeText\(code\)/);
  assert.match(copyOtp, /document\.execCommand\('copy'\)/);
  assert.match(copyOtp, /window\.location\.hash/);
});

test('status allowance migration gives Pro priority over Plus', () => {
  assert.match(statusMigration, /order by case p\.plan_code when 'pro' then 2 when 'plus' then 1/);
  assert.match(statusMigration, /max_posts := case active_plan when 'plus' then 3 when 'pro' then 100 else 1 end/);
});

test('presence heartbeat is refreshed by authenticated community clients', () => {
  assert.match(community, /router\.post\('\/presence\/heartbeat'/);
  assert.match(community, /recovery_chat_presence'\)\.upsert/);
  assert.match(community, /last_seen_at/);
});
