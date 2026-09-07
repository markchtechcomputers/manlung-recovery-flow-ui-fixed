const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { auth, adminAuth, ownerAuth } = require('../middleware/auth');
const { supabase, EVIDENCE_BUCKET } = require('../config/supabase');
const Case = require('../models/Case');
const User = require('../models/User');
const Notification = require('../models/Notification');
const CaseTimeline = require('../models/CaseTimeline');

const ACTIVE = ['Pending Review','Accepted','Under Investigation','Evidence Collected','Awaiting Customer Response'];
const TERMINAL = ['Recovery Successful','Recovered by Police','Recovered by Owner','Closed','Rejected'];
const ALLOWED = [...ACTIVE, ...TERMINAL];
const TRANSITIONS = {
  'Pending Review': ['Accepted','Rejected'],
  'Accepted': ['Under Investigation','Awaiting Customer Response','Closed','Rejected'],
  'Under Investigation': ['Evidence Collected','Awaiting Customer Response','Recovery Successful','Recovered by Police','Recovered by Owner','Closed'],
  'Evidence Collected': ['Under Investigation','Awaiting Customer Response','Recovery Successful','Recovered by Police','Recovered by Owner','Closed'],
  'Awaiting Customer Response': ['Under Investigation','Evidence Collected','Closed'],
  'Recovery Successful': ['Closed'],
  'Recovered by Police': ['Closed'],
  'Recovered by Owner': ['Closed'],
  'Closed': ['Under Investigation','Accepted'],
  'Rejected': ['Pending Review','Accepted'],
};
const PRIORITIES = ['low','normal','high','urgent'];

function allowedCase(row, user) {
  return user.role === 'owner' || (user.role === 'admin' && row.assigned_admin_id === user.id) || (user.role === 'client' && row.client_user_id === user.id);
}
function adminCanMutate(row, user) {
  return user.role === 'owner' || (user.role === 'admin' && row.assigned_admin_id === user.id);
}
async function event(caseId, actor, type, description, metadata = {}) {
  await CaseTimeline.create({ caseId, actorUserId: actor?.id || null, eventType: type, description, metadata });
}
async function notifyClient(row, type, title, message) {
  if (row.client_user_id) await Notification.create({ userId: row.client_user_id, caseId: row.case_id, type, title, message });
}

// Queue with SLA ordering and optional filters.
router.get('/queue', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const status = String(req.query.status || 'active');
    const priority = String(req.query.priority || 'all');
    const assignee = req.query.assignee === 'me' ? req.user.id : (req.query.assignee || null);
    let query = supabase.from('recovery_cases').select('*').order('sla_due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).limit(limit);
    if (status === 'active') query = query.in('status', ACTIVE);
    else if (status === 'closed') query = query.in('status', TERMINAL);
    else if (status !== 'all') query = query.eq('status', status);
    if (priority !== 'all') query = query.eq('priority', priority);
    if (assignee) query = query.eq('assigned_admin_id', assignee);
    if (req.user.role !== 'owner') query = query.eq('assigned_admin_id', req.user.id);
    const { data, error } = await query;
    if (error) throw error;
    const now = Date.now();
    const cases = (data || []).map(c => ({ ...c, sla_state: !c.sla_due_at ? 'unset' : new Date(c.sla_due_at).getTime() < now ? 'breached' : new Date(c.sla_due_at).getTime() - now < 24*3600*1000 ? 'at_risk' : 'on_track' }));
    res.json({ success: true, cases });
  } catch (e) { res.status(500).json({ success:false, error:'Could not load case queue.' }); }
});

router.get('/workload', adminAuth, async (req, res) => {
  try {
    const { data: admins, error: ae } = await supabase.from('recovery_users').select('id,username,email,full_name,role,admin_status').in('role',['admin','owner']);
    if (ae) throw ae;
    const { data: cases, error: ce } = await supabase.from('recovery_cases').select('assigned_admin_id,status,priority,sla_due_at');
    if (ce) throw ce;
    const rows = (admins || []).map(a => {
      const mine = (cases || []).filter(c => c.assigned_admin_id === a.id);
      const active = mine.filter(c => ACTIVE.includes(c.status));
      const overdue = active.filter(c => c.sla_due_at && new Date(c.sla_due_at) < new Date()).length;
      return { ...a, total: mine.length, active: active.length, overdue, urgent: active.filter(c=>c.priority==='urgent').length };
    });
    res.json({ success:true, admins: rows });
  } catch (e) { res.status(500).json({success:false,error:'Could not load workload.'}); }
});

