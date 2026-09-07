const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminPermission = require('../models/AdminPermission');
const { isTokenRevoked } = require('./sessionRevocation');

const ADMIN_COOKIE = 'manlung_admin_session';
const SESSION_MAX_AGE = {
  owner: 7 * 24 * 60 * 60,
  client: 7 * 24 * 60 * 60,
  admin: 24 * 60 * 60,
};

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${name}=`));
  if (!match) return null;
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch (_) { return null; }
}

function isSessionExpired(decoded, user) {
  const maxAge = SESSION_MAX_AGE[user.role] || SESSION_MAX_AGE.client;
  if (!decoded.iat) return true;
  return Math.floor(Date.now() / 1000) - decoded.iat > maxAge;
}

function isDurablyRevoked(decoded, user) {
  const tokenVersion = Number(decoded.sessionVersion ?? 0);
  const currentVersion = Number(user.session_version ?? 0);
  return tokenVersion !== currentVersion;
}

async function verifyRequestToken(req) {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '') || getCookie(req, ADMIN_COOKIE);
  if (!token) return { token: null, decoded: null, user: null };
  if (isTokenRevoked(token)) throw new Error('TOKEN_REVOKED');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (isTokenRevoked(token)) throw new Error('TOKEN_REVOKED');
  const user = await User.findById(decoded.id);
  if (user && isDurablyRevoked(decoded, user)) throw new Error('SESSION_VERSION_REVOKED');
  return { token, decoded, user };
}

const auth = async (req, res, next) => {
  try {
    const { decoded, user } = await verifyRequestToken(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (isSessionExpired(decoded, user)) return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    if ((user.role === 'owner' || user.role === 'admin') && user.mfa_enabled === true && decoded.mfa !== true) return res.status(403).json({ error: 'MFA verification required', code: 'MFA_REQUIRED' });
    req.user = user;
    next();
  } catch (error) {
    if (error.message === 'TOKEN_REVOKED' || error.message === 'SESSION_VERSION_REVOKED') return res.status(401).json({ error: 'Session revoked. Please sign in again.', code: 'SESSION_REVOKED' });
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const optionalAuth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next();
  try {
    if (isTokenRevoked(token)) return res.status(401).json({ error: 'Session revoked.', code: 'SESSION_REVOKED' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (isDurablyRevoked(decoded, user)) return res.status(401).json({ error: 'Session revoked.', code: 'SESSION_REVOKED' });
    if (isSessionExpired(decoded, user)) return res.status(401).json({ error: 'Session expired.', code: 'SESSION_EXPIRED' });
    req.user = user;
    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.status(403).json({ error: 'Admin access required' });
    if (req.user.role === 'admin' && req.user.admin_status === 'suspended') return res.status(403).json({ error: 'Your admin access has been suspended.' });
    next();
  });
};

const ownerAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
    if (req.user.mfa_enabled === true) {
      const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '') || getCookie(req, ADMIN_COOKIE);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.mfa !== true) return res.status(403).json({ error: 'Owner MFA verification required', code: 'MFA_REQUIRED' });
    }
    next();
  });
};

function requirePermission(permission) {
  return async (req, res, next) => {
    await adminAuth(req, res, async () => {
      if (req.user.role === 'owner') return next();
      try {
        const allowed = await AdminPermission.has(req.user.id, permission);
        if (allowed) return next();
        return res.status(403).json({ error: `Permission required: ${permission}` });
      } catch (error) {
        console.error('Permission check failed:', error);
        return res.status(500).json({ error: 'Permission check failed' });
      }
    });
  };
}

module.exports = { auth, optionalAuth, adminAuth, ownerAuth, requirePermission, isDurablyRevoked };
