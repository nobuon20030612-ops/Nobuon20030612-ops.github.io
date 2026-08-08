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
  r=await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');
  check('one sentence ability goal selects tsukumo',r.data&&r.data.siteDirectComparisonPurpose&&r.data.siteItem==='tsukumo'&&r.links.length===1&&hasLink(r,'九十九.html'),r);
  check('direct pair keeps spoken order',r.data&&JSON.stringify(r.data.siteComparison)==='["tsukumo","kishin"]',r);
  r=await s.ask('じゃあそれを開いて');check('direct selection supports deictic open',r.data&&r.data.siteExactLinkOpen&&r.links.length===1&&hasLink(r,'九十九.html'),r);

  r=await session().ask('鬼神石と九十九、合成最低発現数を見るならどっち？');
  check('one sentence activation goal selects kishin',r.data&&r.data.siteDirectComparisonPurpose&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  r=await session().ask('九十九と魔導結晶、首に反映したいならどっち？');
  check('one sentence neck goal selects mado',r.data&&r.data.siteDirectComparisonPurpose&&r.data.siteItem==='mado'&&hasLink(r,'魔導結晶.html'),r);

  r=await session().ask('魔導結晶と九十九、右手に反映したい');
  check('one sentence right-hand goal selects tsukumo',r.data&&r.data.siteDirectComparisonPurpose&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);

  r=await session().ask('九十九と鬼神石を画像で保存したい');
  check('one sentence shared goal does not guess',r.data&&r.data.siteDirectComparisonPurpose&&r.data.siteComparisonPurposeMultiple&&r.data.needsClarification&&r.links.length===2&&!r.data.siteItem,r);

  r=await session().ask('九十九と鬼神石、合計を見たい');
  check('one sentence total goal keeps both',r.data&&r.data.siteDirectComparisonPurpose&&r.data.siteComparisonPurposeMultiple&&r.links.length===2,r);

  r=await session().ask('能力計算と家臣計算、魔導結晶を入れるならどっち？');
  check('calculator pair excludes material target',r.data&&r.data.siteDirectComparisonPurpose&&r.data.siteItem==='stats'&&r.links.length===1&&hasLink(r,'能力計算機.html'),r);
  check('calculator pair keeps only compared calculators',r.data&&JSON.stringify(r.data.siteComparison)==='["stats","retainer"]',r);

  r=await session().ask('能力計算と家臣計算、九十九を入れるならどっち？');
  check('shared calculator goal keeps both',r.data&&r.data.siteDirectComparisonPurpose&&r.data.siteComparisonPurposeMultiple&&r.links.length===2,r);

  r=await session().ask('九十九と鬼神石の違いは？');
  check('plain comparison remains comparison',!(r.data&&r.data.siteDirectComparisonPurpose)&&r.data&&r.data.siteComparison&&r.data.siteComparison.length===2&&/【違い】/.test(r.answer||''),r);

  console.log(`DIRECT COMPARISON PURPOSE: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
