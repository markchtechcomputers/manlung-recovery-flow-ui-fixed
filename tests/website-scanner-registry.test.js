const test = require('node:test');
const assert = require('node:assert/strict');
const officialWebsites = require('../config/official-websites');

test('website scanner registry contains Manlung Recovery', () => {
  const entry = officialWebsites.find(site => site.hostname === 'manlungrecovery.manlungshop.co.ke');
  assert.ok(entry);
  assert.equal(entry.name, 'Manlung Recovery');
});

test('website scanner registry contains KRA official root domain', () => {
  const entry = officialWebsites.find(site => site.hostname === 'kra.go.ke');
  assert.ok(entry);
  assert.match(entry.url, /^https:\/\/kra\.go\.ke\/?$/);
  assert.ok(entry.aliases.includes('kra'));
});

test('website scanner registry contains eCitizen official root domain', () => {
  const entry = officialWebsites.find(site => site.hostname === 'ecitizen.go.ke');
  assert.ok(entry);
  assert.match(entry.url, /^https:\/\/ecitizen\.go\.ke\/?$/);
});
