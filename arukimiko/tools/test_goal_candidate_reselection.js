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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',selectedSiteItem:d.selectedSiteItem||'',previousSelectedSiteItem:d.previousSelectedSiteItem||'',candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],needsClarification:!!d.needsClarification}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function selected(r,id){return !!(r&&r.data&&r.data.siteItem===id&&r.data.selectedSiteItem===id&&r.links&&r.links.length===1);}
(async()=>{
  let s=session(),r=await s.ask('保存できる計算機どれ');
  r=await s.ask('上の');check('first choice retains pair',selected(r,'stats')&&r.data.siteCandidates.join(',')==='stats,retainer',r);
  r=await s.ask('やっぱり別の');check('natural alternative selects other',selected(r,'retainer'),r);
  r=await s.ask('さっきの方');check('previous choice restores stats',selected(r,'stats'),r);
  r=await s.ask('もう片方にして');check('other side can be selected again',selected(r,'retainer'),r);

  s=session();await s.ask('8個選んで合計を見たい');
  r=await s.ask('真ん中');check('three-way choice retains original candidates',selected(r,'tsukumo')&&r.data.siteCandidates.join(',')==='kishin,tsukumo,mado',r);
  r=await s.ask('やっぱ別の');check('ambiguous alternative asks remaining two',r&&r.data&&r.data.needsClarification&&r.data.siteCandidates.join(',')==='kishin,mado'&&r.links.length===2,r);
  r=await s.ask('下の');check('remaining candidate can be selected',selected(r,'mado'),r);

  s=session();await s.ask('8個選んで合計を見たい');await s.ask('上の');
  r=await s.ask('今日は別の話しよう');
  r=await s.ask('やっぱり別の');check('unrelated topic expires candidate correction',!(r&&r.data&&r.data.selectedSiteItem),r);

  console.log(`GOAL CANDIDATE RESELECTION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
