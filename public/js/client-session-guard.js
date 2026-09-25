/* Manlung Recovery — client weekly session guard. Server JWT remains authoritative. */
(function(){'use strict';
  const login='/login.html?reason=session-expired';
  function clear(){try{localStorage.removeItem('clientUser');localStorage.removeItem('clientSessionStartedAt');}catch(_){}}
  async function check(){
    
    try{
      const r=await fetch('/api/auth/verify',{credentials:'include',cache:'no-store'});
      if(!r.ok){clear();location.replace(login);return false;}
      const d=await r.json().catch(()=>({}));
      if(d.success&&d.user?.role==='client') return true;
    }catch(_){}
    clear();location.replace(login);return false;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>check(),{once:true});else check();
  // Detect a newer login on another browser quickly and redirect the old session.
  setInterval(check,15*1000);
})();
