#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
function compact(r){const d=r.data||{};if(!d.siteGuide)return d;return{siteGuide:true,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),siteFeatureSubjects:Array.isArray(d.siteFeatureSubjects)?d.siteFeatureSubjects.slice(0,8):[],siteItems:Array.isArray(d.siteItems)?d.siteItems.slice(0,8):[],siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice(0,8):[],candidates:Array.isArray(d.candidates)?d.candidates.slice(0,8):[],siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],siteSourceCandidates:Array.isArray(d.siteSourceCandidates)?d.siteSourceCandidates.slice(0,8):[],siteOpenedItems:Array.isArray(d.siteOpenedItems)?d.siteOpenedItems.slice(0,8):[],siteExcludedItems:Array.isArray(d.siteExcludedItems)?d.siteExcludedItems.slice(0,8):[],siteConditions:Array.isArray(d.siteConditions)?d.siteConditions.slice(0,12):[],selectedSiteItem:String(d.selectedSiteItem||''),previousSelectedSiteItem:String(d.previousSelectedSiteItem||''),siteGuideContextCleared:!!d.siteGuideContextCleared,needsClarification:!!d.needsClarification};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:{mode:r.mode||'',links:r.links||[],data:compact(r)}});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}
(async()=>{let s,r;
  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('今日は暑いね');r=await s.ask('あの時に比べてたもう片方');
  check('historical relative comparison chooses alternative of selected side',r.data&&r.data.siteHistoricalComparisonAlternativeRestore&&r.data.siteItem==='kishin',r);
  check('historical relative comparison records previous selected side',r.data&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.selectedSiteItem==='kishin',r);
  check('historical relative comparison retains pair',r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('tsukumo')&&r.data.siteComparison.includes('kishin'),r);
  check('historical relative comparison links alternative',hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('前に比較してたもう片方の保存を教えて');
  check('historical alternative can add explicit feature',r.data&&r.data.siteHistoricalComparisonAlternativeRestore&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('historical alternative explicit feature answers save',/保存/.test(r.answer||''),r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');r=await s.ask('前に比べてたもう片方');
  check('unanchored alternative without selected side asks safely',r.data&&r.data.siteHistoricalComparisonAlternativeNeedsClarification&&r.data.needsClarification,r);
  check('unanchored alternative preserves undecided pair',r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('stats')&&r.data.siteComparison.includes('retainer'),r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');await s.ask('九十九と鬼神石の違いは？');r=await s.ask('前に能力計算と比べてたもう片方');
  check('anchored historical comparison finds older matching comparison',r.data&&r.data.siteHistoricalComparisonAlternativeRestore&&r.data.siteItem==='retainer',r);
  check('anchored historical comparison uses named side as base',r.data&&r.data.previousSelectedSiteItem==='stats'&&r.data.selectedSiteItem==='retainer',r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('さっき比較した方じゃなくもう片方');
  check('latest comparison wins for unanchored historical alternative',r.data&&r.data.siteHistoricalComparisonAlternativeRestore&&r.data.siteItem==='kishin',r);

  r=await session().ask('あの時に比べてたもう片方');
  check('historical alternative without history does not invent comparison',r.data&&r.data.siteHistoricalComparisonAlternativeNeedsClarification&&r.data.needsClarification,r);

  s=session();await s.ask('九十九の保存を教えて');await s.ask('魔導結晶を開いて');await s.ask('今日は暑いね');r=await s.ask('保存の話に戻って、今度は鬼神石で同じこと');
  check('historical feature transfer carries save to new explicit target',r.data&&r.data.siteHistoricalFeatureTransfer&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('historical feature transfer records source episode item',r.data&&r.data.siteHistoricalFeatureSourceItem==='tsukumo',r);
  check('historical feature transfer answers target save',/鬼神石/.test(r.answer||'')&&/保存/.test(r.answer||''),r);

  s=session();await s.ask('九十九を開いて入手も教えて');await s.ask('今日は暑いね');r=await s.ask('前の入手の話を鬼神石でも同じように');
  check('historical acquisition transfer carries acquisition detail',r.data&&r.data.siteHistoricalFeatureTransfer&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns'&&/入手/.test(r.answer||''),r);
  check('historical acquisition transfer source is prior item',r.data&&r.data.siteHistoricalFeatureSourceItem==='tsukumo',r);

  s=session();await s.ask('九十九の保存を教えて');await s.ask('鬼神石の入手も教えて');r=await s.ask('保存の話に戻って、それを魔導結晶でも');
  check('historical transfer chooses latest matching feature episode, not current different feature',r.data&&r.data.siteHistoricalFeatureTransfer&&r.data.siteItem==='mado'&&r.data.siteFeature==='save'&&r.data.siteHistoricalFeatureSourceItem==='tsukumo',r);

  r=await session().ask('保存の話に戻って、今度は鬼神石で同じこと');
  check('historical feature transfer without source history asks safely',r.data&&r.data.siteHistoricalFeatureTransferNeedsClarification&&r.data.needsClarification,r);

  s=session();await s.ask('九十九の保存を教えて');await s.ask('鬼神石を開いて入手も教えて');r=await s.ask('保存の話をしてた時の九十九');
  check('qualified item+feature episode remains existing route',r.data&&r.data.siteQualifiedEpisodeRestore&&r.data.siteItem==='tsukumo'&&!r.data.siteHistoricalFeatureTransfer,r);

  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('九十九を開いて入手も教えて');r=await s.ask('前に保存を聞いた方');
  check('feature-only historical episode remains existing route',r.data&&r.data.siteFeatureEpisodeRestore&&r.data.siteItem==='kishin'&&!r.data.siteHistoricalFeatureTransfer,r);

  r=await session().ask('鬼神石の保存を教えて');
  check('ordinary explicit save request remains normal site guide',r.data&&r.data.siteGuide&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&!r.data.siteHistoricalFeatureTransfer,r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('それじゃなくて、もう片方の保存は？');
  check('current comparison alternative remains existing current-context route',r.data&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&!r.data.siteHistoricalComparisonAlternativeRestore,r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku exact link remains unchanged',r.data&&r.data.siteItem==='seikai'&&stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AF HISTORICAL RELATIVE / FEATURE TRANSFER: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
