const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const caseMessages = fs.readFileSync(path.join(root, 'models/CaseMessage.js'), 'utf8');
const notifications = fs.readFileSync(path.join(root, 'models/Notification.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes/messages.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'public/admin/dashboard.html'), 'utf8');
const client = fs.readFileSync(path.join(root, 'public/client/track.html'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'db/migrations/032_case_message_delivery_receipts.sql'), 'utf8');

test('case messages record delivery separately from read receipts', () => {
  assert.match(migration, /add column if not exists delivered_at timestamptz/i);
  assert.match(caseMessages, /markDeliveredForRecipient/);
  assert.match(caseMessages, /\.is\('delivered_at', null\)/);
  assert.match(caseMessages, /delivered_at,read_at/);
  assert.match(routes, /CaseMessage\.markDeliveredForRecipient/);
});

test('opening and reading a case message clears its matching unread notification', () => {
  assert.match(notifications, /markCaseMessagesRead/);
  assert.ok(routes.includes('CaseMessage.markDeliveredForRecipient(updated.case_id, req.user.id)'));
  assert.match(notifications, /\.eq\('type', 'new_message'\)/);
  assert.match(routes, /Notification\.markCaseMessagesRead\(updated\.case_id, req\.user\.id\)/);
});

test('admin and client chat display sent, delivered and read tick states', () => {
  for (const source of [admin, client]) {
    assert.match(source, /m\.read_at \? 'read' : \(m\.delivered_at \? 'delivered' : 'sent'\)/);
    assert.match(source, /receiptTicks/);
    assert.match(source, /'✓' : '✓✓'/);
    assert.match(source, /\/api\/messages\//);
  }
});

test('both chat screens mark incoming messages read after displaying them', () => {
  assert.match(admin, /unreadIncoming = messages\.filter/);
  assert.match(client, /unreadIncoming = messages\.filter/);
  assert.match(admin, /method: 'POST'/);
  assert.match(client, /method: 'POST'/);
});
