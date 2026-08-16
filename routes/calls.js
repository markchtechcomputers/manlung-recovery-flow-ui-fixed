const express = require('express');
const router = express.Router();
const { auth, adminAuth, ownerAuth } = require('../middleware/auth');
const CallEntitlement = require('../models/CallEntitlement');
const AdminPresence = require('../models/AdminPresence');
const CallSession = require('../models/CallSession');
const { supabase } = require('../config/supabase');
const CallSignal = require('../models/CallSignal');

// ---- Admin presence ----

router.post('/admin/online', adminAuth, async (req, res) => {
  try {
    await AdminPresence.setOnline(req.user.id);
    res.json({ success: true, online: true });
  } catch (error) {
    console.error('Admin online error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/admin/offline', adminAuth, async (req, res) => {
  try {
    await AdminPresence.setOffline(req.user.id);
    res.json({ success: true, online: false });
  } catch (error) {
    console.error('Admin offline error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Any authenticated user can check whether an admin is reachable right now
router.get('/availability', auth, async (req, res) => {
  try {
    const available = await AdminPresence.anyAdminAvailable();

    // Availability must NEVER be cached.
    // The Admin's online status can change every few seconds.
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    res.status(200).json({
      success: true,
      available: !!available
    });
  } catch (error) {
    console.error('Availability check error:', error);

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// ICE server config for WebRTC. STUN (Google's public server) is enough to
// connect most calls; TURN is a relay fallback for restrictive networks
// (symmetric NAT, some corporate/mobile networks) where a direct peer
// connection can't be established. Kept behind auth since TURN credentials
// are more sensitive than the public Supabase anon key.
router.get('/ice-servers', auth, (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  // TURN_URL may contain one URL or a comma-separated list. Supporting the
  // full Metered UDP/TCP/TLS set is important on mobile/corporate networks
  // where UDP TURN can be blocked.
  const turnUrls = String(process.env.TURN_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  if (turnUrls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  res.json({
    success: true,
    iceServers,
    turnConfigured: turnUrls.length > 0 && !!process.env.TURN_USERNAME && !!process.env.TURN_CREDENTIAL,
  });
});

// Owner-only monitoring. The Owner can observe call metadata/status but is not
// placed into the normal admin answer queue by this endpoint.
router.get('/owner/monitor', ownerAuth, async (req, res) => {
  try {
    await CallSession.cleanupAbandoned();
    const { data, error } = await supabase
      .from('recovery_call_sessions')
      .select('id, client_name, client_email, case_id, status, admin_user_id, created_at, accepted_at, ended_at, end_reason')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ success: true, calls: data || [] });
  } catch (error) {
    console.error('Owner call monitor error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ---- Call sessions ----

// Client starts a call. Server enforces BOTH the entitlement (trial/subscription)
// AND admin availability — never trust the frontend to have already checked.
router.post('/start', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can initiate a Call Admin session.' });
    }

    const entitlement = CallEntitlement.evaluate(await CallEntitlement.get(req.user.id));
    if (!entitlement.access) {
      return res.status(403).json({ error: 'Call Admin subscription required', entitlement });
    }

    const available = await AdminPresence.anyAdminAvailable();
    if (!available) {
      return res.status(409).json({
        error: 'Admin is currently unavailable. Please submit a recovery request and we will respond as soon as possible.',
      });
    }

    const session = await CallSession.create({
      clientUserId: req.user.id,
      clientName: req.user.username,
      clientEmail: req.user.email,
      caseId: req.body?.caseId || null,
    });

    res.status(201).json({ success: true, sessionId: session.id, channel: session.id, status: session.status });
  } catch (error) {
    console.error('Call start error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Admin polls this while "online" to discover waiting callers.
// (Chose polling over a push mechanism deliberately — see README for the
// security reasoning: it keeps caller name/email behind our existing JWT
// auth instead of a broadcast channel anyone holding the public anon key
// could listen to.)
router.get('/pending', adminAuth, async (req, res) => {
  try {
    await CallSession.cleanupAbandoned();
    const { data, error } = await supabase
      .from('recovery_call_sessions')
      .select('id, client_name, client_email, case_id, created_at')
      .eq('status', 'ringing')
      .is('admin_user_id', null)
      .order('created_at', { ascending: true })
      .limit(5);
    if (error) throw error;
    res.json({ success: true, calls: data });
  } catch (error) {
    console.error('Pending calls error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Either participant polls this to learn about status changes made by the
// other side (accepted/rejected/ended) without needing a push channel.
router.get('/:id', auth, async (req, res) => {
  try {
    let session = await CallSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Call session not found' });

    const isParticipant = session.client_user_id === req.user.id || session.admin_user_id === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Not part of this call' });

    session = await CallSession.expireIfRingingTooLong(session);
    res.json({ success: true, session });
  } catch (error) {
    console.error('Get call session error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});


// Durable WebRTC signaling. Using the authenticated API instead of browser
// Realtime broadcast prevents missed offers/ICE candidates when either side
// joins a little later, and works across networks without exposing service keys.
router.post('/:id/signals', auth, async (req, res) => {
  try {
    const session = await CallSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Call session not found' });

    const isParticipant = session.client_user_id === req.user.id || session.admin_user_id === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Not part of this call' });

    const allowed = new Set(['offer', 'answer', 'ice-candidate', 'end']);
    if (!allowed.has(req.body?.event)) return res.status(400).json({ error: 'Invalid signaling event' });

    const signal = await CallSignal.create({
      sessionId: session.id,
      senderUserId: req.user.id,
      event: req.body.event,
      payload: req.body.payload || {},
    });
    res.status(201).json({ success: true, signalId: signal.id });
  } catch (error) {
    console.error('Call signal write error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/:id/signals', auth, async (req, res) => {
  try {
    const session = await CallSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Call session not found' });

    const isParticipant = session.client_user_id === req.user.id || session.admin_user_id === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Not part of this call' });

    const participantIds = [session.client_user_id, session.admin_user_id].filter(Boolean);
    const signals = await CallSignal.listAfter(req.params.id, req.query.after, participantIds);
    res.json({ success: true, signals });
  } catch (error) {
    console.error('Call signal read error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.put('/:id/accept', adminAuth, async (req, res) => {
  try {
    const alreadyBusy = await CallSession.adminHasActiveCall(req.user.id);
    if (alreadyBusy) {
      return res.status(409).json({ error: 'You already have an active call. End it before accepting another.' });
    }

    const accepted = await CallSession.accept(req.params.id, req.user.id);
    if (!accepted) {
      return res.status(409).json({ error: 'This call was already answered or cancelled by someone else.' });
    }

    await AdminPresence.setBusy(req.user.id, true);
    res.json({ success: true, session: accepted });
  } catch (error) {
    console.error('Accept call error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.put('/:id/reject', adminAuth, async (req, res) => {
  try {
    const session = await CallSession.setStatus(req.params.id, 'rejected');
    res.json({ success: true, session });
  } catch (error) {
    console.error('Reject call error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.put('/:id/end', auth, async (req, res) => {
  try {
    const session = await CallSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Call session not found' });

    const isParticipant = session.client_user_id === req.user.id || session.admin_user_id === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Not part of this call' });

    const updated = await CallSession.setStatus(req.params.id, 'ended', req.body?.reason);
    if (session.admin_user_id) {
      await AdminPresence.setBusy(session.admin_user_id, false);
    }
    res.json({ success: true, session: updated });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});


// Owner-only: permanently clear call history/logs. This does not touch user accounts.
router.delete('/owner/logs', ownerAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('recovery_call_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    res.json({ success: true, message: 'Call logs cleared.' });
  } catch (error) {
    console.error('Clear call logs error:', error);
    res.status(500).json({ error: error.message || 'Could not clear call logs' });
  }
});

module.exports = router;
