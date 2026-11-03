(() => {
  // Show the cookie consent banner and floating preferences icon on the homepage only.
  const IS_COOKIE_CONSENT_HOME = window.location.pathname === '/' ||
    window.location.pathname === '/index.html';
  if (IS_COOKIE_CONSENT_HOME &&
      !document.querySelector('script[data-manlung-cookie-consent]')) {
    const consentScript = document.createElement('script');
    consentScript.src = '/js/cookie-consent.js';
    consentScript.dataset.manlungCookieConsent = 'true';
    document.head.appendChild(consentScript);
  }

  const DISMISS_KEY = 'manlung-pwa-install-dismissed-v4';

  // Preserve the normal browser history inside the Admin Portal.
  // The public-site back guard must never send an Admin page to the clients' home page.
  function isAdminRoute() {
    return window.location.pathname === '/admin' ||
      window.location.pathname.startsWith('/admin/');
  }

  // Keep the public website's existing mobile Back behavior.
  function installMobileBackNavigation() {
    if (window.__manlungBackNavigationInstalled || isAdminRoute()) return;
    window.__manlungBackNavigationInstalled = true;

    const homePath = '/';
    const isHome = () => window.location.pathname === homePath ||
      window.location.pathname === '/index.html';

    function addBackGuard() {
      try {
        window.history.pushState({ manlungBackGuard: true }, '', window.location.href);
      } catch (_) {}
    }

    addBackGuard();
    window.addEventListener('popstate', () => {
      if (!isHome()) {
        window.location.replace(homePath);
        return;
      }
      // At home, keep the user on the main page rather than letting Back close
      // the browser tab or the installed PWA immediately.
      addBackGuard();
    });
  }


  installMobileBackNavigation();

  // Prefer the browser's native PWA install prompt.
  const DISMISS_DAYS = 7;
  const IS_HOME = window.location.pathname === '/' || window.location.pathname === '/index.html';

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  // Keep the CSS viewport unit synchronized with Android/iOS browser chrome and keyboards.
  function syncVisualViewportHeight() {
    const height = window.visualViewport?.height || window.innerHeight;
    if (height > 0) document.documentElement.style.setProperty('--mr-viewport-height', Math.round(height) + 'px');
  }
  syncVisualViewportHeight();
  window.addEventListener('resize', syncVisualViewportHeight, { passive: true });
  window.addEventListener('orientationchange', syncVisualViewportHeight, { passive: true });
  window.visualViewport?.addEventListener('resize', syncVisualViewportHeight, { passive: true });

  // Installed-app shell: hide website chrome, normalize viewport sizing, and
  // show a short branded welcome once at the start of each installed-app session.
  function setupPwaShell() {
    if (!isStandalone()) return;

    if (!document.getElementById('manlung-pwa-shell-style')) {
      const style = document.createElement('style');
      style.id = 'manlung-pwa-shell-style';
      style.textContent = `
        html,html body{width:100%;max-width:100%;min-width:0;min-height:100%;overflow-x:clip}
        html body{min-height:100vh;min-height:100dvh;padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}
        html body *,html body *::before,html body *::after{box-sizing:border-box}
        html body img,html body video,html body iframe,html body canvas{max-width:100%}
        html body input,html body select,html body textarea,html body button{max-width:100%;min-width:0}
        html body main,html body #page,html body .page,html body .admin-shell,html body .tools-shell{min-width:0;max-width:100%}
        html body .manlung-footer,html body footer.manlung-footer,html body>footer{display:none!important}
        #manlung-pwa-welcome{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(circle at 50% 35%,#173d62 0%,#0b2340 42%,#061326 100%);color:#f8fafc;text-align:center;opacity:1;visibility:visible;transition:opacity .42s ease,visibility .42s ease}
        #manlung-pwa-welcome.is-leaving{opacity:0;visibility:hidden;pointer-events:none}
        #manlung-pwa-welcome .mr-welcome-content{width:min(100%,440px);display:flex;flex-direction:column;align-items:center;gap:18px;animation:mrWelcomeIn .65s cubic-bezier(.2,.75,.25,1) both}
        #manlung-pwa-welcome img{display:block;width:clamp(88px,22vw,126px);height:clamp(88px,22vw,126px);object-fit:cover;border-radius:28px;background:#fff;box-shadow:0 18px 50px #0007,0 0 0 1px #ffffff35;animation:mrWelcomeIn .55s cubic-bezier(.2,.75,.25,1) both}
        #manlung-pwa-welcome h1{margin:8px 0 0;color:#fff;font:800 clamp(1.45rem,5vw,2rem)/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.035em;opacity:0;animation:mrWelcomeIn .48s ease .38s both}
        #manlung-pwa-welcome p{max-width:340px;margin:0;color:#d7e5f4;font:500 clamp(.9rem,3.2vw,1.02rem)/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;opacity:0;animation:mrWelcomeIn .48s ease .58s both}
        #manlung-pwa-welcome .mr-welcome-rule{width:54px;height:3px;border-radius:99px;background:linear-gradient(90deg,#22c55e,#38bdf8);opacity:0;animation:mrWelcomeIn .35s ease .26s both}
        @keyframes mrWelcomeIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media(prefers-reduced-motion:reduce){#manlung-pwa-welcome,#manlung-pwa-welcome .mr-welcome-content,#manlung-pwa-welcome img,#manlung-pwa-welcome h1,#manlung-pwa-welcome p,#manlung-pwa-welcome .mr-welcome-rule{transition:none;animation:none;opacity:1}}
      `;
      document.head.appendChild(style);
    }

    let alreadyWelcomed = false;
    try { alreadyWelcomed = sessionStorage.getItem('manlung-pwa-welcomed') === '1'; } catch (_) {}
    if (!alreadyWelcomed && !document.getElementById('manlung-pwa-welcome')) {
      try { sessionStorage.setItem('manlung-pwa-welcomed', '1'); } catch (_) {}
      const splash = document.createElement('div');
      splash.id = 'manlung-pwa-welcome';
      splash.setAttribute('role', 'status');
      splash.setAttribute('aria-label', 'Welcome to Manlung Recovery');
      splash.innerHTML = '<div class="mr-welcome-content"><img src="/icons/icon-192.png" alt="Manlung Recovery app icon"><div class="mr-welcome-rule"></div><h1>Welcome to Manlung Recovery</h1><p>where Technology meets your expectation</p></div>';
      document.body.appendChild(splash);
      window.setTimeout(() => {
        splash.classList.add('is-leaving');
        window.setTimeout(() => splash.remove(), 480);
      }, 1750);
    }
  }

  // Remove only explicit third-party ChatGPT/OpenAI sign-in branding. The
  // Manlung AI assistant and its own controls are deliberately left untouched.
  function removeThirdPartyChatGPTBranding(root = document) {
    const selector = [
      '[data-provider="openai"]','[data-provider="chatgpt"]',
      '[aria-label*="ChatGPT" i]','[aria-label*="OpenAI" i]',
      '[title*="ChatGPT" i]','[title*="OpenAI" i]',
      'a[href*="chatgpt.com"]','a[href*="openai.com"]',
      'img[alt*="ChatGPT" i]','img[alt*="OpenAI" i]',
      'img[src*="chatgpt" i]','img[src*="openai" i]'
    ].join(',');
    root.querySelectorAll?.(selector).forEach(node => {
      const control = node.closest('a,button,[role="button"]') || node;
      if (control.id === 'manlungAiButton' || control.closest('#manlungAiWindow,#manlung-ai-chat')) return;
      control.remove();
    });
  }

  function hasUnsavedPwaInput() {
    return Array.from(document.querySelectorAll('form')).some(form => {
      if (form.dataset.allowPwaAutoRefresh === 'true') return false;
      return Array.from(form.elements).some(field => {
        if (!field || field.disabled || field.type === 'hidden' || field.type === 'submit' || field.type === 'button') return false;
        if (field.type === 'checkbox' || field.type === 'radio') return field.checked !== field.defaultChecked;
        return String(field.value ?? '') !== String(field.defaultValue ?? '');
      });
    });
  }

  function wasRecentlyDismissed() {
    try {
      const value = localStorage.getItem(DISMISS_KEY);
      if (!value) return false;

      const dismissedAt = Number(value);
      return Number.isFinite(dismissedAt) && (Date.now() - dismissedAt) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  function rememberDismissal() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  function addBannerStyles() {
    if (document.getElementById('manlung-pwa-banner-style')) return;

    const style = document.createElement('style');
    style.id = 'manlung-pwa-banner-style';

    style.textContent = `
      .manlung-pwa-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: .6rem;
        min-height: 78px;
        padding: .6rem .65rem;
        padding-top: calc(.6rem + env(safe-area-inset-top));
        background: radial-gradient(ellipse at top right, rgba(249,115,22,.18), transparent 48%), linear-gradient(135deg, #071629, #102b49);
        color: #f8fafc;
        border-bottom: 1px solid rgba(15,23,42,.12);
        box-shadow: 0 8px 24px rgba(15,23,42,.18);
        transform: translateY(-110%);
        opacity: 0;
        visibility: hidden;
        transition:
          transform .28s ease,
          opacity .28s ease,
          visibility .28s ease;
      }

      .manlung-pwa-banner.is-visible {
        transform: translateY(0);
        opacity: 1;
        visibility: visible;
      }

      .manlung-pwa-close {
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        border: 0;
        background: transparent;
        color: #cbd5e1;
        font-size: 1.8rem;
        line-height: 1;
        cursor: pointer;
        display: grid;
        place-items: center;
      }

      .manlung-pwa-icon {
        width: 52px;
        height: 52px;
        flex: 0 0 52px;
        object-fit: cover;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 4px 12px rgba(15,23,42,.14);
      }

      .manlung-pwa-copy {
        min-width: 0;
        flex: 1;
      }

      .manlung-pwa-title {
        display: block;
        margin: 0 0 3px;
        color: #f8fafc;
        font-size: .96rem;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .manlung-pwa-text {
        display: block;
        color: #d5deea;
        font-size: .72rem;
        line-height: 1.25;
      }

      .manlung-pwa-download {
        flex: 0 0 auto;
        min-width: 100px;
        min-height: 44px;
        padding: .55rem .8rem;
        border: 0;
        border-radius: 10px;
        background: linear-gradient(135deg, #f97316, #ea580c);
        color: #fff;
        font-size: .8rem;
        font-weight: 900;
        letter-spacing: .02em;
        cursor: pointer;
        box-shadow: 0 5px 16px rgba(234,88,12,.3);
      }

      @keyframes manlung-install-bounce { 0%,100%{transform:translateY(0)} 25%{transform:translateY(-3px)} 50%{transform:translateY(0)} 75%{transform:translateY(-2px)} }\n      .manlung-pwa-download { animation: manlung-install-bounce 1.5s ease-in-out infinite; }\n      @media (prefers-reduced-motion: reduce) { .manlung-pwa-download { animation: none; } }\n      .manlung-pwa-download:active {
        transform: scale(.98);
      }

      .manlung-pwa-close:focus-visible,
      .manlung-pwa-download:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }

      @media (min-width: 768px) {
        .manlung-pwa-banner {
          max-width: 620px;
          left: 50%;
          right: auto;
          width: calc(100% - 32px);
          transform: translate(-50%, -110%);
          border-radius: 0 0 14px 14px;
        }

        .manlung-pwa-banner.is-visible {
          transform: translate(-50%, 0);
        }
      }

      @media (max-width: 480px) {
        .manlung-pwa-banner {
          gap: .5rem;
          min-height: 74px;
          padding: .55rem .5rem;
          padding-top: calc(.55rem + env(safe-area-inset-top));
        }

        .manlung-pwa-close {
          width: 30px;
          height: 30px;
          flex-basis: 30px;
          font-size: 1.6rem;
        }

        .manlung-pwa-icon {
          width: 48px;
          height: 48px;
          flex-basis: 48px;
          border-radius: 11px;
        }

        .manlung-pwa-title {
          font-size: .87rem;
        }

        .manlung-pwa-text {
          font-size: .68rem;
        }

        .manlung-pwa-download {
          min-width: 92px;
          min-height: 42px;
          padding: .5rem .65rem;
          font-size: .75rem;
        }
      }

      @media (max-width: 360px) {
        .manlung-pwa-close {
          display: none;
        }

        .manlung-pwa-icon {
          width: 44px;
          height: 44px;
          flex-basis: 44px;
        }

        .manlung-pwa-title {
          font-size: .8rem;
        }

        .manlung-pwa-text {
          font-size: .63rem;
        }

        .manlung-pwa-download {
          min-width: 82px;
          font-size: .69rem;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createBanner() {
    if (document.getElementById('manlung-pwa-banner')) {
      return document.getElementById('manlung-pwa-banner');
    }

    addBannerStyles();

    const banner = document.createElement('div');
    banner.id = 'manlung-pwa-banner';
    banner.className = 'manlung-pwa-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Install Manlung Recovery App');

    banner.innerHTML = `
      <button
        type="button"
        class="manlung-pwa-close"
        aria-label="Close app installation banner"
      >×</button>

      <img
        class="manlung-pwa-icon"
        src="/icons/icon-192.png"
        alt="Manlung Recovery App"
      >

      <div class="manlung-pwa-copy">
        <strong class="manlung-pwa-title">Manlung Recovery App</strong>
        <span class="manlung-pwa-text">
          Quick access to case tracking and secure support.
        </span>
      </div>

      <button
        type="button"
        class="manlung-pwa-download"
      >INSTALL APP</button>
    `;

    document.body.appendChild(banner);

    banner.querySelector('.manlung-pwa-close').addEventListener('click', () => {
      rememberDismissal();
      banner.classList.remove('is-visible');
    });

    return banner;
  }

  // Keep browser PWA files fresh and notify users when a new service worker is ready.
  const UPDATE_NOTICE_ID = 'manlung-runtime-update-notice';
  let pwaRegistration = null;
  let pwaHadController = Boolean(navigator.serviceWorker && navigator.serviceWorker.controller);

  // Persistent update bell: clients can reopen the update action after dismissing the popup.
  const UPDATE_BELL_ID = 'manlung-update-bell';
  let updateBellState = null;
  let updateBellPanel = null;

  function addUpdateBellStyles() {
    if (document.getElementById('manlung-update-bell-style')) return;
    const style = document.createElement('style');
    style.id = 'manlung-update-bell-style';
    style.textContent = `
      #manlung-update-bell{position:fixed;left:16px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:2147483000}
      #manlung-update-bell[hidden]{display:none!important}
      #manlung-update-bell .mlub-trigger{position:relative;width:52px;height:52px;border:1px solid #ef4444;border-radius:50%;display:grid;place-items:center;background:#b91c1c;color:#fff;box-shadow:0 8px 24px #0005;cursor:pointer}
      #manlung-update-bell .mlub-trigger.mlub-ringing{animation:mlub-ring 1.15s ease-in-out infinite}
      #manlung-update-bell .mlub-trigger.mlub-ringing:before{content:"";position:absolute;inset:-5px;border:2px solid #ef4444;border-radius:50%;animation:mlub-pulse 1.15s ease-out infinite}
      @keyframes mlub-ring{0%,100%{transform:rotate(0)}10%,30%,50%,70%{transform:rotate(-12deg)}20%,40%,60%,80%{transform:rotate(12deg)}90%{transform:rotate(0)}}
      @keyframes mlub-pulse{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.5);opacity:0}}
      #manlung-update-bell .mlub-trigger svg{width:23px;height:23px}
      #manlung-update-bell .mlub-badge{position:absolute;right:-2px;top:-3px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font:800 11px/19px system-ui,sans-serif;text-align:center;border:2px solid #0b1b30}
      #manlung-update-bell .mlub-panel{position:absolute;left:0;bottom:62px;width:min(340px,calc(100vw - 32px));padding:16px;border:1px solid #334155;border-radius:16px;background:#071629;color:#f8fafc;box-shadow:0 14px 42px #0007;font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #manlung-update-bell .mlub-panel[hidden]{display:none}
      #manlung-update-bell .mlub-title{display:block;font-weight:850;font-size:15px;margin-bottom:5px}
      #manlung-update-bell .mlub-copy{display:block;color:#cbd5e1;font-size:12px;margin-bottom:13px;overflow-wrap:anywhere}
      #manlung-update-bell .mlub-actions{display:flex;gap:8px;flex-wrap:wrap}
      #manlung-update-bell .mlub-action{border:0;border-radius:9px;padding:10px 12px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}
      #manlung-update-bell .mlub-secondary{background:#1e293b;color:#e2e8f0}
      #manlung-update-bell button:focus-visible{outline:2px solid #93c5fd;outline-offset:3px}
      @media(max-width:420px){#manlung-update-bell{left:12px;bottom:calc(14px + env(safe-area-inset-bottom))}#manlung-update-bell .mlub-trigger{width:48px;height:48px}}
    `;
    document.head.appendChild(style);
  }

  function setupUpdateBell() {
    if (document.getElementById(UPDATE_BELL_ID)) return;
    addUpdateBellStyles();
    const root = document.createElement('div');
    root.id = UPDATE_BELL_ID;
    root.hidden = true;
    root.innerHTML = `
      <section class="mlub-panel" hidden aria-live="polite">
        <strong class="mlub-title">Manlung Recovery updates</strong>
        <span class="mlub-copy">Check here for app update notices.</span>
        <div class="mlub-actions">
          <button type="button" class="mlub-action mlub-primary">Check updates</button>
          <button type="button" class="mlub-action mlub-secondary mlub-close">Close</button>
        </div>
      </section>
      <button type="button" class="mlub-trigger" aria-label="App updates" aria-expanded="false" title="App updates">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        <span class="mlub-badge" hidden>!</span>
      </button>`;
    document.body.appendChild(root);
    updateBellPanel = root.querySelector('.mlub-panel');
    const trigger = root.querySelector('.mlub-trigger');
    const badge = root.querySelector('.mlub-badge');
    const copy = root.querySelector('.mlub-copy');
    const title = root.querySelector('.mlub-title');
    const primary = root.querySelector('.mlub-primary');

    function renderBell() {
      const available = Boolean(updateBellState);
      root.hidden = !available;
      trigger.classList.toggle('mlub-ringing', available);
      badge.hidden = !available;
      badge.textContent = available ? '1' : '';
      trigger.setAttribute('aria-label', available ? 'App update available' : 'App updates');
      title.textContent = updateBellState?.title || 'Manlung Recovery updates';
      copy.textContent = updateBellState?.message || 'Website refresh notices will appear here.';
      primary.textContent = updateBellState?.actionLabel || 'Check updates';
    }

    trigger.addEventListener('click', () => {
      const willOpen = updateBellPanel.hidden;
      updateBellPanel.hidden = !willOpen;
      trigger.setAttribute('aria-expanded', String(willOpen));
      renderBell();
    });
    root.querySelector('.mlub-close').addEventListener('click', () => {
      updateBellPanel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    });
    primary.addEventListener('click', async () => {
      if (updateBellState?.onAction) {
        try { await updateBellState.onAction(); } catch (error) {
          console.warn('Manlung update bell action failed:', error);
          primary.disabled = false;
        }
        return;
      }
      primary.disabled = true;
      primary.textContent = 'Checking…';
      try {
        await updatePwaRegistration();
        if (!updateBellState) copy.textContent = 'Website update check completed. Reload the page if you notice outdated content.';
      } finally {
        primary.disabled = false;
        renderBell();
      }
    });
    renderBell();
  }

  function setUpdateBellState(options) {
    updateBellState = options || null;
    if (!document.getElementById(UPDATE_BELL_ID)) {
        }
    const root = document.getElementById(UPDATE_BELL_ID);
    if (!root) return;
    const badge = root.querySelector('.mlub-badge');
    const trigger = root.querySelector('.mlub-trigger');
    const title = root.querySelector('.mlub-title');
    const copy = root.querySelector('.mlub-copy');
    const primary = root.querySelector('.mlub-primary');
    root.hidden = !updateBellState;
    if (badge) { badge.hidden = !updateBellState; badge.textContent = updateBellState ? '1' : ''; }
    if (trigger) {
      trigger.setAttribute('aria-label', updateBellState ? 'App update available' : 'App updates');
      trigger.classList.toggle('mlub-ringing', Boolean(updateBellState));
    }
    if (title) title.textContent = updateBellState?.title || 'Manlung Recovery updates';
    if (copy) copy.textContent = updateBellState?.message || '';
    if (primary) primary.textContent = updateBellState?.actionLabel || 'Update now';
    if (updateBellState && updateBellState.autoOpen) {
      if (updateBellPanel) updateBellPanel.hidden = false;
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
    } else if (!updateBellState && updateBellPanel) {
      updateBellPanel.hidden = true;
    }
  }

  function showRuntimeUpdateNotice(options) {
    options = { ...options, autoOpen: true };
    let notice = document.getElementById(UPDATE_NOTICE_ID);
    if (notice) notice.remove();

    if (!document.getElementById('manlung-runtime-update-style')) {
      const style = document.createElement('style');
      style.id = 'manlung-runtime-update-style';
      style.textContent = `
        #manlung-runtime-update-notice {
          position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));
          transform:translateX(-50%);z-index:2147483646;
          width:min(560px,calc(100vw - 24px));display:flex;align-items:center;gap:12px;
          padding:14px;border:1px solid #334155;border-radius:16px;
          background:#071629;color:#f8fafc;box-shadow:0 14px 42px #0007;
          font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }
        #manlung-runtime-update-notice .ml-update-copy{min-width:0;flex:1}
        #manlung-runtime-update-notice .ml-update-title{display:block;font-weight:800;margin-bottom:3px}
        #manlung-runtime-update-notice .ml-update-message{display:block;color:#cbd5e1;font-size:12px}
        #manlung-runtime-update-notice .ml-update-action{
          flex:0 0 auto;border:0;border-radius:10px;padding:10px 12px;background:#2563eb;
          color:#fff;font-weight:800;cursor:pointer;max-width:145px
        }
        #manlung-runtime-update-notice .ml-update-close{
          align-self:flex-start;border:0;background:transparent;color:#cbd5e1;
          font-size:20px;line-height:1;cursor:pointer;padding:0 2px
        }
        #manlung-runtime-update-notice button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
      `;
      document.head.appendChild(style);
    }

    notice = document.createElement('section');
    notice.id = UPDATE_NOTICE_ID;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');

    const copy = document.createElement('div');
    copy.className = 'ml-update-copy';
    const title = document.createElement('strong');
    title.className = 'ml-update-title';
    title.textContent = options.title || 'Manlung Recovery update';
    const message = document.createElement('span');
    message.className = 'ml-update-message';
    message.textContent = options.message || 'A newer version is available.';
    copy.append(title, message);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'ml-update-action';
    action.textContent = options.actionLabel || 'Update';
    action.addEventListener('click', async () => {
      action.disabled = true;
      try {
        await options.onAction?.();
      } catch (error) {
        console.warn('Manlung update action failed:', error);
        action.disabled = false;
      }
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ml-update-close';
    close.setAttribute('aria-label', 'Dismiss update notice');
    close.textContent = '×';
    close.addEventListener('click', () => notice?.remove());

    notice.append(copy, action, close);
    document.body.appendChild(notice);
  }

  function offerPwaRefresh() {
    showRuntimeUpdateNotice({
      title: 'Manlung Recovery has an update',
      message: 'Refresh now to load the latest app files. Your account data stays on your account.',
      actionLabel: 'Refresh now',
      onAction: () => window.location.reload()
    });
  }

  async function updatePwaRegistration() {
    if (!pwaRegistration || document.hidden) return;
    try {
      await pwaRegistration.update();
      if (pwaRegistration.waiting && navigator.serviceWorker?.controller) offerPwaRefresh();
    } catch (_) {}
  }

  function setupPwaAutoUpdates() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (pwaHadController) {
        // Refresh immediately when safe; keep the update prompt if a form has edits.
        if (hasUnsavedPwaInput()) offerPwaRefresh();
        else {
          try { sessionStorage.setItem('manlung-pwa-controller-refresh', '1'); } catch (_) {}
          window.location.reload();
        }
      }
      pwaHadController = true;
    });

    window.addEventListener('load', async () => {
      try {
        pwaRegistration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        await updatePwaRegistration();
        if (pwaRegistration.waiting && navigator.serviceWorker.controller) offerPwaRefresh();
      } catch (error) {
        console.warn('PWA service worker registration/update check failed:', error);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updatePwaRegistration();
    });
    window.setInterval(updatePwaRegistration, 15 * 60 * 1000);
  }

  setupPwaShell();
  removeThirdPartyChatGPTBranding();
  if (document.body && 'MutationObserver' in window) {
    const brandingObserver = new MutationObserver(() => removeThirdPartyChatGPTBranding());
    brandingObserver.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => brandingObserver.disconnect(), 12000);
  }

  setupUpdateBell();
  setupPwaAutoUpdates();

  // Capture the browser-native PWA install prompt when the browser offers it.
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const button = document.querySelector('.manlung-pwa-download');
    if (button) button.textContent = 'INSTALL';
  });

  // Offer installation on the homepage. Browsers without an install prompt
  // can use their own menu to add this PWA to the home screen.
  window.addEventListener('load', () => {
    if (isStandalone() || !IS_HOME || wasRecentlyDismissed()) return;
    const banner = createBanner();
    window.requestAnimationFrame(() => banner.classList.add('is-visible'));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const banner = document.getElementById('manlung-pwa-banner');
    if (banner) {
      banner.classList.remove('is-visible');
      window.setTimeout(() => banner.remove(), 300);
    }
  });

  document.addEventListener('click', async event => {
    const button = event.target.closest('.manlung-pwa-download');
    if (!button) return;

    if (deferredInstallPrompt) {
      const installPrompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        const banner = document.getElementById('manlung-pwa-banner');
        if (banner) banner.classList.remove('is-visible');
      }
      return;
    }

    const banner = document.getElementById('manlung-pwa-banner');
    const copy = banner?.querySelector('.manlung-pwa-text');
    if (copy) copy.textContent = 'Open your browser menu and choose Install app or Add to Home screen.';
    button.textContent = 'BROWSER MENU';
  });

  /*
   * Admin Music Center persistence
   *
   * YouTube playback inside the dashboard iframe is destroyed whenever the
   * dashboard document navigates to another Admin function. To keep music
   * playing in the same browser, Play opens one named browser window/tab
   * containing the dedicated player. The named window is reused for later
   * songs, so navigation in the main Admin window does not interrupt audio.
   */
  const MUSIC_KEY = 'manlung-admin-music-now-playing-v1';
  const MUSIC_CHANNEL_NAME = 'manlung-admin-music-v1';
  let musicChannel = null;
  let musicPopup = null;

  function isAdminMusicPage() {
    return location.pathname.startsWith('/admin/') &&
      location.pathname !== '/admin/music-player.html';
  }

  function publishAdminMusic(song) {
    if (!song || !song.id) return false;

    try {
      localStorage.setItem(MUSIC_KEY, JSON.stringify({
        id: String(song.id),
        title: String(song.title || 'Now playing'),
        updatedAt: Date.now()
      }));
    } catch (_) {}

    try {
      if (!musicChannel && 'BroadcastChannel' in window) {
        musicChannel = new BroadcastChannel(MUSIC_CHANNEL_NAME);
      }
      musicChannel?.postMessage({ type: 'song', song });
    } catch (_) {}

    return true;
  }

  function openAdminMusicPopup(song) {
    if (!song || !song.id) return false;

    publishAdminMusic(song);

    const url = '/admin/music-player.html';
    const features = 'popup=yes,width=760,height=520,resizable=yes,scrollbars=no';
    let popup = musicPopup;

    try {
      if (!popup || popup.closed) {
        popup = window.open(url, 'manlungAdminMusicPlayer', features);
        musicPopup = popup;
      } else {
        popup.focus();
      }
    } catch (_) {
      popup = null;
    }

    if (!popup) {
      return false;
    }

    try {
      popup.focus();
    } catch (_) {}

    return true;
  }

  function getMusicButtonSong(button) {
    const article = button?.closest('.admin-song');
    if (!article) return null;

    const id = button.getAttribute('data-music-play');
    const title = article.querySelector('.admin-song-title')?.textContent?.trim() || 'Now playing';
    return id ? { id, title } : null;
  }

  function getQueueSongFromDashboard() {
    const frame = document.getElementById('adminMusicFrame');
    const title = document.getElementById('adminMusicNowPlaying')?.textContent?.trim();
    if (!frame || !title || title === 'Nothing playing') return null;

    try {
      const match = frame.src.match(/embed\/([^?]+)/);
      if (!match) return null;
      return {
        id: decodeURIComponent(match[1]),
        title
      };
    } catch (_) {
      return null;
    }
  }

  if (isAdminMusicPage()) {
    document.addEventListener('click', event => {
      const playButton = event.target.closest('[data-music-play]');
      if (playButton) {
        const song = getMusicButtonSong(playButton);
        if (song && openAdminMusicPopup(song)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      const queueButton = event.target.closest('.admin-queue-chip');
      if (queueButton) {
        /*
         * The existing dashboard queue handler runs on the target first.
         * After it selects the song, move that song into the persistent
         * player and clear the temporary dashboard iframe.
         */
        window.setTimeout(() => {
          const song = getQueueSongFromDashboard();
          if (!song || !openAdminMusicPopup(song)) return;
          const frame = document.getElementById('adminMusicFrame');
          if (frame) frame.src = 'about:blank';
        }, 0);
      }
    }, true);

    /*
     * If the user already has a persistent player, keep the dashboard's
     * temporary iframe silent so two copies cannot play at once.
     */
    window.addEventListener('pagehide', () => {
      try {
        musicChannel?.close();
      } catch (_) {}
      musicChannel = null;
    });
  }
})();
