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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',selectedSiteItem:d.selectedSiteItem||'',candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteCandidateRelativeMove:!!d.siteCandidateRelativeMove,siteCandidateBoundary:!!d.siteCandidateBoundary,siteCandidateDirection:d.siteCandidateDirection||'',siteCandidateStep:d.siteCandidateStep||0}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function selected(r,id){return !!(r&&r.data&&r.data.siteItem===id&&r.data.selectedSiteItem===id);}
(async()=>{
  let s=session(),r;await s.ask('8個選んで合計を見たい');await s.ask('真ん中');
  r=await s.ask('次の');check('next from middle selects mado',selected(r,'mado')&&r.data.siteCandidateRelativeMove,r);
  r=await s.ask('前の候補');check('previous returns tsukumo',selected(r,'tsukumo')&&r.data.siteCandidateDirection==='previous',r);
  r=await s.ask('一つ上');check('one up selects kishin',selected(r,'kishin'),r);
  r=await s.ask('2つ先');check('two ahead selects mado',selected(r,'mado')&&r.data.siteCandidateStep===2,r);
  r=await s.ask('その次');check('next boundary stays at last',selected(r,'mado')&&r.data.siteCandidateBoundary&&/最後の候補/.test(r.answer||'')&&r.links.length===0,r);
  r=await s.ask('前のは保存できる？');check('relative feature targets tsukumo',selected(r,'tsukumo')&&r.data.siteFeature==='save'&&/画像として保存/.test(r.answer||''),r);

  s=session();await s.ask('計算したい');await s.ask('上の');
  r=await s.ask('2つ下');check('two down in four choices selects shichisei',selected(r,'shichisei'),r);
  r=await s.ask('一つ前');check('one previous is ordinal, not selection history',selected(r,'retainer')&&r.data.siteCandidateRelativeMove,r);

  console.log(`GOAL CANDIDATE RELATIVE NAVIGATION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
