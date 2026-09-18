const express=require('express');
const axios=require('axios');
const crypto=require('crypto');
const jwt=require('jsonwebtoken');
const User=require('../models/User');

const app=express();
const CLIENT_ID=process.env.GITHUB_CLIENT_ID||'';
const CLIENT_SECRET=process.env.GITHUB_CLIENT_SECRET||'';
const APP_URL=(process.env.PUBLIC_APP_URL||'https://manlungrecovery.manlungshop.co.ke').replace(/\/$/,'');
const REDIRECT_URI=process.env.GITHUB_REDIRECT_URI||APP_URL+'/api/auth/github/callback';
const STATE_COOKIE='manlung_github_oauth_state';

function signToken(user){
  return jwt.sign({id:user.id,role:user.role,sessionVersion:Number(user.session_version||0)},process.env.JWT_SECRET,{expiresIn:'7d'});
}
function setStateCookie(res,state){
  res.setHeader('Set-Cookie',STATE_COOKIE+'='+encodeURIComponent(state)+'; Max-Age=600; Path=/api/auth/github; HttpOnly; Secure; SameSite=Lax');
}
function readCookie(req,name){
  const raw=String(req.headers.cookie||'');
  const part=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  return part?decodeURIComponent(part.slice(name.length+1)):'';
}
function clearStateCookie(res){
  res.setHeader('Set-Cookie',STATE_COOKIE+'=; Max-Age=0; Path=/api/auth/github; HttpOnly; Secure; SameSite=Lax');
}
function callbackPage(res,token){
  const safe=JSON.stringify(String(token)).replace(/</g,'\\u003c');
  res.status(200).set('Content-Type','text/html; charset=utf-8').send('<!doctype html><html><head><meta charset="utf-8"><title>Signing in…</title></head><body><p>Signing you in to Manlung Recovery…</p><script>try{localStorage.setItem("clientToken",'+safe+');window.location.replace("/client/dashboard.html")}catch(e){window.location.replace("/login.html?oauth=github-error")}</script></body></html>');
}

app.get('/start',(req,res)=>{
  if(!CLIENT_ID||!CLIENT_SECRET)return res.redirect('/login.html?oauth=github-error');
  const state=crypto.randomBytes(32).toString('hex');
  setStateCookie(res,state);
  const url=new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id',CLIENT_ID);
  url.searchParams.set('redirect_uri',REDIRECT_URI);
  url.searchParams.set('scope','read:user user:email');
  url.searchParams.set('state',state);
  res.redirect(url.toString());
});

app.get('/callback',async(req,res)=>{
  const state=String(req.query.state||'');
  const expected=readCookie(req,STATE_COOKIE);
  clearStateCookie(res);
  if(!state||!expected||!crypto.timingSafeEqual(Buffer.from(state),Buffer.from(expected)))return res.redirect('/login.html?oauth=github-error');
  if(req.query.error)return res.redirect('/login.html?oauth=github-cancelled');
  const code=String(req.query.code||'');
  if(!code)return res.redirect('/login.html?oauth=github-error');
  try{
    const tokenRes=await axios.post('https://github.com/login/oauth/access_token',{client_id:CLIENT_ID,client_secret:CLIENT_SECRET,code,redirect_uri:REDIRECT_URI,state},{headers:{Accept:'application/json'},timeout:10000,validateStatus:()=>true});
    if(tokenRes.status!==200||!tokenRes.data?.access_token)return res.redirect('/login.html?oauth=github-error');
    const accessToken=tokenRes.data.access_token;
    const userRes=await axios.get('https://api.github.com/user',{headers:{Authorization:'Bearer '+accessToken,Accept:'application/vnd.github+json'},timeout:10000});
    let email=String(userRes.data.email||'').trim().toLowerCase();
    if(!email){
      const emails=await axios.get('https://api.github.com/user/emails',{headers:{Authorization:'Bearer '+accessToken,Accept:'application/vnd.github+json'},timeout:10000});
      const verified=(emails.data||[]).find(x=>x.verified&&x.primary)|| (emails.data||[]).find(x=>x.verified);
      email=String(verified?.email||'').trim().toLowerCase();
    }
    if(!email)return res.redirect('/login.html?oauth=github-error');
    let client=await User.findByEmail(email);
    if(client&&client.role!=='client')return res.redirect('/login.html?oauth=github-error');
    if(!client){
      let username=String(userRes.data.login||email.split('@')[0]).replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,70)||'client';
      if(await User.findByUsername(username))username=(username+'-'+String(userRes.data.id)).slice(0,80);
      client=await User.create({username,email,phone:null,password:crypto.randomBytes(32).toString('hex'),role:'client'});
    }
    callbackPage(res,signToken(client));
  }catch(e){
    console.error('GitHub OAuth error:',e.response?.data||e.message);
    res.redirect('/login.html?oauth=github-error');
  }
});
module.exports=app;
