const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { auth } = require('../middleware/auth');

router.use(auth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYSTACK_URL = 'https://api.paystack.co';
const roles = ['client', 'admin', 'owner'];
const messageLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const statusLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

function fail(res, status, error) { return res.status(status).json({ success: false, error }); }
function cleanText(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
function validId(value) { return UUID.test(String(value || '')); }
function isAdmin(user) { return user && ['admin', 'owner'].includes(user.role); }
function publicProfile(profile, user, presence) {
  const name = cleanText(profile?.display_name, 80) || cleanText(user.username, 80) || 'Member';
  const last = presence?.last_seen_at || null;
  const isVisible = profile?.presence_visibility !== 'nobody';
  return {
    id: user.id,
    name,
    username: user.username || null,
    role: user.role,
    avatar: profile?.avatar_url || null,
    bio: profile?.bio || '',
    createdAt: user.created_at || null,
    discoverable: profile?.discoverable !== false,
    presenceVisibility: profile?.presence_visibility || 'members',
    lastSeenVisibility: profile?.last_seen_visibility || 'members',
    readReceiptsEnabled: profile?.read_receipts_enabled !== false,
    recentlyActive: Boolean(isVisible && last && Date.now() - new Date(last).getTime() < 2 * 60 * 1000),
    online: Boolean(isVisible && last && Date.now() - new Date(last).getTime() < 2 * 60 * 1000),
    online: Boolean(isVisible && last && Date.now() - new Date(last).getTime() < 2 * 60 * 1000),
    lastSeenAt: profile?.last_seen_visibility === 'nobody' ? null : last,
  };
}
async function blockedEitherWay(a, b) {
  const { data, error } = await supabase.from('recovery_chat_blocks').select('blocker_user_id,blocked_user_id')
    .or('and(blocker_user_id.eq.' + a + ',blocked_user_id.eq.' + b + '),and(blocker_user_id.eq.' + b + ',blocked_user_id.eq.' + a + ')').limit(1);
  if (error && error.code !== '42P01') throw error;
  return Boolean(data?.length);
}
async function requireGroupMember(groupId, userId) {
  const { data, error } = await supabase.from('recovery_chat_group_members').select('group_id')
    .eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
function handleDbError(res, error, context) {
  if (error?.code === '42P01' || /recovery_chat_|recovery_community_messages/.test(error?.message || '')) {
    return fail(res, 503, 'Chat database SQL has not been applied yet. Run the supplied Manlung Chat SQL in Supabase.');
  }
  console.error(context, error?.message || error);
  return fail(res, 500, 'The request could not be completed.');
}

router.get('/members', async (req, res) => {
  try {
    const { data: users, error } = await supabase.from('recovery_users')
      .select('id,username,role,last_login_at,created_at,security_status')
      .in('role', roles).order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    const ids = (users || []).map(u => u.id);
    if (!ids.length) return res.json({ success: true, members: [] });
    const [{ data: profiles, error: pe }, { data: presence, error: pre }, { data: blocks, error: be }] = await Promise.all([
      supabase.from('recovery_chat_profiles').select('*').in('user_id', ids),
      supabase.from('recovery_chat_presence').select('user_id,last_seen_at').in('user_id', ids),
      supabase.from('recovery_chat_blocks').select('blocker_user_id,blocked_user_id')
        .or('blocker_user_id.eq.' + req.user.id + ',blocked_user_id.eq.' + req.user.id),
    ]);
    if (pe) throw pe; if (pre) throw pre; if (be) throw be;
    const blocked = new Set();
    (blocks || []).forEach(b => { blocked.add(b.blocker_user_id); blocked.add(b.blocked_user_id); });
    const pMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const liveMap = new Map((presence || []).map(p => [p.user_id, p]));
    const members = (users || []).filter(u => u.id !== req.user.id && !blocked.has(u.id) && (!u.security_status || u.security_status === 'active') && (!u.security_status || u.security_status === 'active'))
      .map(u => ({ user: u, profile: pMap.get(u.id) }))
      .filter(x => x.profile?.discoverable !== false && x.profile?.profile_visibility !== 'nobody')
      .map(x => publicProfile(x.profile, x.user, liveMap.get(x.user.id)));
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, members });
  } catch (error) { return handleDbError(res, error, 'Community member list error:'); }
});

router.post('/presence/heartbeat', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from('recovery_chat_presence').upsert({ user_id: req.user.id, last_seen_at: now, updated_at: now }, { onConflict: 'user_id' });
    if (error) throw error;
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, lastSeenAt: now });
  } catch (error) { return handleDbError(res, error, 'Presence heartbeat error:'); }
});

