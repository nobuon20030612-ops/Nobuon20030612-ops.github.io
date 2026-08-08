#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail&&{answer:detail.answer,data:detail.data,links:detail.links});}
function compact(r){const d=r.data||{};if(!d.siteGuide)return d;return{siteGuide:true,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice(0,8):[],siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice(0,8):[],siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],candidates:Array.isArray(d.candidates)?d.candidates.slice(0,8):[],siteSourceCandidates:Array.isArray(d.siteSourceCandidates)?d.siteSourceCandidates.slice(0,8):[],selectedSiteItem:String(d.selectedSiteItem||''),previousSelectedSiteItem:String(d.previousSelectedSiteItem||''),needsClarification:!!d.needsClarification,siteComparisonRoundTripFeatureBundle:!!d.siteComparisonRoundTripFeatureBundle,siteComparisonOriginalSideFeature:!!d.siteComparisonOriginalSideFeature,siteComparisonNamedSideFeature:!!d.siteComparisonNamedSideFeature,siteComparisonSelectionRevised:!!d.siteComparisonSelectionRevised,siteComparisonOppositeSameFeatureCarry:!!d.siteComparisonOppositeSameFeatureCarry,siteComparisonOppositeFeature:!!d.siteComparisonOppositeFeature,siteComparisonRevisionOppositeBundle:!!d.siteComparisonRevisionOppositeBundle,siteComparisonImplicitSelectedFeature:!!d.siteComparisonImplicitSelectedFeature};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:{mode:r.mode||'',links:r.links||[],data:compact(r)}});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}
async function base(){const s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('九十九の保存を教えて');return s;}
(async()=>{let s,r;
  s=await base();r=await s.ask('反対でさっきの続き、そのあと元の方へ戻って入手');
  check('roundtrip bundle handled',r.data&&r.data.siteComparisonRoundTripFeatureBundle,r);
  check('roundtrip first leg keeps save on opposite',/鬼神石/.test(r.answer||'')&&/保存/.test(r.answer||''),r);
  check('roundtrip second leg returns original with acquisition',/九十九/.test(r.answer||'')&&/入手/.test(r.answer||''),r);
  check('roundtrip final state returns original side',r.data&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns'&&r.data.selectedSiteItem==='tsukumo'&&r.data.previousSelectedSiteItem==='kishin',r);
  check('roundtrip keeps both comparison links',hasLink(r,'鬼神石.html')&&hasLink(r,'九十九.html'),r);
  r=await s.ask('それの保存は？');check('roundtrip followup uses final original side',r.data&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);

  s=await base();r=await s.ask('反対は入手、そのあと元の方へ戻って保存');
  check('roundtrip supports explicit opposite feature',r.data&&r.data.siteComparisonRoundTripFeatureBundle&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);
  check('explicit first leg acquisition is on opposite',/鬼神石/.test(r.answer||'')&&/入手/.test(r.answer||''),r);

  s=await base();await s.ask('反対でさっきの続き');r=await s.ask('元の方は入手');
  check('original-side followup returns previous side',r.data&&r.data.siteComparisonOriginalSideFeature&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns',r);
  check('original-side followup records transition back',r.data&&r.data.previousSelectedSiteItem==='kishin'&&r.data.selectedSiteItem==='tsukumo',r);

  s=await base();await s.ask('反対でさっきの続き');await s.ask('今日は暑いね');await s.ask('なるほど');r=await s.ask('元の方で入手');
  check('original-side reference survives smalltalk',r.data&&r.data.siteComparisonOriginalSideFeature&&r.data.siteItem==='tsukumo'&&/入手/.test(r.answer||''),r);

  r=await session().ask('元の方は保存');
  check('original-side without transition does not fabricate',!(r.data&&r.data.siteComparisonOriginalSideFeature),r);

  s=await base();r=await s.ask('前者に戻って、今度は入手');
  check('first-side explicit feature selects first candidate',r.data&&r.data.siteComparisonNamedSideFeature&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns',r);
  check('first-side answer acquisition specific',/九十九/.test(r.answer||'')&&/入手/.test(r.answer||''),r);

  s=await base();r=await s.ask('後者は保存');
  check('second-side explicit feature selects second candidate',r.data&&r.data.siteComparisonNamedSideFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('second-side records previous selection',r.data&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.selectedSiteItem==='kishin',r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('後者は保存');
  check('named side works even before implicit selection',r.data&&r.data.siteComparisonNamedSideFeature&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);

  s=await base();r=await s.ask('今選んでいる方の入手');
  check('current-side explicit wording follows selection',r.data&&r.data.siteComparisonNamedSideFeature&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns',r);

  s=await base();await s.ask('反対でさっきの続き');r=await s.ask('さっき反対にした方の入手');
  check('transition-current wording follows switched side',r.data&&r.data.siteComparisonNamedSideFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns',r);
  check('transition-current answer names switched side',/鬼神石/.test(r.answer||'')&&/入手/.test(r.answer||''),r);

  s=await base();r=await s.ask('保存じゃなく入手、そのあと反対は保存');
  check('stage14AJ crossed bundle remains intact',r.data&&r.data.siteComparisonRevisionOppositeBundle&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);

  s=await base();r=await s.ask('反対でさっきの続き');
  check('stage14AJ opposite carry remains intact',r.data&&r.data.siteComparisonOppositeSameFeatureCarry&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);

  r=await session().ask('後者は保存');
  check('named side without comparison does not fabricate',!(r.data&&r.data.siteComparisonNamedSideFeature),r);

  r=await session().ask('文曲の輝光');check('monkyoku exact link remains stable',stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AK COMPARISON SIDE / ROUNDTRIP: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
