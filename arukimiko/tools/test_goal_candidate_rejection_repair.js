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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteCandidateRejected:!!d.siteCandidateRejected,siteCandidateCancelled:!!d.siteCandidateCancelled,siteGuideContextCleared:!!d.siteGuideContextCleared,rejectedSiteCandidates:d.rejectedSiteCandidates||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
(async()=>{
  let s=session(),r=await s.ask('計算したい');
  r=await s.ask('どれでもない');check('reject all candidates',r.data&&r.data.siteCandidateRejected&&r.data.siteGuideContextCleared&&r.data.needsClarification&&r.links.length===0,r);
  r=await s.ask('文曲の輝光');check('fresh correction reaches monkyoku deep link',r.data&&r.data.siteItem==='seikai'&&r.links.length===1&&/stone=26#monkyoku/.test(r.links[0].url||''),r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('その中にない');
  check('reject material candidates',r.data&&r.data.rejectedSiteCandidates.join(',')==='kishin,tsukumo,mado',r);
  r=await s.ask('保存できる計算機どれ');check('new goal is not contaminated',r.data&&r.data.siteCandidates.join(',')==='stats,retainer',r);

  s=session();await s.ask('カウンターの次どれ');await s.ask('全部違う');
  r=await s.ask('足利義昭のカウンター');check('specialist knowledge survives rejection',r.mode==='たいらの野望専用知識'&&/157/.test(r.answer||''),r);

  s=session();await s.ask('計算したい');r=await s.ask('候補選びやめる');
  check('candidate selection can be cancelled',r.data&&r.data.siteCandidateCancelled&&!r.data.needsClarification,r);
  r=await s.ask('それ開いて');check('cancelled candidates are not reopened',!(r.data&&r.data.selectedSiteItem)&&!(r.data&&Array.isArray(r.data.siteCandidates)&&r.data.siteCandidates.length),r);

  s=session();await s.ask('計算したい');r=await s.ask('そうじゃない、家臣計算');
  check('explicit correction is not swallowed by rejection',r.data&&r.data.siteItem==='retainer'&&!r.data.siteCandidateRejected,r);

  r=await session().ask('どれでもない');check('rejection without candidates is not hijacked',!(r.data&&r.data.siteCandidateRejected),r);

  console.log(`GOAL CANDIDATE REJECTION REPAIR: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
