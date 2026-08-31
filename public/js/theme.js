(() => {
  const STORAGE_KEY = 'theme';
  const LIGHT = 'light';
  const DARK = 'dark';

  function readTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === DARK ? DARK : LIGHT;
    } catch (_) {
      return LIGHT;
    }
  }

  function writeTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }

  function setTheme(theme, persist = true) {
    const next = theme === DARK ? DARK : LIGHT;
    const root = document.documentElement;
    root.classList.toggle('dark', next === DARK);
    root.dataset.theme = next;
    root.style.colorScheme = next;
    if (document.body) document.body.classList.toggle('dark', next === DARK);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === DARK ? '#0b1424' : '#ffffff');

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const isDark = next === DARK;
      button.setAttribute('aria-pressed', String(isDark));
      button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      const icon = button.querySelector('i');
      const label = button.querySelector('[data-theme-label]');
      if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      if (label) {
        label.textContent = isDark ? 'Light' : 'Dark';
      } else {
        button.innerHTML = `<i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i><span data-theme-label>${isDark ? 'Light' : 'Dark'}</span>`;
      }
    });

    if (persist) writeTheme(next);
    return next;
  }

  // Apply before the rest of the page paints. Light is the default.
  setTheme(readTheme(), false);

  function bindThemeButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      if (button.dataset.themeBound === 'true') return;
      button.dataset.themeBound = 'true';
      button.addEventListener('click', () => {
        setTheme(readTheme() === DARK ? LIGHT : DARK, true);
      });
    });
  }

  function createThemeButton() {
    if (document.querySelector('[data-theme-toggle]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline manlung-theme-toggle';
    button.dataset.themeToggle = 'true';
    button.innerHTML = '<i class="fas fa-moon" aria-hidden="true"></i><span data-theme-label>Dark</span>';

    const actions = document.querySelector('.site-header .header-actions');
    if (actions) {
      actions.insertBefore(button, actions.firstChild);
    } else {
      // Authentication/callback pages without a normal site header still get a theme control.
      button.className = 'manlung-floating-theme';
      button.innerHTML = '<i class="fas fa-moon" aria-hidden="true"></i><span data-theme-label>Dark</span>';
      document.body.appendChild(button);
    }

    bindThemeButtons();
  }

  function convertLegacyButtons() {
    document.querySelectorAll('[onclick="toggleDarkMode()"]')
      .forEach((button) => {
        button.removeAttribute('onclick');
        button.dataset.themeToggle = 'true';
      });
  }

  // The floating Call Admin widget uses .manlung-floating-call-icon.
  // Older fixes targeted .manlung-call-icon, so they never affected this image.
  function installCallIconFix() {
    if (document.getElementById('manlung-floating-call-icon-fix')) return;

    const style = document.createElement('style');
    style.id = 'manlung-floating-call-icon-fix';
    style.textContent = `
      #callWidgetBtn img.manlung-floating-call-icon {
        width: 20px !important;
        height: 20px !important;
        min-width: 20px !important;
        min-height: 20px !important;
        max-width: 20px !important;
        max-height: 20px !important;
        flex: 0 0 20px !important;
        display: inline-block !important;
        object-fit: contain !important;
        object-position: center !important;
        margin: 0 !important;
        padding: 0 !important;
        vertical-align: middle !important;
      }

      @media (max-width: 600px) {
        #callWidgetBtn img.manlung-floating-call-icon {
          width: 28px !important;
          height: 28px !important;
          min-width: 28px !important;
          min-height: 28px !important;
          max-width: 28px !important;
          max-height: 28px !important;
          flex: 0 0 28px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function loadAdminCallIcons() {
    if (!location.pathname.startsWith('/admin/')) return;
    if (document.querySelector('script[data-manlung-admin-call-icons]')) return;

    const script = document.createElement('script');
    script.src = '/js/admin-call-icons.js';
    script.defer = true;
    script.dataset.manlungAdminCallIcons = 'true';
    document.head.appendChild(script);
  }

  function boot() {
    convertLegacyButtons();
    bindThemeButtons();
    createThemeButton();
    bindThemeButtons();
    setTheme(readTheme(), false);
    installCallIconFix();
    loadAdminCallIcons();

    // Some legacy pages define toggleDarkMode themselves. Make that global API use the
    // same shared state so old integrations cannot desynchronise the site theme.
    window.setManlungTheme = (theme) => setTheme(theme, true);
    window.toggleDarkMode = () => setTheme(readTheme() === DARK ? LIGHT : DARK, true);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) setTheme(readTheme(), false);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();