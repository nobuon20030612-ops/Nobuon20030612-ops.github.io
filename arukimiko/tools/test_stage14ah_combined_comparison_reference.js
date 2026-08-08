#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail&&{answer:detail.answer,data:detail.data,links:detail.links});}
function compact(r){const d=r.data||{};if(!d.siteGuide)return d;return{siteGuide:true,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),siteFeatureSubjects:Array.isArray(d.siteFeatureSubjects)?d.siteFeatureSubjects.slice(0,8):[],siteItems:Array.isArray(d.siteItems)?d.siteItems.slice(0,8):[],siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice(0,8):[],candidates:Array.isArray(d.candidates)?d.candidates.slice(0,8):[],siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],siteSourceCandidates:Array.isArray(d.siteSourceCandidates)?d.siteSourceCandidates.slice(0,8):[],siteOpenedItems:Array.isArray(d.siteOpenedItems)?d.siteOpenedItems.slice(0,8):[],siteExcludedItems:Array.isArray(d.siteExcludedItems)?d.siteExcludedItems.slice(0,8):[],siteConditions:Array.isArray(d.siteConditions)?d.siteConditions.slice(0,12):[],selectedSiteItem:String(d.selectedSiteItem||''),previousSelectedSiteItem:String(d.previousSelectedSiteItem||''),siteGuideContextCleared:!!d.siteGuideContextCleared,needsClarification:!!d.needsClarification};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:{mode:r.mode||'',links:r.links||[],data:compact(r)}});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}
async function selectedComparison(s,question,selection='前者',feature=''){await s.ask(question);await s.ask(selection);if(feature)await s.ask(feature);}
(async()=>{let s,r;
  async function setupTwoSave(){
    const x=session();
    await x.ask('能力計算と家臣計算の違いは？');await x.ask('前者');await x.ask('保存も教えて');
    await x.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await x.ask('それでお願い');await x.ask('保存も教えて');
    return x;
  }
  async function setupTwoPlain(){
    const x=session();
    await x.ask('能力計算と家臣計算の違いは？');await x.ask('前者');
    await x.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await x.ask('それでお願い');
    return x;
  }

  s=await setupTwoSave();
  r=await s.ask('保存の話をしていたその前の比較のもう片方');
  check('feature plus second-latest matching comparison resolves old save episode',r.data&&r.data.siteHistoricalComparisonFeatureAlternativeRestore&&r.data.siteHistoricalComparisonFeatureRequestedStep===2&&r.data.siteItem==='retainer',r);
  check('feature plus relative order preserves selected base',r.data&&r.data.previousSelectedSiteItem==='stats'&&r.data.selectedSiteItem==='retainer',r);
  check('locator save feature is reused on resolved alternative',r.data&&r.data.siteFeature==='save'&&/保存/.test(r.answer||''),r);
  check('resolved old alternative links retainer',hasLink(r,'家臣計算機.html'),r);

  s=await setupTwoSave();r=await s.ask('保存の話をしていた一つ前の比較のもう片方');
  check('feature plus one-back chooses latest matching episode',r.data&&r.data.siteHistoricalComparisonFeatureRequestedStep===1&&r.data.siteItem==='kishin',r);

  s=await setupTwoSave();r=await s.ask('保存の話をしていた最初の比較のもう片方');
  check('feature plus first absolute order picks oldest matching episode',r.data&&r.data.siteHistoricalComparisonFeatureRequestedOrder==='最初'&&r.data.siteItem==='retainer',r);
  s=await setupTwoSave();r=await s.ask('保存の話をしていた最後の比較のもう片方');
  check('feature plus last absolute order picks newest matching episode',r.data&&r.data.siteHistoricalComparisonFeatureRequestedOrder==='最後'&&r.data.siteItem==='kishin',r);
  s=await setupTwoSave();r=await s.ask('保存の話をしていた最後から二番目の比較のもう片方');
  check('feature plus second-from-last absolute order picks older matching episode',r.data&&r.data.siteHistoricalComparisonFeatureRequestedOrder==='最後から二番目'&&r.data.siteItem==='retainer',r);

  s=await setupTwoSave();r=await s.ask('九十九で保存の話をしていた比較のもう片方');
  check('feature plus one named anchor locates matching old comparison',r.data&&Array.isArray(r.data.siteHistoricalComparisonFeatureAnchors)&&r.data.siteHistoricalComparisonFeatureAnchors.includes('tsukumo')&&r.data.siteItem==='kishin',r);
  s=await setupTwoSave();r=await s.ask('能力計算と家臣計算で保存の話をしていた比較のもう片方');
  check('feature plus two named anchors locates exact pair',r.data&&Array.isArray(r.data.siteHistoricalComparisonFeatureAnchors)&&r.data.siteHistoricalComparisonFeatureAnchors.includes('stats')&&r.data.siteHistoricalComparisonFeatureAnchors.includes('retainer')&&r.data.siteItem==='retainer',r);

  s=await setupTwoPlain();r=await s.ask('一番最初の比較のもう片方');
  check('absolute first comparison alternative restores oldest alternative',r.data&&r.data.siteHistoricalAbsoluteComparisonRestore&&r.data.siteHistoricalComparisonRequestedOrder==='最初'&&r.data.siteItem==='retainer',r);
  s=await setupTwoPlain();r=await s.ask('最後から二番目の比較のもう片方');
  check('absolute second-from-last comparison alternative restores oldest of two',r.data&&r.data.siteHistoricalAbsoluteComparisonRestore&&r.data.siteHistoricalComparisonRequestedOrder==='最後から二番目'&&r.data.siteItem==='retainer',r);
  s=await setupTwoPlain();r=await s.ask('一番最後の比較で選んだ方');
  check('absolute last comparison selected-side recall restores selected target',r.data&&r.data.siteHistoricalAbsoluteComparisonRestore&&r.data.siteHistoricalComparisonRequestedOrder==='最後'&&r.data.siteItem==='tsukumo'&&r.data.selectedSiteItem==='tsukumo',r);
  s=await setupTwoPlain();r=await s.ask('最初の比較に戻って');
  check('absolute comparison context restore keeps full pair',r.data&&r.data.siteHistoricalAbsoluteComparisonRestore&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('stats')&&r.data.siteComparison.includes('retainer'),r);
  check('absolute comparison context restore keeps old selection',r.data&&r.data.selectedSiteItem==='stats',r);

  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('保存も教えて');
  r=await s.ask('保存の話をしていた一つ前の比較のもう片方で、入手も教えて');
  check('explicit output feature overrides locator feature',r.data&&r.data.siteHistoricalComparisonFeatureRequestedStep===1&&r.data.siteItem==='kishin'&&r.data.siteHistoricalComparisonFeatureTarget==='columns'&&r.data.siteFeature==='columns',r);
  check('explicit output acquisition is answered from real target data',/入手/.test(r.answer||'')&&!r.data.needsClarification,r);

  r=await session().ask('最後から二番目の比較のもう片方');
  check('absolute comparison without history asks safely',r.data&&r.data.siteHistoricalAbsoluteComparisonNeedsClarification&&r.data.needsClarification,r);
  s=session();await s.ask('能力計算と家臣計算の違いは？');r=await s.ask('最初の比較のもう片方');
  check('absolute comparison with undecided selection asks safely',r.data&&r.data.siteHistoricalOrderedComparisonNeedsClarification&&r.data.needsClarification,r);
  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');await s.ask('保存も教えて');r=await s.ask('保存の話をしていたその前の比較のもう片方');
  check('feature plus unavailable relative order asks safely',r.data&&r.data.siteHistoricalComparisonFeatureNeedsClarification&&r.data.needsClarification&&r.data.siteHistoricalComparisonFeatureRequestedStep===2,r);
  s=session();await s.ask('能力計算と家臣計算の違いは？');await s.ask('前者');await s.ask('保存も教えて');r=await s.ask('九十九で保存の話をしていた比較のもう片方');
  check('feature plus unmatched named anchor asks safely',r.data&&r.data.siteHistoricalComparisonFeatureNeedsClarification&&r.data.needsClarification,r);

  s=await setupTwoPlain();r=await s.ask('その前の比較で選ばなかった方');
  check('existing ordered route remains old AG route',r.data&&r.data.siteHistoricalOrderedComparisonAlternativeRestore&&!r.data.siteHistoricalAbsoluteComparisonRestore&&r.data.siteItem==='retainer',r);
  s=await setupTwoPlain();r=await s.ask('前に比較してたもう片方');
  check('generic historical comparison alternative remains AF route',r.data&&r.data.siteHistoricalComparisonAlternativeRestore&&!r.data.siteHistoricalAbsoluteComparisonRestore&&r.data.siteItem==='kishin',r);
  s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');r=await s.ask('それじゃなくて、もう片方の保存は？');
  check('current comparison alternative still uses current-context route',r.data&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&!r.data.siteHistoricalAbsoluteComparisonRestore&&!r.data.siteHistoricalComparisonFeatureAlternativeRestore,r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku exact link remains unchanged',r.data&&r.data.siteItem==='seikai'&&stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AH COMBINED COMPARISON REFERENCE: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
