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
  let autoSubscriptionTriggered = false;
  let expiryTimer = null;

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

  function formatTrialWindowDate(iso) {
    // Display in the business's own timezone (Africa/Nairobi) regardless of
    // the visitor's browser timezone, so the dates shown always match what
    // was promised — not shifted by whoever happens to be looking at it.
    return new Date(iso).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function renderEntitlementState(data, headers) {
    const panel = panelContent();

    if (data.status === 'trial') {
      const startLabel = formatTrialWindowDate(data.trialWindow.start);
      const endLabel = formatTrialWindowDate(data.trialWindow.end);
      panel.innerHTML = panelHtml(`
        <p style="font-weight:600; margin-bottom:0.2rem;"><i class="fas fa-gift" style="color:#4ade80;"></i> Free Launch Trial</p>
        <p style="color:#96abc4; margin-bottom:0.8rem;">Free for everyone: ${startLabel} – ${endLabel}</p>
        <button id="callActionBtn" style="width:100%; background:#1f6e4a; color:#fff; border:none; padding:0.6rem; border-radius:10px; font-weight:600; cursor:pointer;">
          <i class="fas fa-phone"></i> Call Admin
        </button>
        <p id="callWidgetStatus" style="color:#96abc4; margin-top:0.5rem;"></p>
      `);
      document.getElementById('callActionBtn').addEventListener('click', () => beginCall(headers));
    } else if (data.status === 'active') {
      const expires = new Date(data.subscriptionExpiresAt);
      panel.innerHTML = panelHtml(`
        <p style="font-weight:600; margin-bottom:0.2rem;"><i class="fas fa-circle-check" style="color:#4ade80;"></i> Subscription Active</p>
        <p style="color:#96abc4; margin-bottom:0.8rem;">KES ${data.amountKes} / month — expires ${expires.toLocaleDateString()}</p>
        <button id="callActionBtn" style="width:100%; background:#1f6e4a; color:#fff; border:none; padding:0.6rem; border-radius:10px; font-weight:600; cursor:pointer;">
          <i class="fas fa-phone"></i> Call Admin
        </button>
        <p id="callWidgetStatus" style="color:#96abc4; margin-top:0.5rem;"></p>
      `);
      document.getElementById('callActionBtn').addEventListener('click', () => beginCall(headers));
    } else {
      const endLabel = formatTrialWindowDate(data.trialWindow.end);
      const headline = data.status === 'expired' ? 'Your subscription has expired.' : `The free launch trial ended ${endLabel}.`;
      panel.innerHTML = panelHtml(`
        <p style="font-weight:600; margin-bottom:0.4rem;"><i class="fas fa-clock" style="color:#f87171;"></i> ${headline}</p>
        <p style="color:#96abc4; margin-bottom:0.8rem;">Subscribe for <strong>KES ${data.amountKes} / month</strong> to use Call Admin.</p>
        <button id="subscribeBtn" style="width:100%; background:#2451d6; color:#fff; border:none; padding:0.6rem; border-radius:10px; font-weight:600; cursor:pointer;">
          <i class="fas fa-credit-card"></i> Subscribe for KES ${data.amountKes}
        </button>
        <p id="callWidgetStatus" style="color:#96abc4; margin-top:0.5rem;"></p>
      `);
      const subscribeBtn = document.getElementById('subscribeBtn');
      subscribeBtn.addEventListener('click', () => startSubscription(headers));

      // Automatically trigger the checkout once the free period is over.
      // Browsers may block payment popups that are not directly user-initiated,
      // so the visible Subscribe button remains available as a fallback.
      if (!autoSubscriptionTriggered) {
        autoSubscriptionTriggered = true;
        setTimeout(() => {
          const btn = document.getElementById('subscribeBtn');
          if (btn) btn.click();
        }, 700);
      }
    }
  }

  async function startSubscription(headers) {
    const statusEl = document.getElementById('callWidgetStatus');
    statusEl.textContent = 'Preparing checkout…';
    try {
      const config = await window.ManlungCallWebRTC.getPublicConfig();
      if (!config.paystackPublicKey) { statusEl.textContent = 'Payment service is not configured. Please try again later.'; return; }
      if (typeof PaystackPop === 'undefined') { statusEl.textContent = 'Payment checkout could not load. Please refresh and try again.'; return; }

      const initRes = await fetch('/api/subscription/initialize', { method: 'POST', headers });
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
      const availRes = await fetch('/api/calls/availability', { headers });
      const availData = await availRes.json();
      if (!availRes.ok || !availData.available) {
        panel.innerHTML = panelHtml(`
          <p style="color:#f87171; margin-bottom:0.6rem;">Admin is currently unavailable.</p>
          <p style="color:#96abc4;">Please submit a recovery request and we will respond as soon as possible.</p>
          <button id="retryAvailabilityBtn" style="display:block; width:100%; background:#29385a; color:#fff; border:none; padding:0.5rem; border-radius:10px; margin-top:0.6rem; cursor:pointer;">Check Again</button>
          <a href="/client/request.html" style="display:block; text-align:center; background:#2451d6; color:#fff; padding:0.5rem; border-radius:10px; text-decoration:none; margin-top:0.6rem;">Submit a Request</a>
        `);
        document.getElementById('retryAvailabilityBtn')?.addEventListener('click', () => beginCall(headers));
        return;
      }

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

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function scheduleSubscriptionExpiry() {
    const token = localStorage.getItem('clientToken');
    if (!token) return;

    try {
      const res = await fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'trial' && data.trialWindow?.end) {
        const delay = new Date(data.trialWindow.end).getTime() - Date.now();
        if (delay > 0 && delay < 2147483647) {
          clearTimeout(expiryTimer);
          expiryTimer = setTimeout(() => {
            const panel = document.getElementById('callWidgetPanel');
            if (panel) panel.style.display = 'block';
            refreshEntitlementPanel();
          }, delay + 250);
        }
      } else if (data.status === 'expired' || data.status === 'payment_required') {
        const panel = document.getElementById('callWidgetPanel');
        if (panel) panel.style.display = 'block';
        refreshEntitlementPanel();
      }
    } catch (_) {
      // Normal transient/network failure; the normal widget refresh remains available.
    }
  }

  async function init() {
    buildWidget();
    try { await loadScript('https://js.paystack.co/v2/inline.js'); } catch (e) { console.warn('Paystack SDK failed to load'); }
    try { await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'); } catch (e) { console.warn('Supabase Realtime SDK failed to load'); }
    scheduleSubscriptionExpiry();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
