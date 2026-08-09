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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteLinkDestinationExplanation:!!d.siteLinkDestinationExplanation,siteLinkDestinationCount:d.siteLinkDestinationCount||0,siteLinkSelection:!!d.siteLinkSelection,siteGuideContextCleared:!!d.siteGuideContextCleared,candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
(async()=>{
  let s=session(),r=await s.ask('文曲の輝光');r=await s.ask('これどこに飛ぶ？');
  check('monkyoku destination is exact',r.data&&r.data.siteLinkDestinationExplanation&&/星海の荒石の「文曲」表示/.test(r.answer||'')&&r.links.length===1&&/stone=26#monkyoku/.test(r.links[0].url||''),r);
  r=await s.ask('リンク先は？');check('destination explanation can repeat',r.data&&r.data.siteLinkDestinationExplanation&&/「文曲」表示/.test(r.answer||''),r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('このリンク何？');
  check('multiple destinations are mapped',r.data&&r.data.siteLinkDestinationCount===3&&/鬼神石/.test(r.answer||'')&&/九十九/.test(r.answer||'')&&/魔導結晶/.test(r.answer||'')&&r.links.length===3,r);

  s=session();await s.ask('8個選んで合計を見たい');await s.ask('真ん中のリンクだけ');r=await s.ask('押したら何が開く？');
  check('selected link destination',r.data&&r.data.siteLinkDestinationCount===1&&/九十九.*ページ/.test(r.answer||'')&&r.links.length===1,r);

  s=session();await s.ask('家臣計算のページ開いて');r=await s.ask('これ何のページ？');
  check('ordinary page destination',r.data&&r.data.siteLinkDestinationExplanation&&/家臣計算機.*ページ/.test(r.answer||''),r);

  s=session();await s.ask('計算したい');await s.ask('どれでもない');r=await s.ask('リンク先は？');
  check('rejection blocks destination recall',!(r.data&&r.data.siteLinkDestinationExplanation),r);

  r=await session().ask('これどこに飛ぶ？');check('no-history destination is not hijacked',!(r.data&&r.data.siteLinkDestinationExplanation),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は別の話しよう');r=await s.ask('リンク先は？');
  check('unrelated reply expires destination context',!(r.data&&r.data.siteLinkDestinationExplanation),r);

  console.log(`LINK DESTINATION EXPLANATION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
