const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { auth } = require('../middleware/auth');

router.use(auth);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeMember(row) {
  const name = String(row.username || 'Member').trim().slice(0, 80) || 'Member';
  const last = row.last_login_at ? new Date(row.last_login_at).getTime() : 0;
  return {
    id: row.id,
    name,
    role: row.role,
    avatar: name.charAt(0).toUpperCase(),
    // This is based on last successful sign-in, not a live presence heartbeat.
    recentlySignedIn: Boolean(last && Date.now() - last < 5 * 60 * 1000),
    lastSeen: last ? row.last_login_at : null,
  };
}

router.get('/members', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recovery_users')
      .select('id, username, role, last_login_at')
      .in('role', ['client', 'admin', 'owner'])
      .order('username', { ascending: true })
      .limit(500);
    if (error) throw error;
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, members: (data || []).filter(u => u.id !== req.user.id).map(safeMember) });
  } catch (error) {
    console.error('Community member list error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Could not load community members.' });
  }
});

router.get('/messages/:memberId', async (req, res) => {
  try {
    const other = String(req.params.memberId || '');
    if (!UUID_PATTERN.test(other)) return res.status(400).json({ success: false, error: 'Invalid member ID.' });
    if (other === String(req.user.id)) return res.status(400).json({ success: false, error: 'Choose another member.' });
    const { data, error } = await supabase
      .from('recovery_community_messages')
      .select('id, sender_user_id, recipient_user_id, message, created_at')
      .or('and(sender_user_id.eq.' + req.user.id + ',recipient_user_id.eq.' + other + '),and(sender_user_id.eq.' + other + ',recipient_user_id.eq.' + req.user.id + ')')
      .order('created_at', { ascending: true })
      .limit(300);
    if (error) throw error;
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, messages: data || [] });
  } catch (error) {
    if (error?.code === '42P01' || /recovery_community_messages/.test(error?.message || '')) {
      return res.status(503).json({ success: false, error: 'Community messaging database migration is not installed yet.' });
    }
    console.error('Community message list error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Could not load this conversation.' });
  }
});

router.post('/messages/:memberId', async (req, res) => {
  try {
    const other = String(req.params.memberId || '');
    const message = String(req.body?.message || '').trim();
    if (!UUID_PATTERN.test(other)) return res.status(400).json({ success: false, error: 'Invalid member ID.' });
    if (other === String(req.user.id)) return res.status(400).json({ success: false, error: 'Choose another member.' });
    if (!message || message.length > 5000) return res.status(400).json({ success: false, error: 'Messages must be 1–5000 characters.' });
    const { data: recipient, error: recipientError } = await supabase
      .from('recovery_users').select('id, role').eq('id', other).in('role', ['client', 'admin', 'owner']).maybeSingle();
    if (recipientError) throw recipientError;
    if (!recipient) return res.status(404).json({ success: false, error: 'Member not found.' });
    const { data, error } = await supabase
      .from('recovery_community_messages')
      .insert({ sender_user_id: req.user.id, recipient_user_id: other, message })
      .select('id, sender_user_id, recipient_user_id, message, created_at')
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, message: data });
  } catch (error) {
    if (error?.code === '42P01' || /recovery_community_messages/.test(error?.message || '')) {
      return res.status(503).json({ success: false, error: 'Community messaging database migration is not installed yet.' });
    }
    console.error('Community message send error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Could not send this message.' });
  }
});

module.exports = router;
