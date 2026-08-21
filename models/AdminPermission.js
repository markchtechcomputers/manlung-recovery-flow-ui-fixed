const { supabase } = require('../config/supabase');

const DEFAULT_PERMISSIONS = ['HANDLE_CASES','UPDATE_CASES','VIEW_CLIENT_CONTACT','ANSWER_CALLS','UPLOAD_EVIDENCE','VIEW_CASE_HISTORY'];

async function list(userId) {
  const { data, error } = await supabase.from('admin_permissions').select('permission').eq('user_id', userId).order('permission');
  if (error) throw error;
  return (data || []).map(x => x.permission);
}

async function has(userId, permission) {
  const { data, error } = await supabase.from('admin_permissions').select('id').eq('user_id', userId).eq('permission', permission).maybeSingle();
  if (error) throw error;
  return !!data;
}

async function replace(userId, permissions, grantedBy) {
  const { error: delError } = await supabase.from('admin_permissions').delete().eq('user_id', userId);
  if (delError) throw delError;
  const rows = [...new Set(permissions)].map(permission => ({ user_id: userId, permission, granted_by: grantedBy }));
  if (rows.length) {
    const { error } = await supabase.from('admin_permissions').insert(rows);
    if (error) throw error;
  }
  return list(userId);
}

module.exports = { DEFAULT_PERMISSIONS, list, has, replace };
