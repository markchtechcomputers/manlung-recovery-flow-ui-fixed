const express=require('express');
const axios=require('axios');
const router=express.Router();
const RIPLE_URL=process.env.MANLUNG_RIPLE_AI_URL||'https://ai.riple.org/';
const SYSTEM=`You are Manlung AI, the fast and natural customer-support assistant for Manlung Recovery.
Speak conversationally like a helpful AI assistant. Support English and Kiswahili.
Answer questions about the Manlung Recovery portal accurately. Never invent case status, admin presence, prices, guarantees or capabilities.
Never request passwords, PINs, OTPs, recovery codes, API keys or payment secrets.
For private case details, tell the user to sign in and use official case tracking.
For physical emergencies, advise appropriate emergency services first.
Keep answers practical and reasonably concise. You are an AI, never claim to be human.`;
router.post('/chat',async(req,res)=>{
 const message=String(req.body?.message||'').trim().slice(0,8000);
 if(!message)return res.status(400).json({success:false,error:'Message is required.'});
 const history=Array.isArray(req.body?.history)?req.body.history.filter(x=>x&&(x.role==='user'||x.role==='assistant')&&typeof x.content==='string').slice(-14):[];
 const language=req.body?.language==='sw'?'Kiswahili':'English';
 const messages=[{role:'system',content:SYSTEM+'\\nRespond in '+language+' unless the user asks for another language.'},...history.slice(-12),{role:'user',content:message}];
 try{
  const upstream=await axios.post(RIPLE_URL,{messages},{headers:{accept:'application/json','content-type':'application/json','user-agent':'Manlung-Recovery-AI/1.0'},responseType:'stream',timeout:30000,validateStatus:()=>true});
  if(upstream.status<200||upstream.status>=300)throw new Error('Riple AI HTTP '+upstream.status);
  res.status(200);res.set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});if(res.flushHeaders)res.flushHeaders();
  upstream.data.on('data',chunk=>res.write(chunk));upstream.data.on('end',()=>res.end());upstream.data.on('error',()=>res.end());req.on('close',()=>{try{upstream.data.destroy()}catch(_){}});
 }catch(e){console.error('Manlung Riple AI error:',e.response?.status||e.message);if(!res.headersSent)res.status(502).json({success:false,error:'Live AI service is temporarily unavailable.'});else res.end();}
});
module.exports=router;