router.get('/profile', async (req, res) => {
  try {
    const [{ data: profile, error: pe }, { data: user, error: ue }] = await Promise.all([
      supabase.from('recovery_chat_profiles').select('*').eq('user_id', req.user.id).maybeSingle(),
      supabase.from('recovery_users').select('id,username,role,created_at').eq('id', req.user.id).maybeSingle(),
    ]);
    if (pe) throw pe; if (ue) throw ue;
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, profile: publicProfile(profile, user || req.user, null) });
  } catch (error) { return handleDbError(res, error, 'Profile read error:'); }
});

router.patch('/profile', async (req, res) => {
  try {
    const body = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (Object.hasOwn(body, 'display_name')) {
      const v = cleanText(body.display_name, 80);
      if (v.length < 1) return fail(res, 400, 'Display name must contain 1–80 characters.');
      patch.display_name = v;
    }
    if (Object.hasOwn(body, 'bio')) {
      const v = String(body.bio || '').trim();
      if (v.length > 500) return fail(res, 400, 'Biography must be 500 characters or fewer.');
      patch.bio = v;
    }
    if (Object.hasOwn(body, 'avatar_url')) {
      const v = cleanText(body.avatar_url, 1000);
      if (v && !(v.startsWith('/') && !v.startsWith('//')) && !/^https:\/\//i.test(v)) return fail(res, 400, 'Avatar must be a secure HTTPS URL or same-site path.');
      patch.avatar_url = v || null;
    }
    for (const field of ['discoverable', 'read_receipts_enabled']) {
      if (Object.hasOwn(body, field)) {
        if (typeof body[field] !== 'boolean') return fail(res, 400, field + ' must be true or false.');
        patch[field] = body[field];
      }
    }
    for (const field of ['profile_visibility', 'presence_visibility', 'last_seen_visibility', 'status_visibility']) {
      if (Object.hasOwn(body, field)) {
        if (!['everyone', 'members', 'nobody'].includes(body[field])) return fail(res, 400, 'Invalid ' + field + ' setting.');
        patch[field] = body[field];
      }
    }
    const { data, error } = await supabase.from('recovery_chat_profiles').upsert({ user_id: req.user.id, ...patch }, { onConflict: 'user_id' }).select('*').single();
    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (error) { return handleDbError(res, error, 'Profile update error:'); }
});

router.get('/messages/:memberId', async (req, res) => {
  try {
    const other = String(req.params.memberId || '');
    if (!validId(other)) return fail(res, 400, 'Invalid member ID.');
    if (other === String(req.user.id)) return fail(res, 400, 'Choose another member.');
    if (await blockedEitherWay(req.user.id, other)) return fail(res, 403, 'This conversation is unavailable because one account has blocked the other.');
    const { data, error } = await supabase.from('recovery_community_messages')
      .select('id,sender_user_id,recipient_user_id,message,created_at,edited_at,deleted_at,reply_to_id')
      .or('and(sender_user_id.eq.' + req.user.id + ',recipient_user_id.eq.' + other + '),and(sender_user_id.eq.' + other + ',recipient_user_id.eq.' + req.user.id + ')')
      .is('deleted_at', null).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, messages: data || [] });
  } catch (error) { return handleDbError(res, error, 'Community message list error:'); }
});

router.post('/messages/:memberId', messageLimiter, async (req, res) => {
  try {
    const other = String(req.params.memberId || '');
    const message = String(req.body?.message || '').trim();
    if (!validId(other)) return fail(res, 400, 'Invalid member ID.');
    if (other === String(req.user.id)) return fail(res, 400, 'Choose another member.');
    if (!message || message.length > 5000) return fail(res, 400, 'Messages must be 1–5000 characters.');
    if (await blockedEitherWay(req.user.id, other)) return fail(res, 403, 'This conversation is unavailable because one account has blocked the other.');
    const { data: recipient, error: recipientError } = await supabase.from('recovery_users')
      .select('id,role,security_status').eq('id', other).in('role', roles).maybeSingle();
    if (recipientError) throw recipientError;
    if (!recipient || recipient.security_status && recipient.security_status !== 'active') return fail(res, 404, 'Member not found.');
    const { data, error } = await supabase.from('recovery_community_messages')
      .insert({ sender_user_id: req.user.id, recipient_user_id: other, message })
      .select('id,sender_user_id,recipient_user_id,message,created_at').single();
    if (error) throw error;
    res.status(201).json({ success: true, message: data });
  } catch (error) { return handleDbError(res, error, 'Community message send error:'); }
});

