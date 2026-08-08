#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteFeatures:d.siteFeatures||[],siteFeatureSubjects:d.siteFeatureSubjects||[],siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],siteExcludedItems:d.siteExcludedItems||[],siteConditions:d.siteConditions||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification,knownTermGuidance:!!d.knownTermGuidance,termKey:d.termKey||'',normalizedTerm:d.normalizedTerm||'',approximateTerm:!!d.approximateTerm}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function stone(r,key){return !!(r&&r.links&&r.links.length===1&&new RegExp('#'+key+'$').test(r.links[0].url||''));}
(async()=>{
  let s=session(),r;await s.ask('文曲の輝光');await s.ask('それで何が分かる？');r=await s.ask('じゃあ武曲は？');
  check('explicit stone switch remains exact',r.data&&r.data.stoneName==='武曲'&&stone(r,'bukyoku'),r);

  s=session();await s.ask('文曲の輝光');r=await s.ask('別のは？');
  check('other stone request lists six exact alternatives',r.data&&r.data.siteStoneAlternatives&&r.data.needsClarification&&r.links.length===6&&!r.links.some(x=>/#monkyoku$/.test(x.url||'')),r);
  r=await s.ask('武曲');check('stone name selects from alternatives',r.data&&r.data.stoneName==='武曲'&&stone(r,'bukyoku'),r);

  s=session();await s.ask('文曲の輝光');await s.ask('ほかには？');r=await s.ask('上から2番目');
  check('ordinal selects exact stone alternative',r.data&&r.data.siteStoneAlternativeSelection&&r.data.stoneName==='禄存'&&stone(r,'rokuzon'),r);

  s=session();await s.ask('文曲の輝光');await s.ask('他のも見たい');r=await s.ask('最後');
  check('last selects exact stone alternative',r.data&&r.data.siteStoneAlternativeSelection&&r.data.stoneName==='貪狼'&&stone(r,'tanrou'),r);

  s=session();await s.ask('文曲の輝光');await s.ask('別のは？');r=await s.ask('真ん中');
  check('even middle does not guess',r.data&&r.data.siteStoneAlternativeSelectionAmbiguous&&r.data.needsClarification&&r.links.length===6,r);

  s=session();await s.ask('九十九は何が分かる？');r=await s.ask('じゃあ鬼神石は？');
  check('direct result question carries to new target',r.data&&r.data.siteDetailTargetSwitch&&r.data.siteItem==='kishin'&&r.data.siteFeature==='result'&&/合成最低発現数/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('九十九のページ開いて');await s.ask('それで何が分かる？');r=await s.ask('それと比べて鬼神石は？');
  check('comparison wording carries result intent',r.data&&r.data.siteDetailTargetSwitch&&r.data.previousSiteItem==='tsukumo'&&r.data.siteItem==='kishin'&&/九十九.*鬼神石/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('家臣計算のページ開いて');await s.ask('何を入力するの？');r=await s.ask('じゃあ能力計算は？');
  check('input intent carries to another calculator',r.data&&r.data.siteDetailTargetSwitch&&r.data.siteItem==='stats'&&r.data.siteFeature==='inputs'&&/頭・胴・右手/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('九十九のページ開いて');await s.ask('どこを押すの？');r=await s.ask('じゃあ魔導結晶は？');
  check('operation intent carries to another material page',r.data&&r.data.siteDetailTargetSwitch&&r.data.siteItem==='mado'&&r.data.siteFeature==='operation'&&/最大8個を選び/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は別の話しよう');r=await s.ask('別のは？');
  check('unrelated reply expires stone alternatives',!(r.data&&r.data.siteStoneAlternatives),r);

  r=await session().ask('別のは？');check('no-history alternative is not hijacked',!(r.data&&r.data.siteStoneAlternatives),r);

  s=session();await s.ask('計算したい');await s.ask('どれでもない');r=await s.ask('じゃあ鬼神石は？');
  check('rejection blocks stale detail carry',!(r.data&&r.data.siteDetailTargetSwitch),r);

  console.log(`NATURAL DETAIL TARGET SWITCH: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
