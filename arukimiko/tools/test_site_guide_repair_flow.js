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
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js',
  'jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){
  const d=r&&r.data||{};
  return {mode:r&&r.mode||'',links:r&&r.links||[],data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),
    siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice():[],
    siteFeatureSubjects:Array.isArray(d.siteFeatureSubjects)?d.siteFeatureSubjects.slice():[],
    siteItems:Array.isArray(d.siteItems)?d.siteItems.slice():[],
    candidates:Array.isArray(d.candidates)?d.candidates.slice():[],
    siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice():[],
    siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice():[],
    selectedSiteItem:String(d.selectedSiteItem||''),needsClarification:!!d.needsClarification
  }};
}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};}
function guide(r,id){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide&&(!id||r.data.siteItem===id));}
function hasOnlyFeature(r,key){const a=r&&r.data&&r.data.siteFeatures||[];return a.length===1&&a[0]===key;}
(async()=>{
  let r=await session().ask('魔導のやつ、何個までで…いや保存できるか');
  check('inline feature repair discards old feature',guide(r,'mado')&&hasOnlyFeature(r,'save')&&!/8個まで/.test(r.answer||'')&&/画像として保存/.test(r.answer||''),r&&r.answer);

  r=await session().ask('九十九は何個まで？ それと魔導、あ、やっぱ鬼神石の保存は？');
  check('compound repair keeps prior independent question',r&&r.data&&r.data.compound&&/九十九/.test(r.answer||'')&&/鬼神石/.test(r.answer||'')&&!/魔導結晶/.test(r.answer||''),r&&r.answer);

  r=await session().ask('そこじゃない、能力計算');
  check('deictic correction to stats',guide(r,'stats'),r);
  r=await session().ask('ここじゃない、家臣計算');
  check('deictic correction to retainer',guide(r,'retainer'),r);
  r=await session().ask('あ、やっぱ鬼神石の保存');
  check('yappari correction direct item',guide(r,'kishin')&&hasOnlyFeature(r,'save'),r);
  r=await session().ask('ごめん、魔導の保存できる？');
  check('apology repair direct item',guide(r,'mado')&&hasOnlyFeature(r,'save'),r);
  r=await session().ask('いやでも九十九って何個まで？');
  check('iya demo is not destructive correction',guide(r,'tsukumo')&&hasOnlyFeature(r,'selection_count'),r);

  let s=session();await s.ask('能力計算の保存は？');
  r=await s.ask('あとそれ開いて');
  check('filler deictic open',guide(r,'stats')&&r.data.siteOpen&&/開けるように/.test(r.answer||'')&&r.links.length===1,r);
  s=session();await s.ask('家臣計算の保存は？');
  r=await s.ask('うん、それ開いて');
  check('ack deictic open',guide(r,'retainer')&&r.data.siteOpen&&r.links.length===1,r);

  s=session();r=await s.ask('九十九と魔導って何が違う？');
  r=await s.ask('じゃあそっちは？');
  check('comparison deictic selects latter',guide(r,'mado')&&r.data.selectedSiteItem==='mado'&&Array.isArray(r.data.siteComparison),r);
  r=await s.ask('もう片方は保存できる？');
  check('comparison other side survives selection',guide(r,'tsukumo')&&r.data.siteFeature==='save'&&r.data.selectedSiteItem==='tsukumo',r);
  r=await s.ask('そっちは何個まで？');
  check('comparison can switch back by socchi',guide(r,'mado')&&r.data.siteFeature==='selection_count',r);
  r=await s.ask('こっちは並べ替えできる？');
  check('comparison kochi keeps current side',guide(r,'mado')&&r.data.siteFeature==='sort',r);

  s=session();await s.ask('九十九と魔導って何が違う？');
  r=await s.ask('こっちは？');
  check('comparison kochi initially selects former',guide(r,'tsukumo')&&r.data.selectedSiteItem==='tsukumo',r);

  s=session();await s.ask('能力計算に九十九入れたい');
  r=await s.ask('で、家臣の方は？');
  check('reflect subject crosses calculators',guide(r,'retainer')&&r.data.siteFeature==='reflect'&&/九十九選択/.test(r.answer||''),r&&r.answer);

  s=session();await s.ask('能力計算に魔導を入れたい');
  r=await s.ask('それで家臣の方は？');
  check('unsupported reflect crosses calculators honestly',guide(r,'retainer')&&r.data.siteFeature==='reflect'&&/(?:直接選択・反映する欄|直接反映する欄)は確認できません/.test(r.answer||''),r&&r.answer);

  s=session();await s.ask('家臣計算に九十九入れたい');
  r=await s.ask('自分の能力の方は？');
  check('reflect subject crosses back to stats',guide(r,'stats')&&r.data.siteFeature==='reflect'&&/右手または左手/.test(r.answer||''),r&&r.answer);

  s=session();await s.ask('鬼神石のページ開いて');
  await s.ask('そこじゃない、能力計算');
  r=await s.ask('九十九も入れたい');
  check('corrected page remains active for short reflect',guide(r,'stats')&&r.data.siteFeature==='reflect'&&/九十九選択/.test(r.answer||''),r&&r.answer);

  r=await session().ask('能力計算で九十九を入れたい');
  check('reflect desire wording direct',guide(r,'stats')&&r.data.siteFeature==='reflect',r);
  r=await session().ask('家臣計算に九十九を取り込みたい');
  check('reflect import desire wording direct',guide(r,'retainer')&&r.data.siteFeature==='reflect',r);
  r=await session().ask('能力計算で鎮魂符を使いたい');
  check('reflect use desire wording direct',guide(r,'stats')&&r.data.siteFeature==='reflect'&&/鎮魂符/.test(r.answer||''),r&&r.answer);

  r=await session().ask('魔導結晶のページじゃなくて入手方法知りたい');
  check('tool fact correction boundary remains',r&&r.mode==='たいらの野望ツール実データ'&&/番号または名称/.test(r.answer||''),r);
  r=await session().ask('鬼神石1番の入手は？');
  check('exact tool fact remains authoritative',r&&r.mode==='たいらの野望ツール実データ',r);
  r=await session().ask('足利義昭のカウンター見たい');
  check('counter authority remains',r&&r.mode==='たいらの野望専用知識'&&/157/.test(r.answer||''),r);

  console.log(`SITE GUIDE REPAIR FLOW: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
