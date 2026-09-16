const { supabase } = require('../config/supabase');
const crypto = require('crypto');

const hash = token => crypto.createHash('sha256').update(token).digest('hex');

async function create({ email, invitedBy, ttlHours = 48 }) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();
  const { data, error } = await supabase.from('admin_invitations').insert({ email: email.toLowerCase(), invited_by: invitedBy, token_hash: hash(token), expires_at: expiresAt }).select().single();
  if (error) throw error;
  return { ...data, token };
}

async function findValid(token) {
  const { data, error } = await supabase.from('admin_invitations').select('*').eq('token_hash', hash(token)).eq('status','pending').gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return data;
}

async function accept(id) {
  const { data, error } = await supabase.from('admin_invitations').update({ status:'accepted', accepted_at:new Date().toISOString() }).eq('id', id).eq('status','pending').select().maybeSingle();
  if (error) throw error;
  return data;
}

async function list() {
  const { data, error } = await supabase.from('admin_invitations').select('id,email,status,expires_at,created_at,accepted_at').order('created_at',{ascending:false}).limit(100);
  if (error) throw error;
  return data || [];
}

module.exports = { create, findValid, accept, list };
