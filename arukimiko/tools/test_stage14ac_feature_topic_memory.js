#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
// 実UIが会話履歴へ残すサイト案内メタデータだけに絞る。
function compact(r){const d=r.data||{};if(!d.siteGuide)return d;return{siteGuide:true,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),siteFeatureSubjects:Array.isArray(d.siteFeatureSubjects)?d.siteFeatureSubjects.slice(0,8):[],siteItems:Array.isArray(d.siteItems)?d.siteItems.slice(0,8):[],siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice(0,8):[],candidates:Array.isArray(d.candidates)?d.candidates.slice(0,8):[],siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],siteSourceCandidates:Array.isArray(d.siteSourceCandidates)?d.siteSourceCandidates.slice(0,8):[],siteOpenedItems:Array.isArray(d.siteOpenedItems)?d.siteOpenedItems.slice(0,8):[],siteExcludedItems:Array.isArray(d.siteExcludedItems)?d.siteExcludedItems.slice(0,8):[],siteConditions:Array.isArray(d.siteConditions)?d.siteConditions.slice(0,12):[],selectedSiteItem:String(d.selectedSiteItem||''),previousSelectedSiteItem:String(d.previousSelectedSiteItem||''),siteGuideContextCleared:!!d.siteGuideContextCleared,needsClarification:!!d.needsClarification};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:{mode:r.mode||'',links:r.links||[],data:compact(r)}});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}
(async()=>{let s,r;
  s=session();await s.ask('鬼神石の保存を教えて');r=await s.ask('九十九に変えて同じこと');
  check('same-content target switch keeps save',r.data&&r.data.siteSameFeatureTargetSwitch&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);
  check('same-content save switch links new target only',r.links.length===1&&hasLink(r,'九十九.html')&&!hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('鬼神石を開いて入手も教えて');r=await s.ask('九十九に変えて同じこと');
  check('same-content target switch keeps acquisition aspect',r.data&&r.data.siteSameFeatureTargetSwitch&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns'&&/入手/.test(r.answer||''),r);

  s=session();await s.ask('鬼神石の保存を教えて');r=await s.ask('保存じゃなく入手の方');
  check('feature-only correction keeps target and changes to acquisition',r.data&&r.data.siteFeatureRevision&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns'&&/入手/.test(r.answer||''),r);
  check('feature correction wording is natural acquisition label',/観点を「入手」/.test(r.answer||''),r.answer);

  s=session();await s.ask('鬼神石を開いて入手も教えて');r=await s.ask('さっきの入手じゃなく保存の方');
  check('feature-only correction can reverse acquisition to save',r.data&&r.data.siteFeatureRevision&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&/保存/.test(r.answer||''),r);

  s=session();await s.ask('鬼神石の保存を教えて');r=await s.ask('九十九の保存じゃなく入手の方');
  check('feature correction can change target and feature together',r.data&&r.data.siteFeatureRevision&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns'&&/入手/.test(r.answer||''),r);

  s=session();await s.ask('鬼神石を開いて入手も教えて');await s.ask('九十九の保存を教えて');r=await s.ask('一個前の話題の保存');
  check('one-topic-back uses actual topic history',r.data&&r.data.siteTopicHistoryRestore&&r.data.siteTopicHistoryRequestedStep===1&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('topic-history feature request links restored topic only',r.links.length===1&&hasLink(r,'鬼神石.html')&&!hasLink(r,'九十九.html'),r);

  s=session();await s.ask('鬼神石を開いて入手も教えて');await s.ask('九十九の保存を教えて');r=await s.ask('一個前の話題で同じこと');
  check('same-content on previous topic carries current aspect',r.data&&r.data.siteTopicHistoryRestore&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);

  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('九十九の保存を教えて');await s.ask('魔導結晶の保存を教えて');r=await s.ask('2個前の話題の保存');
  check('two-topic-back follows ordered topic transitions',r.data&&r.data.siteTopicHistoryRestore&&r.data.siteTopicHistoryRequestedStep===2&&r.data.siteItem==='kishin',r);

  s=session();await s.ask('鬼神石の保存を教えて');r=await s.ask('2個前の話題の保存');
  check('insufficient topic history asks instead of inventing target',r.data&&r.data.siteTopicHistoryNeedsClarification&&r.data.needsClarification&&r.data.siteTopicHistoryRequestedStep===2,r);

  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('九十九の保存を教えて');r=await s.ask('前の話題の保存');
  check('plain previous-topic wording resolves one prior topic',r.data&&r.data.siteTopicHistoryRestore&&r.data.siteItem==='kishin',r);

  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('九十九の保存を教えて');r=await s.ask('一個前の話題');
  check('previous-topic without feature restores page naturally',r.data&&r.data.siteTopicHistoryRestore&&r.data.siteItem==='kishin'&&r.data.pageHelp,r);

  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('九十九の保存を教えて');await s.ask('鬼神石の保存を教えて');r=await s.ask('一個前の話題');
  check('topic history preserves revisits as ordered transitions',r.data&&r.data.siteTopicHistoryRestore&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('なるほど');r=await s.ask('九十九に変えて同じ内容');
  check('same-content switch survives short acknowledgement',r.data&&r.data.siteSameFeatureTargetSwitch&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);

  r=await session().ask('鬼神石の保存を教えて、そのあと九十九に変えて同じこと');
  check('existing same-turn multi-target binding remains intact',r.data&&r.data.siteItems&&r.data.siteItems.join(',')==='kishin,tsukumo'&&r.data.siteFeatures&&r.data.siteFeatures.includes('save'),r);
  check('existing same-turn request still links both pages',hasLink(r,'鬼神石.html')&&hasLink(r,'九十九.html'),r);

  r=await session().ask('魔導結晶の入手は？');
  check('standalone acquisition fact still stays tool-knowledge route',r.data&&r.data.toolKnowledge&&r.data.dataset==='madou'&&r.data.acquisition&&!r.data.siteGuide,r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku deep link remains exact',r.data&&r.data.siteItem==='seikai'&&stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AC FEATURE / TOPIC MEMORY: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
