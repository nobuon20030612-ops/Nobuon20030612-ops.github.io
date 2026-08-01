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
(async()=>{
  let r=K.respond('腕力2500前後の英傑は？',{});
  check('numeric near handled',r.data.nearest===true&&r.data.target===2500,r);
  check('numeric near first',/1位：伊達政宗（腕力:2499 \/ 差:1）/.test(r.answer),r.answer);
  r=K.respond('腕力2500くらいのトップ3',{});
  check('numeric near top count',r.data.heroes.length===3&&/3位：尼子晴久/.test(r.answer),r);
  r=K.respond('うでりょく2500ぜんごの英傑',{});
  check('rough kana near',r.data.nearest===true&&/伊達政宗/.test(r.answer),r);

  r=K.respond('腕力2000台の英傑は何人？',{});
  check('thousand band count',r.data.valueRange===true&&r.data.count===125,r);
  r=K.respond('腕力2500から2600の英傑は何人？',{});
  check('explicit range count',r.data.valueRange===true&&r.data.count===13,r);
  r=K.respond('腕力2500〜2600の英傑を教えて',{});
  check('explicit range list',r.data.valueRange===true&&/島津豊久（腕力:2588）/.test(r.answer),r.answer);

  r=K.respond('腕力6位から10位を教えて',{});
  check('rank range handled',r.data.rankRange===true&&r.data.start===6&&r.data.end===10,r);
  check('rank range exact rows',/6位：今川義元\(周年\)/.test(r.answer)&&/10位：伊達政宗\(起源\)/.test(r.answer),r.answer);
  r=K.respond('腕力10位から6位を教えて',{});
  check('reversed rank range normalized',r.data.rankRange===true&&r.data.start===6&&r.data.end===10,r);

  r=K.respond('腕力上位10%は何人？',{});
  check('upper percentile count',r.data.percentile===true&&r.data.count===39&&r.data.cutoff===2966,r);
  r=K.respond('腕力下位5%は誰？',{});
  check('lower percentile list',r.data.percentile===true&&r.data.low===true&&r.data.count===20&&r.data.cutoff===668,r);
  check('lower percentile first',/1位：安藤良整（腕力:493）/.test(r.answer),r.answer);

  r=K.respond('豊臣秀長に知力が近い英傑は？',{});
  check('named nearest',r.data.nearest===true&&r.data.hero==='豊臣秀長'&&r.data.heroes[0]==='豊臣秀吉',r);
  r=K.respond('真田幸村(神魔)と腕力が同じ英傑は？',{});
  check('named same value',r.data.sameValue===true&&r.data.count===1&&r.data.heroes[0]==='林崎甚助',r);
  r=K.respond('母里太兵衛と腕力が同じ英傑は？',{});
  check('named same value none',r.data.sameValue===true&&r.data.count===0,r);
  r=K.respond('腕力が同じ英傑はいる？',{});
  check('generic tie groups',r.data.sameValueGroups===true&&r.data.count===51,r);
  check('generic tie top group',/腕力 3258：林崎甚助 \/ 真田幸村\(神魔\)/.test(r.answer),r.answer);

  r=K.respond('職業別の腕力平均は？',{});
  check('job grouped average',r.data.groupAggregate===true&&r.data.groupBy==='職業'&&/傾奇者：2536（25人）/.test(r.answer),r);
  r=K.respond('コスト別の知力中央値は？',{});
  check('cost grouped median',r.data.groupAggregate===true&&r.data.groupBy==='コスト'&&/コスト7：2390.5（162人）/.test(r.answer),r);

  r=K.respond('総合的に強い英傑は？',{});
  check('vague overall asks metric',r.data.needsClarification===true&&r.data.needsMetric===true,r);
  r=K.respond('腕力と知力のバランスがいい英傑は？',{});
  check('vague balance asks metric',r.data.needsClarification===true&&/評価基準/.test(r.answer),r);
  r=K.respond('腕力と知力の合計が高い英傑トップ3',{});
  check('explicit combined metric still works',r.data.ranking===true&&r.data.stats.length===2&&/片倉景綱\(右腕\)/.test(r.answer),r);

  r=await B.handle({message:'腕力2500前後の英傑は？',history:[]});
  check('bot routes numeric near',r.mode==='英傑マスター実データ'&&/伊達政宗/.test(r.answer),r);
  r=await B.handle({message:'職業別の腕力平均は？',history:[]});
  check('bot routes grouped aggregate',r.mode==='英傑マスター実データ'&&/傾奇者：2536/.test(r.answer),r);
  r=await B.handle({message:'腕力高いの検索して',history:[]});
  check('jinpo search boundary retained',r.mode!=='英傑マスター実データ',r);
  r=await B.handle({message:'鬼神石の腕力2500前後',history:[]});
  check('tool boundary retained',r.mode!=='英傑マスター実データ',r);

  console.log(`HERO MASTER RANGES: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
