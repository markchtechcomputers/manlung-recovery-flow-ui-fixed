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
    const availability = await AdminPresence.getAvailabilityState();

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
      available: availability.state === 'available',
      state: availability.state,
      onlineCount: availability.onlineCount,
      availableCount: availability.availableCount
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
    if (data?.length) {
      const ids = [...new Set(data.map(c => c.admin_user_id).filter(Boolean))];
      if (ids.length) {
        const { data: admins } = await supabase.from('recovery_users').select('id, username, email').in('id', ids);
        const map = new Map((admins || []).map(a => [a.id, a.username || a.email || 'Admin']));
        data.forEach(c => { c.admin_name = map.get(c.admin_user_id) || 'Admin'; });
      }
    }
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

    const availability = await AdminPresence.getAvailabilityState();
    if (availability.state === 'offline') {
      return res.status(409).json({
        error: 'No admins are currently available. Please try again later or call back shortly.',
        availability: availability.state,
      });
    }

    const session = await CallSession.create({
      clientUserId: req.user.id,
      clientName: req.user.username,
      clientEmail: req.user.email,
      caseId: req.body?.caseId || null,
    });

    res.status(201).json({
      success: true,
      sessionId: session.id,
      channel: session.id,
      status: session.status,
      availability: availability.state,
      message: availability.state === 'busy'
        ? 'All admins are currently assisting other clients. Kindly hold or call back in a few minutes.'
        : 'An admin is available and will receive your call.',
    });
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
      .in('status', ['ringing', 'queued'])
      .is('admin_user_id', null)
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) throw error;
    res.json({ success: true, calls: data });
  } catch (error) {
    console.error('Pending calls error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Either participant polls this to learn about status changes made by the
// other side (accepted/rejected/ended) without needing a push channel.
// Admin starts a callback to a client. The existing WebRTC/signaling stack is reused.
router.post('/admin/callback', adminAuth, async (req, res) => {
  try {
    const clientUserId = String(req.body?.clientUserId || '').trim();
    const caseId = req.body?.caseId ? String(req.body.caseId).trim() : null;
    if (!clientUserId) return res.status(400).json({ error: 'Client user ID is required.' });

    let clientQuery = supabase
      .from('recovery_users')
      .select('id, username, email, role')
      .eq('id', clientUserId)
      .maybeSingle();
    const { data: client, error: clientError } = await clientQuery;
    if (clientError) throw clientError;
    if (!client || client.role !== 'client') return res.status(404).json({ error: 'Client not found.' });

    const busy = await CallSession.adminHasActiveCall(req.user.id);
    if (busy) return res.status(409).json({ error: 'You already have an active call. End it before calling a client.' });

    const pendingCallback = await supabase
      .from('recovery_call_sessions')
      .select('id')
      .eq('admin_user_id', req.user.id)
      .eq('status', 'ringing')
      .is('ended_at', null)
      .limit(1)
      .maybeSingle();
    if (pendingCallback.error) throw pendingCallback.error;
    if (pendingCallback.data) return res.status(409).json({ error: 'You already have a callback waiting for an answer.' });

    if (caseId) {
      const { data: caseRow, error: caseError } = await supabase
        .from('recovery_cases')
        .select('case_id, client_user_id')
        .eq('case_id', caseId)
        .maybeSingle();
      if (caseError) throw caseError;
      if (!caseRow || caseRow.client_user_id !== clientUserId) {
        return res.status(404).json({ error: 'Client/case not found.' });
      }
    }

    const existing = await supabase
      .from('recovery_call_sessions')
      .select('id')
      .eq('client_user_id', clientUserId)
      .eq('admin_user_id', req.user.id)
      .in('status', ['ringing', 'accepted'])
      .is('ended_at', null)
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return res.status(409).json({ error: 'There is already an active callback with this client.' });

    const now = new Date().toISOString();
    const { data: session, error } = await supabase
      .from('recovery_call_sessions')
      .insert({
        client_user_id: clientUserId,
        client_name: client.username || client.email,
        client_email: client.email,
        case_id: caseId,
        admin_user_id: req.user.id,
        status: 'ringing',
        ringing_started_at: now,
      })
      .select()
      .single();
    if (error) throw error;

    session.admin_name = req.user.username || req.user.email || 'Admin';
    res.status(201).json({ success: true, sessionId: session.id, channel: session.id, status: session.status, adminName: session.admin_name, session });
  } catch (error) {
    console.error('Admin callback start error:', error);
    res.status(500).json({ error: error.message || 'Could not start callback.' });
  }
});

// Client polls for an admin callback assigned specifically to that client.
router.get('/client/callbacks', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Client access required' });
    const { data, error } = await supabase
      .from('recovery_call_sessions')
      .select('id, client_name, client_email, case_id, status, admin_user_id, created_at, ringing_started_at')
      .eq('client_user_id', req.user.id)
      .eq('status', 'ringing')
      .not('admin_user_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) throw error;

    const calls = (data || []).map(call => ({
      ...call,
      admin_name:
        call.admin_user_id === req.user.id
          ? 'Admin'
          : call.admin_user_id
            ? String(call.admin_user_id)
            : 'Manlung Admin',
    }));

    // Resolve the actual admin usernames for the callback results.
    if (calls.length) {
      const adminIds = [
        ...new Set(
          calls
            .map(call => call.admin_user_id)
            .filter(Boolean)
        ),
      ];

      if (adminIds.length) {
        const { data: admins, error: adminError } =
          await supabase
            .from('recovery_users')
            .select('id, username, email')
            .in('id', adminIds);

        if (adminError) throw adminError;

        const adminMap = new Map(
          (admins || []).map(admin => [
            String(admin.id),
            admin.username || admin.email || 'Manlung Admin',
          ])
        );

        for (const call of calls) {
          call.admin_name =
            adminMap.get(String(call.admin_user_id)) ||
            'Manlung Admin';
        }
      }
    }

    res.json({
      success: true,
      calls,
    });
  } catch (error) {
    console.error('Client callback poll error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Client accepts an admin callback. This does not put the client into the admin queue.
router.put('/:id/reject-client', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Client access required' });
    const session = await CallSession.findById(req.params.id);
    if (!session || session.client_user_id !== req.user.id || !session.admin_user_id || session.status !== 'ringing') {
      return res.status(404).json({ error: 'Callback not found.' });
    }
    const updated = await CallSession.setStatus(req.params.id, 'rejected', 'client_declined_callback');
    res.json({ success: true, session: updated });
  } catch (error) {
    console.error('Client reject callback error:', error);
    res.status(500).json({ error: error.message || 'Could not reject callback.' });
  }
});

router.put('/:id/accept-client', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Client access required' });
    const { data, error } = await supabase
      .from('recovery_call_sessions')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('client_user_id', req.user.id)
      .eq('status', 'ringing')
      .not('admin_user_id', 'is', null)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'This callback is no longer available.' });
    await AdminPresence.setBusy(data.admin_user_id, true);
    res.json({ success: true, session: data });
  } catch (error) {
    console.error('Client accept callback error:', error);
    res.status(500).json({ error: error.message || 'Could not accept callback.' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    let session = await CallSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Call session not found' });

    const isParticipant = session.client_user_id === req.user.id || session.admin_user_id === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Not part of this call' });

    session = await CallSession.expireIfRingingTooLong(session);
    if (session.admin_user_id) {
      const { data: admin } = await supabase.from('recovery_users').select('username, email').eq('id', session.admin_user_id).maybeSingle();
      session.admin_name = admin?.username || admin?.email || 'Admin';
    }
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

    const pendingCallback = await supabase
      .from('recovery_call_sessions')
      .select('id')
      .eq('admin_user_id', req.user.id)
      .eq('status', 'ringing')
      .is('ended_at', null)
      .limit(1)
      .maybeSingle();
    if (pendingCallback.error) throw pendingCallback.error;
    if (pendingCallback.data) {
      return res.status(409).json({ error: 'Finish or cancel your pending client callback before accepting another call.' });
    }

    const accepted = await CallSession.accept(req.params.id, req.user.id);
    if (!accepted) {
      return res.status(409).json({ error: 'This call was already answered or cancelled by someone else.' });
    }

    await AdminPresence.setBusy(req.user.id, true);
    res.json({ success: true, session: accepted });
  } catch (error) {
    console.error('Accept call error:', error);
    if (error.code === '23505' || String(error.message || '').includes('ADMIN_ACTIVE_CALL_LIMIT')) {
      return res.status(409).json({ error: 'You already have an active call. End it before accepting another.' });
    }
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
