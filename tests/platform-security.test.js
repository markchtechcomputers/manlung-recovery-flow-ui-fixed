const test = require('node:test');
const assert = require('node:assert/strict');
const { isDurablyRevoked } = require('../middleware/auth');

test('session version 0 is accepted when account version is 0', () => {
  assert.equal(isDurablyRevoked({ sessionVersion: 0 }, { session_version: 0 }), false);
});

test('older session version is revoked after account-wide invalidation', () => {
  assert.equal(isDurablyRevoked({ sessionVersion: 0 }, { session_version: 1 }), true);
});

test('new session version remains valid', () => {
  assert.equal(isDurablyRevoked({ sessionVersion: 4 }, { session_version: 4 }), false);
});

test('missing legacy session version is treated as version 0', () => {
  assert.equal(isDurablyRevoked({}, { session_version: 0 }), false);
  assert.equal(isDurablyRevoked({}, { session_version: 2 }), true);
});
