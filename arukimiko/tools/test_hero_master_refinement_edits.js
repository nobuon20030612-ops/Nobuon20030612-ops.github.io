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
  check('ranking creates refinement memory',r.data.heroRefinement&&r.data.heroRefinement.rootCandidates.length===10,r.data);
  const root=r.data.heroRefinement.rootCandidates.slice();
  r=await s.ask('この中で腕力3300以上だけ');
  check('threshold narrows candidates',r.data.heroRefinement&&r.data.heroRefinement.activeCandidates.length===4,r.data);
  check('root candidates preserved after filter',r.data.heroRefinement.rootCandidates.join('|')===root.join('|'),r.data.heroRefinement);
  r=await s.ask('そこから知力順');
  check('short rerank stores sort stat',r.data.refinementEdited===true&&r.data.heroRefinement.sortStats.join('|')==='知力'&&r.data.count===4,r.data);
  r=await s.ask('知力条件は外して');
  check('sort-only condition removal stays in hero route',r.data.refinementEdited===true&&r.data.refinementAction==='removeSort'&&r.data.count===4&&!r.data.heroRefinement.sortStats.length,r.data);
  r=await s.ask('腕力条件は外して');
  check('threshold removal restores root candidates',r.data.refinementEdited===true&&r.data.count===10&&r.data.heroRefinement.filters.thresholds.length===0,r.data);
  check('threshold removal answer distinguishes filter',/腕力の数値条件を解除/.test(r.answer),r.answer);

  s=session();
  await s.ask('腕力トップ5');
  r=await s.ask('並びを逆にして');
  check('reverse ordering supported',r.data.refinementEdited===true&&r.data.low===true&&r.data.heroes.length===5,r.data);
  r=await s.ask('高い順に戻して');
  check('high ordering restore supported',r.data.refinementEdited===true&&r.data.low===false,r.data);
  r=await s.ask('腕力じゃなくて知力順にして');
  check('metric switch uses latter stat',r.data.refinementEdited===true&&r.data.stats.join('|')==='知力',r.data);
  r=await s.ask('知力じゃなくて腕力順にして');
  check('reverse wording metric switch uses textual latter stat',r.data.stats.join('|')==='腕力',r.data);
  r=await s.ask('並び順を元に戻して');
  check('sorting reset keeps candidates',r.data.refinementEdited===true&&!r.data.stats.length&&r.data.count===5,r.data);
  r=await s.ask('条件を全部外して');
  check('all condition reset supported',r.data.refinementAction==='resetAll'&&r.data.count===5,r.data);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)と母里太兵衛で能力ごとのトップを教えて');
  r=await s.ask('母里太兵衛を遠足娘まりに入れ替えて');
  check('explicit group member replacement',r.data.groupTargetReplaced===true&&r.data.perStatLeaders===true&&r.data.heroes.join('|')==='豊臣秀長|竹中半兵衛(右腕)|遠足娘まり',r.data);
  check('group replacement recalculates leaders',r.data.leaders.find(x=>x.stat==='腕力').heroes[0]==='遠足娘まり',r.data.leaders);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)と母里太兵衛で能力ごとのトップを教えて');
  r=await s.ask('3人目を遠足娘まりに変えて');
  check('ordinal group replacement',r.data.groupTargetReplaced===true&&r.data.heroes[2]==='遠足娘まり',r.data);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)と母里太兵衛で共通点を教えて');
  r=await s.ask('後者を遠足娘まりに変えて');
  check('group replacement takes precedence over pair replacement',r.data.groupTargetReplaced===true&&r.data.heroes.join('|')==='豊臣秀長|遠足娘まり|母里太兵衛',r.data);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)と母里太兵衛で能力ごとのトップを教えて');
  r=await s.ask('3人目を母里太兵枝に変えて');
  check('same hero duplicate blocked after typo correction',r.data.needsClarification===true&&r.data.groupTargetReplacement===true,r.data);

  console.log(`HERO MASTER REFINEMENT EDITS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
