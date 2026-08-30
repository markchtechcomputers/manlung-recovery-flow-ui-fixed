
(() => {
  'use strict';

  const TOKEN_KEY = 'clientToken';
  const USER_KEY = 'clientUser';
  const INACTIVITY_MS = 30 * 60 * 1000;
  let logoutTimer = null;
  let clientAuthenticated = false;

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
  }
  function clearClientSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('requestFormDraft');
    } catch (_) {}
    clientAuthenticated = false;
  }
  function safeNext() {
    const next = `${location.pathname}${location.search}`;
    return next.startsWith('/') && !next.startsWith('//') ? next : '/';
  }
  function loginUrl() {
    return `/login.html?next=${encodeURIComponent(safeNext())}`;
  }

  async function verifyClient() {
    const token = getToken();
    if (!token) return false;
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('session invalid');
      const data = await response.json();
      if (data.success && data.user?.role === 'client') {
        try { localStorage.setItem(USER_KEY, JSON.stringify(data.user)); } catch (_) {}
        clientAuthenticated = true;
        startInactivityTimer();
        return true;
      }
    } catch (_) {}
    clearClientSession();
    return false;
  }

  function startInactivityTimer() {
    if (logoutTimer) clearTimeout(logoutTimer);
    if (!clientAuthenticated) return;
    logoutTimer = setTimeout(() => {
      clearClientSession();
      if (location.pathname.startsWith('/client/')) {
        location.replace('/login.html?reason=timeout');
      } else {
        renderAccountSection();
      }
    }, INACTIVITY_MS);
  }

  function refreshActivity() {
    if (clientAuthenticated) startInactivityTimer();
  }

  async function logout() {
    clearClientSession();
    // The client API uses stateless bearer JWTs. Removing the browser token
    // ends this browser session without touching admin/owner sessions.
    window.location.replace('/login.html?loggedOut=1');
  }

  function createAccountSection() {
    const existing = document.querySelector('.manlung-account-section');
    if (existing) return existing;
    const el = document.createElement('div');
    el.className = 'manlung-account-section';
    el.setAttribute('aria-label', 'Account');
    return el;
  }

  function renderAccountSection() {
    const actions = document.querySelector('.site-header .header-actions');
    if (!actions) return;

    const el = createAccountSection();
    el.innerHTML = '';

    if (clientAuthenticated) {
      let user = null;
      try { user = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) {}
      const name = user?.username || user?.email || 'My Account';

      const account = document.createElement('a');
      account.className = 'account-user';
      account.href = '/client/dashboard.html';
      account.textContent = name;

      const out = document.createElement('button');
      out.type = 'button';
      out.className = 'account-logout';
      out.textContent = 'Log Out';
      out.addEventListener('click', logout);

      el.append(account, out);
    } else {
      const label = document.createElement('span');
      label.className = 'account-label';
      label.innerHTML = '<i class="fas fa-user-lock" aria-hidden="true"></i> Account';

      const signIn = document.createElement('a');
      signIn.className = 'account-signin';
      signIn.href = `/login.html?next=${encodeURIComponent(safeNext())}`;
      signIn.innerHTML = '<i class="fas fa-right-to-bracket" aria-hidden="true"></i> Sign In';

      const signUp = document.createElement('a');
      signUp.className = 'account-signup';
      signUp.href = `/login.html?mode=register&next=${encodeURIComponent(safeNext())}`;
      signUp.innerHTML = '<i class="fas fa-user-plus" aria-hidden="true"></i> Create Account';

      el.append(label, signIn, signUp);
    }

    actions.appendChild(el);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function guardRequestLinks() {
    document.querySelectorAll('a[href="/client/request.html"]').forEach((link) => {
      if (link.dataset.authGuardBound === 'true') return;
      link.dataset.authGuardBound = 'true';
      link.addEventListener('click', async (event) => {
        if (clientAuthenticated) return;
        event.preventDefault();
        window.location.href = '/login.html?next=' + encodeURIComponent('/client/request.html');
      });
    });
  }

  async function boot() {
    if (location.pathname === '/login.html' || location.pathname.startsWith('/admin/')) return;
    await verifyClient();
    renderAccountSection();
    guardRequestLinks();

    // Re-check periodically so a revoked/expired token doesn't leave a stale UI.
    setInterval(async () => {
      const wasAuthenticated = clientAuthenticated;
      const nowAuthenticated = await verifyClient();
      if (wasAuthenticated !== nowAuthenticated) renderAccountSection();
    }, 5 * 60 * 1000);
  }

  ['click','keydown','pointermove','touchstart'].forEach(eventName => {
    window.addEventListener(eventName, refreshActivity, { passive: true });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ManlungAuth = {
    isAuthenticated: () => clientAuthenticated,
    logout,
    verify: verifyClient,
  };
})();
