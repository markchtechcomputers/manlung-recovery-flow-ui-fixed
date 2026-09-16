/* Manlung Recovery — privileged 24-hour session guard. */
(function(){'use strict';
  const login='/admin/login.html?reason=session-expired';
  let checking=false;
  async function check(){
    if(checking||location.pathname==='/admin/login.html')return; checking=true;
    try{
      const r=await fetch('/api/auth/verify',{credentials:'include',cache:'no-store'});
      if(!r.ok){
        try{localStorage.removeItem('adminUser');sessionStorage.removeItem('adminUser')}catch(_){}
        location.replace(login);
      } else {
        const d=await r.json().catch(()=>({}));
        if(!d.success||!['admin','owner'].includes(d.user?.role)){
          try{localStorage.removeItem('adminUser');sessionStorage.removeItem('adminUser')}catch(_){}
          location.replace(login);
        }
      }
    }catch(_){} finally{checking=false;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
  setInterval(check,2*60*1000);
})();
