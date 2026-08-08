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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],selectedSiteItem:d.selectedSiteItem||'',previousSelectedSiteItem:d.previousSelectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared,siteLinkMissRecovery:!!d.siteLinkMissRecovery,siteLinkMissNeedsSelection:!!d.siteLinkMissNeedsSelection,siteLinkMissRejectedItem:d.siteLinkMissRejectedItem||'',siteLinkMissSelectionResolved:!!d.siteLinkMissSelectionResolved,siteLinkMissSelectionUnresolved:!!d.siteLinkMissSelectionUnresolved,siteGuideConversationReturn:!!d.siteGuideConversationReturn,siteGuideReturnFromPause:!!d.siteGuideReturnFromPause,siteGuidePauseTurns:Number(d.siteGuidePauseTurns||0),stoneName:d.stoneName||'',stoneId:d.stoneId||0}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function monkyoku(r){return !!(r&&r.links||[]).some(x=>/seikai\.html\?stone=26#monkyoku/.test(decodeURIComponent(String(x.url||''))));}

(async()=>{
  let s=session(),r;
  await s.ask('九十九と鬼神石の違いは？');r=await s.ask('ここじゃなかった');
  check('multiple wrong-link prompt waits for the opened page',r.data&&r.data.siteLinkMissNeedsSelection&&r.links.length===2,r);
  r=await s.ask('上の方');
  check('upper page is understood as the rejected page',r.data&&r.data.siteLinkMissSelectionResolved&&r.data.siteLinkMissRejectedItem==='kishin',r);
  check('two-page miss guides to the remaining page only',r.data&&r.data.siteItem==='tsukumo'&&r.links.length===1&&hasLink(r,'九十九.html')&&!hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('ここじゃなかった');r=await s.ask('さっきの二つ目');
  check('natural second wording rejects the second link',r.data&&r.data.siteLinkMissRejectedItem==='tsukumo'&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('鬼神石と九十九と魔導結晶の違いは？');await s.ask('ここじゃなかった');r=await s.ask('開いたのは真ん中のページ');
  check('middle opened page is removed from three links',r.data&&r.data.siteLinkMissRejectedItem==='tsukumo'&&r.data.siteCandidates.join(',')==='kishin,mado',r);
  check('remaining links exclude the rejected middle page',r.links.length===2&&hasLink(r,'鬼神石.html')&&hasLink(r,'魔導結晶.html')&&!hasLink(r,'九十九.html'),r);
  r=await s.ask('下の');
  check('remaining candidates stay naturally selectable',r.data&&r.data.siteItem==='mado'&&hasLink(r,'魔導結晶.html'),r);

  s=session();await s.ask('鬼神石と九十九と魔導結晶の違いは？');await s.ask('ここじゃなかった');r=await s.ask('鬼神石の方');
  check('wrong page can be identified by name',r.data&&r.data.siteLinkMissRejectedItem==='kishin'&&r.data.siteCandidates.join(',')==='tsukumo,mado',r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('ここじゃなかった');r=await s.ask('それ');
  check('ambiguous pronoun asks again instead of guessing',r.data&&r.data.siteLinkMissSelectionUnresolved&&r.data.siteLinkMissNeedsSelection&&r.links.length===2,r);
  r=await s.ask('3番目');
  check('out-of-range position also asks again safely',r.data&&r.data.siteLinkMissSelectionUnresolved&&r.links.length===2,r);
  r=await session().ask('上の方');
  check('position wording without link-miss context is not fabricated',!(r.data&&r.data.siteLinkMissSelectionResolved),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('ほんとに暑い');await s.ask('元気？');r=await s.ask('さっき案内してたやつに戻って');
  check('explicit guide return works after three smalltalk turns',r.data&&r.data.siteGuideConversationReturn&&r.data.siteGuideReturnFromPause&&r.data.siteGuidePauseTurns===3,r);
  check('long-return stone destination remains exact',r.data&&r.data.stoneName==='文曲'&&monkyoku(r),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('今日は暑いね');await s.ask('そうだね');r=await s.ask('サイトの話に戻して');
  check('natural site-return wording restores the comparison',r.data&&r.data.siteGuideConversationReturn&&r.data.siteGuidePauseTurns===2&&r.data.siteComparison.length===2,r);
  check('returned comparison restores both links',r.links.length===2&&hasLink(r,'九十九.html')&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('ほんとに暑い');await s.ask('元気？');await s.ask('ありがとう');r=await s.ask('案内に戻って');
  check('guide older than the three-turn limit is not revived',!(r.data&&r.data.siteGuideConversationReturn),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('どれでもない');await s.ask('今日は暑いね');r=await s.ask('案内に戻って');
  check('cleared guide is not revived after smalltalk',!(r.data&&r.data.siteGuideConversationReturn),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('足利義昭のカウンターは？');r=await s.ask('サイトの話に戻して');
  check('a substantive specialist branch is not treated as smalltalk pause',!(r.data&&r.data.siteGuideConversationReturn),r);
  r=await session().ask('さっき案内してたやつに戻って');
  check('guide-return wording without history does not invent a page',!(r.data&&r.data.siteGuideConversationReturn),r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku deep link remains exact',r.data&&r.data.siteItem==='seikai'&&monkyoku(r),r);

  console.log(`LINK-MISS POSITION LONG RETURN: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
