const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('legacy admin index routes go directly to the canonical dashboard', () => {
  const config = JSON.parse(read('vercel.json'));
  for (const source of ['^/admin/index/?$', '^/admin/index\\\\.html$']) {
    const route = config.routes.find(item => item.src === source);
    assert.ok(route, source + ' route exists');
    assert.equal(route.status, 308);
    assert.equal(route.headers.Location, '/admin/dashboard');
    assert.equal(route.dest, undefined);
  }
});

test('PWA controller handover never forces an automatic dashboard reload', () => {
  const pwa = read('public/js/pwa.js');
  const start = pwa.indexOf("navigator.serviceWorker.addEventListener('controllerchange'");
  assert.notEqual(start, -1);
  const block = pwa.slice(start, pwa.indexOf("window.addEventListener('load'", start));
  assert.match(block, /offerPwaRefresh\(\)/);
  assert.doesNotMatch(block, /window\.location\.reload\(\)/);
});

test('client case intake enforces Vercel-safe combined evidence size and preserves retry state', () => {
  const form = read('public/client/request.html');
  assert.match(form, /MAX_CASE_EVIDENCE_BYTES\s*=\s*4\s*\*\s*1024\s*\*\s*1024/);
  assert.match(form, /totalFileBytes\s*>\s*MAX_CASE_EVIDENCE_BYTES/);
  assert.match(form, /xhr\.ontimeout/);
  assert.match(form, /caseTurnstilePassed\s*=\s*false/);
  assert.match(form, /your form and selected files are preserved/i);
});

test('case API rejects evidence batches above the safe payload budget and rolls back orphan uploads', () => {
  const api = read('routes/cases.js');
  assert.match(api, /evidenceBytes\s*>\s*4\s*\*\s*1024\s*\*\s*1024/);
  assert.match(api, /case submission evidence rollback failed/i);
  assert.match(api, /\.remove\(paths\)/);
});
