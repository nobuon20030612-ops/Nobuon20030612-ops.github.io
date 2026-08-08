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
(async()=>{
  let s=session(),r;
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('何と何を比べてた？');
  check('comparison pair can be recalled',r.data&&r.data.siteComparisonCandidateSetRecall&&r.data.selectedSiteItem==='tsukumo'&&r.links.length===2,r);
  check('pair recall names both and current selection',/九十九/.test(r.answer||'')&&/鬼神石/.test(r.answer||'')&&/現在選んでいる.*九十九/.test(r.answer||''),r);
  r=await s.ask('今どっちを選んでる？');check('pair recall does not change selection',r.data&&r.data.siteComparisonSelectionRecall&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('候補は何だった？');
  check('candidate wording recalls comparison set',r.data&&r.data.siteComparisonCandidateSetRecall&&r.links.length===2,r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('もう片方は何だっけ？');
  check('other candidate is recalled with exact link',r.data&&r.data.siteComparisonOtherCandidateRecall&&r.data.siteViewedAlternative==='kishin'&&r.data.selectedSiteItem==='tsukumo'&&r.links.length===1&&hasLink(r,'鬼神石.html'),r);
  check('other-candidate answer explicitly keeps selection',/もう片方は.*鬼神石/.test(r.answer||'')&&/選択は.*九十九.*まま/.test(r.answer||''),r);
  r=await s.ask('今どっちを選んでる？');check('asking about other side does not switch selection',r.data&&r.data.siteComparisonSelectionRecall&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('やっぱりもう片方にする');r=await s.ask('選ばなかった方は？');
  check('other side follows revised current selection',r.data&&r.data.siteComparisonOtherCandidateRecall&&r.data.siteViewedAlternative==='tsukumo'&&r.data.selectedSiteItem==='kishin'&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('もう片方は何だっけ？');
  check('unselected comparison does not guess other side',r.data&&r.data.siteComparisonOtherRecallNeedsSelection&&r.data.needsClarification&&!r.data.selectedSiteItem&&r.links.length===2,r);
  r=await s.ask('後者');check('selection continues after undecided other-side recall',r.data&&r.data.siteItem==='tsukumo'&&r.data.selectedSiteItem==='tsukumo',r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('やっぱりもう片方にする');
  check('explicit other-side change still revises selection',r.data&&r.data.siteComparisonSelectionRevised&&r.data.siteItem==='kishin',r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('もう片方は保存できる？');
  check('other-side feature question is not mistaken for recall',!(r.data&&r.data.siteComparisonOtherCandidateRecall)&&r.data&&r.data.siteFeature==='save',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('魔導を選ぶ');r=await s.ask('選んでない方は？');
  check('three-candidate remainder is not mistaken for singular other side',!(r.data&&r.data.siteComparisonOtherCandidateRecall)&&r.data&&r.data.siteItems.join(',')==='kishin,tsukumo',r);

  s=session();await s.ask('九十九と魔導結晶、首に反映したいならどっち？');await s.ask('それでお願い');await s.ask('何と何を比べてた？');r=await s.ask('理由は？');
  check('reason remains available after pair recall',r.data&&r.data.siteComparisonReason&&r.data.siteItem==='mado'&&/首/.test(r.answer||''),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('やっぱり決めるのやめる');r=await s.ask('候補は何だった？');
  check('cancelled comparison does not revive candidates',!(r.data&&r.data.siteComparisonCandidateRecall),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('今日は別の話をしよう');r=await s.ask('何と何を比べてた？');
  check('topic switch expires candidate recall',!(r.data&&r.data.siteComparisonCandidateRecall),r);

  r=await session().ask('候補は何だった？');check('no comparison does not activate candidate recall',!(r.data&&r.data.siteComparisonCandidateRecall),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('何と何を比べてた？');r=await s.ask('文曲の輝光');
  check('candidate recall does not block monkyoku deep link',r.data&&r.data.siteItem==='seikai'&&r.links.length===1&&/stone=26#monkyoku/.test(decodeURIComponent(r.links[0].url||'')),r);

  console.log(`COMPARISON CANDIDATE RECALL: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
