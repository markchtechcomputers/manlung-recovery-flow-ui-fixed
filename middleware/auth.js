const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminPermission = require('../models/AdminPermission');

const ADMIN_COOKIE = 'manlung_admin_session';

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || getCookie(req, ADMIN_COOKIE);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
      });
    }

    // Once MFA is enabled for an Admin/Owner, every authenticated token
    // must prove that it was issued after successful MFA. This blocks an
    // older token or a directly supplied Bearer token from bypassing MFA.
    if (
      (user.role === 'owner' || user.role === 'admin') &&
      user.mfa_enabled === true &&
      decoded.mfa !== true
    ) {
      return res.status(403).json({
        error: 'MFA verification required',
        code: 'MFA_REQUIRED',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);

    return res.status(401).json({
      error: 'Invalid token',
    });
  }
};


// Optional authentication for public-facing case submission/tracking.
// A valid client token is used when present; visitors without a token
// are allowed through as guests. Invalid supplied tokens are still rejected.
const optionalAuth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Optional authentication error:', error);

    return res.status(401).json({
      error: 'Invalid token',
    });
  }
};

// Accepts admin OR owner.
// Owner has all admin permissions.
// Suspended admins are blocked immediately.
const adminAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'owner'
    ) {
      return res.status(403).json({
        error: 'Admin access required',
      });
    }

    if (
      req.user.role === 'admin' &&
      req.user.admin_status === 'suspended'
    ) {
      return res.status(403).json({
        error: 'Your admin access has been suspended.',
      });
    }

    next();
  });
};

// Owner-only actions.
const ownerAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        error: 'Owner access required',
      });
    }

    if (req.user.mfa_enabled === true) {
      // auth() already verified decoded.mfa. Keep this check as a defense-in-depth
      // guard so Owner-only middleware can never accidentally run without MFA.
      const token = req.header('Authorization')?.replace('Bearer ', '') || getCookie(req, ADMIN_COOKIE);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.mfa !== true) {
        return res.status(403).json({ error: 'Owner MFA verification required', code: 'MFA_REQUIRED' });
      }
    }

    next();
  });
};

// Permission middleware.
//
// IMPORTANT:
// This function itself must NOT be async.
// Express needs requirePermission(...) to return
// a middleware function, not a Promise.
function requirePermission(permission) {
  return async (req, res, next) => {
    await adminAuth(req, res, async () => {
      // Owner can do everything.
      if (req.user.role === 'owner') {
        return next();
      }

      try {
        const allowed = await AdminPermission.has(
          req.user.id,
          permission
        );

        if (allowed) {
          return next();
        }

        return res.status(403).json({
          error: `Permission required: ${permission}`,
        });
      } catch (error) {
        console.error(
          'Permission check failed:',
          error
        );

        return res.status(500).json({
          error: 'Permission check failed',
        });
      }
    });
  };
};

module.exports = {
  auth,
  optionalAuth,
  adminAuth,
  ownerAuth,
  requirePermission,
};
