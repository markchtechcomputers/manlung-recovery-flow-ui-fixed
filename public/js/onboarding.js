(function () {
  const STORAGE_KEY = 'manlungHomeOnboardingSeen';

  const steps = [
    {
      icon: 'fa-hand',
      title: 'Welcome to Manlung Recovery',
      text: 'Here is a quick guide to using the platform from start to finish.',
      tips: [
        ['fa-user-shield', 'Secure access', 'Create an account so your requests can be connected to your profile.'],
        ['fa-shield-halved', 'Recovery support', 'The platform is designed for structured digital recovery and investigation support.'],
        ['fa-circle-info', 'Simple process', 'Create your account, submit your case, then track the progress securely.']
      ]
    },
    {
      icon: 'fa-user-plus',
      title: 'Create Your Account',
      text: 'Start by creating a client account before submitting a case.',
      tips: [
        ['fa-user-plus', 'Open Sign Up', 'Choose Sign Up or Create Account from the site menu.'],
        ['fa-envelope', 'Use your details', 'Enter a valid email and a strong password that you can remember.'],
        ['fa-right-to-bracket', 'Log in', 'After registration, use Login to access your client dashboard and case features.']
      ]
    },
    {
      icon: 'fa-file-circle-plus',
      title: 'Submit a Case',
      text: 'Give the system enough information to understand the recovery request.',
      tips: [
        ['fa-file-circle-plus', 'Open New Request', 'Choose New Request from the menu or the homepage.'],
        ['fa-clipboard-list', 'Describe the problem', 'Provide accurate case details, dates and relevant information.'],
        ['fa-paperclip', 'Add evidence', 'Upload supported evidence when requested. Do not upload unnecessary private material.']
      ]
    },
    {
      icon: 'fa-diagram-project',
      title: 'How the System Works',
      text: 'Your request moves through a structured process instead of being treated as an instant result.',
      tips: [
        ['fa-inbox', '1. Submission', 'Your request is received and recorded as a case.'],
        ['fa-magnifying-glass', '2. Review', 'The case can be reviewed and investigated using the information you provide.'],
        ['fa-list-check', '3. Updates', 'Your dashboard can be used to follow the case and review available updates.']
      ]
    },
    {
      icon: 'fa-folder-open',
      title: 'Track Your Case',
      text: 'Your dashboard is the main place for following submitted requests.',
      tips: [
        ['fa-folder-open', 'My Cases', 'Open My Cases to see cases associated with your account.'],
        ['fa-clock', 'Case status', 'Check the current stage or available status information.'],
        ['fa-eye', 'Case details', 'Review the information already submitted so you can keep your records accurate.']
      ]
    },
    {
      icon: 'fa-phone-volume',
      title: 'Private Calls & Support',
      text: 'Some services can involve direct communication with support or an available administrator.',
      tips: [
        ['fa-phone', 'Call Admin', 'Use the supported call feature when you need direct assistance.'],
        ['fa-lock', 'Private access', 'Call and support functions are protected by authentication and access controls.'],
        ['fa-microphone', 'Permission', 'Your browser may ask for microphone or camera permission when a supported call requires it.']
      ]
    },
    {
      icon: 'fa-user-lock',
      title: 'Privacy & Security',
      text: 'Protect your account and only provide information that is necessary for your request.',
      tips: [
        ['fa-lock', 'Keep your account private', 'Never share your password, verification codes or recovery codes with another person.'],
        ['fa-shield-halved', 'Secure sessions', 'Protected areas require authentication and are separated by user roles.'],
        ['fa-file-shield', 'Handle evidence carefully', 'Only submit evidence relevant to your case and avoid exposing unrelated personal information.']
      ]
    },
    {
      icon: 'fa-circle-check',
      title: 'You Are Ready',
      text: 'You now know the main steps for using Manlung Recovery.',
      tips: [
        ['fa-user-plus', 'Create an account', 'Register first if you do not already have a client account.'],
        ['fa-file-circle-plus', 'Submit a case', 'Create a New Request when you need recovery assistance.'],
        ['fa-folder-open', 'Follow progress', 'Return to My Cases to keep up with your requests.']
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
      overlay.setAttribute('aria-hidden', 'true');

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
        return `
          <div class="manlung-onboarding-tip">
            <i class="fas ${tip[0]}" aria-hidden="true"></i>
            <div class="manlung-onboarding-tip-content">
              <strong>${tip[1]}</strong>
              <span>${tip[2]}</span>
            </div>
          </div>
        `;
      }).join('');

      progress.textContent = (current + 1) + ' of ' + steps.length;
      next.textContent = current === steps.length - 1 ? 'Finish' : 'Next →';
    }

    next.addEventListener('click', function () {
      if (current < steps.length - 1) {
        current += 1;
        render();
      } else {
        closeOnboarding();
      }
    });

    if (close) {
      close.addEventListener('click', closeOnboarding);
    }

    if (skip) {
      skip.addEventListener('click', closeOnboarding);
    }

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
        overlay.setAttribute('aria-hidden', 'false');
      }, 700);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
