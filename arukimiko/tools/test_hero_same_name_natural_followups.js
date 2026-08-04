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
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js',
  'jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot.js','jinpo-bot-persona.js'
].forEach(load);
const K=global.JINPO_BOT_HERO_KNOWLEDGE,B=global.JINPO_BOT,D=global.JINPO_BOT_HERO_DATA;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function baseName(name){return String(name||'').normalize('NFKC').replace(/\([^()]*\)$/,'').trim();}
function historyPush(h,q,r){h.push({role:'user',text:q},{role:'assistant',text:r.answer,meta:{data:r.data,mode:r.mode}});}
(async()=>{
  const ni=D.columns.indexOf('英傑名'),families=new Map();
  for(const row of D.rows){const name=row[ni],base=baseName(name);if(!families.has(base))families.set(base,[]);families.get(base).push(name);}
  const groups=[...families.entries()].filter(([,names])=>names.length>=2);
  check('same-name groups remain auto-derived',groups.length===64,{count:groups.length});

  for(const [base,names] of groups){
    let r=K.respond(`${base}を全部教えて`,{});
    check(`plain family list: ${base}`,r.handled&&r.data&&r.data.nameFamily===true&&r.data.query===base&&r.data.count===names.length&&r.data.heroes.join('|')===names.join('|'),r);

    r=K.respond(`${base}を全種類教えて`,{});
    check(`all kinds returns list: ${base}`,r.handled&&r.data&&r.data.nameFamily===true&&r.data.count===names.length&&Array.isArray(r.data.heroes)&&r.data.heroes.join('|')===names.join('|')&&names.every(n=>r.answer.includes(n)),r);

    r=K.respond(`${base}は何種類？`,{});
    check(`kind count: ${base}`,r.handled&&r.data&&r.data.nameFamily===true&&r.data.count===names.length&&r.data.familyCountKind==='種類'&&r.answer.includes(`${names.length}種類`),r);

    r=K.respond(`${base}と同じ名前の英傑を教えて`,{});
    check(`same-name wording: ${base}`,r.handled&&r.data&&r.data.nameFamily===true&&r.data.count===names.length&&r.data.heroes.join('|')===names.join('|'),r);

    r=K.respond(`${base}の別版を教えて`,{});
    const expected=names.filter(n=>n!==base);
    check(`variant wording: ${base}`,r.handled&&r.data&&r.data.nameFamily===true&&r.data.familyVariantsOnly===true&&r.data.count===expected.length&&r.data.heroes.join('|')===expected.join('|'),r);
  }

  const overviewPhrases=[
    '同じ名前が複数いる英傑を教えて','名前が同じ英傑を教えて','英傑名が同じものを一覧で',
    '同じ武将が何人もいるやつ教えて','別バージョンがある英傑を教えて','別衣装がある英傑を教えて','同名英傑一覧'
  ];
  for(const phrase of overviewPhrases){
    const overview=K.respond(phrase,{});
    check(`generic same-name overview: ${phrase}`,overview.handled&&overview.data&&overview.data.sameNameGroupOverview===true&&overview.data.groupCount===64&&overview.data.heroCount===142&&/真田幸村/.test(overview.answer)&&/明智光秀/.test(overview.answer),overview);
  }
  let direct=K.respond('豊臣秀長と竹中半兵衛の違いを全部比較',{});
  check('unsuffixed exact pair comparison is not stolen by family list',direct.handled&&direct.data&&direct.data.fullComparison===true&&direct.data.heroes.join('|')==='豊臣秀長|竹中半兵衛',direct);
  direct=K.respond('豊臣秀長と竹中半兵衛(右腕)の違いを全部比較',{});
  check('explicit variant pair comparison is not stolen by family list',direct.handled&&direct.data&&direct.data.fullComparison===true&&direct.data.heroes.join('|')==='豊臣秀長|竹中半兵衛(右腕)',direct);
  direct=K.respond('真田幸村の 新星だけ教えて',{});
  check('variant label works after a normal space',direct.handled&&direct.data&&direct.data.hero==='真田幸村(新星)',direct);

  let h=[];
  let q='真田幸村を全部教えて',r=await B.handle({message:q,history:h});historyPush(h,q,r);
  q='どれが一番知力高い？';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  check('family ranking narrows to one exact variant',r.data&&r.data.heroKnowledge===true&&Array.isArray(r.data.heroes)&&r.data.heroes.length===1&&r.data.heroes[0]==='真田幸村(神魔)',r);
  q='その人の技能は？';r=await B.handle({message:q,history:h});
  check('pronoun follows newest one-result ranking',r.data&&r.data.hero==='真田幸村(神魔)'&&/真田幸村\(神魔\)の技能/.test(r.answer),r);

  h=[];q='真田幸村を全部教えて';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  q='その人の技能は？';r=await B.handle({message:q,history:h});
  check('singular pronoun after multi-hero family asks which one',r.mode==='会話文脈'&&/複数候補/.test(r.answer)&&/真田幸村\(神魔\)/.test(r.answer),r);

  h=[];q='真田幸村を全部教えて';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  q='どれが一番知力高い？';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  q='了解';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  q='その人の技能は？';r=await B.handle({message:q,history:h});
  check('pronoun keeps one-result ranking across one acknowledgement',r.data&&r.data.hero==='真田幸村(神魔)'&&/真田幸村\(神魔\)の技能/.test(r.answer),r);

  h=[];q='真田幸村を全部教えて';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  q='了解';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  q='その人の技能は？';r=await B.handle({message:q,history:h});
  check('multi-hero family remains ambiguous across one acknowledgement',r.mode==='会話文脈'&&/複数候補/.test(r.answer),r);

  h=[];q='お市を全部教えて';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  q='どれが一番腕力高い？';r=await B.handle({message:q,history:h});historyPush(h,q,r);
  const top=Array.isArray(r.data&&r.data.heroes)&&r.data.heroes.length===1?r.data.heroes[0]:'';
  q='その人の因子は？';r=await B.handle({message:q,history:h});
  check('pronoun works for family without unsuffixed base',!!top&&r.data&&r.data.hero===top&&r.answer.includes(top),{top,r});

  console.log(`HERO SAME NAME NATURAL FOLLOWUPS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
