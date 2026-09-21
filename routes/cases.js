const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const multer = require('multer');
const { body, validationResult } = require('express-validator');

const Case = require('../models/Case');
const Notification = require('../models/Notification');
const CaseTimeline = require('../models/CaseTimeline');
const {
  auth,
  optionalAuth,
  adminAuth,
  ownerAuth,
  requirePermission,
} = require('../middleware/auth');

const { sendTelegramMessage } = require('../config/telegram');
const {
  supabase,
  EVIDENCE_BUCKET,
} = require('../config/supabase');



async function recordCaseUpdateEvents({
  existing,
  updated,
  actorId,
  actorName,
  source = 'admin',
}) {
  const events = [];

  if (
    existing.status !== undefined &&
    updated.status !== existing.status
  ) {
    events.push({
      eventType: 'status_changed',
      description:
        `Case status changed from "${existing.status}" to "${updated.status}".`,
      notificationTitle: 'Case status updated',
      notificationMessage:
        `Your case ${updated.case_id} is now "${updated.status}".`,
    });
  }

  if (
    existing.investigator !== updated.investigator
  ) {
    const before = existing.investigator || 'Unassigned';
    const after = updated.investigator || 'Unassigned';

    events.push({
      eventType: 'investigator_changed',
      description:
        `Investigator changed from "${before}" to "${after}".`,
      notificationTitle: 'Case assignment updated',
      notificationMessage:
        `The investigator assignment for case ${updated.case_id} has been updated.`,
    });
  }

  if (
    existing.assigned_admin_id !== updated.assigned_admin_id
  ) {
    const before =
      existing.assigned_admin_id || 'Unassigned';
    const after =
      updated.assigned_admin_id || 'Unassigned';

    events.push({
      eventType: 'assignment_changed',
      description:
        `Case assignment changed from "${before}" to "${after}".`,
      notificationTitle: 'Case assignment updated',
      notificationMessage:
        `The assignment for case ${updated.case_id} has changed.`,
    });
  }

  for (const event of events) {
    try {
      await CaseTimeline.create({
        caseId: updated.case_id,
        actorUserId: actorId || null,
        eventType: event.eventType,
        description: event.description,
        metadata: {
          actorName: actorName || null,
          source,
        },
      });
    } catch (timelineError) {
      console.error('Case timeline event failed:', timelineError);
    }

    if (updated.client_user_id) {
      try {
        await Notification.create({
          userId: updated.client_user_id,
          caseId: updated.case_id,
          type: event.eventType,
          title: event.notificationTitle,
          message: event.notificationMessage,
        });
      } catch (notificationError) {
        console.error('Case notification event failed:', notificationError);
      }
    }
  }

  return events.length;
}

// ============================================================
// File Upload Configuration
// ============================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:
      Math.min(parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, 10 * 1024 * 1024),
    files: 10,
    fields: 40,
    parts: 55,
    fieldSize: 64 * 1024,
    fieldNameSize: 200,
  },
});

const ALLOWED_EVIDENCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

const SIGNED_URL_TTL = 15 * 60;


// ============================================================
// File Signature Validation
// ============================================================

function rejectSuspiciousBinary(file) {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) throw new Error('The uploaded file is invalid or empty.');
  const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
  const signatures = [
    [buffer[0] === 0x4d && buffer[1] === 0x5a, 'Windows executable'],
    [buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46, 'ELF executable'],
    [buffer[0] === 0x23 && buffer[1] === 0x21, 'script'],
    [buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04, 'archive/polyglot'],
  ];
  const hit = signatures.find(([matched]) => matched);
  if (hit) throw new Error('Executable or archive content is not allowed in evidence uploads.');
  if (/<\\s*(script|html|iframe|object|embed)\\b/i.test(head) || /\\bon(?:error|load|click)\\s*=/i.test(head)) {
    throw new Error('Executable HTML/script content is not allowed in evidence uploads.');
  }
}

function validateEvidenceSignature(file) {
  const buffer = file?.buffer;

  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    throw new Error('The uploaded file is invalid or empty.');
  }

  const mimetype =
    String(file.mimetype || '')
      .trim()
      .toLowerCase();

  // JPEG
  if (mimetype === 'image/jpeg') {
    const valid =
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    if (!valid) {
      throw new Error(
        'The uploaded file is not a valid JPEG image.'
      );
    }

    return;
  }

  // PNG
  if (mimetype === 'image/png') {
    const pngSignature =
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a
      ]);

    if (
      buffer.length < pngSignature.length ||
      !buffer.subarray(
        0,
        pngSignature.length
      ).equals(pngSignature)
    ) {
      throw new Error(
        'The uploaded file is not a valid PNG image.'
      );
    }

    return;
  }

  // PDF
  if (mimetype === 'application/pdf') {
    if (
      buffer.toString(
        'ascii',
        0,
        5
      ) !== '%PDF-'
    ) {
      throw new Error(
        'The uploaded file is not a valid PDF.'
      );
    }

    return;
  }


  throw new Error(
    'The uploaded file type is not supported.'
  );
}


// ============================================================
// Validation Helper
// ============================================================

function checkValidation(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      error: errors.array()[0].msg,
    });

    return false;
  }

  return true;
}


