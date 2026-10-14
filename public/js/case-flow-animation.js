/* One-at-a-time rotating case workflow copy for the homepage hero. */
(() => {
  const init = () => {
    const root = document.querySelector('[data-mr-case-flow]');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';
    const title = root.querySelector('[data-flow-title]');
    const desc = root.querySelector('[data-flow-desc]');
    const step = root.querySelector('[data-flow-step]');
    const progress = [...root.querySelectorAll('[data-flow-dot]')];
    const stages = [
      {title:'New case submitted',desc:'A client sends a recovery request and the case enters the queue.',label:'Request received'},
      {title:'Admin reviews the case',desc:'The admin checks the request details and assesses the next steps.',label:'Admin review'},
      {title:'Case claimed and started',desc:'An admin claims the case and begins working through the recovery process.',label:'Case in progress'},
      {title:'Live chat and updates',desc:'Client and admin communicate through case-linked messages and progress updates.',label:'Client communication'},
      {title:'Evidence securely recorded',desc:'Relevant evidence and chat history stay organized with the case.',label:'Evidence & history'}
    ];
    let current = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const show = (index) => {
      root.querySelector('.mr-case-flow-stage')?.classList.add('is-out');
      window.setTimeout(() => {
        const item = stages[index];
        title.textContent = item.title;
        desc.textContent = item.desc;
        step.textContent = item.label;
        progress.forEach((dot, i) => {
          dot.classList.toggle('active', i === index);
          dot.setAttribute('aria-current', i === index ? 'step' : 'false');
        });
        root.querySelector('.mr-case-flow-stage')?.classList.remove('is-out');
      }, reduced ? 0 : 350);
    };
    show(current);
    if (!reduced) window.setInterval(() => { current = (current + 1) % stages.length; show(current); }, 3400);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();