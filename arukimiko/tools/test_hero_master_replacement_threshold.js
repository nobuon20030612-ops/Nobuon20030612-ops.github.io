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
  let s=session(),r;
  r=await s.ask('豊臣秀長と竹中半兵衛(右腕)の腕力と知力を比較');
  check('start generic pair comparison',r.data.comparison===true&&r.data.stats.join('|')==='腕力|知力',r);
  r=await s.ask('後者を母里太兵衛に変えて');
  check('replace latter and inherit stats',r.data.comparisonTargetReplaced===true&&r.data.comparison===true&&r.data.heroes.join('|')==='豊臣秀長|母里太兵衛'&&r.data.stats.join('|')==='腕力|知力',r);
  check('replacement answer states old and new',/竹中半兵衛\(右腕\).*母里太兵衛/.test(r.answer),r.answer);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)の腕力を比較');
  r=await s.ask('前者を遠足娘まりに変えて');
  check('replace former',r.data.heroes.join('|')==='遠足娘まり|竹中半兵衛(右腕)'&&r.data.stats[0]==='腕力',r);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)の腕力を比較');
  r=await s.ask('竹中半兵衛(右腕)を母里太兵衛に変えて');
  check('replace by explicit old name',r.data.heroes.join('|')==='豊臣秀長|母里太兵衛',r);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)の腕力を比較');
  r=await s.ask('後者を母里太兵枝に変えて');
  check('unique typo replacement corrected',r.data.heroes.join('|')==='豊臣秀長|母里太兵衛'&&/「母里太兵枝」は「母里太兵衛」/.test(r.answer),r.answer);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)の腕力を比較');
  r=await s.ask('後者を豊臣秀ながに変えて');
  check('ambiguous replacement asks',r.data.needsClarification===true&&r.data.comparisonTargetReplacement===true&&r.data.candidates.length===3,r);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)はどっちが何項目高い？');
  r=await s.ask('後者を母里太兵衛に変えて');
  check('pairwise mode preserved',r.data.comparisonTargetReplaced===true&&r.data.pairwiseWins===true&&r.data.heroes.join('|')==='豊臣秀長|母里太兵衛'&&r.data.wins[0].count===6&&r.data.wins[1].count===5,r);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)で一番差が大きい能力は？');
  r=await s.ask('竹中半兵衛(右腕)じゃなくて遠足娘まり');
  check('pair gap mode preserved',r.data.comparisonTargetReplaced===true&&r.data.pairGap===true&&r.data.gaps.length===1&&r.data.gaps[0].stat==='生命',r);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)の違いを全部比較');
  r=await s.ask('後者を母里太兵衛に変えて');
  check('full comparison mode preserved',r.data.comparisonTargetReplaced===true&&r.data.fullComparison===true&&r.data.heroes.join('|')==='豊臣秀長|母里太兵衛',r);

  s=session();
  await s.ask('豊臣秀長と竹中半兵衛(右腕)を比較');
  r=await s.ask('後者を母里太兵衛に変えて');
  check('replacement without metric keeps clarification',r.data.comparisonTargetReplaced===true&&r.data.needsClarification===true&&r.data.heroes.join('|')==='豊臣秀長|母里太兵衛',r);

  r=K.respond('母里太兵衛と百地三太夫(野望)と遠足娘まりで全員3000以上の能力は？',{});
  check('all heroes threshold',r.data.crossHeroThreshold===true&&r.data.quantifier==='all'&&r.data.stats.join('|')==='生命|気合|腕力',r);

  r=K.respond('母里太兵衛と百地三太夫(野望)と遠足娘まりで全員2500以上の能力は？',{});
  check('all threshold broader',r.data.stats.join('|')==='生命|気合|腕力|知力|魅力',r);

  r=K.respond('母里太兵衛と百地三太夫(野望)と遠足娘まりで全員2500以下の能力は？',{});
  check('all threshold low',r.data.op==='以下'&&r.data.stats.join('|')==='耐久力|土属性',r);

  r=K.respond('母里太兵衛と百地三太夫(野望)と遠足娘まりで誰か1人でも3500以上の能力は？',{});
  check('any hero threshold',r.data.quantifier==='any'&&r.data.stats.join('|')==='生命|気合|腕力',r);

  r=K.respond('母里太兵衛と百地三太夫(野望)と遠足娘まりで全員40000以上の能力は？',{});
  check('no cross threshold result',r.data.crossHeroThreshold===true&&r.data.stats.length===0&&/該当する能力はありません/.test(r.answer),r.answer);

  r=K.respond('母里太兵衛と百地三太夫(野望)と遠足娘まりでぜんいん3000いじょうの能力は？',{});
  check('rough kana cross threshold',r.data.crossHeroThreshold===true&&r.data.stats.join('|')==='生命|気合|腕力',r);

  s=session();
  await s.ask('腕力トップ3');
  r=await s.ask('この中で全員3000以上の能力は？');
  check('context scope cross threshold',r.data.crossHeroThreshold===true&&r.data.contextScope===true&&r.data.candidates.length===3&&r.data.heroes.length===3,r);

  console.log(`HERO MASTER REPLACEMENT THRESHOLD: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
