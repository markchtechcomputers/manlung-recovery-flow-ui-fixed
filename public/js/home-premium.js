(() => {
  'use strict';
  function init(){
    const menu=document.querySelector('.home-mobile-menu');
    const nav=document.getElementById('homeMobileNav');
    if(menu&&nav){
      menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav.hidden=open;menu.innerHTML=open?'<i class="fas fa-bars" aria-hidden="true"></i>':'<i class="fas fa-xmark" aria-hidden="true"></i>';});
      nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');nav.hidden=true;menu.innerHTML='<i class="fas fa-bars" aria-hidden="true"></i>'; }));
    }

    // Scroll-triggered reveal transitions for the main homepage journey.
    // Content remains visible by default; hiding is enabled only after JS initializes.
    const revealGroups = [
      { selector: '.intro-strip', stagger: false },
      { selector: '#services .section-heading, #how-it-works .section-heading, .home-section .section-heading', stagger: false },
      { selector: '.service-transition-rail', stagger: false },
      { selector: '.premium-service-card', stagger: true },
      { selector: '.process-step', stagger: true },
      { selector: '.tracker-card, .case-demo, .donation-card, .home-cta, .workflow-step, .workflow-card, .workflow-visual, .home-section .show-more-wrap', stagger: true }
    ];
    const revealNodes = new Set();
    revealGroups.forEach(group => document.querySelectorAll(group.selector).forEach((node, index) => {
      if (revealNodes.has(node)) return;
      revealNodes.add(node);
      node.classList.add('ml-scroll-reveal');
      if (group.stagger) node.style.setProperty('--ml-reveal-delay', (Math.min(index, 4) * 95) + 'ms');
      else node.classList.add('ml-reveal-soft');
    }));
    if (revealNodes.size && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      document.documentElement.classList.add('ml-reveal-ready');
      const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      }), { threshold: 0.12, rootMargin: '0px 0px -45px 0px' });
      revealNodes.forEach(node => revealObserver.observe(node));
    } else {
      revealNodes.forEach(node => node.classList.add('is-visible'));
    }

    // Improve keyboard/scroll behavior without changing existing application logic.
    document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const id=a.getAttribute('href').slice(1),target=document.getElementById(id);if(target){e.preventDefault();target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}}));
  }

  async function refreshLiveRecoveryStats(){
    const ids={
      recoveriesAndActiveInvestigations:document.getElementById('homeRecoveredCount'),
      registeredMembers:document.getElementById('homeMemberCount'),
      casesCurrentlyTraced:document.getElementById('homeTracedCount')
    };
    if(!ids.recoveriesAndActiveInvestigations&&!ids.registeredMembers&&!ids.casesCurrentlyTraced)return;
    try{
      const response=await fetch('/api/public/recovery-stats',{cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json();
      if(!response.ok||!data.success||!data.counts)throw new Error('stats unavailable');
      Object.entries(ids).forEach(([key,node])=>{
        if(node)node.textContent=Number(data.counts[key]||0).toLocaleString();
      });
    }catch(_){
      // Keep the last displayed value instead of replacing real counts with false zeros.
    }
  }

  refreshLiveRecoveryStats();
  window.setInterval(refreshLiveRecoveryStats,30000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