router.patch('/cases/:caseId/lifecycle', adminAuth, async (req,res) => {
  try {
    const row = await Case.findByCaseId(req.params.caseId);
    if (!row) return res.status(404).json({success:false,error:'Case not found.'});
    if (!adminCanMutate(row, req.user)) return res.status(403).json({success:false,error:'Not authorized.'});
    const next = String(req.body.status || '');
    if (!ALLOWED.includes(next) || (!TRANSITIONS[row.status] || !TRANSITIONS[row.status].includes(next)) && req.user.role !== 'owner') return res.status(400).json({success:false,error:`Invalid transition from ${row.status} to ${next}.`});
    const now = new Date().toISOString();
    const fields = { status: next, last_status_changed_at: now };
    if (TERMINAL.includes(next)) fields.closed_at = now;
    else if (row.status === 'Closed' || row.status === 'Rejected') fields.reopened_at = now;
    const updated = await Case.update(row.case_id, fields);
    await event(row.case_id, req.user, 'lifecycle_changed', `Case lifecycle changed from "${row.status}" to "${next}".`, {from:row.status,to:next});
    await notifyClient(updated,'status_changed','Case status updated',`Your case ${row.case_id} is now "${next}".`);
    res.json({success:true,case:updated});
  } catch(e) { res.status(500).json({success:false,error:'Could not change case lifecycle.'}); }
});

router.post('/cases/:caseId/reassign', ownerAuth, async (req,res) => {
  try {
    const row = await Case.findByCaseId(req.params.caseId);
    if (!row) return res.status(404).json({success:false,error:'Case not found.'});
    const adminId = req.body.adminId || null;
    if (adminId) {
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || admin.admin_status !== 'active') return res.status(400).json({success:false,error:'Target admin is not active.'});
      const active = await Case.countActiveByAdmin(adminId);
      if (active >= 10 && row.assigned_admin_id !== adminId) return res.status(409).json({success:false,error:'Target admin has reached the active case limit.'});
    }
    const updated = await Case.update(row.case_id,{assigned_admin_id:adminId,assigned_at:adminId?new Date().toISOString():null,assigned_by_user_id:req.user.id,assignment_reason:String(req.body.reason||'Owner reassignment').slice(0,500)});
    await event(row.case_id,req.user,'assignment_changed',`Case reassigned from ${row.assigned_admin_id || 'Unassigned'} to ${adminId || 'Unassigned'}.`,{from:row.assigned_admin_id,to:adminId});
    if (adminId) await Notification.create({userId:adminId,caseId:row.case_id,type:'case_assigned',title:'Case assigned to you',message:`Case ${row.case_id} has been assigned to you.`});
    await notifyClient(updated,'assignment_changed','Case assignment updated',`The investigator assignment for case ${row.case_id} has been updated.`);
    res.json({success:true,case:updated});
  } catch(e) { res.status(500).json({success:false,error:'Could not reassign case.'}); }
});

router.post('/cases/:caseId/reopen', adminAuth, async (req,res) => {
  req.body.status = String(req.body.status || 'Under Investigation');
  const row = await Case.findByCaseId(req.params.caseId).catch(()=>null);
  if (!row || !adminCanMutate(row,req.user)) return res.status(403).json({success:false,error:'Not authorized.'});
  if (!['Closed','Rejected','Recovery Successful','Recovered by Police','Recovered by Owner'].includes(row.status)) return res.status(400).json({success:false,error:'Only completed cases can be reopened.'});
  try {
    const now = new Date().toISOString();
    const updated = await Case.update(row.case_id,{status:req.body.status,reopened_at:now,closed_at:null,last_status_changed_at:now});
    await event(row.case_id,req.user,'case_reopened',`Case reopened as "${req.body.status}".`);
    await notifyClient(updated,'case_reopened','Case reopened',`Your case ${row.case_id} has been reopened for further work.`);
    res.json({success:true,case:updated});
  } catch(e) { res.status(500).json({success:false,error:'Could not reopen case.'}); }
});

router.post('/cases/:caseId/close', adminAuth, async (req,res) => {
  req.body.status='Closed';
  req.body = { ...req.body, status:'Closed' };
  // lifecycle endpoint logic is duplicated here to keep close explicit and auditable.
  try {
    const row=await Case.findByCaseId(req.params.caseId); if(!row) return res.status(404).json({success:false,error:'Case not found.'});
    if(!adminCanMutate(row,req.user)) return res.status(403).json({success:false,error:'Not authorized.'});
    const now=new Date().toISOString(); const updated=await Case.update(row.case_id,{status:'Closed',closed_at:now,last_status_changed_at:now});
    await event(row.case_id,req.user,'case_closed',`Case closed from "${row.status}".`); await notifyClient(updated,'case_closed','Case closed',`Case ${row.case_id} has been closed.`); res.json({success:true,case:updated});
  } catch(e){res.status(500).json({success:false,error:'Could not close case.'});}
});

