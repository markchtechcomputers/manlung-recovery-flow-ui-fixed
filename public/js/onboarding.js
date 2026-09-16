(function () {
  const STORAGE_KEY = 'manlungHomeOnboardingSeen';

  const steps = [
    {
      icon: 'fa-shield-halved',
      title: 'Welcome to Manlung Recovery',
      text: 'A quick guide to help you find the important parts of the site.',
      tips: [
        ['fa-shield-halved', 'Explore our cybersecurity and digital recovery services.'],
        ['fa-file-circle-plus', 'Use New Request when you need to start a recovery case.'],
        ['fa-folder-open', 'Use My Cases to track requests you have already submitted.']
      ]
    },
    {
      icon: 'fa-bars',
      title: 'Use the Menu',
      text: 'On your phone, tap the menu button at the top-right.',
      tips: [
        ['fa-bars', 'Open the menu to access Home, Services, My Cases and more.'],
        ['fa-moon', 'Use the moon/sun icon beside the menu to switch themes.'],
        ['fa-phone', 'Contact support from the Contact section when needed.']
      ]
    },
    {
      icon: 'fa-circle-check',
      title: 'You Are Ready',
      text: 'You now know where the main features are.',
      tips: [
        ['fa-file-circle-plus', 'Start with New Request when you need assistance.'],
        ['fa-folder-open', 'Check My Cases to follow your case progress.'],
        ['fa-house', 'Return Home anytime using the logo or Home link.']
      ]
    }
  ];

  function init() {
    const overlay = document.getElementById('manlung-onboarding');
    const icon = document.getElementById('manlungOnboardingIcon');
    const title = document.getElementById('manlungOnboardingTitle');
    const text = document.getElementById('manlungOnboardingText');
    const body = document.getElementById('manlungOnboardingBody');
    const progress = document.getElementById('manlungOnboardingProgress');
    const next = document.getElementById('manlungOnboardingNext');
    const close = document.getElementById('manlungOnboardingClose');
    const skip = document.getElementById('manlungOnboardingSkip');

    if (!overlay || !icon || !title || !text || !body || !progress || !next) return;

    let current = 0;

    function closeOnboarding() {
      overlay.classList.remove('open');

      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch (e) {}
    }

    function render() {
      const step = steps[current];

      icon.className = 'manlung-onboarding-icon fas ' + step.icon;
      title.textContent = step.title;
      text.textContent = step.text;

      body.innerHTML = step.tips.map(function (tip) {
        return (
          '<div class="manlung-onboarding-tip">' +
            '<i class="fas ' + tip[0] + '" aria-hidden="true"></i>' +
            '<span>' + tip[1] + '</span>' +
          '</div>'
        );
      }).join('');

      progress.textContent = (current + 1) + ' of ' + steps.length;
      next.textContent = current === steps.length - 1 ? 'Done' : 'Next →';
    }

    next.addEventListener('click', function () {
      if (current < steps.length - 1) {
        current += 1;
        render();
      } else {
        closeOnboarding();
      }
    });

    close.addEventListener('click', closeOnboarding);

    skip.addEventListener('click', closeOnboarding);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeOnboarding();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('open')) {
        closeOnboarding();
      }
    });

    render();

    let seen = false;

    try {
      seen = localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {}

    if (!seen) {
      setTimeout(function () {
        overlay.classList.add('open');
      }, 700);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
