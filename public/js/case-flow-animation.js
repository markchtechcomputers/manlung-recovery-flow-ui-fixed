/* Accessible, slow-paced workflow rotation for the homepage hero. */
(() => {
  const init = () => {
    const root = document.querySelector('[data-mr-case-flow]');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    const title = root.querySelector('[data-flow-title]');
    const desc = root.querySelector('[data-flow-desc]');
    const step = root.querySelector('[data-flow-step]');
    const stepIcon = root.querySelector('[data-flow-icon]');
    const progress = [...root.querySelectorAll('[data-flow-dot]')];
    const stage = root.querySelector('.mr-case-flow-stage');
    const stages = [
      { title: 'Case request submitted', desc: 'The client sends a recovery request with the details needed to begin.', label: '01 · Request received', icon: 'fa-inbox' },
      { title: 'Admin reviews the case', desc: 'The request appears in the admin queue for review and triage.', label: '02 · Admin review', icon: 'fa-user-shield' },
      { title: 'Case claimed for work', desc: 'An authorized admin claims the case and starts the next steps.', label: '03 · Work begins', icon: 'fa-briefcase' },
      { title: 'Chat and progress updates', desc: 'The client and admin exchange case-related messages and updates.', label: '04 · Communication', icon: 'fa-comments' },
      { title: 'Evidence and chat history', desc: 'Relevant evidence and conversation history remain organized with the case.', label: '05 · Case records', icon: 'fa-folder-open' }
    ];
    let current = 0;
    let timer = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const show = (index) => {
      if (stage) stage.classList.add('is-out');
      window.setTimeout(() => {
        const item = stages[index];
        title.textContent = item.title;
        desc.textContent = item.desc;
        step.textContent = item.label;
        if (stepIcon && item.icon) stepIcon.className = `fas ${item.icon}`;
        progress.forEach((dot, i) => {
          dot.classList.toggle('active', i === index);
          if (i === index) dot.setAttribute('aria-current', 'step');
          else dot.removeAttribute('aria-current');
        });
        if (stage) stage.classList.remove('is-out');
      }, reduced ? 0 : 500);
    };

    show(current);
    if (!reduced && stages.length > 1) {
      timer = window.setInterval(() => {
        current = (current + 1) % stages.length;
        show(current);
      }, 5600);
    }
    window.addEventListener('pagehide', () => {
      if (timer) window.clearInterval(timer);
    }, { once: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
