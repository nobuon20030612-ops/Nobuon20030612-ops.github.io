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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',selectedSiteItem:d.selectedSiteItem||'',candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],siteItems:d.siteItems||[],needsClarification:!!d.needsClarification}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
(async()=>{
  let s=session(),r=await s.ask('8個選んで合計を見たい');
  check('three goal candidates',r.data&&r.data.candidates.join(',')==='kishin,tsukumo,mado',r);
  r=await s.ask('真ん中');check('middle selects tsukumo',r.data&&r.data.siteItem==='tsukumo',r);
  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('上から2番目');check('second from top',r.data&&r.data.siteItem==='tsukumo',r);
  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('下から2番目');check('second from bottom',r.data&&r.data.siteItem==='tsukumo',r);
  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('上から2つ開いて');check('first two open',r.data&&r.data.siteOpenedItems.join(',')==='kishin,tsukumo'&&r.links.length===2,r);
  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('下から2つ開いて');check('last two open',r.data&&r.data.siteOpenedItems.join(',')==='tsukumo,mado'&&r.links.length===2,r);
  s=session();await s.ask('保存できる計算機どれ');r=await s.ask('下の');check('lower calculator',r.data&&r.data.siteItem==='retainer',r);
  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('全部開いて');check('open all',r.data&&r.data.siteOpenedItems.length===3&&r.links.length===3,r);
  console.log(`GOAL CANDIDATE NATURAL SELECTION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
