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
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
(async()=>{
  let s=session(),r;
  await s.ask('九十九と鬼神石の違いは？');r=await s.ask('能力計算なら？');
  check('omitted ability purpose selects tsukumo',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);

  r=await s.ask('なんで？');
  check('reason followup understands expanded shorthand',r.data&&r.data.siteComparisonReason&&r.data.siteItem==='tsukumo'&&/能力計算/.test(r.answer||''),r);
  r=await s.ask('じゃあ合成最低発現数なら？');
  check('short changed purpose reselects kishin',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と魔導結晶の違いは？');r=await s.ask('首なら？');
  check('short neck purpose selects mado',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteItem==='mado'&&hasLink(r,'魔導結晶.html'),r);
  r=await s.ask('右手は？');
  check('short right-hand purpose reselects tsukumo',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('画像保存は？');
  check('short shared save purpose keeps both',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteComparisonPurposeMultiple&&r.links.length===2&&r.data.needsClarification,r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('合計なら？');
  check('short shared total purpose keeps both',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteComparisonPurposeMultiple&&r.links.length===2,r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');r=await s.ask('魔導結晶なら？');
  check('material shorthand selects compatible calculator',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteItem==='stats'&&hasLink(r,'能力計算機.html'),r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');r=await s.ask('九十九は？');
  check('shared material shorthand keeps both calculators',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteComparisonPurposeMultiple&&r.links.length===2,r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('なるほど');r=await s.ask('家臣計算なら？');
  check('one acknowledgement preserves shorthand comparison',r.data&&r.data.siteComparisonPurposeShorthand&&r.data.siteItem==='tsukumo',r);

  r=await session().ask('能力計算なら？');
  check('no comparison does not activate shorthand',!(r.data&&r.data.siteComparisonPurposeShorthand),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('今日は別の話をしよう');r=await s.ask('能力計算なら？');
  check('topic switch expires shorthand comparison',!(r.data&&r.data.siteComparisonPurposeShorthand),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('どれでもない');r=await s.ask('合計なら？');
  check('candidate rejection clears shorthand comparison',!(r.data&&r.data.siteComparisonPurposeShorthand),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('文曲の輝光');
  check('shorthand context does not block exact monkyoku link',r.data&&r.data.siteItem==='seikai'&&r.links.length===1&&/stone=26#monkyoku/.test(decodeURIComponent(r.links[0].url||'')),r);

  console.log(`COMPARISON PURPOSE SHORTHAND: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
