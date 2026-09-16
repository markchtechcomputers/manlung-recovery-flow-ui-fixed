const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Fill them in .env — ' +
    'the service_role key is in your Supabase dashboard under Settings > API > ' +
    'service_role (secret). Never put it in front-end code or share it in chat.'
  );
}

// Supabase's client requires a bare origin (no trailing slash, no path like
// /rest/v1). It's an easy copy-paste mistake to grab a URL with extra bits
// attached, and that produces a cryptic "Invalid path specified in request
// URL" error on every single API call. Normalize defensively so a stray
// trailing slash or accidental path suffix can't take down the whole app.
function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const trimmed = rawUrl.trim().replace(/\/+$/, '');
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (e) {
    console.error('⚠️  SUPABASE_URL does not look like a valid URL:', rawUrl);
    return rawUrl; // let supabase-js throw its own clear error rather than silently swallow this
  }
}

const supabase = createClient(
  normalizeSupabaseUrl(process.env.SUPABASE_URL),
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const EVIDENCE_BUCKET = 'recovery-evidence';

module.exports = { supabase, EVIDENCE_BUCKET, normalizeSupabaseUrl };
