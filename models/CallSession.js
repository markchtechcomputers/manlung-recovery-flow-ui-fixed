const { supabase } = require('../config/supabase');
const AdminPresence = require('./AdminPresence');

const TABLE = 'recovery_call_sessions';
const RING_TIMEOUT_SECONDS = Number.parseInt(process.env.CALL_RING_TIMEOUT_SECONDS, 10) || 30;
const QUEUE_TIMEOUT_SECONDS = Number.parseInt(process.env.CALL_QUEUE_TIMEOUT_SECONDS, 10) || 3600;
const ACTIVE_CALL_TIMEOUT_SECONDS = Number.parseInt(process.env.CALL_ACTIVE_TIMEOUT_SECONDS, 10) || 21600; // 6h safety valve

async function create({ clientUserId, clientName, clientEmail, caseId, status = 'ringing' }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from(TABLE).insert({
    client_user_id: clientUserId,
    client_name: clientName,
    client_email: clientEmail,
    case_id: caseId || null,
    status: ['ringing', 'queued'].includes(status) ? status : 'ringing',
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
  const presenceCutoff = new Date(Date.now() - AdminPresence.STALE_MS).toISOString();

  const [{ data, error }, { data: presence, error: presenceError }] = await Promise.all([
    supabase
      .from(TABLE)
      .select('id, accepted_at, ended_at')
      .eq('admin_user_id', adminUserId)
      .eq('status', 'accepted')
      .is('ended_at', null)
      .order('accepted_at', { ascending: false })
      .limit(10),
    supabase
      .from('recovery_admin_presence')
      .select('admin_user_id, is_online, last_seen')
      .eq('admin_user_id', adminUserId)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (presenceError) throw presenceError;

  const now = new Date().toISOString();
  const staleByAge = (data || []).filter((row) =>
    row.accepted_at && row.accepted_at < cutoff
  );

  // If the admin browser has disappeared and its heartbeat is stale/offline,
  // an accepted call left behind by a closed/crashed tab is no longer a real
  // active call. Release it automatically instead of blocking all callbacks.
  const presenceIsStale =
    !presence ||
    !presence.is_online ||
    !presence.last_seen ||
    presence.last_seen < presenceCutoff;

  const orphaned = presenceIsStale
    ? (data || []).filter((row) => !staleByAge.includes(row))
    : [];

  const staleIds = [...staleByAge, ...orphaned].map((row) => row.id);
  if (staleIds.length) {
    const { error: cleanupError } = await supabase
      .from(TABLE)
      .update({
        status: 'ended',
        ended_at: now,
        end_reason: staleByAge.length ? 'stale_active_call_cleanup' : 'admin_presence_lost_cleanup',
      })
      .in('id', staleIds)
      .eq('status', 'accepted')
      .is('ended_at', null);
    if (cleanupError) throw cleanupError;

    await AdminPresence.setBusy(adminUserId, false);
  }

  return (data || []).some((row) => !staleIds.includes(row.id));
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
    .in('status', ['ringing', 'queued'])
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
  if (!session || !['ringing', 'queued'].includes(session.status)) return session;
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
  }).in('status', ['ringing', 'queued']).is('admin_user_id', null).lt('ringing_started_at', queueCutoff);
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

async function getWaitingQueue() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, client_name, client_email, case_id, status, created_at, ringing_started_at')
    .in('status', ['ringing', 'queued'])
    .is('admin_user_id', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data || [];
}

async function promoteNextWaiting() {
  const queue = await getWaitingQueue();
  const next = queue[0];
  if (!next) return null;
  // Keep the caller waiting. Promotion only changes the display state from
  // queued to ringing; it never changes or closes any other waiting session.
  if (next.status === 'queued') {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: 'ringing', ringing_started_at: new Date().toISOString() })
      .eq('id', next.id)
      .eq('status', 'queued')
      .is('admin_user_id', null)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data || next;
  }
  return next;
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
  getWaitingQueue,
  promoteNextWaiting,
};