function rejectInvalidCaseBeforeAuth(req, res, next) {
  if (req.body?.hp_confirm) {
    console.warn(
      '⚠️ Honeypot field was filled on /api/cases/submit — request ignored. IP:',
      req.ip
    );

    return res.status(400).json({
      error: 'Submission could not be processed.',
    });
  }

  if (!checkValidation(req, res)) return;
  next();
}


// ============================================================
// Upload File To Supabase Storage
// ============================================================

async function uploadToStorage(
  file,
  folder,
  uploadedBy
) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Invalid upload.');
  }

  const mimetype =
    String(file.mimetype || '')
      .trim()
      .toLowerCase();

  if (!ALLOWED_EVIDENCE_TYPES.has(mimetype)) {
    throw new Error(
      'This file type is not allowed for evidence upload.'
    );
  }

  validateEvidenceSignature(file);
  rejectSuspiciousBinary(file);

  const originalName =
    String(file.originalname || 'file')
      .replace(/[\\/]+/g, '_')
      .replace(/[^a-zA-Z0-9._() -]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'file';

  const extension =
    originalName.includes('.')
      ? originalName
          .split('.')
          .pop()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : '';

  const expectedExtension = mimetype === 'image/jpeg' ? 'jpg' : mimetype === 'image/png' ? 'png' : 'pdf';
  if (extension !== expectedExtension && !(mimetype === 'image/jpeg' && extension === 'jpeg')) {
    throw new Error('The file extension does not match its content type.');
  }

  const crypto = require('crypto');

  const storageName =
    `${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;

  const path =
    `${folder}/${storageName}`;

  const { error } =
    await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(
        path,
        file.buffer,
        {
          contentType: mimetype,
          upsert: false,
        }
      );

  if (error) {
    throw error;
  }

  return {
    path,
    filename: originalName,
    originalName,
    size: file.size,
    mimetype,
    uploadedBy,
    uploadedAt:
      new Date().toISOString(),
  };
}



// ============================================================
// Serialize Case
// ============================================================

function serializeCase(
  row,
  { includeInternal = false } = {}
) {
  if (!row) return row;

  const out = {
    id: row.id,
    caseId: row.case_id,

    clientName: row.client_name,
    phone: row.phone,
    email: row.email,

    caseType: row.case_type,
    priority: row.priority,
    status: row.status,

    incidentDesc: row.incident_desc,
    incidentDate: row.incident_date,
    incidentTime: row.incident_time,
    incidentLocation: row.incident_location,

    country: row.country,
    county: row.county,
    city: row.city,

    contactMethod: row.contact_method,

    deviceType: row.device_type,
    deviceBrand: row.device_brand,
    deviceModel: row.device_model,
    deviceColour: row.device_colour,

    imei1: row.imei1,
    imei2: row.imei2,
    serial: row.serial,

    purchaseDate: row.purchase_date,
    lastLocation: row.last_location,

    googleAccount: row.google_account,
    appleId: row.apple_id,
    recoveryPhone: row.recovery_phone,

    scamPhone: row.scam_phone,
    scamEmail: row.scam_email,
    scamWebsite: row.scam_website,
    scamTelegram: row.scam_telegram,
    scamWhatsapp: row.scam_whatsapp,
    scamFacebook: row.scam_facebook,
    scamInstagram: row.scam_instagram,
    scamTiktok: row.scam_tiktok,
    scamBank: row.scam_bank,
    scamMpesa: row.scam_mpesa,
    scamCrypto: row.scam_crypto,
    scamAmount: row.scam_amount,

    idCompromised: row.id_compromised,
    idAccounts: row.id_accounts,
    idDate: row.id_date,
    idDescription: row.id_description,

    netCompany: row.net_company,
    netContact: row.net_contact,
    netType: row.net_type,
    netDesc: row.net_desc,
    netAuth: row.net_auth,

    investigator: row.investigator,
    publicNotes: row.public_notes,
    recoveryLoc: row.recovery_loc,
    timeline: row.timeline,

    lastUpdated: row.last_updated,
    adminRead: row.admin_read,

    files: row.files,

    createdAt: row.created_at,

    clientUserId: row.client_user_id,
    assignedAdminId: row.assigned_admin_id,
    assignedAt: row.assigned_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
  };

  if (includeInternal) {
    out.internalNotes = row.internal_notes;
    out.adminHistory = row.admin_history;
  }

  return out;
}


// ============================================================
// Add Signed URLs To Case Files
// ============================================================

async function withSignedFileUrls(caseRow) {
  if (
    !caseRow ||
    !Array.isArray(caseRow.files) ||
    caseRow.files.length === 0
  ) {
    return caseRow;
  }

  const files = await Promise.all(
    caseRow.files.map(async (f) => {
      if (!f.path) {
        return f;
      }

      const { data, error } =
        await supabase.storage
          .from(EVIDENCE_BUCKET)
          .createSignedUrl(
            f.path,
            SIGNED_URL_TTL
          );

      return {
        ...f,
        url: error ? null : data.signedUrl,
      };
    })
  );

  return {
    ...caseRow,
    files,
  };
}


// ============================================================
// Field Configuration
// ============================================================

const DATE_FIELDS = new Set([
  'incidentDate',
  'purchaseDate',
  'idDate',
]);

const BOOLEAN_FIELDS = new Set([
  'netAuth',
]);

const FIELD_MAP = {
  clientName: 'client_name',
  phone: 'phone',
  email: 'email',
  caseType: 'case_type',
  priority: 'priority',

  incidentDesc: 'incident_desc',
  incidentDate: 'incident_date',
  incidentTime: 'incident_time',
  incidentLocation: 'incident_location',

  country: 'country',
  county: 'county',
  city: 'city',

  contactMethod: 'contact_method',

  deviceType: 'device_type',
  deviceBrand: 'device_brand',
  deviceModel: 'device_model',
  deviceColour: 'device_colour',

  imei1: 'imei1',
  imei2: 'imei2',
  serial: 'serial',

  purchaseDate: 'purchase_date',
  lastLocation: 'last_location',

  googleAccount: 'google_account',
  appleId: 'apple_id',
  recoveryPhone: 'recovery_phone',

  scamPhone: 'scam_phone',
  scamEmail: 'scam_email',
  scamWebsite: 'scam_website',
  scamTelegram: 'scam_telegram',
  scamWhatsapp: 'scam_whatsapp',
  scamFacebook: 'scam_facebook',
  scamInstagram: 'scam_instagram',
  scamTiktok: 'scam_tiktok',
  scamBank: 'scam_bank',
  scamMpesa: 'scam_mpesa',
  scamCrypto: 'scam_crypto',
  scamAmount: 'scam_amount',

  idCompromised: 'id_compromised',
  idAccounts: 'id_accounts',
  idDate: 'id_date',
  idDescription: 'id_description',

  netCompany: 'net_company',
  netContact: 'net_contact',
  netType: 'net_type',
  netDesc: 'net_desc',
  netAuth: 'net_auth',
};


// ============================================================
// Map Request Body To Database Fields
// ============================================================

function mapBodyToCaseFields(body) {
  const fields = {};

  for (const [formKey, column] of Object.entries(
    FIELD_MAP
  )) {
    if (!(formKey in body)) {
      continue;
    }

    let value = body[formKey];

    if (
      DATE_FIELDS.has(formKey) &&
      value === ''
    ) {
      value = null;
    }

    if (BOOLEAN_FIELDS.has(formKey)) {
      value =
        value === true ||
        value === 'true';
    }

    fields[column] = value;
  }

  return fields;
}


// ============================================================
// Link Analysis: Selfie request generator
// ============================================================

function hashSelfieToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function safeReference(value) {
  return String(value || '').trim().slice(0, 120);
}

router.post('/admin/selfie-requests', adminAuth, async (req, res) => {
  try {
    const reference = safeReference(req.body?.reference) || 'guest';
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashSelfieToken(token);

    let caseData = null;
    if (reference !== 'guest') {
      caseData = await Case.findByCaseId(reference);
      if (!caseData) {
        const matches = await Case.searchAll({ search: reference });
        const normalized = reference.toLowerCase();
        caseData = (matches || []).find((item) =>
          String(item?.case_id || '').trim().toLowerCase() === normalized
        ) || null;
      }
      if (!caseData) {
        return res.status(404).json({
          success:false,
          error:'Case ID not found. Enter the exact Case ID shown in the admin Case Lookup & Search.'
        });
      }
    }

    const { data, error } = await supabase
      .from('recovery_selfie_requests')
      .insert({
        request_token_hash: tokenHash,
        case_id: caseData ? caseData.case_id : null,
        reference,
        created_by: req.user.id
      })
      .select('id,reference,status,expires_at,created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ success:true, request:{...data, token} });
  } catch (error) {
    console.error('Selfie request generation error:', error);
    return res.status(500).json({ success:false, error:'Could not generate selfie request.' });
  }
});

router.get('/selfie-request/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{32,120}$/.test(token)) {
      return res.status(400).json({ success:false, error:'Invalid request.' });
    }

    const { data, error } = await supabase
      .from('recovery_selfie_requests')
      .select('id,reference,status,expires_at,created_at')
      .eq('request_token_hash', hashSelfieToken(token))
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success:false, error:'Selfie request not found.' });

    if (data.status !== 'active' || new Date(data.expires_at).getTime() <= Date.now()) {
      return res.status(410).json({ success:false, error:'This selfie request has expired or is no longer active.' });
    }

    return res.json({ success:true, request:data });
  } catch (error) {
    console.error('Selfie request lookup error:', error);
    return res.status(500).json({ success:false, error:'Could not load selfie request.' });
  }
});

const selfieUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, parts: 4 }
});

router.post('/selfie-request/:token/upload', selfieUpload.single('file'), async (req, res) => {
  let claimed = null;
  let uploadedPath = null;
  try {
    const token = String(req.params.token || '');
    if (!req.file) return res.status(400).json({ success:false, error:'Selfie image is required.' });
    if (!['image/jpeg','image/png'].includes(String(req.file.mimetype || '').toLowerCase())) {
      return res.status(400).json({ success:false, error:'Only JPEG or PNG selfies are accepted.' });
    }
    validateEvidenceSignature(req.file);
    rejectSuspiciousBinary(req.file);

    const tokenHash = hashSelfieToken(token);
    const { data: request, error: requestError } = await supabase
      .from('recovery_selfie_requests')
      .select('*')
      .eq('request_token_hash', tokenHash)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (requestError) throw requestError;
    if (!request) return res.status(410).json({ success:false, error:'This selfie request is expired or already used.' });
    if (!request.case_id) return res.status(400).json({ success:false, error:'This request is not linked to a case.' });

    const now = new Date().toISOString();
    const { data: lock, error: lockError } = await supabase
      .from('recovery_selfie_requests')
      .update({ status:'used', used_at:now, captured_at:now })
      .eq('id', request.id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();

    if (lockError) throw lockError;
    if (!lock) return res.status(409).json({ success:false, error:'This selfie request was already used.' });
    claimed = request;

    const extension = String(req.file.mimetype).toLowerCase() === 'image/png' ? 'png' : 'jpg';
    const filename = `selfie-${now.replace(/[:.]/g,'-')}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
    uploadedPath = `selfies/${encodeURIComponent(request.reference).replace(/%/g,'_')}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(uploadedPath, req.file.buffer, { contentType:req.file.mimetype, upsert:false });

    if (uploadError) throw uploadError;

    const existing = await Case.findByCaseId(request.case_id);
    if (!existing) throw new Error('The linked case no longer exists.');

    let captureMetadata = {};
    try {
      const rawMetadata = String(req.body?.metadata || '').trim();
      if (rawMetadata) {
        const parsed = JSON.parse(rawMetadata);
        const latitude = Number(parsed?.location?.latitude);
        const longitude = Number(parsed?.location?.longitude);
        const accuracy = Number(parsed?.location?.accuracy);
        if (Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
            Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) {
          captureMetadata.location = {
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
            accuracyMeters: Number.isFinite(accuracy) && accuracy >= 0 ? Number(accuracy.toFixed(1)) : null,
            source: 'browser-geolocation',
          };
        }
        if (parsed?.clientCapturedAt) {
          const clientDate = new Date(parsed.clientCapturedAt);
          if (!Number.isNaN(clientDate.getTime())) {
            captureMetadata.clientCapturedAt = clientDate.toISOString();
          }
        }
        if (typeof parsed?.timezone === 'string') {
          captureMetadata.timezone = parsed.timezone.slice(0, 80);
        }
      }
    } catch (_) {
      // Metadata is optional; the server timestamp below remains authoritative.
    }

    const fileMeta = {
      path: uploadedPath,
      filename,
      originalName: filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: 'link-analysis-selfie',
      uploadedAt: now,
      evidenceType: 'selfie',
      source: 'Link Analysis Selfie Request',
      requestId: request.id,
      requestReference: request.reference,
      description: `Selfie captured through authorized Manlung Recovery Link Analysis request for case ${request.case_id}.`,
      capturedAt: now,
      captureMetadata,
      status: 'pending review'
    };

    const files = Array.isArray(existing.files) ? [...existing.files, fileMeta] : [fileMeta];
    await Case.update(request.case_id, { files, last_updated: now });

    return res.json({ success:true, message:'Selfie uploaded successfully.', evidence:{caseId:request.case_id, requestId:request.id, filename} });
  } catch (error) {
    console.error('Selfie upload error:', error);
    if (uploadedPath) {
      await supabase.storage.from(EVIDENCE_BUCKET).remove([uploadedPath]).catch(()=>{});
    }
    if (claimed?.id) {
      await supabase.from('recovery_selfie_requests').update({status:'active',used_at:null,captured_at:null}).eq('id',claimed.id).eq('status','used').catch(()=>{});
    }
    return res.status(500).json({ success:false, error:'Selfie upload failed. Please try again.' });
  }
});

// ============================================================
// Client: Submit New Case
// ============================================================

router.post(
  '/submit',

  upload.array('files', 20),

  [
    body('clientName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ max: 200 }),

    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required')
      .isLength({ max: 40 }),

    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email is required'),

    body('caseType')
      .trim()
      .notEmpty()
      .withMessage('Case type is required'),

    body('incidentDesc')
      .trim()
      .notEmpty()
      .withMessage(
        'Incident description is required'
      )
      .isLength({ max: 5000 }),
  ],

  rejectInvalidCaseBeforeAuth,

  auth,

  async (req, res) => {
    if (req.user.role !== 'client') {
      return res.status(403).json({
        error: 'Client access required',
      });
    }

    try {
      const caseFields =
        mapBodyToCaseFields(req.body);

      // Every submitted case is permanently tied to the authenticated
      // client account. The case ID is only an identifier, never a password.
      caseFields.client_user_id = req.user.id;
      caseFields.email = req.user.email;
      caseFields.client_name =
        req.user.username ||
        caseFields.client_name;

      const uploadedFiles = [];

      for (const file of req.files || []) {
        uploadedFiles.push(
          await uploadToStorage(
            file,
            'evidence',
            'client'
          )
        );
      }

      caseFields.files = uploadedFiles;

      const newCase =
        await Case.create(caseFields);

      const message = `
📌 <b>New Recovery Request</b>

🔹 <b>Case ID:</b> ${newCase.case_id}
👤 <b>Client:</b> ${newCase.client_name}
📱 <b>Phone:</b> ${newCase.phone}
📧 <b>Email:</b> ${newCase.email}
📂 <b>Type:</b> ${newCase.case_type}
⚡ <b>Priority:</b> ${newCase.priority}

📝 <b>Description:</b>
${(newCase.incident_desc || '').substring(
  0,
  200
)}

🔗 <b>Status:</b> Pending Review
`;

      try {
        await sendTelegramMessage(message);
      } catch (telegramError) {
        console.error('New case Telegram notification failed:', telegramError);
      }

      res.status(201).json({
        success: true,
        case: serializeCase(
          await withSignedFileUrls(
            newCase
          )
        ),
      });
    } catch (error) {
      console.error(
        'Submit error:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'Failed to submit case',
      });
    }
  }
);


// ============================================================
// Client: Get Own Cases
//
// IMPORTANT:
// This MUST come before /client/:email
// ============================================================

router.get(
  '/client/me',
  auth,
  async (req, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({
          error: 'Client access required',
        });
      }

      // First try the secure user ID.
      let cases =
        await Case.findByClientUserId(
          req.user.id
        );

      // Backward-compatible fallback
      // for older cases without client_user_id.
      if (
        !cases.length &&
        req.user.email
      ) {
        cases =
          await Case.findByEmail(
            req.user.email
          );
      }

      const serializedCases =
        await Promise.all(
          cases.map(async (c) => {
            const withUrls =
              await withSignedFileUrls(c);

            return serializeCase(
              withUrls
            );
          })
        );

      res.json({
        success: true,
        cases: serializedCases,
      });
    } catch (error) {
      console.error(
        'Get own client cases error:',
        error
      );

      res.status(500).json({
        error: 'Server error',
      });
    }
  }
);



// ============================================================
// Client: Delete Own Case
// ============================================================

router.delete(
  '/client/case/:caseId',
  auth,
  async (req, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({
          error: 'Client access required',
        });
      }

      const { caseId } = req.params;

      const existing = await Case.findByCaseId(caseId);

      if (!existing) {
        return res.status(404).json({
          error: 'Case not found',
        });
      }

      if (existing.client_user_id !== req.user.id) {
        return res.status(403).json({
          error: 'You can only delete cases submitted from your own account.',
        });
      }

      const paths = [
        ...(Array.isArray(existing.files)
          ? existing.files
              .map(f => f?.path)
              .filter(Boolean)
          : [])
      ];

      if (paths.length) {
        const { error: storageError } =
          await supabase.storage
            .from(EVIDENCE_BUCKET)
            .remove(paths);

        if (storageError) {
          console.error(
            'Case evidence deletion failed:',
            storageError
          );

          return res.status(500).json({
            error:
              'The case could not be deleted because its files could not be removed.',
          });
        }
      }

      const deleted = await Case.removeForClient(
        caseId,
        req.user.id
      );

      if (!deleted) {
        return res.status(403).json({
          error: 'You can only delete your own cases.',
        });
      }

      return res.json({
        success: true,
        message: 'Case deleted successfully.',
      });
    } catch (error) {
      console.error(
        'Client case deletion error:',
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          'Could not delete the case.',
      });
    }
  }
);


// ============================================================
// Client: Get Cases By Email
//
// IMPORTANT:
// This MUST stay AFTER /client/me
// ============================================================

router.get(
  '/client/:email',
  auth,
  async (req, res) => {
    try {
      const { email } =
        req.params;

      // A client can only access
      // their own email.
      if (
        req.user.role === 'client' &&
        req.user.email !== email
      ) {
        return res.status(403).json({
          error: 'Access denied',
        });
      }

      let cases;

      if (
        req.user.role === 'client'
      ) {
        // First use authenticated user ID.
        cases =
          await Case.findByClientUserId(
            req.user.id
          );

        // Fallback for older cases.
        if (
          !cases.length &&
          req.user.email
        ) {
          cases =
            await Case.findByEmail(
              req.user.email
            );
        }
      } else if (
        req.user.role === 'admin' ||
        req.user.role === 'owner'
      ) {
        // Only Admin/Owner may search
        // cases by another email address.
        cases =
          await Case.findByEmail(
            email
          );
      } else {
        return res.status(403).json({
          error: 'Access denied',
        });
      }

      const serializedCases =
        await Promise.all(
          cases.map(async (c) => {
            const withUrls =
              await withSignedFileUrls(c);

            return serializeCase(
              withUrls
            );
          })
        );

      res.json({
        success: true,
        cases: serializedCases,
      });
    } catch (error) {
      console.error(
        'Get client cases error:',
        error
      );

      res.status(500).json({
        error: 'Server error',
      });
    }
  }
);


// ============================================================
// Track Case By Case ID
// ============================================================

router.get(
  '/track/:caseId',
  auth,
  async (req, res) => {
    try {
      const caseData =
        await Case.findByCaseId(
          req.params.caseId
        );

      if (!caseData) {
        return res.status(404).json({
          error: 'Case not found',
        });
      }

      // Case IDs are never authorization credentials. Clients may only
      // access cases owned by their authenticated account; admins/owners
      // retain authorized administrative access.
      if (req.user.role === 'client') {
        const owned =
          caseData.client_user_id ===
            req.user.id ||
          (
            !caseData.client_user_id &&
            caseData.email ===
              req.user.email
          );

        if (!owned) {
          return res.status(404).json({
            error: 'Case not found',
          });
        }
      }

      const withUrls =
        await withSignedFileUrls(
          caseData
        );

      res.json({
        success: true,

        case: {
          caseId: withUrls.case_id,
          caseType: withUrls.case_type,
          status: withUrls.status,
          timeline: withUrls.timeline,
          investigator:
            withUrls.investigator,
          publicNotes:
            withUrls.public_notes,
          recoveryLoc:
            withUrls.recovery_loc,
          lastUpdated:
            withUrls.last_updated,
          files: withUrls.files || [],
        },
      });
    } catch (error) {
      console.error(
        'Track error:',
        error
      );

      res.status(500).json({
        error: 'Server error',
      });
    }
  }
);


// ============================================================
// Admin: Get All Cases
// ============================================================

router.get(
  '/admin/all',
  adminAuth,
  async (req, res) => {
    try {
      const {
        search,
        category,
        status,
        progress,
        unread,
        investigator,
        page = 1,
        limit = 20,
      } = req.query;

      const {
        cases,
        total,
      } = await Case.search({
        search,
        category,
        status,
        progress,
        unread,
        investigator,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      res.json({
        success: true,

        cases: cases.map((c) =>
          serializeCase(c, {
            includeInternal: true,
          })
        ),

        total,
        page: parseInt(page),

        totalPages:
          Math.ceil(
            total / parseInt(limit)
          ),
      });
    } catch (error) {
      console.error(
        'Admin get cases error:',
        error
      );

      res.status(500).json({
        error: 'Server error',
      });
    }
  }
);


// ============================================================
// Admin: Export Cases CSV
// ============================================================

router.get(
  '/admin/export',
  adminAuth,
  async (req, res) => {
    try {
      const {
        search,
        category,
        status,
        progress,
        unread,
        investigator,
      } = req.query;

      const cases =
        await Case.searchAll({
          search,
          category,
          status,
          progress,
          unread,
          investigator,
        });

      const columns = [
        'case_id',
        'client_name',
        'phone',
        'email',
        'case_type',
        'priority',
        'status',
        'investigator',
        'admin_read',
        'created_at',
        'last_updated',
      ];

      const escape = (v) => {
        if (
          v === null ||
          v === undefined
        ) {
          return '';
        }

        const s = String(v).replace(
          /"/g,
          '""'
        );

        return /[",\n]/.test(s)
          ? `"${s}"`
          : s;
      };

      const header =
        columns.join(',');

      const rows = cases.map(
        (c) =>
          columns
            .map((col) =>
              escape(c[col])
            )
            .join(',')
      );

      const csv = [
        header,
        ...rows,
      ].join('\n');

      res.setHeader(
        'Content-Type',
        'text/csv'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cases-export-${Date.now()}.csv"`
      );

      res.send(csv);
    } catch (error) {
      console.error(
        'Export error:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'Server error',
      });
    }
  }
);


