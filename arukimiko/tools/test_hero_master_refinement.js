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
  'jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js',
  'jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js','jinpo-bot-persona.js'
].forEach(load);
const K=global.JINPO_BOT_HERO_KNOWLEDGE,B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function meta(r){return {mode:r.mode||'',data:{heroKnowledge:!!(r.data&&r.data.heroKnowledge),hero:String(r.data&&r.data.hero||''),heroes:Array.isArray(r.data&&r.data.heroes)?r.data.heroes.slice():[],candidates:Array.isArray(r.data&&r.data.candidates)?r.data.candidates.slice():[],needsClarification:!!(r.data&&r.data.needsClarification),stats:Array.isArray(r.data&&r.data.stats)?r.data.stats.slice():[]}};}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:meta(r)});return r;}};}
(async()=>{
  let s=session(),r=await s.ask('腕力トップ10');
  check('base ranking',r.data.heroes.length===10,r);
  r=await s.ask('侍だけ');
  check('implicit job subset',r.data.contextScope===true&&r.data.heroes.join('|')==='真田幸村(神魔)|林崎甚助|伊達政宗(起源)',r);
  r=await s.ask('じゃあ知力順');
  check('implicit rerank active subset',r.data.heroes.join('|')==='真田幸村(神魔)|伊達政宗(起源)|林崎甚助',r);
  r=await s.ask('コスト7を除いて');
  check('implicit negative cost subset',r.data.heroes.join('|')==='伊達政宗(起源)'&&r.data.count===1,r);
  r=await s.ask('技能がある人だけ');
  check('implicit skill presence subset',r.data.heroes.join('|')==='伊達政宗(起源)'&&r.data.count===1,r);

  s=session();await s.ask('腕力トップ10');await s.ask('侍だけ');
  r=await s.ask('この中で知力が一番高いのは？');
  check('explicit this set keeps original parent scope',r.data.heroes[0]==='百地三太夫(野望)'&&r.data.candidates.length===10,r);

  r=K.respond('侍以外で腕力トップ3',{});
  check('exclude job',r.data.heroes.join('|')==='母里太兵衛|百地三太夫(野望)|遠足娘まり'&&r.data.filters.excludedJobs[0]==='侍',r);
  r=K.respond('コスト7じゃない英傑で知力トップ3',{});
  check('exclude cost',r.data.heroes.join('|')==='豊臣秀吉|尼子晴久|朝倉義景(八雷)'&&r.data.filters.excludedCosts[0]===7,r);
  r=K.respond('僧兵を持たない英傑で腕力トップ3',{});
  check('exclude factor without job collision',r.data.heroes[0]==='百地三太夫(野望)'&&r.data.filters.excludedFactors[0]==='僧兵'&&!r.data.filters.job,r);
  r=K.respond('技能が登録されている英傑は何人？',{});
  check('skill presence count',r.data.value===162&&r.data.filters.skillPresence===true,r);
  r=K.respond('技能なしの英傑は何人？',{});
  check('skill absence count',r.data.value===221&&r.data.filters.skillPresence===false,r);
  r=K.respond('技能がある侍は何人？',{});
  check('skill presence with job',r.data.value===40&&r.data.filters.job==='侍',r);
  r=K.respond('技能なしの侍は何人？',{});
  check('skill absence with job',r.data.value===74&&r.data.filters.job==='侍',r);

  r=K.respond('腕力トップ20と耐久力トップ20の両方に入る英傑は？',{});
  check('rank set intersection',r.data.rankSet===true&&r.data.operation==='intersection'&&r.data.heroes.join('|')==='母里太兵衛|明智光秀(闇)',r);
  r=K.respond('腕力トップ10か知力トップ10のどちらかに入る英傑は何人？',{});
  check('rank set union',r.data.rankSet===true&&r.data.operation==='union'&&r.data.count===20,r);
  r=K.respond('腕力トップ10にはいるけど知力トップ10には入らない英傑は何人？',{});
  check('rank set difference',r.data.rankSet===true&&r.data.operation==='difference'&&r.data.count===10,r);
  r=K.respond('腕力と知力が両方上位10%の英傑は？',{});
  check('percentile not stolen by rank set',r.data.multiPercentile===true&&r.data.rankSet!==true&&r.data.count===1,r);
  r=K.respond('腕力と知力合計トップ3',{});
  check('sum ranking not stolen by rank set',r.data.ranking===true&&r.data.rankSet!==true&&r.data.heroes[0]==='片倉景綱(右腕)',r);

  r=K.respond('侍だけ',{});
  check('bare job fragment without context not stolen',r.handled===false,r);
  console.log(`HERO MASTER REFINEMENT: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
