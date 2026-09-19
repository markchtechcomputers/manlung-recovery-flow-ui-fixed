const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { ownerAuth } = require('../middleware/auth');
const { supabase, EVIDENCE_BUCKET } = require('../config/supabase');

const TABLE = 'career_applications';
const CAREER_MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 15 * 60;

const careerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CAREER_MAX_FILE_SIZE, files: 2 },
});

function valid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

function validateCareerPdf(file, label) {
  if (!file) throw new Error(`${label} PDF is required.`);
  if (file.mimetype !== 'application/pdf') throw new Error(`${label} must be a PDF file.`);
  if (file.buffer.toString('ascii', 0, 5) !== '%PDF-') throw new Error(`${label} is not a valid PDF file.`);
}

function safeOriginalName(name, fallback) {
  return String(name || fallback).trim().slice(0, 180).replace(/[^\w.\- ()]/g, '_') || fallback;
}

async function uploadCareerDocument(file, applicationId, type) {
  validateCareerPdf(file, type === 'cv' ? 'CV / Resume' : 'Application letter');
  const filename = safeOriginalName(file.originalname, type === 'cv' ? 'cv.pdf' : 'application-letter.pdf');
  const path = `career-applications/${applicationId}/${type}-${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, file.buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw error;
  return { path, filename };
}

async function removeCareerFiles(paths) {
  const validPaths = (paths || []).filter(Boolean);
  if (!validPaths.length) return;
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).remove(validPaths);
  if (error) console.error('Career document cleanup error:', error);
}

router.post(
  '/',
  careerUpload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 },
  ]),
  [
    body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name is required.'),
    body('email').trim().isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('phone').trim().isLength({ min: 7, max: 40 }).withMessage('A valid phone number is required.'),
    body('location').trim().isLength({ min: 2, max: 160 }).withMessage('Location is required.'),
    body('education').trim().isLength({ min: 2, max: 2000 }).withMessage('Education details are required.'),
    body('experience').trim().isLength({ min: 2, max: 4000 }).withMessage('Career experience is required.'),
    body('roleInterested').trim().isLength({ min: 2, max: 160 }).withMessage('Select a role of interest.'),
    body('skills').trim().isLength({ min: 2, max: 3000 }).withMessage('Skills are required.'),
    body('coverNote').trim().isLength({ min: 20, max: 5000 }).withMessage('Please provide a short application statement.'),
  ],
  async (req, res) => {
    if (!valid(req, res)) return;
    const uploadedPaths = [];
    try {
      const cv = req.files?.cv?.[0];
      const coverLetter = req.files?.coverLetter?.[0];

      if (!cv) return res.status(400).json({ error: 'CV / Resume PDF is required.' });
      if (!coverLetter) return res.status(400).json({ error: 'Application letter PDF is required.' });

      validateCareerPdf(cv, 'CV / Resume');
      validateCareerPdf(coverLetter, 'Application letter');

      const applicationId = crypto.randomUUID();
      const cvDocument = await uploadCareerDocument(cv, applicationId, 'cv');
      uploadedPaths.push(cvDocument.path);
      const coverLetterDocument = await uploadCareerDocument(coverLetter, applicationId, 'cover-letter');
      uploadedPaths.push(coverLetterDocument.path);

      const { data, error } = await supabase.from(TABLE).insert({
        id: applicationId,
        full_name: req.body.fullName,
        email: req.body.email,
        phone: req.body.phone,
        location: req.body.location,
        education: req.body.education,
        experience: req.body.experience,
        role_interested: req.body.roleInterested,
        skills: req.body.skills,
        cover_note: req.body.coverNote,
        cv_path: cvDocument.path,
        cv_filename: cvDocument.filename,
        cover_letter_path: coverLetterDocument.path,
        cover_letter_filename: coverLetterDocument.filename,
        status: 'submitted',
      }).select('id, status, created_at').single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        application: data,
        message: 'Application submitted successfully.',
      });
    } catch (error) {
      await removeCareerFiles(uploadedPaths);
      console.error('Career application error:', {
        message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
      });
      res.status(500).json({ error: 'Could not submit your application right now.' });
    }
  }
);

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

router.get('/admin/:id/document/:type', ownerAuth, async (req, res) => {
  try {
    const columnMap = { cv: 'cv_path', 'cover-letter': 'cover_letter_path' };
    const column = columnMap[req.params.type];
    if (!column) return res.status(400).json({ error: 'Invalid career document type.' });

    const { data, error } = await supabase.from(TABLE).select(column).eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data || !data[column]) return res.status(404).json({ error: 'Document not found.' });

    const { data: signed, error: signedError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(data[column], SIGNED_URL_TTL);
    if (signedError) throw signedError;

    return res.redirect(signed.signedUrl);
  } catch (error) {
    console.error('Career document view error:', error);
    return res.status(500).json({ error: 'Could not open career document.' });
  }
});

router.put('/admin/:id/status', ownerAuth, [
  body('status').isIn(['submitted', 'reviewing', 'shortlisted', 'hired', 'rejected']).withMessage('Invalid application status.'),
], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const { data, error } = await supabase.from(TABLE).update({ status: req.body.status }).eq('id', req.params.id).select().maybeSingle();
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
    const { data, error: findError } = await supabase.from(TABLE).select('cv_path, cover_letter_path').eq('id', req.params.id).maybeSingle();
    if (findError) throw findError;
    if (!data) return res.status(404).json({ error: 'Application not found.' });

    await removeCareerFiles([data.cv_path, data.cover_letter_path]);
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
    const { data, error: findError } = await supabase.from(TABLE).select('cv_path, cover_letter_path');
    if (findError) throw findError;
    await removeCareerFiles((data || []).flatMap(a => [a.cv_path, a.cover_letter_path]));
    const { error } = await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Career applications clear error:', error);
    res.status(500).json({ error: 'Could not clear applications.' });
  }
});

module.exports = router;
