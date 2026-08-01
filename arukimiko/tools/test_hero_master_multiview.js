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
  let r=K.respond('豊臣秀長の知力は何位？',{});
  check('overall rank',r.data.heroRank===true&&/知力 3006・3位タイ／383人/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長は同じ職業で知力何位？',{});
  check('same job rank',/同じ職業「侍」.*1位タイ／114人/s.test(r.answer),r.answer);
  r=K.respond('母里太兵枝の知力は何位？',{});
  check('rank typo correction',/母里太兵枝.*母里太兵衛/s.test(r.answer)&&/79位/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長の強みと弱みは？',{});
  check('strength weakness profile',r.data.strengthProfile===true&&/知力 3006（3位／383人）/.test(r.answer)&&/魅力 2404（143位／383人）/.test(r.answer),r.answer);
  r=K.respond('母里太兵枝のつよみなに',{});
  check('rough strength typo',/母里太兵衛/.test(r.answer)&&/腕力 3514（1位／383人）/.test(r.answer),r.answer);

  r=K.respond('豊臣秀長と母里太兵衛の違いは？',{});
  check('full comparison order',r.data.fullComparison===true&&r.data.heroes[0]==='豊臣秀長'&&/職業・コスト：豊臣秀長 侍・7 \/ 母里太兵衛 僧・7/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長と母里太兵枝の違いは？',{});
  check('comparison unique typo',/母里太兵枝.*母里太兵衛/s.test(r.answer)&&r.data.fullComparison===true,r.answer);
  r=K.respond('豊臣秀長と豊臣秀なかの違いは？',{});
  check('comparison ambiguous typo asks',r.data.needsClarification===true&&r.data.candidates.length===3,r);
  r=K.respond('豊臣秀長と竹中半兵衛(右腕)の共通因子は？',{});
  check('common factors',r.data.factorComparison===true&&/名臣 \/ 知将|知将 \/ 名臣/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長と母里太兵衛の知力は？',{});
  check('two hero values without compare cue',r.data.comparison===true&&/豊臣秀長：知力 3006/.test(r.answer)&&/母里太兵衛：知力 2610/.test(r.answer),r.answer);

  r=K.respond('因子を4つ持つ英傑は何人？',{});
  check('factor count four',r.data.factorCount===true&&r.data.count===41,r);
  r=K.respond('因子数別の人数は？',{});
  check('factor count groups',/因子2つ：202人/.test(r.answer)&&/因子3つ：140人/.test(r.answer)&&/因子4つ：41人/.test(r.answer),r.answer);
  r=K.respond('望月吉棟と同じ因子構成の英傑は？',{});
  check('same factor set',r.data.sameFactorSet===true&&r.data.count===5&&/服部半蔵/.test(r.answer),r.answer);
  r=K.respond('武田信玄と同じ技能の英傑は？',{});
  check('same skill',r.data.sameSkill===true&&r.data.count===1&&/真田幸隆/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長の因子は何個？',{});
  check('named factor count',r.data.factorCount===4&&/4個/.test(r.answer),r.answer);

  r=K.respond('追加行動する技能の英傑は？',{});
  check('skill detail search',r.data.skillDetailSearch===true&&r.data.count===10&&/豊臣秀長：天下の支柱/.test(r.answer),r.answer);
  r=K.respond('回復する技能の英傑は何人？',{});
  check('skill detail count',r.data.count===34,r);
  r=K.respond('全体攻撃する技能の英傑は何人？',{});
  check('precise all attack count',r.data.count===55,r);
  r=K.respond('全体攻撃と追加行動を持つ英傑は？',{});
  check('two skill concepts and',r.data.count===3&&/小早川隆景\(羽織\)/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長は追加行動する？',{});
  check('named skill detail yes',r.data.skillDetailCheck===true&&r.data.matched===true,r);
  r=K.respond('母里太兵衛は追加行動する？',{});
  check('named skill detail no',r.data.skillDetailCheck===true&&r.data.matched===false,r);

  r=K.respond('侍の平均腕力は？',{});
  check('job average',r.data.aggregateType==='average'&&/2095.9/.test(r.answer),r.answer);
  r=K.respond('コスト7の知力中央値は？',{});
  check('cost median',r.data.aggregateType==='median'&&/2390.5/.test(r.answer),r.answer);
  r=K.respond('職業別の人数は？',{});
  check('job counts',r.data.groupBy==='職業'&&/侍：114人/.test(r.answer),r.answer);
  r=K.respond('コスト別の人数は？',{});
  check('cost counts',r.data.groupBy==='コスト'&&/コスト7：162人/.test(r.answer),r.answer);

  r=K.respond('豊臣秀長の職業とコストと因子は？',{});
  check('multi aspect fields',r.data.aspect==='multiple'&&/職業 侍/.test(r.answer)&&/コスト7/.test(r.answer)&&/因子 軍学/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長の腕力と因子と技能は？',{});
  check('multi aspect with stat',/腕力 2346/.test(r.answer)&&/天下の支柱/.test(r.answer),r.answer);

  r=await B.handle({message:'えいけつでうでりょくたかいのだれ',history:[]});
  check('rough kana ranking route',r.mode==='英傑マスター実データ'&&/母里太兵衛/.test(r.answer),r);
  r=await B.handle({message:'英欠で腕りょく高い人だれ',history:[]});
  check('mixed typo ranking route',r.mode==='英傑マスター実データ'&&/腕力:3514/.test(r.answer),r);
  r=await B.handle({message:'こすと7でちりょくたかいえいけつだれ',history:[]});
  check('rough kana filtered rank',r.mode==='英傑マスター実データ'&&/コスト7/.test(r.answer)&&/仙桃院/.test(r.answer),r);
  r=await B.handle({message:'豊臣秀長のしょくぎょうとこすとといんし',history:[]});
  check('rough multi aspect',/職業 侍/.test(r.answer)&&/コスト7/.test(r.answer)&&/軍学/.test(r.answer),r.answer);
  r=await B.handle({message:'英傑一覧を開いて',history:[]});
  check('navigation still guide',r.mode==='サイト総合案内',r);
  r=await B.handle({message:'腕力高いの検索して',history:[]});
  check('jinpo search not stolen',r.mode!=='英傑マスター実データ',r);

  let s=session();
  r=await s.ask('豊臣秀長と母里太兵衛の違いは？');
  check('pair context base',r.data.fullComparison===true,r);
  r=await s.ask('共通因子は？');
  check('pair common factor followup',r.data.factorComparison===true&&r.data.heroes.length===2,r);
  r=await s.ask('その2人の知力は？');
  check('pair stat followup',r.data.comparison===true&&r.data.stats[0]==='知力',r);
  r=await s.ask('どっちが高い？');
  check('pair stat carry followup',r.data.comparison===true&&/豊臣秀長/.test(r.answer),r);

  console.log(`HERO MASTER MULTIVIEW: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
