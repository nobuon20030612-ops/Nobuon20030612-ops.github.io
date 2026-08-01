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
  'jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js',
  'jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js','jinpo-bot-persona.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function meta(r){return {mode:r.mode||'',data:Object.assign({},r.data||{})};}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:meta(r)});return r;}};}
(async()=>{
  let s=session(),r;
  await s.ask('腕力トップ10');
  await s.ask('今の結果をAとして保存');
  await s.ask('この中で腕力3300以上だけ');
  await s.ask('今の結果をBとして保存');

  r=await s.ask('AとBの共通だけ表示して');
  check('intersection switches candidate set',r.data.savedViewDerived===true&&r.data.savedViewOperation==='intersection'&&r.data.count===4,r.data);
  check('intersection root is exact result',r.data.heroRefinement.rootCandidates.length===4&&r.data.heroRefinement.activeCandidates.length===4,r.data.heroRefinement);

  r=await s.ask('AとBをまとめて表示して');
  check('union switches to ten unique heroes',r.data.savedViewOperation==='union'&&r.data.count===10,r.data);

  r=await s.ask('AとBの片方だけを表示して');
  check('symmetric difference is six',r.data.savedViewOperation==='symmetric'&&r.data.count===6,r.data);

  r=await s.ask('AからBを除いて表示して');
  check('directional difference A minus B',r.data.savedViewOperation==='difference'&&r.data.savedViewNames[0]==='A'&&r.data.count===6,r.data);

  r=await s.ask('AとBの共通をCとして保存');
  check('derive and save directly',r.data.savedViewDerived===true&&r.data.savedViewSaved===true&&r.data.savedViewName==='C'&&r.data.savedViewCount===4,r.data);
  check('derived save listed in context',r.data.heroRefinement.savedViews.some(v=>v.name==='C'&&v.count===4),r.data.heroRefinement.savedViews);

  r=await s.ask('Cに戻して');
  check('restore derived saved view',r.data.savedViewRestored===true&&r.data.count===4,r.data);
  r=await s.ask('この中で知力2500以上だけ');
  check('refine stays inside derived root',r.data.heroRefinement.rootCandidates.length===4&&r.data.count<=4,r.data);

  const before=r.data.heroRefinement.activeCandidates.slice();
  r=await s.ask('BからAを除いて表示して');
  check('empty derived set reports zero',r.data.savedViewDerived===true&&r.data.count===0,r.data);
  check('empty derived set keeps current context',JSON.stringify(r.data.heroRefinement.activeCandidates)===JSON.stringify(before),r.data.heroRefinement);

  r=await s.ask('AとBの共通は？');
  check('plain common question remains comparison',r.data.savedViewCompared===true&&!r.data.savedViewDerived,r.data);

  r=await s.ask('AとBの共通を保存');
  check('derive save without name asks clarification',r.data.needsClarification===true&&r.data.savedViewDerived===true,r.data);

  s=session();
  r=await s.ask('AとBの共通だけ表示して');
  check('set operation without saved context not stolen',!(r.data&&r.data.savedViewDerived),r.data);

  console.log(`HERO MASTER SAVED VIEW SETS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
