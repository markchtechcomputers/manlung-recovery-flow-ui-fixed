(() => {
  const DISMISS_KEY = 'manlung-pwa-banner-dismissed';
  const DISMISS_DAYS = 7;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function wasRecentlyDismissed() {
    try {
      const value = localStorage.getItem(DISMISS_KEY);
      if (!value) return false;

      const dismissedAt = Number(value);
      return Number.isFinite(dismissedAt) &&
        (Date.now() - dismissedAt) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
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
        background: linear-gradient(135deg, #ffffff, #f8fbff);
        color: #172033;
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
        color: #64748b;
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
        color: #172033;
        font-size: .96rem;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .manlung-pwa-text {
        display: block;
        color: #64748b;
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
        background: linear-gradient(135deg, #0ea5e9, #2563eb);
        color: #fff;
        font-size: .8rem;
        font-weight: 900;
        letter-spacing: .02em;
        cursor: pointer;
        box-shadow: 0 5px 14px rgba(37,99,235,.25);
      }

      .manlung-pwa-download:active {
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
          Faster access, easier recovery assistance and saves on data.
        </span>
      </div>

      <button
        type="button"
        class="manlung-pwa-download"
      >DOWNLOAD</button>
    `;

    document.body.appendChild(banner);

    banner.querySelector('.manlung-pwa-close').addEventListener('click', () => {
      rememberDismissal();
      banner.classList.remove('is-visible');
    });

    return banner;
  }

  let deferredPrompt = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .catch(error => {
          console.warn('PWA service worker registration failed:', error);
        });
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;

    if (isStandalone() || wasRecentlyDismissed()) {
      return;
    }

    const banner = createBanner();

    setTimeout(() => {
      banner.classList.add('is-visible');
    }, 250);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;

    const banner = document.getElementById('manlung-pwa-banner');

    if (banner) {
      banner.classList.remove('is-visible');
      setTimeout(() => banner.remove(), 300);
    }
  });

  document.addEventListener('click', async event => {
    const button = event.target.closest('.manlung-pwa-download');

    if (!button || !deferredPrompt) {
      return;
    }

    button.disabled = true;
    button.textContent = 'INSTALLING...';

    try {
      deferredPrompt.prompt();

      const result = await deferredPrompt.userChoice;

      if (result.outcome === 'dismissed') {
        button.disabled = false;
        button.textContent = 'DOWNLOAD';
      } else {
        const banner = document.getElementById('manlung-pwa-banner');

        if (banner) {
          banner.classList.remove('is-visible');
        }
      }
    } catch (error) {
      console.warn('PWA installation failed:', error);
      button.disabled = false;
      button.textContent = 'DOWNLOAD';
    }

    deferredPrompt = null;
  });
})();
