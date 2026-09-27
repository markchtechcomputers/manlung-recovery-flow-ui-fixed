const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const { adminAuth } = require('../middleware/auth');
const RemoteDesktop = require('../models/RemoteDesktop');

const router = express.Router();

const PLATFORMS = ['windows','macos','android','ios','linux','other'];
const EVENTS = new Set(['offer','answer','ice-candidate','ready','stop']);

function valid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

function deviceToken(req) {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  return token.startsWith('mrd_device_') ? token : null;
}

async function requireDevice(req, res, next) {
  try {
    const token = deviceToken(req);
    const device = await RemoteDesktop.authenticateDevice(token);
    if (!device) return res.status(401).json({ error: 'Invalid or revoked device token.' });
    req.remoteDevice = device;
    next();
  } catch (error) {
    console.error('Remote device authentication error:', error);
    res.status(401).json({ error: 'Device authentication failed.' });
  }
}

// ========================= ADMIN =========================

router.get('/devices', adminAuth, async (req, res) => {
  try {
    await RemoteDesktop.expireSessions();
    res.json({ success: true, devices: await RemoteDesktop.listDevices() });
  } catch (error) {
    console.error('Remote device list error:', error);
    res.status(500).json({ error: 'Could not load remote devices.' });
  }
});

router.post('/devices/enrollment', adminAuth, [
  body('deviceName').trim().isLength({ min: 2, max: 100 }),
  body('platform').isIn(PLATFORMS),
  body('capabilities').optional().isObject(),
], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const result = await RemoteDesktop.createEnrollment({
      ownerUserId: req.user.id,
      deviceName: req.body.deviceName || null,
      platform: req.body.platform || null,
      capabilities: req.body.capabilities || {},
    });
    // Audit logging must not prevent a valid enrollment token from being issued.
    // The token/device row is the primary operation; audit failures are logged and
    // can be investigated separately.
    try {
      await RemoteDesktop.audit({
        deviceId: result.device.id,
        actorUserId: req.user.id,
        actorType: 'admin',
        eventType: 'DEVICE_ENROLLMENT_CREATED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { platform: result.device.platform },
      });
    } catch (auditError) {
      console.error('Remote enrollment audit error:', {
        code: auditError?.code,
        message: auditError?.message,
        details: auditError?.details,
        hint: auditError?.hint,
      });
    }
    res.status(201).json({
      success: true,
      device: result.device,
      enrollmentToken: result.enrollmentToken,
      enrollmentExpiresAt: result.enrollmentExpiresAt,
      warning: 'Show this token only to the authorized device owner. It expires after 15 minutes and is not stored in plaintext.',
    });
  } catch (error) {
    console.error('Remote enrollment creation error:', error);
    res.status(500).json({ error: 'Could not create enrollment token.' });
  }
});

