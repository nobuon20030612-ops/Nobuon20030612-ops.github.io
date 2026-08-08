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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteFeatures:d.siteFeatures||[],siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],siteExcludedItems:d.siteExcludedItems||[],siteConditions:d.siteConditions||[],selectedSiteItem:d.selectedSiteItem||'',previousSelectedSiteItem:d.previousSelectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared,siteGuideConversationReturn:!!d.siteGuideConversationReturn,siteGuideReturnFromPause:!!d.siteGuideReturnFromPause,siteGuidePauseTurns:Number(d.siteGuidePauseTurns||0),siteGuideReturnWithGoal:!!d.siteGuideReturnWithGoal,siteGuideReturnTarget:d.siteGuideReturnTarget||'',siteOpenAndFeature:!!d.siteOpenAndFeature,sitePreviousCandidateRestored:!!d.sitePreviousCandidateRestored,sitePreviousCandidateNeedsSelection:!!d.sitePreviousCandidateNeedsSelection,siteExactLinkOpen:!!d.siteExactLinkOpen,stoneName:d.stoneName||'',stoneId:d.stoneId||0}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function ids(v){return Array.isArray(v)?v.join(','):'';}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}

(async()=>{
  let s=session(),r;

  await s.ask('文曲の輝光');await s.ask('今日は暑いね');
  r=await s.ask('続きやろう、鬼神石を開いて、入手も教えて');
  check('restart plus target plus feature handled together',r.data&&r.data.siteGuideReturnWithGoal&&r.data.siteGuideReturnFromPause&&r.data.siteOpenAndFeature,r);
  check('three-part request prioritizes explicit new target',r.data&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns',r);
  check('three-part acquisition answer is grounded in acquisition column',/入手/.test(r.answer||'')&&/入手先/.test(r.answer||''),r);
  check('three-part request supplies only explicit target link',r.links.length===1&&hasLink(r,'鬼神石.html')&&!stone(r,26,'monkyoku'),r);

  s=session();await s.ask('九十九');await s.ask('今日は暑いね');
  r=await s.ask('また始めよう、魔導結晶を開いて、使い方も教えて');
  check('start-again wording can carry a new target and help request',r.data&&r.data.siteGuideReturnWithGoal&&r.data.siteItem==='mado'&&r.data.siteOpenAndFeature,r);
  check('new target does not revive old tsukumo',r.links.length===1&&hasLink(r,'魔導結晶.html')&&!hasLink(r,'九十九.html'),r);

  s=session();await s.ask('鬼神石');await s.ask('今日は暑いね');
  r=await s.ask('休憩終わり、九十九を開いて、保存方法も教えて');
  check('break-finished wording resumes and performs requested action',r.data&&r.data.siteGuideReturnWithGoal&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save'&&r.data.siteOpenAndFeature,r);

  r=await session().ask('休憩終わり、魔導結晶を開いて、使い方も教えて');
  check('same compound wording without paused history still honors explicit site request',r.data&&r.data.siteItem==='mado'&&r.data.siteOpenAndFeature&&!(r.data&&r.data.siteGuideConversationReturn),r);

  s=session();r=await s.ask('何か計算したい');
  check('multi-candidate calculation entry exposes four candidates',r.data&&ids(r.data.siteCandidates)==='stats,retainer,shichisei,food',r);
  await s.ask('2番目');await s.ask('次の候補');
  r=await s.ask('そっちじゃなくて、前に見ていた方');
  check('previous-view wording restores actual prior viewed candidate',r.data&&r.data.sitePreviousCandidateRestored&&r.data.siteItem==='retainer'&&r.data.selectedSiteItem==='retainer',r);
  check('previous-view restoration records the replaced current candidate',r.data&&r.data.previousSelectedSiteItem==='shichisei',r);
  check('previous-view restoration preserves original candidate set',r.data&&ids(r.data.siteCandidates)==='stats,retainer,shichisei,food',r);
  check('previous-view restoration only links restored page',r.links.length===1&&hasLink(r,'家臣計算機.html'),r);

  s=session();await s.ask('何か計算したい');await s.ask('2番目');
  r=await s.ask('そっちじゃなくて、前に見ていた方');
  check('ambiguous previous-view wording never invents a page',r.data&&r.data.sitePreviousCandidateNeedsSelection&&r.data.needsClarification&&!r.data.siteItem,r);
  check('ambiguous previous-view wording excludes current page',r.data&&ids(r.data.siteCandidates)==='stats,shichisei,food'&&!hasLink(r,'家臣計算機.html'),r);
  check('ambiguous previous-view wording offers all remaining safe candidates',r.links.length===3&&hasLink(r,'能力計算機.html')&&hasLink(r,'shichiseitensei.html')&&hasLink(r,'shokuryou.html'),r);

  s=session();await s.ask('何か計算したい');await s.ask('2番目');await s.ask('次の候補');
  r=await s.ask('そっちじゃなくて、前に見ていた方の保存方法は？');
  check('previous-view correction can carry feature question',r.data&&r.data.sitePreviousCandidateRestored&&r.data.siteItem==='retainer'&&r.data.siteFeature==='save',r);
  check('feature follows restored page only',r.links.length===1&&hasLink(r,'家臣計算機.html')&&/保存/.test(r.answer||''),r);

  s=session();
  await s.ask('文曲の輝光');
  await s.ask('今日は暑いね');
  r=await s.ask('続きやろう、鬼神石を開いて、入手も教えて');
  check('long alternating flow switches first goal to kishin',r.data&&r.data.siteItem==='kishin',r);
  await s.ask('そういえば今日眠い');
  r=await s.ask('また始めよう');
  check('long alternating flow resumes most recent kishin goal',r.data&&r.data.siteGuideConversationReturn&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);
  await s.ask('ところで何食べようかな');
  r=await s.ask('じゃあ九十九を開いて、保存方法も');
  check('explicit tsukumo target replaces resumed kishin goal',r.data&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save'&&r.data.siteOpenAndFeature,r);
  await s.ask('ありがとう');
  r=await s.ask('続きやろう');
  check('later restart resumes latest explicit tsukumo goal',r.data&&r.data.siteGuideConversationReturn&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);
  r=await s.ask('文曲の輝光');
  check('explicit stone request still overrides long conversation context',r.data&&r.data.siteItem==='seikai'&&r.data.stoneName==='文曲'&&stone(r,26,'monkyoku'),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('そうだね');await s.ask('元気？');await s.ask('ありがとう');r=await s.ask('続きやろう');
  check('old guide still expires after a long uninterrupted smalltalk pause',!(r.data&&r.data.siteGuideConversationReturn)&&r.mode==='日常会話',r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku exact deep link remains unchanged',r.data&&r.data.siteItem==='seikai'&&r.data.stoneName==='文曲'&&stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AA MULTITURN NATURAL NAVIGATION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
