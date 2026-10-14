const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { auth } = require('../middleware/auth');

router.use((req,res,next)=>req.path==='/plans/webhook'?next():auth(req,res,next));

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
  if (error?.code === '42P01' || /recovery_chat_|recovery_community_messages|recovery_peer_calls|recovery_peer_call_signals/.test(error?.message || '')) {
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
    const { data: accepted, error: acceptedError } = await supabase.from('recovery_chat_friend_requests')
      .select('id').eq('status','accepted')
      .or('and(sender_user_id.eq.' + req.user.id + ',recipient_user_id.eq.' + other + '),and(sender_user_id.eq.' + other + ',recipient_user_id.eq.' + req.user.id + ')').limit(1);
    if (acceptedError) throw acceptedError;
    if (!accepted?.length) {
      const { data: pass, error: passError } = await supabase.from('recovery_chat_plan_purchases')
        .select('id').eq('user_id',req.user.id).eq('plan_code','chat_pass').eq('status','paid').gt('expires_at',new Date().toISOString()).limit(1);
      if (passError) throw passError;
      if (!pass?.length) return fail(res,403,'Accept the friend request or purchase an active Chat pass to message this member.');
    }
    const { data, error } = await supabase.from('recovery_community_messages')
      .insert({ sender_user_id: req.user.id, recipient_user_id: other, message })
      .select('id,sender_user_id,recipient_user_id,message,created_at').single();
    if (error) throw error;
    res.status(201).json({ success: true, message: data });
  } catch (error) { return handleDbError(res, error, 'Community message send error:'); }
});



