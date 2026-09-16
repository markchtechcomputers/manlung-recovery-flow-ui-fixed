const express = require('express');
const { adminAuth, ownerAuth } = require('../middleware/auth');
const { supabase } = require('../config/supabase');
const User = require('../models/User');

const router = express.Router();

function safeDependencyStatus() {
  const names = [
    'express',
    'jsonwebtoken',
    'bcryptjs',
    '@supabase/supabase-js',
    'helmet',
    'express-rate-limit',
    'multer',
    'axios',
  ];
  return names.map((name) => {
    try {
      require.resolve(name);
      return { name, installed: true };
    } catch (_) {
      return { name, installed: false };
    }
  });
}

router.get('/health', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const started = Date.now();
  let database = 'error';
  try {
    const { error } = await supabase.from('recovery_users').select('id', { head: true, count: 'exact' }).limit(1);
    database = error ? 'error' : 'ok';
  } catch (_) {}

  const dependencies = safeDependencyStatus();
  const dependenciesOk = dependencies.every((item) => item.installed);
  const status = database === 'ok' && dependenciesOk ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    success: status === 'ok',
    status,
    database,
    dependencies,
    uptimeSeconds: Math.floor(process.uptime()),
    responseMs: Date.now() - started,
    node: process.version,
    timestamp: new Date().toISOString(),
  });
});

router.get('/security', ownerAuth, async (_req, res) => {
  try {
    const admins = await User.listAdminsAndOwner();
    const now = Date.now();
    const accounts = admins.map((account) => ({
      id: account.id,
      username: account.username,
      role: account.role,
      adminStatus: account.admin_status || 'active',
      mfaEnabled: Boolean(account.mfa_enabled),
      failedLoginAttempts: Number(account.failed_login_attempts || 0),
      locked: Boolean(account.login_locked_until && new Date(account.login_locked_until).getTime() > now),
      lockedUntil: account.login_locked_until || null,
      lastLoginAt: account.last_login_at || null,
      sessionVersion: Number(account.session_version || 0),
    }));
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Platform security status error:', error);
    res.status(500).json({ success: false, error: 'Could not load security status.' });
  }
});

router.post('/logout-all', adminAuth, async (req, res) => {
  try {
    await User.bumpSessionVersion(req.user.id);
    res.clearCookie('manlung_admin_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    res.json({ success: true, message: 'All sessions for this account have been revoked. Sign in again.' });
  } catch (error) {
    console.error('Logout-all error:', error);
    res.status(500).json({ success: false, error: 'Could not revoke sessions.' });
  }
});

module.exports = router;
