(() => {
  const STORAGE_KEY = 'theme';
  const LIGHT = 'light';
  const DARK = 'dark';

  function readTheme() {
    try { return localStorage.getItem(STORAGE_KEY) === DARK ? DARK : LIGHT; } catch (_) { return LIGHT; }
  }
  function writeTheme(theme) { try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {} }
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
      if (label) label.textContent = isDark ? 'Light' : 'Dark';
      else button.innerHTML = `<i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i><span data-theme-label>${isDark ? 'Light' : 'Dark'}</span>`;
    });
    if (persist) writeTheme(next);
    return next;
  }
  setTheme(readTheme(), false);
  function bindThemeButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      if (button.dataset.themeBound === 'true') return;
      button.dataset.themeBound = 'true';
      button.addEventListener('click', () => setTheme(readTheme() === DARK ? LIGHT : DARK, true));
    });
  }
  function createThemeButton() {
    if (document.querySelector('[data-theme-toggle]')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn btn-outline manlung-theme-toggle'; button.dataset.themeToggle = 'true';
    button.innerHTML = '<i class="fas fa-moon" aria-hidden="true"></i><span data-theme-label>Dark</span>';
    const actions = document.querySelector('.site-header .header-actions');
    if (actions) actions.insertBefore(button, actions.firstChild);
    else { button.className = 'manlung-floating-theme'; document.body.appendChild(button); }
    bindThemeButtons();
  }
  function convertLegacyButtons() {
    document.querySelectorAll('[onclick="toggleDarkMode()"]').forEach((button) => { button.removeAttribute('onclick'); button.dataset.themeToggle = 'true'; });
  }
  function installCallIconFix() {
    if (document.getElementById('manlung-floating-call-icon-fix')) return;
    const s=document.createElement('style'); s.id='manlung-floating-call-icon-fix'; s.textContent=`#callWidgetBtn img.manlung-floating-call-icon{width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important;max-width:20px!important;max-height:20px!important;flex:0 0 20px!important;display:inline-block!important;object-fit:contain!important;object-position:center!important;margin:0!important;padding:0!important;vertical-align:middle!important}@media(max-width:600px){#callWidgetBtn img.manlung-floating-call-icon{width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;max-width:28px!important;max-height:28px!important;flex:0 0 28px!important}}`; document.head.appendChild(s);
  }
  function loadAdminCallIcons() {
    if (!location.pathname.startsWith('/admin/')) return;
    if (document.querySelector('script[data-manlung-admin-call-icons]')) return;
    const script = document.createElement('script'); script.src='/js/admin-call-icons.js'; script.defer=true; script.dataset.manlungAdminCallIcons='true'; document.head.appendChild(script);
  }
  function loadContactFab() {
    if (document.querySelector('script[data-manlung-contact-fab]')) return;
    const script = document.createElement('script'); script.src='/js/contact-fab.js'; script.defer=true; script.dataset.manlungContactFab='true'; document.head.appendChild(script);
  }
  function loadManlungAI() {
    if (document.querySelector('script[data-manlung-ai]')) return;
    const script = document.createElement('script'); script.src='/js/manlung-ai-v2.js'; script.defer=true; script.dataset.manlungAi='true'; document.head.appendChild(script);
    script.addEventListener('load', () => {
      if (document.querySelector('script[data-manlung-ai-live]')) return;
      const live = document.createElement('script'); live.src='/js/manlung-ai-live.js'; live.defer=true; live.dataset.manlungAiLive='true'; document.head.appendChild(live);
    });
  }

  function installHeroVideoPlaylist() {
    const CLIPS = [
      'https://raw.githubusercontent.com/markchtechcomputers/galary-/main/Futuristic%20HUD%20Interface%20Sound%20Design%20-%20Binary%20Code%203%20Example%20(1).mp4',
      'https://raw.githubusercontent.com/markchtechcomputers/galary-/main/YTDown.com_YouTube_cyber-security-stock-footage-free-video-_Media_Z4F3AXvrLKo_001_1080p.mp4',
      'https://raw.githubusercontent.com/markchtechcomputers/galary-/main/WhatsApp%20Video%202026-08-18%20at%203.06.03%20PM.mp4'
    ];
    const hero = document.querySelector('.hero');
    const oldVideo = hero && hero.querySelector('.hero-video');
    if (!hero || !oldVideo || oldVideo.dataset.manlungPlaylist === 'true') return;

    const video = oldVideo.cloneNode(false);
    oldVideo.remove();
    video.id = 'heroVideoPlaylist';
    video.className = 'hero-video';
    video.dataset.manlungPlaylist = 'true';
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.loop = false;
    video.controls = false;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    hero.insertBefore(video, hero.firstChild);

    let current = 0;
    let moving = false;
    let errorTimer = null;

    function playClip(index) {
      current = (index + CLIPS.length) % CLIPS.length;
      moving = false;
      clearTimeout(errorTimer);
      video.src = CLIPS[current];
      video.load();
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
      errorTimer = setTimeout(() => {
        if (video.readyState === 0 && !moving) nextClip();
      }, 5000);
    }

    function nextClip() {
      if (moving) return;
      moving = true;
      playClip(current + 1);
    }

    video.addEventListener('ended', nextClip);
    video.addEventListener('error', nextClip);
    video.addEventListener('canplay', () => {
      clearTimeout(errorTimer);
      if (video.paused && !document.hidden) video.play().catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && video.paused) video.play().catch(() => {});
    });
    window.addEventListener('pageshow', () => video.play().catch(() => {}));
    playClip(0);
  }

  function boot() {
    convertLegacyButtons(); bindThemeButtons(); createThemeButton(); bindThemeButtons(); setTheme(readTheme(), false);
    installCallIconFix(); loadAdminCallIcons(); loadContactFab(); loadManlungAI();
    installHeroVideoPlaylist();
    window.setManlungTheme = (theme) => setTheme(theme, true);
    window.toggleDarkMode = () => setTheme(readTheme() === DARK ? LIGHT : DARK, true);
  }
  window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) setTheme(readTheme(), false); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
