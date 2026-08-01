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
['jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js','jinpo-bot-persona.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function meta(r){return {mode:r.mode||'',data:Object.assign({},r.data||{})};}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:meta(r)});return r;}};}
(async()=>{
  let s=session(),r;
  await s.ask('腕力トップ10');
  await s.ask('今の結果をAとして保存');
  await s.ask('この中で知力2500以上だけ');

  r=await s.ask('今の結果とAを比べて');
  check('current vs saved handled',r.data.savedViewComparedCurrent===true&&r.data.savedViewName==='A',r.data);
  check('current vs saved counts',r.data.currentCandidates.length===5&&r.data.savedCandidates.length===10,r.data);
  check('current vs saved direction',r.data.onlyCurrent.length===0&&r.data.onlySaved.length===5,r.data);

  r=await s.ask('Aはどんな条件で何人？');
  check('saved detail handled',r.data.savedViewDetail===true&&r.data.savedViewName==='A'&&r.data.count===10,r.data);
  check('saved detail sort',r.data.stats[0]==='腕力'&&r.data.low===false,r.data);
  check('saved detail answer states exact count',/確定候補：10人/.test(r.answer),r.answer);

  await s.ask('Aに戻して');
  await s.ask('侍だけ');
  await s.ask('じゃあ知力順');
  await s.ask('今の結果をJとして保存');
  r=await s.ask('Jは何の条件で何人？');
  check('filtered saved detail',r.data.savedViewDetail===true&&r.data.count===3&&r.data.filters.job==='侍',r.data);

  await s.ask('全英傑で知力トップ10');
  await s.ask('今の結果をBとして保存');

  r=await s.ask('Jの条件をAにかけて表示');
  check('filter transfer handled',r.data.savedViewTransfer===true&&r.data.savedViewTransferMode==='filters',r.data);
  check('filter transfer source target',r.data.savedViewSource==='J'&&r.data.savedViewTarget==='A'&&r.data.count===3,r.data);
  check('filter transfer state',r.data.filters.job==='侍'&&r.data.heroRefinement.rootCandidates.length===10,r.data);

  r=await s.ask('Aの並び順だけBに使って表示');
  check('sort transfer handled',r.data.savedViewTransfer===true&&r.data.savedViewTransferMode==='sort',r.data);
  check('sort transfer preserves target set',r.data.count===10&&r.data.stats[0]==='腕力',r.data);

  r=await s.ask('AをJと同じ条件にしてCとして保存');
  check('reverse wording transfer save',r.data.savedViewTransfer===true&&r.data.savedViewSource==='J'&&r.data.savedViewTarget==='A',r.data);
  check('transfer saved under requested name',r.data.savedViewSaved===true&&r.data.savedViewName==='C'&&r.data.savedViewCount===3,r.data);
  check('generic save name did not swallow sentence',r.data.heroRefinement.savedViews.some(v=>v.name==='C')&&!r.data.heroRefinement.savedViews.some(v=>/同じ条件/.test(v.name)),r.data.heroRefinement.savedViews);

  r=await s.ask('Jの条件と並び順をBに適用してDとして保存');
  check('both transfer handled',r.data.savedViewTransfer===true&&r.data.savedViewTransferMode==='both',r.data);
  check('both transfer saved',r.data.savedViewSaved===true&&r.data.savedViewName==='D'&&r.data.savedViewCount===2&&r.data.filters.job==='侍'&&r.data.stats[0]==='知力',r.data);

  r=await s.ask('Aの条件をBにかけて表示');
  check('empty filter source clarifies',r.data.needsClarification===true&&r.data.savedViewTransfer===true,r.data);
  check('empty filter clarification mentions sort',/並び順/.test(r.answer)&&/腕力/.test(r.answer),r.answer);

  r=await s.ask('Bの並び順をAに使って保存');
  check('transfer save missing name clarifies',r.data.needsClarification===true&&r.data.savedViewTransfer===true,r.data);

  s=session();
  r=await s.ask('今の結果とAを比べて');
  check('no saved context current compare not stolen',!(r.data&&r.data.savedViewComparedCurrent),r.data);
  r=await s.ask('Aはどんな条件で何人？');
  check('no saved context detail not stolen',!(r.data&&r.data.savedViewDetail),r.data);

  console.log(`HERO MASTER SAVED VIEW REUSE: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
