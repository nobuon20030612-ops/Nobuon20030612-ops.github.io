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
const K=global.JINPO_BOT_HERO_KNOWLEDGE,B=global.JINPO_BOT,C=global.JINPO_BOT_CONVERSATION;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function isMaedaList(r){return !!(r&&r.handled&&r.data&&r.data.namePattern===true&&r.data.count===5&&Array.isArray(r.data.heroes)&&r.data.heroes.join('|')==='前田利家(雄材)|前田利家(兎忍)|前田慶次|前田慶次(神将)|前田慶次(野望)');}
(async()=>{
  const variants=[
    '前田と言う英傑をすべて欲しえて',
    '前田という英傑をすべて教えて',
    '前田という英傑全部教えて',
    '前田っていう英傑を全部見せて',
    '前田の英傑を全員教えて',
    '前田のつく英傑一覧',
    '前田と名の付く武将を挙げて',
    '前田というキャラを全部出して'
  ];
  for(const q of variants){const r=K.respond(q,{});check('natural list: '+q,isMaedaList(r),r);}

  let r=K.respond('前田という英傑は何人？',{});
  check('natural count',r.handled&&r.data.namePattern===true&&r.data.count===5&&/5人/.test(r.answer),r);

  r=K.respond('前田という英傑で腕力が高いのは？',{});
  check('natural scoped ranking',r.handled&&r.data.ranking===true&&/^「前田」で始まる英傑の中では/.test(r.answer)&&/1位：前田慶次\(野望\).*腕力:3141/s.test(r.answer),r);

  r=K.respond('前田という英傑の知力を全部教えて',{});
  check('natural scoped stat list',r.handled&&r.data.namePatternStats===true&&r.data.stats[0]==='知力'&&/前田利家\(雄材\)：知力 1987/.test(r.answer),r);

  r=K.respond('前田慶次という英傑を教えて',{});
  check('exact hero remains a person detail',r.handled&&r.data.hero==='前田慶次'&&!r.data.namePattern&&/婆娑羅繚乱撃斬/.test(r.answer),r);

  r=K.respond('腕力の英傑を全部教えて',{});
  check('stat wording is not mistaken for name prefix',r.handled&&r.data.ranking===true&&!r.data.namePattern&&/1位：母里太兵衛/.test(r.answer),r);

  r=K.respond('陣法という英傑を全部教えて',{});
  check('site term is rejected as a hero name pattern',r.handled===false,r);

  r=K.respond('前田という英傑じゃない',{});
  check('negative wording is not forced into a list',r.handled===false,r);

  r=K.respond('藤堂という英傑を全部教えて',{});
  check('parser is generic, not hardcoded to Maeda',r.handled&&r.data.namePattern===true&&r.data.count===2&&/藤堂高虎\(名臣\).*藤堂高虎/s.test(r.answer),r);

  const resolved=C.resolve('前田と言う英傑をすべて欲しえて',[]);
  check('request typo normalizes to 教えて',resolved.inputNormalized===true&&/すべて教えて/.test(resolved.normalizedInput),resolved);

  global.JINPO_BOT_PAGE_MODE='top';
  r=await B.handle({message:'前田と言う英傑をすべて欲しえて',history:[]});
  check('full top route answers screenshot wording',r.mode==='英傑名検索'&&r.data&&r.data.namePattern===true&&r.data.count===5,r);

  global.JINPO_BOT_PAGE_MODE='jinpo';
  r=await B.handle({message:'前田と言う英傑をすべて欲しえて',history:[]});
  check('full jinpo route answers screenshot wording',r.mode==='英傑名検索'&&r.data&&r.data.namePattern===true&&r.data.count===5,r);

  global.JINPO_BOT_PAGE_MODE='top';
  r=await B.handle({message:'前田智徳という選手を教えて',history:[]});
  check('carp player wording remains carp',r.data&&r.data.carp===true&&/前田智徳/.test(r.answer),r);

  console.log(`HERO NAME NATURAL WORDING: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