router.put('/preferences/:memberId', async (req, res) => {
  try {
    const other = String(req.params.memberId || '');
    if (!validId(other) || other === String(req.user.id)) return fail(res, 400, 'Invalid conversation.');
    const body = req.body || {}, patch = { user_id: req.user.id, other_user_id: other, updated_at: new Date().toISOString() };
    for (const field of ['archived', 'muted', 'pinned', 'starred']) {
      if (Object.hasOwn(body, field)) {
        if (typeof body[field] !== 'boolean') return fail(res, 400, field + ' must be true or false.');
        patch[field] = body[field];
      }
    }
    if (!Object.keys(patch).some(k => ['archived', 'muted', 'pinned', 'starred'].includes(k))) return fail(res, 400, 'No preference changes provided.');
    const { data, error } = await supabase.from('recovery_chat_preferences').upsert(patch, { onConflict: 'user_id,other_user_id' }).select('*').single();
    if (error) throw error;
    res.json({ success: true, preferences: data });
  } catch (error) { return handleDbError(res, error, 'Chat preferences error:'); }
});

router.post('/blocks/:memberId', async (req, res) => {
  try {
    const other = String(req.params.memberId || '');
    if (!validId(other) || other === String(req.user.id)) return fail(res, 400, 'Invalid member ID.');
    const { error } = await supabase.from('recovery_chat_blocks').upsert({
      blocker_user_id: req.user.id, blocked_user_id: other, reason: cleanText(req.body?.reason, 500) || null,
    }, { onConflict: 'blocker_user_id,blocked_user_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (error) { return handleDbError(res, error, 'Block member error:'); }
});
router.delete('/blocks/:memberId', async (req, res) => {
  try {
    const other = String(req.params.memberId || '');
    if (!validId(other) || other === String(req.user.id)) return fail(res, 400, 'Invalid member ID.');
    const { error } = await supabase.from('recovery_chat_blocks').delete().eq('blocker_user_id', req.user.id).eq('blocked_user_id', other);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) { return handleDbError(res, error, 'Unblock member error:'); }
});

router.post('/reports', async (req, res) => {
  try {
    const reported = req.body?.reported_user_id ? String(req.body.reported_user_id) : null;
    if (reported && (!validId(reported) || reported === String(req.user.id))) return fail(res, 400, 'Invalid reported member.');
    const reason = cleanText(req.body?.reason, 1000);
    if (reason.length < 3) return fail(res, 400, 'Please provide a reason of at least 3 characters.');
    const { data, error } = await supabase.from('recovery_chat_reports')
      .insert({ reporter_user_id: req.user.id, reported_user_id: reported, direct_message_id: validId(req.body?.direct_message_id) ? req.body.direct_message_id : null, group_id: validId(req.body?.group_id) ? req.body.group_id : null, reason })
      .select('id,status,created_at').single();
    if (error) throw error;
    res.status(201).json({ success: true, report: data });
  } catch (error) { return handleDbError(res, error, 'Chat report error:'); }
});

router.get('/groups', async (req, res) => {
  try {
    const { data: groups, error } = await supabase.from('recovery_chat_group_members')
      .select('group_id,archived,muted,unarchive_on_mention,recovery_chat_groups(id,slug,name,description,is_default,avatar_url)')
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true, groups: (groups || []).map(x => ({ ...x.recovery_chat_groups, archived: x.archived, muted: x.muted, unarchiveOnMention: x.unarchive_on_mention })) });
  } catch (error) { return handleDbError(res, error, 'Group list error:'); }
});

router.get('/groups/:groupId/messages', async (req, res) => {
  try {
    const gid = String(req.params.groupId || '');
    if (!validId(gid)) return fail(res, 400, 'Invalid group ID.');
    if (!await requireGroupMember(gid, req.user.id)) return fail(res, 403, 'You are not a member of this group.');
    const { data, error } = await supabase.from('recovery_chat_group_messages')
      .select('id,group_id,sender_user_id,message,reply_to_id,edited_at,deleted_at,created_at')
      .eq('group_id', gid).is('deleted_at', null).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    res.json({ success: true, messages: data || [] });
  } catch (error) { return handleDbError(res, error, 'Group message list error:'); }
});

router.post('/groups/:groupId/messages', messageLimiter, async (req, res) => {
  try {
    const gid = String(req.params.groupId || '');
    const message = String(req.body?.message || '').trim();
    const replyTo = req.body?.reply_to_id ? String(req.body.reply_to_id) : null;
    if (!validId(gid)) return fail(res, 400, 'Invalid group ID.');
    if (!message || message.length > 5000) return fail(res, 400, 'Messages must be 1–5000 characters.');
    if (!await requireGroupMember(gid, req.user.id)) return fail(res, 403, 'You are not a member of this group.');
    if (replyTo && !validId(replyTo)) return fail(res, 400, 'Invalid reply target.');
    const { data, error } = await supabase.from('recovery_chat_group_messages')
      .insert({ group_id: gid, sender_user_id: req.user.id, message, reply_to_id: replyTo })
      .select('id,group_id,sender_user_id,message,reply_to_id,created_at').single();
    if (error) throw error;
    res.status(201).json({ success: true, message: data });
  } catch (error) { return handleDbError(res, error, 'Group message send error:'); }
});

router.put('/groups/:groupId/archive', async (req, res) => {
  try {
    const gid = String(req.params.groupId || '');
    if (!validId(gid) || typeof req.body?.archived !== 'boolean') return fail(res, 400, 'Provide a valid group and archived=true/false.');
    const { data, error } = await supabase.from('recovery_chat_group_members')
      .update({ archived: req.body.archived }).eq('group_id', gid).eq('user_id', req.user.id)
      .select('group_id,archived').maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 404, 'Group membership not found.');
    res.json({ success: true, membership: data });
  } catch (error) { return handleDbError(res, error, 'Group archive error:'); }
});

