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
  let r=K.respond('清水康英より腕力も知力も高い英傑は何人？',{});
  check('multi relative intersection count',r.data.relativeMulti===true&&r.data.operation==='intersection'&&r.data.count===348,r);

  r=K.respond('豊臣秀長より腕力か知力のどちらかが高い英傑は何人？',{});
  check('multi relative union count',r.data.operation==='union'&&r.data.count===119,r);

  r=K.respond('豊臣秀長より腕力は高いけど知力は低い英傑は何人？',{});
  check('mixed relative directions',r.data.count===116&&r.data.conditions[0].direction==='high'&&r.data.conditions[1].direction==='low',r);

  r=K.respond('豊臣秀長より全能力が高い英傑はいる？',{});
  check('all stat dominance none',r.data.relativeMulti===true&&r.data.conditions.length===11&&r.data.count===0&&/いません/.test(r.answer),r.answer);

  r=K.respond('豊臣秀長より腕力が高くて同じ職業の英傑トップ3',{});
  check('relative same job',r.data.count===45&&r.data.heroes.join('|')==='真田幸村(神魔)|林崎甚助|伊達政宗(起源)'&&/同じ職業「侍」/.test(r.answer),r);

  r=K.respond('豊臣秀長より腕力が高くて同じコストの英傑は何人？',{});
  check('relative same cost',r.data.count===74&&r.data.filters[0]==='同じコスト7',r);

  r=K.respond('豊臣秀長より腕力が高くてコストが同じか低い英傑は何人？',{});
  check('relative cost at most',r.data.count===91&&r.data.filters[0]==='コスト7以下',r);

  r=K.respond('母里太兵枝よりうでりょくが高い英傑は？',{});
  check('unique typo relative correction',r.data.hero==='母里太兵衛'&&r.data.relative===true&&r.data.count===0&&/「母里太兵枝」は「母里太兵衛」/.test(r.answer),r.answer);

  r=K.respond('豊臣秀ながよりうでりょくも知りょくも高い英傑は？',{});
  check('ambiguous typo asks',r.data.needsClarification===true&&r.data.candidates.length===3,r);

  r=K.respond('豊臣秀長と竹中半兵衛(右腕)はどっちが何項目高い？',{});
  check('pairwise all stats win count',r.data.pairwiseWins===true&&r.data.wins[0].count===3&&r.data.wins[1].count===8&&r.data.stats.length===11,r);

  r=K.respond('豊臣秀長と竹中半兵衛(右腕)で勝ってる能力を教えて',{});
  check('pairwise winning stat names',r.data.wins[0].stats.join('|')==='生命|腕力|耐久力'&&r.data.wins[1].stats.includes('知力'),r);

  r=K.respond('豊臣秀長より高い能力はいくつ？',{});
  check('missing comparison hero clarification',r.data.needsComparisonHero===true&&r.data.needsClarification===true,r);

  r=K.respond('豊臣秀長の上位互換は？',{});
  check('upgrade basis clarification',r.data.needsUpgradeBasis===true&&/因子や技能は単純な上下関係/.test(r.answer),r.answer);

  r=K.respond('母里太兵衛より腕力高い英傑は？',{});
  check('legacy one stat relative metadata',r.data.relative===true&&r.data.stat==='腕力'&&r.data.higher===true&&/いません/.test(r.answer),r);

  r=K.respond('真田幸村(神魔)と腕力が同じ英傑は？',{});
  check('same value not stolen',r.data.sameValue===true&&r.data.heroes.join('|')==='林崎甚助',r);

  let s=session();
  r=await s.ask('豊臣秀長と竹中半兵衛(右腕)はどっちが何項目高い？');
  check('bot pairwise first turn',r.data.pairwiseWins===true&&r.data.wins[1].count===8,r);
  r=await s.ask('その2人で腕力と知力だけならどっちが何項目高い？');
  check('bot pairwise context followup',r.data.pairwiseWins===true&&r.data.stats.join('|')==='腕力|知力'&&r.data.wins[0].count===1&&r.data.wins[1].count===1,r);

  console.log(`HERO MASTER RELATIVE COMPARISON: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
