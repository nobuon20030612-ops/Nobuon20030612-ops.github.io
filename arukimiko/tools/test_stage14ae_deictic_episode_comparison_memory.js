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
  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('九十九の保存を教えて');r=await s.ask('あの時のやつ');
  check('past-moment reference chooses the only older topic',r.data&&r.data.sitePastMomentRestore&&r.data.siteItem==='kishin',r);
  check('past-moment reference preserves historical feature',r.data&&r.data.siteFeature==='save'&&/保存/.test(r.answer||''),r);
  check('past-moment reference links historical topic',r.links.length===1&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('九十九の保存を教えて');await s.ask('魔導結晶の保存を教えて');r=await s.ask('あの時のやつ');
  check('ambiguous past moment asks instead of guessing',r.data&&r.data.sitePastMomentNeedsClarification&&r.data.needsClarification,r);
  check('ambiguous past moment offers actual older topics only',r.data&&Array.isArray(r.data.siteCandidates)&&r.data.siteCandidates.length===2&&r.data.siteCandidates.includes('kishin')&&r.data.siteCandidates.includes('tsukumo')&&!r.data.siteCandidates.includes('mado'),r);

  s=session();await s.ask('九十九を開いて保存も教えて');await s.ask('今日は暑いね');r=await s.ask('あの時のやつ');
  check('past moment with one known site topic resolves it',r.data&&r.data.sitePastMomentRestore&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);

  r=await session().ask('あの時のやつ');
  check('past moment without site history asks safely',r.data&&r.data.sitePastMomentNeedsClarification&&r.data.needsClarification,r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('今日は暑いね');r=await s.ask('さっき比較した方');
  check('historical comparison restores selected side after smalltalk',r.data&&r.data.siteHistoricalComparisonRestore&&r.data.siteItem==='tsukumo'&&r.data.selectedSiteItem==='tsukumo',r);
  check('historical comparison keeps comparison pair',r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.length===2&&r.data.siteComparison.includes('tsukumo')&&r.data.siteComparison.includes('kishin'),r);
  check('historical comparison links selected side',r.links.length===1&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');await s.ask('今日は暑いね');r=await s.ask('さっき比較した方');
  check('undecided historical comparison asks which side',r.data&&r.data.siteHistoricalComparisonNeedsClarification&&r.data.needsClarification,r);
  check('undecided historical comparison returns original pair',r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('stats')&&r.data.siteComparison.includes('retainer'),r);

  r=await session().ask('さっき比較した方');
  check('historical comparison without history asks safely',r.data&&r.data.siteHistoricalComparisonNeedsClarification&&r.data.needsClarification,r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('魔導結晶を開いて保存も教えて');r=await s.ask('前に比較して選んだ方');
  check('historical comparison survives a later site topic',r.data&&r.data.siteHistoricalComparisonRestore&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('九十九の保存を教えて');await s.ask('鬼神石を開いて入手も教えて');r=await s.ask('保存の話をしてた時の九十九');
  check('qualified episode resolves item and feature together',r.data&&r.data.siteQualifiedEpisodeRestore&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);
  check('qualified episode does not use current different topic',r.data&&r.data.previousSiteItem==='kishin',r);

  s=session();await s.ask('九十九を開いて入手も教えて');await s.ask('鬼神石の保存を教えて');r=await s.ask('前に入手の話をしてた時の九十九');
  check('qualified acquisition episode restores acquisition detail',r.data&&r.data.siteQualifiedEpisodeRestore&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='columns'&&/入手/.test(r.answer||''),r);

  r=await session().ask('保存の話をしてた時の九十九');
  check('qualified episode without matching history does not invent memory',r.data&&r.data.siteQualifiedEpisodeNeedsClarification&&r.data.needsClarification,r);

  s=session();await s.ask('鬼神石の保存を教えて');r=await s.ask('前に入手の話をしてた時の鬼神石');
  check('qualified episode requires matching historical feature',r.data&&r.data.siteQualifiedEpisodeNeedsClarification&&r.data.siteItem==='kishin',r);

  r=await session().ask('九十九の保存を教えて');
  check('ordinary explicit save request remains ordinary site guide',r.data&&r.data.siteGuide&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save'&&!r.data.siteQualifiedEpisodeRestore,r);

  s=session();await s.ask('鬼神石の保存を教えて');await s.ask('九十九を開いて入手も教えて');r=await s.ask('前に保存を聞いた方');
  check('feature-only historical episode remains stage14AD route',r.data&&r.data.siteFeatureEpisodeRestore&&r.data.siteItem==='kishin'&&!r.data.siteQualifiedEpisodeRestore,r);

  s=session();await s.ask('九十九を開いて保存も教えて');await s.ask('今日は暑いね');r=await s.ask('その話に戻って続きから');
  check('deictic return resumes paused topic feature, not just page',r.data&&r.data.siteGuideConversationReturn&&r.data.siteGuideFeatureContinuation&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);
  check('deictic return explicitly answers continued feature',/保存/.test(r.answer||''),r);

  s=session();await s.ask('能力計算と家臣計算の違いは？');await s.ask('今日は暑いね');r=await s.ask('その話に戻って続きから');
  check('deictic return on comparison keeps comparison context',r.data&&r.data.siteGuideConversationReturn&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.length===2,r);

  r=await session().ask('魔導結晶の入手は？');
  check('standalone acquisition fact still belongs to tool knowledge',r.data&&r.data.toolKnowledge&&r.data.dataset==='madou'&&r.data.acquisition&&!r.data.siteGuide,r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku exact link remains unchanged',r.data&&r.data.siteItem==='seikai'&&stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AE DEICTIC / EPISODE / COMPARISON MEMORY: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
