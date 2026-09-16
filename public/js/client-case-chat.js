(() => {
  'use strict';
  if (!location.pathname.startsWith('/client/track.html')) return;

  const token = () => localStorage.getItem('clientToken') || '';
  const user = () => { try { return JSON.parse(localStorage.getItem('clientUser') || 'null'); } catch (_) { return null; } };
  const caseId = () => { const p = new URLSearchParams(location.search); return (p.get('case') || p.get('caseId') || '').trim(); };
  const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
  const time = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], {dateStyle:'medium',timeStyle:'short'}); };

  function styles(){
    if(document.getElementById('mlc-style')) return;
    const s=document.createElement('style'); s.id='mlc-style'; s.textContent=`
      .mlc{margin-top:1.1rem;overflow:hidden;border:1px solid rgba(96,165,250,.2);border-radius:18px;background:#07111f;box-shadow:0 16px 42px rgba(2,6,23,.2)}
      .mlc-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.05rem;border-bottom:1px solid rgba(148,163,184,.12);background:linear-gradient(135deg,rgba(37,99,235,.18),rgba(14,165,233,.04))}
      .mlc-title{display:flex;align-items:center;gap:.7rem;min-width:0}.mlc-avatar{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:#fff}.mlc-title h3{margin:0;color:#f8fafc;font-size:1rem}.mlc-title p{margin:.18rem 0 0;color:#94a3b8;font-size:.72rem}
      .mlc-live{display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .55rem;border-radius:999px;background:rgba(34,197,94,.08);border:1px solid rgba(74,222,128,.2);color:#86efac;font-size:.67rem;font-weight:800}.mlc-live i{font-size:.45rem}
      .mlc-info{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;padding:.6rem 1.05rem;border-bottom:1px solid rgba(148,163,184,.08);color:#94a3b8;font-size:.68rem}.mlc-info span{padding:.3rem .5rem;border-radius:7px;background:rgba(255,255,255,.035)}.mlc-unread{margin-left:auto;color:#7dd3fc;font-weight:800}
      .mlc-list{height:390px;overflow:auto;padding:1rem;background:radial-gradient(circle at 20% 0%,rgba(37,99,235,.08),transparent 35%),#07111f}.mlc-list::-webkit-scrollbar{width:7px}.mlc-list::-webkit-scrollbar-thumb{background:rgba(148,163,184,.24);border-radius:999px}
      .mlc-empty{min-height:100%;display:grid;place-items:center;text-align:center;color:#94a3b8;padding:2rem}.mlc-empty strong{display:block;color:#e2e8f0;margin-bottom:.25rem}
      .mlc-bubble{max-width:min(82%,620px);margin:0 0 .75rem;padding:.72rem .82rem;border-radius:15px 15px 15px 5px;border:1px solid rgba(148,163,184,.12);background:#111d2d;color:#e2e8f0}.mlc-bubble.mine{margin-left:auto;border-radius:15px 15px 5px 15px;background:linear-gradient(135deg,#1d4ed8,#2563eb);border-color:rgba(147,197,253,.22);color:#fff}
      .mlc-meta{display:flex;justify-content:space-between;gap:.7rem;margin-bottom:.3rem;color:#94a3b8;font-size:.64rem;font-weight:700}.mlc-bubble.mine .mlc-meta{color:#dbeafe}.mlc-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;font-size:.82rem}
      .mlc-compose{padding:.8rem;background:#0a1727;border-top:1px solid rgba(148,163,184,.1)}
      .mlc-row{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:.55rem;align-items:end;width:100%}
      .mlc-input{width:100%;box-sizing:border-box;min-height:52px;max-height:140px;resize:none;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:#0f1d2e;color:#f8fafc;padding:.75rem .8rem;outline:none;font:inherit;font-size:.8rem}
      .mlc-input:focus{border-color:rgba(96,165,250,.65);box-shadow:0 0 0 3px rgba(37,99,235,.1)}
      .mlc-send{display:inline-flex!important;visibility:visible!important;opacity:1!important;width:92px!important;min-width:92px!important;height:52px!important;padding:0 .65rem!important;box-sizing:border-box!important;align-items:center!important;justify-content:center!important;gap:.4rem!important;border:0!important;border-radius:13px!important;background:#2563eb!important;color:#fff!important;cursor:pointer!important;font:inherit!important;font-size:.78rem!important;font-weight:800!important;white-space:nowrap!important;box-shadow:0 7px 18px rgba(37,99,235,.25)!important}
      .mlc-send:hover{background:#1d4ed8!important}.mlc-send:active{transform:translateY(1px)}.mlc-send:disabled{opacity:.55!important;cursor:not-allowed!important}.mlc-send i{display:inline-block!important;color:#fff!important}.mlc-send span{display:inline!important;color:#fff!important}
      .mlc-note{display:flex;justify-content:space-between;gap:.5rem;margin-top:.45rem;color:#64748b;font-size:.64rem}.mlc-error{display:none;margin:.55rem 1rem 0;padding:.55rem .7rem;border-radius:9px;background:rgba(239,68,68,.08);border:1px solid rgba(248,113,113,.18);color:#fca5a5;font-size:.7rem}
      @media(max-width:600px){.mlc-head{padding:.85rem}.mlc-info{padding:.55rem .85rem}.mlc-list{height:55vh;min-height:300px}.mlc-bubble{max-width:91%}.mlc-row{grid-template-columns:minmax(0,1fr) 86px;gap:.4rem}.mlc-send{width:86px!important;min-width:86px!important;height:50px!important;font-size:.74rem!important}.mlc-compose{padding:.7rem}.mlc-note{font-size:.6rem}}
    `; document.head.appendChild(s);
  }

  async function boot(){
    const id=caseId(), t=token(), me=user();
    if(!id || !t || !me?.id) return;
    styles();
    const content=document.getElementById('content'); if(!content) return;
    let n=0; while(n++<80 && !document.querySelector('.manlung-message-card')) await new Promise(r=>setTimeout(r,150));
    document.querySelectorAll('.manlung-message-card').forEach(x=>x.remove());
    if(document.getElementById('mlc')) return;

    const card=document.createElement('section'); card.id='mlc'; card.className='mlc'; card.innerHTML=`
      <div class="mlc-head"><div class="mlc-title"><div class="mlc-avatar"><i class="fas fa-comments"></i></div><div><h3>Secure Case Messages</h3><p>Direct conversation with your recovery investigator</p></div></div><span class="mlc-live"><i class="fas fa-circle"></i> LIVE</span></div>
      <div class="mlc-info"><span><i class="fas fa-shield-alt"></i> Private case channel</span><span><i class="fas fa-hashtag"></i> ${esc(id)}</span><span class="mlc-unread" id="mlcUnread">Checking…</span></div>
      <div class="mlc-list" id="mlcList" aria-live="polite"><div class="mlc-empty"><div><strong>Loading secure messages…</strong><span>Your conversation will appear here.</span></div></div></div>
      <div class="mlc-error" id="mlcError"></div>
      <form class="mlc-compose" id="mlcForm"><div class="mlc-row"><textarea class="mlc-input" id="mlcInput" maxlength="5000" placeholder="Write a message to your recovery investigator…"></textarea><button class="mlc-send" id="mlcSend" type="submit" title="Send message"><i class="fas fa-paper-plane"></i><span>Send</span></button></div><div class="mlc-note"><span>Enter to send · Shift+Enter for a new line</span><span id="mlcCount">0 / 5000</span></div></form>`;
    content.appendChild(card);

    const list=card.querySelector('#mlcList'), input=card.querySelector('#mlcInput'), send=card.querySelector('#mlcSend'), form=card.querySelector('#mlcForm'), err=card.querySelector('#mlcError'), unread=card.querySelector('#mlcUnread'), count=card.querySelector('#mlcCount');
    let signature='', first=true;
    const showErr=(v)=>{err.textContent=v||'';err.style.display=v?'block':'none';};

    async function load(){
      const tk=token(); if(!tk) return;
      try{
        const r=await fetch(`/api/messages/case/${encodeURIComponent(id)}?_=${Date.now()}`,{headers:{Authorization:`Bearer ${tk}`,Accept:'application/json'},cache:'no-store'});
        const d=await r.json().catch(()=>({})); if(!r.ok||!d.success) throw new Error(d.error||`Unable to load messages (${r.status})`);
        const msgs=Array.isArray(d.messages)?d.messages:[];
        const sig=msgs.map(m=>`${m.id}:${m.read_at||''}`).join('|');
        const near=list.scrollHeight-list.scrollTop-list.clientHeight<100;
        if(sig!==signature){
          list.innerHTML=msgs.length?msgs.map(m=>{const mine=String(m.sender_user_id)===String(me.id);return `<article class="mlc-bubble ${mine?'mine':''}"><div class="mlc-meta"><span>${mine?'You':'Recovery Investigator'}</span><time>${esc(time(m.created_at))}</time></div><div class="mlc-text">${esc(m.message)}</div></article>`}).join(''):`<div class="mlc-empty"><div><strong>No messages yet</strong><span>Send a message below to start the conversation.</span></div></div>`;
          signature=sig; if(first||near) list.scrollTop=list.scrollHeight;
        }
        const incoming=msgs.filter(m=>!m.read_at&&String(m.recipient_user_id)===String(me.id));
        unread.textContent=incoming.length?`${incoming.length} unread`:'All messages read';
        if(incoming.length){ await Promise.all(incoming.map(m=>fetch(`/api/messages/${encodeURIComponent(m.id)}/read`,{method:'POST',headers:{Authorization:`Bearer ${tk}`,Accept:'application/json'}}).catch(()=>null))); signature=''; }
        showErr(''); first=false;
      }catch(e){showErr(e.message||'Could not load the case conversation.');}
    }
    async function sendMessage(){
      const text=input.value.trim(); if(!text) return; send.disabled=true; showErr('');
      try{const tk=token();const r=await fetch(`/api/messages/case/${encodeURIComponent(id)}`,{method:'POST',headers:{Authorization:`Bearer ${tk}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({message:text})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw new Error(d.error||'Could not send message.');input.value='';count.textContent='0 / 5000';signature='';await load();list.scrollTop=list.scrollHeight;}catch(e){showErr(e.message||'Could not send message.');}finally{send.disabled=false;input.focus();}
    }
    input.addEventListener('input',()=>count.textContent=`${input.value.length} / 5000`);
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
    form.addEventListener('submit',e=>{e.preventDefault();sendMessage();});
    await load(); window.setInterval(load,2500); window.addEventListener('focus',load); document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
