const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { ownerAuth } = require('../middleware/auth');
const { supabase } = require('../config/supabase');

const TABLE = 'career_applications';

function valid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// Public career application. No admin credentials are exposed here.
router.post('/', [
  body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name is required.'),
  body('email').trim().isEmail().normalizeEmail().withMessage('A valid email is required.'),
  body('phone').trim().isLength({ min: 7, max: 40 }).withMessage('A valid phone number is required.'),
  body('location').trim().isLength({ min: 2, max: 160 }).withMessage('Location is required.'),
  body('education').trim().isLength({ min: 2, max: 2000 }).withMessage('Education details are required.'),
  body('experience').trim().isLength({ min: 2, max: 4000 }).withMessage('Career experience is required.'),
  body('roleInterested').trim().isLength({ min: 2, max: 160 }).withMessage('Select a role of interest.'),
  body('skills').trim().isLength({ min: 2, max: 3000 }).withMessage('Skills are required.'),
  body('coverNote').trim().isLength({ min: 20, max: 5000 }).withMessage('Please provide a short application statement.'),
], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const { data, error } = await supabase.from(TABLE).insert({
      full_name: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      location: req.body.location,
      education: req.body.education,
      experience: req.body.experience,
      role_interested: req.body.roleInterested,
      skills: req.body.skills,
      cover_note: req.body.coverNote,
      status: 'submitted',
    }).select('id, status, created_at').single();
    if (error) throw error;
    res.status(201).json({ success: true, application: data, message: 'Application submitted successfully.' });
  } catch (error) {
    console.error('Career application error:', error);
    res.status(500).json({ error: 'Could not submit your application right now.' });
  }
});

// Owner-only recruitment portal.
router.get('/admin', ownerAuth, async (_req, res) => {
  try {
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, applications: data || [] });
  } catch (error) {
    console.error('Career applications list error:', error);
    res.status(500).json({ error: 'Could not load career applications.' });
  }
});

router.put('/admin/:id/status', ownerAuth, [body('status').isIn(['submitted','reviewing','shortlisted','hired','rejected']).withMessage('Invalid application status.')], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const { data, error } = await supabase.from(TABLE).update({ status: req.body.status, reviewed_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Application not found.' });
    res.json({ success: true, application: data });
  } catch (error) {
    console.error('Career application status error:', error);
    res.status(500).json({ error: 'Could not update application.' });
  }
});

router.delete('/admin/:id', ownerAuth, async (req, res) => {
  try {
    const { error } = await supabase.from(TABLE).delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Career application delete error:', error);
    res.status(500).json({ error: 'Could not delete application.' });
  }
});

router.delete('/admin', ownerAuth, async (_req, res) => {
  try {
    const { error } = await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Career applications clear error:', error);
    res.status(500).json({ error: 'Could not clear applications.' });
  }
});

module.exports = router;
