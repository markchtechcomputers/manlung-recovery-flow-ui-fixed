const express=require('express');
const {supabase}=require('../config/supabase');
const {auth}=require('../middleware/auth');
const router=express.Router();
const DEVICE_ID_RE=/^[A-Za-z0-9_-]{8,100}$/;
const clean=(v,f,m)=>{const s=String(v??'').trim();return s?s.slice(0,m):f};
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
const integer=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isInteger(n)?n:null};

async function ownedCase(caseId,userId){
  const {data,error}=await supabase.from('recovery_cases').select('case_id,client_user_id,status').eq('case_id',caseId).eq('client_user_id',userId).maybeSingle();
  if(error)throw error;
  return data;
}

function normalize(body){
  const caseId=clean(body.caseId,'',120), deviceId=clean(body.deviceId,'',100);
  const row={
    case_id:caseId,
    device_id:deviceId,
    device_label:clean(body.deviceLabel,'My device',80),
    latitude:num(body.latitude),
    longitude:num(body.longitude),
    accuracy_m:num(body.accuracyM),
    altitude_m:num(body.altitudeM),
    speed_mps:num(body.speedMps),
    heading_deg:num(body.headingDeg),
    battery_percent:integer(body.batteryPercent),
    device_timestamp:body.deviceTimestamp?new Date(body.deviceTimestamp):new Date()
  };
  if(!caseId)throw new Error('Case reference is required.');
  if(!DEVICE_ID_RE.test(deviceId))throw new Error('Invalid device ID.');
  if(row.latitude===null||row.latitude<-90||row.latitude>90)throw new Error('Invalid latitude.');
  if(row.longitude===null||row.longitude<-180||row.longitude>180)throw new Error('Invalid longitude.');
  if(row.accuracy_m!==null&&row.accuracy_m<0)throw new Error('Invalid accuracy.');
  if(row.speed_mps!==null&&row.speed_mps<0)throw new Error('Invalid speed.');
  if(row.heading_deg!==null&&(row.heading_deg<0||row.heading_deg>=360))throw new Error('Invalid heading.');
  if(row.battery_percent!==null&&(row.battery_percent<0||row.battery_percent>100))throw new Error('Invalid battery level.');
  if(Number.isNaN(row.device_timestamp.getTime()))throw new Error('Invalid device timestamp.');
  if(Math.abs(Date.now()-row.device_timestamp.getTime())>86400000)throw new Error('Device timestamp is outside the allowed time window.');
  row.device_timestamp=row.device_timestamp.toISOString();
  return row;
}

router.post('/update',auth,async(req,res)=>{
  try{
    const location=normalize(req.body||{});
    if(!await ownedCase(location.case_id,req.user.id))return res.status(404).json({success:false,error:'Case not found for this account.'});
    const {data,error}=await supabase.from('recovery_location_points').insert({...location,client_user_id:req.user.id})
      .select('id,case_id,device_id,device_label,latitude,longitude,accuracy_m,altitude_m,speed_mps,heading_deg,battery_percent,device_timestamp,received_at').single();
    if(error)throw error;
    return res.status(201).json({success:true,location:data});
  }catch(error){
    console.error('Live location update failed:',error);
    return res.status(400).json({success:false,error:error.message||'Unable to save location.'});
  }
});

router.get('/latest',auth,async(req,res)=>{
  try{
    const caseId=clean(req.query.caseId,'',120);
    if(!caseId)return res.status(400).json({success:false,error:'Case reference is required.'});
    if(!await ownedCase(caseId,req.user.id))return res.status(404).json({success:false,error:'Case not found for this account.'});
    const {data,error}=await supabase.from('recovery_location_points')
      .select('id,case_id,device_id,device_label,latitude,longitude,accuracy_m,altitude_m,speed_mps,heading_deg,battery_percent,device_timestamp,received_at')
      .eq('case_id',caseId).eq('client_user_id',req.user.id).order('received_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    return res.json({success:true,location:data||null,serverTime:new Date().toISOString()});
  }catch(error){
    console.error('Live location latest failed:',error);
    return res.status(400).json({success:false,error:error.message||'Unable to load location.'});
  }
});

router.get('/history',auth,async(req,res)=>{
  try{
    const caseId=clean(req.query.caseId,'',120);
    if(!caseId)return res.status(400).json({success:false,error:'Case reference is required.'});
    if(!await ownedCase(caseId,req.user.id))return res.status(404).json({success:false,error:'Case not found for this account.'});
    const requested=Number(req.query.limit||500),limit=Math.max(1,Math.min(Number.isFinite(requested)?Math.floor(requested):500,2000));
    const {data,error}=await supabase.from('recovery_location_points')
      .select('id,case_id,device_id,device_label,latitude,longitude,accuracy_m,altitude_m,speed_mps,heading_deg,battery_percent,device_timestamp,received_at')
      .eq('case_id',caseId).eq('client_user_id',req.user.id).order('received_at',{ascending:false}).limit(limit);
    if(error)throw error;
    return res.json({success:true,locations:(data||[]).reverse(),count:data?.length||0});
  }catch(error){
    console.error('Live location history failed:',error);
    return res.status(400).json({success:false,error:error.message||'Unable to load location history.'});
  }
});
module.exports=router;