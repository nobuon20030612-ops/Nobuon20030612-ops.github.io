#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
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
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js',
  'jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot.js','jinpo-bot-persona.js'
].forEach(load);
const K=global.JINPO_BOT_HERO_KNOWLEDGE,C=global.JINPO_BOT_CARP,B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
const banned=/(?:カープ専用資料|カープ正本資料|正本ではこう|資料基準日)/;
(async()=>{
  let r=K.respond('苗字が前田の英傑',{});
  check('surname query handled',r.handled&&r.data.namePattern===true,r);
  check('surname query five heroes',r.data.count===5&&r.data.heroes.length===5,r);
  check('surname query exact names',/前田利家\(雄材\).*前田利家\(兎忍\).*前田慶次.*前田慶次\(神将\).*前田慶次\(野望\)/s.test(r.answer),r.answer);
  check('surname query excludes carp player',!/前田智徳/.test(r.answer),r.answer);

  r=K.respond('名字は前田の武将',{});
  check('surname variant handled',r.handled&&r.data.count===5,r);
  r=K.respond('前田姓の英傑',{});
  check('surname postfix handled',r.handled&&r.data.count===5,r);
  r=K.respond('名前に前田が入る英傑',{});
  check('contains-name handled',r.handled&&r.data.count===5,r);
  r=K.respond('前田から始まる英傑',{});
  check('prefix-name handled',r.handled&&r.data.count===5,r);
  r=K.respond('苗字が前田の英傑は何人？',{});
  check('surname count handled',/5人/.test(r.answer),r.answer);
  r=K.respond('苗字が前田の英傑で腕力が高いのは？',{});
  check('surname ranking handled',r.data.ranking===true&&/1位：前田慶次\(野望\).*腕力:3141/.test(r.answer),r.answer);
  check('surname ranking wording natural',!/全英傑の/.test(r.answer),r.answer);

  r=await B.handle({message:'苗字が前田の英傑',history:[]});
  check('full route prioritizes hero',r.data&&r.data.heroKnowledge===true,r);
  check('full route never becomes carp',!(r.data&&r.data.carp)&&!/前田智徳/.test(r.answer),r);

  r=await C.respond('苗字が前田の英傑',{history:[]});
  check('carp guard releases hero question',r&&r.handled===false,r);

  r=await B.handle({message:'前田智徳について教えて',history:[]});
  check('explicit player remains carp',r.data&&r.data.carp===true&&/前田智徳/.test(r.answer),r);
  check('player answer hides internal source wording',!banned.test(r.answer),r.answer);
  r=await B.handle({message:'黒田博樹について教えて',history:[]});
  check('other carp answer hides internal source wording',!banned.test(r.answer),r.answer);
  r=await B.handle({message:'黒田博樹の年齢は？',history:[]});
  check('unknown answer hides internal source wording',!banned.test(r.answer)&&/確認できません/.test(r.answer),r.answer);

  console.log(`HERO NAME PATTERN ROUTING: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
