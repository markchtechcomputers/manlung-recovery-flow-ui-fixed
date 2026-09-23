(function(){
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const official={
  android:{name:'Google Find Hub',url:'https://www.google.com/android/find/'},
  iphone:{name:'Apple Find My',url:'https://www.icloud.com/find'},
  windows:{name:'Microsoft Find My Device',url:'https://account.microsoft.com/devices'},
  mac:{name:'Apple Find My',url:'https://www.icloud.com/find'}
};
const state={platform:'android',status:'NO CASE SELECTED',caseId:null,actor:null,cases:[],selected:null};
const $=id=>document.getElementById(id);
const finished=['Recovery Successful','Recovered by Police','Recovered by Owner','Closed','Rejected'];
let recoveryMap=null,recoveryMapLayer=null,recoveryMapFitTimer=null;

function mask(v){
  v=String(v||'').trim();
  return v.length<7?(v?'••••':'Not provided'):v.slice(0,3)+'••••••••'+v.slice(-3);
}
function formatDate(v){
  if(!v)return '—';
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'—':d.toLocaleString();
}
function escapeAttr(v){return esc(v).replace(/"/g,'&quot;');}
function serviceFor(platform){return official[platform]||official.android;}

function setPlatform(p){
  state.platform=p;
  document.querySelectorAll('.dr-platform').forEach(x=>x.classList.toggle('active',x.dataset.platform===p));
  const o=serviceFor(p);
  if($('officialService'))$('officialService').textContent=o.name;
  if($('officialLink')){$('officialLink').href=o.url;$('officialLink').textContent='Continue with '+o.name;}
  if($('locationServiceLink')){$('locationServiceLink').href=o.url;$('locationServiceLink').innerHTML='<i class="fas fa-location-crosshairs"></i> Open '+o.name;}
}

async function loadActor(){
  try{
    const r=await fetch('/api/auth/verify',{credentials:'include',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success||!d.user)throw new Error('Authentication required');
    state.actor={id:d.user.id,name:d.user.username||d.user.email||'Authenticated user',role:String(d.user.role||'').toUpperCase()};
    if($('currentActor'))$('currentActor').textContent=state.actor.name+' · '+state.actor.role;
    if($('connectionActor'))$('connectionActor').textContent=state.actor.name+' · '+state.actor.role;
    return state.actor;
  }catch(e){
    if($('currentActor'))$('currentActor').textContent='Authentication required';
    if($('connectionActor'))$('connectionActor').textContent='Authentication required';
    return null;
  }
}

function addEvent(title,detail='',source='RECOVERY WORKSPACE'){
  const box=$('timeline');
  if(!box)return;
  const el=document.createElement('div');
  el.className='dr-event';
  const actor=state.actor?state.actor.name+' ('+state.actor.role+')':'Authenticated session';
  el.innerHTML='<span class="dr-dot"></span><div><strong>'+esc(title)+'</strong><small>'+esc(new Date().toLocaleString())+' · '+esc(actor)+' · '+esc(source)+(detail?' · '+esc(detail):'')+'</small></div>';
  box.prepend(el);
}

function selectCase(c){
  state.selected=c;
  state.caseId=c.caseId;
  state.status=c.status||'Pending Review';
  state.platform=(
    c.recoveryPlatform ||
    ({'Android':'android','iPhone / iPad':'iphone','Windows':'windows','Mac':'mac'}[c.deviceType]) ||
    'android'
  ).toLowerCase();

  setPlatform(state.platform);

  document.querySelectorAll('.dr-device-card').forEach(x=>x.classList.toggle('active',x.dataset.caseId===c.caseId));

  ['caseId','caseId2','reportCaseId'].forEach(k=>{if($(k))$(k).textContent=c.caseId||'—';});
  if($('caseStatus'))$('caseStatus').textContent=String(c.status||'').replaceAll('_',' ');
  if($('traceDeviceName'))$('traceDeviceName').textContent=[c.deviceBrand,c.deviceModel].filter(Boolean).join(' ')||'Registered device';
  if($('tracePlatformState'))$('tracePlatformState').textContent=c.status||'Not reported';
  if($('connectionStatus'))$('connectionStatus').textContent=c.status||'Case status';
  if($('connectionDetail'))$('connectionDetail').textContent=(c.assignedAdmin?.name?('Handled by '+c.assignedAdmin.name+'. '):'Unassigned. ')+serviceFor(state.platform).name+' remains the official device service.';
  if($('connectionIcon'))$('connectionIcon').innerHTML='<i class="fas fa-database"></i>';

  if($('identityModel'))$('identityModel').textContent=c.deviceModel||'—';
  if($('identityPlatform'))$('identityPlatform').textContent=c.deviceType||'—';
  if($('identitySerial'))$('identitySerial').textContent=mask(c.serial);
  if($('registeredOwner'))$('registeredOwner').textContent=c.ownershipVerifiedAt?'Verified · '+(c.ownershipVerifiedBy?.name||'Authorized reviewer'):'Verification pending';
  if($('officialService'))$('officialService').textContent=serviceFor(state.platform).name;

  const loc=c.latestLocation;
  if(loc){
    if($('locationTitle'))$('locationTitle').textContent='Verified location recorded';
    if($('locationSource'))$('locationSource').textContent=loc.source||'Authorized source';
    if($('locationFreshness'))$('locationFreshness').textContent=formatDate(loc.reported_at);
    if($('locationState'))$('locationState').textContent='Verified';
    if($('locationHelp'))$('locationHelp').textContent='This location was recorded from an authorized source. It is not inferred from IMEI, phone number, IP or MAC address.';
    const metrics=document.querySelectorAll('.dr-metric strong');
    if(metrics[0])metrics[0].textContent=Number(loc.latitude).toFixed(6)+', '+Number(loc.longitude).toFixed(6);
    if(metrics[1])metrics[1].textContent=formatDate(loc.reported_at);
    if(metrics[2])metrics[2].textContent=loc.accuracy_meters?('± '+loc.accuracy_meters+' m'):'—';
    if(metrics[3])metrics[3].textContent='Authorized source';
  }else{
    if($('locationTitle'))$('locationTitle').textContent='No verified location available';
    if($('locationSource'))$('locationSource').textContent='Official platform — not reported';
    if($('locationFreshness'))$('locationFreshness').textContent='Unknown';
    if($('locationState'))$('locationState').textContent='Unavailable';
    if($('locationHelp'))$('locationHelp').textContent=serviceFor(state.platform).name+' has not supplied a location to Manlung Recovery for this case. Open the official service to check the claimant’s device.';
    const metrics=document.querySelectorAll('.dr-metric strong');
    if(metrics[0])metrics[0].textContent='Unavailable';
    if(metrics[1])metrics[1].textContent='—';
    if(metrics[2])metrics[2].textContent='—';
    if(metrics[3])metrics[3].textContent='Unknown';
  }

  $('casePanel')?.classList.remove('dr-hidden');
  if($('reportCaseId'))$('reportCaseId').textContent=c.caseId||'—';
  loadRecoveryMap(c.caseId);
}

function initRecoveryMap(){
  if(!window.L||!$('recoveryMap')||recoveryMap)return;
  recoveryMap=L.map('recoveryMap',{zoomControl:true,attributionControl:true}).setView([0,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(recoveryMap);
  recoveryMapLayer=L.layerGroup().addTo(recoveryMap);
}
function showMapState(message,icon='fa-map-location-dot'){
  const box=$('recoveryMapState');if(box)box.innerHTML='<i class="fas '+icon+'"></i><span>'+esc(message)+'</span>';
}
async function loadRecoveryMap(caseId){
  if(!caseId)return;
  initRecoveryMap();
  if(!recoveryMap){showMapState('Map library is unavailable. Verified coordinates remain available in the case record.','fa-triangle-exclamation');return;}
  if(recoveryMapLayer)recoveryMapLayer.clearLayers();
  showMapState('Loading verified picture and platform locations…','fa-spinner fa-spin');
  try{
    const r=await fetch('/api/cases/admin/device-recovery/case/'+encodeURIComponent(caseId)+'/map',{credentials:'include',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success)throw new Error(d.error||'Map data unavailable');
    const points=Array.isArray(d.points)?d.points:[];
    if(!points.length){showMapState('No verified location has been supplied for this case. Pictures without authorized location metadata are not mapped.','fa-location-slash');return;}
    const bounds=[];
    points.forEach((p,index)=>{
      const lat=Number(p.latitude),lng=Number(p.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      bounds.push([lat,lng]);
      const icon=L.divIcon({className:'dr-map-marker '+(p.type==='picture'?'picture':'platform'),html:'<span>'+(p.type==='picture'?'📷':'●')+'</span>',iconSize:[34,34],iconAnchor:[17,17]});
      const marker=L.marker([lat,lng],{icon}).addTo(recoveryMapLayer);
      marker.bindPopup('<strong>'+esc(p.label||'Verified location')+'</strong><br>'+esc(Number(lat).toFixed(6)+', '+Number(lng).toFixed(6))+'<br><small>'+esc(p.source||'Authorized source')+' · '+esc(formatDate(p.timestamp))+(p.accuracyMeters!=null?' · ±'+esc(p.accuracyMeters)+' m':'')+'</small>');
    });
    if(bounds.length>1)L.polyline(bounds,{weight:4,dashArray:'8 8'}).addTo(recoveryMapLayer);
    if(bounds.length)recoveryMap.fitBounds(bounds,{padding:[30,30],maxZoom:17});
    const pictureCount=points.filter(p=>p.type==='picture').length;
    const platformCount=points.filter(p=>p.type==='platform').length;
    showMapState((pictureCount?'📷 '+pictureCount+' picture capture point'+(pictureCount===1?'':'s'):'No picture GPS')+' · '+(platformCount?'📍 '+platformCount+' platform point'+(platformCount===1?'':'s'):'No platform point')+' · trace follows verified timestamps','fa-route');
  }catch(e){showMapState(e.message||'Could not load verified map data.','fa-triangle-exclamation');}
}

function renderDevices(cases){
  const box=$('recoveryDeviceGrid');
  if(!box)return;
  if(!cases.length){
    box.innerHTML='<div class="dr-empty-state"><i class="fas fa-mobile-screen-button"></i><strong>No lost-device cases found</strong><span>Create a real recovery case below. Demo devices have been removed.</span></div>';
    return;
  }
  box.innerHTML=cases.map(c=>{
    const platform=({android:'Android',iphone:'iPhone / iPad',windows:'Windows',mac:'Mac'})[c.recoveryPlatform]||c.deviceType||'Device';
    const status=c.status||'Unknown';
    const admin=c.assignedAdmin?.name||'Unassigned';
    return '<button type="button" class="dr-device-card '+(state.caseId===c.caseId?'active':'')+'" data-case-id="'+escapeAttr(c.caseId)+'">'+
      '<div class="dr-device-avatar"><i class="fas fa-mobile-screen-button"></i></div>'+
      '<span class="dr-device-info"><strong>'+esc([c.deviceBrand,c.deviceModel].filter(Boolean).join(' ')||'Unnamed device')+'</strong>'+
      '<small>'+esc(platform)+' · '+esc(c.caseId)+'</small>'+
      '<em class="dr-device-state neutral"><i class="fas fa-circle"></i> '+esc(status)+'</em>'+
      '<small>Admin: '+esc(admin)+'</small></span>'+
      '<i class="fas fa-chevron-right dr-device-chevron"></i></button>';
  }).join('');
  box.querySelectorAll('.dr-device-card').forEach(card=>{
    card.addEventListener('click',()=>{
      const c=state.cases.find(x=>x.caseId===card.dataset.caseId);
      if(c){selectCase(c);addEvent('Recovery case selected',c.caseId,'LIVE CASE FEED');}
    });
  });
}

function renderAdminReport(payload){
  const cases=payload.cases||[];
  const groups=payload.byAdmin||[];
  const active=cases.filter(c=>!finished.includes(c.status)).length;
  const completed=cases.length-active;
  const assigned=new Set(cases.filter(c=>c.assignedAdmin?.id).map(c=>c.assignedAdmin.id)).size;
  const summary=$('adminReportSummary');
  if(summary)summary.innerHTML=[
    [cases.length,'Total device cases'],
    [active,'Active cases'],
    [completed,'Completed'],
    [assigned,'Assigned admins']
  ].map(x=>'<div><strong>'+esc(x[0])+'</strong><span>'+esc(x[1])+'</span></div>').join('');

  const board=$('adminBoard');
  if(board){
    board.innerHTML=groups.length?groups.map(g=>{
      const name=g.admin?.name||'Unassigned';
      const role=g.admin?.role||'—';
      return '<div class="dr-admin-card"><div class="dr-admin-avatar"><i class="fas fa-user-shield"></i></div><div><strong>'+esc(name)+'</strong><small>'+esc(role.toUpperCase())+'</small></div><div class="dr-admin-count"><strong>'+esc(g.active)+'</strong><span>active</span></div><div class="dr-admin-count"><strong>'+esc(g.completed)+'</strong><span>completed</span></div></div>';
    }).join(''):'<div class="dr-empty-state"><i class="fas fa-users"></i><strong>No assigned admin workload yet</strong><span>New cases will appear here with the authenticated handler name.</span></div>';
  }

  const tbody=$('adminCaseRows');
  if(tbody){
    tbody.innerHTML=cases.length?cases.map(c=>{
      const admin=c.assignedAdmin?.name||'Unassigned';
      const device=[c.deviceBrand,c.deviceModel].filter(Boolean).join(' ')||c.deviceType||'—';
      const action=c.assignedAdmin?.id?'<button class="btn btn-outline dr-case-open" data-case-id="'+escapeAttr(c.caseId)+'">Open</button>':'<button class="btn btn-primary dr-case-claim" data-case-id="'+escapeAttr(c.caseId)+'">Claim</button>';
      return '<tr><td><strong>'+esc(c.caseId)+'</strong><small>'+esc(c.caseType||'Device recovery')+'</small></td><td>'+esc(device)+'</td><td>'+esc(c.clientName||'—')+'</td><td><strong>'+esc(admin)+'</strong><small>'+esc(c.assignedAdmin?.role||'Unassigned')+'</small></td><td><span class="dr-table-status">'+esc(c.status||'—')+'</span></td><td>'+esc(formatDate(c.updatedAt))+'</td><td>'+action+'</td></tr>';
    }).join(''):'<tr><td colspan="7" class="dr-table-empty">No real lost-device cases are currently recorded.</td></tr>';

    tbody.querySelectorAll('.dr-case-open').forEach(b=>b.addEventListener('click',()=>{
      const c=state.cases.find(x=>x.caseId===b.dataset.caseId);if(c)selectCase(c);
    }));
    tbody.querySelectorAll('.dr-case-claim').forEach(b=>b.addEventListener('click',()=>claimCase(b.dataset.caseId)));
  }

  if($('reportUpdatedAt'))$('reportUpdatedAt').textContent='Server data refreshed '+formatDate(payload.serverTime);
}

async function loadRecoveryFeed({silent=false}={}){
  try{
    const r=await fetch('/api/cases/admin/device-recovery/cases?limit=200',{credentials:'include',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success)throw new Error(d.error||'Recovery feed unavailable');
    state.cases=d.cases||[];
    renderDevices(state.cases);
    renderAdminReport(d);
    if($('deviceFeedState'))$('deviceFeedState').textContent='LIVE · '+state.cases.length+' cases';
    if($('reportFeedState'))$('reportFeedState').textContent='LIVE · '+formatDate(d.serverTime);
    if(state.caseId){
      const refreshed=state.cases.find(c=>c.caseId===state.caseId);
      if(refreshed)selectCase(refreshed);
    }else if(state.cases[0]){
      selectCase(state.cases[0]);
    }
  }catch(e){
    if(!silent){
      if($('deviceFeedState'))$('deviceFeedState').textContent='Feed unavailable';
      if($('reportFeedState'))$('reportFeedState').textContent='Offline';
    }
  }
}

async function createRecoveryCase(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const payload={
    platform:state.platform,
    clientName:fd.get('client_name'),
    phone:fd.get('phone'),
    email:fd.get('email'),
    manufacturer:fd.get('manufacturer'),
    model:fd.get('model'),
    deviceName:fd.get('device_name'),
    serial:fd.get('serial'),
    imei:fd.get('imei'),
    notes:fd.get('notes'),
    priority:fd.get('priority')||'Normal'
  };
  try{
    const r=await fetch('/api/cases/admin/device-recovery/cases',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success)throw new Error(d.error||'Could not create case');
    state.caseId=d.case.caseId;
    state.status=d.case.status;
    addEvent('Recovery case created',d.case.caseId,'ADMIN CASE CREATION');
    e.currentTarget.reset();
    setPlatform(payload.platform);
    await loadRecoveryFeed({silent:true});
    alert('Recovery case '+d.case.caseId+' created and assigned to '+(d.assignedAdmin?.name||'the authenticated admin')+'.');
  }catch(err){alert(err.message||'Could not create the recovery case.');}
}

async function verifyOwnership(){
  if(!state.caseId){alert('Select or create a recovery case first.');return;}
  const checks={
    identity:Boolean($('proofIdentity')?.checked),
    purchase:Boolean($('proofPurchase')?.checked),
    device:Boolean($('proofDevice')?.checked),
    authorization:Boolean($('proofAuthorization')?.checked)
  };
  if(!Object.values(checks).every(Boolean)){alert('Complete all four ownership checks before recording verification.');return;}
  try{
    const r=await fetch('/api/cases/admin/device-recovery/case/'+encodeURIComponent(state.caseId)+'/verify-ownership',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({checks})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success)throw new Error(d.error||'Verification failed');
    if($('registeredOwner'))$('registeredOwner').textContent='Verified · '+(d.verifiedBy?.name||'Authorized reviewer');
    if($('verificationResult'))$('verificationResult').textContent='✓ Verified by '+(d.verifiedBy?.name||'authorized reviewer');
    addEvent('Ownership verified',state.caseId,'SERVER AUDIT');
    await loadRecoveryFeed({silent:true});
  }catch(err){alert(err.message||'Could not record ownership verification.');}
}

async function claimCase(caseId){
  try{
    const r=await fetch('/api/cases/admin/case/'+encodeURIComponent(caseId)+'/claim',{method:'POST',credentials:'include',headers:{Accept:'application/json'}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success)throw new Error(d.error||'Could not claim case');
    addEvent('Case claimed',caseId,'SERVER CASE ASSIGNMENT');
    await loadRecoveryFeed({silent:true});
  }catch(err){alert(err.message||'Could not claim case.');}
}

function setupActions(){
  document.querySelectorAll('.dr-platform').forEach(x=>x.addEventListener('click',()=>setPlatform(x.dataset.platform)));
  $('deviceForm')?.addEventListener('submit',createRecoveryCase);
  $('verifyBtn')?.addEventListener('click',verifyOwnership);
  $('refreshRecoveryFeed')?.addEventListener('click',()=>loadRecoveryFeed());
  $('connectOfficialBtn')?.addEventListener('click',()=>addEvent('Official recovery service opened',serviceFor(state.platform).name,'PLATFORM HANDOFF'));
  $('officialLink')?.addEventListener('click',()=>addEvent('Official recovery service opened',serviceFor(state.platform).name,'PLATFORM HANDOFF'));
  $('locationServiceLink')?.addEventListener('click',()=>addEvent('Official location service opened',serviceFor(state.platform).name,'PLATFORM HANDOFF'));
  $('locationUnavailableBtn')?.addEventListener('click',()=>{if($('locationTitle'))$('locationTitle').textContent='No verified location available';addEvent('Location unavailable recorded','No official or authorized coordinates were available','PLATFORM STATUS');});
  $('lostBtn')?.addEventListener('click',async()=>{
    if(!state.caseId)return alert('Select a case first.');
    alert('Recovery-in-progress changes are recorded through the case workflow. Use the existing Case Management controls for status changes.');
  });
  $('recoveredBtn')?.addEventListener('click',async()=>{
    if(!state.caseId)return alert('Select a case first.');
    alert('Use the case completion workflow to mark the device recovered so the assigned admin and audit trail are preserved.');
  });
  $('eraseBtn')?.addEventListener('click',()=>{
    if(confirm('Manlung Recovery will not erase a device itself. Continue to the official service?')){
      addEvent('Official erase guidance opened','No erase command was executed by Manlung Recovery','PLATFORM HANDOFF');
      window.open(serviceFor(state.platform).url,'_blank','noopener,noreferrer');
    }
  });
}

(async()=>{
  setupActions();
  await loadActor();
  await loadRecoveryFeed();
  setInterval(()=>loadRecoveryFeed({silent:true}),10000);
})();
})();