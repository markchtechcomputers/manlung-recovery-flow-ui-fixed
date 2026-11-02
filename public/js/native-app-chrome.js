/* APK-only chrome guard for standalone pages that do not load the full theme bundle. */
(() => {
  const nativeApp = Boolean(window.Capacitor?.isNativePlatform?.()) ||
    /Capacitor|ManlungRecoveryAndroid/i.test(window.navigator?.userAgent || '');
  if (!nativeApp) return;

  document.documentElement.classList.add('manlung-android-app');

  const style = document.createElement('style');
  style.id = 'manlung-native-app-chrome-guard';
  style.textContent = `
    html.manlung-android-app body footer,
    html.manlung-android-app body [role="contentinfo"],
    html.manlung-android-app body .site-footer,
    html.manlung-android-app body .manlung-footer,
    html.manlung-android-app body #footer,
    html.manlung-android-app body #site-footer,
    html.manlung-android-app body .footer,
    html.manlung-android-app body .footer-container,
    html.manlung-android-app body .footer-wrapper,
    html.manlung-android-app body [data-footer],
    html.manlung-android-app body .mr-hero-android-link,
    html.manlung-android-app body .mr-apk-download-button,
    html.manlung-android-app body .pwa-install-prompt,
    html.manlung-android-app body .apk-download-prompt,
    html.manlung-android-app body #manlung-pwa-banner,
    html.manlung-android-app body a[href*="/api/download-apk"],
    html.manlung-android-app body a[href*="download-apk"] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  const removeBrowserPromotions = () => {
    document.querySelectorAll(
      'footer, [role="contentinfo"], .site-footer, .manlung-footer, #footer, #site-footer, .footer, .footer-container, .footer-wrapper, [data-footer]'
    ).forEach(node => {
      node.setAttribute('aria-hidden', 'true');
      node.style.setProperty('display', 'none', 'important');
    });
    document.querySelectorAll(
      '#manlung-pwa-banner, [data-pwa-install], .pwa-install-prompt, .apk-download-prompt, .mr-hero-android-link, .mr-apk-download-button, a[href*="/api/download-apk"], a[href*="download-apk"]'
    ).forEach(node => node.remove());
  };

  const start = () => {
    removeBrowserPromotions();
    if (document.body && !window.__manlungNativeChromeGuard) {
      window.__manlungNativeChromeGuard = new MutationObserver(removeBrowserPromotions);
      window.__manlungNativeChromeGuard.observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();