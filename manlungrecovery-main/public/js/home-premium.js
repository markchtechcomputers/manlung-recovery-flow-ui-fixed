(() => {
  'use strict';
  function init(){
    const menu=document.querySelector('.home-mobile-menu');
    const nav=document.getElementById('homeMobileNav');
    if(menu&&nav){
      menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav.hidden=open;menu.innerHTML=open?'<i class="fas fa-bars" aria-hidden="true"></i>':'<i class="fas fa-xmark" aria-hidden="true"></i>';});
      nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');nav.hidden=true;menu.innerHTML='<i class="fas fa-bars" aria-hidden="true"></i>'; }));
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