// ============================================================
// Admin: Claim Case
// ============================================================

router.post(
  '/admin/case/:caseId/claim',
  adminAuth,
  async (req, res) => {
    try {
      const activeCount =
        await Case.countActiveByAdmin(
          req.user.id
        );

      if (activeCount >= 10) {
        return res.status(409).json({
          error:
            'You already have 10 active cases. Complete one before taking another case.',
          activeCount,
          maxActiveCases: 10,
        });
      }

      const claimed =
        await Case.claim(
          req.params.caseId,
          req.user.id
        );

      res.json({
        success: true,

        case: serializeCase(
          claimed,
          {
            includeInternal: true,
          }
        ),
      });
    } catch (error) {
      const msg =
        String(
          error.message || ''
        );

      if (
        msg.includes(
          'ADMIN_ALREADY_HAS_ACTIVE_CASE'
        ) || msg.includes(
          'ADMIN_CASE_LIMIT_REACHED'
        )
      ) {
        return res.status(409).json({
          error:
            'You already have 10 active cases. Complete one before taking another case.',
        });
      }

      if (
        msg.includes(
          'CASE_ALREADY_CLAIMED_OR_UNAVAILABLE'
        )
      ) {
        return res.status(409).json({
          error:
            'This case has already been claimed or is no longer available.',
        });
      }

      console.error(
        'Claim case error:',
        error
      );

      res.status(500).json({
        error:
          'Could not claim case',
      });
    }
  }
);


