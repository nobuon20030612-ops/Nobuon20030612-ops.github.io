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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteFeatures:d.siteFeatures||[],siteFeatureSubjects:d.siteFeatureSubjects||[],siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteConditions:d.siteConditions||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
async function viewed(){const s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('もう片方は何だっけ？');return s;}
(async()=>{
  let s=await viewed(),r=await s.ask('じゃあそれにする');
  check('that reference selects viewed alternative',r.data&&r.data.siteComparisonViewedAlternativeSelected&&r.data.siteComparisonSelectionRevised&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.siteItem==='kishin',r);
  check('viewed selection states before and after with exact link',/九十九.*鬼神石.*変更/.test(r.answer||'')&&r.links.length===1&&hasLink(r,'鬼神石.html'),r);
  r=await s.ask('今どっちを選んでる？');check('current selection follows viewed alternative change',r.data&&r.data.siteComparisonSelectionRecall&&r.data.siteItem==='kishin',r);

  s=await viewed();r=await s.ask('じゃあその方でお願い');check('that-side phrasing selects viewed alternative',r.data&&r.data.siteComparisonViewedAlternativeSelected&&r.data.siteItem==='kishin',r);
  s=await viewed();r=await s.ask('それでお願い');check('natural confirmation refers to just-viewed alternative',r.data&&r.data.siteComparisonViewedAlternativeSelected&&r.data.siteItem==='kishin',r);
  s=await viewed();r=await s.ask('やっぱりそれにする');check('reconsideration reference selects viewed alternative',r.data&&r.data.siteComparisonViewedAlternativeSelected&&r.data.siteItem==='kishin',r);
  s=await viewed();r=await s.ask('そっちに変える');check('explicit there-change keeps working',r.data&&r.data.siteComparisonViewedAlternativeSelected&&r.data.siteItem==='kishin',r);

  s=await viewed();await s.ask('なるほど');r=await s.ask('それにする');
  check('one acknowledgement preserves viewed reference',r.data&&r.data.siteComparisonViewedAlternativeSelected&&r.data.siteItem==='kishin',r);
  s=await viewed();await s.ask('なるほど');await s.ask('了解');r=await s.ask('それにする');
  check('two acknowledgements expire viewed reference',!(r.data&&r.data.siteComparisonViewedAlternativeSelected),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('今どっちを選んでる？');r=await s.ask('それにする');
  check('current-selection recall still confirms current choice',!(r.data&&r.data.siteComparisonViewedAlternativeSelected)&&r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='tsukumo',r);
  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('何と何を比べてた？');r=await s.ask('それにする');
  check('pair recall does not invent viewed alternative',!(r.data&&r.data.siteComparisonViewedAlternativeSelected)&&r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='tsukumo',r);

  s=await viewed();await s.ask('それを開いて');r=await s.ask('今どっちを選んでる？');
  check('opening viewed alternative does not change selection',r.data&&r.data.siteComparisonSelectionRecall&&r.data.siteItem==='tsukumo',r);

  s=await viewed();await s.ask('じゃあそれにする');r=await s.ask('それでお願い');
  check('viewed alternative change can be reconfirmed',r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='kishin',r);
  s=await viewed();await s.ask('じゃあそれにする');r=await s.ask('理由は？');
  check('reason after viewed override remains honest',r.data&&r.data.siteComparisonReasonOverride&&r.data.siteItem==='kishin'&&/変更を優先/.test(r.answer||''),r);

  s=await viewed();await s.ask('やっぱり決めるのやめる');r=await s.ask('それにする');
  check('cancellation blocks viewed reference reuse',!(r.data&&r.data.siteComparisonViewedAlternativeSelected),r);
  s=await viewed();await s.ask('今日は別の話をしよう');r=await s.ask('それにする');
  check('topic switch expires viewed reference',!(r.data&&r.data.siteComparisonViewedAlternativeSelected),r);
  r=await session().ask('それにする');check('no comparison does not activate viewed selection',!(r.data&&r.data.siteComparisonViewedAlternativeSelected),r);

  s=await viewed();r=await s.ask('文曲の輝光');
  check('viewed reference does not block monkyoku deep link',r.data&&r.data.siteItem==='seikai'&&r.links.length===1&&/stone=26#monkyoku/.test(decodeURIComponent(r.links[0].url||'')),r);

  console.log(`COMPARISON VIEWED ALTERNATIVE SELECTION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
