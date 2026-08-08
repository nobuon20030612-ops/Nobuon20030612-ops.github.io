#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail&&{answer:detail.answer,data:detail.data,links:detail.links});}
function compact(r){const d=r.data||{};if(!d.siteGuide)return d;return{siteGuide:true,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice(0,8):[],siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice(0,8):[],siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],candidates:Array.isArray(d.candidates)?d.candidates.slice(0,8):[],siteSourceCandidates:Array.isArray(d.siteSourceCandidates)?d.siteSourceCandidates.slice(0,8):[],selectedSiteItem:String(d.selectedSiteItem||''),previousSelectedSiteItem:String(d.previousSelectedSiteItem||''),needsClarification:!!d.needsClarification,siteHistoricalAbsoluteComparisonRestore:!!d.siteHistoricalAbsoluteComparisonRestore,siteHistoricalComparisonRequestedOrder:String(d.siteHistoricalComparisonRequestedOrder||''),siteHistoricalComparisonSelectedFeature:!!d.siteHistoricalComparisonSelectedFeature,siteHistoricalComparisonSameFeatureCarry:!!d.siteHistoricalComparisonSameFeatureCarry,siteHistoricalComparisonSameFeatureNeedsSelection:!!d.siteHistoricalComparisonSameFeatureNeedsSelection,siteComparisonShortOpposite:!!d.siteComparisonShortOpposite,siteComparisonDeicticFeature:!!d.siteComparisonDeicticFeature,siteHistoricalComparisonDualFeature:!!d.siteHistoricalComparisonDualFeature,siteComparisonAlternativeFeature:!!d.siteComparisonAlternativeFeature};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:{mode:r.mode||'',links:r.links||[],data:compact(r)}});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}
async function twoComparisons(){const s=session();await s.ask('能力計算と家臣計算の違いは？');await s.ask('前者');await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');return s;}
(async()=>{let s,r;
  s=await twoComparisons();r=await s.ask('最初の比較で選んだ方の保存も教えて');
  check('absolute selected side plus feature resolves selected item',r.data&&r.data.siteHistoricalComparisonSelectedFeature&&r.data.siteItem==='stats'&&r.data.siteFeature==='save',r);
  check('absolute selected feature keeps comparison context',r.data&&r.data.selectedSiteItem==='stats'&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('retainer'),r);
  check('absolute selected feature answers save',/保存/.test(r.answer||'')&&hasLink(r,'能力計算機.html'),r);

  s=await twoComparisons();r=await s.ask('最後の比較で選んだ方の入手も教えて');
  check('absolute selected acquisition uses latest selected material',r.data&&r.data.siteHistoricalComparisonSelectedFeature&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns',r);
  check('absolute selected acquisition answers acquisition',/入手/.test(r.answer||'')&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');r=await s.ask('最初の比較で選んだ方の保存も教えて');
  check('selected-side feature without old selection asks safely',r.data&&r.data.needsClarification&&r.data.siteHistoricalAbsoluteComparisonNeedsClarification,r);

  s=await twoComparisons();await s.ask('能力計算を開いて、保存方法も教えて');r=await s.ask('最後の比較に戻って、さっきと同じこと');
  check('absolute comparison return carries previous feature',r.data&&r.data.siteHistoricalComparisonSameFeatureCarry&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);
  check('same feature carry keeps restored comparison state',r.data&&r.data.selectedSiteItem==='tsukumo'&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('kishin'),r);
  check('same feature carry answer is natural and feature-specific',/さっきと同じ/.test(r.answer||'')&&/保存/.test(r.answer||''),r);

  s=await twoComparisons();await s.ask('鬼神石を開いて、入手も教えて');r=await s.ask('最後の比較に戻って、同じこと');
  check('same feature carry preserves acquisition detail',r.data&&r.data.siteHistoricalComparisonSameFeatureCarry&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns'&&/入手/.test(r.answer||''),r);

  s=session();await s.ask('九十九を開いて、保存方法も教えて');await s.ask('能力計算と家臣計算の違いは？');r=await s.ask('最後の比較に戻って、同じこと');
  check('same feature carry with undecided comparison asks which side',r.data&&r.data.needsClarification&&r.data.siteHistoricalAbsoluteComparisonNeedsClarification,r);

  s=await twoComparisons();await s.ask('最初の比較で選んだ方');r=await s.ask('じゃあ反対は？');
  check('short opposite after historical restore changes side',r.data&&r.data.siteComparisonShortOpposite&&r.data.siteItem==='retainer'&&r.data.previousSelectedSiteItem==='stats',r);
  check('short opposite keeps comparison pair',r.data&&r.data.selectedSiteItem==='retainer'&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('stats'),r);

  s=await twoComparisons();await s.ask('最後の比較に戻って');r=await s.ask('逆は？');
  check('short inverse wording changes current comparison side',r.data&&r.data.siteComparisonShortOpposite&&r.data.siteItem==='kishin'&&r.data.previousSelectedSiteItem==='tsukumo',r);

  r=await session().ask('じゃあ反対は？');
  check('short opposite without comparison does not fabricate comparison',!(r.data&&r.data.siteComparisonShortOpposite),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('そこじゃなく反対の方');r=await s.ask('それの入手は？');
  check('deictic feature follows revised comparison selection',r.data&&r.data.siteComparisonDeicticFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns',r);
  check('deictic acquisition ignores stale resolver target',/鬼神石/.test(r.answer||'')&&/入手/.test(r.answer||'')&&!/九十九の入手についてですね/.test(r.answer||''),r);

  r=await s.ask('今の保存は？');
  check('deictic save continues current comparison selection',r.data&&r.data.siteComparisonDeicticFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');await s.ask('前者');r=await s.ask('それの保存は？');
  check('deictic feature also works for calculator comparison',r.data&&r.data.siteComparisonDeicticFeature&&r.data.siteItem==='stats'&&r.data.siteFeature==='save',r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('それじゃなくて、もう片方の保存は？');
  check('explicit alternative plus feature keeps older priority',r.data&&r.data.siteComparisonAlternativeFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('new deictic feature does not steal alternative correction',!(r.data&&r.data.siteComparisonDeicticFeature),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('能力計算と家臣計算の違いは？');await s.ask('前者');r=await s.ask('最初の比較で選んだ方の保存を教えて、そのあと反対の方の入手も');
  check('one-turn selected and opposite feature bundle resolves both sides',r.data&&r.data.siteHistoricalComparisonDualFeature&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.selectedSiteItem==='kishin',r);
  check('one-turn bundle answers first side save',/九十九/.test(r.answer||'')&&/保存/.test(r.answer||''),r);
  check('one-turn bundle answers opposite acquisition',/鬼神石/.test(r.answer||'')&&/入手/.test(r.answer||''),r);
  check('one-turn bundle ends context on last-mentioned side',r.data&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns'&&hasLink(r,'九十九.html')&&hasLink(r,'鬼神石.html'),r);
  r=await s.ask('それの保存は？');
  check('followup after bundle refers to final side',r.data&&r.data.siteComparisonDeicticFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');await s.ask('前者');r=await s.ask('最初の比較で選んだ方の保存を教えて、そのあと反対の方の入手も');
  check('bundle with unsupported opposite feature refuses safely',r.data&&r.data.needsClarification&&!r.data.siteHistoricalComparisonDualFeature,r);

  r=await session().ask('文曲の輝光');
  check('monkyoku exact link remains stable',stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AI SELECTED SIDE / FOLLOWUP BUNDLE: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
