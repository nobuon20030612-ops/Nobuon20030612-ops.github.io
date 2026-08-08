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
  await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');await s.ask('どっちがいい？');r=await s.ask('能力計算に反映したい');
  check('ability reflection selects tsukumo',r.data&&r.data.siteComparisonPurposeSelected&&r.data.siteItem==='tsukumo'&&r.data.selectedSiteItem==='tsukumo'&&r.links.length===1&&hasLink(r,'九十九.html'),r);
  r=await s.ask('じゃあそれを開いて');check('deictic open follows selected purpose',r.data&&r.data.siteExactLinkOpen&&r.links.length===1&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');r=await s.ask('家臣計算に入れたい');
  check('direct purpose reply selects tsukumo',r.data&&r.data.siteComparisonPurposeSelected&&r.data.siteItem==='tsukumo'&&/家臣計算/.test(r.answer||''),r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');r=await s.ask('合成最低発現数を見たい');
  check('minimum activation selects kishin',r.data&&r.data.siteComparisonPurposeSelected&&r.data.siteItem==='kishin'&&r.links.length===1&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');r=await s.ask('一覧を画像で保存したい');
  check('shared save goal keeps both without guessing',r.data&&r.data.siteComparisonPurposeMultiple&&r.data.needsClarification&&r.links.length===2&&!r.data.siteItem,/answer/.test(String(r))?r.answer:r);
  r=await s.ask('それを開いて');check('ambiguous deictic open asks which link',r.data&&r.data.siteLinkOpenNeedsSelection&&r.data.needsClarification&&r.links.length===2,r);

  s=session();await s.ask('九十九と魔導結晶の違いは？');r=await s.ask('首に反映したい');
  check('neck goal selects mado',r.data&&r.data.siteComparisonPurposeSelected&&r.data.siteItem==='mado'&&r.links.length===1&&hasLink(r,'魔導結晶.html'),r);

  s=session();await s.ask('九十九と魔導結晶の違いは？');r=await s.ask('右手に反映したい');
  check('right-hand goal selects tsukumo',r.data&&r.data.siteComparisonPurposeSelected&&r.data.siteItem==='tsukumo'&&r.links.length===1&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');r=await s.ask('合計を見たい');
  check('shared total goal keeps both',r.data&&r.data.siteComparisonPurposeMultiple&&r.links.length===2,r);

  r=await session().ask('能力計算に反映したい');check('no-history purpose is not hijacked',!(r.data&&r.data.siteComparisonPurpose),r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');await s.ask('今日は別の話をしよう');r=await s.ask('合成最低発現数を見たい');
  check('unrelated turn expires comparison purpose',!(r.data&&r.data.siteComparisonPurpose),r);

  s=session();await s.ask('九十九は何が分かる？');await s.ask('じゃあ鬼神石は？');await s.ask('どれでもない');r=await s.ask('能力計算に反映したい');
  check('rejection clears comparison purpose',!(r.data&&r.data.siteComparisonPurpose),r);

  console.log(`COMPARISON PURPOSE SELECTION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
