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
const K=global.JINPO_BOT_HERO_KNOWLEDGE,B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function meta(r){return {mode:r.mode||'',data:Object.assign({},r.data||{})};}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:meta(r)});return r;}};}
(async()=>{
  let r=K.respond('豊臣秀長と竹中半兵衛(右腕)で一番差が大きい能力は？',{});
  check('largest raw gap',r.data.pairGap===true&&r.data.gaps.length===1&&r.data.gaps[0].stat==='生命'&&r.data.gaps[0].diff===4857,r);

  r=K.respond('豊臣秀長と竹中半兵衛(右腕)で割合の差が大きい能力トップ3',{});
  check('largest percentage gaps',r.data.percentage===true&&r.data.gaps.length===3&&r.data.gaps[0].stat==='腕力'&&r.data.gaps[0].rate===36.6,r);

  r=K.respond('豊臣秀長と竹中半兵衛(右腕)で差が小さい能力は？',{});
  check('smallest gaps',r.data.smallest===true&&r.data.gaps[0].stat==='知力'&&r.data.gaps[0].diff===17,r);

  r=K.respond('豊臣秀長と竹中半兵衛(右腕)で同じ能力は？',{});
  check('same value stat none',r.data.sameOnly===true&&r.data.gaps.length===0&&/ありません/.test(r.answer),r);

  r=K.respond('豊臣秀長と竹中半兵衛(右腕)の共通点は？',{});
  check('common registered fields',r.data.commonRegistration===true&&r.data.common.cost===7&&r.data.common.factors.join('|')==='知将|名臣',r);

  r=K.respond('母里太兵衛と百地三太夫(野望)と遠足娘まりで能力ごとに誰が一番高い？',{});
  check('multi hero per-stat leaders',r.data.perStatLeaders===true&&r.data.leaders.find(x=>x.stat==='腕力').heroes[0]==='母里太兵衛'&&r.data.leaders.find(x=>x.stat==='知力').heroes[0]==='百地三太夫(野望)',r);

  r=K.respond('母里太兵衛と百地三太夫(野望)と遠足娘まりで一番多く1位を取るのは？',{});
  check('multi hero leader counts',r.data.leaderCounts===true&&r.data.winners.join('|')==='遠足娘まり'&&r.data.counts[0].count===6,r);

  r=K.respond('腕力トップ3で能力ごとのトップは？',{});
  check('nested top set leaders',r.data.nestedRanking===true&&r.data.baseStat==='腕力'&&r.data.heroes.length===3&&r.data.leaders.length===11,r);

  r=K.respond('腕力トップ3で一番多く1位を取るのは？',{});
  check('nested top set winner counts',r.data.nestedRanking===true&&r.data.winners[0]==='遠足娘まり'&&r.data.counts[0].count===6,r);

  let s=session();
  r=await s.ask('豊臣秀長と竹中半兵衛(右腕)を比較');
  check('comparison starts clarification',r.data.needsClarification===true&&r.data.heroes.length===2,r);
  r=await s.ask('一番差が大きい能力は？');
  check('gap followup keeps pair',r.data.pairGap===true&&r.data.gaps[0].stat==='生命',r);
  r=await s.ask('割合だと？');
  check('ratio switch followup',r.data.pairGap===true&&r.data.percentage===true&&r.data.gaps[0].stat==='腕力',r);
  r=await s.ask('登録値だと？');
  check('raw switch followup',r.data.pairGap===true&&r.data.percentage===false&&r.data.gaps[0].stat==='生命',r);

  s=session();
  await s.ask('腕力トップ3');
  r=await s.ask('この中で能力ごとのトップは？');
  check('scope per-stat leaders',r.data.perStatLeaders===true&&r.data.contextScope===true&&r.data.candidates.length===3,r);
  r=await s.ask('一番多く1位を取るのは？');
  check('scope leader counts without rank misread',r.data.leaderCounts===true&&r.data.contextScope===true&&/^直前の候補3人/.test(r.answer),r.answer);

  console.log(`HERO MASTER COMPARISON DRILLDOWN: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
