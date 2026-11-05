const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const analyzer = read('public/admin/tools/link-analysis.html');
const capture = read('public/selfie.html');
const cases = read('routes/cases.js');
const adminEvidence = read('public/admin/tools/recovery-evidence.html');
const clientTrack = read('public/client/track.html');

test('Link Analysis generates a case-bound four-photo recovered-evidence request', () => {
  assert.match(analyzer, /Four-Photo Recovered Evidence Link/);
  assert.match(analyzer, //api/cases/admin/selfie-requests/);
  assert.match(analyzer, /Enter the exact case ID/);
  assert.match(analyzer, /60-second window/);
});

test('recipient must consent and the server starts the 60-second window after camera readiness', () => {
  assert.match(capture, /I consent & start/);
  assert.match(capture, //start/);
  assert.match(capture, //complete/);
  assert.match(capture, /captureDeadline/);
  assert.match(cases, /router.post('/selfie-request/:token/start'/);
  assert.match(cases, /router.post('/selfie-request/:token/complete'/);
  assert.match(cases, /now-started>60000/);
});

test('server accepts exactly four images and stores them as recovered-copy evidence', () => {
  assert.match(cases, /files.length !== 4/);
  assert.match(cases, /evidenceType:'recovered-copy-verification'/);
  assert.match(cases, /source:'Link Analysis Recovered Evidence'/);
  assert.match(cases, /complete:count === 4/);
});

test('uploaded recovered evidence is linked to the client case and triggers a client notification', () => {
  assert.match(cases, /Case.update(request.case_id, { files:filesForCase, last_updated:now })/);
  assert.match(cases, /eventType:'evidence_uploaded'/);
  assert.match(cases, /userId:existing.client_user_id/);
  assert.match(cases, /type:'recovered_evidence_ready'/);
  assert.match(adminEvidence, /Recovered Copy/);
  assert.match(clientTrack, /Recovered copy · Photo/);
});

test('capture page closes only after the upload endpoint confirms success', () => {
  assert.match(capture, /if(result.success)[\s\S]*?closeAfterSubmit\(\)/);
  assert.match(capture, /window.close\(\)/);
  assert.match(capture, /location.replace\("\/"\)/);
});
