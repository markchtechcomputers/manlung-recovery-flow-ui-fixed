const crypto = require('crypto');

const DANGEROUS_SCHEMES = /(?:^|\s)(?:javascript|vbscript|file|data):/i;
const PATH_TRAVERSAL = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const NULL_BYTE = /\u0000/;
const CONTROL_CHARS = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const DANGEROUS_HTML = [
  /<\s*script\b/i, /<\s*iframe\b/i, /<\s*object\b/i, /<\s*embed\b/i,
  /<\s*svg\b[^>]*\bon\w+\s*=/i, /\bon(?:error|load|click|mouseover|focus)\s*=/i,
];
const SQL_INJECTION_PATTERNS = [
  /(?:^|\s)union\s+(?:all\s+)?select\b/i,
  /(?:^|\s)(?:drop|truncate|alter)\s+(?:table|database|schema)\b/i,
  /(?:^|\s)insert\s+into\b/i,
  /(?:^|\s)delete\s+from\b/i,
  /(?:^|\s)update\s+\w+\s+set\b/i,
  /(?:;|--)\s*(?:drop|delete|update|insert|select|alter)\b/i,
  /\b(?:pg_sleep|information_schema|xp_cmdshell)\b/i,
];
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all|any|the)\s+(?:previous|prior|above)\s+instructions?/i,
  /disregard\s+(?:all|any|the)\s+(?:previous|prior|above)\s+instructions?/i,
  /system\s+message\s*:/i,
  /developer\s+message\s*:/i,
  /you\s+are\s+now\s+(?:an?|the)\s+/i,
  /reveal\s+(?:the\s+)?(?:system|developer)\s+prompt/i,
];
const URL_LIKE_KEYS = new Set(['url', 'redirect', 'redirectTo', 'callbackUrl', 'returnUrl', 'website', 'link']);
const PATH_LIKE_KEYS = new Set(['path', 'filename', 'fileName', 'storagePath', 'filePath']);
const PROMPT_LIKE_KEYS = new Set(['prompt', 'systemPrompt', 'instructions', 'aiPrompt', 'assistantPrompt', 'automationPrompt']);
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 3;
const loginFailures = new Map();
const CSRF_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-mlc_csrf' : 'mlc_csrf';

function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function parseCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function ensureCsrfCookie(req, res) {
  if (!parseCookie(req, CSRF_COOKIE)) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}

function enforceCsrf(req, res) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  if (!req.headers.cookie?.includes('manlung_admin_session=')) return true;
  if (req.headers.authorization) return true;

  const allowedOrigins = new Set(['https://manlungrecovery.manlungshop.co.ke', 'http://localhost:3000', 'http://127.0.0.1:3000']);
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const originAllowed = (origin && allowedOrigins.has(origin)) || (referer && [...allowedOrigins].some(base => referer.startsWith(`${base}/`)));
  const cookieToken = parseCookie(req, CSRF_COOKIE);
  const headerToken = req.headers['x-csrf-token'];
  const tokenValid = cookieToken && headerToken && crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(String(headerToken)));

  if (!originAllowed && !tokenValid) {
    return res.status(403).json({ success: false, error: 'CSRF validation failed.' });
  }
  return true;
}

function loginKey(req) {
  const identifier = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(`${req.ip}|${identifier}`).digest('hex');
}

function enforceLoginLockout(req, res) {
  if (!req.path.endsWith('/login') || req.method !== 'POST') return true;
  const key = loginKey(req);
  const record = loginFailures.get(key);
  if (!record) return true;
  if (record.expiresAt <= Date.now()) { loginFailures.delete(key); return true; }
  if (record.failures >= LOGIN_MAX_FAILURES) {
    res.status(429).json({ success: false, error: 'Account temporarily blocked after 3 failed login attempts. Please wait 15 minutes before trying again.', code: 'LOGIN_LOCKED' });
    return false;
  }
  return true;
}

function trackLoginResult(req, res) {
  if (!req.path.endsWith('/login') || req.method !== 'POST') return;
  const key = loginKey(req);
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) { loginFailures.delete(key); return; }
    if (![400, 401, 403].includes(res.statusCode)) return;
    const existing = loginFailures.get(key);
    const failures = (existing && existing.expiresAt > Date.now() ? existing.failures : 0) + 1;
    loginFailures.set(key, { failures, expiresAt: Date.now() + LOGIN_WINDOW_MS });
  });
}

function inspectString(value, keyPath) {
  if (NULL_BYTE.test(value) || CONTROL_CHARS.test(value)) return 'Input contains invalid control characters.';
  const key = String(keyPath || '').split('.').pop();
  if (URL_LIKE_KEYS.has(key) && DANGEROUS_SCHEMES.test(value)) return 'Unsafe URL scheme detected.';
  if (PATH_LIKE_KEYS.has(key) && PATH_TRAVERSAL.test(value)) return 'Unsafe file path detected.';
  for (const pattern of DANGEROUS_HTML) if (pattern.test(value)) return 'Potentially executable HTML or script content detected.';
  for (const pattern of SQL_INJECTION_PATTERNS) if (pattern.test(value)) return 'Potentially malicious SQL input detected.';
  if (PROMPT_LIKE_KEYS.has(key)) for (const pattern of PROMPT_INJECTION_PATTERNS) if (pattern.test(value)) return 'Potential prompt-injection content detected.';
  return null;
}

function inspectValue(value, keyPath = '') {
  if (typeof value === 'string') return inspectString(value, keyPath);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) { const error = inspectValue(value[i], `${keyPath}[${i}]`); if (error) return error; }
    return null;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) { const error = inspectValue(child, keyPath ? `${keyPath}.${key}` : key); if (error) return error; }
  }
  return null;
}

function inputSecurity(req, res, next) {
  try {
    ensureCsrfCookie(req, res);
    if (!enforceLoginLockout(req, res)) return;
    if (!enforceCsrf(req, res)) return;
    for (const [sourceName, value] of [['body', req.body], ['query', req.query], ['params', req.params]]) {
      const error = inspectValue(value, sourceName);
      if (error) return res.status(400).json({ success: false, error });
    }
    trackLoginResult(req, res);
    return next();
  } catch (error) {
    console.error('Input security middleware error:', error);
    return res.status(400).json({ success: false, error: 'Invalid request data.' });
  }
}

module.exports = { inputSecurity };