const COMMUNITY_PLANS = Object.freeze({
  plus: { amountKes: 100, amountMinor: 10000, label: 'Plus', planEnv: 'PAYSTACK_PLAN_PLUS' },
  pro: { amountKes: 500, amountMinor: 50000, label: 'Pro', planEnv: 'PAYSTACK_PLAN_PRO' },
  chat_pass: { amountKes: 100, amountMinor: 10000, label: 'Chat pass', planEnv: 'PAYSTACK_PLAN_CHAT_PASS' },
  call: { amountKes: 200, amountMinor: 20000, label: 'Call subscription', planEnv: 'PAYSTACK_PLAN_MONTHLY' },
});
router.get('/plans/status', async (req, res) => {
  try {
    const { data, error } = await supabase.from('recovery_chat_plan_purchases')
      .select('plan_code,status,starts_at,expires_at,paid_at,amount_kes')
      .eq('user_id', req.user.id).eq('status','paid').gt('expires_at',new Date().toISOString())
      .order('expires_at',{ascending:false}).limit(20);
    if (error) throw error;
    const active = data || [];
    const chosen = code => active.find(p => p.plan_code === code) || null;
    const tier = chosen('pro') ? 'pro' : chosen('plus') ? 'plus' : 'free';
    res.set('Cache-Control','no-store');
    res.json({success:true,plans:{status:tier,chatPass:!!chosen('chat_pass'),call:!!chosen('call')},
      active:active.map(p=>({code:p.plan_code,expiresAt:p.expires_at,amountKes:p.amount_kes}))});
  } catch (error) { return handleDbError(res,error,'Community plan status error:'); }
});
router.post('/plans/initialize', async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) return fail(res,503,'Payment service is not configured.');
    if (req.user.role !== 'client') return fail(res,403,'Client access required.');
    const code=String(req.body?.plan_code||'');
    const plan=COMMUNITY_PLANS[code];
    if (!plan) return fail(res,400,'Choose a valid subscription.');
    const email=cleanText(req.user.email,254).toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return fail(res,400,'Add a valid email to your account before paying.');
    const planCode=String(process.env[plan.planEnv]||'').trim();
    if(!planCode) return fail(res,503,'The matching monthly Paystack plan is not configured: '+plan.planEnv+'.');
    const remoteResponse=await axios.get(PAYSTACK_URL+'/plan/'+encodeURIComponent(planCode),{headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY},timeout:10000});
    const remotePlan=remoteResponse.data?.data;
    if(!remotePlan||Number(remotePlan.amount)!==plan.amountMinor||String(remotePlan.currency||'').toUpperCase()!=='KES'||String(remotePlan.interval||'').toLowerCase()!=='monthly')
      return fail(res,503,'The configured Paystack plan must match the listed KES price and monthly billing interval.');
    const reference='MTC-PLAN-'+Date.now()+'-'+crypto.randomBytes(8).toString('hex');
    const {data:purchase,error:pe}=await supabase.from('recovery_chat_plan_purchases')
      .insert({user_id:req.user.id,provider_reference:reference,provider_plan_code:planCode,plan_code:code,amount_kes:plan.amountKes,currency:'KES',status:'pending'})
      .select('id,provider_reference').single();
    if(pe) throw pe;
    try {
      const init=await axios.post(PAYSTACK_URL+'/transaction/initialize',{
        email,amount:plan.amountMinor,currency:'KES',reference,plan:planCode,
        callback_url:process.env.PAYSTACK_CHAT_PLAN_CALLBACK_URL||(String(process.env.PUBLIC_APP_URL||'').replace(/\/+$/,'')+'/client/connect.html'),
        metadata:{product:'manlung_community_subscription',plan_code:code,user_id:req.user.id,purchase_id:purchase.id,amount_kes:plan.amountKes}
      },{headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY},timeout:15000});
      if(!init.data?.status||!init.data?.data?.authorization_url) throw new Error('Paystack did not return checkout URL.');
      res.json({success:true,purchaseId:purchase.id,reference,authorizationUrl:init.data.data.authorization_url,amountKes:plan.amountKes,planCode:code});
    } catch(e) {
      await supabase.from('recovery_chat_plan_purchases').update({status:'failed'}).eq('id',purchase.id);
      throw e;
    }
  } catch(error) {
    console.error('Community plan initialization error:',error.response?.data||error.message);
    return fail(res,error.response?.status>=400&&error.response?.status<500?400:500,'Could not start subscription checkout.');
  }
});
router.post('/plans/verify', async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) return fail(res,503,'Payment service is not configured.');
    const reference=cleanText(req.body?.reference,150);
    if(!/^MTC-PLAN-[A-Za-z0-9-]+$/.test(reference)) return fail(res,400,'Invalid payment reference.');
    const {data:purchase,error:pe}=await supabase.from('recovery_chat_plan_purchases')
      .select('id,user_id,provider_reference,plan_code,amount_kes,currency,status').eq('provider_reference',reference).maybeSingle();
    if(pe) throw pe;
    if(!purchase) return fail(res,404,'Payment record not found.');
    if(purchase.user_id!==req.user.id&&!isAdmin(req.user)) return fail(res,403,'This payment belongs to another account.');
    if(purchase.status==='paid') return res.json({success:true,alreadyFulfilled:true,planCode:purchase.plan_code});
    const plan=COMMUNITY_PLANS[purchase.plan_code];
    if(!plan||purchase.amount_kes!==plan.amountKes||purchase.currency!=='KES') return fail(res,400,'Stored purchase amount is invalid.');
    const verify=await axios.get(PAYSTACK_URL+'/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY},timeout:12000});
    const tx=verify.data?.data;
    if(!verify.data?.status||!tx||tx.reference!==reference) return fail(res,400,'Payment verification failed.');
    if(String(tx.status).toLowerCase()!=='success') return res.status(202).json({success:false,pending:true,message:'Payment is not confirmed yet.'});
    if(Number(tx.amount)!==plan.amountMinor||String(tx.currency).toUpperCase()!=='KES') return fail(res,400,'Verified amount or currency does not match the selected plan.');
    if(tx.metadata?.user_id&&tx.metadata.user_id!==purchase.user_id) return fail(res,400,'Payment metadata does not match the purchase.');
    const {data:fulfilled,error:fe}=await supabase.rpc('recovery_chat_fulfill_plan_purchase',{p_purchase_id:purchase.id,p_provider_transaction_id:String(tx.id)});
    if(fe) throw fe;
    const subscriptionCode=String(tx.subscription?.subscription_code||tx.subscription_code||'').trim();
    if(subscriptionCode){const upd=await supabase.from('recovery_chat_plan_purchases').update({provider_subscription_code:subscriptionCode}).eq('id',purchase.id);if(upd.error)throw upd.error;}
    res.json({success:true,alreadyFulfilled:fulfilled===false,planCode:purchase.plan_code,expiresInDays:30});
  } catch(error) {
    console.error('Community plan verification error:',error.response?.data||error.message);
    return handleDbError(res,error,'Community plan verification error:');
  }
});

