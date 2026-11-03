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

  const DISMISS_KEY = 'manlung-app-install-dismissed-v3';

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

  // Handle the Android system Back button through Capacitor when the native
  // App plugin is available. Prefer the WebView's real navigation history;
  // only fall back to the homepage when there is no previous entry.
  function installCapacitorBackButton() {
    const appPlugin = window.Capacitor?.Plugins?.App;
    // Admin navigation should follow its own page history, not fall back to public Home.
    if (isAdminRoute() || !appPlugin || window.__manlungCapacitorBackInstalled) return;
    window.__manlungCapacitorBackInstalled = true;

    try {
      appPlugin.addListener('backButton', ({ canGoBack } = {}) => {
        const isHome = window.location.pathname === '/' ||
          window.location.pathname === '/index.html';

        if (canGoBack && window.history.length > 1) {
          window.history.back();
          return;
        }

        if (!isHome) {
          window.location.replace('/');
          return;
        }

        // At the homepage, consume Back rather than allowing the WebView to
        // close the activity immediately.
        try {
          window.history.pushState({ manlungBackGuard: true }, '', window.location.href);
        } catch (_) {}
      });
    } catch (error) {
      console.warn('Manlung Android Back handler could not be installed:', error);
    }
  }

  installCapacitorBackButton();


  // Prefer the browser's native PWA install prompt, with the existing APK page as fallback.
  const DISMISS_DAYS = 7;
  const IS_HOME = window.location.pathname === '/' || window.location.pathname === '/index.html';

  function isAndroidApp() {
    try {
      const nativeApp = Boolean(window.Capacitor?.isNativePlatform?.()) ||
        /Capacitor|ManlungRecoveryAndroid/i.test(window.navigator.userAgent);
      if (nativeApp) document.documentElement.classList.add('manlung-android-app');
      return nativeApp;
    } catch (_) {
      return false;
    }
  }

  // Mark the document before the page finishes rendering so browser-only
  // download controls stay hidden inside the installed Android app.
  isAndroidApp();

  // Native APK presentation is intentionally different from the browser site:
  // keep the app header visible while scrolling and hide the browser marketing footer.
  function applyNativeAppLayout() {
    if (!isAndroidApp() || document.getElementById('manlung-native-app-layout-style')) return;
    const style = document.createElement('style');
    style.id = 'manlung-native-app-layout-style';
    style.textContent = `
      html.manlung-android-app .site-header,
      html.manlung-android-app header.site-header {
        position: sticky !important;
        top: 0 !important;
        z-index: 2147482000 !important;
        width: 100% !important;
      }
      html.manlung-android-app footer.manlung-footer,
      html.manlung-android-app .mr-hero-android-link {
        display: none !important;
      }
      html.manlung-android-app {
        scroll-padding-top: 76px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }
  applyNativeAppLayout();

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  // Keep social sign-in available in normal browser tabs, but use email/password
  // only in the native APK and installed browser PWA.
  function isInstalledBrowserPwa() {
    try {
      return !isAndroidApp() && (window.navigator.standalone === true ||
        ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'].some(mode =>
          window.matchMedia('(display-mode: ' + mode + ')').matches
        ));
    } catch (_) {
      return false;
    }
  }

  function applyAppAuthVisibility() {
    const nativeApk = isAndroidApp();
    const installedPwa = isInstalledBrowserPwa();
    if ((!nativeApk && !installedPwa) ||
        document.getElementById('manlung-app-email-only-auth-style')) return;

    document.documentElement.classList.add('manlung-app-email-only-auth');
    if (installedPwa) document.documentElement.classList.add('manlung-installed-browser-pwa');
    const style = document.createElement('style');
    style.id = 'manlung-app-email-only-auth-style';
    style.textContent = `
      html.manlung-app-email-only-auth body.manlung-auth-page #googleLoginBtn,
      html.manlung-app-email-only-auth body.manlung-auth-page #googleRegisterBtn,
      html.manlung-app-email-only-auth body.manlung-auth-page #githubLoginBtn,
      html.manlung-app-email-only-auth body.manlung-auth-page #githubRegisterBtn,
      html.manlung-app-email-only-auth body.manlung-auth-page #discordLoginBtn,
      html.manlung-app-email-only-auth body.manlung-auth-page #discordRegisterBtn,
      html.manlung-app-email-only-auth body.manlung-auth-page #openaiLoginBtn,
      html.manlung-app-email-only-auth body.manlung-auth-page #openaiRegisterBtn {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      html.manlung-app-email-only-auth body.manlung-auth-page .manlung-auth-divider {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  applyAppAuthVisibility();

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

  // Keep browser PWA files fresh, but never run a service worker inside the remote-site Android WebView.
  const UPDATE_NOTICE_ID = 'manlung-runtime-update-notice';
  const APK_CHECK_KEY = 'manlung-apk-update-check-at-v1';
  // Check frequently, and always check again when the Android app returns to the foreground.
  const APK_CHECK_INTERVAL = 5 * 60 * 1000;
  let nativeApkCheckInFlight = false;
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
      copy.textContent = updateBellState?.message || (isAndroidApp()
        ? 'No update notice yet. Tap Check updates to check for the latest Android app.'
        : 'Website refresh notices and app update information will appear here.');
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
        if (isAndroidApp()) {
          await checkNativeApkUpdate(true);
        } else {
          await updatePwaRegistration();
        }
        if (!updateBellState) {
          copy.textContent = isAndroidApp()
            ? 'No newer Android APK was detected. Try again when you are online.'
            : 'Website update check completed. Reload the page if you notice outdated content.';
        }
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
    if (isAndroidApp() || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (pwaHadController) offerPwaRefresh();
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

  async function checkNativeApkUpdate(force = false) {
    if (!isAndroidApp() || nativeApkCheckInFlight) return;

    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!appPlugin || typeof appPlugin.getInfo !== 'function') return;

    let checkedAt = 0;
    try { checkedAt = Number(localStorage.getItem(APK_CHECK_KEY) || 0); } catch (_) {}
    if (!force && Date.now() - checkedAt < APK_CHECK_INTERVAL) return;

    nativeApkCheckInFlight = true;
    try {
      const appInfo = await appPlugin.getInfo();
      const currentCode = Number.parseInt(String(appInfo?.build || appInfo?.versionCode || ''), 10);
      if (!Number.isFinite(currentCode) || currentCode < 1) return;

      const response = await fetch('/api/app-version', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return;
      const release = await response.json();
      const latestCode = Number.parseInt(String(release?.versionCode || ''), 10);
      if (!Number.isFinite(latestCode) || latestCode <= currentCode || !release?.downloadUrl) {
        try { localStorage.setItem(APK_CHECK_KEY, String(Date.now())); } catch (_) {}
        return;
      }

      try { localStorage.setItem(APK_CHECK_KEY, String(Date.now())); } catch (_) {}
      const reinstallNote = release.requiresReinstall
        ? ' This first permanently signed APK cannot replace older copies signed with a different key. You may need to uninstall the old app before installing it; your online account records remain on the server, but local preferences may reset.'
        : ' Android will ask you to approve installation; the app cannot install an APK silently.';
      showRuntimeUpdateNotice({
        title: 'A new Android app update is available',
        message: 'Installed ' + String(appInfo.version || 'current version') + '; latest ' + String(release.versionName || ('build ' + latestCode)) + '.' + reinstallNote,
        actionLabel: 'Get update',
        onAction: async () => {
          const browserPlugin = window.Capacitor?.Plugins?.Browser;
          if (browserPlugin && typeof browserPlugin.open === 'function') {
            await browserPlugin.open({ url: release.downloadUrl });
            return;
          }
          window.location.assign('/download-app.html?update=available&reinstall=' + (release.requiresReinstall ? '1' : '0'));
        }
      });
    } catch (error) {
      console.warn('Manlung Android update check failed:', error);
    } finally {
      nativeApkCheckInFlight = false;
    }
  }

  // The APK loads the live website, so refresh its web UI after a long
  // background period. Never auto-reload after the user edits a form on this
  // page; that avoids discarding unsaved work. Native APK updates are checked
  // separately below because Android package changes still require approval.
  let nativePageEdited = false;
  let nativeHiddenAt = 0;
  const NATIVE_REFRESH_AFTER = 2 * 60 * 1000;

  document.addEventListener('input', event => {
    if (isAndroidApp() && event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) {
      nativePageEdited = true;
    }
  }, true);
  document.addEventListener('change', event => {
    if (isAndroidApp() && event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) {
      nativePageEdited = true;
    }
  }, true);

  setupUpdateBell();
  setupPwaAutoUpdates();
  function startNativeApkUpdateChecks() {
    if (!isAndroidApp()) return;
    // Force a fresh check on each app startup; don't wait for the old six-hour cache window.
    checkNativeApkUpdate(true);
    window.setInterval(() => checkNativeApkUpdate(false), APK_CHECK_INTERVAL);
  }

  if (document.readyState === 'complete') {
    startNativeApkUpdateChecks();
  } else {
    window.addEventListener('load', startNativeApkUpdateChecks, { once: true });
  }
  window.addEventListener('online', () => {
    if (!isAndroidApp()) return;
    // The APK uses the live website for its UI. Refresh it as soon as network
    // access returns so a newly deployed website version appears without a
    // separate APK download. Never reload a form the user has edited.
    window.setTimeout(() => {
      checkNativeApkUpdate(true);
      if (!nativePageEdited && document.visibilityState === 'visible') {
        window.location.reload();
      }
    }, 1200);
  });
  document.addEventListener('visibilitychange', () => {
    if (!isAndroidApp()) return;
    if (document.hidden) {
      nativeHiddenAt = Date.now();
      return;
    }

    // Always re-check when the Android app returns to the foreground.
    checkNativeApkUpdate(true);
    const wasAwayLongEnough = nativeHiddenAt && Date.now() - nativeHiddenAt >= NATIVE_REFRESH_AFTER;
    nativeHiddenAt = 0;
    if (wasAwayLongEnough && !nativePageEdited) {
      // HTML and scripts are configured on the server to revalidate; this
      // reload gets the newest deployed website without needing a new APK.
      window.location.reload();
    }
  });

  // Capture the browser-native PWA install prompt when the browser offers it.
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const button = document.querySelector('.manlung-pwa-download');
    if (button) button.textContent = 'INSTALL';
  });

  // Offer installation on the homepage. If the browser has no native prompt,
  // the existing app-download page remains available as a fallback.
  window.addEventListener('load', () => {
    if (isAndroidApp() || isStandalone() || !IS_HOME || wasRecentlyDismissed()) return;
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
    if (isAndroidApp()) return;
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

    // Browsers that do not expose beforeinstallprompt can still use the APK
    // page or their browser's built-in "Install app / Add to Home Screen" menu.
    window.location.assign('/download-app.html');
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
