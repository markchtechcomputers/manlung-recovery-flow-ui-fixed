const express=require('express');
const axios=require('axios');
const router=express.Router();
const { optionalAuth }=require('../middleware/auth');
const {
  buildSiteContext,
  extractCaseId,
  getLiveCaseContext
}=require('./ai');
const RIPLE_URL=process.env.MANLUNG_RIPLE_AI_URL||'https://ai.riple.org/';
const SYSTEM=`You are Manlung AI, the fast and natural customer-support assistant for Manlung Recovery.
Speak naturally and conversationally. Detect whether the user is speaking English, Kiswahili, or a natural mix of both (Sheng/mixed English-Kiswahili) and answer in the same language style. Do not translate the user's message unless asked.
Answer questions about the Manlung Recovery portal accurately. Never invent case status, admin presence, prices, guarantees or capabilities.
Never request passwords, PINs, OTPs, recovery codes, API keys or payment secrets.
For private case details, tell the user to sign in and use official case tracking.
For physical emergencies, advise appropriate emergency services first.
Keep answers practical, warm and reasonably concise. You are an AI, never claim to be human.`;

function cleanHistory(value){
  return Array.isArray(value)
    ? value.filter(x=>x&&(x.role==='user'||x.role==='assistant')&&typeof x.content==='string').slice(-12)
    : [];
}
function extractText(value){
  if(value==null)return '';
  if(typeof value==='string'){
    const s=value.trim();
    if(!s||s==='[DONE]')return '';
    try{return extractText(JSON.parse(s));}catch(_){return '';}
  }
  return value?.choices?.[0]?.delta?.content
    ||value?.choices?.[0]?.message?.content
    ||value?.delta?.content
    ||value?.content
    ||value?.text
    ||value?.response
    ||'';
}
function emit(res,text){
  const value=String(text||'');
  if(value)res.write('data: '+JSON.stringify({content:value})+'\n\n');
}
router.post('/chat',optionalAuth,async(req,res)=>{
  const message=String(req.body?.message||'').trim().slice(0,8000);
  if(!message)return res.status(400).json({success:false,error:'Message is required.'});
  const history=cleanHistory(req.body?.history);
  const language=req.body?.language==='sw'?'Kiswahili':req.body?.language==='en'?'English':'auto';
  const instruction=language==='auto'
    ?'Detect the user language and reply in that same language or natural mixed style.'
    :`Reply in ${language} unless the user clearly asks for another language.`;
  const pagePath=String(req.body?.pagePath||'/').slice(0,300);
  const siteContext=buildSiteContext(pagePath);
  const caseId=extractCaseId(message,history);
  const liveCase=await getLiveCaseContext(caseId,req.user);

  const caseInstruction=caseId
    ? `LIVE CASE DATA — authoritative runtime information for this request. Use only what the authorization layer provides. Never expose internal database IDs, emails, phone numbers, IMEIs, credentials, or private fields. If the user is unauthorized or unauthenticated, do not reveal case existence or details.\n${liveCase.context||'No case data is available.'}`
    : 'No case was requested. Do not invent private case information.';

  const messages=[
    {role:'system',content:SYSTEM+'\n'+instruction},
    {role:'system',content:'LIVE MANLUNG SITE CONTEXT — use this as the source of truth for current Manlung pages, services and features.\n\n'+siteContext},
    {role:'system',content:caseInstruction},
    ...history,
    {role:'user',content:message}
  ];

  try{
    const upstream=await axios.post(
      RIPLE_URL,
      {messages},
      {headers:{accept:'text/event-stream, application/json, text/plain','content-type':'application/json','user-agent':'Manlung-Recovery-AI/1.0'},responseType:'stream',timeout:30000,validateStatus:()=>true}
    );
    if(upstream.status<200||upstream.status>=300)throw new Error('Riple AI HTTP '+upstream.status);

    res.status(200).set({
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform',
      'Connection':'keep-alive',
      'X-Accel-Buffering':'no'
    });
    if(res.flushHeaders)res.flushHeaders();

    let buffer='',sent=false;
    const process=chunk=>{
      buffer+=Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk||'');
      const events=buffer.split(/\r?\n\r?\n/);
      buffer=events.pop()||'';
      for(const event of events){
        const data=event.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('');
        if(!data||data==='[DONE]')continue;
        const text=extractText(data);
        if(text){emit(res,text);sent=true;}
      }
    };
    upstream.data.on('data',process);
    upstream.data.on('end',()=>{
      if(buffer.trim()){
        const data=buffer.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('');
        const text=extractText(data);
        if(text){emit(res,text);sent=true;}
      }
      if(!sent)emit(res,'I’m sorry, I could not generate a response right now. Please try again.');
      res.write('data: [DONE]\n\n');
      res.end();
    });
    upstream.data.on('error',()=>res.end());
    req.on('close',()=>{try{upstream.data.destroy();}catch(_){}});
  }catch(e){
    console.error('Manlung Riple AI error:',e.response?.status||e.message);
    if(!res.headersSent)res.status(502).json({success:false,error:'Live AI service is temporarily unavailable.'});
    else res.end();
  }
});
module.exports=router;