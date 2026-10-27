const express=require('express');
const crypto=require('crypto');
const axios=require('axios');
const {body,validationResult}=require('express-validator');
const {supabase}=require('../config/supabase');
const router=express.Router();
const TABLE='recovery_service_payments', REVIEWS='recovery_service_reviews';
const PACKAGES={200:'Basic Support',500:'Standard Support',1000:'Premium Support'};
const API='https://api.paystack.co';
function invalid(req,res){const e=validationResult(req);if(e.isEmpty())return false;res.status(400).json({success:false,error:e.array()[0].msg});return true;}
function origin(req){return String(process.env.PUBLIC_APP_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');}
router.post('/initialize',[body('email').isEmail().normalizeEmail(),body('amountKes').isInt({min:200,max:1000})],async(req,res)=>{
 if(invalid(req,res))return;
 try{
  if(!process.env.PAYSTACK_SECRET_KEY||!process.env.PAYSTACK_PUBLIC_KEY)return res.status(503).json({success:false,error:'Payments are not configured.'});
  const amount=Number(req.body.amountKes),name=PACKAGES[amount];if(!name)return res.status(400).json({success:false,error:'Choose KES 200, KES 500, or KES 1,000.'});
  const email=String(req.body.email).trim().toLowerCase(),reference=`MR-ACCOUNT-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const {error}=await supabase.from(TABLE).insert({reference,email,customer_name:null,package_name:name,currency:'KES',amount_kes:amount,status:'pending'});
  if(error)throw error;
  const init=await axios.post(`${API}/transaction/initialize`,{email,amount:amount*100,currency:'KES',reference,callback_url:`${origin(req)}/account-recovery.html`,metadata:{service:'hacked-social-media-pages-and-emails',package_name:name,amount_kes:amount}},{headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},timeout:15000});
  if(!init.data?.status||!init.data?.data?.authorization_url)throw new Error('Paystack checkout URL missing');
  res.json({success:true,reference,authorizationUrl:init.data.data.authorization_url,amountKes:amount,packageName:name});
 }catch(e){console.error('Account recovery initialize:',e.response?.data||e.message);res.status(500).json({success:false,error:'Could not start checkout. Please try again.'});}
});
router.post('/verify',[body('reference').trim().isLength({min:8,max:120})],async(req,res)=>{
 if(invalid(req,res))return;
 try{
  if(!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({success:false,error:'Verification is not configured.'});
  const reference=String(req.body.reference).trim();
  const {data:p,error}=await supabase.from(TABLE).select('reference,email,package_name,amount_kes,currency,status').eq('reference',reference).maybeSingle();
  if(error)throw error;if(!p)return res.status(404).json({success:false,error:'Payment reference not found.'});
  if(p.status==='confirmed')return res.json({success:true,paid:true,reference,amountKes:p.amount_kes,packageName:p.package_name,reviewAllowed:true});
  const v=await axios.get(`${API}/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`},timeout:15000});
  const tx=v.data?.data;
  if(Number(tx?.amount)!==Number(p.amount_kes)*100||String(tx?.currency||'').toUpperCase()!=='KES'||tx?.reference!==reference||String(tx?.customer?.email||'').toLowerCase()!==p.email)return res.status(400).json({success:false,paid:false,error:'Payment details do not match this order.'});
  if(tx.status!=='success')return res.status(202).json({success:false,paid:false,pending:['pending','ongoing','processing'].includes(String(tx.status||'').toLowerCase()),message:'Payment is not confirmed yet. Wait a moment and retry.'});
  const {data:updated,error:upErr}=await supabase.from(TABLE).update({status:'confirmed',paystack_transaction_id:String(tx.id),paid_at:tx.paid_at||tx.transaction_date||new Date().toISOString()}).eq('reference',reference).eq('status','pending').select('reference,amount_kes,package_name,status').maybeSingle();
  if(upErr)throw upErr;
  if(!updated){const {data:latest,error:le}=await supabase.from(TABLE).select('reference,amount_kes,package_name,status').eq('reference',reference).maybeSingle();if(le)throw le;if(latest?.status!=='confirmed')return res.status(409).json({success:false,paid:false,error:'Payment could not be confirmed yet.'});return res.json({success:true,paid:true,reference,amountKes:latest.amount_kes,packageName:latest.package_name,reviewAllowed:true});}
  res.json({success:true,paid:true,reference,amountKes:updated.amount_kes,packageName:updated.package_name,reviewAllowed:true});
 }catch(e){console.error('Account recovery verify:',e.response?.data||e.message);res.status(500).json({success:false,error:'Could not verify payment right now.'});}
});
router.post('/reviews',[body('reference').trim().isLength({min:8,max:120}),body('displayName').trim().isLength({min:2,max:60}),body('rating').isInt({min:1,max:5}),body('review').trim().isLength({min:10,max:1000})],async(req,res)=>{
 if(invalid(req,res))return;
 try{
  const reference=String(req.body.reference).trim();
  const {data:p,error:pe}=await supabase.from(TABLE).select('status').eq('reference',reference).maybeSingle();if(pe)throw pe;
  if(!p||p.status!=='confirmed')return res.status(403).json({success:false,error:'A verified payment is required before reviewing.'});
  const {error}=await supabase.from(REVIEWS).insert({payment_reference:reference,customer_name:String(req.body.displayName).trim(),rating:Number(req.body.rating),review:String(req.body.review).trim(),is_public:true});
  if(error?.code==='23505')return res.status(409).json({success:false,error:'A review was already submitted for this payment.'});if(error)throw error;
  res.status(201).json({success:true,message:'Thank you for your review.'});
 }catch(e){console.error('Account recovery review:',e.message);res.status(500).json({success:false,error:'Could not submit review.'});}
});
router.get('/reviews',async(_req,res)=>{
 try{const {data,error}=await supabase.from(REVIEWS).select('id,customer_name,rating,review,created_at').eq('is_public',true).order('created_at',{ascending:false}).limit(12);if(error)throw error;res.set('Cache-Control','public, max-age=30, stale-while-revalidate=60');res.json({success:true,reviews:data||[]});}
 catch(e){console.error('Account recovery reviews:',e.message);res.status(500).json({success:false,error:'Reviews are temporarily unavailable.'});}
});
module.exports=router;