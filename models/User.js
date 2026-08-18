const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

const TABLE = 'recovery_users';

async function findByUsername(username) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  return data;
}

async function findByEmailAndRole(email, role) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('email', email).eq('role', role).maybeSingle();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function findByEmail(email) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

async function create({ username, password, role = 'client', email, phone }) {
  const hashed = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ username, password: hashed, role, email, phone })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function comparePassword(user, candidatePassword) {
  return bcrypt.compare(candidatePassword, user.password);
}

async function setResetToken(email, tokenHash, expiresAt) {
  const { error } = await supabase
    .from(TABLE)
    .update({ reset_token_hash: tokenHash, reset_token_expires: expiresAt })
    .eq('email', email);
  if (error) throw error;
}

async function findByValidResetToken(tokenHash) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('reset_token_hash', tokenHash)
    .gt('reset_token_expires', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function resetPassword(id, newPassword) {
  const hashed = await bcrypt.hash(newPassword, 10);
  const { error } = await supabase
    .from(TABLE)
    .update({ password: hashed, reset_token_hash: null, reset_token_expires: null })
    .eq('id', id);
  if (error) throw error;
}

// ---- Owner / Admin management ----

// Every admin + the owner, for the Admin Management list view.
async function listAdminsAndOwner() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, username, email, phone, role, admin_status, appointed_at, appointed_by, created_at')
    .in('role', ['owner', 'admin'])
    .order('role', { ascending: true }) // 'admin' < 'owner' alphabetically -> owner last; fine, frontend sorts if needed
    .order('appointed_at', { ascending: true });
  if (error) throw error;
  return data;
}

// Registered clients not yet admins — the pool the Owner picks from to promote.
async function searchPromotableUsers(search) {
  let query = supabase.from(TABLE).select('id, username, email, role, created_at').eq('role', 'client');
  if (search) {
    const like = `%${search}%`;
    query = query.or(`username.ilike.${like},email.ilike.${like}`);
  }
  query = query.order('created_at', { ascending: false }).limit(20);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function promoteToAdmin(userId, appointedByUserId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ role: 'admin', admin_status: 'active', appointed_at: new Date().toISOString(), appointed_by: appointedByUserId })
    .eq('id', userId)
    .eq('role', 'client') // can only promote a plain client — can't "promote" an existing admin/owner through this path
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setAdminStatus(userId, status) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ admin_status: status })
    .eq('id', userId)
    .eq('role', 'admin') // never touches the owner row, even if somehow called with the owner's id
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Removing admin privileges reverts to 'client' — the account, its case
// history, call history, and everything else stays completely intact.
// Nothing is deleted here.
async function removeAdminPrivileges(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ role: 'client', admin_status: null, appointed_at: null, appointed_by: null })
    .eq('id', userId)
    .eq('role', 'admin')
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createAdminFromInvitation({ username, password, email, phone, invitationId, appointedBy }) {
  const hashed = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from(TABLE).insert({ username, password: hashed, role: 'admin', email, phone, admin_status: 'pending', appointed_at: new Date().toISOString(), appointed_by: appointedBy }).select().single();
  if (error) throw error;
  return data;
}

module.exports = {
  findByUsername, findByEmailAndRole, findById, findByEmail, create, comparePassword,
  setResetToken, findByValidResetToken, resetPassword, createAdminFromInvitation,
  listAdminsAndOwner, searchPromotableUsers, promoteToAdmin, setAdminStatus, removeAdminPrivileges,
};
