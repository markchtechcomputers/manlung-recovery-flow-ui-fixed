const express=require('express');
const axios=require('axios');
const router=express.Router();
const RIPLE_URL=process.env.MANLUNG_RIPLE_AI_URL||'https://ai.riple.org/';
const SYSTEM=`You are Manlung AI, the fast and natural customer-support assistant for Manlung Recovery.
Speak naturally and conversationally. Detect whether the user is speaking English, Kiswahili, or a natural mix of both (Sheng/mixed English-Kiswahili) and answer in the same language style. Do not translate the user's message unless asked.
Answer questions about the Manlung Recovery portal accurately. Never invent case status, admin presence, prices, guarantees or capabilities.
Never request passwords, PINs, OTPs, recovery codes, API keys or payment secrets.
For private case details, tell the user to sign in and use official case tracking.
For physical emergencies, advise appropriate emergency services first.
Keep answers practical, warm and reasonably concise. You are an AI, never claim to be human.`;

function cleanHistory(value){
 return Array.isArray(value)?value.filter(x=>x&&(x.role==='user'||x.role==='assistant')&&typeof x.content==='string').slice(-12):[];
}
function toText(value){
 if(value==null)return '';
 if(typeof value==='string')return value;
 return value?.choices?.[0]?.delta?.content||value?.choices?.[0]?.message?.content||value?.delta?.content||value?.content||value?.text||value?.response||value?.message||'';
}
function sendSSE(res,text){
 const safe=String(text||'');
 if(safe)res.write('data: '+JSON.stringify({content:safe})+'\\n\\n');
}
router.post('/chat',async(req,res)=>{
 const message=String(req.body?.message||'').trim().slice(0,8000);
 if(!message)return res.status(400).json({success:false,error:'Message is required.'});
 const history=cleanHistory(req.body?.history);
 const language=req.body?.language==='sw'?'Kiswahili':req.body?.language==='en'?'English':'auto';
 const languageInstruction=language==='auto'?'Detect the user language and reply in that same language or mixed style.':`Reply in ${language} unless the user clearly asks for another language.`;
 const messages=[{role:'system',content:SYSTEM+'\\n'+languageInstruction},...history,{role:'user',content:message}];
 try{
  const upstream=await axios.post(RIPLE_URL,{messages},{headers:{accept:'text/event-stream, application/json, text/plain','content-type':'application/json','user-agent':'Manlung-Recovery-AI/1.0'},responseType:'stream',timeout:30000,validateStatus:()=>true});
  if(upstream.status<200||upstream.status>=300)throw new Error('Riple AI HTTP '+upstream.status);
  res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});if(res.flushHeaders)res.flushHeaders();
  let pending='',sent=false;
  const processText=chunk=>{
   pending+=String(chunk||'');
   const lines=pending.split(/\\r?\\n/);pending=lines.pop()||'';
   for(const line of lines){
    if(line.startsWith('data:')){const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;let out=toText(raw);if(!out){try{out=toText(JSON.parse(raw))}catch(_){}}if(out){sendSSE(res,out);sent=true;}}
    else if(line.trim()&&!line.startsWith(':')&&!line.startsWith('event:')){let out=toText(line.trim());if(out){sendSSE(res,out);sent=true;}}
   }
  };
  upstream.data.on('data',processText);
  upstream.data.on('end',()=>{if(pending.trim()){let out=toText(pending.trim());if(out){sendSSE(res,out);sent=true;}}if(!sent)sendSSE(res,'I’m sorry, I could not generate a response right now. Please try again.');res.write('data: [DONE]\\n\\n');res.end();});
  upstream.data.on('error',()=>res.end());
  req.on('close',()=>{try{upstream.data.destroy()}catch(_){}}); 
 }catch(e){console.error('Manlung Riple AI error:',e.response?.status||e.message);if(!res.headersSent)res.status(502).json({success:false,error:'Live AI service is temporarily unavailable.'});else res.end();}
});
module.exports=router;