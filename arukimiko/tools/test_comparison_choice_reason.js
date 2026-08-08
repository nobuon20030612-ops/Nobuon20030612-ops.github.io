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
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');r=await s.ask('なんで？');
  check('short why keeps selected comparison',r.data&&r.data.siteComparisonReason&&r.data.siteItem==='tsukumo'&&JSON.stringify(r.data.siteComparison)==='["tsukumo","kishin"]',r);
  check('short why returns exact selected link',r.links&&r.links.length===1&&hasLink(r,'九十九.html')&&/能力計算/.test(r.answer||''),r);
  r=await s.ask('じゃあそれを開いて');check('deictic open follows reason answer',r.data&&r.data.siteExactLinkOpen&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('鬼神石と九十九、合成最低発現数を見るならどっち？');r=await s.ask('理由は？');
  check('activation reason keeps kishin',r.data&&r.data.siteComparisonReason&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html')&&/合成最低発現数/.test(r.answer||''),r);

  s=session();await s.ask('九十九と魔導結晶、首に反映したいならどっち？');r=await s.ask('どうして魔導結晶なの？');
  check('neck reason keeps mado',r.data&&r.data.siteComparisonReason&&r.data.siteItem==='mado'&&hasLink(r,'魔導結晶.html')&&/首/.test(r.answer||''),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');r=await s.ask('鬼神石じゃだめ？');
  check('alternative challenge explains purpose difference',r.data&&r.data.siteComparisonReasonChallenge&&r.data.reasonChallengedSiteItem==='kishin'&&r.data.siteItem==='tsukumo'&&/用途が違/.test(r.answer||''),r);

  s=session();await s.ask('九十九と鬼神石を画像で保存したい');r=await s.ask('なんで絞れないの？');
  check('shared goal explains why both remain',r.data&&r.data.siteComparisonReasonShared&&r.data.needsClarification&&r.links.length===2&&/どちらも/.test(r.answer||''),r);

  s=session();await s.ask('九十九と鬼神石、合計を見たい');r=await s.ask('どうして両方？');
  check('shared total reason keeps both',r.data&&r.data.siteComparisonReasonShared&&r.links.length===2,r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('なるほど');r=await s.ask('でも、なんで？');
  check('one acknowledgement preserves reason context',r.data&&r.data.siteComparisonReason&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('なんで？');
  check('plain comparison is not mistaken for purpose reason',!(r.data&&r.data.siteComparisonReason),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('今日は別の話をしよう');r=await s.ask('なんで？');
  check('unrelated turn expires reason context',!(r.data&&r.data.siteComparisonReason),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('どれでもない');r=await s.ask('理由は？');
  check('rejection clears reason context',!(r.data&&r.data.siteComparisonReason),r);

  console.log(`COMPARISON CHOICE REASON: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
