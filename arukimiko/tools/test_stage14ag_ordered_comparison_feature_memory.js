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
  s=session();
  await s.ask('能力計算と家臣計算の違いは？');await s.ask('前者');
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  await s.ask('魔導結晶を開いて、保存も教えて');
  r=await s.ask('その前の比較で選ばなかった方にして、同じこと');
  check('second-previous comparison restores alternative',r.data&&r.data.siteHistoricalOrderedComparisonAlternativeRestore&&r.data.siteHistoricalComparisonRequestedStep===2&&r.data.siteItem==='retainer',r);
  check('second-previous comparison uses old selected side as base',r.data&&r.data.previousSelectedSiteItem==='stats'&&r.data.selectedSiteItem==='retainer',r);
  check('same thing carries current save feature to restored alternative',r.data&&r.data.siteFeature==='save'&&/保存/.test(r.answer||''),r);
  check('restored alternative links retainer page',hasLink(r,'家臣計算機.html'),r);

  s=session();
  await s.ask('能力計算と家臣計算の違いは？');await s.ask('前者');
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  r=await s.ask('二つ前の比較で選ばなかった方');
  check('explicit two-back wording equals ordered step two',r.data&&r.data.siteHistoricalOrderedComparisonAlternativeRestore&&r.data.siteHistoricalComparisonRequestedStep===2&&r.data.siteItem==='retainer',r);

  s=session();
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  r=await s.ask('一つ前の比較で選ばなかった方');
  check('one-back wording restores latest comparison alternative',r.data&&r.data.siteHistoricalOrderedComparisonAlternativeRestore&&r.data.siteHistoricalComparisonRequestedStep===1&&r.data.siteItem==='kishin',r);

  s=session();
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  r=await s.ask('一個前の比較で選ばなかった方');
  check('casual one-comparison-back wording is accepted',r.data&&r.data.siteHistoricalOrderedComparisonAlternativeRestore&&r.data.siteHistoricalComparisonRequestedStep===1&&r.data.siteItem==='kishin',r);

  s=session();
  await s.ask('能力計算と家臣計算の違いは？');await s.ask('前者');await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  r=await s.ask('ふたつ前の比較で選ばなかった方');
  check('casual two-comparison-back wording is accepted',r.data&&r.data.siteHistoricalOrderedComparisonAlternativeRestore&&r.data.siteHistoricalComparisonRequestedStep===2&&r.data.siteItem==='retainer',r);

  r=await session().ask('その前の比較で選ばなかった方');
  check('ordered comparison without enough history asks safely',r.data&&r.data.siteHistoricalOrderedComparisonNeedsClarification&&r.data.needsClarification,r);
  check('ordered comparison without history does not invent a target',r.data&&!r.data.siteItem,r);

  s=session();
  await s.ask('能力計算と家臣計算の違いは？');
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  r=await s.ask('その前の比較で選ばなかった方');
  check('ordered comparison with undecided older pair asks safely',r.data&&r.data.siteHistoricalOrderedComparisonNeedsClarification&&r.data.needsClarification,r);
  check('undecided older pair is preserved for clarification',r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('stats')&&r.data.siteComparison.includes('retainer'),r);

  s=session();
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('保存も教えて');
  await s.ask('能力計算と家臣計算を比較したい');await s.ask('前者');
  r=await s.ask('保存の話をしていた比較のもう片方');
  check('feature-qualified comparison finds older save comparison',r.data&&r.data.siteHistoricalComparisonFeatureAlternativeRestore&&r.data.siteHistoricalComparisonFeatureSource==='save'&&r.data.siteItem==='kishin',r);
  check('feature-qualified comparison uses prior selected side',r.data&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.selectedSiteItem==='kishin',r);
  check('feature-qualified comparison carries save by default',r.data&&r.data.siteHistoricalComparisonFeatureTarget==='save'&&r.data.siteFeature==='save',r);

  s=session();
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('保存も教えて');await s.ask('九十九を開いて入手も教えて');
  await s.ask('能力計算と家臣計算を比較したい');await s.ask('前者');
  r=await s.ask('保存の話をしていた比較のもう片方');
  check('comparison remembers earlier feature even after later feature in same episode',r.data&&r.data.siteHistoricalComparisonFeatureAlternativeRestore&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);

  s=session();
  await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('九十九を開いて入手も教えて');
  await s.ask('能力計算と家臣計算を比較したい');await s.ask('前者');
  r=await s.ask('入手の話をしていた比較で選ばなかった方にして、保存も教えて');
  check('acquisition-qualified comparison finds matching old episode',r.data&&r.data.siteHistoricalComparisonFeatureAlternativeRestore&&r.data.siteHistoricalComparisonFeatureSource==='columns'&&r.data.siteItem==='kishin',r);
  check('explicit new feature overrides historical source feature',r.data&&r.data.siteHistoricalComparisonFeatureTarget==='save'&&r.data.siteFeature==='save',r);
  check('acquisition-qualified transfer records selected-side revision',r.data&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.selectedSiteItem==='kishin',r);
  check('acquisition-qualified transfer answers requested save',/鬼神石/.test(r.answer||'')&&/保存/.test(r.answer||''),r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  r=await s.ask('保存の話をしていた比較のもう片方');
  check('feature-qualified comparison without matching feature asks safely',r.data&&r.data.siteHistoricalComparisonFeatureNeedsClarification&&r.data.needsClarification,r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  r=await s.ask('前に比較してたもう片方');
  check('generic historical alternative remains existing AF route',r.data&&r.data.siteHistoricalComparisonAlternativeRestore&&!r.data.siteHistoricalOrderedComparisonAlternativeRestore,r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');
  r=await s.ask('それじゃなくて、もう片方の保存は？');
  check('current comparison alternative remains current-context route',r.data&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&!r.data.siteHistoricalOrderedComparisonAlternativeRestore&&!r.data.siteHistoricalComparisonFeatureAlternativeRestore,r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku exact link remains unchanged',r.data&&r.data.siteItem==='seikai'&&stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AG ORDERED COMPARISON / FEATURE MEMORY: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