router.post('/plans/webhook', async (req,res) => {
  const secret=process.env.PAYSTACK_SECRET_KEY;
  if(!secret) return res.status(503).send('Webhook not configured');
  const signature=String(req.headers['x-paystack-signature']||'');
  const raw=Buffer.isBuffer(req.rawBody)?req.rawBody:Buffer.from(JSON.stringify(req.body||{}));
  const expected=crypto.createHmac('sha512',secret).update(raw).digest('hex');
  let valid=false;
  try{const a=Buffer.from(signature,'utf8'),b=Buffer.from(expected,'utf8');valid=!!signature&&a.length===b.length&&crypto.timingSafeEqual(a,b)}catch(_){}
  if(!valid)return res.status(401).send('Invalid signature');
  try{
    const event=String(req.body?.event||'');
    if(!['charge.success','invoice.payment_success'].includes(event))return res.status(200).send('Ignored');
    const data=req.body?.data||{};
    const reference=String(data.reference||'').trim();
    const subscriptionCode=String(data.subscription?.subscription_code||data.subscription_code||'').trim();
    let purchase=null;
    if(reference&&/^MTC-PLAN-[A-Za-z0-9-]+$/.test(reference)){
      const found=await supabase.from('recovery_chat_plan_purchases').select('*').eq('provider_reference',reference).maybeSingle();
      if(found.error)throw found.error;purchase=found.data;
    }
    if(!purchase&&subscriptionCode){
      const found=await supabase.from('recovery_chat_plan_purchases').select('*').eq('provider_subscription_code',subscriptionCode).eq('status','paid').order('expires_at',{ascending:false}).limit(1).maybeSingle();
      if(found.error)throw found.error;purchase=found.data;
    }
    if(!purchase)return res.status(200).send('Unknown reference');
    const plan=COMMUNITY_PLANS[purchase.plan_code];
    if(!plan||Number(data.amount)!==plan.amountMinor||String(data.currency||'').toUpperCase()!=='KES')return res.status(400).send('Amount mismatch');
    const verify=await axios.get(PAYSTACK_URL+'/transaction/verify/'+encodeURIComponent(reference||String(data.reference||'')),{headers:{Authorization:'Bearer '+secret},timeout:12000});
    const tx=verify.data?.data;
    if(!verify.data?.status||!tx||String(tx.status).toLowerCase()!=='success'||Number(tx.amount)!==plan.amountMinor||String(tx.currency).toUpperCase()!=='KES')return res.status(400).send('Payment not verified');
    if(purchase.status==='pending'){
      const result=await supabase.rpc('recovery_chat_fulfill_plan_purchase',{p_purchase_id:purchase.id,p_provider_transaction_id:String(tx.id)});
      if(result.error)throw result.error;
      const sub=String(tx.subscription?.subscription_code||subscriptionCode||'').trim();
      if(sub){const upd=await supabase.from('recovery_chat_plan_purchases').update({provider_subscription_code:sub}).eq('id',purchase.id);if(upd.error)throw upd.error;}
    }else if(subscriptionCode){
      const upd=await supabase.from('recovery_chat_plan_purchases').update({provider_transaction_id:String(tx.id),starts_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*86400000).toISOString(),paid_at:new Date().toISOString()}).eq('id',purchase.id);
      if(upd.error)throw upd.error;
    }
    return res.status(200).send('OK');
  }catch(error){console.error('Community plan webhook error:',error.response?.data||error.message);return res.status(500).send('Webhook error');}
});

