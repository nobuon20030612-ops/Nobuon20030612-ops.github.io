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
function ids(r){return r&&r.data&&r.data.siteComparison||[];}
function hasLink(r,part){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(part);}catch(e){return String(x.url||'').includes(part);}});}
(async()=>{
  let s=session(),r;
  await s.ask('九十九は何が分かる？');r=await s.ask('じゃあ鬼神石は？');
  check('switch stores ordered comparison pair',r.data&&r.data.siteDetailTargetSwitch&&r.data.siteItem==='kishin'&&r.data.selectedSiteItem==='kishin'&&JSON.stringify(ids(r))==='["tsukumo","kishin"]',r);

  r=await s.ask('違いは？');
  check('difference follows retained pair',/九十九/.test(r.answer||'')&&/鬼神石/.test(r.answer||'')&&/【違い】/.test(r.answer||'')&&r.links.length===2&&JSON.stringify(ids(r))==='["tsukumo","kishin"]',r);
  r=await s.ask('どっちがいい？');
  check('recommendation follows retained pair',r.data&&r.data.siteRecommendation&&/目的で選ぶ/.test(r.answer||'')&&r.links.length===2&&JSON.stringify(ids(r))==='["tsukumo","kishin"]',r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');r=await s.ask('前の方を開いて');
  check('former target opens exactly',r.data&&r.data.siteItem==='tsukumo'&&r.data.selectedSiteItem==='tsukumo'&&r.links.length===1&&hasLink(r,'九十九.html')&&JSON.stringify(ids(r))==='["tsukumo","kishin"]',r);
  r=await s.ask('後の方を開いて');
  check('latter target opens exactly',r.data&&r.data.siteItem==='kishin'&&r.data.selectedSiteItem==='kishin'&&r.links.length===1&&hasLink(r,'鬼神石.html')&&JSON.stringify(ids(r))==='["tsukumo","kishin"]',r);

  s=session();await s.ask('九十九のページ開いて');await s.ask('それで何が分かる？');r=await s.ask('それと比べて鬼神石は？');
  check('comparison wording compares immediately',r.data&&r.data.siteDetailTargetComparison&&r.data.siteItem==='kishin'&&/【違い】/.test(r.answer||'')&&r.links.length===1&&hasLink(r,'鬼神石.html')&&JSON.stringify(ids(r))==='["tsukumo","kishin"]',r);

  s=session();await s.ask('家臣計算のページ開いて');await s.ask('何を入力するの？');r=await s.ask('じゃあ能力計算は？');
  check('input switch also stores ordered pair',r.data&&r.data.siteFeature==='inputs'&&JSON.stringify(ids(r))==='["retainer","stats"]',r);
  r=await s.ask('違いは？');check('calculator difference uses retained pair',/家臣計算機/.test(r.answer||'')&&/能力計算/.test(r.answer||'')&&r.links.length===2,r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');await s.ask('どれでもない');r=await s.ask('違いは？');
  check('rejection clears retained pair',!(r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.length),r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');await s.ask('今日は別の話しよう');r=await s.ask('違いは？');
  check('unrelated turn expires retained pair',!(r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.length),r);

  r=await session().ask('違いは？');check('no-history difference is not hijacked',!(r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.length),r);

  console.log(`DETAIL SWITCH COMPARISON CONTINUITY: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
