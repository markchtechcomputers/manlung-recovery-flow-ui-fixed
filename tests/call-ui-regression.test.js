const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public/client/connect.html'), 'utf8');
const start = source.indexOf('function callUI(');
const end = source.indexOf('async function setup(', start);
assert.notEqual(start, -1, 'callUI() must exist');
assert.notEqual(end, -1, 'setup() must follow callUI()');
const callUI = source.slice(start, end);

test('audio-only call UI does not dereference the absent camera button', () => {
  assert.match(callUI, /\(mode==='video'\?'<button id="ml-peer-camera"/,
    'camera control should only be rendered for video calls');
  assert.match(callUI, /const camera=el\.querySelector\('#ml-peer-camera'\);\s*if\(camera\)\{/,
    'camera event binding must be guarded when the optional control is absent');
  assert.doesNotMatch(callUI, /camera\.disabled\s*=/,
    'callUI must not write disabled on the optional camera element');
});

test('core call controls are bound from the newly created call dialog', () => {
  assert.match(callUI, /el\.querySelector\('#ml-peer-end'\)\.onclick/,
    'end-call handler should be attached to the rendered dialog');
  assert.match(callUI, /const mute=el\.querySelector\('#ml-peer-mute'\);mute\.onclick/,
    'mute handler should be attached to the rendered dialog');
});
