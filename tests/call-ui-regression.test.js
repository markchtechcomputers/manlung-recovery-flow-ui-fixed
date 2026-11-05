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
const callModule = source.slice(start, source.lastIndexOf('})();'));

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

test('incoming answer replays the caller offer after pre-answer polling', () => {
  assert.match(callModule, /await setup\(rtc\.mode\);rtc\.last=0;await signal\('accept'\)/,
    'answer must reset the signal cursor so an offer seen before Answer is processed again');
  assert.match(callModule, /el\.querySelector\('#ml-peer-answer'\)\.onclick=acceptIncoming/,
    'receive button must invoke the incoming-call accept flow');
  assert.match(callModule, /el\.querySelector\('#ml-peer-reject'\)\.onclick=\(\)=>endCall\(true,'reject'\)/,
    'decline button must terminate the incoming call');
});

test('incoming polling does not create a second call UI while one is active', () => {
  assert.match(callModule, /if\(!window\.__mlMe\|\|rtc\.callId\|\|document\.querySelector\('#ml-peer-call'\)\)return/,
    'incoming polling must be idempotent while a call dialog is open');
});

test('global call buttons use the peer-call engine instead of a no-op placeholder', () => {
  assert.match(source, /window\.call=function\(name,video,memberId\)\{startPeerCall\(name,!!video,memberId\)\}/,
    'global call target must start the real peer call');
  assert.doesNotMatch(source, /Voice and video calling are not connected yet/,
    'old disabled call placeholder must not remain in the shipped page');
});

test('peer calls retry a dropped ICE connection with a fresh offer', () => {
  assert.match(callModule, /function schedulePeerIceRestart\(reason\)/);
  assert.match(callModule, /createOffer\(\{iceRestart:true\}\)/);
  assert.match(callModule, /rtc\.direction==='incoming'/,
    'callee must accept renegotiation offers after the initial answer');
  assert.match(callModule, /rtc\.reconnectAttempts>=3/,
    'reconnection attempts must be bounded');
  assert.match(callModule, /clearTimeout\(rtc\.reconnectTimer\)/,
    'call teardown must clear the reconnection timer');
});