router.get('/status', async (req, res) => {
  try {
    const { data: posts, error } = await supabase.from('recovery_chat_status_posts')
      .select('id,user_id,status_type,text_content,media_path,caption,expires_at,created_at')
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    const users = [...new Set((posts || []).map(p => p.user_id))];
    const [{ data: profiles, error: pe }, { data: wallet, error: we }] = await Promise.all([
      users.length ? supabase.from('recovery_chat_profiles').select('user_id,display_name,avatar_url,status_visibility').in('user_id', users) : Promise.resolve({ data: [], error: null }),
      supabase.from('recovery_chat_status_wallets').select('free_status_last_used_at,paid_status_credits').eq('user_id', req.user.id).maybeSingle(),
    ]);
    if (pe) throw pe; if (we) throw we;
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const statuses = (posts || []).filter(p => p.user_id === req.user.id || profileMap.get(p.user_id)?.status_visibility !== 'nobody')
      .map(p => ({ ...p, owner: { id: p.user_id, name: profileMap.get(p.user_id)?.display_name || 'Member', avatar: profileMap.get(p.user_id)?.avatar_url || null } }));
    const last = wallet?.free_status_last_used_at ? new Date(wallet.free_status_last_used_at).getTime() : 0;
    res.json({ success: true, statuses, allowance: { freeAvailable: !last || Date.now() - last >= 86400000, freeLastUsedAt: wallet?.free_status_last_used_at || null, paidCredits: wallet?.paid_status_credits || 0 } });
  } catch (error) { return handleDbError(res, error, 'Status list error:'); }
});

router.post('/status', statusLimiter, async (req, res) => {
  try {
    const type = req.body?.status_type || 'text';
    if (type !== 'text') return fail(res, 400, 'Image and video status uploads are not enabled until secure private storage is configured.');
    const text = cleanText(req.body?.text_content, 2000);
    if (!text) return fail(res, 400, 'Text status cannot be empty.');
    const { data, error } = await supabase.from('recovery_chat_status_posts')
      .insert({ user_id: req.user.id, status_type: 'text', text_content: text, caption: cleanText(req.body?.caption, 1000) })
      .select('id,user_id,status_type,text_content,caption,expires_at,created_at').single();
    if (error) {
      if (String(error.message || '').includes('STATUS_ALLOWANCE_EXHAUSTED')) return fail(res, 402, 'Your free status has been used in the last 24 hours. Purchase two extra status posts for KES 100.');
      throw error;
    }
    res.status(201).json({ success: true, status: data });
  } catch (error) { return handleDbError(res, error, 'Create status error:'); }
});

