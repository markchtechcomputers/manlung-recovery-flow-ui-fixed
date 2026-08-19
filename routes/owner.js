const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { ownerAuth } = require('../middleware/auth');
const User = require('../models/User');
const AdminAuditLog = require('../models/AdminAuditLog');
const AdminInvitation = require('../models/AdminInvitation');
const AdminPermission = require('../models/AdminPermission');
const Case = require('../models/Case');
const CallSession = require('../models/CallSession');
const AdminPresence = require('../models/AdminPresence');
const { sendEmail } = require('../services/email');

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

const MAX_ADMINS = 10; // matches the spec's explicit cap


async function releaseAdminAssignments(adminId) {
  // Re-queue an active case so removing/suspending an Admin never strands it.
  const activeCase = await Case.findActiveByAdmin(adminId);
  if (activeCase) {
    await Case.update(activeCase.case_id, {
      assigned_admin_id: null,
      assigned_at: null,
      started_at: null,
      status: 'Pending Review',
      last_updated: new Date().toLocaleString(),
    });
  }

  // End any live call owned by the Admin and release presence.
  const activeCall = await CallSession.findActiveByAdmin(adminId);
  if (activeCall) {
    await CallSession.setStatus(activeCall.id, 'ended', 'admin_access_changed');
  }
  await AdminPresence.setBusy(adminId, false);
  await AdminPresence.setOffline(adminId);
}

// Every route below requires the Owner role specifically — a regular admin,
// no matter how trusted, gets a 403 here regardless of what the frontend
// shows or what the request looks like.
router.use(ownerAuth);

// Proper Admin invitation flow. The Owner creates the account invitation; the Admin creates their own credentials.
router.post('/invitations', [body('email').trim().isEmail().normalizeEmail()], async (req, res) => {
  if (!checkValidation(req, res)) return;
  try {
    const active = (await User.listAdminsAndOwner()).filter(x => x.role === 'admin' && x.admin_status === 'active').length;
    if (active >= MAX_ADMINS) return res.status(409).json({ error: `Maximum of ${MAX_ADMINS} active administrators reached.` });
    const invitation = await AdminInvitation.create({ email: req.body.email, invitedBy: req.user.id });
    const configuredBase =
      String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '');

    const base =
      configuredBase ||
      'https://manlungrecovery.manlungshop.co.ke';

    const link =
      `${base}/admin/register.html?token=${encodeURIComponent(invitation.token)}`;
    const mail = await sendEmail({ to:req.body.email, subject:'Manlung Recovery admin invitation', html:`<p>You have been invited to join the Manlung Recovery Admin portal.</p><p><a href="${link}">Complete your Admin registration</a></p><p>This invitation expires in 48 hours.</p>` });
    await AdminAuditLog.record({ actor:req.user, target:{ id:req.user.id, username:req.user.username }, action:'invited_admin' });
    res.status(201).json({ success:true, invitation:{ email:req.body.email, expiresAt:invitation.expires_at, link: mail.sent ? undefined : link, emailSent:mail.sent } });
  } catch (error) { console.error('Invite admin error:', error); res.status(500).json({ error:error.message || 'Could not create invitation' }); }
});

router.get('/invitations', async (req,res) => { try { res.json({ success:true, invitations:await AdminInvitation.list() }); } catch(e){ res.status(500).json({error:'Server error'}); } });

router.put('/admins/:userId/permissions', [body('permissions').isArray().withMessage('permissions must be an array')], async (req,res) => {
  if (!checkValidation(req,res)) return;
  try {
    const target=await User.findById(req.params.userId);
    if(!target || target.role!=='admin') return res.status(404).json({error:'Admin not found'});
    const allowed = new Set(['HANDLE_CASES','UPDATE_CASES','VIEW_CLIENT_CONTACT','ANSWER_CALLS','UPLOAD_EVIDENCE','VIEW_CASE_HISTORY']);
    const permissions=[...new Set(req.body.permissions)].filter(p=>allowed.has(p));
    const saved=await AdminPermission.replace(target.id, permissions, req.user.id);
    await AdminAuditLog.record({actor:req.user,target,action:'updated_admin_permissions'});
    res.json({success:true,permissions:saved});
  } catch(error){ console.error(error); res.status(500).json({error:error.message||'Could not update permissions'}); }
});

router.get('/admins/:userId/permissions', async (req,res)=>{ try { const target=await User.findById(req.params.userId); if(!target||target.role!=='admin') return res.status(404).json({error:'Admin not found'}); res.json({success:true,permissions:await AdminPermission.list(target.id)}); } catch(e){res.status(500).json({error:'Server error'});} });

