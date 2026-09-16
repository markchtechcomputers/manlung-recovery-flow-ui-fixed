const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

const TABLE = 'recovery_users';
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_FAILURES = 3;
const LOCKOUT_YEARS = 132;

function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

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
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ username, password: hashed, role, email, phone, failed_login_attempts: 0, login_locked_until: null, session_version: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function comparePassword(user, candidatePassword) {
  if (!user || !user.password) return false;

  const lockedUntil = user.login_locked_until ? new Date(user.login_locked_until).getTime() : 0;
  if (lockedUntil && lockedUntil > Date.now()) return false;

  const isMatch = await bcrypt.compare(candidatePassword, user.password);

  if (isMatch) {
    await supabase
      .from(TABLE)
      .update({ failed_login_attempts: 0, login_locked_until: null, last_login_at: new Date().toISOString() })
      .eq('id', user.id);
    return true;
  }

  const failures = Number(user.failed_login_attempts || 0) + 1;
  const locked = failures >= MAX_LOGIN_FAILURES;
  await supabase
    .from(TABLE)
    .update({
      failed_login_attempts: locked ? MAX_LOGIN_FAILURES : failures,
      login_locked_until: locked ? addYears(new Date(), LOCKOUT_YEARS).toISOString() : null,
    })
    .eq('id', user.id);

  return false;
}

async function bumpSessionVersion(userId) {
  const current = await findById(userId);
  if (!current) return null;
  const next = Number(current.session_version || 0) + 1;
  const { data, error } = await supabase
    .from(TABLE)
    .update({ session_version: next })
    .eq('id', userId)
    .select('id, session_version')
    .maybeSingle();
  if (error) throw error;
  return data;
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
  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const { error } = await supabase
    .from(TABLE)
    .update({ password: hashed, reset_token_hash: null, reset_token_expires: null, failed_login_attempts: 0, login_locked_until: null, session_version: (await findById(id))?.session_version + 1 || 1 })
    .eq('id', id);
  if (error) throw error;
}

async function updateProfile(userId, { username, phone }) {
  const fields = {
    username: String(username || '').trim(),
    phone: String(phone || '').trim() || null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .update(fields)
    .eq('id', userId)
    .eq('role', 'client')
    .select('id, username, email, phone, role, created_at')
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function updatePassword(userId, newPassword) {
  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const current = await findById(userId);
  const nextVersion = Number(current?.session_version || 0) + 1;

  const { error } = await supabase
    .from(TABLE)
    .update({
      password: hashed,
      reset_token_hash: null,
      reset_token_expires: null,
      failed_login_attempts: 0,
      login_locked_until: null,
      session_version: nextVersion,
    })
    .eq('id', userId)
    .eq('role', 'client');

  if (error) throw error;
}

async function deleteById(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', userId)
    .eq('role', 'client')
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ---- Owner / Admin management ----
async function listAdminsAndOwner() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, username, email, phone, role, admin_status, appointed_at, appointed_by, created_at, failed_login_attempts, login_locked_until, last_login_at, mfa_enabled, session_version')
    .in('role', ['owner', 'admin'])
    .order('role', { ascending: true })
    .order('appointed_at', { ascending: true });
  if (error) throw error;
  return data;
}

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

async function convertClientToPendingAdmin(userId, { username, password, phone, appointedBy }) {
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const fields = {
    username: String(username || '').trim(),
    password: hashed,
    phone: String(phone || '').trim() || null,
    role: 'admin',
    admin_status: 'pending',
    appointed_at: new Date().toISOString(),
    appointed_by: appointedBy || null,
    failed_login_attempts: 0,
    login_locked_until: null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .update(fields)
    .eq('id', userId)
    .eq('role', 'client')
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function promoteToAdmin(userId, appointedByUserId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ role: 'admin', admin_status: 'active', appointed_at: new Date().toISOString(), appointed_by: appointedByUserId })
    .eq('id', userId)
    .eq('role', 'client')
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
    .eq('role', 'admin')
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

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
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { data, error } = await supabase.from(TABLE).insert({ username, password: hashed, role: 'admin', email, phone, admin_status: 'pending', appointed_at: new Date().toISOString(), appointed_by: appointedBy, failed_login_attempts: 0, login_locked_until: null, session_version: 0 }).select().single();
  if (error) throw error;
  return data;
}

async function setMfaSetup(userId, encryptedSecret) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ mfa_secret: encryptedSecret, mfa_enabled: false, mfa_recovery_code_hashes: [] })
    .eq('id', userId)
    .in('role', ['admin', 'owner'])
    .select('id, username, email, role, mfa_enabled')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function enableMfa(userId, recoveryCodeHashes) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ mfa_enabled: true, mfa_recovery_code_hashes: recoveryCodeHashes })
    .eq('id', userId)
    .in('role', ['admin', 'owner'])
    .select('id, username, email, role, mfa_enabled')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function disableMfa(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ mfa_enabled: false, mfa_secret: null, mfa_recovery_code_hashes: [] })
    .eq('id', userId)
    .in('role', ['admin', 'owner'])
    .select('id, username, email, role, mfa_enabled')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function consumeRecoveryCode(userId, remainingHashes) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ mfa_recovery_code_hashes: remainingHashes })
    .eq('id', userId)
    .in('role', ['admin', 'owner'])
    .select('id, mfa_enabled')
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  findByUsername, findByEmailAndRole, findById, findByEmail, create, comparePassword, bumpSessionVersion,
  setResetToken, findByValidResetToken, resetPassword, updateProfile, updatePassword, deleteById, createAdminFromInvitation,
  listAdminsAndOwner, searchPromotableUsers, promoteToAdmin, convertClientToPendingAdmin, setAdminStatus, removeAdminPrivileges,
  setMfaSetup, enableMfa, disableMfa, consumeRecoveryCode,
};