router.get('/status/:statusId/comments', async (req,res) => {
  try {
    const id=String(req.params.statusId||'');
    if(!validId(id)) return fail(res,400,'Invalid status ID.');
    const {data:post,error:pe}=await supabase.from('recovery_chat_status_posts').select('id,user_id,expires_at').eq('id',id).maybeSingle();
    if(pe) throw pe;
    if(!post||new Date(post.expires_at)<=new Date()) return fail(res,404,'Status not found or expired.');
    if(await blockedEitherWay(req.user.id,post.user_id)) return fail(res,403,'This status is unavailable.');
    const {data,error}=await supabase.from('recovery_chat_status_comments').select('id,status_id,user_id,comment,created_at').eq('status_id',id).order('created_at',{ascending:true}).limit(100);
    if(error) throw error;
    const ids=[...new Set((data||[]).map(x=>x.user_id))];
    const {data:users,error:ue}=ids.length?await supabase.from('recovery_users').select('id,username').in('id',ids):{data:[],error:null};
    if(ue) throw ue;
    const {data:profiles,error:pe2}=ids.length?await supabase.from('recovery_chat_profiles').select('user_id,display_name,avatar_url').in('user_id',ids):{data:[],error:null};
    if(pe2) throw pe2;
    const um=new Map((users||[]).map(x=>[x.id,x])), pm=new Map((profiles||[]).map(x=>[x.user_id,x]));
    res.set('Cache-Control','no-store');
    res.json({success:true,comments:(data||[]).map(x=>({id:x.id,comment:x.comment,createdAt:x.created_at,author:{id:x.user_id,name:pm.get(x.user_id)?.display_name||um.get(x.user_id)?.username||'Member',avatar:pm.get(x.user_id)?.avatar_url||null}}))});
  } catch(error) { return handleDbError(res,error,'Status comments list error:'); }
});
router.post('/status/:statusId/comments', messageLimiter, async (req,res) => {
  try {
    const id=String(req.params.statusId||''), comment=cleanText(req.body?.comment,500);
    if(!validId(id)||!comment) return fail(res,400,'Enter a comment of up to 500 characters.');
    const {data:post,error:pe}=await supabase.from('recovery_chat_status_posts').select('id,user_id,expires_at').eq('id',id).maybeSingle();
    if(pe) throw pe;
    if(!post||new Date(post.expires_at)<=new Date()) return fail(res,404,'Status not found or expired.');
    if(await blockedEitherWay(req.user.id,post.user_id)) return fail(res,403,'This status is unavailable.');
    const {data,error}=await supabase.from('recovery_chat_status_comments').insert({status_id:id,user_id:req.user.id,comment}).select('id,status_id,user_id,comment,created_at').single();
    if(error) throw error;
    res.status(201).json({success:true,comment:data});
  } catch(error) { return handleDbError(res,error,'Status comment create error:'); }
});
router.post('/status/:statusId/hide', async (req,res) => {
  try {
    const id=String(req.params.statusId||'');
    if(!validId(id)) return fail(res,400,'Invalid status ID.');
    const {error}=await supabase.from('recovery_chat_status_hides').upsert({user_id:req.user.id,status_id:id},{onConflict:'user_id,status_id'});
    if(error) throw error;
    res.json({success:true,hidden:true});
  } catch(error) { return handleDbError(res,error,'Status hide error:'); }
});
router.post('/status/:statusId/view', async (req,res) => {
  try {
    const id=String(req.params.statusId||'');
    if(!validId(id)) return fail(res,400,'Invalid status ID.');
    const {data:post,error:pe}=await supabase.from('recovery_chat_status_posts').select('id,user_id,expires_at').eq('id',id).maybeSingle();
    if(pe) throw pe;
    if(!post||new Date(post.expires_at)<=new Date()) return fail(res,404,'Status not found or expired.');
    if(post.user_id===req.user.id) return res.json({success:true,ownStatus:true});
    const {error}=await supabase.from('recovery_chat_status_views').upsert({status_id:id,viewer_user_id:req.user.id,viewed_at:new Date().toISOString()},{onConflict:'status_id,viewer_user_id'});
    if(error) throw error;
    res.json({success:true,viewed:true});
  } catch(error) { return handleDbError(res,error,'Status view error:'); }
});

router.get('/friend-requests', async (req, res) => {
  try {
    const { data, error } = await supabase.from('recovery_chat_friend_requests')
      .select('id,sender_user_id,recipient_user_id,status,created_at,responded_at')
      .or('sender_user_id.eq.' + req.user.id + ',recipient_user_id.eq.' + req.user.id)
      .in('status', ['pending','accepted']).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ids = [...new Set((data || []).map(x => x.sender_user_id === req.user.id ? x.recipient_user_id : x.sender_user_id))];
    const [{ data: users, error: ue }, { data: profiles, error: pe }] = await Promise.all([
      ids.length ? supabase.from('recovery_users').select('id,username,role,security_status').in('id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('recovery_chat_profiles').select('user_id,display_name,avatar_url,bio').in('user_id', ids) : Promise.resolve({ data: [], error: null })
    ]);
    if (ue) throw ue; if (pe) throw pe;
    const um = new Map((users || []).map(u => [u.id, u]));
    const pm = new Map((profiles || []).map(p => [p.user_id, p]));
    const requests = (data || []).filter(x => um.has(x.sender_user_id === req.user.id ? x.recipient_user_id : x.sender_user_id))
      .map(x => {
        const otherId = x.sender_user_id === req.user.id ? x.recipient_user_id : x.sender_user_id;
        const u = um.get(otherId), p = pm.get(otherId) || {};
        return { ...x, direction: x.sender_user_id === req.user.id ? 'sent' : 'received',
          member: { id: otherId, name: cleanText(p.display_name, 80) || cleanText(u.username, 80) || 'Member', username: u.username || null, avatar: p.avatar_url || null, bio: p.bio || '' } };
      });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, requests });
  } catch (error) { return handleDbError(res, error, 'Friend request list error:'); }
});

