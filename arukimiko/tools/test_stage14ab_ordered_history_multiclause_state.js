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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:d};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function ids(v){return Array.isArray(v)?v.join(','):'';}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}
(async()=>{
  let s=session(),r;

  r=await s.ask('魔導結晶の入手も、そのあと九十九の保存も教えて');
  check('multi-target feature clauses stay bound to their own targets',r.data&&r.data.siteClauseBinding&&ids(r.data.siteItems)==='mado,tsukumo'&&ids(r.data.siteFeatures)==='columns,save',r);
  check('mado acquisition clause remains acquisition',/魔導結晶：.*入手/.test(r.answer||''),r.answer);
  check('tsukumo save clause remains save',/九十九：.*保存/.test(r.answer||''),r.answer);
  check('multi-target clause answer links both requested pages only',r.links.length===2&&hasLink(r,'魔導結晶.html')&&hasLink(r,'九十九.html'),r);

  r=await session().ask('九十九の保存も、それから鬼神石の入手も教えて');
  check('cross-route reverse clause remains a two-part natural compound',r.data&&r.data.compound&&r.data.completed===2&&r.data.total===2,r);
  check('cross-route reverse clause does not leak save onto acquisition question',/九十九.*保存/.test(r.answer||'')&&/鬼神石の入手/.test(r.answer||'')&&!/鬼神石[^\n]*保存/.test(r.answer||''),r.answer);

  r=await session().ask('九十九を開いて入手を見て、それから鬼神石を開いて保存も教えて');
  check('sequential open plus feature still handles both targets',r.data&&r.data.compound&&r.data.completed===2,r);
  check('sequential open plus feature supplies both links',hasLink(r,'九十九.html')&&hasLink(r,'鬼神石.html'),r);

  r=await session().ask('九十九を開いて入手を見て、やっぱ鬼神石の保存も');
  check('inline correction still replaces superseded target instead of merging it',r.data&&r.data.siteInlineGoalRevision&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&ids(r.data.replacedSiteItems)==='tsukumo',r);
  check('inline correction returns only final target link',r.links.length===1&&hasLink(r,'鬼神石.html')&&!hasLink(r,'九十九.html'),r);

  s=session();await s.ask('何か計算したい');await s.ask('4番目');await s.ask('前の候補');await s.ask('2番目');
  r=await s.ask('その前のやつ');
  check('deictic previous-view follows actual view history, not candidate order',r.data&&r.data.siteHistoryRelativeRestore&&r.data.siteHistoryRequestedStep===1&&r.data.siteItem==='shichisei',r);
  check('history restore records replaced current selection',r.data&&r.data.previousSelectedSiteItem==='retainer',r);
  r=await s.ask('前の候補');
  check('explicit previous-candidate wording still means list position',r.data&&r.data.siteCandidateRelativeMove&&r.data.siteItem==='retainer',r);
  r=await s.ask('二つ前に見てた方');
  check('two-steps-back wording uses unique ordered view history',r.data&&r.data.siteHistoryRelativeRestore&&r.data.siteHistoryRequestedStep===2&&r.data.siteItem==='food',r);
  check('two-steps-back history return links recovered page',r.links.length===1&&hasLink(r,'shokuryou.html'),r);

  s=session();await s.ask('何か計算したい');await s.ask('2番目');
  r=await s.ask('二つ前に見てた方');
  check('insufficient two-step history never falls back to candidate position',r.data&&r.data.siteHistoryStepNeedsClarification&&r.data.needsClarification&&r.data.siteHistoryRequestedStep===2,r);
  check('insufficient history keeps current selection instead of inventing another',r.data&&r.data.siteItem==='retainer'&&r.data.selectedSiteItem==='retainer',r);

  s=session();await s.ask('鬼神石を開いて入手も教えて');await s.ask('なるほど');await s.ask('今日は暑いね');
  r=await s.ask('それどうやるの？');
  check('feature continuation survives two short smalltalk turns',r.data&&r.data.siteGuideFeatureContinuation&&r.data.siteGuideReturnFromPause&&r.data.siteGuidePauseTurns===2&&r.data.siteItem==='kishin',r);
  check('feature continuation keeps acquisition sub-aspect',r.data&&r.data.siteFeature==='columns'&&/入手/.test(r.answer||''),r.answer);
  r=await s.ask('じゃあ保存は？');
  check('new explicit feature replaces carried acquisition aspect cleanly',r.data&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&/保存/.test(r.answer||''),r);

  s=session();await s.ask('鬼神石を開いて入手も教えて');await s.ask('なるほど');
  r=await s.ask('九十九だと？');
  check('target can switch while acquisition aspect is carried separately',r.data&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns'&&/入手/.test(r.answer||''),r);
  check('carried aspect target switch links only new target',r.links.length===1&&hasLink(r,'九十九.html')&&!hasLink(r,'鬼神石.html'),r);

  r=await session().ask('魔導結晶の入手は？');
  check('standalone acquisition fact question remains on tool knowledge route',r.data&&r.data.toolKnowledge&&r.data.dataset==='madou'&&r.data.acquisition&&!r.data.siteGuide,r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku exact deep link remains unchanged',r.data&&r.data.siteItem==='seikai'&&r.data.stoneName==='文曲'&&stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AB ORDERED HISTORY / MULTICLAUSE / STATE: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
