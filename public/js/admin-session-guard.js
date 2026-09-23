/* Manlung Recovery — privileged 24-hour session guard. */
(function(){'use strict';
  const login='/admin/login.html?reason=session-expired';
  let checking=false;
  async function check(){
    if(checking||location.pathname==='/admin/login.html')return; checking=true;
    try{
      const r=await fetch('/api/auth/verify',{credentials:'include',cache:'no-store'});
      if(r.status===401||r.status===403){
        try{localStorage.removeItem('adminUser');sessionStorage.removeItem('adminUser')}catch(_){}
        location.replace(login);
        return;
      }
      if(r.ok){
        const d=await r.json().catch(()=>({}));
        if(!d.success||!['admin','owner'].includes(d.user?.role)){
          try{localStorage.removeItem('adminUser');sessionStorage.removeItem('adminUser')}catch(_){}
          location.replace(login);
        }
      }
    }catch(_){} finally{checking=false;}
  }
  function mountBinaryOrbit(){
    if(document.getElementById('manlungBinaryOrbit')||location.pathname==='/admin/login.html')return;
    const wrap=document.createElement('div');
    wrap.id='manlungBinaryOrbit';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML='<div class="mbo-core">01</div><div class="mbo-ring mbo-ring-a"><span>01001001</span></div><div class="mbo-ring mbo-ring-b"><span>10110110</span></div><div class="mbo-ring mbo-ring-c"><span>11001010</span></div><div class="mbo-label">SECURE SESSION</div>';
    document.body.appendChild(wrap);
    const style=document.createElement('style');
    style.id='manlung-binary-orbit-style';
    style.textContent=`#manlungBinaryOrbit{position:fixed;right:18px;bottom:18px;width:112px;height:112px;z-index:900;pointer-events:none;filter:drop-shadow(0 8px 18px rgba(0,0,0,.2));opacity:.9}
#manlungBinaryOrbit:before{content:"";position:absolute;inset:22px;border:1px solid rgba(96,165,250,.28);border-radius:50%;box-shadow:0 0 24px rgba(59,130,246,.14)}
.mbo-core{position:absolute;inset:39px;display:grid;place-items:center;border:1px solid rgba(125,211,252,.55);border-radius:50%;background:rgba(7,18,32,.88);color:#67e8f9;font:800 11px/1 ui-monospace,SFMono-Regular,monospace;letter-spacing:.12em;box-shadow:0 0 18px rgba(34,211,238,.22)}
.mbo-ring{position:absolute;inset:8px;border:1px dashed rgba(96,165,250,.34);border-radius:50%;animation:mbo-spin 8s linear infinite}
.mbo-ring:before{content:"";position:absolute;left:50%;top:-4px;width:7px;height:7px;border-radius:50%;background:#67e8f9;box-shadow:0 0 10px #67e8f9;transform:translateX(-50%)}
.mbo-ring span{position:absolute;top:2px;left:50%;transform:translateX(-50%);color:rgba(147,197,253,.72);font:700 7px/1 ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em;white-space:nowrap}
.mbo-ring-b{inset:17px;animation-duration:6s;animation-direction:reverse;border-color:rgba(45,212,191,.3)}
.mbo-ring-b:before{background:#2dd4bf;box-shadow:0 0 10px #2dd4bf;top:auto;bottom:-4px}
.mbo-ring-c{inset:28px;animation-duration:4.5s;border-color:rgba(167,139,250,.28)}
.mbo-ring-c:before{background:#a78bfa;box-shadow:0 0 10px #a78bfa;left:auto;right:-4px;top:50%;transform:translateY(-50%)}
.mbo-label{position:absolute;bottom:-13px;left:50%;transform:translateX(-50%);white-space:nowrap;color:rgba(100,116,139,.78);font:700 6px/1 ui-monospace,SFMono-Regular,monospace;letter-spacing:.18em}
@keyframes mbo-spin{to{transform:rotate(360deg)}}
@media(max-width:650px){#manlungBinaryOrbit{right:9px;bottom:10px;transform:scale(.82);transform-origin:bottom right;opacity:.78}}
@media(prefers-reduced-motion:reduce){.mbo-ring{animation:none}}`;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mountBinaryOrbit();check()},{once:true});else{mountBinaryOrbit();check();}
  setInterval(check,2*60*1000);
})();