router.post('/friend-requests/:memberId', async (req, res) => {
  try {
    const other = String(req.params.memberId || '');
    if (!validId(other) || other === String(req.user.id)) return fail(res, 400, 'Choose a valid member.');
    if (await blockedEitherWay(req.user.id, other)) return fail(res, 403, 'This member is unavailable.');
    const { data: recipient, error: re } = await supabase.from('recovery_users')
      .select('id,role,security_status').eq('id', other).in('role', roles).maybeSingle();
    if (re) throw re;
    if (!recipient || (recipient.security_status && recipient.security_status !== 'active')) return fail(res, 404, 'Member not found.');
    const { data: existing, error: ee } = await supabase.from('recovery_chat_friend_requests')
      .select('id,sender_user_id,recipient_user_id,status')
      .or('and(sender_user_id.eq.' + req.user.id + ',recipient_user_id.eq.' + other + '),and(sender_user_id.eq.' + other + ',recipient_user_id.eq.' + req.user.id + ')')
      .in('status', ['pending','accepted']).limit(1).maybeSingle();
    if (ee) throw ee;
    if (existing?.status === 'accepted') return res.json({ success: true, alreadyFriends: true, request: existing });
    if (existing?.status === 'pending') {
      if (existing.sender_user_id === other && existing.recipient_user_id === req.user.id) {
        const { data: accepted, error: ae } = await supabase.from('recovery_chat_friend_requests')
          .update({ status: 'accepted', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', existing.id).eq('recipient_user_id', req.user.id).select('*').single();
        if (ae) throw ae;
        return res.json({ success: true, acceptedReciprocalRequest: true, request: accepted });
      }
      return res.json({ success: true, alreadyPending: true, request: existing });
    }
    const { data, error } = await supabase.from('recovery_chat_friend_requests')
      .insert({ sender_user_id: req.user.id, recipient_user_id: other, status: 'pending' })
      .select('id,sender_user_id,recipient_user_id,status,created_at').single();
    if (error) throw error;
    res.status(201).json({ success: true, request: data });
  } catch (error) { return handleDbError(res, error, 'Friend request create error:'); }
});

router.patch('/friend-requests/:requestId', async (req, res) => {
  try {
    const id = String(req.params.requestId || '');
    if (!validId(id)) return fail(res, 400, 'Invalid friend request.');
    const action = String(req.body?.action || '').toLowerCase();
    if (!['accept','decline','cancel'].includes(action)) return fail(res, 400, 'Choose accept, decline, or cancel.');
    const { data: request, error: re } = await supabase.from('recovery_chat_friend_requests')
      .select('id,sender_user_id,recipient_user_id,status').eq('id', id).maybeSingle();
    if (re) throw re;
    if (!request) return fail(res, 404, 'Friend request not found.');
    const allowed = action === 'cancel' ? request.sender_user_id === req.user.id : request.recipient_user_id === req.user.id;
    if (!allowed) return fail(res, 403, 'You cannot change this friend request.');
    if (request.status !== 'pending') return res.json({ success: true, request, unchanged: true });
    const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'cancelled';
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('recovery_chat_friend_requests')
      .update({ status, responded_at: now, updated_at: now }).eq('id', id).eq('status', 'pending').select('id,sender_user_id,recipient_user_id,status,created_at,responded_at').maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 409, 'This friend request has already been handled.');
    res.json({ success: true, request: data });
  } catch (error) { return handleDbError(res, error, 'Friend request update error:'); }
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
    const { data: hiddenRows, error: he } = await supabase.from('recovery_chat_status_hides').select('status_id').eq('user_id',req.user.id);
    if (he) throw he;
    const hiddenIds = new Set((hiddenRows || []).map(x => x.status_id));
    const users = [...new Set((posts || []).map(p => p.user_id))];
    const [{ data: profiles, error: pe }, { data: wallet, error: we }] = await Promise.all([
      users.length ? supabase.from('recovery_chat_profiles').select('user_id,display_name,avatar_url,status_visibility').in('user_id', users) : Promise.resolve({ data: [], error: null }),
      supabase.from('recovery_chat_status_wallets').select('free_status_last_used_at,paid_status_credits').eq('user_id', req.user.id).maybeSingle(),
    ]);
    if (pe) throw pe; if (we) throw we;
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const statuses = (posts || []).filter(p => !hiddenIds.has(p.id) && (p.user_id === req.user.id || profileMap.get(p.user_id)?.status_visibility !== 'nobody'))
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


const peerCallLimiter = rateLimit({windowMs:60*1000,max:20,standardHeaders:true,legacyHeaders:false});
async function areAcceptedFriends(a,b) {
 const {data,error}=await supabase.from('recovery_chat_friend_requests').select('id').eq('status','accepted')
  .or('and(sender_user_id.eq.'+a+',recipient_user_id.eq.'+b+'),and(sender_user_id.eq.'+b+',recipient_user_id.eq.'+a+')').limit(1);
 if(error) throw error; return Boolean(data?.length);
}
async function hasCallPlan(userId) {
 const {data,error}=await supabase.from('recovery_chat_plan_purchases').select('id')
  .eq('user_id',userId).eq('plan_code','call').eq('status','paid').gt('expires_at',new Date().toISOString()).limit(1);
 if(error) throw error; return Boolean(data?.length);
}
async function peerParticipant(callId,userId) {
 const {data,error}=await supabase.from('recovery_peer_calls').select('*').eq('id',callId).maybeSingle();
 if(error) throw error;
 if(!data) return {call:null,participant:false};
 return {call:data,participant:data.caller_user_id===userId||data.callee_user_id===userId};
}
router.post('/peer-calls',peerCallLimiter,async(req,res)=>{
 try{
  if(req.user.role!=='client') return fail(res,403,'Client account required.');
  const other=String(req.body?.memberId||''),mode=req.body?.call_mode==='video'?'video':'audio';
  if(!validId(other)||other===String(req.user.id)) return fail(res,400,'Choose a valid registered member.');
  if(await blockedEitherWay(req.user.id,other)) return fail(res,403,'Calls are unavailable because one account has blocked the other.');
  if(!await areAcceptedFriends(req.user.id,other)) return fail(res,403,'Accept the friend request before calling this member.');
  if(!await hasCallPlan(req.user.id)) return fail(res,402,'An active KES 200/month call subscription is required.');
  const {data:callee,error:ce}=await supabase.from('recovery_users').select('id,role,security_status').eq('id',other).maybeSingle();
  if(ce) throw ce;
  if(!callee||callee.role!=='client'||(callee.security_status&&callee.security_status!=='active')) return fail(res,404,'Member not found.');
  const stale=await supabase.from('recovery_peer_calls').update({status:'missed',ended_at:new Date().toISOString()}).eq('status','ringing').lt('created_at',new Date(Date.now()-120000).toISOString());
  if(stale.error) throw stale.error;
  const {data:busy,error:be}=await supabase.from('recovery_peer_calls').select('id').in('status',['ringing','accepted'])
   .or('caller_user_id.eq.'+req.user.id+',callee_user_id.eq.'+req.user.id+',caller_user_id.eq.'+other+',callee_user_id.eq.'+other).limit(1);
  if(be) throw be;
  if(busy?.length) return fail(res,409,'One of these members is already in a call.');
  const {data,error}=await supabase.from('recovery_peer_calls').insert({caller_user_id:req.user.id,callee_user_id:other,call_mode:mode,status:'ringing'})
   .select('id,caller_user_id,callee_user_id,call_mode,status,created_at').single();
  if(error) throw error;
  res.status(201).json({success:true,call:data});
 }catch(error){return handleDbError(res,error,'Peer call start error:');}
});
router.get('/peer-calls/incoming',async(req,res)=>{
 try{
  const {data,error}=await supabase.from('recovery_peer_calls').select('id,caller_user_id,callee_user_id,call_mode,status,created_at')
   .eq('callee_user_id',req.user.id).eq('status','ringing').gt('created_at',new Date(Date.now()-120000).toISOString()).order('created_at',{ascending:false}).limit(5);
  if(error) throw error;
  const ids=[...new Set((data||[]).map(x=>x.caller_user_id))];
  const {data:users,error:ue}=ids.length?await supabase.from('recovery_users').select('id,username').in('id',ids):{data:[],error:null};
  if(ue) throw ue;
  const {data:profiles,error:pe}=ids.length?await supabase.from('recovery_chat_profiles').select('user_id,display_name,avatar_url').in('user_id',ids):{data:[],error:null};
  if(pe) throw pe;
  const um=new Map((users||[]).map(x=>[x.id,x])),pm=new Map((profiles||[]).map(x=>[x.user_id,x]));
  res.set('Cache-Control','no-store');
  res.json({success:true,calls:(data||[]).map(c=>({...c,caller:{name:pm.get(c.caller_user_id)?.display_name||um.get(c.caller_user_id)?.username||'Member',avatar:pm.get(c.caller_user_id)?.avatar_url||null}}))});
 }catch(error){return handleDbError(res,error,'Incoming peer calls error:');}
});
router.get('/peer-calls/:callId/signals',async(req,res)=>{
 try{
  const id=String(req.params.callId||'');
  if(!validId(id)) return fail(res,400,'Invalid call ID.');
  const {call,participant}=await peerParticipant(id,req.user.id);
  if(!call) return fail(res,404,'Call not found.');
  if(!participant) return fail(res,403,'You are not a participant in this call.');
  const after=Math.max(0,Number.parseInt(req.query.after||'0',10)||0);
  const {data:signals,error}=await supabase.from('recovery_peer_call_signals').select('id,sender_user_id,signal_type,payload,created_at')
   .eq('call_id',id).neq('sender_user_id',req.user.id).gt('id',after).order('id',{ascending:true}).limit(100);
  if(error) throw error;
  res.set('Cache-Control','no-store');
  res.json({success:true,call,signals:signals||[]});
 }catch(error){return handleDbError(res,error,'Peer call signals read error:');}
});
router.post('/peer-calls/:callId/signals',peerCallLimiter,async(req,res)=>{
 try{
  const id=String(req.params.callId||''),type=String(req.body?.signal_type||'');
  if(!validId(id)||!['offer','answer','ice','accept','reject','hangup'].includes(type)) return fail(res,400,'Invalid call signal.');
  const {call,participant}=await peerParticipant(id,req.user.id);
  if(!call) return fail(res,404,'Call not found.');
  if(!participant) return fail(res,403,'You are not a participant in this call.');
  if(['ended','rejected','missed'].includes(call.status)) return fail(res,409,'This call has already ended.');
  const payload=req.body?.payload&&typeof req.body.payload==='object'&&!Array.isArray(req.body.payload)?req.body.payload:{};
  if(JSON.stringify(payload).length>30000) return fail(res,413,'Call signal is too large.');
  if(type==='offer'&&req.user.id!==call.caller_user_id) return fail(res,403,'Only the caller can send an offer.');
  if(type==='answer'&&req.user.id!==call.callee_user_id) return fail(res,403,'Only the recipient can send an answer.');
  if(type==='accept'&&req.user.id!==call.callee_user_id) return fail(res,403,'Only the recipient can accept this call.');
  const {data,error}=await supabase.from('recovery_peer_call_signals').insert({call_id:id,sender_user_id:req.user.id,signal_type:type,payload})
    .select('id,call_id,sender_user_id,signal_type,payload,created_at').single();
  if(error) throw error;
  if(type==='accept') {const u=await supabase.from('recovery_peer_calls').update({status:'accepted',accepted_at:new Date().toISOString()}).eq('id',id).eq('status','ringing');if(u.error) throw u.error;}
  if(type==='reject'||type==='hangup') {const u=await supabase.from('recovery_peer_calls').update({status:type==='reject'?'rejected':'ended',ended_at:new Date().toISOString()}).eq('id',id).in('status',['ringing','accepted']);if(u.error) throw u.error;}
  res.status(201).json({success:true,signal:data});
 }catch(error){return handleDbError(res,error,'Peer call signal write error:');}
});

module.exports = router;
