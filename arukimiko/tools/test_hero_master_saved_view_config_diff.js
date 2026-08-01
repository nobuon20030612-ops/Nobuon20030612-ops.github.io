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
  await s.ask('侍だけ');
  await s.ask('今の結果をBとして保存');
  await s.ask('全英傑で知力トップ10');
  r=await s.ask('今の結果をCとして保存');
  const c=r.data.heroRefinement.savedViews.find(v=>v.name==='C');
  check('explicit global ranking clears prior job metadata',!!c&&c.displayFilters.job===''&&c.displayFilters.thresholds.length===0,c);
  check('explicit global ranking keeps exact ten candidates',!!c&&c.count===10&&c.activeCandidates.length===10,c);

  r=await s.ask('AとBの条件の違い');
  check('saved config comparison handled',r.data.savedViewConfigCompared===true&&r.data.comparisonMode==='filters',r.data);
  check('condition comparison direction',r.data.onlyFirstConditions.length===0&&r.data.onlySecondConditions.includes('職業「侍」'),r.data);
  check('condition comparison answer',/Bだけの条件：職業「侍」/.test(r.answer),r.answer);
  check('config comparison does not change current candidate set',r.data.heroRefinement.activeCandidates.length===10,r.data.heroRefinement);

  r=await s.ask('AとCの並び順の違い');
  check('saved sort comparison handled',r.data.savedViewConfigCompared===true&&r.data.comparisonMode==='sort',r.data);
  check('saved sort comparison detects difference',r.data.sameSort===false&&/腕力が高い順/.test(r.data.firstSort)&&/知力が高い順/.test(r.data.secondSort),r.data);

  r=await s.ask('AとBの条件と並び順を比較');
  check('saved full config comparison handled',r.data.savedViewConfigCompared===true&&r.data.comparisonMode==='both',r.data);
  check('full config includes condition and sort difference',r.data.sameSort===false&&r.data.onlySecondConditions.includes('職業「侍」')&&/保存時の順番/.test(r.data.secondSort),r.data);

  r=await s.ask('BにあってAにない条件をCに適用して表示');
  check('directional delta transfer handled',r.data.savedViewDeltaTransfer===true,r.data);
  check('directional delta names',r.data.savedViewSource==='B'&&r.data.savedViewBaseline==='A'&&r.data.savedViewTarget==='C',r.data);
  check('directional delta condition',r.data.deltaConditions.includes('職業「侍」')&&r.data.filters.job==='侍',r.data);
  check('directional delta applies inside target exact set',r.data.count===2&&r.data.heroes.includes('豊臣秀吉')&&r.data.heroes.includes('豊臣秀長'),r.data);
  check('directional delta preserves target sort',r.data.stats[0]==='知力'&&r.data.low===false,r.data);

  r=await s.ask('BにあってAにない条件をCに適用してDとして保存');
  check('directional delta derived save handled',r.data.savedViewDeltaTransfer===true&&r.data.savedViewSaved===true,r.data);
  check('directional delta saved exact result',r.data.savedViewName==='D'&&r.data.savedViewCount===2,r.data);
  const d=r.data.heroRefinement.savedViews.find(v=>v.name==='D');
  check('directional delta saved metadata',!!d&&d.displayFilters.job==='侍'&&d.displaySortStats[0]==='知力'&&d.activeCandidates.length===2,d);

  r=await s.ask('Dはどんな条件で何人？');
  check('derived delta detail exact',r.data.savedViewDetail===true&&r.data.count===2&&r.data.filters.job==='侍',r.data);

  const before=r.data.heroRefinement.activeCandidates.slice();
  r=await s.ask('AにあってBにない条件をCに適用して表示');
  check('empty directional delta handled without mutation',r.data.savedViewDeltaTransfer===true&&r.data.count===0,r.data);
  check('empty directional delta keeps candidates',r.data.heroRefinement.activeCandidates.join('|')===before.join('|'),r.data.heroRefinement);

  r=await s.ask('AとBの条件差をCに適用');
  check('ambiguous delta direction asks',r.data.needsClarification===true&&r.data.savedViewDeltaTransfer===true,r.data);
  check('ambiguous delta direction wording',/どちら側だけにある条件/.test(r.answer),r.answer);

  s=session();
  r=await s.ask('AとBの条件の違い');
  check('bare saved config comparison not stolen',!(r.data&&r.data.savedViewConfigCompared),r.data);
  r=await s.ask('BにあってAにない条件をCに適用');
  check('bare saved delta transfer not stolen',!(r.data&&r.data.savedViewDeltaTransfer),r.data);

  console.log(`HERO MASTER SAVED VIEW CONFIG DIFF: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
