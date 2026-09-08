const crypto = require('crypto');
const { revokeToken } = require('./sessionRevocation');

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
const CSRF_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-mlc_csrf' : 'mlc_csrf';
const ADMIN_COOKIE = 'manlung_admin_session';

function securityLog(event, req, extra = {}) {
  const safe = {
    event,
    method: req.method,
    path: req.path,
    ipHash: crypto.createHash('sha256').update(String(req.ip || '')).digest('hex').slice(0, 16),
    ...extra,
  };
  console.warn('[SECURITY]', JSON.stringify(safe));
}

function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function parseCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  if (!match) return null;
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch (_) { return null; }
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

function safeEqual(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function enforceCsrf(req, res) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  // Client OAuth is a token exchange: the browser does not authenticate with the
  // admin session cookie here, so requiring the admin CSRF token breaks social login.
  // The Supabase access token in the request body is still required by the OAuth route.
  if (req.method === 'POST' && req.path === '/api/auth/client/oauth') return true;
  if (!req.headers.cookie?.includes(`${ADMIN_COOKIE}=`)) return true;
  if (req.headers.authorization) return true;
  const cookieToken = parseCookie(req, CSRF_COOKIE);
  const headerToken = req.headers['x-csrf-token'];
  if (!safeEqual(cookieToken, headerToken)) {
    securityLog('csrf_blocked', req);
    return res.status(403).json({ success: false, error: 'CSRF validation failed.', code: 'CSRF_INVALID' });
  }
  return true;
}

function trackLogoutRevocation(req, res) {
  if (req.method !== 'POST' || !req.path.endsWith('/admin/logout')) return;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || parseCookie(req, ADMIN_COOKIE);
  if (!token) return;
  let decoded = null;
  try { decoded = require('jsonwebtoken').decode(token); } catch (_) { decoded = null; }
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      revokeToken(token, decoded?.exp);
      securityLog('session_revoked', req);
    }
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
    if (!enforceCsrf(req, res)) return;
    for (const [sourceName, value] of [['body', req.body], ['query', req.query], ['params', req.params]]) {
      const error = inspectValue(value, sourceName);
      if (error) {
        securityLog('malicious_input_blocked', req, { source: sourceName });
        return res.status(400).json({ success: false, error });
      }
    }
    trackLogoutRevocation(req, res);
    return next();
  } catch (error) {
    console.error('Input security middleware error:', error);
    securityLog('security_middleware_error', req);
    return res.status(400).json({ success: false, error: 'Invalid request data.' });
  }
}

module.exports = { inputSecurity };
