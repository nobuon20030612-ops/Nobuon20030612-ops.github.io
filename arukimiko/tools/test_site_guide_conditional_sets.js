#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};
global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js',
  'jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){
  const d=r&&r.data||{};
  return {mode:r&&r.mode||'',links:r&&r.links||[],data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteItems:Array.isArray(d.siteItems)?d.siteItems.slice():[],
    siteFeature:String(d.siteFeature||''),siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice():[],
    siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice():[],siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice():[],
    selectedSiteItem:String(d.selectedSiteItem||''),needsClarification:!!d.needsClarification,
    siteOpenedItems:Array.isArray(d.siteOpenedItems)?d.siteOpenedItems.slice():[],siteCapabilityFilter:!!d.siteCapabilityFilter,
    siteConditionalFilter:!!d.siteConditionalFilter,siteConditionalOpen:!!d.siteConditionalOpen,
    siteExcludedItems:Array.isArray(d.siteExcludedItems)?d.siteExcludedItems.slice():[]
  }};
}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};}
function guide(r){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide);}
function labels(r){return (r&&r.links||[]).map(x=>String(x.label||''));}
function onlyLinks(r,names){const a=labels(r);return a.length===names.length&&names.every((n,i)=>a[i].indexOf(n)>=0);}
(async()=>{
  let s,r;

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算に入るやつだけ開いて');
  check('conditional open filters ability-compatible pages',guide(r)&&r.data.siteConditionalOpen&&r.data.siteItems.join(',')==='tsukumo,mado',r);
  check('conditional open links only eligible pages',onlyLinks(r,['九十九','魔導結晶']),r);
  r=await s.ask('後者は保存も？');
  check('filtered context makes latter mado',guide(r)&&r.data.siteItem==='mado'&&r.data.siteFeature==='save',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算に入るやつのうち最後を開いて');
  check('position is applied after capability filter',guide(r)&&r.data.siteItems.join(',')==='mado'&&onlyLinks(r,['魔導結晶']),r);
  r=await s.ask('もう片方は保存も？');
  check('other page refers to other eligible result',guide(r)&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('鬼神石以外で能力計算に入るのは？');
  check('named exclusion before capability filter',guide(r)&&r.data.siteItems.join(',')==='tsukumo,mado'&&r.data.siteExcludedItems.join(',')==='kishin',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('最初以外で保存できるのは？');
  check('positional exclusion before feature filter',guide(r)&&r.data.siteItems.join(',')==='tsukumo,mado',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算には入るけど家臣計算には入らないのは？');
  check('positive and negative target conditions identify mado',guide(r)&&r.data.siteConditionalFilter&&r.data.siteItems.join(',')==='mado',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('家臣計算には入るけど能力計算には入らないのは？');
  check('impossible target conjunction returns none',guide(r)&&r.data.siteConditionalFilter&&r.data.siteItems.length===0&&/ありません/.test(r.answer||''),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('保存できないの以外を開いて');
  check('double negative save filter opens supported pages',guide(r)&&r.data.siteConditionalOpen&&r.data.siteItems.join(',')==='kishin,tsukumo,mado',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算に入らないやつを除いて開いて');
  check('exclude negative capability set',guide(r)&&r.data.siteConditionalOpen&&r.data.siteItems.join(',')==='tsukumo,mado',r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('両方保存できるなら開いて');
  check('conditional all open after verification',guide(r)&&r.data.siteConditionalOpen&&onlyLinks(r,['九十九','魔導結晶']),r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('保存も並べ替えもできるのだけ開いて');
  check('two positive feature conditions',guide(r)&&r.data.siteConditionalFilter&&r.data.siteItems.join(',')==='tsukumo,mado'&&r.data.siteFeatures.join(',')==='save,sort',r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('保存できるけど並べ替えできないのは？');
  check('positive and negative feature conjunction returns none',guide(r)&&r.data.siteConditionalFilter&&r.data.siteItems.length===0&&/ありません/.test(r.answer||''),r);

  s=session();await s.ask('能力計算と家臣計算どっちがいい？');r=await s.ask('魔導を反映できて保存もできるのは？');
  check('mado reflect plus save selects stats',guide(r)&&r.data.siteItems.join(',')==='stats'&&onlyLinks(r,['能力計算']),r);

  s=session();await s.ask('能力計算と家臣計算どっちがいい？');r=await s.ask('九十九を反映できて保存もできるのは？');
  check('tsukumo reflect plus save selects both calculators',guide(r)&&r.data.siteItems.join(',')==='stats,retainer',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算に入るやつだけ');
  check('filter works without explicit open verb',guide(r)&&r.data.siteConditionalFilter&&r.data.siteItems.join(',')==='tsukumo,mado',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('2番目以外を開いて');
  check('existing positional subset remains unchanged',guide(r)&&onlyLinks(r,['鬼神石','魔導結晶']),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算に入らないのはどれ？');
  check('existing single capability filter remains',guide(r)&&r.data.siteItems.join(',')==='kishin',r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('どっちも8個？');
  check('all-candidate count question is not conditional filter',guide(r)&&!r.data.siteConditionalFilter&&/8個/.test(r.answer||''),r);

  r=await session().ask('鬼神石1番の入手は？');
  check('tool source boundary remains',r&&r.mode==='たいらの野望ツール実データ',r);
  r=await session().ask('足利義昭のカウンター見たい');
  check('counter source boundary remains',r&&r.mode==='たいらの野望専用知識',r);

  console.log(`SITE GUIDE CONDITIONAL SETS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