// ============================================================
// Admin: Complete Case
// ============================================================

router.post(
  '/admin/case/:caseId/complete',

  adminAuth,

  [
    body('status').isIn(
      Case.FINISHED_STATUSES
    ),
  ],

  async (req, res) => {
    if (!checkValidation(req, res)) {
      return;
    }

    try {
      const completed =
        await Case.complete(
          req.params.caseId,
          req.user.id,
          req.body.status
        );

      res.json({
        success: true,

        case: serializeCase(
          completed,
          {
            includeInternal: true,
          }
        ),
      });
    } catch (error) {
      if (
        String(
          error.message || ''
        ).includes(
          'CASE_NOT_ASSIGNED_TO_ADMIN'
        )
      ) {
        return res.status(403).json({
          error:
            'You can only complete a case assigned to you.',
        });
      }

      console.error(
        'Complete case error:',
        error
      );

      res.status(500).json({
        error:
          'Could not complete case',
      });
    }
  }
);


// ============================================================
// Owner: Reassign Case
// ============================================================

router.post(
  '/owner/case/:caseId/reassign',

  ownerAuth,

  [
    body('adminId')
      .notEmpty(),
  ],

  async (req, res) => {
    if (!checkValidation(req, res)) {
      return;
    }

    try {
      const target =
        await Case.findByCaseId(
          req.params.caseId
        );

      if (!target) {
        return res.status(404).json({
          error: 'Case not found',
        });
      }

      const now =
        new Date().toISOString();

      const updated =
        await Case.update(
          req.params.caseId,
          {
            assigned_admin_id:
              req.body.adminId,

            assigned_at: now,

            started_at: now,

            status: 'Accepted',
          }
        );

      res.json({
        success: true,

        case: serializeCase(
          updated,
          {
            includeInternal: true,
          }
        ),
      });
    } catch (error) {
      console.error(
        'Reassign case error:',
        error
      );

      res.status(500).json({
        error:
          'Could not reassign case',
      });
    }
  }
);


