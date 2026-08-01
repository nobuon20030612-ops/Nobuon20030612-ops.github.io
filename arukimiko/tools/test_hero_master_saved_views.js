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
  r=await s.ask('腕力トップ10');
  check('base ranking creates refinement',r.data.heroRefinement&&r.data.heroRefinement.activeCandidates.length===10,r.data);
  r=await s.ask('今の結果をAとして保存');
  check('save A',r.data.savedViewSaved===true&&r.data.savedViewName==='A'&&r.data.savedViewCount===10,r.data);
  check('saved metadata has A',r.data.heroRefinement.savedViews.length===1&&r.data.heroRefinement.savedViews[0].name==='A',r.data.heroRefinement);
  r=await s.ask('この中で腕力3300以上だけ');
  check('normal refinement preserves A',r.data.heroRefinement.savedViews.length===1&&r.data.count===4,r.data);
  r=await s.ask('今の結果をBとして保存');
  check('save B',r.data.heroRefinement.savedViews.length===2&&r.data.savedViewCount===4,r.data);
  r=await s.ask('保存した結果の一覧');
  check('list saved views',r.data.savedViewList===true&&/A：10人/.test(r.answer)&&/B：4人/.test(r.answer),r.answer);
  r=await s.ask('AとBの違い');
  check('compare A then B',r.data.savedViewCompared===true&&r.data.commonCandidates.length===4&&r.data.onlyFirst.length===6&&r.data.onlySecond.length===0,r.data);
  r=await s.ask('BとAを比較');
  check('comparison respects text order',r.data.savedViewNames[0]==='B'&&r.data.onlyFirst.length===0&&r.data.onlySecond.length===6,r.data);
  r=await s.ask('Aに戻して');
  check('restore A',r.data.savedViewRestored===true&&r.data.count===10&&r.data.stats[0]==='腕力',r.data);
  check('restore preserves both saved views',r.data.heroRefinement.savedViews.length===2,r.data.heroRefinement);
  r=await s.ask('そこから知力順');
  check('edit after restore preserves saved views',r.data.refinementEdited===true&&r.data.heroRefinement.savedViews.length===2,r.data);
  r=await s.ask('今の結果をAとして保存');
  check('overwrite A without duplicate',r.data.savedViewSaved===true&&/上書き保存/.test(r.answer)&&r.data.heroRefinement.savedViews.length===2,r.data);
  check('overwritten A keeps current count',r.data.heroRefinement.savedViews.find(x=>x.name==='A').count===10,r.data.heroRefinement.savedViews);
  r=await s.ask('全英傑で知力トップ5');
  check('new full ranking has five active heroes',r.data.heroRefinement.activeCandidates.length===5,r.data.heroRefinement);
  r=await s.ask('今の結果をCとして保存');
  check('save C from different root',r.data.savedViewCount===5&&r.data.heroRefinement.savedViews.find(x=>x.name==='C').activeCandidates.length===5,r.data);
  r=await s.ask('AとCの違い');
  check('cross-root saved comparison uses exact candidates',r.data.commonCandidates.length===0&&r.data.onlyFirst.length===10&&r.data.onlySecond.length===5,r.data);
  r=await s.ask('Cに戻して');
  check('restore cross-root C exactly',r.data.savedViewRestored===true&&r.data.count===5&&r.data.heroRefinement.rootCandidates.length===5,r.data);
  r=await s.ask('この中で知力3000以上だけ');
  check('refinement after restore stays inside saved result',r.data.count===4&&r.data.heroRefinement.rootCandidates.length===5,r.data);
  r=await s.ask('Bを削除して');
  check('delete B',r.data.savedViewDeleted===true&&!r.data.heroRefinement.savedViews.some(x=>x.name==='B'),r.data);
  r=await s.ask('保存した結果を比較');
  check('compare clarification with one saved view',r.data.needsClarification===true&&r.data.savedViewCommand===true,/2件以上/.test(r.answer));

  s=session();
  await s.ask('知力トップ5');
  r=await s.ask('今の結果を「知力組」として保存');
  check('quoted Japanese save name',r.data.savedViewName==='知力組'&&r.data.savedViewCount===5,r.data);
  r=await s.ask('保存した知力組に戻して');
  check('restore quoted Japanese name',r.data.savedViewRestored===true&&r.data.savedViewName==='知力組',r.data);

  s=session();
  await s.ask('腕力トップ3');
  r=await s.ask('今の結果を保存して');
  check('save without name asks clarification',r.data.needsClarification===true&&r.data.savedViewCommand===true,/保存する名前/.test(r.answer));

  s=session();
  await s.ask('腕力トップ3');
  for(const name of ['A','B','C','D','E','F','G'])await s.ask(`今の結果を${name}として保存`);
  r=await s.ask('保存した結果の一覧');
  check('saved views capped at six',r.data.heroRefinement.savedViews.length===6,r.data.heroRefinement.savedViews.map(x=>x.name));
  check('oldest view dropped at cap',!r.data.heroRefinement.savedViews.some(x=>x.name==='A')&&r.data.heroRefinement.savedViews.some(x=>x.name==='G'),r.data.heroRefinement.savedViews.map(x=>x.name));

  s=session();
  r=await s.ask('今の結果をAとして保存');
  check('save command without hero context is not saved view command',!(r.data&&r.data.savedViewCommand),r.data);

  s=session();
  await s.ask('腕力トップ3');
  await s.ask('今の結果をAとして保存');
  r=await s.ask('前の話に戻って');
  check('ordinary topic restore not stolen by saved view',!(r.data&&r.data.savedViewCommand),r.data);

  console.log(`HERO MASTER SAVED VIEWS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
