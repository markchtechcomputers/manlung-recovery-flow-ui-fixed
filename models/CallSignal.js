const { supabase } = require('../config/supabase');

const TABLE = 'recovery_call_signals';

async function create({ sessionId, senderUserId, event, payload }) {
  const { data, error } = await supabase.from(TABLE).insert({
    session_id: sessionId,
    sender_user_id: senderUserId,
    event,
    payload: payload || {},
  }).select().single();
  if (error) throw error;
  return data;
}

async function listAfter(sessionId, afterId, participantIds) {
  let query = supabase
    .from(TABLE)
    .select('id, session_id, sender_user_id, event, payload, created_at')
    .eq('session_id', sessionId)
    .order('id', { ascending: true })
    .limit(200);

  if (Number.isFinite(Number(afterId)) && Number(afterId) > 0) query = query.gt('id', Number(afterId));
  if (participantIds?.length) query = query.in('sender_user_id', participantIds);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function clearForSession(sessionId) {
  const { error } = await supabase.from(TABLE).delete().eq('session_id', sessionId);
  if (error) throw error;
}

module.exports = { create, listAfter, clearForSession };