// ============================================================
// Admin: Get Single Case
// ============================================================

router.get(
  '/admin/case/:caseId',
  adminAuth,
  async (req, res) => {
    try {
      let caseData =
        await Case.findByCaseId(
          req.params.caseId
        );

      if (!caseData) {
        return res.status(404).json({
          error: 'Case not found',
        });
      }

      if (!caseData.admin_read) {
        caseData =
          await Case.update(
            req.params.caseId,
            {
              admin_read: true,
            }
          );
      }

      res.json({
        success: true,

        case: serializeCase(
          await withSignedFileUrls(
            caseData
          ),
          {
            includeInternal: true,
          }
        ),
      });
    } catch (error) {
      console.error(
        'Admin get case error:',
        error
      );

      res.status(500).json({
        error: 'Server error',
      });
    }
  }
);


// ============================================================
// Build Update Fields + Audit History
// ============================================================

function buildUpdateFields(
  existing,
  updates,
  adminUsername
) {
  const fields = {};
  const changes = {};

  if (
    updates.status !== undefined &&
    updates.status !== existing.status
  ) {
    fields.status =
      updates.status;

    changes.status = {
      from: existing.status,
      to: updates.status,
    };
  }

  if (
    updates.investigator !==
      undefined &&
    updates.investigator !==
      existing.investigator
  ) {
    fields.investigator =
      updates.investigator;

    changes.investigator = {
      from:
        existing.investigator,
      to:
        updates.investigator,
    };
  }

  if (
    updates.recoveryLoc !==
      undefined &&
    updates.recoveryLoc !==
      existing.recovery_loc
  ) {
    fields.recovery_loc =
      updates.recoveryLoc;

    changes.recoveryLoc = true;
  }

  if (
    updates.publicNotes !==
      undefined &&
    updates.publicNotes !==
      existing.public_notes
  ) {
    fields.public_notes =
      updates.publicNotes;

    changes.publicNotes = true;
  }

  if (
    updates.internalNotes !==
      undefined &&
    updates.internalNotes !==
      existing.internal_notes
  ) {
    fields.internal_notes =
      updates.internalNotes;

    changes.internalNotes = true;
  }

  if (fields.status) {
    const now =
      new Date().toLocaleString();

    fields.timeline =
      (
        existing.timeline ||
        'Request Submitted ✅'
      ) +
      `\n[${now}] Status updated to: ${fields.status}`;
  }

  if (
    Object.keys(changes).length > 0
  ) {
    fields.admin_history = [
      ...(existing.admin_history ||
        []),

      {
        by: adminUsername,

        at:
          new Date().toISOString(),

        changes,
      },
    ];
  }

  fields.last_updated =
    new Date().toLocaleString();

  return fields;
}


