const { supabase } = require('../config/supabase');
const AdminPresence = require('./AdminPresence');

const TABLE = 'recovery_call_sessions';
const RING_TIMEOUT_SECONDS = Number.parseInt(process.env.CALL_RING_TIMEOUT_SECONDS, 10) || 30;
const QUEUE_TIMEOUT_SECONDS = Number.parseInt(process.env.CALL_QUEUE_TIMEOUT_SECONDS, 10) || 600;
const ACTIVE_CALL_TIMEOUT_SECONDS = Number.parseInt(process.env.CALL_ACTIVE_TIMEOUT_SECONDS, 10) || 21600; // 6h safety valve

async function create({ clientUserId, clientName, clientEmail, caseId }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from(TABLE).insert({
    client_user_id: clientUserId,
    client_name: clientName,
    client_email: clientEmail,
    case_id: caseId || null,
    status: 'ringing',
    ringing_started_at: now,
  }).select().single();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function adminHasActiveCall(adminUserId) {
  const cutoff = new Date(Date.now() - ACTIVE_CALL_TIMEOUT_SECONDS * 1000).toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, accepted_at, ended_at')
    .eq('admin_user_id', adminUserId)
    .eq('status', 'accepted')
    .is('ended_at', null)
    .order('accepted_at', { ascending: false })
    .limit(10);
  if (error) throw error;

  const active = (data || []).filter((row) => {
    if (!row.accepted_at) return true;
    return row.accepted_at >= cutoff;
  });

  const stale = (data || []).filter((row) => {
    if (!row.accepted_at) return false;
    return row.accepted_at < cutoff;
  });

  if (stale.length) {
    await supabase.from(TABLE).update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      end_reason: 'stale_active_call_cleanup',
    }).in('id', stale.map((x) => x.id)).eq('status', 'accepted');
  }

  return active.length > 0;
}

async function accept(id, adminUserId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'accepted',
      admin_user_id: adminUserId,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'ringing')
    .is('admin_user_id', null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}


async function findActiveByAdmin(adminUserId) {
  const cutoff = new Date(Date.now() - ACTIVE_CALL_TIMEOUT_SECONDS * 1000).toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('admin_user_id', adminUserId)
    .eq('status', 'accepted')
    .is('ended_at', null)
    .gte('accepted_at', cutoff)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setStatus(id, status, endReason) {
  const fields = { status };
  if (['ended', 'rejected', 'missed', 'failed'].includes(status)) {
    fields.ended_at = new Date().toISOString();
  }
  if (endReason) fields.end_reason = endReason;
  const { data, error } = await supabase.from(TABLE).update(fields).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function expireIfRingingTooLong(session) {
  if (!session || session.status !== 'ringing') return session;
  const ringingSince = new Date(session.ringing_started_at || session.created_at).getTime();
  const timeoutSeconds = session.admin_user_id ? RING_TIMEOUT_SECONDS : QUEUE_TIMEOUT_SECONDS;
  if (Date.now() - ringingSince < timeoutSeconds * 1000) return session;
  return setStatus(session.id, 'missed', 'ring_timeout');
}

async function cleanupAbandoned() {
  const now = Date.now();
  const queueCutoff = new Date(now - QUEUE_TIMEOUT_SECONDS * 1000).toISOString();
  const ringCutoff = new Date(now - RING_TIMEOUT_SECONDS * 1000).toISOString();
  const { error: queueError } = await supabase.from(TABLE).update({
    status: 'missed',
    ended_at: new Date().toISOString(),
    end_reason: 'queue_timeout',
  }).eq('status', 'ringing').is('admin_user_id', null).lt('ringing_started_at', queueCutoff);
  if (queueError) throw queueError;
  const { data: timedOutCallbacks, error: ringError } = await supabase.from(TABLE).update({
    status: 'missed',
    ended_at: new Date().toISOString(),
    end_reason: 'ring_timeout',
  }).eq('status', 'ringing').not('admin_user_id', 'is', null).lt('ringing_started_at', ringCutoff).select('admin_user_id');
  if (ringError) throw ringError;
  for (const row of timedOutCallbacks || []) {
    if (row.admin_user_id) await AdminPresence.setBusy(row.admin_user_id, false);
  }
}

module.exports = {
  create,
  findById,
  adminHasActiveCall,
  findActiveByAdmin,
  accept,
  setStatus,
  cleanupAbandoned,
  expireIfRingingTooLong,
  RING_TIMEOUT_SECONDS,
  ACTIVE_CALL_TIMEOUT_SECONDS,
  QUEUE_TIMEOUT_SECONDS,
};
