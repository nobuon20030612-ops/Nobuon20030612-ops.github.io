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
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteItems:Array.isArray(d.siteItems)?d.siteItems.slice():[],
    siteFeature:String(d.siteFeature||''),siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice():[],
    siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice():[],siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice():[],
    selectedSiteItem:String(d.selectedSiteItem||''),needsClarification:!!d.needsClarification,siteMixedClauses:!!d.siteMixedClauses
  }};
}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};}
function guide(r,id){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide&&(!id||r.data.siteItem===id));}
function oneLink(r,label){return !!(r&&Array.isArray(r.links)&&r.links.length===1&&String(r.links[0].label||'').indexOf(label)>=0);}
(async()=>{
  let s=session(),r;
  await s.ask('九十九と魔導って何が違う？');
  await s.ask('なるほどね');
  r=await s.ask('じゃあそっちの保存は？');
  check('comparison survives one acknowledgement',guide(r,'mado')&&r.data.siteFeature==='save'&&r.data.selectedSiteItem==='mado',r);

  s=session();await s.ask('九十九と魔導って何が違う？');await s.ask('今日は別の話しよう');
  r=await s.ask('じゃあそっちの保存は？');
  check('substantive topic expires old comparison',!(r&&r.data&&r.data.selectedSiteItem==='mado'),r);

  s=session();await s.ask('能力計算の保存は？');r=await s.ask('あれ開いて');
  check('are opens recent page',guide(r,'stats')&&r.data.siteOpen&&oneLink(r,'能力計算'),r);
  s=session();await s.ask('家臣計算の保存は？');r=await s.ask('あのページ見せて');
  check('ano page opens recent page',guide(r,'retainer')&&r.data.siteOpen&&oneLink(r,'家臣計算'),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('真ん中は保存できる？');
  check('middle candidate selects tsukumo',guide(r,'tsukumo')&&r.data.siteFeature==='save',r);
  r=await s.ask('最後のやつ開いて');
  check('last candidate selects mado',guide(r,'mado')&&oneLink(r,'魔導結晶'),r);

  s=session();r=await s.ask('能力計算か家臣計算したい');
  check('or pages asks clarification',r&&r.data&&r.data.needsClarification&&Array.isArray(r.data.siteCandidates)&&r.data.siteCandidates.join(',')==='stats,retainer',r);
  r=await s.ask('上じゃない方');
  check('not upper selects second',guide(r,'retainer'),r);

  s=session();r=await s.ask('九十九それとも魔導を見たい');
  check('soretomo asks page choice',r&&r.data&&r.data.needsClarification&&Array.isArray(r.data.siteCandidates)&&r.data.siteCandidates.length===2,r);
  r=await s.ask('前者じゃない方');
  check('not former selects latter',guide(r,'mado'),r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('九十九じゃない方の保存は？');
  check('excluded comparison item resolves other',guide(r,'mado')&&r.data.siteFeature==='save',r);
  r=await session().ask('九十九じゃない方の保存は？');
  check('excluded item without context asks safely',r&&r.data&&r.data.needsClarification&&!/九十九」について/.test(r.answer||''),r);

  r=await session().ask('九十九と魔導の違い教えて、魔導だけ開いて');
  check('compare plus selected open answers comparison',r&&r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.length===2&&/違いはこちら/.test(r.answer||''),r);
  check('compare plus selected open gives one mado link',oneLink(r,'魔導結晶')&&r.data.selectedSiteItem==='mado',r);

  r=await session().ask('九十九と魔導の違い教えて、後者だけ開いて');
  check('compare plus latter open',oneLink(r,'魔導結晶')&&r.data.selectedSiteItem==='mado',r);

  r=await session().ask('九十九じゃなくて魔導を開いて、でも九十九の保存も知りたい');
  check('mixed open and feature keeps distinct subjects',r&&r.data&&r.data.siteMixedClauses&&/魔導結晶」を開ける/.test(r.answer||'')&&/九十九」について/.test(r.answer||''),r);
  check('mixed open and feature has both links',r&&Array.isArray(r.links)&&r.links.length===2,r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('中央のやつは何個まで？');
  check('central candidate natural wording',guide(r,'tsukumo')&&r.data.siteFeature==='selection_count',r);
  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('一番下を開いて');
  check('bottom candidate natural wording',guide(r,'mado'),r);

  s=session();await s.ask('能力計算か家臣計算したい');r=await s.ask('下じゃない方');
  check('not lower selects first',guide(r,'stats'),r);

  r=await session().ask('鬼神石1番の入手は？');
  check('tool fact boundary remains',r&&r.mode==='たいらの野望ツール実データ',r);
  r=await session().ask('足利義昭のカウンター見たい');
  check('counter boundary remains',r&&r.mode==='たいらの野望専用知識',r);

  console.log(`SITE GUIDE DEICTIC CANDIDATES: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
