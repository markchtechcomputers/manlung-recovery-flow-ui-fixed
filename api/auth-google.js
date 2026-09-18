const express=require('express');
const axios=require('axios');
const jwt=require('jsonwebtoken');
const crypto=require('crypto');
const User=require('../models/User');
const app=express();
app.use(express.json({limit:'64kb'}));
function token(user){return jwt.sign({id:user.id,role:user.role,sessionVersion:Number(user.session_version||0)},process.env.JWT_SECRET,{expiresIn:'7d'});}
app.get('/',(_req,res)=>res.json({success:true,clientId:process.env.GOOGLE_CLIENT_ID||null}));
app.post('/',async(req,res)=>{
 try{
  const credential=String(req.body?.credential||'').trim();
  if(!credential)return res.status(400).json({success:false,error:'Google credential is required.'});
  if(!process.env.GOOGLE_CLIENT_ID)return res.status(503).json({success:false,error:'Google Cloud authentication is not configured yet.'});
  const v=await axios.get('https://oauth2.googleapis.com/tokeninfo',{params:{id_token:credential},timeout:10000,validateStatus:()=>true});
  if(v.status!==200)return res.status(401).json({success:false,error:'Google authentication could not be verified.'});
  const p=v.data;
  if(p.aud!==process.env.GOOGLE_CLIENT_ID||p.iss!=='https://accounts.google.com')return res.status(401).json({success:false,error:'Invalid Google authentication audience.'});
  if(p.email_verified!=='true')return res.status(403).json({success:false,error:'Your Google email is not verified.'});
  const email=String(p.email||'').trim().toLowerCase();if(!email)return res.status(400).json({success:false,error:'Google did not provide an email address.'});
  let user=await User.findByEmail(email);
  if(user&&user.role!=='client')return res.status(409).json({success:false,error:'This email belongs to a staff account. Use staff login.'});
  if(!user)user=await User.create({username:(email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,55)||'client')+'-'+crypto.randomBytes(3).toString('hex'),password:crypto.randomBytes(32).toString('hex'),role:'client',email,phone:null});
  res.json({success:true,token:token(user),user:{id:user.id,email:user.email,username:user.username,role:user.role}});
 }catch(e){console.error('Google Cloud auth error:',e.response?.data||e.message);res.status(502).json({success:false,error:'Google authentication service is temporarily unavailable.'});}
});
module.exports=app;