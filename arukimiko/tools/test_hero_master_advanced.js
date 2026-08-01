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
  let r=K.respond('腕力と知力が両方上位10%の英傑は？',{});
  check('shared multi percentile',r.data.multiPercentile===true&&r.data.count===1&&r.data.heroes[0]==='片倉景綱(右腕)',r);
  check('shared percentile boundaries',r.data.conditions[0].cutoff===2966&&r.data.conditions[1].cutoff===2854,r.data.conditions);
  r=K.respond('腕力上位10%で知力上位20%の英傑は？',{});
  check('per stat percent conditions',r.data.multiPercentile===true&&r.data.count===7&&/黒田長政/.test(r.answer),r);
  r=K.respond('腕力は上位10%で知力は下位10%の英傑は何人？',{});
  check('mixed upper lower percentile',r.data.multiPercentile===true&&r.data.count===0,r);

  r=K.respond('腕力と知力が平均以上の英傑は何人？',{});
  check('multi average threshold count',r.data.averageThreshold===true&&r.data.count===96,r);
  r=K.respond('侍で腕力が平均以上の英傑は？',{});
  check('filtered average threshold',r.data.averageThreshold===true&&r.data.count===66&&/平均 2095.9/.test(r.answer),r);
  r=K.respond('腕力と知力が平均以上の英傑トップ3',{});
  check('average threshold list',r.data.heroes.length===3&&r.data.heroes[0]==='片倉景綱(右腕)'&&r.data.heroes[2]==='百地三太夫(野望)',r);

  r=K.respond('豊臣秀長と腕力と知力が近い英傑トップ3',{});
  check('multi stat nearest',r.data.nearestMulti===true&&r.data.heroes.join('|')==='豊臣秀吉|武田晴信|北条氏康(獅子)',r);
  check('multi nearest explains normalization',/正規化/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長と同じ職業で腕力と知力が近い英傑トップ3',{});
  check('same job multi nearest',r.data.nearestMulti===true&&r.data.filters[0]==='同じ職業「侍」'&&r.data.heroes[0]==='豊臣秀吉',r);
  r=K.respond('豊臣秀長に似た英傑は？',{});
  check('vague similarity asks basis',r.data.needsClarification===true&&r.data.needsSimilarityBasis===true,r);

  r=K.respond('全能力でトップ10入りが多い英傑は？',{});
  check('all stat top entry count',r.data.topEntryCount===true&&r.data.topN===10&&r.data.heroes.length===5,r);
  check('all stat top entry leaders',r.data.heroes[0]==='竹中半兵衛(右腕)'&&r.data.counts[0].count===5&&r.data.heroes[1]==='陶晴賢',r);
  r=K.respond('腕力と知力でトップ20入りが多い英傑トップ5',{});
  check('selected stat top entry',r.data.topEntryCount===true&&r.data.heroes.length===5&&r.data.heroes[0]==='片倉景綱(右腕)'&&r.data.counts[0].count===2,r);

  r=K.respond('平均腕力が一番高い職業は？',{});
  check('job average leader',r.data.groupAggregateRanking===true&&r.data.groups.length===1&&r.data.groups[0].group==='傾奇者'&&r.data.groups[0].value===2536,r);
  r=K.respond('職業の平均腕力ランキング',{});
  check('job average ranking',r.data.groupAggregateRanking===true&&r.data.groups.length===5&&r.data.groups[1].group==='忍者',r);
  r=K.respond('平均知力が一番低いコストは？',{});
  check('cost average low leader',r.data.groupAggregateRanking===true&&r.data.low===true&&r.data.groups[0].group==='4'&&r.data.groups[0].value===840.3,r);
  r=K.respond('職業別の腕力平均は？',{});
  check('plain grouped average retained',r.data.groupAggregate===true&&!r.data.groupAggregateRanking&&/傾奇者：2536/.test(r.answer),r);

  r=K.respond('因子を4つ持つ英傑は何人？',{});
  check('dash placeholder excluded from factor count',r.data.factorCount===true&&r.data.count===41,r);
  r=K.respond('三条の方の因子は？',{});
  check('dash placeholder excluded from named factors',/仏門 \/ 女傑 \/ 内助の功/.test(r.answer)&&!/ー/.test(r.answer),r.answer);

  r=await B.handle({message:'えいけつでうでりょくとちりょくがりょうほうじょうい10ぱーせんと',history:[]});
  check('rough kana multi percentile route',r.mode==='英傑マスター実データ'&&r.data.multiPercentile===true&&/片倉景綱/.test(r.answer),r);
  r=await B.handle({message:'侍でうでりょくがへいきんいじょうのえいけつ',history:[]});
  check('rough kana average threshold route',r.mode==='英傑マスター実データ'&&r.data.averageThreshold===true&&r.data.count===66,r);
  r=await B.handle({message:'豊臣秀長とうでりょくとちりょくがにてるえいけつ',history:[]});
  check('rough kana multi nearest route',r.mode==='英傑マスター実データ'&&r.data.nearestMulti===true&&r.data.heroes[0]==='豊臣秀吉',r);
  r=await B.handle({message:'ぜんのうりょくでとっぷ10いりがおおいえいけつ',history:[]});
  check('rough kana top entry route',r.mode==='英傑マスター実データ'&&r.data.topEntryCount===true&&r.data.heroes[0]==='竹中半兵衛(右腕)',r);

  r=await B.handle({message:'腕力高いの検索して',history:[]});
  check('jinpo search boundary retained',r.mode!=='英傑マスター実データ',r);
  r=await B.handle({message:'鬼神石で腕力が平均以上のもの',history:[]});
  check('tool average boundary retained',r.mode!=='英傑マスター実データ',r);

  let s=session();
  r=await s.ask('全能力でトップ10入りが多い英傑は？');
  check('top entry context base',r.data.topEntryCount===true,r);
  r=await s.ask('1位の因子は？');
  check('top entry ordinal followup',r.data.hero==='竹中半兵衛(右腕)'&&/知将/.test(r.answer),r);

  s=session();
  r=await s.ask('豊臣秀長と腕力と知力が近い英傑トップ3');
  check('nearest context base',r.data.nearestMulti===true,r);
  r=await s.ask('2位の技能は？');
  check('nearest ordinal followup',r.data.hero==='武田晴信'&&/技能/.test(r.answer),r);

  console.log(`HERO MASTER ADVANCED: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
