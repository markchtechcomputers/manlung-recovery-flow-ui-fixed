/* Client "Call Admin" widget — floating panel, bottom-right.
   Call Admin is free. The existing authenticated WebRTC/session flow is kept;
   this widget only starts calls, receives Admin callbacks, and manages the
   client-side ringtone preference. */


(function injectCallWidgetStyles() {
  if (document.getElementById('manlung-call-ui-styles')) return;
  const style = document.createElement('style');
  style.id = 'manlung-call-ui-styles';
  style.textContent = `
    #callWidget {
      --call-green:#20c77a;
      --call-green-dark:#128a55;
      --call-red:#ef4444;
      --call-blue:#4f8cff;
      --call-bg:#0b1428;
      --call-card:#111d35;
      --call-border:rgba(255,255,255,.10);
      --call-muted:#9fb0ca;
    }

    #callWidgetBtn {
      min-height:48px !important;
      padding:.72rem 1.05rem !important;
      border-radius:999px !important;
      background:linear-gradient(135deg,#20c77a,#128a55) !important;
      box-shadow:0 10px 30px rgba(18,138,85,.30) !important;
      transition:transform .2s ease,box-shadow .2s ease !important;
    }

    #callWidgetBtn:hover {
      transform:translateY(-2px) !important;
      box-shadow:0 14px 34px rgba(18,138,85,.42) !important;
    }

    #callWidgetPanel {
      background:
        radial-gradient(circle at top,#1b315d 0,#101b32 42%,#0b1428 100%) !important;
      border:1px solid var(--call-border) !important;
      border-radius:22px !important;
      padding:1rem !important;
      box-shadow:0 24px 70px rgba(0,0,0,.48) !important;
      backdrop-filter:blur(18px);
    }

    #callWidgetContent {
      text-align:center;
    }

    .manlung-call-avatar {
      width:82px;
      height:82px;
      margin:.35rem auto .85rem;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(145deg,#244b82,#162b50);
      border:3px solid rgba(255,255,255,.10);
      box-shadow:0 10px 35px rgba(0,0,0,.35);
      position:relative;
    }

    .manlung-call-avatar i {
      font-size:2.1rem;
      color:#dce9ff;
    }

    .manlung-call-avatar.calling {
      animation:manlungCallPulse 1.5s infinite;
    }

    .manlung-call-avatar.calling:after {
      content:"";
      position:absolute;
      inset:-9px;
      border:2px solid rgba(32,199,122,.45);
      border-radius:50%;
      animation:manlungRing 1.5s infinite;
    }

    .manlung-call-name {
      font-size:1.05rem;
      font-weight:800;
      color:#fff;
      margin:.15rem 0;
    }

    .manlung-call-status {
      color:var(--call-muted);
      font-size:.82rem;
      margin:.2rem 0 .9rem;
    }

    .manlung-call-connected {
      color:#4ade80 !important;
      font-weight:800;
    }

    .manlung-call-timer {
      font-size:2rem !important;
      font-weight:800 !important;
      letter-spacing:.08em;
      color:#fff !important;
      margin:.65rem 0 1rem !important;
    }

    .manlung-call-actions {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8px;
    }

    .manlung-call-action {
      border:1px solid rgba(255,255,255,.08);
      border-radius:13px;
      padding:.72rem .5rem;
      color:#fff;
      background:#1a2a49;
      cursor:pointer;
      font-weight:700;
      transition:transform .15s ease,background .15s ease;
    }

    .manlung-call-action:hover {
      transform:translateY(-1px);
      background:#22375e;
    }

    .manlung-call-action.end,
    .manlung-call-action.decline {
      background:linear-gradient(135deg,#ef4444,#b91c1c);
    }

    .manlung-call-action.accept {
      background:linear-gradient(135deg,#20c77a,#128a55);
    }

    .manlung-call-action.cancel {
      width:100%;
      margin-top:.7rem;
      background:#7f1d1d;
    }

    .manlung-call-action i {
      margin-right:5px;
    }

    .manlung-call-badge {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:.35rem .7rem;
      border-radius:999px;
      background:rgba(32,199,122,.12);
      color:#4ade80;
      font-size:.72rem;
      font-weight:800;
      margin-bottom:.45rem;
    }

    .manlung-call-badge .dot {
      width:7px;
      height:7px;
      border-radius:50%;
      background:#4ade80;
      animation:manlungBlink 1s infinite;
    }

    @keyframes manlungCallPulse {
      0%,100% { transform:scale(1); }
      50% { transform:scale(1.06); }
    }

    @keyframes manlungRing {
      0% { transform:scale(.85); opacity:.8; }
      100% { transform:scale(1.25); opacity:0; }
    }

    @keyframes manlungBlink {
      0%,100% { opacity:1; }
      50% { opacity:.35; }
    }

    @media (max-width:600px) {
      #callWidget {
        right:10px !important;
        bottom:calc(10px + env(safe-area-inset-bottom)) !important;
      }

      #callWidgetBtn {
        min-width:48px !important;
        width:48px !important;
        height:48px !important;
        padding:0 !important;
        justify-content:center !important;
      }

      #callWidgetBtn #callWidgetLabel {
        display:none;
      }

      #callWidgetPanel {
        width:min(340px,calc(100vw - 20px)) !important;
        right:0 !important;
        bottom:58px !important;
        border-radius:20px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();

(function () {
  let currentPeer = null;
  let currentSessionId = null;
  let pollTimer = null;
  let currentCallbackId = null;
  let callbackPollTimer = null;

  function el(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }

  function authHeaders() {
    const token = localStorage.getItem('clientToken');
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  function buildWidget() {
    const wrap = el(`
      <div id="callWidget" style="position:fixed; bottom:calc(12px + env(safe-area-inset-bottom)); right:12px; z-index:200; font-family:'Inter',-apple-system,sans-serif;">
        <button id="callWidgetBtn" style="
          background:#1f6e4a; color:#fff; border:none; border-radius:50px;
          padding:0.7rem 1.1rem; font-weight:600; font-size:0.85rem; cursor:pointer;
          box-shadow:0 6px 20px rgba(0,0,0,0.25); display:flex; align-items:center; gap:8px;
        "><i class="fas fa-phone"></i> <span id="callWidgetLabel">Call Admin</span></button>
        <div id="callWidgetPanel" style="display:none; position:absolute; bottom:56px; right:0; width:min(320px, calc(100vw - 24px)); max-height:calc(100vh - 100px); overflow:auto; background:#101f42; color:#e6ecf5; border:1px solid #29385a; border-radius:16px; padding:1.1rem; box-shadow:0 10px 30px rgba(0,0,0,0.35);">
          <div style="display:flex;justify-content:flex-end;margin:-0.35rem -0.35rem 0.25rem 0;">
            <button id="callWidgetCloseBtn" type="button" aria-label="Close Call Admin panel" title="Close" style="width:34px;height:34px;border:0;border-radius:50%;background:#29385a;color:#fff;cursor:pointer;font-size:1rem;"><i class="fas fa-times"></i></button>
          </div>
          <div id="callWidgetContent"></div>
        </div>
      </div>
    `);
    document.body.appendChild(wrap);
    document.getElementById('callWidgetBtn').addEventListener('click', togglePanel);
    document.getElementById('callWidgetCloseBtn').addEventListener('click', closePanel);
    return wrap;
  }

  function togglePanel() {
    const panel = document.getElementById('callWidgetPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block' && !currentPeer) refreshEntitlementPanel();
  }

  function closePanel() {
    const panel = document.getElementById('callWidgetPanel');
    if (panel) panel.style.display = 'none';
  }

  function panelHtml(inner) {
    return `<div style="font-size:0.85rem;">${inner}</div>`;
  }

  function panelContent() {
    return document.getElementById('callWidgetContent') || document.getElementById('callWidgetPanel');
  }

  function ringtoneSettingsHtml(role = 'client') {
    const options = window.ManlungCallRingtone?.options || [];
    const current = window.ManlungCallRingtone?.get(role) || options[0]?.id || '';
    return `
      <div style="margin-top:.85rem;padding-top:.75rem;border-top:1px solid #29385a;">
        <label for="callRingtoneSelect" style="display:block;font-weight:700;margin-bottom:.35rem;">Call ringtone</label>
        <div style="display:flex;gap:7px;align-items:center;">
          <select id="callRingtoneSelect" style="flex:1;background:#17284d;color:#fff;border:1px solid #3b4d70;border-radius:9px;padding:.48rem;">
            ${options.map(option => `<option value="${option.id}" ${option.id === current ? 'selected' : ''}>${option.name}</option>`).join('')}
          </select>
          <button id="testRingtoneBtn" type="button" style="background:#29385a;color:#fff;border:0;border-radius:9px;padding:.48rem .65rem;cursor:pointer;" title="Test ringtone">Test</button>
        </div>
        <small style="display:block;color:#96abc4;margin-top:.3rem;">Choose the sound used when an Admin calls you.</small>
      </div>`;
  }

  function bindRingtoneSettings(role = 'client') {
    const select = document.getElementById('callRingtoneSelect');
    const test = document.getElementById('testRingtoneBtn');
    if (!select || !window.ManlungCallRingtone) return;
    select.addEventListener('change', () => window.ManlungCallRingtone.set(select.value, role));
    test?.addEventListener('click', async () => {
      window.ManlungCallRingtone.set(select.value, role);
      await window.ManlungCallRingtone.preview(role);
    });
  }

  function renderFreeCallPanel() {
    const panel = panelContent();
    panel.innerHTML = panelHtml(`
      <p style="font-weight:800;margin:0 0 .25rem;">
        <i class="fas fa-phone" style="color:#4ade80;"></i>
        Call Admin — Free
      </p>
      <p style="color:#96abc4;margin:0 0 .8rem;">Get help directly from an available Admin. No phone subscription is required.</p>
      <button id="callActionBtn" style="width:100%;background:#1f6e4a;color:#fff;border:none;padding:.65rem;border-radius:10px;font-weight:700;cursor:pointer;">
        <i class="fas fa-phone"></i> Call Admin
      </button>
      <p id="callWidgetStatus" style="color:#96abc4;margin:.5rem 0 0;"></p>
      ${ringtoneSettingsHtml('client')}
    `);
    document.getElementById('callActionBtn')?.addEventListener('click', () => beginCall(authHeaders()));
    bindRingtoneSettings('client');
  }

  async function refreshEntitlementPanel() {
    const panel = panelContent();
    const headers = authHeaders();

    if (!headers) {
      panel.innerHTML = panelHtml(`
        <p style="margin-bottom:.8rem;">Sign in to your client account to use Call Admin.</p>
        <a href="/login.html" style="display:block;text-align:center;background:#2451d6;color:#fff;padding:.5rem;border-radius:10px;text-decoration:none;">Sign In</a>
      `);
      return;
    }

    renderFreeCallPanel();
  }

  let ringVibrateTimer = null;

  function startClientAlert() {
    if (window.ManlungCallRingtone) window.ManlungCallRingtone.start();
    if (navigator.vibrate) {
      try {
        navigator.vibrate([500, 250, 500, 250, 900]);
        clearInterval(ringVibrateTimer);
        ringVibrateTimer = setInterval(() => {
          try { navigator.vibrate([500, 250, 500, 250, 900]); } catch (_) {}
        }, 2600);
      } catch (_) {}
    }
  }

  function stopClientAlert() {
    if (window.ManlungCallRingtone) window.ManlungCallRingtone.stop();
    if (ringVibrateTimer) clearInterval(ringVibrateTimer);
    ringVibrateTimer = null;
    try { navigator.vibrate?.(0); } catch (_) {}
  }

  async function beginCall(headers) {
    if (currentPeer || currentSessionId) return;
    const panel = panelContent();
    panel.innerHTML = panelHtml('<p><i class="fas fa-spinner fa-spin"></i> Checking admin availability…</p>');

    try {
      const availabilityRes = await fetch('/api/calls/availability', { headers, cache: 'no-store' });
      const availability = await availabilityRes.json();
      if (!availabilityRes.ok || !availability.success) {
        throw new Error(availability.error || 'Could not check admin availability.');
      }

      if (availability.state === 'offline') {
        panel.innerHTML = panelHtml('<p style="color:#f87171;">No admins are currently available. Please try again later or call back shortly.</p>');
        return;
      }

      if (availability.state === 'busy') {
        panel.innerHTML = panelHtml('<p style="color:#fbbf24;">All admins are currently assisting other clients. Kindly hold or call back in a few minutes.</p><p style="color:#96abc4;margin-top:.5rem;">Your call can remain in the queue while you wait.</p>');
        await new Promise(resolve => setTimeout(resolve, 900));
      } else {
        panel.innerHTML = panelHtml('<p><i class="fas fa-spinner fa-spin"></i> Connecting you to an available admin…</p>');
      }

      // Keep the existing call session/WebRTC flow unchanged.
      const startRes = await fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({}),
      });
      const startData = await startRes.json();
      if (!startRes.ok || !startData.success) {
        panel.innerHTML = panelHtml(`<p style="color:#f87171;">${startData.error || 'Could not start call.'}</p>`);
        return;
      }

      currentSessionId = startData.sessionId;
      renderCallUI('calling');
      startClientAlert();
      startPollingForStatus(headers);
    } catch (e) {
      stopClientAlert();
      console.error(e);
      renderCallUI('connection-failed', e.message);
    }
  }

  function startPollingForStatus(headers) {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!currentSessionId) {
        clearInterval(pollTimer);
        return;
      }

      try {
        const res = await fetch(`/api/calls/${currentSessionId}`, { headers });
        const data = await res.json();
        if (!res.ok || !data.success) return;

        const status = data.session.status;

        if (status === 'ringing') {
          renderCallUI('calling');
          return;
        }

        if (status === 'accepted' && !currentPeer) {
          stopClientAlert();
          clearInterval(pollTimer);
          pollTimer = null;

          renderCallUI('requesting-mic');

          currentPeer = new window.ManlungCallWebRTC.CallPeer({
            sessionId: currentSessionId,
            isInitiator: true,
            headers,
            onStateChange: (state, detail) => renderCallUI(state, detail),
            onDuration: (d) => updateDuration(d),
          });

          try {
            await currentPeer.start();
          } catch (e) {
            console.error('Client WebRTC start error:', e);
            renderCallUI('connection-failed', e.message);
            await endCall();
          }
          return;
        }

        if (['rejected', 'missed', 'ended'].includes(status)) {
          stopClientAlert();
          clearInterval(pollTimer);
          pollTimer = null;
          renderCallUI(status === 'rejected' ? 'rejected' : status === 'missed' ? 'no-admin-answered' : 'ended-by-remote');
          cleanupCall();
        }
      } catch (_) {
        // transient error; next poll retries
      }
    }, 1000);
  }

  function renderCallUI(state, detail) {
    const panel = panelContent();
    const label = document.getElementById('callWidgetLabel');

    const states = {
      'requesting-mic': `<p><i class="fas fa-microphone"></i> Requesting microphone access…</p>`,
      'calling': `
        <p style="font-weight:600;">📞 Help Call</p>
        <p style="color:#4ade80; margin:0.4rem 0; font-weight:600;">🔔 Ringing Admin…</p>
        <p style="color:#96abc4; font-size:0.78rem;">Waiting for an available administrator to answer.</p>
        <button id="cancelCallBtn" style="width:100%; background:#c0392b; color:#fff; border:none; padding:0.5rem; border-radius:10px; font-weight:600; cursor:pointer; margin-top:0.6rem;">Cancel Call</button>
      `,
      'connecting': `<p><i class="fas fa-spinner fa-spin"></i> Connecting…</p>`,
      'connected': `
        <p style="font-weight:600; color:#4ade80;">🟢 Connected</p>
        <p id="connectedAdminName" style="color:#96abc4;margin:.2rem 0 .5rem;"></p>
        <p id="callDuration" style="font-size:1.4rem; margin:0.4rem 0;">00:00</p>
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <button id="speakerBtn" style="flex:1; background:#29385a; color:#fff; border:none; padding:0.5rem; border-radius:10px; cursor:pointer;"><i class="fas fa-volume-high"></i> Enable Audio</button>
        </div>
        <div style="display:flex; gap:8px;">
          <button id="muteBtn" style="flex:1; background:#29385a; color:#fff; border:none; padding:0.5rem; border-radius:10px; cursor:pointer;"><i class="fas fa-microphone"></i> Mute</button>
          <button id="endCallBtn" style="flex:1; background:#c0392b; color:#fff; border:none; padding:0.5rem; border-radius:10px; cursor:pointer;"><i class="fas fa-phone-slash"></i> End</button>
        </div>
      `,
      'reconnecting': `<p style="color:#facc15;"><i class="fas fa-triangle-exclamation"></i> Reconnecting…</p>`,
      'ended-by-remote': `<p>Call ended by admin.</p>`,
      'permission-denied': `<p style="color:#f87171;">Microphone permission denied. Allow microphone access to call.</p>`,
      'connection-failed': `<p style="color:#f87171;">Connection failed${detail ? ': ' + detail : ''}.</p>`,
      'no-admin-answered': `<p style="color:#f87171;">No administrator answered.</p><p style="color:#96abc4;">Please try again later.</p>`,
      'rejected': `<p style="color:#f87171;">Call was declined.</p>`,
    };

    panel.innerHTML = panelHtml(states[state] || `<p>${state}</p>`);

    if (state === 'calling') startClientAlert();
    else if (['requesting-mic','connecting','connected','rejected','no-admin-answered','ended-by-remote','connection-failed','permission-denied'].includes(state)) stopClientAlert();
    if (label) label.textContent = state === 'connected' ? 'On Call' : 'Call Admin';
    if (state === 'connected' && currentSessionId) {
      fetch(`/api/calls/${encodeURIComponent(currentSessionId)}`, { headers: authHeaders(), cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          const nameEl = document.getElementById('connectedAdminName');
          if (nameEl) nameEl.textContent = d?.session?.admin_name ? `Admin: ${d.session.admin_name}` : '';
        }).catch(() => {});
    }

    const cancelBtn = document.getElementById('cancelCallBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => endCall());
    const endBtn = document.getElementById('endCallBtn');
    if (endBtn) endBtn.addEventListener('click', () => endCall());
    const speakerBtn = document.getElementById('speakerBtn');
    if (speakerBtn) speakerBtn.addEventListener('click', async () => {
      const ok = await currentPeer?.enableRemoteAudio();
      speakerBtn.innerHTML = ok
        ? '<i class="fas fa-volume-high"></i> Audio Enabled'
        : '<i class="fas fa-triangle-exclamation"></i> Tap Again';
    });
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) muteBtn.addEventListener('click', () => {
      const isMuted = currentPeer?.toggleMute();
      muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i> Unmute' : '<i class="fas fa-microphone"></i> Mute';
    });
  }

  function updateDuration(text) {
    const el = document.getElementById('callDuration');
    if (el) el.textContent = text;
  }

  async function endCall() {
    const headers = authHeaders();
    if (currentPeer) await currentPeer.end();
    if (currentSessionId && headers) {
      try {
        await fetch(`/api/calls/${currentSessionId}/end`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ reason: 'client_hangup' }) });
      } catch (e) {}
    }
    cleanupCall();
    setTimeout(refreshEntitlementPanel, 500);
  }

  function cleanupCall() {
    clearInterval(pollTimer);
    pollTimer = null;
    stopClientAlert();
    currentPeer = null;
    currentSessionId = null;
  }


  async function pollForAdminCallback() {
    const headers = authHeaders();

    if (!headers || currentPeer || currentSessionId) {
      return;
    }

    try {
      const res = await fetch(
        '/api/calls/client/callbacks',
        {
          headers,
          cache: 'no-store'
        }
      );

      if (!res.ok) return;

      const data =
        await res.json().catch(() => ({}));

      const calls =
        data.success && Array.isArray(data.calls)
          ? data.calls
          : [];

      // If a callback popup is already open, keep watching it.
      // When the Admin cancels, ends, or otherwise clears it,
      // automatically close the stale client popup.
      if (currentCallbackId) {
        const stillPending =
          calls.some(
            call =>
              String(call.id) ===
              String(currentCallbackId)
          );

        if (!stillPending) {
          currentCallbackId = null;
          stopClientAlert();
          refreshEntitlementPanel();
          return;
        }

        return;
      }

      if (calls.length) {
        showAdminCallback(
          calls[0],
          headers
        );
      }

    } catch (_) {}
  }

  function showAdminCallback(call, headers) {
    if (currentCallbackId || currentPeer || currentSessionId) return;
    currentCallbackId = call.id;
    startClientAlert();
    const panel = panelContent();
    const adminName = call.admin_name || 'Manlung Admin';
    panel.innerHTML = panelHtml(`
      <div style="text-align:center;">
        <div style="width:64px;height:64px;margin:0 auto .7rem;border-radius:50%;background:#1f6e4a;display:flex;align-items:center;justify-content:center;">
          <i class="fas fa-phone-volume" style="font-size:28px;color:#fff;"></i>
        </div>
        <p style="font-weight:700;margin-bottom:.35rem;">Incoming Call From ${adminName}</p>
        <p style="color:#96abc4;margin-bottom:.8rem;">${call.case_id ? `Case ${call.case_id}` : 'Support callback'}</p>
        <div style="display:flex;gap:8px;">
          <button id="rejectCallbackBtn" style="flex:1;background:#c0392b;color:#fff;border:0;padding:.55rem;border-radius:10px;cursor:pointer;"><i class="fas fa-phone-slash"></i> Decline</button>
          <button id="acceptCallbackBtn" style="flex:1;background:#1f6e4a;color:#fff;border:0;padding:.55rem;border-radius:10px;cursor:pointer;"><i class="fas fa-phone"></i> Accept</button>
        </div>
      </div>
    `);
    document.getElementById('acceptCallbackBtn')?.addEventListener('click', () => acceptAdminCallback(call.id, headers));
    document.getElementById('rejectCallbackBtn')?.addEventListener('click', () => rejectAdminCallback(call.id, headers));
  }

  async function rejectAdminCallback(id, headers) {
    stopClientAlert();
    try {
      await fetch(`/api/calls/${encodeURIComponent(id)}/reject-client`, { method: 'PUT', headers });
    } catch (_) {}
    currentCallbackId = null;
    refreshEntitlementPanel();
  }

  async function acceptAdminCallback(id, headers) {
    const panel = panelContent();
    panel.innerHTML = panelHtml('<p><i class="fas fa-spinner fa-spin"></i> Connecting to your admin…</p>');
    try {
      const res = await fetch(`/api/calls/${encodeURIComponent(id)}/accept-client`, { method: 'PUT', headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        currentCallbackId = null;
        stopClientAlert();
        panel.innerHTML = panelHtml(`<p style="color:#f87171;">${data.error || 'Callback is no longer available.'}</p>`);
        return;
      }
      currentCallbackId = null;
      currentSessionId = id;
      stopClientAlert();
      currentPeer = new window.ManlungCallWebRTC.CallPeer({
        sessionId: id,
        isInitiator: false,
        headers,
        onStateChange: (state, detail) => renderCallUI(state, detail),
        onDuration: (d) => updateDuration(d),
      });
      await currentPeer.start();
    } catch (e) {
      currentCallbackId = null;
      stopClientAlert();
      renderCallUI('connection-failed', e.message);
    }
  }

  function startCallbackPolling() {
    clearInterval(callbackPollTimer);
    pollForAdminCallback();
    callbackPollTimer = setInterval(pollForAdminCallback, 2000);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function init() {
    buildWidget();
    startCallbackPolling();
    try { await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'); } catch (e) { console.warn('Supabase Realtime SDK failed to load'); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