router.post('/devices/:id/revoke', adminAuth, async (req, res) => {
  try {
    const updated = await RemoteDesktop.revokeDevice(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Device not found.' });
    await RemoteDesktop.audit({
      deviceId: updated.id,
      actorUserId: req.user.id,
      actorType: 'admin',
      eventType: 'DEVICE_REVOKED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json({ success: true, device: updated });
  } catch (error) {
    console.error('Remote device revoke error:', error);
    res.status(500).json({ error: 'Could not revoke device.' });
  }
});

router.delete('/devices/:id', adminAuth, async (req, res) => {
  try {
    const deleted = await RemoteDesktop.deleteDevice(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Device not found.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Remote device delete error:', error);
    res.status(500).json({ error: 'Could not delete device.' });
  }
});

router.get('/sessions', adminAuth, async (req, res) => {
  try {
    res.json({ success: true, sessions: await RemoteDesktop.listSessionsForAdmin(req.user.id) });
  } catch (error) {
    console.error('Remote session list error:', error);
    res.status(500).json({ error: 'Could not load remote sessions.' });
  }
});

router.post('/devices/:id/sessions', adminAuth, [
  body('requestedAudio').optional().isBoolean(),
], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const devices = await RemoteDesktop.listDevices();
    const device = devices.find(x => x.id === req.params.id);
    if (!device || device.status === 'revoked') return res.status(404).json({ error: 'Device not found or revoked.' });
    if (device.status !== 'online') return res.status(409).json({ error: 'Device is offline. Ask the device owner to reconnect the Manlung Remote Support page.' });

    const existing = (await RemoteDesktop.listSessionsForAdmin(req.user.id))
      .find(s => s.device_id === device.id && ['requested','approved','active'].includes(s.status));
    if (existing) return res.status(409).json({ error: 'You already have a remote session pending or active for this device.', session: existing });

    const session = await RemoteDesktop.createSession({
      deviceId: device.id,
      adminUserId: req.user.id,
      requestedAudio: Boolean(req.body.requestedAudio),
    });

    await RemoteDesktop.audit({
      sessionId: session.id,
      deviceId: device.id,
      actorUserId: req.user.id,
      actorType: 'admin',
      eventType: 'REMOTE_ACCESS_REQUESTED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { requested_audio: Boolean(req.body.requestedAudio) },
    });

    res.status(201).json({ success: true, session });
  } catch (error) {
    if (error?.code === 'REMOTE_DEVICE_BUSY') {
      return res.status(409).json({ error: error.message, session: error.session || null });
    }
    console.error('Remote session request error:', error);
    res.status(500).json({ error: 'Could not request remote access.' });
  }
});

router.get('/sessions/:id', adminAuth, async (req, res) => {
  try {
    const session = await RemoteDesktop.getSession(req.params.id);
    if (!session || session.admin_user_id !== req.user.id) return res.status(404).json({ error: 'Remote session not found.' });
    res.json({ success: true, session });
  } catch (error) {
    console.error('Remote session lookup error:', error);
    res.status(500).json({ error: 'Could not load remote session.' });
  }
});

router.delete('/sessions/:id', adminAuth, async (req, res) => {
  try {
    const deleted = await RemoteDesktop.deleteSession(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Remote session not found.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Remote session delete error:', error);
    res.status(500).json({ error: 'Could not delete remote session.' });
  }
});

router.post('/sessions/:id/activate', adminAuth, async (req, res) => {
  try {
    const session = await RemoteDesktop.getSession(req.params.id);
    if (!session || session.admin_user_id !== req.user.id) return res.status(404).json({ error: 'Remote session not found.' });
    if (session.status !== 'approved' && session.status !== 'active') return res.status(409).json({ error: 'Device has not approved this session.' });
    const updated = await RemoteDesktop.activateSession(session.id, req.user.id);
    res.json({ success: true, session: updated });
  } catch (error) {
    console.error('Remote session activation error:', error);
    res.status(500).json({ error: 'Could not activate remote session.' });
  }
});

router.post('/sessions/:id/end', adminAuth, async (req, res) => {
  try {
    const session = await RemoteDesktop.getSession(req.params.id);
    if (!session || session.admin_user_id !== req.user.id) return res.status(404).json({ error: 'Remote session not found.' });
    const updated = await RemoteDesktop.endSession(session.id, req.user.id, 'admin_ended');
    await RemoteDesktop.audit({
      sessionId: session.id,
      deviceId: session.device_id,
      actorUserId: req.user.id,
      actorType: 'admin',
      eventType: 'REMOTE_ACCESS_ENDED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { reason: 'admin_ended' },
    });
    res.json({ success: true, session: updated });
  } catch (error) {
    console.error('Remote session end error:', error);
    res.status(500).json({ error: 'Could not end remote session.' });
  }
});

router.post('/sessions/:id/signals', adminAuth, [
  body('event').isIn([...EVENTS]),
  body('payload').optional().isObject(),
], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const session = await RemoteDesktop.getSession(req.params.id);
    if (!session || session.admin_user_id !== req.user.id) return res.status(404).json({ error: 'Remote session not found.' });
    if (!['approved','active'].includes(session.status)) return res.status(409).json({ error: 'Remote session is not active.' });
    const signal = await RemoteDesktop.addSignal(session.id, 'admin', req.body.event, req.body.payload || {});
    res.status(201).json({ success: true, signalId: signal.id });
  } catch (error) {
    console.error('Remote admin signal error:', error);
    res.status(500).json({ error: 'Could not send remote signal.' });
  }
});

router.get('/sessions/:id/signals', adminAuth, async (req, res) => {
  try {
    const session = await RemoteDesktop.getSession(req.params.id);
    if (!session || session.admin_user_id !== req.user.id) return res.status(404).json({ error: 'Remote session not found.' });
    res.json({ success: true, signals: await RemoteDesktop.listSignals(session.id, req.query.after) });
  } catch (error) {
    console.error('Remote admin signal poll error:', error);
    res.status(500).json({ error: 'Could not load remote signals.' });
  }
});

// ========================= DEVICE =========================

router.post('/device/enroll', [
  body('enrollmentToken').trim().isLength({ min: 20, max: 200 }),
  body('deviceName').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 100 }),
  body('platform').optional({ checkFalsy: true }).isIn(PLATFORMS),
  body('capabilities').optional().isObject(),
], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const result = await RemoteDesktop.enrollDevice({
      enrollmentToken: req.body.enrollmentToken,
      deviceName: req.body.deviceName,
      platform: req.body.platform,
      capabilities: req.body.capabilities || {},
    });
    if (!result) return res.status(401).json({ error: 'Enrollment token is invalid or revoked.' });
    try {
      await RemoteDesktop.audit({
        deviceId: result.device.id,
        actorType: 'device',
        eventType: 'DEVICE_ENROLLED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { platform: result.device.platform },
      });
    } catch (auditError) {
      console.error('Remote device enrollment audit error:', {
        code: auditError?.code,
        message: auditError?.message,
        details: auditError?.details,
        hint: auditError?.hint,
      });
    }
    res.status(201).json({ success: true, device: result.device, deviceToken: result.deviceToken });
  } catch (error) {
    console.error('Remote device enrollment error:', error);
    res.status(500).json({ error: 'Could not enroll device.' });
  }
});

