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
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function guide(r,id){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide&&r.data.siteItem===id);}
function compactMeta(r){
  const d=r&&r.data||{};
  return {links:r&&r.links||[],mode:r&&r.mode||'',data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),
    siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],
    candidates:Array.isArray(d.candidates)?d.candidates.slice(0,8):[],
    knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm,
    needsClarification:!!d.needsClarification,
    heroKnowledge:!!d.heroKnowledge,hero:String(d.hero||''),heroes:Array.isArray(d.heroes)?d.heroes.slice(0,8):[]
  }};
}
function session(){
  const history=[];
  return {async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};
}
(async()=>{
  const direct=[
    ['陣法','jinpo'],['英傑','heroes'],['能力計算','stats'],['家臣計算','retainer'],['七星転生','shichisei'],
    ['食料','food'],['鬼神石','kishin'],['九十九','tsukumo'],['魔導結晶','mado'],['星海の荒石','seikai'],
    ['鎮魂符','chinkon'],['御蔵番','okuraban'],['カウンター','counter'],['天下統一奇譚','tenka_story'],
    ['桶狭間','okehazama'],['富士地下洞穴','fuji'],['修羅の間','shura'],['ルーレット','roulette'],['トーナメント','tournament']
  ];
  for(const [q,id] of direct){
    const r=await B.handle({message:q,history:[]});
    check('bare term '+q,guide(r,id)&&r.data.knownTermGuidance===true&&r.data.needsClarification===true&&!/解釈をうまく絞り切れなかった/.test(r.answer||''),r);
  }

  let r=await B.handle({message:'とーなめんと',history:[]});
  check('hiragana tournament stays site feature',guide(r,'tournament')&&!/カープ|動画再生/.test(r.answer||''),r);
  r=await B.handle({message:'鎮魂府',history:[]});
  check('known typo term guidance',guide(r,'chinkon'),r);
  r=await B.handle({message:'ルーレット',history:[]});
  check('roulette is not top video',guide(r,'roulette')&&!/動画再生/.test(r.answer||''),r);

  r=await B.handle({message:'九十九1番の能力',history:[]});
  check('specific tsukumo fact bypasses term guidance',r&&r.mode==='たいらの野望ツール実データ'&&/八幡神の武運/.test(r.answer||'')&&!(r.data&&r.data.knownTermGuidance),r);
  r=await B.handle({message:'今川義元のカウンター',history:[]});
  check('specific counter bypasses term guidance',r&&r.mode==='たいらの野望専用知識'&&/候補が複数/.test(r.answer||'')&&!(r.data&&r.data.siteGuide),r);
  r=await B.handle({message:'魔導結品の入手は？',history:[]});
  check('specific typo tool question stays authoritative',r&&r.mode==='たいらの野望ツール実データ'&&/番号または名称/.test(r.answer||''),r);
  r=await B.handle({message:'鬼神席のページどこ',history:[]});
  check('typo navigation still opens proper page',guide(r,'kishin')&&Array.isArray(r.links)&&r.links.length===1,r);

  let s=session();await s.ask('九十九');r=await s.ask('入手方法');
  check('tsukumo acquisition followup',r&&r.mode==='たいらの野望ツール実データ'&&/九十九の入手/.test(r.answer||'')&&/番号または名称/.test(r.answer||''),r);
  s=session();await s.ask('九十九');r=await s.ask('1番の能力');
  check('tsukumo numbered fact followup',r&&r.mode==='たいらの野望ツール実データ'&&/八幡神の武運/.test(r.answer||''),r);
  s=session();await s.ask('九十九');r=await s.ask('合計');
  check('tsukumo total followup',guide(r,'tsukumo')&&/8個まで選択/.test(r.answer||''),r);
  s=session();await s.ask('九十九');r=await s.ask('ページを開いて');
  check('term page open followup',guide(r,'tsukumo')&&Array.isArray(r.links)&&r.links.length===1,r);
  s=session();await s.ask('英傑');r=await s.ask('腕力高いのは？');
  check('hero ranking followup',r&&r.mode==='英傑マスター実データ'&&/母里太兵衛/.test(r.answer||'')&&/腕力が高い順/.test(r.answer||''),r);
  s=session();await s.ask('陣法');r=await s.ask('使い方');
  check('jinpo usage followup',guide(r,'jinpo')&&/陣形や因縁数/.test(r.answer||''),r);
  s=session();await s.ask('カウンター');r=await s.ask('桶狭間');
  check('counter location followup',guide(r,'okehazama'),r);

  console.log(`TAIRANO TERM GUIDANCE: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