router.get('/cases/:caseId/history', auth, async (req,res)=>{
  try { const row=await Case.findByCaseId(req.params.caseId); if(!row||!allowedCase(row,req.user)) return res.status(403).json({success:false,error:'Not authorized.'}); const {data,error}=await supabase.from('case_timeline').select('*').eq('case_id',row.case_id).order('created_at',{ascending:true}); if(error) throw error; res.json({success:true,case:row,timeline:data||[]}); }
  catch(e){res.status(500).json({success:false,error:'Could not load case history.'});}
});

// Evidence metadata/audit retrieval. Upload code elsewhere can append audit rows using the same table.
router.get('/cases/:caseId/evidence-audit', adminAuth, async (req,res)=>{
  try { const row=await Case.findByCaseId(req.params.caseId); if(!row||!adminCanMutate(row,req.user)) return res.status(403).json({success:false,error:'Not authorized.'}); const {data,error}=await supabase.from('recovery_evidence_audit_log').select('*').eq('case_id',row.case_id).order('created_at',{ascending:false}); if(error) throw error; res.json({success:true,audit:data||[]}); }
  catch(e){res.status(500).json({success:false,error:'Could not load evidence audit.'});}
});

// Append a server-generated evidence audit record; no file contents are accepted here.
router.post('/evidence/audit', adminAuth, async (req,res)=>{
  try { const caseId=String(req.body.caseId||'').trim(); const action=String(req.body.action||''); if(!caseId||!['upload','view','download','delete','signed_url'].includes(action)) return res.status(400).json({success:false,error:'Invalid evidence audit event.'}); const row=await Case.findByCaseId(caseId); if(!row||!adminCanMutate(row,req.user)) return res.status(403).json({success:false,error:'Not authorized.'}); const metadata=typeof req.body.metadata==='object'&&req.body.metadata?req.body.metadata:{}; const clean={case_id:caseId,evidence_path:String(req.body.evidencePath||'').slice(0,1000),action,actor_user_id:req.user.id,actor_role:req.user.role,filename:String(req.body.filename||'').slice(0,255),sha256:String(req.body.sha256||'').toLowerCase().slice(0,64),mime_type:String(req.body.mimeType||'').slice(0,120),size_bytes:Number(req.body.sizeBytes)||null,category:String(req.body.category||'').slice(0,80),uploader_user_id:req.body.uploaderUserId||req.user.id,metadata}; const {data,error}=await supabase.from('recovery_evidence_audit_log').insert(clean).select().single(); if(error) throw error; res.json({success:true,audit:data}); }
  catch(e){res.status(500).json({success:false,error:'Could not record evidence audit.'});}
});

// Security center.
router.get('/security/events', ownerAuth, async (req,res)=>{ try { const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500); const {data,error}=await supabase.from('recovery_security_events').select('id,event_type,severity,user_id,login_identifier,ip_hash,user_agent_hash,path,http_status,metadata,created_at').order('created_at',{ascending:false}).limit(limit); if(error) throw error; res.json({success:true,events:data||[]}); } catch(e){res.status(500).json({success:false,error:'Could not load security events.'});} });
router.get('/security/summary', ownerAuth, async (_req,res)=>{ try { const since=new Date(Date.now()-24*3600*1000).toISOString(); const {data,error}=await supabase.from('recovery_security_events').select('event_type,severity').gte('created_at',since); if(error) throw error; const summary={last24h:data?.length||0,failed_logins:0,suspicious:0,high_risk:0}; (data||[]).forEach(e=>{if(e.event_type==='login_failed')summary.failed_logins++;if(e.event_type==='suspicious_login')summary.suspicious++;if(['high','critical'].includes(e.severity))summary.high_risk++;}); res.json({success:true,summary}); }catch(e){res.status(500).json({success:false,error:'Could not load security summary.'});} });

// Call history + diagnostics. Clients see only their own sessions; admins see their calls; owner sees all.
router.get('/calls/history', auth, async (req,res)=>{ try { let q=supabase.from('recovery_call_sessions').select('id,client_user_id,client_name,case_id,admin_user_id,status,ringing_started_at,accepted_at,ended_at,end_reason,network_quality,reconnect_count,last_network_event,missed_notified_at').order('created_at',{ascending:false}).limit(100); if(req.user.role==='client')q=q.eq('client_user_id',req.user.id); else if(req.user.role==='admin')q=q.eq('admin_user_id',req.user.id); const {data,error}=await q;if(error)throw error;res.json({success:true,calls:data||[]}); }catch(e){res.status(500).json({success:false,error:'Could not load call history.'});} });
router.post('/calls/:id/diagnostic', auth, async (req,res)=>{ try { const id=req.params.id; const {data:call,error}=await supabase.from('recovery_call_sessions').select('*').eq('id',id).maybeSingle(); if(error)throw error;if(!call)return res.status(404).json({success:false,error:'Call not found.'});if(![call.client_user_id,call.admin_user_id].includes(req.user.id)&&req.user.role!=='owner')return res.status(403).json({success:false,error:'Not authorized.'});const patch={network_quality:String(req.body.networkQuality||'unknown').slice(0,30),last_network_event:String(req.body.event||'').slice(0,100)};if(req.body.reconnect===true)patch.reconnect_count=Number(call.reconnect_count||0)+1;const {data:updated,error:ue}=await supabase.from('recovery_call_sessions').update(patch).eq('id',id).select().single();if(ue)throw ue;res.json({success:true,call:updated}); }catch(e){res.status(500).json({success:false,error:'Could not record call diagnostic.'});} });