// ============================================================
// Admin: Update Single Case
// ============================================================

router.put(
  '/admin/case/:caseId',
  adminAuth,
  async (req, res) => {
    try {
      const { caseId } =
        req.params;

      const existing =
        await Case.findByCaseId(
          caseId
        );

      if (!existing) {
        return res.status(404).json({
          error: 'Case not found',
        });
      }

      // Regular admin can only
      // modify cases assigned to them.
      if (
        req.user.role === 'admin' &&
        existing.assigned_admin_id !==
          req.user.id
      ) {
        return res.status(403).json({
          error:
            'Claim this case before modifying it.',
        });
      }

      // Completing a case goes through
      // the dedicated RPC.
      if (
        req.user.role === 'admin' &&
        Case.FINISHED_STATUSES.includes(
          req.body.status
        )
      ) {
        try {
          const completed =
            await Case.complete(
              caseId,
              req.user.id,
              req.body.status
            );

          await recordCaseUpdateEvents({
            existing,
            updated: completed,
            actorId: req.user.id,
            actorName: req.user.username,
            source: 'admin_complete',
          });

          return res.json({
            success: true,

            case: serializeCase(
              await withSignedFileUrls(
                completed
              ),
              {
                includeInternal: true,
              }
            ),
          });
        } catch (e) {
          return res.status(403).json({
            error:
              'You can only complete the active case assigned to you.',
          });
        }
      }

      // Admin cannot delete an existing
      // client-facing message.
      if (
        req.user.role === 'admin' &&
        req.body.publicNotes !==
          undefined &&
        existing.public_notes &&
        String(
          req.body.publicNotes
        ).trim() === ''
      ) {
        return res.status(403).json({
          error:
            'Only the Owner can delete client-facing messages.',
        });
      }

      const fields =
        buildUpdateFields(
          existing,
          req.body,
          req.user.username
        );

      const updated =
        await Case.update(
          caseId,
          fields
        );

      await recordCaseUpdateEvents({
        existing,
        updated,
        actorId: req.user.id,
        actorName: req.user.username,
        source: 'admin_update',
      });

      console.log(
        `📢 Case ${caseId} updated to: ${updated.status} by ${req.user.username}`
      );

      res.json({
        success: true,

        case: serializeCase(
          await withSignedFileUrls(
            updated
          ),
          {
            includeInternal: true,
          }
        ),
      });
    } catch (error) {
      console.error(
        'Update case error:',
        error
      );

      res.status(500).json({
        error: 'Server error',
      });
    }
  }
);


