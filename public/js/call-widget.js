/* Client "Call Admin" widget — floating panel, bottom-right.
   States: idle -> checking entitlement -> (trial|active|expired) ->
   requesting-mic -> calling -> connected -> ended.
   Entitlement, admin availability, and call authorization are all enforced
   server-side (see routes/calls.js, routes/subscription.js) — this file
   only reflects what the server says, never decides access on its own. */

(function () {
  let currentPeer = null;
  let currentSessionId = null;
  let pollTimer = null;
  let currentCallbackId = null;
  let callbackPollTimer = null;
  let autoSubscriptionTriggered = false;

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

  async function refreshEntitlementPanel() {
    const panel = panelContent();
    const headers = authHeaders();

    if (!headers) {
      panel.innerHTML = panelHtml(`
        <p style="margin-bottom:0.8rem;">Sign in to your client account to use Call Admin.</p>
        <a href="/login.html" style="display:block; text-align:center; background:#2451d6; color:#fff; padding:0.5rem; border-radius:10px; text-decoration:none;">Sign In</a>
      `);
      return;
    }

    panel.innerHTML = panelHtml('<p style="color:#96abc4;">Checking access…</p>');

    try {
      const res = await fetch('/api/subscription/status', { headers });
      if (res.status === 401) {
        localStorage.removeItem('clientToken');
        panel.innerHTML = panelHtml(`<p>Session expired. <a href="/login.html" style="color:#6ea8ff;">Sign in again</a>.</p>`);
        return;
      }
      const data = await res.json();
      renderEntitlementState(data, headers);
    } catch (e) {
      panel.innerHTML = panelHtml('<p style="color:#f87171;">Could not check access. Please try again.</p>');
    }
  }

  function renderEntitlementState(data, headers) {
    const panel = panelContent();

    if (data.status === 'active') {
      const expires =
        new Date(data.subscriptionExpiresAt);

      panel.innerHTML = panelHtml(`
        <p style="font-weight:700;margin-bottom:.25rem;">
          <i class="fas fa-circle-check" style="color:#4ade80;"></i>
          Subscription Active
        </p>

        <p style="color:#96abc4;margin-bottom:.8rem;">
          Call Admin access until
          <strong>${expires.toLocaleDateString()}</strong>
        </p>

        <button
          id="callActionBtn"
          style="width:100%;background:#1f6e4a;color:#fff;border:none;padding:.65rem;border-radius:10px;font-weight:700;cursor:pointer;"
        >
          <i class="fas fa-phone"></i>
          Call Admin
        </button>

        <p
          id="callWidgetStatus"
          style="color:#96abc4;margin-top:.5rem;"
        ></p>
      `);

      document
        .getElementById('callActionBtn')
        ?.addEventListener(
          'click',
          () => beginCall(headers)
        );

      return;
    }

    const plans =
      Array.isArray(data.plans)
        ? data.plans
        : [];

    const planStyles = {
      monthly: {
        color: '#2563eb',
        label: '1 Month',
        note: '30 days',
      },
      three_months: {
        color: '#7c3aed',
        label: '3 Months',
        note: 'Save 10%',
      },
      six_months: {
        color: '#059669',
        label: '6 Months',
        note: 'Save 20%',
      },
      yearly: {
        color: '#d97706',
        label: '1 Year',
        note: 'Save 30% · Best Value',
      },
    };

    const headline =
      data.status === 'expired'
        ? 'Your Call Admin subscription has expired.'
        : 'Call Admin requires a subscription.';

    panel.innerHTML = panelHtml(`
      <div style="margin-bottom:.8rem;">
        <p style="font-weight:800;margin:0 0 .25rem;">
          <i class="fas fa-credit-card"></i>
          ${headline}
        </p>

        <p style="color:#96abc4;margin:0;">
          Choose a plan to continue calling Admin.
        </p>
      </div>

      <div style="display:grid;gap:.5rem;">
        ${
          plans.map(plan => {
            const style =
              planStyles[plan.code] ||
              {
                color:'#2563eb',
                label:plan.label || 'Subscription',
                note:`${plan.days} days`,
              };

            return `
              <button
                type="button"
                class="call-plan-btn"
                data-plan="${String(plan.code).replace(/"/g,'&quot;')}"
                style="
                  width:100%;
                  display:flex;
                  align-items:center;
                  justify-content:space-between;
                  gap:.7rem;
                  padding:.7rem .75rem;
                  border:1px solid ${style.color};
                  border-radius:11px;
                  background:rgba(255,255,255,.04);
                  color:#fff;
                  cursor:pointer;
                  text-align:left;
                "
              >
                <span>
                  <strong style="display:block;">
                    ${style.label}
                  </strong>
                  <small style="color:#a8b8ce;">
                    ${style.note}
                  </small>
                </span>

                <strong style="font-size:.95rem;">
                  KES ${Number(plan.amountKes).toLocaleString()}
                </strong>
              </button>
            `;
          }).join('')
        }
      </div>

      <p
        id="callWidgetStatus"
        style="color:#96abc4;margin:.65rem 0 0;"
      ></p>
    `);

    document
      .querySelectorAll('.call-plan-btn')
      .forEach(button => {
        button.addEventListener(
          'click',
          () => startSubscription(
            headers,
            button.dataset.plan
          )
        );
      });
  }

  async function startSubscription(headers, planCode) {
    const statusEl = document.getElementById('callWidgetStatus');
    statusEl.textContent = 'Preparing selected subscription…';
    try {
      const config = await window.ManlungCallWebRTC.getPublicConfig();
      if (!config.paystackPublicKey) { statusEl.textContent = 'Payment service is not configured. Please try again later.'; return; }
      if (typeof PaystackPop === 'undefined') { statusEl.textContent = 'Payment checkout could not load. Please refresh and try again.'; return; }

      const initRes = await fetch('/api/subscription/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          plan: planCode || 'monthly',
        }),
      });
      const initData = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !initData.success) {
        statusEl.textContent = initData.error || `Could not start checkout (${initRes.status}).`;
        return;
      }

      const popup = new PaystackPop();
      const verifyPayment = async (reference) => {
        statusEl.textContent = 'Verifying payment…';
        const verifyRes = await fetch('/api/subscription/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ reference }),
        });
        const verifyData = await verifyRes.json().catch(() => ({}));
        if (verifyData.success) {
          statusEl.textContent = 'Subscribed! ✓';
          return true;
        }
        if (!verifyRes.ok && verifyData.error) statusEl.textContent = verifyData.error;
        return false;
      };

      if (initData.accessCode && typeof popup.resumeTransaction === 'function') {
        try {
          popup.resumeTransaction(initData.accessCode);
        } catch (error) {
          console.error('Paystack resumeTransaction error:', error);
          if (initData.authorizationUrl) { window.location.href = initData.authorizationUrl; return; }
          throw error;
        }
        // resumeTransaction opens the server-created transaction. Poll the
        // authenticated verify endpoint because V2 resumeTransaction uses the
        // access code rather than per-transaction callbacks.
        let attempts = 0;
        const poll = async () => {
          attempts += 1;
          try {
            if (await verifyPayment(initData.reference)) {
              setTimeout(refreshEntitlementPanel, 500);
              return;
            }
          } catch (error) {
            console.warn('Subscription verification poll:', error);
          }
          if (attempts < 45) setTimeout(poll, 2000);
          else statusEl.textContent = 'Payment is still being confirmed. If you were charged, refresh this page shortly.';
        };
        setTimeout(poll, 2500);
      } else {
        popup.newTransaction({
          key: config.paystackPublicKey,
          email: initData.email,
          amount: initData.amountKobo,
          currency: 'KES',
          reference: initData.reference,
          onSuccess: (transaction) => verifyPayment(transaction?.reference || initData.reference)
            .then(ok => { if (ok) setTimeout(refreshEntitlementPanel, 500); }),
          onCancel: () => { statusEl.textContent = 'Checkout cancelled.'; },
          onError: (error) => { statusEl.textContent = error?.message || 'Payment checkout failed.'; },
        });
      }
    } catch (e) {
      console.error(e);
      statusEl.textContent = 'Something went wrong starting checkout.';
    }
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
    try { await loadScript('https://js.paystack.co/v2/inline.js'); } catch (e) { console.warn('Paystack SDK failed to load'); }
    try { await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'); } catch (e) { console.warn('Supabase Realtime SDK failed to load'); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
