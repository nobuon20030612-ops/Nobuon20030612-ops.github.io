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
const K=global.JINPO_BOT_HERO_KNOWLEDGE,B=global.JINPO_BOT,D=global.JINPO_BOT_HERO_DATA;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function baseName(name){return String(name||'').normalize('NFKC').replace(/\([^()]*\)$/,'').trim();}
(async()=>{
  const ni=D.columns.indexOf('英傑名'),families=new Map();
  for(const row of D.rows){const name=row[ni],base=baseName(name);if(!families.has(base))families.set(base,[]);families.get(base).push(name);}
  const groups=[...families.entries()].filter(([,names])=>names.length>=2);
  check('master has duplicate base-name groups',groups.length===64,{count:groups.length});

  for(const [base,names] of groups){
    let r=K.respond(`${base}という英傑をすべて教えて`,{});
    check(`family list: ${base}`,r.handled&&r.data&&r.data.namePattern===true&&r.data.nameFamily===true&&r.data.matchMode==='family'&&r.data.query===base&&r.data.count===names.length&&Array.isArray(r.data.heroes)&&r.data.heroes.join('|')===names.join('|'),r);

    r=K.respond(`${base}は何人？`,{});
    check(`family count: ${base}`,r.handled&&r.data&&r.data.nameFamily===true&&r.data.matchMode==='family'&&r.data.count===names.length&&new RegExp(`${names.length}人`).test(r.answer),r);
  }

  let r=K.respond('真田幸村という英傑で腕力が高いのは？',{});
  check('family scoped ranking',r.handled&&r.data&&r.data.ranking===true&&Array.isArray(r.data.heroes)&&r.data.heroes.length===4&&/^「真田幸村」の同名英傑の中では/.test(r.answer),r);

  r=K.respond('真田幸村という英傑を教えて',{});
  check('singular exact base remains person detail',r.handled&&r.data&&r.data.hero==='真田幸村'&&!r.data.nameFamily&&!r.data.namePattern,r);

  r=K.respond('真田幸村(新星)について教えて',{});
  check('explicit variant remains exact detail',r.handled&&r.data&&r.data.hero==='真田幸村(新星)'&&!r.data.nameFamily,r);

  r=K.respond('豊臣秀長という英傑をすべて教えて',{});
  check('single-name hero does not become a false family',r.handled&&r.data&&r.data.hero==='豊臣秀長'&&!r.data.nameFamily,r);

  r=K.respond('お市という英傑を全部教えて',{});
  check('family works even without an unsuffixed row',r.handled&&r.data&&r.data.nameFamily===true&&r.data.matchMode==='family'&&r.data.count===2&&r.data.heroes.join('|')==='お市(婚礼)|お市(八雷)',r);

  const first=await B.handle({message:'真田幸村という英傑をすべて教えて',history:[]});
  check('full top route returns family',first.mode==='英傑名検索'&&first.data&&first.data.nameFamily===true&&first.data.count===4,first);
  const history=[{role:'user',text:'真田幸村という英傑をすべて教えて'},{role:'assistant',text:first.answer,meta:{data:first.data}}];
  const second=await B.handle({message:'じゃあ明智光秀は？',history});
  check('family context switches to another same-name group',second.mode==='英傑名検索'&&second.data&&second.data.nameFamily===true&&second.data.query==='明智光秀'&&second.data.count===4,second);

  global.JINPO_BOT_PAGE_MODE='jinpo';
  r=await B.handle({message:'織田信長という英傑を全部教えて',history:[]});
  check('full jinpo route returns family',r.mode==='英傑名検索'&&r.data&&r.data.nameFamily===true&&r.data.count===3,r);

  console.log(`HERO SAME NAME GROUPS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
