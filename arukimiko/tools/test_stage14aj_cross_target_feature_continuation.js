#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail&&{answer:detail.answer,data:detail.data,links:detail.links});}
function compact(r){const d=r.data||{};if(!d.siteGuide)return d;return{siteGuide:true,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice(0,8):[],siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice(0,8):[],siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],candidates:Array.isArray(d.candidates)?d.candidates.slice(0,8):[],siteSourceCandidates:Array.isArray(d.siteSourceCandidates)?d.siteSourceCandidates.slice(0,8):[],selectedSiteItem:String(d.selectedSiteItem||''),previousSelectedSiteItem:String(d.previousSelectedSiteItem||''),needsClarification:!!d.needsClarification,siteComparisonOppositeSameFeatureCarry:!!d.siteComparisonOppositeSameFeatureCarry,siteComparisonOppositeFeature:!!d.siteComparisonOppositeFeature,siteComparisonRevisionOppositeBundle:!!d.siteComparisonRevisionOppositeBundle,siteComparisonImplicitSelectedFeature:!!d.siteComparisonImplicitSelectedFeature,siteComparisonOppositeNeedsSelection:!!d.siteComparisonOppositeNeedsSelection,siteComparisonAlternativeFeature:!!d.siteComparisonAlternativeFeature,siteComparisonSelectionRevised:!!d.siteComparisonSelectionRevised};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:{mode:r.mode||'',links:r.links||[],data:compact(r)}});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}
async function selectedMaterial(){const s=session();await s.ask('九十九と鬼神石、能力計算に反映したいならどっち？');await s.ask('それでお願い');return s;}
(async()=>{let s,r;
  s=await selectedMaterial();await s.ask('九十九の保存を教えて');r=await s.ask('反対にした方でさっきの続き');
  check('opposite carry switches selected side',r.data&&r.data.siteComparisonOppositeSameFeatureCarry&&r.data.siteItem==='kishin'&&r.data.selectedSiteItem==='kishin'&&r.data.previousSelectedSiteItem==='tsukumo',r);
  check('opposite carry preserves save feature',r.data&&r.data.siteFeature==='save'&&/鬼神石/.test(r.answer||'')&&/保存/.test(r.answer||''),r);
  check('opposite carry keeps comparison state',r.data&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('tsukumo')&&r.data.siteComparison.includes('kishin'),r);

  s=await selectedMaterial();await s.ask('鬼神石にして');r=await s.ask('入手を教えて');
  check('bare acquisition follows current comparison selection',r.data&&r.data.siteComparisonImplicitSelectedFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns',r);
  check('bare acquisition answer is acquisition-specific',/鬼神石/.test(r.answer||'')&&/入手/.test(r.answer||''),r);
  r=await s.ask('逆で同じこと');
  check('inverse same feature switches to other side',r.data&&r.data.siteComparisonOppositeSameFeatureCarry&&r.data.siteItem==='tsukumo'&&r.data.previousSelectedSiteItem==='kishin',r);
  check('inverse same feature preserves acquisition detail',r.data&&r.data.siteFeature==='columns'&&/九十九/.test(r.answer||'')&&/入手/.test(r.answer||''),r);

  s=await selectedMaterial();await s.ask('九十九の保存を教えて');await s.ask('今日は暑いね');await s.ask('なるほど');r=await s.ask('反対でさっきの続き');
  check('opposite carry survives multiple smalltalk turns',r.data&&r.data.siteComparisonOppositeSameFeatureCarry&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);

  s=await selectedMaterial();await s.ask('それじゃなくて入手');r=await s.ask('そのあと反対は保存');
  check('explicit opposite feature switches side',r.data&&r.data.siteComparisonOppositeFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('explicit opposite feature remembers prior side',r.data&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.selectedSiteItem==='kishin',r);

  s=await selectedMaterial();r=await s.ask('保存じゃなく入手、そのあと反対は保存');
  check('crossed revision/opposite bundle is handled once',r.data&&r.data.siteComparisonRevisionOppositeBundle&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('crossed bundle answers current-side acquisition',/九十九/.test(r.answer||'')&&/入手/.test(r.answer||''),r);
  check('crossed bundle answers opposite-side save',/鬼神石/.test(r.answer||'')&&/保存/.test(r.answer||''),r);
  check('crossed bundle ends on last-mentioned side',r.data&&r.data.selectedSiteItem==='kishin'&&r.data.previousSelectedSiteItem==='tsukumo',r);
  check('crossed bundle links both tools',hasLink(r,'九十九.html')&&hasLink(r,'鬼神石.html'),r);
  r=await s.ask('それの入手は？');
  check('followup after crossed bundle uses final side',r.data&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns'&&/鬼神石/.test(r.answer||''),r);

  s=await selectedMaterial();r=await s.ask('入手じゃなく保存、その後逆は入手');
  check('reverse crossed bundle supports wording variant',r.data&&r.data.siteComparisonRevisionOppositeBundle&&r.data.siteItem==='kishin'&&r.data.siteFeature==='columns',r);
  check('reverse crossed bundle final acquisition is explicit',/鬼神石/.test(r.answer||'')&&/入手/.test(r.answer||''),r);

  s=await selectedMaterial();r=await s.ask('保存を教えて');
  check('bare save follows current comparison selection',r.data&&r.data.siteComparisonImplicitSelectedFeature&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('反対は保存');
  check('opposite feature without base selection asks safely',r.data&&r.data.needsClarification&&r.data.siteComparisonOppositeNeedsSelection,r);
  check('unselected comparison is not fabricated',!(r.data&&r.data.selectedSiteItem),r);

  r=await session().ask('反対でさっきの続き');
  check('opposite continuation without comparison does not fabricate',!(r.data&&r.data.siteComparisonOppositeSameFeatureCarry),r);

  s=await selectedMaterial();r=await s.ask('それじゃなくて、もう片方の保存は？');
  check('older explicit alternative feature keeps priority',r.data&&r.data.siteComparisonAlternativeFeature&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save',r);
  check('new opposite feature does not steal explicit alternative correction',!(r.data&&r.data.siteComparisonOppositeFeature)&&!(r.data&&r.data.siteComparisonRevisionOppositeBundle),r);

  s=await selectedMaterial();r=await s.ask('その比較の後者に戻って、今度は保存');
  check('existing explicit side plus new feature remains natural',r.data&&r.data.siteItem==='kishin'&&r.data.siteFeature==='save'&&r.data.selectedSiteItem==='kishin',r);

  r=await session().ask('文曲の輝光');
  check('monkyoku exact link remains stable',stone(r,26,'monkyoku'),r);

  console.log(`STAGE14AJ CROSS TARGET / FEATURE CONTINUATION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
