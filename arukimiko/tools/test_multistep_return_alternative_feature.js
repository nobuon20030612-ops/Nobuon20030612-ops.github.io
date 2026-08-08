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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteFeatures:d.siteFeatures||[],siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],selectedSiteItem:d.selectedSiteItem||'',previousSelectedSiteItem:d.previousSelectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared,siteGuideConversationReturn:!!d.siteGuideConversationReturn,siteGuideReturnFromPause:!!d.siteGuideReturnFromPause,siteGuidePauseTurns:Number(d.siteGuidePauseTurns||0),siteGuideReturnWithGoal:!!d.siteGuideReturnWithGoal,siteGuideReturnTarget:d.siteGuideReturnTarget||'',siteOpenAndFeature:!!d.siteOpenAndFeature,siteComparisonAlternativeFeature:!!d.siteComparisonAlternativeFeature,siteComparisonAlternativeFeatureNeedsSelection:!!d.siteComparisonAlternativeFeatureNeedsSelection,siteComparisonSelectionRevised:!!d.siteComparisonSelectionRevised,siteExactLinkOpen:!!d.siteExactLinkOpen,stoneName:d.stoneName||'',stoneId:d.stoneId||0}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function ids(value){return Array.isArray(value)?value.join(','):'';}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}

(async()=>{
  let s=session(),r;
  await s.ask('文曲の輝光');await s.ask('今日は暑いね');r=await s.ask('案内に戻って、九十九を開いて、保存方法も教えて');
  check('compound return handles open and feature in one response',r.data&&r.data.siteGuideReturnWithGoal&&r.data.siteOpenAndFeature&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);
  check('open-and-save response states both requested actions',/九十九.*開ける/.test(r.answer||'')&&/保存/.test(r.answer||''),r);
  check('open-and-save response supplies only tsukumo',r.links.length===1&&hasLink(r,'九十九.html')&&!stone(r,26,'monkyoku'),r);
  r=await s.ask('それを開いて');
  check('deictic open continues from the compound target',r.data&&r.data.siteExactLinkOpen&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('鬼神石');await s.ask('今日は暑いね');r=await s.ask('案内に戻って、魔導結晶を開いて、使い方も教えて');
  check('explicit new page overrides the pre-smalltalk page',r.data&&r.data.siteOpenAndFeature&&r.data.siteItem==='mado'&&!r.data.needsClarification,r);
  check('explicit new page help never revives kishin',r.links.length===1&&hasLink(r,'魔導結晶.html')&&!hasLink(r,'鬼神石.html')&&/魔導結晶/.test(r.answer||''),r);

  r=await session().ask('鬼神石を開いて、保存方法も教えて');
  check('direct open-and-feature request works without return history',r.data&&r.data.siteOpenAndFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&hasLink(r,'鬼神石.html'),r);
  r=await session().ask('魔導結晶を開いて、使い方も教えて');
  check('direct open-and-help request describes the named page',r.data&&r.data.siteOpenAndFeature&&r.data.siteItem==='mado'&&hasLink(r,'魔導結晶.html'),r);
  s=session();await s.ask('鬼神石を開いて');r=await s.ask('魔導結晶を開いて、使い方も教えて');
  check('named page in a two-step request overrides immediate page context',r.data&&r.data.siteItem==='mado'&&r.links.length===1&&!hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('二つ目を開いて');r=await s.ask('それじゃなくて、もう片方の保存は？');
  check('correction plus feature switches to the other candidate',r.data&&r.data.siteComparisonAlternativeFeature&&r.data.siteComparisonSelectionRevised&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('correction records old and new selections',r.data&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.selectedSiteItem==='kishin'&&ids(r.data.siteComparison)==='kishin,tsukumo',r);
  check('correction supplies only the other candidate link',r.links.length===1&&hasLink(r,'鬼神石.html')&&!hasLink(r,'九十九.html'),r);
  r=await s.ask('それを開いて');
  check('deictic open follows the corrected candidate',r.data&&r.data.siteExactLinkOpen&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('能力計算ならどっち？');r=await s.ask('やっぱりもう片方の使い方を教えて');
  check('other-candidate help combines revision and page explanation',r.data&&r.data.siteComparisonAlternativeFeature&&r.data.siteItem==='kishin'&&r.data.previousSelectedSiteItem==='tsukumo'&&/使い方/.test(r.answer||''),r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('一つ目を開いて');r=await s.ask('もう一方の画像保存は？');
  check('other-candidate feature works in the reverse direction',r.data&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save'&&r.data.previousSelectedSiteItem==='kishin'&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('もう片方の保存は？');
  check('other candidate without a baseline asks which page',r.data&&r.data.siteComparisonAlternativeFeatureNeedsSelection&&r.data.needsClarification&&r.links.length===2,r);
  r=await session().ask('それじゃなくて、もう片方の保存は？');
  check('other-candidate wording without comparison history is not fabricated',!(r.data&&r.data.siteComparisonAlternativeFeature),r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('どれでもない');r=await s.ask('もう片方の保存は？');
  check('cleared comparison is not revived for other-candidate feature',!(r.data&&r.data.siteComparisonAlternativeFeature),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');r=await s.ask('続きやろう');
  check('short restart wording explicitly resumes a paused guide',r.data&&r.data.siteGuideConversationReturn&&r.data.siteGuideReturnFromPause&&r.data.siteGuidePauseTurns===1,r);
  check('short guide restart preserves the exact stone destination',r.data&&r.data.stoneName==='文曲'&&stone(r,26,'monkyoku'),r);
  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('そうだね');r=await s.ask('また始めよう');
  check('natural restart wording resumes after two smalltalk turns',r.data&&r.data.siteGuideConversationReturn&&r.data.siteGuidePauseTurns===2&&stone(r,26,'monkyoku'),r);
  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('そうだね');await s.ask('元気？');await s.ask('ありがとう');r=await s.ask('続きやろう');
  check('restart wording does not revive a guide beyond the return limit',!(r.data&&r.data.siteGuideConversationReturn)&&r.mode==='日常会話',r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('どれでもない');await s.ask('今日は暑いね');r=await s.ask('続きやろう');
  check('restart wording does not revive a cleared guide',!(r.data&&r.data.siteGuideConversationReturn)&&r.mode==='日常会話',r);

  for(const phrase of ['続きやろう','そろそろ続きやろう','また始めよう','そろそろ再開しよう','作業を再開しよう','休憩終わり']){
    r=await session().ask(phrase);
    check(`restart smalltalk stays neutral without guide context: ${phrase}`,r.mode==='日常会話'&&!(r.data&&r.data.siteGuide)&&r.links.length===0&&!(r.data&&r.data.needsClarification),r);
  }
  r=await session().ask('鬼神石を開いて');
  check('restart smalltalk expansion does not steal an explicit site request',r.data&&r.data.siteGuide&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku deep link remains exact',r.data&&r.data.siteItem==='seikai'&&r.data.stoneName==='文曲'&&stone(r,26,'monkyoku'),r);

  console.log(`MULTISTEP RETURN ALTERNATIVE FEATURE: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
