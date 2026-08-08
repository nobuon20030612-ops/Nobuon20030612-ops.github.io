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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteFeatures:d.siteFeatures||[],siteFeatureSubjects:d.siteFeatureSubjects||[],siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],siteExcludedItems:d.siteExcludedItems||[],siteConditions:d.siteConditions||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
(async()=>{
  let s=session(),r;
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('やっぱりもう片方にする');
  check('confirmed selection switches to other candidate',r.data&&r.data.siteComparisonSelectionRevised&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);
  check('revision answer states before and after',/九十九.*鬼神石.*変更/.test(r.answer||''),r);
  r=await s.ask('それでお願い');check('revised selection can be confirmed',r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='kishin',r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('いや、鬼神石に変える');
  check('named correction switches exact candidate',r.data&&r.data.siteComparisonSelectionRevised&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と魔導結晶はどう違う？');await s.ask('後者');await s.ask('それでお願い');r=await s.ask('やっぱりもう片方');
  check('revision after confirmation switches mado to tsukumo',r.data&&r.data.siteComparisonSelectionRevised&&r.data.previousSelectedSiteItem==='mado'&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('やっぱりもう片方にする');r=await s.ask('理由は？');
  check('reason after override does not claim original purpose fit',r.data&&r.data.siteComparisonReasonOverride&&r.data.siteItem==='kishin'&&/変更を優先/.test(r.answer||'')&&/九十九/.test(r.answer||''),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('やっぱり決めるのやめる');
  check('confirmed selection can be cancelled',r.data&&r.data.siteComparisonSelectionRevisionCancelled&&r.data.siteGuideContextCleared&&r.links.length===0,r);
  r=await s.ask('それでお願い');check('cancelled selection is not revived',!(r.data&&r.data.siteComparisonSelectionConfirmed),r);

  s=session();await s.ask('九十九と鬼神石を画像で保存したい');r=await s.ask('いったん保留');
  check('unselected comparison can also be put on hold',r.data&&r.data.siteComparisonSelectionRevisionCancelled&&r.data.siteGuideContextCleared,r);

  r=await session().ask('やっぱりもう片方にする');
  check('no comparison does not activate revision',!(r.data&&r.data.siteComparisonSelectionRevised),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('今日は別の話をしよう');r=await s.ask('やっぱりもう片方にする');
  check('topic switch expires revision context',!(r.data&&r.data.siteComparisonSelectionRevised),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('どれでもない');r=await s.ask('鬼神石に変える');
  check('candidate rejection clears revision context',!(r.data&&r.data.siteComparisonSelectionRevised),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('それで何が分かる？');
  check('detail question is not mistaken for revision',!(r.data&&r.data.siteComparisonSelectionRevised),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('文曲の輝光');
  check('revision context does not block monkyoku deep link',r.data&&r.data.siteItem==='seikai'&&r.links.length===1&&/stone=26#monkyoku/.test(decodeURIComponent(r.links[0].url||'')),r);

  console.log(`COMPARISON SELECTION REVISION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
