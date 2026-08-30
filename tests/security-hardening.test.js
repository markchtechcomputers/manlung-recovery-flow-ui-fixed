const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inputSecurity } = require('../middleware/inputSecurity');

function runInput(value, source = 'body') {
  const req = { body: source === 'body' ? value : {}, query: {}, params: {} };
  const result = { statusCode: 200, payload: null };

  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(payload) {
      result.payload = payload;
      return this;
    },
  };

  let nextCalled = false;
  inputSecurity(req, res, () => {
    nextCalled = true;
  });

  return { ...result, nextCalled };
}

test('input security rejects prototype-pollution property names', () => {
  const result = runInput({ profile: { __proto__: { polluted: true } } });
  // Object literal __proto__ changes the prototype rather than creating an
  // enumerable key, so test a JSON-shaped object instead.
  const jsonObject = JSON.parse('{"__proto__":{"polluted":true}}');
  const parsed = runInput(jsonObject);

  assert.equal(result.nextCalled, true);
  assert.equal(parsed.statusCode, 400);
  assert.equal(parsed.nextCalled, false);
});

test('input security rejects unsafe URL schemes and traversal', () => {
  const urlResult = runInput({ callbackUrl: 'javascript:alert(1)' });
  const pathResult = runInput({ filePath: '../../secret.txt' });
  const htmlResult = runInput({ message: '<img src=x onerror=alert(1)>' });

  assert.equal(urlResult.statusCode, 400);
  assert.equal(pathResult.statusCode, 400);
  assert.equal(htmlResult.statusCode, 400);
});

test('input security rejects excessively deep JSON', () => {
  let value = 'leaf';
  for (let i = 0; i < 25; i += 1) value = { nested: value };

  const result = runInput(value);
  assert.equal(result.statusCode, 400);
  assert.equal(result.nextCalled, false);
});

test('scanner uses certificate verification for HTTPS requests', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /rejectUnauthorized:\s*parsed\.protocol === 'https:'/);
  assert.doesNotMatch(server, /rejectUnauthorized:\s*parsed\.protocol === 'https:'\s*\?\s*false/);
});

test('evidence upload policy is limited to PDF, JPEG and PNG', () => {
  const cases = fs.readFileSync(path.join(__dirname, '..', 'routes', 'cases.js'), 'utf8');

  assert.match(cases, /application\/pdf/);
  assert.match(cases, /image\/jpeg/);
  assert.match(cases, /image\/png/);
  assert.doesNotMatch(cases, /application\/zip/);
  assert.doesNotMatch(cases, /image\/webp/);
  assert.doesNotMatch(cases, /text\/plain/);
});

test('evidence storage hardening migration enables RLS and private storage', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'db', 'migrations', '012_security_lockdown.sql'),
    'utf8'
  );

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /set public = false/i);
  assert.match(migration, /revoke execute on function public\.claim_recovery_case/i);
  assert.match(migration, /revoke execute on function public\.complete_recovery_case/i);
});

test('career application writes the schema field used by the migration', () => {
  const careers = fs.readFileSync(path.join(__dirname, '..', 'routes', 'careers.js'), 'utf8');
  assert.match(careers, /cover_note:\s*req\.body\.coverNote/);
});
