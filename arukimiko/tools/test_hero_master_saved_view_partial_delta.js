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
  const s=session();let r;
  await s.ask('腕力トップ20');
  await s.ask('今の結果をAとして保存');
  await s.ask('侍だけ');
  await s.ask('知力2500以上だけ');
  await s.ask('今の結果をBとして保存');
  await s.ask('Aに戻して');
  await s.ask('今の結果をCとして保存');

  r=await s.ask('BにあってAにない条件のうち職業条件だけをCに適用して表示');
  check('partial delta job handled',r.data.savedViewDeltaTransfer===true&&r.data.deltaConditionSelection==='only',r.data);
  check('partial delta exposes all conditions',r.data.allDeltaConditions.includes('職業「侍」')&&r.data.allDeltaConditions.includes('知力2500以上'),r.data);
  check('partial delta selects only job',r.data.selectedDeltaConditions.length===1&&r.data.selectedDeltaConditions[0]==='職業「侍」',r.data);
  check('partial delta job result',r.data.count===7&&r.data.filters.job==='侍'&&r.data.filters.thresholds.length===0,r.data);

  r=await s.ask('BにあってAにない条件のうちしょくぎょうじょうけんだけをCに適用して表示');
  check('rough kana job selector handled',r.data.savedViewDeltaTransfer===true&&r.data.selectedDeltaConditions.length===1&&r.data.selectedDeltaConditions[0]==='職業「侍」',r.data);
  check('rough kana job selector result',r.data.count===7&&r.data.filters.job==='侍',r.data);

  r=await s.ask('BにあってAにない条件のうち知力条件だけをCに適用して表示');
  check('partial delta stat handled',r.data.savedViewDeltaTransfer===true&&r.data.deltaConditionSelection==='only',r.data);
  check('partial delta stat selection',r.data.selectedDeltaConditions.length===1&&r.data.selectedDeltaConditions[0]==='知力2500以上',r.data);
  check('partial delta stat result',r.data.count===9&&r.data.filters.job===''&&r.data.filters.thresholds[0].stat==='知力',r.data);

  r=await s.ask('BにあってAにない条件のうち職業条件以外をCに適用して表示');
  check('partial delta exclusion handled',r.data.savedViewDeltaTransfer===true&&r.data.deltaConditionSelection==='except',r.data);
  check('partial delta exclusion result',r.data.count===9&&r.data.deltaConditions.length===1&&r.data.deltaConditions[0]==='知力2500以上',r.data);

  r=await s.ask('BにあってAにない職業条件を反転してCに適用して表示');
  check('job inversion handled',r.data.savedViewDeltaTransfer===true&&r.data.deltaInverted===true,r.data);
  check('job inversion condition',r.data.deltaConditions.length===1&&r.data.deltaConditions[0]==='職業「侍」を除外',r.data);
  check('job inversion result',r.data.count===13&&r.data.filters.excludedJobs.includes('侍'),r.data);

  r=await s.ask('BにあってAにないしょくぎょう条件をはんてんしてCに適用して表示');
  check('rough kana inversion handled',r.data.savedViewDeltaTransfer===true&&r.data.deltaInverted===true,r.data);
  check('rough kana inversion result',r.data.count===13&&r.data.filters.excludedJobs.includes('侍'),r.data);

  r=await s.ask('BにあってAにない知力条件を反転してCに適用して表示');
  check('threshold inversion handled',r.data.savedViewDeltaTransfer===true&&r.data.deltaInverted===true,r.data);
  check('threshold inversion condition',r.data.deltaConditions.length===1&&r.data.deltaConditions[0]==='知力2500未満',r.data);
  check('threshold inversion result',r.data.count===11&&r.data.filters.thresholds[0].op==='未満',r.data);

  r=await s.ask('BにあってAにない条件のうちコスト条件だけをCに適用して表示');
  check('missing selected delta asks',r.data.needsClarification===true&&r.data.savedViewDeltaTransfer===true,r.data);
  check('missing selected delta lists available',r.data.allDeltaConditions.includes('職業「侍」')&&r.data.allDeltaConditions.includes('知力2500以上'),r.data);

  r=await s.ask('BにあってAにない職業条件だけをCに適用してDとして保存');
  check('partial delta save handled',r.data.savedViewSaved===true&&r.data.savedViewName==='D'&&r.data.savedViewCount===7,r.data);
  const d=r.data.heroRefinement.savedViews.find(v=>v.name==='D');
  check('partial delta save metadata',!!d&&d.displayFilters.job==='侍'&&d.displayFilters.thresholds.length===0&&d.activeCandidates.length===7,d);

  const bare=session();
  r=await bare.ask('BにあってAにない職業条件だけをCに適用して表示');
  check('bare partial delta not stolen',!(r.data&&r.data.savedViewDeltaTransfer),r.data);

  console.log(`HERO MASTER SAVED VIEW PARTIAL DELTA: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
