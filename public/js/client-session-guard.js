/* Manlung Recovery — client weekly session guard. Server JWT remains authoritative. */
(function(){'use strict';
  const TOKEN='clientToken';
  const login='/login.html?reason=session-expired';
  function clear(){try{localStorage.removeItem(TOKEN);localStorage.removeItem('clientUser');localStorage.removeItem('clientSessionStartedAt');}catch(_){}}
  async function check(){
    const token=(()=>{try{return localStorage.getItem(TOKEN)}catch(_){return null}})();
    if(!token){ location.replace(login); return false; }
    try{
      const r=await fetch('/api/auth/verify',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      if(!r.ok){clear();location.replace(login);return false;}
      const d=await r.json().catch(()=>({}));
      if(d.success&&d.user?.role==='client') return true;
    }catch(_){}
    clear();location.replace(login);return false;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>check(),{once:true});else check();
  setInterval(check,5*60*1000);
})();
