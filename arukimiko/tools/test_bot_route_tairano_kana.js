#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{}};
global.addEventListener=()=>{};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-conversation.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT,C=global.JINPO_BOT_CONVERSATION;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
(async()=>{
  let h=[];
  async function say(q){const out=await B.handle({message:q,history:h});h.push({role:'user',text:q},{role:'assistant',text:out.answer,meta:{mode:out.mode}});return out;}

  let r=await say('アサヒナヤストモハ？');
  check('route dynamic person katakana',r&&r.mode==='たいらの野望専用知識'&&/朝比奈泰朝/.test(r.answer||''),r);
  r=await say('その人は？');
  check('route dynamic person followup',r&&/朝比奈泰朝/.test(r.answer||'')&&!/「その人」/.test(r.answer||''),r&&r.answer);

  r=await say('ウゴメクジャレイノカウンタア');
  check('route dynamic enemy katakana',r&&/蠢く邪霊/.test(r.answer||''),r);
  r=await say('その人は？');
  check('route dynamic enemy followup',r&&/蠢く邪霊/.test(r.answer||''),r&&r.answer);

  r=await say('トコヨノせんぺいは？');
  check('route mixed kana enemy',r&&/常世の尖兵/.test(r.answer||''),r);
  const active=C.activeRecentSubject(h,{personOnly:true});
  check('conversation stores canonical counter entity',active&&active.value==='常世の尖兵',active);

  r=await say('アサヒナやすとものカウンター');
  check('route mixed kana person',r&&/朝比奈泰朝/.test(r.answer||''),r);
  r=await say('前の話に戻って');
  check('route previous dynamic counter branch',r&&/常世の尖兵/.test(r.answer||''),r&&r.answer);

  r=await say('キヨウランコンコウノカウンタア');
  check('route small and dakuten omitted entity',r&&/狂乱金剛/.test(r.answer||''),r&&r.answer);
  r=await say('その敵は？');
  check('route fuzzy entity followup',r&&/狂乱金剛/.test(r.answer||''),r&&r.answer);

  r=await say('ﾄｺﾖﾉｾﾝﾍｲﾊ？');
  check('route halfwidth and dakuten omitted entity',r&&/常世の尖兵/.test(r.answer||''),r&&r.answer);


  r=await say('あさひなやすものかうんたあ');
  check('route one kana omitted entity',r&&/朝比奈泰朝/.test(r.answer||''),r&&r.answer);
  r=await say('その人は？');
  check('route omitted entity followup',r&&/朝比奈泰朝/.test(r.answer||''),r&&r.answer);

  console.log(`BOT ROUTE TAIRANO KANA: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
