const { supabase } = require('../config/supabase');
const { sendEmail } = require('../services/email');

const TABLE = 'notifications';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

async function emailNotification(userId, title, message) {
  try {
    const { data: user, error } = await supabase
      .from('recovery_users')
      .select('email, username, role')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!user?.email || user.role !== 'client') return;

    const safeTitle = escapeHtml(title || 'New account update');
    const safeMessage = escapeHtml(message || 'There is a new update in your Manlung Recovery account.');
    await sendEmail({
      to: user.email,
      subject: 'Manlung Recovery: ' + String(title || 'New account update').slice(0, 180),
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033;line-height:1.6">
        <div style="padding:18px 22px;background:#102b50;color:#fff;border-radius:12px 12px 0 0">
          <strong style="font-size:18px">Manlung Recovery</strong>
        </div>
        <div style="padding:22px;border:1px solid #dbe4ef;border-top:0;border-radius:0 0 12px 12px">
          <h2 style="margin-top:0;font-size:20px">${safeTitle}</h2>
          <p>${safeMessage}</p>
          <p><a href="https://manlungrecovery.manlungshop.co.ke/client/dashboard.html" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Open your client portal</a></p>
          <p style="font-size:12px;color:#64748b">You received this message because an update was recorded in your Manlung Recovery account. Sign in to review it securely.</p>
        </div>
      </div>`,
    });
  } catch (error) {
    // Email delivery is best-effort: never lose the in-app notification if
    // the email provider is unavailable or its credentials are not configured.
    console.error('Client notification email failed:', error.message || error);
  }
}

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
  // Persist the in-app notification first. Email is best-effort and cannot
  // cause a successful case/message action to fail.
  void emailNotification(userId, title, message);
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
