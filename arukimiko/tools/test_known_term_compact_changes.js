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
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function historyMeta(r){
  const d=r&&r.data||{},c=d.context||{};let data={};
  if(d.siteGuide)data={siteGuide:true,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm,resolutionReason:String(c.reason||''),contextMessage:String(c.message||'')};
  else if(c.resolved&&String(c.siteItem||'')==='jinpo')data={jinpoContinuation:true,siteItem:'jinpo',resolutionReason:String(c.reason||''),contextMessage:String(c.message||'')};
  else if(d.needsSpecifiedSearchCondition)data={jinpoContinuation:true,siteItem:'jinpo',resolutionReason:'specified_search_partial'};
  else if(d.heroKnowledge)data={heroKnowledge:true,hero:String(d.hero||''),heroes:Array.isArray(d.heroes)?d.heroes.slice(0,24):[],cost:Number(d.cost||d.filters&&d.filters.cost)||0,list:!!d.list,costEdge:!!d.costEdge,ranking:!!d.ranking,low:!!d.low,stats:Array.isArray(d.stats)?d.stats.slice(0,12):[]};
  return {links:r&&r.links||[],mode:r&&r.mode||'',data:data};
}
async function sequence(messages){const history=[],out=[];for(const text of messages){history.push({role:'user',text});const r=await B.handle({message:text,history:history.slice()});out.push(r);history.push({role:'assistant',text:String(r.answer||''),meta:historyMeta(r)});}return out;}
function contextMessage(r){return String(r&&r.data&&r.data.context&&r.data.context.message||'');}
(async()=>{
  let x=await sequence(['因縁','7因縁で探して','了解','やっぱり6']);
  check('bare bond number changes previous bond count',contextMessage(x[3])==='6因縁で探して',x[3]);

  x=await sequence(['文曲','2人除外','了解','0にして']);
  check('zero clears bunkyoku exclusion',contextMessage(x[3])==='文曲除外0人',x[3]);
  x=await sequence(['文曲','2人除外','了解','なしにして']);
  check('none clears bunkyoku exclusion',contextMessage(x[3])==='文曲除外0人',x[3]);

  x=await sequence(['英傑','コスト7は？','了解','じゃあ8']);
  check('bare next cost keeps hero cost subject',x[3]&&x[3].mode==='英傑マスター実データ'&&/コスト8の英傑は 49人/.test(x[3].answer||''),x[3]);
  check('bare next cost never becomes carp',x[3]&&x[3].mode!=='カープ専用正本知識',x[3]);

  x=await sequence(['英傑','腕力高いのは？','了解','じゃあ知力']);
  check('bare next stat keeps hero ranking subject',x[3]&&x[3].mode==='英傑マスター実データ'&&/知力が高い順/.test(x[3].answer||''),x[3]);
  check('bare next stat never becomes jinpo guide',x[3]&&x[3].mode!=='サイト総合案内',x[3]);

  x=await sequence(['星海の荒石','文曲','了解','それじゃなくて武曲']);
  check('repair wording keeps stone page selection',x[3]&&x[3].mode==='サイト総合案内'&&x[3].data&&x[3].data.siteItem==='seikai'&&/「武曲」のボタン/.test(x[3].answer||''),x[3]);
  x=await sequence(['鎮魂符','頭','了解','それじゃなくて腰']);
  check('repair wording keeps body part selection',x[3]&&x[3].mode==='サイト総合案内'&&x[3].data&&x[3].data.siteItem==='chinkon'&&/「腰」の枠/.test(x[3].answer||''),x[3]);

  x=await sequence(['配置英傑','前田慶次を入れて','了解','やっぱり外して']);
  check('ambiguous placement removal asks instead of executing malformed hero',x[3]&&x[3].mode==='会話確認'&&x[3].data&&x[3].data.knownTermClarification&&/配置条件を外す意味か、候補から除外する意味か/.test(x[3].answer||''),x[3]);

  x=await sequence(['除外英傑','前田慶次を外して','了解','やっぱり戻して']);
  check('omitted hero restores last excluded hero',contextMessage(x[3])==='前田慶次の除外を解除',x[3]);
  x=await sequence(['除外英傑','前田慶次を外して','了解','前田慶次は使う']);
  check('explicit use cue restores exclusion',contextMessage(x[3])==='前田慶次の除外を解除',x[3]);

  x=await sequence(['配置英傑','前田慶次と真田幸村を入れて']);
  check('multiple placement names ask one by one',x[1]&&x[1].mode==='会話確認'&&/1人ずつ/.test(x[1].answer||''),x[1]);
  x=await sequence(['除外英傑','前田慶次と真田幸村を外して']);
  check('multiple exclusion names ask one by one',x[1]&&x[1].mode==='会話確認'&&/1人ずつ/.test(x[1].answer||''),x[1]);

  console.log(`KNOWN TERM COMPACT CHANGES: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
