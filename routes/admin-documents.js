const express = require('express');
const axios = require('axios');
const { adminAuth } = require('../middleware/auth');
const { supabase } = require('../config/supabase');

const router = express.Router();
const DOCS = 'admin_documents';
const SHARES = 'admin_document_shares';

function cleanText(value, max = 100000) {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, max);
}
function sanitizeDocumentHtml(value, max = 100000) {
  let html = cleanText(value, max);
  html = html.replace(/<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|svg|math)[^>]*>/gi, '');
  html = html.replace(/<!--([\\s\\S]*?)-->/g, '');
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi, '');
  html = html.replace(/\s+(href|src)\s*=\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi, '');
  html = html.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi, '');
  const allowed = new Set(['p','br','div','h1','h2','h3','strong','b','em','i','u','s','ul','ol','li','blockquote','font']);
  html = html.replace(/<\\/?([a-z0-9]+)([^>]*)>/gi, (full, tag, attrs) => {
    const name = String(tag).toLowerCase();
    if (!allowed.has(name)) return '';
    if (full.startsWith('</')) return '</' + name + '>';
    if (name === 'br') return '<br>';
    if (name === 'font') {
      const face = String(attrs).match(/\\bface\\s*=\\s*["']([^"']{1,80})["']/i);
      const size = String(attrs).match(/\\bsize\\s*=\\s*["']([1-7])["']/i);
      return '<font' + (face ? ' face="' + face[1].replace(/["<>]/g,'') + '"' : '') + (size ? ' size="' + size[1] + '"' : '') + '>';
    }
    return '<' + name + '>';
  });
  return html;
}
function htmlToText(value) {
  return String(value || '')
    .replace(/<br\\s*\\/?>(?=.)/gi, '\\n')
    .replace(/<\\/(p|div|h1|h2|h3|li|blockquote)>/gi, '\\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim();
}
function isOwner(doc, user) {
  return String(doc.owner_user_id) === String(user.id);
}
async function getDocument(id) {
  const { data, error } = await supabase.from(DOCS).select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return data;
}
async function canView(doc, user) {
  if (!doc) return false;
  if (isOwner(doc, user)) return true;
  const { data, error } = await supabase.from(SHARES).select('id,permission,expires_at').eq('document_id', doc.id).eq('recipient_user_id', user.id).is('revoked_at', null).maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return !data.expires_at || new Date(data.expires_at) > new Date();
}
function pdfEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function makePdf(title, content) {
  const rawLines = [title, '', ...htmlToText(content).split(/\r?\n/)];
  const lines = [];
  for (const raw of rawLines) {
    const line = String(raw);
    if (!line) { lines.push(''); continue; }
    for (let i = 0; i < line.length; i += 92) lines.push(line.slice(i, i + 92));
  }
  const pages = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  if (!pages.length) pages.push(['']);
  const objects = [];
  const add = s => { objects.push(s); return objects.length; };
  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageRefs = [];
  for (const pageLines of pages) {
    let stream = 'BT\n/F1 11 Tf\n50 760 Td\n';
    pageLines.forEach((line, idx) => {
      if (idx) stream += '0 -15 Td\n';
      stream += '(' + pdfEscape(line) + ') Tj\n';
    });
    stream += 'ET';
    const streamObj = add('<< /Length ' + Buffer.byteLength(stream, 'utf8') + ' >>\nstream\n' + stream + '\nendstream');
    const pageObj = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ' + font + ' 0 R >> >> /Contents ' + streamObj + ' 0 R >>');
    pageRefs.push(pageObj);
  }
  objects[pagesObj - 1] = '<< /Type /Pages /Kids [' + pageRefs.map(n => n + ' 0 R').join(' ') + '] /Count ' + pageRefs.length + ' >>';
  const chunks = ['%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'];
  const offsets = [0];
  let pos = Buffer.byteLength(chunks[0], 'binary');
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = pos;
    const obj = (i + 1) + ' 0 obj\n' + objects[i] + '\nendobj\n';
    chunks.push(obj);
    pos += Buffer.byteLength(obj, 'binary');
  }
  const xref = pos;
  chunks.push('xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n');
  for (let i = 1; i <= objects.length; i++) chunks.push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  chunks.push('trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalog + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return Buffer.from(chunks.join(''), 'binary');
}

router.use(adminAuth);

router.get('/', async (req, res) => {
  try {
    const { data: owned, error } = await supabase.from(DOCS).select('id,title,case_id,created_at,updated_at').eq('owner_user_id', req.user.id).is('deleted_at', null).order('updated_at', { ascending: false });
    if (error) throw error;
    const { data: shares, error: shareError } = await supabase.from(SHARES).select('document_id,permission,expires_at,created_at').eq('recipient_user_id', req.user.id).is('revoked_at', null);
    if (shareError) throw shareError;
    const sharedIds = (shares || []).filter(s => !s.expires_at || new Date(s.expires_at) > new Date()).map(s => s.document_id);
    let shared = [];
    if (sharedIds.length) {
      const result = await supabase.from(DOCS).select('id,title,case_id,owner_user_id,created_at,updated_at').in('id', sharedIds).is('deleted_at', null).order('updated_at', { ascending: false });
      if (result.error) throw result.error;
      shared = (result.data || []).map(d => ({ ...d, shared: true }));
    }
    res.json({ success: true, documents: [...(owned || []).map(d => ({ ...d, shared: false })), ...shared] });
  } catch (e) {
    console.error('Admin documents list failed:', e);
    res.status(500).json({ success: false, error: 'Could not load investigation documents.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const title = cleanText(req.body?.title, 240).trim() || 'Untitled Investigation Note';
    const content = sanitizeDocumentHtml(req.body?.content, 100000);
    const caseId = cleanText(req.body?.caseId, 120).trim() || null;
    const { data, error } = await supabase.from(DOCS).insert({ owner_user_id: req.user.id, title, content, case_id: caseId }).select('id,title,content,case_id,created_at,updated_at').single();
    if (error) throw error;
    res.status(201).json({ success: true, document: data });
  } catch (e) {
    console.error('Admin document create failed:', e);
    res.status(500).json({ success: false, error: 'Could not create investigation document.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!(await canView(doc, req.user))) return res.status(404).json({ success: false, error: 'Document not found.' });
    res.json({ success: true, document: doc, readOnly: !isOwner(doc, req.user) });
  } catch (e) {
    console.error('Admin document read failed:', e);
    res.status(500).json({ success: false, error: 'Could not load the document.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!doc || !isOwner(doc, req.user)) return res.status(404).json({ success: false, error: 'Document not found.' });
    const patch = {};
    if (req.body?.title !== undefined) patch.title = cleanText(req.body.title, 240).trim() || 'Untitled Investigation Note';
    if (req.body?.content !== undefined) patch.content = sanitizeDocumentHtml(req.body.content, 100000);
    if (req.body?.caseId !== undefined) patch.case_id = cleanText(req.body.caseId, 120).trim() || null;
    const { data, error } = await supabase.from(DOCS).update(patch).eq('id', doc.id).eq('owner_user_id', req.user.id).select('id,title,content,case_id,created_at,updated_at').single();
    if (error) throw error;
    res.json({ success: true, document: data });
  } catch (e) {
    console.error('Admin document update failed:', e);
    res.status(500).json({ success: false, error: 'Could not save the document.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from(DOCS).update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id).eq('owner_user_id', req.user.id).is('deleted_at', null).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Document not found.' });
    res.json({ success: true });
  } catch (e) {
    console.error('Admin document delete failed:', e);
    res.status(500).json({ success: false, error: 'Could not delete the document.' });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!(await canView(doc, req.user))) return res.status(404).json({ success: false, error: 'Document not found.' });
    const pdf = makePdf(doc.title, doc.content);
    const filename = (doc.title || 'investigation-note').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) + '.pdf';
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="' + filename + '"', 'Cache-Control': 'private, no-store' });
    res.send(pdf);
  } catch (e) {
    console.error('Admin document PDF failed:', e);
    res.status(500).json({ success: false, error: 'Could not generate the PDF.' });
  }
});

router.post('/:id/share', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!doc || !isOwner(doc, req.user)) return res.status(404).json({ success: false, error: 'Document not found.' });

    let recipientUserId = cleanText(req.body?.recipientUserId, 80).trim() || null;
    let recipientEmail = cleanText(req.body?.recipientEmail, 320).trim().toLowerCase() || null;
    const recipientType = req.body?.recipientType === 'admin' ? 'admin' : 'client';

    if (recipientType === 'admin') {
      if (!recipientUserId) return res.status(400).json({ success: false, error: 'Select an admin recipient.' });
      const { data: admin, error } = await supabase.from('recovery_users').select('id,email,role').eq('id', recipientUserId).in('role',['admin','owner']).maybeSingle();
      if (error) throw error;
      if (!admin) return res.status(400).json({ success: false, error: 'Admin recipient not found.' });
      recipientEmail = admin.email || recipientEmail;
    } else if (!recipientEmail && req.body?.caseId) {
      const { data: c, error } = await supabase.from('recovery_cases').select('email').eq('case_id', req.body.caseId).maybeSingle();
      if (error) throw error;
      recipientEmail = c?.email || null;
    }
    if (!recipientEmail && !recipientUserId) return res.status(400).json({ success: false, error: 'A recipient is required.' });

    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt).toISOString() : null;
    const { data: share, error: shareError } = await supabase.from(SHARES).insert({
      document_id: doc.id,
      owner_user_id: req.user.id,
      recipient_user_id: recipientUserId,
      recipient_email: recipientEmail,
      recipient_type: recipientType,
      permission: 'viewer',
      expires_at: expiresAt
    }).select('id,recipient_email,recipient_type,expires_at,created_at').single();
    if (shareError) throw shareError;

    let emailSent = false;
    if (recipientEmail && process.env.RESEND_API_KEY && process.env.MANLUNG_FROM_EMAIL) {
      const base = process.env.PUBLIC_BASE_URL || 'https://manlungrecovery.manlungshop.co.ke';
      const link = base.replace(/\/$/,'') + '/admin/investigation-notes.html?doc=' + encodeURIComponent(doc.id);
      const pdf = makePdf(doc.title, doc.content);
      const send = await axios.post('https://api.resend.com/emails', {
        from: process.env.MANLUNG_FROM_EMAIL,
        to: [recipientEmail],
        subject: 'Manlung Recovery investigation document: ' + doc.title,
        html: '<p>A Manlung Recovery investigation document has been shared with you.</p><p><a href="' + link + '">Open the document</a></p>',
        attachments: [{ filename: (doc.title || 'investigation-note').replace(/[^a-z0-9._-]+/gi,'_').slice(0,80)+'.pdf', content: pdf.toString('base64') }]
      }, { headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, timeout: 20000, validateStatus: () => true });
      emailSent = send.status >= 200 && send.status < 300;
      if (!emailSent) console.error('Resend document email failed:', send.status, send.data);
    }

    res.status(201).json({ success: true, share, emailSent, deliveryConfigured: Boolean(process.env.RESEND_API_KEY && process.env.MANLUNG_FROM_EMAIL) });
  } catch (e) {
    console.error('Admin document share failed:', e);
    res.status(500).json({ success: false, error: 'Could not share the document.' });
  }
});

module.exports = router;
