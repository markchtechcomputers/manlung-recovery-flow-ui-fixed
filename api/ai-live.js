const express=require('express');
const router=require('../routes/ai-live');
const app=express();
app.use(express.json({limit:'1mb'}));
app.use((req,_res,next)=>{req.url=String(req.url||'/').replace(/^\/api\/ai-live(?=\/|\?|$)/,'')||'/';next();});
app.use('/',router);
module.exports=app;