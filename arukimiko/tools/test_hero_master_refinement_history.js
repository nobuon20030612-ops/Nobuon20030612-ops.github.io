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
  check('initial ranking has empty undo stack',r.data.heroRefinement&&r.data.heroRefinement.undoStack.length===0,r.data.heroRefinement);
  r=await s.ask('この中で腕力3300以上だけ');
  check('filter records previous state',r.data.heroRefinement&&r.data.heroRefinement.undoStack.length===1,r.data.heroRefinement);
  check('filter records removed heroes',r.data.removedCandidates&&r.data.removedCandidates.length===6,r.data);
  r=await s.ask('誰が外れた？');
  check('removed hero question answered',r.data.refinementChangeAnswered===true&&r.data.changeKind==='removed'&&/村上義清/.test(r.answer),r);
  r=await s.ask('前の結果と何人変わった？');
  check('change summary can follow removed answer',r.data.refinementChangeAnswered===true&&r.data.beforeCount===10&&r.data.afterCount===4,r.data);
  r=await s.ask('そこから知力順');
  check('second edit extends undo stack',r.data.heroRefinement.undoStack.length===2&&r.data.heroRefinement.sortStats[0]==='知力',r.data.heroRefinement);
  r=await s.ask('条件を一つ前に戻して');
  check('first undo removes sorting only',r.data.refinementAction==='undo'&&r.data.count===4&&r.data.heroRefinement.sortStats.length===0&&r.data.heroRefinement.redoStack.length===1,r.data);
  r=await s.ask('直前の変更を取り消して');
  check('second undo restores original ten',r.data.refinementAction==='undo'&&r.data.count===10&&r.data.heroRefinement.undoStack.length===0&&r.data.heroRefinement.redoStack.length===2,r.data);
  check('undo records added heroes',r.data.addedCandidates&&r.data.addedCandidates.length===6,r.data.addedCandidates);
  r=await s.ask('誰が増えた？');
  check('added hero question answered after undo',r.data.changeKind==='added'&&/伊達政宗\(起源\)/.test(r.answer),r.answer);
  r=await s.ask('取り消しをやり直して');
  check('first redo reapplies filter',r.data.refinementAction==='redo'&&r.data.count===4&&r.data.heroRefinement.redoStack.length===1,r.data);
  r=await s.ask('取り消しをやり直して');
  check('second redo reapplies sorting',r.data.refinementAction==='redo'&&r.data.heroRefinement.sortStats[0]==='知力'&&r.data.heroRefinement.redoStack.length===0,r.data);
  r=await s.ask('取り消しをやり直して');
  check('redo exhaustion is explained',r.data.needsClarification===true&&r.data.refinementHistory===true,/やり直せる/.test(r.answer));

  s=session();
  await s.ask('腕力トップ10');
  await s.ask('この中で腕力3300以上だけ');
  r=await s.ask('外れた人を戻して');
  check('restore removed heroes acts as undo',r.data.refinementAction==='undo'&&r.data.count===10,r.data);

  s=session();
  await s.ask('腕力トップ10');
  await s.ask('この中で腕力3300以上だけ');
  await s.ask('腕力条件は外して');
  r=await s.ask('さっき外した条件を戻して');
  check('restore removed condition acts as undo',r.data.refinementAction==='undo'&&r.data.count===4&&r.data.filters.thresholds.length===1,r.data);

  s=session();
  await s.ask('腕力トップ10');
  await s.ask('この中で腕力3300以上だけ');
  await s.ask('そこから知力順');
  await s.ask('条件を一つ前に戻して');
  r=await s.ask('腕力条件は外して');
  check('new edit after undo clears redo',r.data.heroRefinement.redoStack.length===0,r.data.heroRefinement);
  r=await s.ask('取り消しをやり直して');
  check('cleared redo cannot be replayed',r.data.needsClarification===true&&/やり直せる/.test(r.answer),r.answer);

  s=session();
  await s.ask('腕力トップ5');
  r=await s.ask('並びを逆にして');
  check('sort-only edit records zero set difference',r.data.addedCandidates.length===0&&r.data.removedCandidates.length===0,r.data);
  r=await s.ask('前の結果との差は？');
  check('zero difference summary remains available',r.data.beforeCount===5&&r.data.afterCount===5&&/増えた英傑：0人/.test(r.answer),r.answer);

  s=session();
  await s.ask('腕力トップ3');
  r=await s.ask('条件を一つ前に戻して');
  check('undo exhaustion after initial ranking',r.data.needsClarification===true&&/これ以上戻せる/.test(r.answer),r.answer);
  r=await s.ask('前の話に戻って');
  check('ordinary topic restore not marked as refinement history',!(r.data&&r.data.refinementHistoryEdited),r.data);

  console.log(`HERO MASTER REFINEMENT HISTORY: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
