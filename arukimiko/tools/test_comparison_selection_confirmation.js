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
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');r=await s.ask('それでお願い');
  check('natural confirmation keeps selected item',r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='tsukumo'&&r.data.selectedSiteItem==='tsukumo',r);
  check('natural confirmation returns exact selected link',r.links.length===1&&hasLink(r,'九十九.html'),r);
  r=await s.ask('それを開いて');check('confirmed choice supports deictic open',r.data&&r.data.siteExactLinkOpen&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('鬼神石と九十九、合成最低発現数を見るならどっち？');r=await s.ask('じゃあそれにする');
  check('that one confirmation keeps kishin',r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と魔導結晶、首に反映したいならどっち？');await s.ask('なんで？');r=await s.ask('そっちでお願い');
  check('confirmation after reason keeps mado',r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='mado'&&hasLink(r,'魔導結晶.html'),r);
  r=await s.ask('理由は？');check('reason remains available after confirmation',r.data&&r.data.siteComparisonReason&&r.data.siteItem==='mado'&&/首/.test(r.answer||''),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('能力計算なら？');r=await s.ask('おすすめの方で');
  check('confirmation follows shorthand selection',r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('九十九と鬼神石を画像で保存したい');r=await s.ask('それでお願い');
  check('shared goal confirmation does not guess',r.data&&r.data.siteComparisonSelectionConfirmationNeedsChoice&&r.data.needsClarification&&r.links.length===2&&!r.data.siteItem,r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('おすすめの方で');
  check('unselected plain comparison does not guess',r.data&&r.data.siteComparisonSelectionConfirmationNeedsChoice&&r.links.length===2&&!r.data.siteItem,r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('なるほど');r=await s.ask('それがいい');
  check('one acknowledgement preserves selected confirmation',r.data&&r.data.siteComparisonSelectionConfirmed&&r.data.siteItem==='tsukumo',r);

  r=await session().ask('それでお願い');
  check('no comparison does not activate confirmation',!(r.data&&r.data.siteComparisonSelectionConfirmation),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('今日は別の話をしよう');r=await s.ask('それにする');
  check('topic switch expires selection confirmation',!(r.data&&r.data.siteComparisonSelectionConfirmation),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('どれでもない');r=await s.ask('それでお願い');
  check('candidate rejection clears selection confirmation',!(r.data&&r.data.siteComparisonSelectionConfirmation),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');r=await s.ask('それで何が分かる？');
  check('detail question is not mistaken for confirmation',!(r.data&&r.data.siteComparisonSelectionConfirmation),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');r=await s.ask('文曲の輝光');
  check('selected comparison does not block monkyoku deep link',r.data&&r.data.siteItem==='seikai'&&r.links.length===1&&/stone=26#monkyoku/.test(decodeURIComponent(r.links[0].url||'')),r);

  console.log(`COMPARISON SELECTION CONFIRMATION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
