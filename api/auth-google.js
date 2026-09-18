const express=require('express');
const axios=require('axios');
const jwt=require('jsonwebtoken');
const crypto=require('crypto');
const User=require('../models/User');
const app=express();
const GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID||'750848085828-t1uo1rljsmkkmlv3sqiv13tjrb7j1a9f.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET=process.env.GOOGLE_CLIENT_SECRET||'';
app.use(express.json({limit:'64kb'}));
app.use((req,_res,next)=>{
 req.url=String(req.url||'/').replace(/^\/api\/auth\/google(?=\/|\?|$)/,'')||'/';
 next();
});
function token(user){return jwt.sign({id:user.id,role:user.role,sessionVersion:Number(user.session_version||0)},process.env.JWT_SECRET,{expiresIn:'7d'});}
app.get('/',(_req,res)=>res.json({success:true,clientId:GOOGLE_CLIENT_ID}));
app.post('/',async(req,res)=>{
 try{
  const credential=String(req.body?.credential||'').trim();
  const accessToken=String(req.body?.accessToken||'').trim();
  const code=String(req.body?.code||'').trim();
  if(!credential&&!accessToken&&!code)return res.status(400).json({success:false,error:'Google authentication result is required.'});
  if(!GOOGLE_CLIENT_ID)return res.status(503).json({success:false,error:'Google Cloud authentication is not configured yet.'});

  let p;
  if(code){
    if(!GOOGLE_CLIENT_SECRET)return res.status(503).json({success:false,error:'Google OAuth server configuration is incomplete.'});
    const redirectUri=String(req.body?.redirectUri||process.env.GOOGLE_REDIRECT_URI||'').trim();
    if(!redirectUri)return res.status(400).json({success:false,error:'Google OAuth redirect URI is not configured.'});
    const exchange=await axios.post('https://oauth2.googleapis.com/token',new URLSearchParams({code,client_id:GOOGLE_CLIENT_ID,client_secret:GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'}).toString(),{headers:{'content-type':'application/x-www-form-urlencoded'},timeout:10000,validateStatus:()=>true});
    if(exchange.status!==200||!exchange.data?.id_token)return res.status(401).json({success:false,error:'Google authorization code could not be verified.'});
    const v=await axios.get('https://oauth2.googleapis.com/tokeninfo',{params:{id_token:exchange.data.id_token},timeout:10000,validateStatus:()=>true});
    if(v.status!==200)return res.status(401).json({success:false,error:'Google authentication could not be verified.'});
    p=v.data;
  }else if(accessToken){
    const v=await axios.get('https://oauth2.googleapis.com/tokeninfo',{params:{access_token:accessToken},timeout:10000,validateStatus:()=>true});
    if(v.status!==200)return res.status(401).json({success:false,error:'Google access token could not be verified.'});
    if(v.data.aud&&v.data.aud!==GOOGLE_CLIENT_ID)return res.status(401).json({success:false,error:'Invalid Google authentication audience.'});
    const u=await axios.get('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+accessToken},timeout:10000,validateStatus:()=>true});
    if(u.status!==200)return res.status(401).json({success:false,error:'Google account could not be verified.'});
    p={...u.data,email_verified:u.data.email_verified?'true':'false',iss:'https://accounts.google.com',aud:GOOGLE_CLIENT_ID};
  }else{
    const v=await axios.get('https://oauth2.googleapis.com/tokeninfo',{params:{id_token:credential},timeout:10000,validateStatus:()=>true});
    if(v.status!==200)return res.status(401).json({success:false,error:'Google authentication could not be verified.'});
    p=v.data;
  }
  if(p.aud!==GOOGLE_CLIENT_ID||p.iss!=='https://accounts.google.com')return res.status(401).json({success:false,error:'Invalid Google authentication audience.'});
  if(p.email_verified!=='true')return res.status(403).json({success:false,error:'Your Google email is not verified.'});
  const email=String(p.email||'').trim().toLowerCase();if(!email)return res.status(400).json({success:false,error:'Google did not provide an email address.'});
  let user=await User.findByEmail(email);
  if(user&&user.role!=='client')return res.status(409).json({success:false,error:'This email belongs to a staff account. Use staff login.'});
  if(!user)user=await User.create({username:(email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,55)||'client')+'-'+crypto.randomBytes(3).toString('hex'),password:crypto.randomBytes(32).toString('hex'),role:'client',email,phone:null});
  res.json({success:true,token:token(user),user:{id:user.id,email:user.email,username:user.username,role:user.role}});
 }catch(e){console.error('Google Cloud auth error:',e.response?.data||e.message);res.status(502).json({success:false,error:'Google authentication service is temporarily unavailable.'});}
});
module.exports=app;