// Unit tests for pure functions — no server, no database, no network.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';

const { normalizeSupabaseUrl } = require('../config/supabase');
const caseRoutes = require('../routes/cases');
const { mapBodyToCaseFields, serializeCase } = caseRoutes;

test('normalizeSupabaseUrl: strips trailing slash', () => {
  assert.equal(
    normalizeSupabaseUrl('https://qpsiqaefsulqphsqkaau.supabase.co/'),
    'https://qpsiqaefsulqphsqkaau.supabase.co'
  );
});

test('normalizeSupabaseUrl: strips accidental /rest/v1 path', () => {
  assert.equal(
    normalizeSupabaseUrl('https://qpsiqaefsulqphsqkaau.supabase.co/rest/v1'),
    'https://qpsiqaefsulqphsqkaau.supabase.co'
  );
  assert.equal(
    normalizeSupabaseUrl('https://qpsiqaefsulqphsqkaau.supabase.co/rest/v1/'),
    'https://qpsiqaefsulqphsqkaau.supabase.co'
  );
});

test('normalizeSupabaseUrl: strips leading/trailing whitespace and newlines', () => {
  assert.equal(
    normalizeSupabaseUrl('  https://qpsiqaefsulqphsqkaau.supabase.co\n'),
    'https://qpsiqaefsulqphsqkaau.supabase.co'
  );
});

test('normalizeSupabaseUrl: leaves an already-clean URL unchanged', () => {
  assert.equal(
    normalizeSupabaseUrl('https://qpsiqaefsulqphsqkaau.supabase.co'),
    'https://qpsiqaefsulqphsqkaau.supabase.co'
  );
});

test('normalizeSupabaseUrl: passes through empty/undefined without throwing', () => {
  assert.equal(normalizeSupabaseUrl(''), '');
  assert.equal(normalizeSupabaseUrl(undefined), undefined);
});

test('mapBodyToCaseFields: maps camelCase form fields to snake_case DB columns', () => {
  const result = mapBodyToCaseFields({
    clientName: 'Jane Doe',
    email: 'jane@example.com',
    caseType: 'Lost Phone Recovery',
  });
  assert.equal(result.client_name, 'Jane Doe');
  assert.equal(result.email, 'jane@example.com');
  assert.equal(result.case_type, 'Lost Phone Recovery');
});

test('mapBodyToCaseFields: converts empty date strings to null (Postgres rejects "")', () => {
  const result = mapBodyToCaseFields({ incidentDate: '', purchaseDate: '2026-01-01' });
  assert.equal(result.incident_date, null);
  assert.equal(result.purchase_date, '2026-01-01');
});

test('mapBodyToCaseFields: converts netAuth string "true"/"false" to real booleans', () => {
  assert.equal(mapBodyToCaseFields({ netAuth: 'true' }).net_auth, true);
  assert.equal(mapBodyToCaseFields({ netAuth: 'false' }).net_auth, false);
  assert.equal(mapBodyToCaseFields({ netAuth: true }).net_auth, true);
});

test('mapBodyToCaseFields: ignores fields not in the known field map', () => {
  const result = mapBodyToCaseFields({ clientName: 'Jane', hp_confirm: 'bot-filled-this' });
  assert.equal('hp_confirm' in result, false);
});

test('serializeCase: converts snake_case DB row to camelCase for the front-end', () => {
  const dbRow = {
    case_id: 'MTC-2026-001',
    client_name: 'Jane Doe',
    case_type: 'Lost Phone Recovery',
    admin_read: false,
    created_at: '2026-01-01T00:00:00Z',
  };
  const result = serializeCase(dbRow);
  assert.equal(result.caseId, 'MTC-2026-001');
  assert.equal(result.clientName, 'Jane Doe');
  assert.equal(result.caseType, 'Lost Phone Recovery');
  assert.equal(result.adminRead, false);
  assert.equal(result.createdAt, '2026-01-01T00:00:00Z');
});

test('serializeCase: excludes internal-only fields by default (client-safe)', () => {
  const dbRow = { case_id: 'MTC-2026-001', internal_notes: 'secret admin note', admin_history: [{ by: 'admin' }] };
  const result = serializeCase(dbRow);
  assert.equal('internalNotes' in result, false);
  assert.equal('adminHistory' in result, false);
});

test('serializeCase: includes internal-only fields when explicitly requested (admin views)', () => {
  const dbRow = { case_id: 'MTC-2026-001', internal_notes: 'secret admin note', admin_history: [{ by: 'admin' }] };
  const result = serializeCase(dbRow, { includeInternal: true });
  assert.equal(result.internalNotes, 'secret admin note');
  assert.deepEqual(result.adminHistory, [{ by: 'admin' }]);
});

test('serializeCase: handles null input without throwing', () => {
  assert.equal(serializeCase(null), null);
});
