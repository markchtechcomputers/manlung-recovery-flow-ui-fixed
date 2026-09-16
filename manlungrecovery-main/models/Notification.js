const { supabase } = require('../config/supabase');

const TABLE = 'notifications';

async function create({
  userId,
  caseId = null,
  type,
  title,
  message,
}) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      case_id: caseId,
      type,
      title,
      message,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function listForUser(userId, limit = 50) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function unreadCount(userId) {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count || 0;
}

async function markRead(id, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      read_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function markAllRead(userId) {
  const { error } = await supabase
    .from(TABLE)
    .update({
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

module.exports = {
  create,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
};
