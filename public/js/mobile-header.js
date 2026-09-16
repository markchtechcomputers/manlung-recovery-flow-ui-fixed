(function () {
  function setThemeIcon(button) {
    if (!button) return;

    const dark =
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark');

    const icon = button.querySelector('i');

    if (icon) {
      icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
    }

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
    const themeToggle = document.getElementById('mobileThemeToggle');

    if (menuToggle && menu) {
      menuToggle.addEventListener('click', function () {
        const open = menu.classList.toggle('open');

        menuToggle.classList.toggle('active', open);
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute(
          'aria-label',
          open ? 'Close menu' : 'Open menu'
        );
      });

      menu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          menu.classList.remove('open');
          menuToggle.classList.remove('active');
          menuToggle.setAttribute('aria-expanded', 'false');
          menuToggle.setAttribute('aria-label', 'Open menu');
        });
      });
    }

    if (themeToggle) {
      setThemeIcon(themeToggle);

      themeToggle.addEventListener('click', function () {
        /*
         * Use the existing site's theme function when available.
         */
        if (typeof window.toggleTheme === 'function') {
          window.toggleTheme();
        } else {
          const html = document.documentElement;
          const body = document.body;
          const dark =
            html.classList.contains('dark') ||
            body.classList.contains('dark');

          html.classList.toggle('dark', !dark);
          body.classList.toggle('dark', !dark);

          try {
            localStorage.setItem('theme', !dark ? 'dark' : 'light');
          } catch (e) {}
        }

        setTimeout(function () {
          setThemeIcon(themeToggle);
        }, 0);
      });
    }

    /*
     * Keep the icon synchronized if another theme control changes
     * the page theme.
     */
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
