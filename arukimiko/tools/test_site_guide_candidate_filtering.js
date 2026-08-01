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
    siteOpenedItems:Array.isArray(d.siteOpenedItems)?d.siteOpenedItems.slice():[],siteCapabilityFilter:!!d.siteCapabilityFilter
  }};
}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};}
function guide(r){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide);}
function labels(r){return (r&&r.links||[]).map(x=>String(x.label||''));}
function onlyLinks(r,names){const a=labels(r);return a.length===names.length&&names.every((n,i)=>a[i].indexOf(n)>=0);}
(async()=>{
  let s,r;

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('この中で保存できないのは？');
  check('negative save says none',guide(r)&&r.data.siteCapabilityFilter&&/ありません/.test(r.answer||''),r);
  check('negative save keeps both facts',onlyLinks(r,['九十九','魔導結晶']),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算に入らないのはどれ？');
  check('ability calc negative identifies kishin',guide(r)&&r.data.siteCapabilityFilter&&r.data.siteItems.join(',')==='kishin',r);
  check('ability calc negative only kishin link',onlyLinks(r,['鬼神石']),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算に入るのはどれ？');
  check('ability calc positive identifies tsukumo and mado',guide(r)&&r.data.siteCapabilityFilter&&r.data.siteItems.join(',')==='tsukumo,mado',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('家臣計算に入らないのは？');
  check('retainer negative identifies kishin and mado',guide(r)&&r.data.siteCapabilityFilter&&r.data.siteItems.join(',')==='kishin,mado',r);

  s=session();await s.ask('能力計算と家臣計算どっちがいい？');r=await s.ask('魔導を入れられない方は？');
  check('mado unavailable calculator is retainer',guide(r)&&r.data.siteItems.join(',')==='retainer'&&onlyLinks(r,['家臣計算']),r);

  s=session();await s.ask('能力計算と家臣計算どっちがいい？');r=await s.ask('九十九を入れるならどっち？');
  check('tsukumo works in both calculators',guide(r)&&r.data.siteItems.join(',')==='stats,retainer'&&/どれも反映できる/.test(r.answer||''),r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('どっちも同じ？');
  check('same question returns real comparison',guide(r)&&/完全に同じではない/.test(r.answer||'')&&Array.isArray(r.data.siteComparison),r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('結局どっち使えばいい？');
  check('recommendation explains both purposes',guide(r)&&r.data.siteRecommendation&&/目的で選ぶ/.test(r.answer||''),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('最初と最後を開いて');
  check('first and last open',guide(r)&&onlyLinks(r,['鬼神石','魔導結晶']),r);
  r=await s.ask('真ん中は保存できる？');
  check('subset open retains original candidate context',guide(r)&&r.data.siteItem==='tsukumo'&&r.data.siteFeature==='save',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('1個目と3個目見せて');
  check('ordinal subset open',guide(r)&&onlyLinks(r,['鬼神石','魔導結晶']),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('後ろ二つを開いて');
  check('last two open',guide(r)&&onlyLinks(r,['九十九','魔導結晶']),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('2番目以外を開いて');
  check('all except second open',guide(r)&&onlyLinks(r,['鬼神石','魔導結晶']),r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('この二つのページ開いて');
  check('these two pages open',guide(r)&&onlyLinks(r,['九十九','魔導結晶']),r);

  r=await session().ask('九十九を開いて、そのあと魔導も開いて');
  check('two explicit page operations in one utterance',guide(r)&&onlyLinks(r,['九十九','魔導結晶']),r);

  s=session();await s.ask('九十九と魔導って何が違う？');r=await s.ask('いや開くんじゃなくて使い方だけ');
  check('open correction stays in site dialogue',guide(r)&&r.data.needsClarification&&/使い方を知りたい/.test(r.answer||''),r);

  s=session();await s.ask('九十九と魔導って何が違う？');await s.ask('魔導を開いて');r=await s.ask('いや開くんじゃなくて使い方だけ');
  check('open correction after selection explains selected page',guide(r)&&r.data.siteItem==='mado'&&labels(r).length===0&&/使い方/.test(r.answer||''),r);

  r=await session().ask('鬼神石1番の入手は？');
  check('tool source boundary remains',r&&r.mode==='たいらの野望ツール実データ',r);
  r=await session().ask('足利義昭のカウンター見たい');
  check('counter source boundary remains',r&&r.mode==='たいらの野望専用知識',r);

  console.log(`SITE GUIDE CANDIDATE FILTERING: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
