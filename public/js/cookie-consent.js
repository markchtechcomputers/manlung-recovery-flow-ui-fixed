(() => {
  'use strict';
  const KEY = 'manlung-cookie-consent-v1';
  const VERSION = 1;
  const MAX_AGE_DAYS = 180;
  const OPTIONAL = ['preferences', 'analytics', 'marketing'];
  let current = null;
  let dialog = null;

  function readConsent() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!value || value.version !== VERSION || !value.savedAt) return null;
      if (Date.now() - value.savedAt > MAX_AGE_DAYS * 86400000) return null;
      return { necessary: true, preferences: value.preferences === true,
        analytics: value.analytics === true, marketing: value.marketing === true,
        savedAt: value.savedAt, version: VERSION };
    } catch (_) { return null; }
  }
  function getPreferences() {
    return current ? { ...current } : { necessary: true, preferences: false, analytics: false, marketing: false };
  }
  function publish() {
    window.dispatchEvent(new CustomEvent('manlung:consent-changed', { detail: getPreferences() }));
  }
  function save(values, choice) {
    current = { necessary: true, preferences: values.preferences === true,
      analytics: values.analytics === true, marketing: values.marketing === true,
      savedAt: Date.now(), version: VERSION, choice: choice };
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (_) {}
    if (dialog) dialog.remove();
    dialog = null;
    publish();
    renderSettingsButton();
  }
  function addStyles() {
    if (document.getElementById('manlung-cookie-consent-style')) return;
    const style = document.createElement('style');
    style.id = 'manlung-cookie-consent-style';
    style.textContent = [
      '#manlung-cookie-consent,#manlung-cookie-consent *{box-sizing:border-box}',
      '#manlung-cookie-consent{position:fixed;inset:auto 16px 16px 16px;z-index:2147483001;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eaf1fb}',
      '#manlung-cookie-consent .mcc-panel{width:min(100%,720px);margin:0 auto;background:linear-gradient(145deg,#08182b,#102b49);border:1px solid rgba(148,163,184,.35);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.38);padding:20px}',
      '#manlung-cookie-consent .mcc-head{display:flex;align-items:flex-start;gap:12px}',
      '#manlung-cookie-consent .mcc-icon{width:42px;height:42px;flex:0 0 42px;border-radius:13px;display:grid;place-items:center;background:rgba(59,130,246,.18);color:#93c5fd;font-size:21px}',
      '#manlung-cookie-consent h2{margin:0 0 5px;color:#fff;font-size:18px;line-height:1.25;font-weight:850}',
      '#manlung-cookie-consent p{margin:0;color:#cbd5e1;font-size:13px;line-height:1.55}',
      '#manlung-cookie-consent a{color:#93c5fd;text-decoration:underline;text-underline-offset:2px}',
      '#manlung-cookie-consent .mcc-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:17px}',
      '#manlung-cookie-consent button{font:inherit;cursor:pointer}',
      '#manlung-cookie-consent .mcc-btn{min-height:42px;padding:10px 15px;border-radius:10px;border:1px solid #475569;background:#172b43;color:#f8fafc;font-weight:750}',
      '#manlung-cookie-consent .mcc-primary{background:#2563eb;border-color:#3b82f6;color:#fff}',
      '#manlung-cookie-consent .mcc-btn:hover{filter:brightness(1.12)}',
      '#manlung-cookie-consent button:focus-visible,#manlung-cookie-settings:focus-visible{outline:3px solid #fbbf24;outline-offset:3px}',
      '#manlung-cookie-consent .mcc-detail{display:none;margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.25)}',
      '#manlung-cookie-consent .mcc-detail.is-open{display:block}',
      '#manlung-cookie-consent .mcc-choice{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:11px 0;border-bottom:1px solid rgba(148,163,184,.18)}',
      '#manlung-cookie-consent .mcc-choice:last-child{border-bottom:0}',
      '#manlung-cookie-consent .mcc-choice strong{display:block;color:#f8fafc;font-size:13px}',
      '#manlung-cookie-consent .mcc-choice small{display:block;color:#b7c5d7;font-size:12px;line-height:1.4;margin-top:2px}',
      '#manlung-cookie-consent input[type=checkbox]{width:20px;height:20px;accent-color:#3b82f6;flex:0 0 20px}',
      '#manlung-cookie-consent input[disabled]{opacity:.65}',
      '#manlung-cookie-settings{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147482999;border:1px solid #64748b;border-radius:999px;padding:9px 13px;background:#10243b;color:#eaf1fb;font:700 12px/1.2 system-ui,sans-serif;box-shadow:0 5px 18px #0003;cursor:pointer}',
      '@media(max-width:560px){#manlung-cookie-consent{inset:auto 9px 9px}#manlung-cookie-consent .mcc-panel{padding:16px;border-radius:16px}#manlung-cookie-consent .mcc-actions{display:grid;grid-template-columns:1fr 1fr}#manlung-cookie-consent .mcc-btn{padding:10px 8px;font-size:12px}#manlung-cookie-consent .mcc-primary{grid-column:1/-1;grid-row:1}#manlung-cookie-settings{right:10px;bottom:calc(10px + env(safe-area-inset-bottom))}}',
      '@media(prefers-reduced-motion:no-preference){#manlung-cookie-consent .mcc-panel{animation:mcc-enter .2s ease-out}@keyframes mcc-enter{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}}'
    ].join('');
    document.head.appendChild(style);
  }
  function renderSettingsButton() {
    if (document.getElementById('manlung-cookie-settings')) return;
    const button = document.createElement('button');
    button.id = 'manlung-cookie-settings';
    button.type = 'button';
    button.textContent = 'Cookie settings';
    button.setAttribute('aria-label', 'Open cookie preferences');
    button.addEventListener('click', () => openDialog(true));
    document.body.appendChild(button);
  }
  function openDialog(showDetails) {
    if (dialog) dialog.remove();
    addStyles();
    const prefs = getPreferences();
    dialog = document.createElement('section');
    dialog.id = 'manlung-cookie-consent';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'false');
    dialog.setAttribute('aria-labelledby', 'mcc-title');
    dialog.innerHTML =
      '<div class="mcc-panel"><div class="mcc-head"><div class="mcc-icon" aria-hidden="true">🍪</div><div>' +
      '<h2 id="mcc-title">Your privacy matters</h2>' +
      '<p>Manlung Recovery uses essential storage to keep the website secure, remember your settings and support sign-in. Optional analytics and advertising tools are not currently activated by this consent manager. You can choose whether to allow optional categories and change your choice at any time.</p>' +
      '<p style="margin-top:7px"><a href="/privacy.html#cookies">Read our cookie and storage notice</a>.</p></div></div>' +
      '<div class="mcc-detail' + (showDetails ? ' is-open' : '') + '" id="mcc-detail">' +
      '<div class="mcc-choice"><div><strong>Strictly necessary</strong><small>Security, authentication, consent records and core site operation. Always active.</small></div><input type="checkbox" checked disabled aria-label="Strictly necessary always active"></div>' +
      '<div class="mcc-choice"><div><strong>Preferences</strong><small>Remember optional display and convenience preferences.</small></div><input type="checkbox" data-category="preferences" ' + (prefs.preferences ? 'checked' : '') + ' aria-label="Allow preference storage"></div>' +
      '<div class="mcc-choice"><div><strong>Analytics</strong><small>Would allow anonymous usage measurement if an analytics service is introduced.</small></div><input type="checkbox" data-category="analytics" ' + (prefs.analytics ? 'checked' : '') + ' aria-label="Allow analytics"></div>' +
      '<div class="mcc-choice"><div><strong>Marketing</strong><small>Would allow marketing or advertising technologies if introduced.</small></div><input type="checkbox" data-category="marketing" ' + (prefs.marketing ? 'checked' : '') + ' aria-label="Allow marketing"></div>' +
      '<p style="margin-top:9px">Optional categories remain off unless you choose to enable them. Saving a choice does not itself activate third-party tools.</p></div>' +
      '<div class="mcc-actions"><button type="button" class="mcc-btn mcc-primary" data-action="accept">Accept all</button>' +
      '<button type="button" class="mcc-btn" data-action="reject">Essential only</button>' +
      '<button type="button" class="mcc-btn" data-action="customize">' + (showDetails ? 'Save preferences' : 'Customize') + '</button></div></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-action="accept"]').addEventListener('click', () =>
      save({ preferences: true, analytics: true, marketing: true }, 'accept-all'));
    dialog.querySelector('[data-action="reject"]').addEventListener('click', () =>
      save({ preferences: false, analytics: false, marketing: false }, 'essential-only'));
    dialog.querySelector('[data-action="customize"]').addEventListener('click', () => {
      const detail = dialog.querySelector('#mcc-detail');
      if (!detail.classList.contains('is-open')) {
        detail.classList.add('is-open');
        dialog.querySelector('[data-action="customize"]').textContent = 'Save preferences';
        dialog.querySelector('[data-action="customize"]').focus();
        return;
      }
      const values = {};
      OPTIONAL.forEach(category => {
        values[category] = dialog.querySelector('[data-category="' + category + '"]').checked;
      });
      save(values, 'custom');
    });
  }
  window.ManlungCookieConsent = {
    getPreferences,
    has(category) {
      if (category === 'necessary') return true;
      return OPTIONAL.includes(category) && Boolean(current && current[category]);
    },
    openPreferences() { openDialog(true); }
  };
  function init() {
    current = readConsent();
    renderSettingsButton();
    if (!current) openDialog(false);
    else publish();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();