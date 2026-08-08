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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteLinkSelection:!!d.siteLinkSelection,siteLinkSelectionCount:d.siteLinkSelectionCount||0,siteExactLinkRecall:!!d.siteExactLinkRecall,siteGuideContextCleared:!!d.siteGuideContextCleared,candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function labels(r){return (r.links||[]).map(x=>String(x.label||'')).join(',');}
(async()=>{
  let s=session(),r;await s.ask('8個選んで合計を見たい');r=await s.ask('真ん中のURLだけ');
  check('middle link only',r.data&&r.data.siteLinkSelection&&r.links.length===1&&/九十九/.test(labels(r))&&r.data.selectedSiteItem==='tsukumo',r);
  r=await s.ask('次の');check('candidate context survives single link selection',r.data&&r.data.siteItem==='mado',r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('2番目のリンク');
  check('ordinal link only',r.links.length===1&&/九十九/.test(labels(r)),r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('上から2つのリンク');
  check('first two links',r.data&&r.data.siteLinkSelectionCount===2&&r.links.length===2&&/鬼神石/.test(labels(r))&&/九十九/.test(labels(r)),r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('下から2つのURL');
  check('last two links',r.links.length===2&&/九十九/.test(labels(r))&&/魔導結晶/.test(labels(r)),r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('鬼神石と魔導のリンク');
  check('named two links',r.links.length===2&&/鬼神石/.test(labels(r))&&/魔導結晶/.test(labels(r))&&!/九十九/.test(labels(r)),r);

  s=session();await s.ask('保存できる計算機どれ');r=await s.ask('最後のリンクだけ');
  check('last calculator link',r.links.length===1&&/家臣計算機/.test(labels(r))&&r.data.selectedSiteItem==='retainer',r);

  s=session();await s.ask('計算したい');await s.ask('どれでもない');r=await s.ask('2番目のリンク');
  check('rejected context does not select old link',!(r.data&&r.data.siteLinkSelection),r);

  r=await session().ask('2番目のリンク');check('no-history selection is not hijacked',!(r.data&&r.data.siteLinkSelection),r);

  console.log(`SELECTIVE LINK RECALL: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
