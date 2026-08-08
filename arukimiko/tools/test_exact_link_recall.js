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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteRepeatedLinks:!!d.siteRepeatedLinks,siteExactLinkRecall:!!d.siteExactLinkRecall,siteGuideContextCleared:!!d.siteGuideContextCleared,siteCandidateRejected:!!d.siteCandidateRejected,candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function monkyoku(r){return !!(r&&r.links&&r.links.length===1&&/seikai\.html\?stone=26#monkyoku/.test(r.links[0].url||''));}
(async()=>{
  let s=session(),r=await s.ask('文曲の輝光');check('initial monkyoku deep link',monkyoku(r),r);
  r=await s.ask('URLだけ');check('exact deep link recalled',monkyoku(r)&&r.data.siteRepeatedLinks&&r.data.siteExactLinkRecall,r);
  r=await s.ask('リンクもう一回');check('recalled link can be repeated again',monkyoku(r)&&r.data.siteRepeatedLinks,r);

  s=session();await s.ask('8個選んで合計を見たい');r=await s.ask('リンクもう一回');
  check('all candidate links recalled',r.data&&r.data.siteRepeatedLinks&&r.links.length===3&&r.data.siteCandidates.join(',')==='kishin,tsukumo,mado',r);
  r=await s.ask('真ん中');check('candidate context survives repeated links',r.data&&r.data.siteItem==='tsukumo',r);
  r=await s.ask('そのリンク貼って');check('selected exact link recalled',r.data&&r.data.siteRepeatedLinks&&r.links.length===1&&/九十九/.test(r.links[0].label||''),r);

  s=session();await s.ask('計算したい');await s.ask('どれでもない');r=await s.ask('さっきのリンク');
  check('rejected context does not revive old links',!(r.data&&r.data.siteRepeatedLinks),r);

  r=await session().ask('URLだけ');check('no-history link request is not hijacked',!(r.data&&r.data.siteRepeatedLinks),r);

  console.log(`EXACT LINK RECALL: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
