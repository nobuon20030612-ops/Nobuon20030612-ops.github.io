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
  let r=await C.respond('黒田博樹について教えて',{history:[]});
  check('overview starts player profile',r&&r.handled&&String(r.answer||'').indexOf('【人物:黒田博樹】')>=0&&String(r.answer||'').indexOf('【人物:黒田博樹】')<String(r.answer||'').indexOf('【2015年:黒田博樹の広島復帰】'),r&&r.answer);
  check('overview does not start family',!/専用資料ではこう整理されています。\n【アスリート同士・野球一家/.test(r&&r.answer||''),r&&r.answer);

  r=await C.respond('新井貴浩について教えて',{history:[]});
  check('arai overview starts player profile',r&&r.handled&&/専用資料ではこう整理されています。\n【人物:新井貴浩】/.test(r.answer||''),r&&r.answer);
  check('arai overview avoids duplicate manager category',((String(r&&r.answer||'').match(/【2023-2026:新井貴浩監督時代】/g)||[]).length===1),r&&r.answer);

  r=await C.respond('黒田博樹について、どう思う？',{history:[]});
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

  const kurodaHistory=[{role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹について説明します。'}];
  r=await C.respond('家族は？',{history:kurodaHistory});
  check('family followup focused family',r&&r.handled&&/黒田博樹の父母/.test(r.answer||''),r&&r.answer);
  check('family followup excludes unrelated comeback',!/2015年:黒田博樹の広島復帰/.test(r&&r.answer||''),r&&r.answer);

  r=await C.respond('成績は？',{history:kurodaHistory});
  check('kuroda record focused',r&&r.handled&&/日米通算200勝/.test(r.answer||''),r&&r.answer);
  check('kuroda record excludes family',!/黒田博樹の父母/.test(r&&r.answer||''),r&&r.answer);

  r=await C.respond('現役時代は？',{history:kurodaHistory});
  check('career followup handles active era',r&&r.handled&&/1997-2007年/.test(r.answer||''),r&&r.answer);
  check('career followup excludes family',!/黒田博樹の父母/.test(r&&r.answer||''),r&&r.answer);

  const araiHistory=[{role:'user',text:'新井貴浩について教えて'},{role:'assistant',text:'新井貴浩について説明します。'}];
  r=await C.respond('成績は？',{history:araiHistory});
  check('arai record has concrete achievement',r&&r.handled&&/2000安打/.test(r.answer||'')&&/300本塁打/.test(r.answer||''),r&&r.answer);
  check('arai record excludes family block',!/兄弟でプロ野球/.test(r&&r.answer||''),r&&r.answer);

  r=await C.respond('経歴は？',{history:araiHistory});
  check('arai career has player profile',r&&r.handled&&/人物:新井貴浩/.test(r.answer||''),r&&r.answer);
  check('arai career excludes family block',!/兄弟でプロ野球/.test(r&&r.answer||''),r&&r.answer);

  console.log(`LOCAL SPECIALIST CONVERSATION: ${pass}/${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
