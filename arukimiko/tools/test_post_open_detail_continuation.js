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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteExactLinkOpen:!!d.siteExactLinkOpen,sitePostOpenGuidance:!!d.sitePostOpenGuidance,siteContinuedDetail:!!d.siteContinuedDetail,siteContinuedDetailNeedsSelection:!!d.siteContinuedDetailNeedsSelection,siteContinuedDetailIntent:d.siteContinuedDetailIntent||'',siteGuideContextCleared:!!d.siteGuideContextCleared,candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],selectedSiteItem:d.selectedSiteItem||'',stoneName:d.stoneName||'',needsClarification:!!d.needsClarification}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function monkyoku(r){return !!(r&&r.links&&r.links.length===1&&/stone=26#monkyoku/.test(r.links[0].url||''));}
(async()=>{
  let s=session(),r;await s.ask('文曲の輝光');await s.ask('じゃあそれ開いて');await s.ask('次は？');r=await s.ask('それで何が分かる？');
  check('monkyoku result keeps exact stone context',r.data&&r.data.siteContinuedDetail&&r.data.stoneName==='文曲'&&/生命1500、知力250/.test(r.answer||'')&&monkyoku(r),r);

  r=await s.ask('何を入力するの？');
  check('detail conversation can continue again',r.data&&r.data.siteContinuedDetail&&r.data.siteContinuedDetailIntent==='inputs'&&/数値の入力はありません/.test(r.answer||'')&&monkyoku(r),r);

  s=session();await s.ask('文曲の輝光');r=await s.ask('何を確認できる？');
  check('detail works directly after initial exact link',r.data&&r.data.siteContinuedDetail&&/必要な材料/.test(r.answer||'')&&monkyoku(r),r);

  s=session();await s.ask('家臣計算のページ開いて');await s.ask('それ開いて');await s.ask('そこで何をすればいい？');r=await s.ask('それでどんな結果が出る？');
  check('retainer result follow-up stays in context',r.data&&r.data.siteContinuedDetail&&r.data.siteItem==='retainer'&&/家臣能力.*合計/.test(r.answer||'')&&r.links.length===1,r);

  r=await s.ask('何を入力するの？');
  check('retainer input follow-up preserves exact link',r.data&&r.data.siteContinuedDetail&&r.data.siteContinuedDetailIntent==='inputs'&&/家臣の各欄へ直接入力/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('8個選んで合計を見たい');await s.ask('真ん中のリンクだけ');await s.ask('そのページお願い');await s.ask('そこで何をすればいい？');r=await s.ask('何を見れる？');
  check('selected tsukumo detail preserves candidate context',r.data&&r.data.siteContinuedDetail&&r.data.siteItem==='tsukumo'&&/選択中の8個合計/.test(r.answer||'')&&r.data.selectedSiteItem==='tsukumo'&&r.links.length===1,r);

  r=await s.ask('どこを押すの？');
  check('operation follow-up continues on same selected page',r.data&&r.data.siteContinuedDetail&&r.data.siteContinuedDetailIntent==='operation'&&/最大8個を選び/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('それで何が分かる？');
  check('multi-link detail asks without guessing',r.data&&r.data.siteContinuedDetailNeedsSelection&&r.data.needsClarification&&r.links.length===3,r);
  r=await s.ask('真ん中');check('candidate selection continues after detail clarification',r.data&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('計算したい');await s.ask('どれでもない');r=await s.ask('何が分かる？');
  check('rejection blocks stale detail context',!(r.data&&r.data.siteContinuedDetail),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は別の話しよう');r=await s.ask('何が分かる？');
  check('unrelated reply expires detail context',!(r.data&&r.data.siteContinuedDetail),r);

  r=await session().ask('それでどんな結果が出る？');check('no-history detail is not hijacked',!(r.data&&r.data.siteContinuedDetail),r);

  console.log(`POST-OPEN DETAIL CONTINUATION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
