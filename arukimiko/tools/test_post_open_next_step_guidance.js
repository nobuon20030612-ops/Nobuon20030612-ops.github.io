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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteExactLinkOpen:!!d.siteExactLinkOpen,sitePostOpenGuidance:!!d.sitePostOpenGuidance,sitePostOpenNeedsSelection:!!d.sitePostOpenNeedsSelection,siteGuideContextCleared:!!d.siteGuideContextCleared,candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],selectedSiteItem:d.selectedSiteItem||'',stoneName:d.stoneName||'',needsClarification:!!d.needsClarification}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function monkyoku(r){return !!(r&&r.links&&r.links.length===1&&/stone=26#monkyoku/.test(r.links[0].url||''));}
(async()=>{
  let s=session(),r=await s.ask('文曲の輝光');await s.ask('じゃあそれ開いて');r=await s.ask('開いたらまず何をすればいい？');
  check('monkyoku post-open guidance preserves deep link',r.data&&r.data.sitePostOpenGuidance&&r.data.stoneName==='文曲'&&/リンクを開くと.*「文曲」合成早見表/.test(r.answer||'')&&monkyoku(r),r);

  s=session();await s.ask('文曲の輝光');await s.ask('じゃあそれ開いて');r=await s.ask('次は？');
  check('short next follows monkyoku link context',r.data&&r.data.sitePostOpenGuidance&&/リンクを開くと.*「文曲」合成早見表/.test(r.answer||'')&&monkyoku(r),r);

  s=session();await s.ask('文曲の輝光');r=await s.ask('このあとどうする？');
  check('guidance works directly after initial link',r.data&&r.data.sitePostOpenGuidance&&monkyoku(r),r);

  s=session();await s.ask('家臣計算のページ開いて');await s.ask('それ開いて');r=await s.ask('開いたらどう使う？');
  check('ordinary calculator explains next operation',r.data&&r.data.sitePostOpenGuidance&&r.data.siteItem==='retainer'&&/家臣の表へ数値を入力/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('8個選んで合計を見たい');await s.ask('真ん中のリンクだけ');await s.ask('そのページお願い');r=await s.ask('そこで何をすればいい？');
  check('selected candidate keeps page-specific guidance',r.data&&r.data.sitePostOpenGuidance&&r.data.siteItem==='tsukumo'&&/最大8個を選び/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('開いたら何すればいい？');
  check('multi-link guidance asks without guessing',r.data&&r.data.sitePostOpenNeedsSelection&&r.data.needsClarification&&r.links.length===3,r);
  r=await s.ask('真ん中');check('candidate choice continues after guidance clarification',r.data&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('計算したい');await s.ask('どれでもない');r=await s.ask('次は？');
  check('rejection blocks stale next-step guidance',!(r.data&&r.data.sitePostOpenGuidance),r);

  s=session();await s.ask('文曲の輝光');await s.ask('じゃあそれ開いて');await s.ask('今日は別の話しよう');r=await s.ask('次は？');
  check('unrelated reply expires next-step context',!(r.data&&r.data.sitePostOpenGuidance),r);

  r=await session().ask('次は？');check('no-history next is not hijacked',!(r.data&&r.data.sitePostOpenGuidance),r);

  console.log(`POST-OPEN NEXT STEP GUIDANCE: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
