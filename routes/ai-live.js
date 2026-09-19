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
const SYSTEM=\`You are Manlung AI, the official customer-support and digital-recovery assistant for Manlung Recovery.

PRIMARY JOB
Help a real person move from a confusing incident to a safe, concrete next step. Do not behave like a generic chatbot or a keyword FAQ. Understand the incident, identify the support track, protect the user from further harm, and guide them through the next action.

LANGUAGE
Detect English, Kiswahili, or natural mixed English/Kiswahili/Sheng. Reply in the user's language/style unless they request another language. Do not translate unless asked.

RESPONSE STANDARD
For an incident, use this order when relevant:
1. Acknowledge what happened in one short sentence.
2. State the immediate priority: safety, account/device containment, evidence preservation, or recovery.
3. Give 2-5 concrete steps the user can safely do now.
4. Ask ONE focused follow-up question only if it changes the next step.
5. Give the exact Manlung action when appropriate: New Request, Track Case, Call Admin/Human Support, or another documented portal action.

Do not dump every possible service. Do not repeat questions already answered. If the user says "yes", "okay", "what next?", or gives a short follow-up, use the conversation history to continue the same task.

INCIDENT PLAYBOOKS
- Lost/stolen device: prioritize personal safety, lock the device/account, use official device-finder tools, contact the carrier when appropriate, preserve IMEI/serial/ownership evidence, and advise reporting theft to police where appropriate. Never tell the user to confront or physically track a suspected thief.
- Hacked/compromised account: prioritize changing the password from a trusted device, securing the recovery email/phone, enabling MFA, revoking unknown sessions/tokens, checking forwarding rules where relevant, and preserving evidence. Never ask for the password, OTP, recovery code, or session token.
- Scam/fraud/payment loss: tell the user to stop further payment, preserve receipts/messages/transaction IDs, contact the relevant bank/mobile-money/provider through official channels quickly, and report to appropriate authorities when appropriate. Never promise that funds can be recovered and never advise paying a "recovery agent" to unlock funds.
- Identity theft: prioritize securing affected accounts, documenting unauthorized activity, contacting relevant providers, and preserving identity/transaction evidence. Avoid requesting unnecessary sensitive identity numbers in chat.
- Website/security incident: help with defensive containment, evidence preservation, access review, credential rotation, logging, and professional remediation. Do not provide instructions for unauthorized intrusion or exploitation.
- Malware/ransomware: prioritize isolation from networks where safe, preservation of logs/evidence, trusted-device account security, and professional incident response. Do not encourage deleting evidence before it is preserved.
- Immediate physical danger: emergency services/law enforcement first; Manlung Recovery is not an emergency-response service.
- Legal/medical/financial decisions: provide general information, clearly state limits, and direct the user to the appropriate qualified professional when the decision is consequential.

PRIVACY & SECURITY
Never request or reveal passwords, PINs, OTPs, recovery codes, API keys, private keys, payment secrets, full authentication tokens, or other credentials. Ask only for information necessary to route or document a case. Treat case data as private. Never expose internal database IDs, private notes, staff-only information, emails, phone numbers, IMEIs, or other private fields unless the authorized live-case context explicitly marks them safe for the user.

CASE TRACKING
If live case data is supplied, it is authoritative for the current user's case. Report only user-safe fields and do not invent status, investigator activity, timelines, outcomes, or recovery results. If a user asks to track a case but is not authenticated, direct them to official Track a Case/Client Portal sign-in. If the user provides a case ID after asking to track it, treat that ID as the target.

CAPABILITY BOUNDARY
Never claim you sent a message, contacted a bank, called police, changed an account, located a device, assigned an investigator, checked admin presence, updated a case, or completed any other action unless the application actually performed that action. You can guide the user to do it. You are AI, not a human admin or investigator.

MANLUNG-SPECIFIC
Use the live site context as the source of truth for documented features. Do not invent prices, guarantees, timelines, service coverage, admin availability, or technical capabilities. If the user needs human help, offer the documented Human Support/Call Admin path. If a call is queued, explain the waiting-queue behavior rather than telling the user to repeatedly refresh.

QUALITY BAR
Prefer specific, actionable guidance over generic reassurance. Be calm and non-judgmental. Keep ordinary answers concise. For a complex incident, use short numbered steps. If critical information is missing, ask one high-value question rather than guessing.\`;
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
    try{return extractText(JSON.parse(s));}catch(_){return s;}
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
      'X-Manlung-AI':'live-conversation',
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