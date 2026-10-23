(function () {
  'use strict';

  function setThemeIcon(button) {
    if (!button) return;

    const dark =
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark');
    const icon = button.querySelector('i');

    if (icon) icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';

    button.setAttribute(
      'aria-label',
      dark ? 'Switch to light mode' : 'Switch to dark mode'
    );
    button.setAttribute(
      'title',
      dark ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  function initMobileHeader() {
    const menuToggle = document.getElementById('mobileMenuToggle');
    const menu = document.getElementById('mobileMenu');
    const menuClose = document.getElementById('mobileMenuClose');
    const backdrop = document.getElementById('mobileMenuBackdrop');
    const themeToggle = document.getElementById('mobileThemeToggle');

    if (menuToggle && menu && menuClose && backdrop) {
      function setMenuOpen(open) {
        menu.classList.toggle('open', open);
        backdrop.classList.toggle('open', open);
        menuToggle.classList.toggle('active', open);
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        menuToggle.setAttribute('title', open ? 'Close menu' : 'Open menu');
        menu.setAttribute('aria-hidden', String(!open));
        backdrop.setAttribute('aria-hidden', String(!open));
        document.body.classList.toggle('mobile-menu-open', open);

        if (open) menuClose.focus();
        else menuToggle.focus();
      }

      menuToggle.addEventListener('click', function () {
        setMenuOpen(!menu.classList.contains('open'));
      });
      menuClose.addEventListener('click', function () {
        setMenuOpen(false);
      });
      backdrop.addEventListener('click', function () {
        setMenuOpen(false);
      });
      menu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          setMenuOpen(false);
        });
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu.classList.contains('open')) {
          setMenuOpen(false);
        }
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 650 && menu.classList.contains('open')) {
          setMenuOpen(false);
        }
      });

      setMenuOpen(false);
    }

    if (themeToggle) {
      setThemeIcon(themeToggle);
      themeToggle.addEventListener('click', function () {
        if (typeof window.toggleTheme === 'function') {
          window.toggleTheme();
        } else {
          const html = document.documentElement;
          const body = document.body;
          const dark = html.classList.contains('dark') || body.classList.contains('dark');
          html.classList.toggle('dark', !dark);
          body.classList.toggle('dark', !dark);
          try {
            localStorage.setItem('theme', !dark ? 'dark' : 'light');
          } catch (error) {}
        }
        setTimeout(function () { setThemeIcon(themeToggle); }, 0);
      });
    }

    const observer = new MutationObserver(function () {
      setThemeIcon(themeToggle);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileHeader);
  } else {
    initMobileHeader();
  }
})();