// Donation history. Only the owner can see the full donor history; a client can retrieve a receipt by exact reference.
router.get('/donations/history', ownerAuth, async (req,res)=>{ try { const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500); const {data,error}=await supabase.from('recovery_donations').select('id,reference,donor_email,amount_kes,status,paystack_transaction_id,paid_at,confirmed_at,receipt_number,created_at').order('created_at',{ascending:false}).limit(limit);if(error)throw error;res.json({success:true,donations:data||[]}); }catch(e){res.status(500).json({success:false,error:'Could not load donation history.'});} });
router.get('/donations/analytics', ownerAuth, async (_req,res)=>{ try { const {data,error}=await supabase.from('recovery_donations').select('amount_kes,status,created_at,confirmed_at');if(error)throw error;const confirmed=(data||[]).filter(d=>d.status==='confirmed');const byMonth={};confirmed.forEach(d=>{const k=String(d.confirmed_at||d.created_at).slice(0,7);byMonth[k]=(byMonth[k]||0)+Number(d.amount_kes||0);});res.json({success:true,summary:{confirmed_count:confirmed.length,confirmed_total_kes:confirmed.reduce((s,d)=>s+Number(d.amount_kes||0),0),pending_count:(data||[]).filter(d=>d.status==='pending').length,failed_count:(data||[]).filter(d=>d.status==='failed').length},monthly:byMonth});}catch(e){res.status(500).json({success:false,error:'Could not load donation analytics.'});} });
router.get('/donations/receipt/:reference', auth, async (req,res)=>{ try { const reference=String(req.params.reference).trim(); const {data,error}=await supabase.from('recovery_donations').select('reference,donor_email,amount_kes,status,paystack_transaction_id,paid_at,confirmed_at,receipt_number,created_at').eq('reference',reference).maybeSingle();if(error)throw error;if(!data)return res.status(404).json({success:false,error:'Donation not found.'});if(req.user.role!=='owner'&&String(req.user.email||'').toLowerCase()!==String(data.donor_email||'').toLowerCase())return res.status(403).json({success:false,error:'Not authorized.'});if(data.status!=='confirmed')return res.status(409).json({success:false,error:'Donation is not confirmed.'});res.json({success:true,receipt:data});}catch(e){res.status(500).json({success:false,error:'Could not load receipt.'});} });

// Printable HTML report; browsers can save/print as PDF without adding a server-side PDF dependency.
router.get('/client/reports/:caseId', auth, async (req,res)=>{ try { const row=await Case.findByCaseId(req.params.caseId);if(!row||!allowedCase(row,req.user))return res.status(403).send('Not authorized');const {data:timeline,error}=await supabase.from('case_timeline').select('*').eq('case_id',row.case_id).order('created_at',{ascending:true});if(error)throw error;const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const items=(timeline||[]).map(t=>`<li><strong>${esc(t.event_type)}</strong> — ${esc(t.description)}<small>${esc(t.created_at)}</small></li>`).join('');res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Case ${esc(row.case_id)} report</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#17202a}h1{margin-bottom:4px}.meta{background:#f4f6f8;padding:16px;border-radius:12px}li{margin:14px 0}small{display:block;color:#667085;margin-top:4px}@media print{button{display:none}}</style></head><body><button onclick="print()">Print / Save PDF</button><h1>Manlung Recovery Case Report</h1><p>Case ${esc(row.case_id)}</p><div class="meta"><b>Status:</b> ${esc(row.status)}<br><b>Priority:</b> ${esc(row.priority||'normal')}<br><b>Created:</b> ${esc(row.created_at)}<br><b>SLA:</b> ${esc(row.sla_due_at||'Not set')}</div><h2>Timeline</h2><ol>${items||'<li>No timeline entries.</li>'}</ol></body></html>`); }catch(e){res.status(500).send('Could not generate report.');} });

module.exports = router;
