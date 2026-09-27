const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const SESSION_MINUTES = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function makeToken(prefix = 'mrd') {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

function makeEnrollmentToken() {
  return makeToken('mrd_enroll');
}

function makeDeviceToken() {
  return makeToken('mrd_device');
}

async function audit({ sessionId = null, deviceId = null, actorUserId = null, actorType, eventType, ipAddress = null, userAgent = null, details = {} }) {
  const { error } = await supabase.from('remote_audit_events').insert({
    session_id: sessionId,
    device_id: deviceId,
    actor_user_id: actorUserId,
    actor_type: actorType,
    event_type: eventType,
    ip_address: ipAddress,
    user_agent: userAgent,
    details,
  });
  if (error) throw error;
}

async function listDevices() {
  const { data, error } = await supabase.from('remote_devices')
    .select('id,owner_user_id,device_name,platform,status,capabilities,last_seen_at,revoked_at,created_at,updated_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createEnrollment({ ownerUserId, deviceName, platform, capabilities }) {
  const token = makeEnrollmentToken();
  const { data, error } = await supabase.from('remote_devices').insert({
    owner_user_id: ownerUserId || null,
    device_name: deviceName,
    platform,
    enrollment_token_hash: hashToken(token),
    status: 'offline',
    capabilities: capabilities || {},
  }).select('id,device_name,platform,status,capabilities,created_at').single();
  if (error) throw error;
  return { device: data, enrollmentToken: token };
}

async function enrollDevice({ enrollmentToken, deviceName, platform, capabilities }) {
  const tokenHash = hashToken(enrollmentToken);
  const { data: existing, error: findError } = await supabase.from('remote_devices')
    .select('id,status,device_name,platform')
    .eq('enrollment_token_hash', tokenHash)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing || existing.status === 'revoked') return null;

  const deviceToken = makeDeviceToken();
  const { data, error } = await supabase.from('remote_devices').update({
    device_name: deviceName || existing.device_name,
    platform: platform || existing.platform,
    capabilities: capabilities || {},
    status: 'online',
    last_seen_at: new Date().toISOString(),
    enrollment_token_hash: hashToken(crypto.randomBytes(48).toString('hex')),
    updated_at: new Date().toISOString(),
  }).eq('id', existing.id).select('id,device_name,platform,status,capabilities').single();
  if (error) throw error;

  const { error: tokenError } = await supabase.from('remote_devices').update({
    enrollment_token_hash: hashToken(deviceToken),
  }).eq('id', existing.id);
  if (tokenError) throw tokenError;

  return { device: data, deviceToken };
}

async function authenticateDevice(token) {
  if (!token) return null;
  const { data, error } = await supabase.from('remote_devices')
    .select('id,owner_user_id,device_name,platform,status,capabilities,last_seen_at')
    .eq('enrollment_token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status === 'revoked') return null;
  return data;
}

async function heartbeat(deviceId) {
  const { data, error } = await supabase.from('remote_devices').update({
    status: 'online',
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', deviceId).neq('status', 'revoked')
    .select('id,status,last_seen_at').maybeSingle();
  if (error) throw error;
  return data;
}

async function revokeDevice(deviceId) {
  const { data, error } = await supabase.from('remote_devices').update({
    status: 'revoked',
    revoked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', deviceId).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function createSession({ deviceId, adminUserId, requestedAudio = false }) {
  await expireSessions();
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('remote_sessions').insert({
    device_id: deviceId,
    admin_user_id: adminUserId,
    status: 'requested',
    requested_audio: Boolean(requestedAudio),
    expires_at: expiresAt,
  }).select().single();
  if (error) throw error;
  return data;
}

async function getSession(sessionId) {
  const { data, error } = await supabase.from('remote_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  return data;
}

async function listSessionsForAdmin(adminUserId) {
  await expireSessions();
  const { data, error } = await supabase.from('remote_sessions')
    .select('*,remote_devices(id,device_name,platform,status,last_seen_at)')
    .eq('admin_user_id', adminUserId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

async function pendingForDevice(deviceId) {
  await expireSessions();
  const { data, error } = await supabase.from('remote_sessions')
    .select('id,device_id,admin_user_id,status,requested_audio,expires_at,created_at')
    .eq('device_id', deviceId).eq('status', 'requested')
    .order('created_at', { ascending: true }).limit(10);
  if (error) throw error;
  return data || [];
}

async function respondToSession(sessionId, deviceId, approved, approvedAudio = false) {
  const next = approved ? 'approved' : 'rejected';
  const update = {
    status: next,
    consented_at: new Date().toISOString(),
    approved_audio: Boolean(approved && approvedAudio),
    updated_at: new Date().toISOString(),
    ...(approved ? { started_at: new Date().toISOString() } : { ended_at: new Date().toISOString(), end_reason: 'device_declined' }),
  };
  const { data, error } = await supabase.from('remote_sessions').update(update)
    .eq('id', sessionId).eq('device_id', deviceId).eq('status', 'requested')
    .select().maybeSingle();
  if (error) throw error;
  return data;
}

async function activateSession(sessionId, adminUserId) {
  const { data, error } = await supabase.from('remote_sessions').update({
    status: 'active',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId).eq('admin_user_id', adminUserId).in('status', ['approved','active'])
    .select().maybeSingle();
  if (error) throw error;
  return data;
}

async function endSession(sessionId, actorUserId, reason = 'ended') {
  const { data, error } = await supabase.from('remote_sessions').update({
    status: 'ended',
    ended_at: new Date().toISOString(),
    end_reason: reason,
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId)
    .in('status', ['requested','approved','active'])
    .select().maybeSingle();
  if (error) throw error;
  return data;
}

async function endAllForAdmin(adminUserId, reason = 'admin_logout') {
  const { data, error } = await supabase.from('remote_sessions').update({
    status: 'ended',
    ended_at: new Date().toISOString(),
    end_reason: reason,
    updated_at: new Date().toISOString(),
  }).eq('admin_user_id', adminUserId).in('status', ['requested','approved','active']).select('id');
  if (error) throw error;
  return data || [];
}

async function addSignal(sessionId, senderRole, event, payload) {
  const { data, error } = await supabase.from('remote_session_signals').insert({
    session_id: sessionId,
    sender_role: senderRole,
    event,
    payload: payload || {},
  }).select('id,session_id,sender_role,event,payload,created_at').single();
  if (error) throw error;
  return data;
}

async function listSignals(sessionId, afterId = 0) {
  const { data, error } = await supabase.from('remote_session_signals')
    .select('id,session_id,sender_role,event,payload,created_at')
    .eq('session_id', sessionId).gt('id', Number(afterId) || 0)
    .order('id', { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}

async function expireSessions() {
  const { error } = await supabase.from('remote_sessions').update({
    status: 'expired',
    ended_at: new Date().toISOString(),
    end_reason: 'session_timeout',
    updated_at: new Date().toISOString(),
  }).in('status', ['requested','approved','active']).lt('expires_at', new Date().toISOString());
  if (error) throw error;
}

module.exports = {
  SESSION_MINUTES, hashToken, listDevices, createEnrollment, enrollDevice,
  authenticateDevice, heartbeat, revokeDevice, createSession, getSession,
  listSessionsForAdmin, pendingForDevice, respondToSession, activateSession,
  endSession, endAllForAdmin, addSignal, listSignals, audit, expireSessions,
};
