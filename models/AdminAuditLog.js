const { supabase } = require('../config/supabase');

const TABLE = 'recovery_admin_audit_log';

async function record({ actor, target, action, details }) {
  const { error } = await supabase.from(TABLE).insert({
    actor_user_id: actor.id,
    actor_username: actor.username,
    target_user_id: target.id,
    target_username: target.username,
    action,
    details: details || {},
  });
  if (error) {
    if (error.code === '23514') {
      console.warn('Admin audit log constraint rejected action; primary operation will continue:', action);
      return { recorded: false, error };
    }
    throw error;
  }
}

async function list(limit = 100) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

module.exports = { record, list };
