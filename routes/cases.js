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

  const requestIds = [
    ...new Set(
      caseRow.files
        .map((file) => file?.requestId)
        .filter(Boolean)
        .map(String)
    ),
  ];

  const requestAdminMap = new Map();
  if (requestIds.length) {
    const { data: requests, error: requestError } = await supabase
      .from('recovery_selfie_requests')
      .select('id,created_by')
      .in('id', requestIds);

    if (requestError) throw requestError;

    const adminIds = [
      ...new Set(
        (requests || [])
          .map((request) => request.created_by)
          .filter(Boolean)
          .map(String)
      ),
    ];

    let adminMap = new Map();
    if (adminIds.length) {
      const { data: admins, error: adminError } = await supabase
        .from('recovery_users')
        .select('id,username,email,role')
        .in('id', adminIds);

      if (adminError) throw adminError;

      adminMap = new Map(
        (admins || []).map((admin) => [
          String(admin.id),
          {
            id: admin.id,
            name: admin.username || admin.email || 'Admin',
          },
        ])
      );
    }

    for (const request of requests || []) {
      const admin = request.created_by
        ? adminMap.get(String(request.created_by))
        : null;
      if (admin) requestAdminMap.set(String(request.id), admin);
    }
  }

  const files = await Promise.all(
    caseRow.files.map(async (f) => {
      let enriched = f;

      if (
        f?.requestId &&
        !f?.captureMetadata?.requestedByAdmin &&
        requestAdminMap.has(String(f.requestId))
      ) {
        enriched = {
          ...f,
          captureMetadata: {
            ...(f.captureMetadata || {}),
            requestedByAdmin: requestAdminMap.get(String(f.requestId)),
          },
        };
      }

      if (!enriched.path) {
        return enriched;
      }

      const { data, error } =
        await supabase.storage
          .from(EVIDENCE_BUCKET)
          .createSignedUrl(
            enriched.path,
            SIGNED_URL_TTL
          );

      return {
        ...enriched,
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
router.get('/selfie-request/:token/status', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{32,120}$/.test(token)) return res.status(400).json({ success:false, error:'Invalid request.' });
    const { data: request, error: requestError } = await supabase.from('recovery_selfie_requests').select('id,case_id,status,expires_at').eq('request_token_hash', hashSelfieToken(token)).maybeSingle();
    if (requestError) throw requestError;
    if (!request) return res.status(404).json({ success:false, error:'Selfie request not found.' });
    let count = 0;
    if (request.case_id) {
      const caseData = await Case.findByCaseId(request.case_id);
      const files = Array.isArray(caseData?.files) ? caseData.files : [];
      count = files.filter((file) => file?.requestId === request.id && file?.evidenceType === 'video-verification').length;
    }
    return res.json({ success:true, status:request.status, count, complete:count === 4 });
  } catch (error) {
    console.error('Selfie request status error:', error);
    return res.status(500).json({ success:false, error:'Could not check verification status.' });
  }
});


const selfieUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4, parts: 8 }
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

    let requestAdmin = null;
    if (request.created_by) {
      const { data: adminUser, error: adminUserError } = await supabase
        .from('recovery_users')
        .select('id,username,email,role')
        .eq('id', request.created_by)
        .maybeSingle();
      if (adminUserError) throw adminUserError;
      requestAdmin = adminUser || null;
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
      captureMetadata: {
        ...captureMetadata,
        requestedByAdmin: requestAdmin ? {
          id: requestAdmin.id,
          name: requestAdmin.username || requestAdmin.email || 'Admin',
        } : null,
      },
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


// Capture four verification images in one authorized request.
router.post('/selfie-request/:token/upload-batch', selfieUpload.array('files', 4), async (req, res) => {
  let claimed = null;
  const uploadedPaths = [];
  try {
    const token = String(req.params.token || '');
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length !== 4) return res.status(400).json({ success:false, error:'Exactly four verification images are required.' });

    for (const file of files) {
      if (!['image/jpeg','image/png'].includes(String(file.mimetype || '').toLowerCase())) {
        return res.status(400).json({ success:false, error:'Only JPEG or PNG verification images are accepted.' });
      }
      validateEvidenceSignature(file);
      rejectSuspiciousBinary(file);
    }

    const tokenHash = hashSelfieToken(token);
    const { data: request, error: requestError } = await supabase
      .from('recovery_selfie_requests')
      .select('*')
      .eq('request_token_hash', tokenHash)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (requestError) throw requestError;
    if (!request) return res.status(410).json({ success:false, error:'This verification request is expired or already used.' });
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
    if (!lock) return res.status(409).json({ success:false, error:'This verification request was already used.' });
    claimed = request;

    const existing = await Case.findByCaseId(request.case_id);
    if (!existing) throw new Error('The linked case no longer exists.');

    let requestAdmin = null;
    if (request.created_by) {
      const { data: adminUser, error: adminUserError } = await supabase
        .from('recovery_users')
        .select('id,username,email,role')
        .eq('id', request.created_by)
        .maybeSingle();
      if (adminUserError) throw adminUserError;
      requestAdmin = adminUser || null;
    }

    let rawMetadata = {};
    try { rawMetadata = JSON.parse(String(req.body?.metadata || '{}')); } catch (_) {}

    let captureMetadata = {};
    const latitude = Number(rawMetadata?.location?.latitude);
    const longitude = Number(rawMetadata?.location?.longitude);
    const accuracy = Number(rawMetadata?.location?.accuracy);
    if (Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
        Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) {
      captureMetadata.location = {
        latitude:Number(latitude.toFixed(6)),
        longitude:Number(longitude.toFixed(6)),
        accuracyMeters:Number.isFinite(accuracy) && accuracy >= 0 ? Number(accuracy.toFixed(1)) : null,
        source:'browser-geolocation'
      };
    }
    if (rawMetadata?.clientCapturedAt) {
      const clientDate = new Date(rawMetadata.clientCapturedAt);
      if (!Number.isNaN(clientDate.getTime())) captureMetadata.clientCapturedAt = clientDate.toISOString();
    }
    if (typeof rawMetadata?.timezone === 'string') captureMetadata.timezone = rawMetadata.timezone.slice(0,80);
    if (rawMetadata?.device && typeof rawMetadata.device === 'object') {
      const device = rawMetadata.device;
      captureMetadata.device = {
        deviceType: typeof device.deviceType === 'string' ? device.deviceType.slice(0,40) : 'unknown',
        platform: typeof device.platform === 'string' ? device.platform.slice(0,80) : '',
        browser: typeof device.browser === 'string' ? device.browser.slice(0,40) : '',
        model: typeof device.model === 'string' ? device.model.slice(0,80) : '',
        imei: typeof device.imei === 'string' ? device.imei.slice(0,40) : '',
      };
    }
    captureMetadata.totalCaptures = 4;

    const newEvidence = [];
    for (let i=0;i<files.length;i++) {
      const file = files[i];
      const extension = String(file.mimetype).toLowerCase() === 'image/png' ? 'png' : 'jpg';
      const filename = `video-verification-${i+1}-${now.replace(/[:.]/g,'-')}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
      const uploadedPath = `selfies/${encodeURIComponent(request.reference).replace(/%/g,'_')}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(uploadedPath, file.buffer, { contentType:file.mimetype, upsert:false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(uploadedPath);

      newEvidence.push({
        path:uploadedPath, filename, originalName:filename, size:file.size, mimetype:file.mimetype,
        uploadedBy:'link-analysis-video-verification', uploadedAt:now,
        evidenceType:'video-verification', source:'Link Analysis Video Verification',
        requestId:request.id, requestReference:request.reference,
        description:`Verification image ${i+1} of 4 captured through the authorized Manlung Recovery link for case ${request.case_id}.`,
        capturedAt:now, captureMetadata:{
          ...captureMetadata,
          captureNumber:i+1,
          requestedByAdmin: requestAdmin ? {
            id: requestAdmin.id,
            name: requestAdmin.username || requestAdmin.email || 'Admin',
          } : null,
        },
        status:'pending review'
      });
    }

    const filesForCase = Array.isArray(existing.files) ? [...existing.files, ...newEvidence] : newEvidence;
    await Case.update(request.case_id, { files:filesForCase, last_updated:now });
    return res.json({success:true,message:'Four verification images uploaded successfully.',evidence:{caseId:request.case_id,requestId:request.id,count:newEvidence.length}});
  } catch (error) {
    console.error('Video verification batch upload error:', error);
    if (uploadedPaths.length) await supabase.storage.from(EVIDENCE_BUCKET).remove(uploadedPaths).catch(()=>{});
    if (claimed?.id) await supabase.from('recovery_selfie_requests').update({status:'active',used_at:null,captured_at:null}).eq('id',claimed.id).eq('status','used').catch(()=>{});
    return res.status(500).json({success:false,error:'Video verification upload failed. Please try again.'});
  }
});

// ============================================================
// Owner: Delete a single evidence file
// ============================================================

router.delete('/admin/evidence/:caseId', ownerAuth, async (req, res) => {
  try {
    const caseId = String(req.params.caseId || '').trim();
    const requestedPath = String(req.body?.path || '').trim();

    if (!caseId || !requestedPath) {
      return res.status(400).json({ success:false, error:'Case ID and evidence path are required.' });
    }

    const existing = await Case.findByCaseId(caseId);
    if (!existing) return res.status(404).json({ success:false, error:'Case not found.' });

    const files = Array.isArray(existing.files) ? existing.files : [];
    const index = files.findIndex((file) => String(file?.path || '') === requestedPath);
    if (index === -1) return res.status(404).json({ success:false, error:'Evidence file not found on this case.' });

    const file = files[index];

    const { error: storageError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .remove([requestedPath]);

    if (storageError) {
      console.error('Evidence storage delete error:', storageError);
      return res.status(500).json({ success:false, error:'Could not delete the evidence file from storage.' });
    }

    const updatedFiles = files.filter((_, fileIndex) => fileIndex !== index);
    const now = new Date().toISOString();

    await Case.update(caseId, { files:updatedFiles, last_updated:now });

    try {
      await CaseTimeline.create({
        caseId,
        actorUserId:req.user.id,
        eventType:'evidence_deleted',
        description:`Evidence file "${String(file?.filename || file?.originalName || 'evidence')}" was deleted by the owner.`,
        metadata:{
          actorName:req.user.name || req.user.email || null,
          path:requestedPath,
          evidenceType:file?.evidenceType || null,
          source:'recovery-evidence-owner-delete'
        }
      });
    } catch (timelineError) {
      console.error('Evidence deletion timeline event failed:', timelineError);
    }

    return res.json({
      success:true,
      message:'Evidence file deleted successfully.',
      caseId,
      deletedPath:requestedPath,
      remainingFiles:updatedFiles.length
    });
  } catch (error) {
    console.error('Owner evidence delete error:', error);
    return res.status(500).json({ success:false, error:'Could not delete the evidence file.' });
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




router.post('/admin/device-recovery/cases', adminAuth, async (req, res) => {
  try {
    const platform = String(req.body?.platform || '').trim().toLowerCase();
    const platformNames = {
      android: 'Android',
      iphone: 'iPhone / iPad',
      windows: 'Windows',
      mac: 'Mac',
    };
    if (!platformNames[platform]) {
      return res.status(400).json({ success:false, error:'Select a supported device platform.' });
    }

    const clientName = String(req.body?.clientName || '').trim().slice(0, 200);
    const phone = String(req.body?.phone || '').trim().slice(0, 40);
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
    const manufacturer = String(req.body?.manufacturer || '').trim().slice(0, 120);
    const model = String(req.body?.model || '').trim().slice(0, 120);
    const deviceName = String(req.body?.deviceName || '').trim().slice(0, 120);
    const serial = String(req.body?.serial || '').trim().slice(0, 120);
    const imei = String(req.body?.imei || '').trim().slice(0, 40);
    const notes = String(req.body?.notes || '').trim().slice(0, 5000);

    if (!clientName || !phone || !email || !manufacturer || !model) {
      return res.status(400).json({
        success:false,
        error:'Client name, phone, email, manufacturer and model are required.',
      });
    }

    const caseTypeMap = {
      android: 'Lost Android Device Recovery',
      iphone: 'Lost iPhone / iPad Recovery',
      windows: 'Lost Windows Device Recovery',
      mac: 'Lost Mac Recovery',
    };

    const officialService = {
      android: 'Google Find Hub',
      iphone: 'Apple Find My',
      windows: 'Microsoft Find My Device',
      mac: 'Apple Find My',
    }[platform];

    const description = [
      'Authorized lost-device recovery case.',
      `Platform: ${platformNames[platform]}.`,
      `Manufacturer: ${manufacturer}.`,
      `Model: ${model}.`,
      deviceName ? `Device name: ${deviceName}.` : '',
      serial ? 'Serial number supplied and stored securely.' : '',
      imei ? 'IMEI supplied and stored securely.' : '',
      notes ? `Claimant notes: ${notes}` : '',
    ].filter(Boolean).join(' ');

    const now = new Date().toISOString();
    const caseFields = {
      client_name: clientName,
      phone,
      email,
      case_type: caseTypeMap[platform],
      priority: String(req.body?.priority || 'Normal').match(/^(Normal|Urgent|Emergency)$/)?.[1] || 'Normal',
      status: 'Pending Review',
      incident_desc: description,
      device_type: platformNames[platform],
      device_brand: manufacturer,
      device_model: model,
      serial: serial || null,
      imei1: imei || null,
      recovery_platform: platform,
      device_recovery_source: officialService,
      last_updated: now,
      assigned_admin_id: req.user.id,
      assigned_at: now,
      started_at: now,
    };

    const created = await Case.create(caseFields);

    try {
      await CaseTimeline.create({
        caseId: created.case_id,
        actorUserId: req.user.id,
        eventType: 'device_recovery_case_created',
        description: `Lost-device recovery case created and assigned to ${req.user.username || req.user.email || 'Admin'}.`,
        metadata: {
          actorName: req.user.username || req.user.email || 'Admin',
          actorRole: req.user.role,
          platform: platformNames[platform],
          officialService,
          source: 'device-recovery-admin',
        },
      });
    } catch (timelineError) {
      console.error('Device recovery creation timeline failed:', timelineError);
    }

    return res.status(201).json({
      success:true,
      case: serializeCase(created, { includeInternal:true }),
      assignedAdmin: {
        id: req.user.id,
        name: req.user.username || req.user.email || 'Admin',
        role: req.user.role,
      },
      officialService,
    });
  } catch (error) {
    console.error('Admin device recovery case creation error:', error);
    return res.status(500).json({ success:false, error:'Could not create the recovery case.' });
  }
});

router.post('/admin/device-recovery/case/:caseId/verify-ownership', adminAuth, async (req, res) => {
  try {
    const checks = req.body?.checks || {};
    const required = ['identity','purchase','device','authorization'];
    if (!required.every((key) => checks[key] === true)) {
      return res.status(400).json({ success:false, error:'All four ownership checks are required.' });
    }

    const existing = await Case.findByCaseId(req.params.caseId);
    if (!existing) return res.status(404).json({ success:false, error:'Case not found.' });

    if (req.user.role === 'admin' && existing.assigned_admin_id !== req.user.id) {
      return res.status(403).json({ success:false, error:'Claim this case before verifying ownership.' });
    }

    const now = new Date().toISOString();
    const updated = await Case.update(req.params.caseId, {
      ownership_verified_at: now,
      ownership_verified_by: req.user.id,
      status: existing.status === 'Pending Review' ? 'Accepted' : existing.status,
      last_updated: now,
    });

    await CaseTimeline.create({
      caseId: req.params.caseId,
      actorUserId: req.user.id,
      eventType: 'ownership_verified',
      description: `Ownership verification completed by ${req.user.username || req.user.email || 'Admin'}.`,
      metadata: {
        actorName: req.user.username || req.user.email || 'Admin',
        actorRole: req.user.role,
        checks: { identity:true, purchase:true, device:true, authorization:true },
        source: 'device-recovery-admin',
      },
    });

    return res.json({
      success:true,
      case: serializeCase(updated, { includeInternal:true }),
      verifiedBy: {
        id: req.user.id,
        name: req.user.username || req.user.email || 'Admin',
        role: req.user.role,
      },
      verifiedAt: now,
    });
  } catch (error) {
    console.error('Device ownership verification error:', error);
    return res.status(500).json({ success:false, error:'Could not record ownership verification.' });
  }
});


/*
 * Lost Device Recovery: live case feed.
 * This endpoint reads the existing recovery_cases records and resolves the
 * assigned actor from recovery_users. It never invents device status/location.
 */
router.get('/admin/device-recovery/cases', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);

    const { data: rows, error: caseError } = await supabase
      .from('recovery_cases')
      .select('*')
      .or('case_type.ilike.%Lost%,device_type.not.is.null')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (caseError) throw caseError;

    const adminIds = [
      ...new Set(
        (rows || [])
          .flatMap((row) => [row.assigned_admin_id, row.completed_by])
          .filter(Boolean)
          .map(String)
      ),
    ];

    let adminMap = new Map();
    if (adminIds.length) {
      const { data: admins, error: adminError } = await supabase
        .from('recovery_users')
        .select('id,username,email,role,admin_status')
        .in('id', adminIds);

      if (adminError) throw adminError;

      adminMap = new Map(
        (admins || []).map((admin) => [
          String(admin.id),
          {
            id: admin.id,
            name: admin.username || admin.email || 'Admin',
            role: admin.role,
            status: admin.admin_status || null,
          },
        ])
      );
    }

    const caseIds = (rows || []).map((row) => row.case_id).filter(Boolean);
    let locationMap = new Map();
    if (caseIds.length) {
      const { data: locations, error: locationError } = await supabase
        .from('recovery_device_locations')
        .select('id,case_id,latitude,longitude,accuracy_meters,source,reported_at,recorded_by')
        .in('case_id', caseIds)
        .order('reported_at', { ascending: false });
      if (locationError) throw locationError;
      for (const location of locations || []) {
        if (!locationMap.has(location.case_id)) locationMap.set(location.case_id, location);
      }
    }

    const cases = (rows || []).map((row) => {
      const assigned = row.assigned_admin_id
        ? adminMap.get(String(row.assigned_admin_id)) || null
        : null;
      const completed = row.completed_by
        ? adminMap.get(String(row.completed_by)) || null
        : null;

      return {
        caseId: row.case_id,
        clientName: row.client_name,
        caseType: row.case_type,
        status: row.status,
        priority: row.priority,
        recoveryPlatform: row.recovery_platform || null,
        deviceType: row.device_type,
        deviceBrand: row.device_brand,
        deviceModel: row.device_model,
        serial: row.serial ? String(row.serial).slice(0, 3) + '••••••' : null,
        assignedAdmin: assigned,
        completedBy: completed,
        investigator: row.investigator || null,
        createdAt: row.created_at,
        updatedAt: row.last_updated || row.created_at,
        assignedAt: row.assigned_at || null,
        startedAt: row.started_at || null,
        completedAt: row.completed_at || null,
        timeline: row.timeline || '',
        ownershipVerifiedAt: row.ownership_verified_at || null,
        ownershipVerifiedBy: row.ownership_verified_by ? (adminMap.get(String(row.ownership_verified_by)) || null) : null,
        latestLocation: locationMap.get(row.case_id) || null,
      };
    });

    const byAdmin = {};
    for (const item of cases) {
      const key = item.assignedAdmin?.id || 'unassigned';
      if (!byAdmin[key]) {
        byAdmin[key] = {
          admin: item.assignedAdmin,
          total: 0,
          active: 0,
          completed: 0,
        };
      }
      byAdmin[key].total += 1;
      if (Case.FINISHED_STATUSES.includes(item.status)) {
        byAdmin[key].completed += 1;
      } else {
        byAdmin[key].active += 1;
      }
    }

    return res.json({
      success: true,
      serverTime: new Date().toISOString(),
      cases,
      byAdmin: Object.values(byAdmin),
    });
  } catch (error) {
    console.error('Lost Device Recovery live feed error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not load the live recovery case feed.',
    });
  }
});


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
// Admin: Case Communications & Activity
// ============================================================

router.get(
  '/admin/case/:caseId/activity',
  adminAuth,
  async (req, res) => {
    try {
      const caseId = String(req.params.caseId || '').trim();
      const caseData = await Case.findByCaseId(caseId);
      if (!caseData) return res.status(404).json({ success:false, error:'Case not found' });

      const [timelineResult, notificationResult, callResult, messageResult] = await Promise.all([
        supabase.from('case_timeline').select('*').eq('case_id', caseId).order('created_at', { ascending:false }).limit(100),
        supabase.from('notifications').select('*').eq('case_id', caseId).order('created_at', { ascending:false }).limit(100),
        supabase.from('recovery_call_sessions').select('id,client_user_id,client_name,client_email,case_id,admin_user_id,status,created_at,ringing_started_at,accepted_at,ended_at,end_reason,network_quality,reconnect_count,last_network_event').eq('case_id', caseId).order('created_at', { ascending:false }).limit(100),
        supabase.from('case_messages').select('id,case_id,sender_user_id,recipient_user_id,message,read_at,created_at').eq('case_id', caseId).order('created_at', { ascending:false }).limit(100),
      ]);
      for (const result of [timelineResult, notificationResult, callResult, messageResult]) if (result.error) throw result.error;

      const timeline = timelineResult.data || [];
      const notifications = notificationResult.data || [];
      const calls = callResult.data || [];
      const messages = messageResult.data || [];

      const ids=[...new Set([
        ...notifications.map(x=>x.user_id),...calls.map(x=>x.admin_user_id),...calls.map(x=>x.client_user_id),
        ...messages.map(x=>x.sender_user_id),...messages.map(x=>x.recipient_user_id),...timeline.map(x=>x.actor_user_id)
      ].filter(Boolean).map(String))];

      let userMap=new Map();
      if(ids.length){
        const {data:users,error}=await supabase.from('recovery_users').select('id,username,email,role').in('id',ids);
        if(error) throw error;
        userMap=new Map((users||[]).map(u=>[String(u.id),u.username||u.email||'User']));
      }

      const channel=(type)=>{
        const t=String(type||'').toLowerCase();
        if(t.includes('call')) return 'call';
        if(t.includes('whatsapp')) return 'whatsapp';
        if(t.includes('sms')||t.includes('text')) return 'sms';
        if(t.includes('message')) return 'message';
        return 'notification';
      };

      const items=[
        ...timeline.map(x=>({id:`timeline-${x.id}`,kind:'timeline',channel:String(x.event_type||'').includes('message')?'message':'activity',title:String(x.event_type||'case activity').replace(/_/g,' '),message:x.description,createdAt:x.created_at,read:true,actorName:x.metadata?.actorName||userMap.get(String(x.actor_user_id))||'System',eventType:x.event_type})),
        ...notifications.map(x=>({id:`notification-${x.id}`,kind:'notification',channel:channel(x.type),title:x.title||'Notification',message:x.message||'',createdAt:x.created_at,read:Boolean(x.read_at),readAt:x.read_at||null,recipientName:userMap.get(String(x.user_id))||'Recipient',eventType:x.type})),
        ...calls.map(x=>({id:`call-${x.id}`,kind:'call',channel:'call',title:x.status==='ringing'?'Call ringing':'Call activity',message:[x.admin_user_id?`Admin: ${userMap.get(String(x.admin_user_id))||'Admin'}`:null,x.client_user_id?`Client: ${userMap.get(String(x.client_user_id))||x.client_name||'Client'}`:null,x.status?`Status: ${x.status}`:null,x.end_reason?`End: ${x.end_reason}`:null].filter(Boolean).join(' · '),createdAt:x.created_at||x.ringing_started_at,read:Boolean(caseData.admin_read),readAt:caseData.admin_read?(caseData.last_updated||null):null,eventType:'call'})),
        ...messages.map(x=>({id:`message-${x.id}`,kind:'message',channel:'message',title:'Case message',message:x.message||'',createdAt:x.created_at,read:Boolean(x.read_at),readAt:x.read_at||null,senderName:userMap.get(String(x.sender_user_id))||'User',recipientName:userMap.get(String(x.recipient_user_id))||'User',eventType:'message'}))
      ].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));

      const unread=items.filter(x=>x.kind!=='timeline'&&!x.read).length;
      const counts=items.reduce((a,x)=>(a[x.channel]=(a[x.channel]||0)+1,a),{});
      res.json({success:true,caseId,caseRead:Boolean(caseData.admin_read),unread,counts,items});
    } catch(error) {
      console.error('Admin case activity error:',error);
      res.status(500).json({success:false,error:'Could not load case communications.'});
    }
  }
);


