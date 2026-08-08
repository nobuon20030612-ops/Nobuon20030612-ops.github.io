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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],selectedSiteItem:d.selectedSiteItem||'',previousSelectedSiteItem:d.previousSelectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared,siteVagueCapability:d.siteVagueCapability||'',siteVagueCapabilityClarification:!!d.siteVagueCapabilityClarification,siteVagueCapabilityFollowup:!!d.siteVagueCapabilityFollowup,siteVagueCapabilityRevision:!!d.siteVagueCapabilityRevision,siteVagueCapabilityCancelled:!!d.siteVagueCapabilityCancelled,firstComparisonItem:d.firstComparisonItem||''}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function monkyoku(r){return !!(r&&r.links||[]).some(x=>/seikai\.html\?stone=26#monkyoku/.test(decodeURIComponent(String(x.url||''))));}

(async()=>{
  let s=session(),r;
  r=await s.ask('検索できるの');
  check('vague search asks what the user wants to find',r.data&&r.data.siteVagueCapability==='search'&&r.data.siteVagueCapabilityClarification&&r.data.needsClarification,r);
  check('search answer only offers verified local destinations',r.links.length===6&&hasLink(r,'陣法/jinpo.html')&&hasLink(r,'英傑一覧.html')&&hasLink(r,'counter.html'),r);
  r=await s.ask('編成の');
  check('short formation reply selects formation search',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='jinpo'&&hasLink(r,'陣法/jinpo.html'),r);

  s=session();await s.ask('何が探せるの');r=await s.ask('英傑の');
  check('natural find wording and short hero reply connect',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='heroes'&&hasLink(r,'英傑一覧.html'),r);
  s=session();await s.ask('検索できるの');r=await s.ask('カウンター');
  check('counter can be selected from vague search',r.data&&r.data.siteItem==='counter'&&hasLink(r,'counter.html'),r);

  s=session();r=await s.ask('使い方教えて');
  check('broad usage question asks for a starting purpose',r.data&&r.data.siteVagueCapability==='use'&&r.data.siteVagueCapabilityClarification&&r.links.length===8,r);
  r=await s.ask('家臣の');
  check('short retainer purpose selects retainer usage',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='retainer'&&hasLink(r,'家臣計算機.html'),r);
  r=await session().ask('どこから開くの');
  check('where-to-open wording gets concrete starting links',r.data&&r.data.siteVagueCapability==='use'&&r.data.needsClarification&&r.links.length===8,r);
  r=await session().ask('何から始めるの');
  check('where-to-start wording gets the same natural clarification',r.data&&r.data.siteVagueCapability==='use'&&r.data.siteVagueCapabilityClarification,r);
  s=session();await s.ask('九十九');r=await s.ask('どう使うの');
  check('fresh page context receives page-specific usage instead of broad takeover',r.data&&r.data.siteItem==='tsukumo'&&!(r.data&&r.data.siteVagueCapabilityClarification)&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('計算できるの');r=await s.ask('家臣の');
  check('selected vague result retains only lightweight original-choice memory',r.data&&r.data.siteItem==='retainer'&&Array.isArray(r.data.siteSourceCandidates)&&r.data.siteSourceCandidates.length===7&&(!Array.isArray(r.data.siteCandidates)||!r.data.siteCandidates.length),r);
  r=await s.ask('いや自分の');
  check('correction switches retainer to own ability calculation',r.data&&r.data.siteVagueCapabilityRevision&&r.data.previousSelectedSiteItem==='retainer'&&r.data.siteItem==='stats'&&hasLink(r,'能力計算機.html'),r);

  s=session();await s.ask('一覧あるの');await s.ask('英傑の');r=await s.ask('やっぱり九十九の');
  check('natural reselection switches hero list to tsukumo',r.data&&r.data.siteVagueCapabilityRevision&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);
  r=await s.ask('いや鬼神石の');
  check('reselection can be corrected repeatedly',r.data&&r.data.siteVagueCapabilityRevision&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('一覧あるの');await s.ask('英傑の');await s.ask('なるほど');r=await s.ask('やっぱり九十九の');
  check('one acknowledgement preserves selected vague result for correction',r.data&&r.data.siteVagueCapabilityRevision&&r.data.siteItem==='tsukumo',r);
  s=session();await s.ask('一覧あるの');await s.ask('英傑の');await s.ask('今日は暑いね');r=await s.ask('やっぱり九十九の');
  check('unrelated smalltalk expires selected-result correction',!(r.data&&r.data.siteVagueCapabilityRevision),r);

  s=session();await s.ask('計算できるの');await s.ask('家臣の');r=await s.ask('それじゃない');
  check('that-is-not-it returns all remaining original choices',r.data&&r.data.siteVagueCapabilityRevision&&r.data.siteVagueCapabilityClarification&&r.data.siteCandidates.length===6&&!r.data.siteCandidates.includes('retainer')&&r.data.siteSourceCandidates.length===7,r);
  check('remaining choices include own ability and do not reopen selected link',hasLink(r,'能力計算機.html')&&!hasLink(r,'家臣計算機.html'),r);
  r=await s.ask('自分の');
  check('short reply selects from revised remaining choices',r.data&&r.data.siteItem==='stats'&&r.data.siteVagueCapabilityFollowup&&hasLink(r,'能力計算機.html'),r);

  s=session();await s.ask('一覧あるの');await s.ask('英傑の');r=await s.ask('別のは？');
  check('another-one wording offers the five non-selected list choices',r.data&&r.data.siteVagueCapabilityRevision&&r.data.siteCandidates.length===5&&!r.data.siteCandidates.includes('heroes'),r);
  r=await s.ask('九十九の');
  check('revised list choice accepts natural possessive reply',r.data&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('一覧あるの');await s.ask('英傑の');r=await s.ask('どれでもない');
  check('none-of-these explicitly clears vague choice context',r.data&&r.data.siteGuideContextCleared&&r.data.siteVagueCapabilityCancelled&&r.data.siteItem==='__site_guide_context_cleared__'&&r.links.length===0,r);
  r=await s.ask('別のは？');
  check('cleared vague choices do not revive',!(r.data&&r.data.siteVagueCapabilityRevision),r);

  s=session();await s.ask('一覧あるの');await s.ask('英傑の');r=await s.ask('いや文曲の輝光');
  check('unlisted exact stone correction routes to exact stone instead of stale vague choices',r.data&&r.data.siteItem==='seikai'&&monkyoku(r),r);
  r=await session().ask('文曲の輝光');
  check('exact monkyoku deep link remains protected',r.data&&r.data.siteItem==='seikai'&&monkyoku(r),r);

  console.log(`VAGUE OPERATION REVISION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