// List current admins + the owner
router.get('/admins', async (req, res) => {
  try {
    const admins = await User.listAdminsAndOwner();
    res.json({ success: true, admins });
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Search registered clients to promote (the pool an Owner picks from)
router.get('/users', async (req, res) => {
  try {
    const users = await User.searchPromotableUsers(req.query.search);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Direct client-to-Admin promotion is intentionally disabled.
// Admin access must go through Owner invitation -> Admin registration -> Owner approval.
router.post('/admins', async (req, res) => {
  return res.status(410).json({ error: 'Direct Admin promotion is disabled. Send an Owner invitation instead.' });
});

// Approve a newly registered Admin. Pending accounts cannot log in or receive calls.
router.put('/admins/:userId/approve', async (req,res)=>{
  try {
    const target=await User.findById(req.params.userId);
    if(!target || target.role!=='admin') return res.status(404).json({error:'Admin not found'});
    if(target.admin_status!=='pending') return res.status(409).json({error:'Admin is not pending approval.'});
    const updated=await User.setAdminStatus(target.id,'active');
    await AdminPermission.replace(target.id, AdminPermission.DEFAULT_PERMISSIONS, req.user.id);
    await AdminAuditLog.record({actor:req.user,target:updated,action:'approved_admin'});
    res.json({success:true,admin:updated});
  } catch(e){console.error(e);res.status(500).json({error:e.message||'Could not approve admin'});}
});

// Suspend or reactivate an existing admin
router.put(
  '/admins/:userId/status',
  [body('status').isIn(['active', 'suspended']).withMessage('status must be active or suspended')],
  async (req, res) => {
    if (!checkValidation(req, res)) return;
    try {
      const target = await User.findById(req.params.userId);
      if (!target) return res.status(404).json({ error: 'Admin not found' });
      if (target.role === 'owner') {
        return res.status(403).json({ error: "The Owner account cannot be suspended." });
      }
      if (target.role !== 'admin') {
        return res.status(400).json({ error: 'This user is not currently an admin.' });
      }

      if (req.body.status === 'suspended') await releaseAdminAssignments(target.id);
      const updated = await User.setAdminStatus(target.id, req.body.status);
      if (!updated) return res.status(409).json({ error: 'Could not update status — try again.' });

      await AdminAuditLog.record({
        actor: req.user,
        target: updated,
        action: req.body.status === 'suspended' ? 'suspended_admin' : 'reactivated_admin',
      });
      res.json({ success: true, admin: updated });
    } catch (error) {
      console.error('Set admin status error:', error);
      res.status(500).json({ error: error.message || 'Server error' });
    }
  }
);

// Remove admin privileges — reverts to a normal client account. Nothing is
// deleted: their case history, call history, and login all keep working,
// they just lose admin-only access immediately.
router.delete('/admins/:userId', async (req, res) => {
  try {
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ error: 'Admin not found' });
    if (target.role === 'owner') {
      return res.status(403).json({ error: 'The Owner account cannot be removed or demoted.' });
    }
    if (target.role !== 'admin') {
      return res.status(400).json({ error: 'This user is not currently an admin.' });
    }

    await releaseAdminAssignments(target.id);
    const updated = await User.removeAdminPrivileges(target.id);
    if (!updated) return res.status(409).json({ error: 'Could not remove admin privileges — try again.' });

    await AdminAuditLog.record({ actor: req.user, target: updated, action: 'removed_admin' });
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Owner-only: delete the client-facing feedback/message attached to a case.
// The Admin dashboard can show this control only to the Owner, but the API
// remains protected even if an Admin manually calls it.
router.delete('/cases/:caseId/public-notes', async (req, res) => {
  try {
    const existing = await Case.findByCaseId(req.params.caseId);
    if (!existing) return res.status(404).json({ error: 'Case not found' });
    if (!existing.public_notes) return res.json({ success: true, message: 'No client message to delete.' });

    const updated = await Case.update(req.params.caseId, {
      public_notes: null,
      last_updated: new Date().toLocaleString(),
    });

    await AdminAuditLog.record({
      actor: req.user,
      target: { id: existing.client_user_id, username: existing.client_name },
      action: 'deleted_client_message',
      details: { caseId: req.params.caseId },
    });

    res.json({ success: true, case: { caseId: updated.case_id, publicNotes: updated.public_notes } });
  } catch (error) {
    console.error('Delete client message error:', error);
    res.status(500).json({ error: error.message || 'Could not delete client message' });
  }
});

// Audit trail — who did what, to whom, when
router.delete('/audit-log', async (req, res) => {
  try {
    const { error } = await require('../config/supabase').supabase.from('recovery_admin_audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Clear audit log error:', error);
    res.status(500).json({ error: error.message || 'Could not clear audit log.' });
  }
});

router.get('/audit-log', async (req, res) => {
  try {
    const log = await AdminAuditLog.list();
    res.json({ success: true, log });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

module.exports = router;
