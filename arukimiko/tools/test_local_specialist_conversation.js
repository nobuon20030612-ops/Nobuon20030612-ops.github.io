#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const store={};
global.window=global;
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
load('jinpo-bot-carp-knowledge-data.js');
load('jinpo-bot-carp-knowledge.js');
load('jinpo-bot-carp.js');
const C=global.JINPO_BOT_CARP;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
(async()=>{
  let r=await C.respond('黒田博樹について、どう思う？',{history:[]});
  check('carp person opinion handled',r&&r.handled===true,r);
  check('carp person opinion grounded',r&&r.data&&r.data.groundedOpinion===true,r);
  check('carp person opinion says source basis',/正本で確認できる内容/.test(r.answer||''),r&&r.answer);
  check('carp person opinion concrete headings',/黒田博樹の広島復帰/.test(r.answer||''),r&&r.answer);

  r=await C.respond('黒田博樹の家族について、どう思う？',{history:[]});
  check('family opinion stays knowledge',r&&r.handled&&r.mode==='カープ専用正本知識',r);
  check('family opinion does not invent generic rating',!/存在感の大きい人物/.test(r&&r.answer||''),r&&r.answer);

  r=await C.respond('カープについてどう思う？',{history:[]});
  check('team opinion handled',r&&r.handled===true,r);
  check('team opinion natural',/地域|物語|歴史/.test(r&&r.answer||''),r&&r.answer);

  r=await C.respond('黒田博樹は今どう？',{history:[]});
  check('current person bypasses grounded historical opinion',!(r&&r.data&&r.data.groundedOpinion),r);

  console.log(`LOCAL SPECIALIST CONVERSATION: ${pass}/${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
