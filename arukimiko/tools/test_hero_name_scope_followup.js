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
  'jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js',
  'jinpo-bot-smalltalk.js','jinpo-bot.js','jinpo-bot-persona.js'
].forEach(load);
const K=global.JINPO_BOT_HERO_KNOWLEDGE,B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function maeda(r,mode){return !!(r&&r.handled&&r.data&&r.data.namePattern===true&&r.data.query==='前田'&&r.data.count===5&&(!mode||r.data.matchMode===mode));}
function todo(r){return !!(r&&r.handled&&r.data&&r.data.namePattern===true&&r.data.query==='藤堂'&&r.data.count===2);}
function push(h,q,r){h.push({role:'user',content:q});h.push({role:'assistant',content:r.answer,meta:{data:r.data}});}
async function startMaeda(){const h=[],r=await B.handle({message:'前田の英傑を全部教えて',history:h});push(h,'前田の英傑を全部教えて',r);return {h,r};}
(async()=>{
  const direct=[
    ['前田姓は？','prefix'],
    ['前田って苗字の英傑','prefix'],
    ['前田という名字の英傑','prefix'],
    ['前田という名前を持つ英傑','contains'],
    ['名前が前田から始まる英傑','prefix'],
    ['前田が入った英傑','contains'],
    ['前田を含んだ英傑','contains'],
    ['前田って付く英傑全部','contains'],
    ['前田の名を持つ英傑','contains'],
    ['前田の武将は？','prefix'],
    ['まえだ姓の英傑','prefix'],
    ['まえだせいのえいけつ','prefix'],
    ['前田の英傑いる？','prefix'],
    ['前田って英傑いる？','prefix']
  ];
  for(const [q,mode] of direct){const r=K.respond(q,{});check('direct wording: '+q,maeda(r,mode),r);}

  let r=K.respond('藤堂は何人？',{});
  check('direct omitted category count',todo(r)&&/2人/.test(r.answer),r);
  r=K.respond('豊臣秀長は何人？',{});
  check('exact hero is not surname count',r.handled&&r.data.hero==='豊臣秀長'&&!r.data.namePattern,r);
  r=K.respond('前田慶次という名前を持つ英傑',{});
  check('exact full hero remains detail',r.handled&&r.data.hero==='前田慶次'&&!r.data.namePattern,r);
  r=K.respond('腕力って名前を持つ英傑',{});
  check('stat is not used as name filter',r.handled===false,r);
  r=K.respond('陣法って付く英傑全部',{});
  check('site term is not used as name filter',r.handled===false,r);

  r=await B.handle({message:'前田智徳って苗字の選手を教えて',history:[]});
  check('Carp surname wording is not stolen by hero search',r.data&&r.data.carp===true&&/前田智徳/.test(r.answer)&&!r.data.namePattern,r);

  let s=await startMaeda();
  r=await B.handle({message:'何人いる？',history:s.h});
  check('bare count keeps Maeda scope',r.data&&r.data.namePattern===true&&r.data.query==='前田'&&r.data.count===5,r);

  s=await startMaeda();
  r=await B.handle({message:'全員のコスト',history:s.h});
  check('all costs use Maeda five',r.data&&r.data.multiHeroFields===true&&r.data.heroes.length===5&&/前田慶次\(野望\)：コスト7/.test(r.answer),r);
  push(s.h,'全員のコスト',r);
  r=await B.handle({message:'じゃあ藤堂は？',history:s.h});
  check('name condition can change after related field answer',r.data&&r.data.namePattern===true&&r.data.query==='藤堂'&&r.data.count===2,r);

  s=await startMaeda();
  r=await B.handle({message:'全員の技能',history:s.h});
  check('all skills use Maeda five',r.data&&r.data.multiHeroFields===true&&r.data.heroes.length===5&&/前田利家\(雄材\)：技能/.test(r.answer),r);

  for(const q of ['じゃあ藤堂は？','藤堂に変えて','前田じゃなくて藤堂','前田じゃなくて藤堂の英傑']){
    s=await startMaeda();
    r=await B.handle({message:q,history:s.h});
    check('name condition switch: '+q,r.data&&r.data.namePattern===true&&r.data.query==='藤堂'&&r.data.count===2,r);
  }

  s=await startMaeda();
  r=await B.handle({message:'前田じゃなくて藤堂',history:s.h});
  push(s.h,'前田じゃなくて藤堂',r);
  r=await B.handle({message:'その中で腕力高いのは？',history:s.h});
  check('switched scope ranks only Todo two',r.data&&r.data.contextScope===true&&r.data.scopeCount===2&&/1位：藤堂高虎\(名臣\)/.test(r.answer)&&!/前田/.test(r.answer),r);

  s=await startMaeda();
  r=await B.handle({message:'なるほど',history:s.h});
  push(s.h,'なるほど',r);
  r=await B.handle({message:'何人いる？',history:s.h});
  check('one acknowledgement preserves list context',r.data&&r.data.namePattern===true&&r.data.query==='前田'&&r.data.count===5,r);

  s=await startMaeda();
  r=await B.handle({message:'こんにちは',history:s.h});
  push(s.h,'こんにちは',r);
  r=await B.handle({message:'何人いる？',history:s.h});
  check('unrelated smalltalk does not revive old list',!(r.data&&r.data.namePattern===true&&r.data.query==='前田'),r);

  console.log(`HERO NAME SCOPE FOLLOWUP: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
