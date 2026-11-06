/* Shared mobile navigation for authenticated Manlung client portal pages. */
(function(){
  if(window.__manlungClientPortalChrome)return;
  window.__manlungClientPortalChrome=true;
  if(!document.body)return;
  const path=location.pathname.replace(/\\/+$/,'')||'/';
  const links=[
    {href:'/client/dashboard',label:'Dashboard',icon:'fa-house',match:p=>p==='/client/dashboard'},
    {href:'/client/request',label:'New case',icon:'fa-file-circle-plus',match:p=>p==='/client/request'},
    {href:'/client/track',label:'Track',icon:'fa-route',match:p=>['/client/track','/client/recovery-center','/client/live-location','/client/device-recovery'].includes(p)},
    {href:'/client/settings',label:'Account',icon:'fa-user-gear',match:p=>p==='/client/settings'||p==='/donation-history.html'||p==='/donation-receipt.html'}
  ];
  const nav=document.createElement('nav');
  nav.className='client-mobile-nav';
  nav.setAttribute('aria-label','Client portal navigation');
  links.forEach(item=>{
    const a=document.createElement('a');
    a.href=item.href;
    a.innerHTML='<i class="fas '+item.icon+'" aria-hidden="true"></i><span>'+item.label+'</span>';
    if(item.match(path))a.setAttribute('aria-current','page');
    nav.appendChild(a);
  });
  document.body.appendChild(nav);
})();