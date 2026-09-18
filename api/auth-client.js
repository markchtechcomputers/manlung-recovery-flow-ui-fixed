const express=require('express');
const router=require('../routes/auth');
const app=express();

app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true,limit:'10mb'}));

app.use((req,_res,next)=>{
  const raw=String(req.url||'/');
  if(raw.startsWith('/api/auth/client')){
    req.url='/client'+(raw.slice('/api/auth/client'.length)||'/');
  }else if(!raw.startsWith('/client')){
    req.url='/client'+(raw.startsWith('/')?raw:'/'+raw);
  }
  next();
});

app.use('/',router);
module.exports=app;