// ============================================================
// Admin: Bulk Update
// ============================================================

router.put(
  '/admin/bulk-update',

  adminAuth,

  [
    body('caseIds')
      .isArray({ min: 1 })
      .withMessage(
        'caseIds must be a non-empty array'
      ),

    body('status')
      .optional()
      .trim()
      .notEmpty(),

    body('investigator')
      .optional()
      .trim(),
  ],

  async (req, res) => {
    if (!checkValidation(req, res)) {
      return;
    }

    try {
      const {
        caseIds,
        status,
        investigator,
      } = req.body;

      const results = [];

      for (const caseId of caseIds) {
        const existing =
          await Case.findByCaseId(
            caseId
          );

        if (!existing) {
          continue;
        }

        const fields =
          buildUpdateFields(
            existing,
            {
              status,
              investigator,
            },
            req.user.username
          );

        const updated =
          await Case.update(
            caseId,
            fields
          );

        await recordCaseUpdateEvents({
          existing,
          updated,
          actorId: req.user.id,
          actorName: req.user.username,
          source: 'admin_bulk_update',
        });

        results.push(updated);
      }

      res.json({
        success: true,

        updated:
          results.length,

        cases: results.map((c) =>
          serializeCase(c, {
            includeInternal: true,
          })
        ),
      });
    } catch (error) {
      console.error(
        'Bulk update error:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'Server error',
      });
    }
  }
);