// ============================================================
// Admin: Mark Case Communications Read
// ============================================================

router.post('/admin/case/:caseId/activity/read', adminAuth, async (req, res) => {
  try {
    const caseId = String(req.params.caseId || '').trim();
    const caseData = await Case.findByCaseId(caseId);
    if (!caseData) return res.status(404).json({ success:false, error:'Case not found' });
    const now = new Date().toISOString();
    const all = req.body?.all === true;
    const kind = String(req.body?.kind || '').trim().toLowerCase();
    const itemId = String(req.body?.id || '').trim();
    if (all) {
      const n = await supabase.from('notifications').update({ read_at:now }).eq('case_id',caseId).eq('user_id',req.user.id).is('read_at',null);
      if (n.error) throw n.error;
      const m = await supabase.from('case_messages').update({ read_at:now }).eq('case_id',caseId).eq('recipient_user_id',req.user.id).is('read_at',null);
      if (m.error) throw m.error;
      await Case.update(caseId,{admin_read:true,last_updated:now});
      return res.json({success:true,markedAt:now});
    }
    const id = itemId.replace(/^notification-|^message-|^call-/,'');
    if (kind === 'notification') {
      const n = await supabase.from('notifications').update({read_at:now}).eq('id',id).eq('case_id',caseId).eq('user_id',req.user.id).is('read_at',null);
      if (n.error) throw n.error;
    } else if (kind === 'message') {
      const m = await supabase.from('case_messages').update({read_at:now}).eq('id',id).eq('case_id',caseId).eq('recipient_user_id',req.user.id).is('read_at',null);
      if (m.error) throw m.error;
    } else if (kind === 'call') {
      await Case.update(caseId,{admin_read:true,last_updated:now});
    } else {
      return res.status(400).json({success:false,error:'Unsupported activity item.'});
    }
    return res.json({success:true,markedAt:now});
  } catch (error) {
    console.error('Admin mark case activity read error:',error);
    return res.status(500).json({success:false,error:'Could not mark activity as read.'});
  }
});

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

      const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentActivity, error: recentError } = await supabase
        .from('recovery_cases')
        .select('id', { count: 'exact', head: true })
        .gte('last_updated', recentSince);

      if (recentError) throw recentError;
      stats.recent = recentActivity || 0;

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