router.get('/status/credits', async (req, res) => {
  try {
    const { data, error } = await supabase.from('recovery_chat_status_wallets').select('free_status_last_used_at,paid_status_credits').eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    const last = data?.free_status_last_used_at ? new Date(data.free_status_last_used_at).getTime() : 0;
    res.json({ success: true, freeAvailable: !last || Date.now() - last >= 86400000, freeLastUsedAt: data?.free_status_last_used_at || null, paidCredits: data?.paid_status_credits || 0, extraCreditsPriceKes: 100, creditsPerPurchase: 2 });
  } catch (error) { return handleDbError(res, error, 'Status credits error:'); }
});

router.post('/status/purchase/initialize', async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) return fail(res, 503, 'Payment service is not configured.');
    if (req.user.role !== 'client') return fail(res, 403, 'Client access required.');
    const email = cleanText(req.user.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Add a valid email to your account before purchasing credits.');
    const reference = 'MTC-STATUS-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    const { data: purchase, error: pe } = await supabase.from('recovery_chat_status_purchases')
      .insert({ user_id: req.user.id, provider_reference: reference, amount_kes: 100, currency: 'KES', credits: 2, status: 'pending' })
      .select('id,provider_reference').single();
    if (pe) throw pe;
    try {
      const init = await axios.post(PAYSTACK_URL + '/transaction/initialize', {
        email, amount: 10000, currency: 'KES', reference,
        callback_url: process.env.PAYSTACK_CHAT_STATUS_CALLBACK_URL || process.env.PUBLIC_APP_URL,
        metadata: { product: 'manlung_chat_status_credits', user_id: req.user.id, purchase_id: purchase.id, credits: 2, amount_kes: 100 },
      }, { headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY }, timeout: 15000 });
      if (!init.data?.status || !init.data?.data?.authorization_url) throw new Error('Paystack did not return a checkout URL.');
      res.json({ success: true, purchaseId: purchase.id, reference, authorizationUrl: init.data.data.authorization_url, amountKes: 100, credits: 2 });
    } catch (e) {
      await supabase.from('recovery_chat_status_purchases').update({ status: 'failed' }).eq('id', purchase.id);
      throw e;
    }
  } catch (error) {
    console.error('Status purchase initialize error:', error.response?.data || error.message);
    return fail(res, error.response?.status >= 400 && error.response?.status < 500 ? 400 : 500, 'Could not start status-credit checkout.');
  }
});

router.post('/status/purchase/verify', async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) return fail(res, 503, 'Payment service is not configured.');
    const reference = cleanText(req.body?.reference, 150);
    if (!/^MTC-STATUS-[A-Za-z0-9-]+$/.test(reference)) return fail(res, 400, 'Invalid payment reference.');
    const { data: purchase, error: pe } = await supabase.from('recovery_chat_status_purchases')
      .select('id,user_id,provider_reference,amount_kes,currency,credits,status').eq('provider_reference', reference).maybeSingle();
    if (pe) throw pe;
    if (!purchase) return fail(res, 404, 'Payment record not found.');
    if (purchase.user_id !== req.user.id && !isAdmin(req.user)) return fail(res, 403, 'This payment belongs to another account.');
    if (purchase.status === 'paid') return res.json({ success: true, alreadyFulfilled: true });
    const verify = await axios.get(PAYSTACK_URL + '/transaction/verify/' + encodeURIComponent(reference), {
      headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY }, timeout: 12000,
    });
    const tx = verify.data?.data;
    if (!verify.data?.status || !tx || tx.reference !== reference) return fail(res, 400, 'Payment verification failed.');
    if (String(tx.status).toLowerCase() !== 'success') return res.status(202).json({ success: false, pending: true, message: 'Payment is not confirmed yet.' });
    if (Number(tx.amount) !== 10000 || String(tx.currency).toUpperCase() !== 'KES') return fail(res, 400, 'Verified amount or currency does not match KES 100.');
    const { data: fulfilled, error: fe } = await supabase.rpc('recovery_chat_fulfill_status_purchase', {
      p_purchase_id: purchase.id, p_provider_transaction_id: String(tx.id),
    });
    if (fe) throw fe;
    res.json({ success: true, alreadyFulfilled: fulfilled === false, creditsGranted: fulfilled === true ? 2 : 0 });
  } catch (error) {
    console.error('Status purchase verification error:', error.response?.data || error.message);
    return handleDbError(res, error, 'Status purchase verification error:');
  }
});

module.exports = router;
