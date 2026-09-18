(() => {
  'use strict';
  function init(){
    const menu=document.querySelector('.home-mobile-menu');
    const nav=document.getElementById('homeMobileNav');
    if(menu&&nav){
      menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav.hidden=open;menu.innerHTML=open?'<i class="fas fa-bars" aria-hidden="true"></i>':'<i class="fas fa-xmark" aria-hidden="true"></i>';});
      nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');nav.hidden=true;menu.innerHTML='<i class="fas fa-bars" aria-hidden="true"></i>'; }));
    }
    injectJourney();
    // Improve keyboard/scroll behavior without changing existing application logic.
    document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const id=a.getAttribute('href').slice(1),target=document.getElementById(id);if(target){e.preventDefault();target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}}));
  }
  function injectJourney(){
    if(document.getElementById('manlung-journey'))return;
    const anchor=document.querySelector('main')||document.body;
    const section=document.createElement('section');section.id='manlung-journey';section.className='manlung-journey';
    section.innerHTML=`<style>
      .manlung-journey{padding:70px 18px;background:#f8fafc;color:#0f172a}.manlung-journey-inner{max-width:1180px;margin:auto}.manlung-journey-head{text-align:center;max-width:760px;margin:0 auto 34px}.manlung-journey-head h2{font-size:clamp(1.6rem,4vw,2.4rem);margin:0 0 10px}.manlung-journey-head p{color:#64748b;margin:0}.manlung-journey-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.manlung-journey-card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 12px 35px rgba(15,23,42,.08)}.manlung-journey-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.manlung-journey-card div{padding:18px}.manlung-journey-card h3{margin:0 0 6px;font-size:1rem}.manlung-journey-card p{margin:0;color:#64748b;font-size:.85rem;line-height:1.5}@media(max-width:700px){.manlung-journey{padding:48px 12px}.manlung-journey-grid{grid-template-columns:1fr;gap:16px}.manlung-journey-card img{aspect-ratio:4/3}}
    </style><div class="manlung-journey-inner"><div class="manlung-journey-head"><h2>How Manlung Recovery Works</h2><p>See how requests enter the system, admins claim cases, reports are produced, and clients track progress.</p></div><div class="manlung-journey-grid">
      <article class="manlung-journey-card"><img src="https://i.postimg.cc/g0ZKwr2D/Chat-GPT-Image-Sep-16-2026-12-52-03-PM.png" alt="Calls and recovery requests entering the system" loading="lazy"><div><h3>1. Requests &amp; Calls Arrive</h3><p>Client requests and calls enter the recovery workflow for review.</p></div></article>
      <article class="manlung-journey-card"><img src="https://i.postimg.cc/jd36ZywK/Chat-GPT-Image-Sep-16-2026-12-55-35-PM.png" alt="Admins claim recovery cases" loading="lazy"><div><h3>2. Admins Claim Cases</h3><p>Admins claim cases from the dashboard and begin handling the work.</p></div></article>
      <article class="manlung-journey-card"><img src="https://i.postimg.cc/tCJWZ7rk/Chat-GPT-Image-Sep-16-2026-01-03-01-PM.png" alt="Daily weekly and monthly reports" loading="lazy"><div><h3>3. Reports &amp; Case Handling</h3><p>Daily, weekly and monthly reports give admins a structured view of activity.</p></div></article>
      <article class="manlung-journey-card"><img src="https://i.postimg.cc/kgrGJ5Lb/Chat-GPT-Image-Sep-16-2026-01-18-09-PM.png" alt="How to track your cases after submission" loading="lazy"><div><h3>4. Track Your Case</h3><p>After submission, clients can follow progress and updates through the portal.</p></div></article>
    </div></div>`;
    document.body.appendChild(section);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
