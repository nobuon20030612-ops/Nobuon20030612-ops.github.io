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
function meta(r){return {mode:r.mode||'',data:{heroKnowledge:!!(r.data&&r.data.heroKnowledge),hero:String(r.data&&r.data.hero||''),heroes:Array.isArray(r.data&&r.data.heroes)?r.data.heroes.slice():[],candidates:Array.isArray(r.data&&r.data.candidates)?r.data.candidates.slice():[],needsClarification:!!(r.data&&r.data.needsClarification),stats:Array.isArray(r.data&&r.data.stats)?r.data.stats.slice():[]}};}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:meta(r)});return r;}};}
(async()=>{
  let s=session(),r=await s.ask('腕力トップ10');
  check('base top ten',r.data.ranking===true&&r.data.heroes.length===10&&r.data.heroes[0]==='母里太兵衛',r);
  r=await s.ask('この中で知力が一番高いのは？');
  check('scope highest intellect',r.data.contextScope===true&&r.data.heroes[0]==='百地三太夫(野望)'&&r.data.candidates.length===10,r);
  r=await s.ask('この中で侍は何人？');
  check('scope job count',r.data.value===3&&/職業「侍」/.test(r.answer),r.answer);
  r=await s.ask('この中の平均知力は？');
  check('scope average through bot route',r.mode==='英傑マスター実データ'&&r.data.aggregateType==='average'&&/2449\.7/.test(r.answer),r);
  r=await s.ask('この中で知力上位3人は？');
  check('scope rerank top three',r.data.heroes.join('|')==='百地三太夫(野望)|母里太兵衛|遠足娘まり',r.data.heroes);
  r=await s.ask('この中の職業内訳は？');
  check('scope job breakdown',r.data.groupBy==='職業'&&/侍：3人/.test(r.answer)&&/僧：3人/.test(r.answer),r.answer);
  r=await s.ask('この中のコスト内訳は？');
  check('scope cost breakdown',r.data.groupBy==='コスト'&&r.data.candidates.length===10,r);
  r=await s.ask('3位から5位の技能は？');
  check('range skill fields',r.data.heroes.join('|')==='遠足娘まり|明智光秀(闇)|村上義清'&&/登録なし/.test(r.answer)&&/一騎断魂/.test(r.answer),r.answer);
  r=await s.ask('3位と5位の因子を比較');
  check('selected factor comparison',r.data.heroes.join('|')==='遠足娘まり|村上義清'&&/共通因子：なし/.test(r.answer),r.answer);
  r=await s.ask('上位3人の職業は？');
  check('top three occupations',r.data.heroes.length===3&&/母里太兵衛：職業 僧/.test(r.answer)&&/遠足娘まり：職業 傾奇者/.test(r.answer),r.answer);
  r=await s.ask('2位の職業は？');
  check('single positional field',r.data.hero==='百地三太夫(野望)'&&/職業は「忍者」/.test(r.answer),r.answer);
  r=await s.ask('最初の2人のコストは？');
  check('first two field',Array.isArray(r.data.heroes)&&r.data.heroes.join('|')==='母里太兵衛|百地三太夫(野望)'&&/コスト7/.test(r.answer),r.answer);
  r=await s.ask('この中で一番多い因子は？');
  check('scope factor frequency',r.data.factorFrequency===true&&/僧兵（3人）/.test(r.answer),r.answer);
  r=await s.ask('この中で腕力3300以上は何人？');
  check('scope threshold count',r.data.value===4&&/4人/.test(r.answer),r.answer);
  r=await s.ask('この中で僧兵持ちは？');
  check('factor does not become job filter',r.data.count===3&&/因子「僧兵」/.test(r.answer)&&!/職業「僧」/.test(r.answer),r.answer);
  r=await s.ask('12位の技能は？');
  check('out of range asks',r.data.invalidContextRank===true&&r.data.needsClarification===true&&/1位〜10位/.test(r.answer),r);
  r=await s.ask('この中で一番強いのは？');
  check('ambiguous scoped metric asks',r.data.needsMetric===true&&r.data.candidates.length===10,r);

  r=K.respond('この中で知力が一番高いのは？',{});
  check('no scope asks clarification',r.data.needsHeroScope===true&&r.data.needsClarification===true,r);
  r=K.respond('腕力3位は誰？',{});
  check('global rank three',r.data.globalRankReference===true&&/遠足娘まり/.test(r.answer),r.answer);
  r=K.respond('知力10位の英傑を教えて',{});
  check('global intellect rank ten',r.data.globalRankReference===true&&/北条氏照\(剛柔\)/.test(r.answer),r.answer);
  r=K.respond('腕力3位の因子は？',{});
  check('global rank field',/遠足娘まり/.test(r.answer)&&/殺陣/.test(r.answer),r.answer);

  s=session();
  await s.ask('腕力トップ10');
  await s.ask('なるほど');
  r=await s.ask('この中で知力トップ2');
  check('scope survives smalltalk',r.data.heroes.join('|')==='百地三太夫(野望)|母里太兵衛'&&r.data.candidates.length===10,r);
  r=await s.ask('3位の因子は？');
  check('original scope preserved after subset',r.data.hero==='遠足娘まり'&&/殺陣/.test(r.answer),r.answer);

  r=await B.handle({message:'腕力高いの検索して',history:[]});
  check('jinpo search not stolen',r.mode!=='英傑マスター実データ',r);
  r=await B.handle({message:'英傑一覧を開いて',history:[]});
  check('hero list navigation remains guide',r.mode==='サイト総合案内',r);

  console.log(`HERO MASTER CONTEXT SCOPE: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
