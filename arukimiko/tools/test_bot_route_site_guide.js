#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};
global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js',
  'jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js'
].forEach(load);
load('jinpo-bot.js');
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
(async()=>{
  async function ask(q){return B.handle({message:q,history:[]});}
  let r=await ask('鬼神席のページどこ');
  check('bot typo page route',r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteItem==='kishin'&&r.links&&r.links.length===1,r);
  r=await ask('家臣のステ計算したい');
  check('bot purpose beats generic stat calculator',r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteItem==='retainer',r);
  r=await ask('桶狭間のカウンター見たい');
  check('bot location navigation is not missing counter fact',r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteItem==='okehazama'&&!/未登録|登録されていない/.test(r.answer||''),r);
  r=await ask('魔導結品の入手は？');
  check('bot typo factual domain recognized',r&&r.mode==='たいらの野望ツール実データ'&&/魔導結晶/.test(r.answer||'')&&/番号または名称/.test(r.answer||''),r);
  r=await ask('足利義昭のカウンター見たい');
  check('bot specific counter fact remains authoritative',r&&r.mode==='たいらの野望専用知識'&&/157/.test(r.answer||'')&&r.links&&r.links.length===1,r);
  r=await ask('英傑一欄見たい');
  check('bot typo hero list route',r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteItem==='heroes',r);
  r=await ask('計算したい');
  check('bot ambiguous calculator asks instead of guessing',r&&r.mode==='サイト総合案内'&&r.data&&r.data.needsClarification===true&&/能力計算/.test(r.answer||'')&&/家臣計算機/.test(r.answer||''),r);
  r=await ask('鬼神石の使い方教えて');
  check('bot explicit tool usage uses verified page guide',r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteItem==='kishin'&&/最大8個/.test(r.answer||''),r);
  r=await ask('親戚の話');
  check('bot ordinary word not typo-routed',r&&!(r.data&&r.data.siteGuide)&&r.mode!=='たいらの野望ツール実データ',r);
  check('bot release version updated',B&&B.version==='3.28.0',B&&B.version);
  console.log(`BOT ROUTE SITE GUIDE: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