router.post('/device/heartbeat', requireDevice, async (req, res) => {
  try {
    const device = await RemoteDesktop.heartbeat(req.remoteDevice.id);
    res.json({ success: true, device });
  } catch (error) {
    console.error('Remote device heartbeat error:', error);
    res.status(500).json({ error: 'Could not update device heartbeat.' });
  }
});

router.get('/device/sessions/active', requireDevice, async (req, res) => {
  try {
    res.json({ success: true, session: await RemoteDesktop.getActiveSessionForDevice(req.remoteDevice.id) });
  } catch (error) {
    console.error('Remote device active session error:', error);
    res.status(500).json({ error: 'Could not load active remote session.' });
  }
});

router.get('/device/sessions/pending', requireDevice, async (req, res) => {
  try {
    res.json({ success: true, sessions: await RemoteDesktop.pendingForDevice(req.remoteDevice.id) });
  } catch (error) {
    console.error('Remote device pending sessions error:', error);
    res.status(500).json({ error: 'Could not load remote requests.' });
  }
});

router.post('/device/sessions/:id/respond', requireDevice, [
  body('approved').isBoolean(),
  body('approvedAudio').optional().isBoolean(),
], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const session = await RemoteDesktop.respondToSession(
      req.params.id,
      req.remoteDevice.id,
      req.body.approved,
      req.body.approvedAudio
    );
    if (!session) return res.status(409).json({ error: 'The request is no longer available.' });
    await RemoteDesktop.audit({
      sessionId: session.id,
      deviceId: req.remoteDevice.id,
      actorType: 'device',
      eventType: req.body.approved ? 'REMOTE_ACCESS_APPROVED' : 'REMOTE_ACCESS_REJECTED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { approved_audio: Boolean(req.body.approvedAudio) },
    });
    res.json({ success: true, session });
  } catch (error) {
    console.error('Remote device consent error:', error);
    res.status(500).json({ error: 'Could not update remote consent.' });
  }
});

router.get('/device/sessions/:id/signals', requireDevice, async (req, res) => {
  try {
    const session = await RemoteDesktop.getSession(req.params.id);
    if (!session || session.device_id !== req.remoteDevice.id) return res.status(404).json({ error: 'Remote session not found.' });
    res.json({ success: true, signals: await RemoteDesktop.listSignals(session.id, req.query.after) });
  } catch (error) {
    console.error('Remote device signal poll error:', error);
    res.status(500).json({ error: 'Could not load remote signals.' });
  }
});

router.post('/device/sessions/:id/signals', requireDevice, [
  body('event').isIn([...EVENTS]),
  body('payload').optional().isObject(),
], async (req, res) => {
  if (!valid(req, res)) return;
  try {
    const session = await RemoteDesktop.getSession(req.params.id);
    if (!session || session.device_id !== req.remoteDevice.id) return res.status(404).json({ error: 'Remote session not found.' });
    if (!['approved','active'].includes(session.status)) return res.status(409).json({ error: 'Remote session is not active.' });
    const signal = await RemoteDesktop.addSignal(session.id, 'device', req.body.event, req.body.payload || {});
    res.status(201).json({ success: true, signalId: signal.id });
  } catch (error) {
    console.error('Remote device signal error:', error);
    res.status(500).json({ error: 'Could not send remote signal.' });
  }
});

router.post('/device/sessions/:id/end', requireDevice, async (req, res) => {
  try {
    const session = await RemoteDesktop.getSession(req.params.id);
    if (!session || session.device_id !== req.remoteDevice.id) return res.status(404).json({ error: 'Remote session not found.' });
    const updated = await RemoteDesktop.endSession(session.id, null, 'device_ended');
    await RemoteDesktop.audit({
      sessionId: session.id,
      deviceId: req.remoteDevice.id,
      actorType: 'device',
      eventType: 'REMOTE_ACCESS_ENDED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { reason: 'device_ended' },
    });
    res.json({ success: true, session: updated });
  } catch (error) {
    console.error('Remote device end error:', error);
    res.status(500).json({ error: 'Could not end remote session.' });
  }
});

module.exports = router;