// ============================================================
// Admin: Upload Evidence
// ============================================================

router.post(
  '/admin/upload/:caseId',

  adminAuth,

  upload.single('file'),

  async (req, res) => {
    try {
      const { caseId } =
        req.params;

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
        });
      }

      const existing =
        await Case.findByCaseId(
          caseId
        );

      if (!existing) {
        return res.status(404).json({
          error: 'Case not found',
        });
      }

      if (
        req.user.role === 'admin' &&
        existing.assigned_admin_id !==
          req.user.id
      ) {
        return res.status(403).json({
          error:
            'Claim this case before uploading evidence.',
        });
      }

      const fileMeta =
        await uploadToStorage(
          req.file,
          'evidence',
          'admin'
        );

      const files = [
        ...(existing.files || []),
        fileMeta,
      ];

      await Case.update(
        caseId,
        {
          files,
        }
      );

      const {
        data,
        error,
      } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(
          fileMeta.path,
          SIGNED_URL_TTL
        );

      res.json({
        success: true,

        file: {
          ...fileMeta,

          url: error
            ? null
            : data.signedUrl,
        },
      });
    } catch (error) {
      console.error(
        'Upload error:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'Upload failed',
      });
    }
  }
);


// ============================================================
// Owner: Delete One Case Evidence File
// ============================================================

router.delete('/admin/case/:caseId/file', ownerAuth, async (req, res) => {
  try {
    const caseId = req.params.caseId;
    const requestedPath = String(req.body?.path || '').trim();
    if (!requestedPath) return res.status(400).json({ error: 'Evidence file path is required.' });
    const existing = await Case.findByCaseId(caseId);
    if (!existing) return res.status(404).json({ error: 'Case not found.' });
    const files = Array.isArray(existing.files) ? existing.files : [];
    const target = files.find((file) => file?.path === requestedPath);
    if (!target) return res.status(404).json({ error: 'Evidence file not found.' });
    const { error } = await supabase.storage.from(EVIDENCE_BUCKET).remove([requestedPath]);
    if (error) throw error;
    await Case.update(caseId, { files: files.filter((file) => file?.path !== requestedPath) });
    res.json({ success: true, message: 'Case evidence file deleted by Owner.' });
  } catch (error) {
    console.error('Delete case evidence file error:', error);
    res.status(500).json({ error: 'Could not delete the case evidence file.' });
  }
});


// ============================================================
// Admin/Owner: Delete Case
// ============================================================

router.delete(
  '/admin/case/:caseId',
  adminAuth,
  async (req, res) => {
    try {
      const { caseId } =
        req.params;

      const existing =
        await Case.findByCaseId(
          caseId
        );

      if (!existing) {
        return res.status(404).json({
          error: 'Case not found',
        });
      }

      if (req.user.role !== 'owner') {
        return res.status(403).json({
          error:
            'Only the Owner can delete cases.',
        });
      }

      const paths =
        (existing.files || [])
          .map((f) => f.path)
          .filter(Boolean);

      if (paths.length) {
        await supabase.storage
          .from(EVIDENCE_BUCKET)
          .remove(paths);
      }

      await Case.remove(caseId);

      res.json({
        success: true,

        message:
          'Case deleted successfully',
      });
    } catch (error) {
      console.error(
        'Delete case error:',
        error
      );

      res.status(500).json({
        error: 'Server error',
      });
    }
  }
);


// ============================================================
// Admin: Case Statistics
// ============================================================

router.get(
  '/admin/stats',
  adminAuth,
  async (req, res) => {
    try {
      const stats =
        await Case.stats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error(
        'Stats error:',
        error
      );

      res.status(500).json({
        error: 'Server error',
      });
    }
  }
);


// ============================================================
// Exports
// ============================================================

module.exports = router;

module.exports.mapBodyToCaseFields =
  mapBodyToCaseFields;

module.exports.serializeCase =
  serializeCase;

module.exports.FIELD_MAP =
  FIELD_MAP;
