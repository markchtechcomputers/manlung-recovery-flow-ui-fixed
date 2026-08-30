const { supabase } = require('../config/supabase');

const TABLE = 'case_messages';

async function create({
  caseId,
  senderUserId,
  recipientUserId,
  message,
}) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      case_id: caseId,
      sender_user_id: senderUserId,
      recipient_user_id: recipientUserId,
      message,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function listForCase(caseId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function markRead(id, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      read_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('recipient_user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function unreadCount(userId, caseId = null) {
  let query = supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .is('read_at', null);

  if (caseId) {
    query = query.eq('case_id', caseId);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count || 0;
}

module.exports = {
  create,
  listForCase,
  markRead,
  unreadCount,
};
