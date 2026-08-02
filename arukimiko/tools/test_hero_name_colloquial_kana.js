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
function maedaList(r){return !!(r&&r.handled&&r.data&&r.data.namePattern===true&&r.data.query==='前田'&&r.data.count===5);}
function histPush(h,q,r){h.push({role:'user',content:q});h.push({role:'assistant',content:r.answer,meta:{data:r.data}});}
(async()=>{
  const colloquial=[
    '前田って名前がついてる英傑を全部教えて',
    '前田という名前がついている英傑を全部教えて',
    '前田の名前が入ってる英傑を全部教えて',
    '前田の名が入っている英傑を全部教えて',
    '名前に前田が入ってる英傑を全部教えて',
    '前田が名前につく英傑を全部教えて',
    '前田が付いている英傑を全部教えて',
    '英傑で前田って名前の人を全部教えて',
    '英傑の中で前田という名前を全員教えて',
    '前田って英傑誰がいる？',
    '前田の英傑って誰？',
    '前田みたいな名前の英傑を全部教えて',
    '前田系の英傑を全部教えて',
    '前田一族の英傑を全部教えて'
  ];
  for(const q of colloquial){const r=K.respond(q,{});check('colloquial list: '+q,maedaList(r),r);}

  const kana=[
    'まえだという英傑を全部教えて',
    'まえだって英傑誰がいる',
    'まえだというえいけつをぜんぶおしえて'
  ];
  for(const q of kana){const r=K.respond(q,{});check('kana surname/category: '+q,maedaList(r),r);}

  let n=C.normalizeKanaInput('まえだという英傑を全部教えて');
  check('kana surname normalizes in hero context',n.changed&&n.text==='前田という英傑を全部教えて',n);

  let r=K.respond('前田慶次という名前の英傑を教えて',{});
  check('exact hero natural name stays detail',r.handled&&r.data.hero==='前田慶次'&&!r.data.namePattern,r);
  r=K.respond('前田慶次って名前がついてる英傑を教えて',{});
  check('exact hero colloquial name stays detail',r.handled&&r.data.hero==='前田慶次'&&!r.data.namePattern,r);

  r=K.respond('前田という英傑じゃない',{});
  check('negative correction is not forced into name list',r.handled===false,r);
  r=K.respond('前田じゃない英傑を全部教えて',{});
  check('negative exclusion wording is not forced into name list',r.handled===false,r);
  r=K.respond('腕力みたいな名前の英傑を全部教えて',{});
  check('stat term is not used as a hero name',r.handled&&r.data.ranking===true&&!r.data.namePattern,r);
  r=K.respond('陣法系の英傑を全部教えて',{});
  check('site term is not used as a hero family name',r.handled===false,r);

  global.JINPO_BOT_PAGE_MODE='top';
  r=await B.handle({message:'まえだって英傑誰がいる',history:[]});
  check('full top route handles kana surname',r.mode==='英傑名検索'&&r.data&&r.data.query==='前田'&&r.data.count===5,r);
  global.JINPO_BOT_PAGE_MODE='jinpo';
  r=await B.handle({message:'前田って名前がついてる英傑を全部教えて',history:[]});
  check('full jinpo route handles colloquial surname',r.mode==='英傑名検索'&&r.data&&r.data.query==='前田'&&r.data.count===5,r);

  global.JINPO_BOT_PAGE_MODE='top';
  r=await B.handle({message:'前田智徳って名前の選手を教えて',history:[]});
  check('Carp player colloquial wording remains Carp',r.data&&r.data.carp===true&&/前田智徳/.test(r.answer),r);

  const h=[];
  r=await B.handle({message:'前田って名前がついてる英傑を全部教えて',history:h});
  histPush(h,'前田って名前がついてる英傑を全部教えて',r);
  r=await B.handle({message:'その中で腕力高いのは？',history:h});
  check('colloquial list becomes follow-up scope',r.data&&r.data.contextScope===true&&r.data.scopeCount===5&&/1位：前田慶次\(野望\)/.test(r.answer),r);
  histPush(h,'その中で腕力高いのは？',r);
  r=await B.handle({message:'じゃあ知力順',history:h});
  check('scoped rerank remains within Maeda list',r.data&&r.data.contextScope===true&&r.data.scopeCount===5&&/1位：前田慶次\(野望\).*知力:2315/s.test(r.answer),r);

  console.log(`HERO NAME COLLOQUIAL KANA: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
