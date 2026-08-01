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
  await s.ask('腕力トップ10');await s.ask('今の結果をAとして保存');
  await s.ask('全英傑で知力トップ10');await s.ask('今の結果をBとして保存');
  const before=(await s.ask('保存した結果の一覧')).data.heroRefinement.activeCandidates.slice();

  r=await s.ask('Aから知力2500以上だけ表示して');
  check('single saved transform handled',r.data.savedViewTransform===true&&r.data.savedViewSource==='A'&&r.data.count===5,r.data);
  check('single transform keeps saved views',r.data.heroRefinement.savedViews.some(v=>v.name==='A')&&r.data.heroRefinement.savedViews.some(v=>v.name==='B'),r.data.heroRefinement.savedViews);
  check('single transform root is source exact set',r.data.heroRefinement.rootCandidates.length===10,r.data.heroRefinement);

  r=await s.ask('Aを侍だけにしてCとして保存');
  check('transform and save direct name',r.data.savedViewSaved===true&&r.data.savedViewName==='C'&&r.data.savedViewCount===3,r.data);
  check('saved transform records filter',r.data.heroRefinement.savedViews.find(v=>v.name==='C').displayFilters.job==='侍',r.data.heroRefinement.savedViews);

  r=await s.ask('Cに戻して');
  check('restore transformed saved view',r.data.savedViewRestored===true&&r.data.count===3,r.data);
  r=await s.ask('この中で知力2500以上だけ');
  check('refine transformed root only',r.data.heroRefinement.rootCandidates.length===3&&r.data.count<=3,r.data);

  r=await s.ask('Aを知力順で表示して');
  check('saved transform sort only',r.data.savedViewTransform===true&&r.data.count===10&&r.data.stats[0]==='知力',r.data);
  check('sort-only transform starts with expected hero',r.data.heroes[0]==='百地三太夫(野望)',r.data.heroes);

  const currentBeforeBatch=r.data.heroRefinement.activeCandidates.slice();
  r=await s.ask('AとBに知力2500以上をかけて比較');
  check('batch condition compare handled',r.data.savedViewTransformCompared===true&&r.data.savedViewNames[0]==='A'&&r.data.savedViewNames[1]==='B',r.data);
  check('batch compare counts',r.data.leftCandidates.length===5&&r.data.rightCandidates.length===10,r.data);
  check('batch compare does not change current set',JSON.stringify(r.data.heroRefinement.activeCandidates)===JSON.stringify(currentBeforeBatch),r.data.heroRefinement);

  r=await s.ask('AとBをそれぞれ知力順で比較');
  check('batch sort compare handled',r.data.savedViewTransformCompared===true&&r.data.stats[0]==='知力',r.data);
  check('batch sort keeps exact source sizes',r.data.leftCandidates.length===10&&r.data.rightCandidates.length===10,r.data);

  r=await s.ask('Aから知力9999以上だけ表示して');
  check('zero transform keeps context',r.data.savedViewTransform===true&&r.data.count===0,r.data);
  check('zero transform preserves current candidates',JSON.stringify(r.data.heroRefinement.activeCandidates)===JSON.stringify(currentBeforeBatch),r.data.heroRefinement);

  r=await s.ask('Aを侍だけにして保存');
  check('transform save without name clarifies',r.data.needsClarification===true&&r.data.savedViewTransform===true,r.data);

  r=await s.ask('AとBに同じ条件をかけて比較');
  check('batch transform missing condition clarifies',r.data.needsClarification===true&&r.data.savedViewTransform===true,r.data);

  s=session();r=await s.ask('Aから知力2500以上だけ表示して');
  check('no saved context not stolen',!(r.data&&r.data.savedViewTransform),r.data);

  console.log(`HERO MASTER SAVED VIEW TRANSFORMS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
