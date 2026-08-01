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
const D=global.JINPO_BOT_HERO_DATA,K=global.JINPO_BOT_HERO_KNOWLEDGE,B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function heroMeta(r){return {mode:r.mode||'',data:{heroKnowledge:!!(r.data&&r.data.heroKnowledge),hero:String(r.data&&r.data.hero||''),heroes:Array.isArray(r.data&&r.data.heroes)?r.data.heroes.slice():[],candidates:Array.isArray(r.data&&r.data.candidates)?r.data.candidates.slice():[],needsClarification:!!(r.data&&r.data.needsClarification),stats:Array.isArray(r.data&&r.data.stats)?r.data.stats.slice():[]}};}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:heroMeta(r)});return r;}};}
(async()=>{
  check('data row count',D&&D.rowCount===383,D&&D.rowCount);
  check('data source hash',D&&D.sourceSha256==='c65cfdc860f6d957f53519978208cb35f9701c1d7e1b019c0a534e07cd4b4b8b',D&&D.sourceSha256);
  check('knowledge source hash',K&&K.sourceSha256()===D.sourceSha256,K&&K.sourceSha256());

  let r=K.respond('腕力が高い英傑は誰？',{});
  check('arm ranking handled',r.handled&&r.data.ranking&&/1位：母里太兵衛（腕力:3514）/.test(r.answer),r);
  check('arm ranking top five',/5位：村上義清/.test(r.answer),r.answer);
  check('base value disclaimer',/基礎値/.test(r.answer),r.answer);

  r=K.respond('生命が一番高い英傑は？',{});
  check('life highest',r.handled&&/斎藤義龍\(新春\).*生命:41334/.test(r.answer),r.answer);
  r=K.respond('コスト7で知力トップ3',{});
  check('cost filter ranking',/1位：仙桃院.*知力:3025/.test(r.answer)&&/3位：豊臣秀長/.test(r.answer),r.answer);
  r=K.respond('侍で腕力高い英傑',{});
  check('job filter ranking',/職業「侍」/.test(r.answer)&&/真田幸村\(神魔\)/.test(r.answer),r.answer);
  r=K.respond('軍学持ちで耐久高い英傑',{});
  check('factor filter ranking',/因子「軍学」/.test(r.answer)&&/毛利勝永/.test(r.answer),r.answer);
  r=K.respond('因子4が才腕の英傑は誰？',{});
  check('factor slot filter',/因子4「才腕」/.test(r.answer)&&/4人/.test(r.answer)&&/斎藤道三/.test(r.answer),r.answer);
  r=K.respond('腕力3000以上の英傑は何人？',{});
  check('threshold count',/34人/.test(r.answer),r.answer);
  r=K.respond('腕力と知力が高い英傑トップ3',{});
  check('two stat sum ranking',/腕力＋知力合計/.test(r.answer)&&/1位：片倉景綱\(右腕\)/.test(r.answer),r.answer);
  r=K.respond('天下の支柱って誰の技能？',{});
  check('skill reverse lookup',/豊臣秀長/.test(r.answer)&&/技能「天下の支柱」/.test(r.answer),r.answer);

  r=K.respond('職業ごとの腕力トップ',{});
  check('job grouped leaders',r.data.groupBy==='職業'&&/僧：母里太兵衛（腕力:3514）/.test(r.answer)&&/忍者：百地三太夫\(野望\)/.test(r.answer),r.answer);
  r=K.respond('コスト別で知力一番',{});
  check('cost grouped leaders',r.data.groupBy==='コスト'&&/コスト7：仙桃院（知力:3025）/.test(r.answer)&&/コスト8：豊臣秀吉/.test(r.answer),r.answer);
  r=K.respond('一番多い因子は？',{});
  check('factor frequency',r.data.factorFrequency===true&&/1位：武芸（49人）/.test(r.answer),r.answer);
  r=K.respond('母里太兵衛より腕力高い英傑は？',{});
  check('relative higher none',r.data.relative===true&&/いません/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長より知力高い英傑は何人？',{});
  check('relative higher count',r.data.relative===true&&/2人/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長と同じ職業で知力高い英傑トップ3',{});
  check('same job derived ranking',/職業「侍」/.test(r.answer)&&/1位：豊臣秀吉/.test(r.answer),r.answer);

  r=K.respond('豊臣秀長の腕力は？',{});
  check('named stat',/豊臣秀長の腕力は 2346/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長の因子は？',{});
  check('named factors',/軍学 \/ 才腕 \/ 知将 \/ 名臣/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長の技能を教えて',{});
  check('named skill',/天下の支柱/.test(r.answer),r.answer);
  r=K.respond('豊臣秀長ってどんな英傑？',{});
  check('named summary',/職業 侍・コスト7/.test(r.answer)&&/生命 34607/.test(r.answer)&&/技能詳細/.test(r.answer),r.answer);

  r=K.respond('母里太兵枝の腕力は？',{});
  check('unique typo corrected',r.data.corrected===true&&/母里太兵衛.*3514/.test(r.answer)&&/こととして答えます/.test(r.answer),r);
  r=K.respond('仙桃員の知力は？',{});
  check('another unique typo corrected',/仙桃院.*3025/.test(r.answer),r.answer);
  r=K.respond('豊臣秀なかの腕力は？',{});
  check('ambiguous typo asks',r.data.needsClarification===true&&r.data.candidates.length===3&&/豊臣秀長.*豊臣秀吉.*豊臣秀次/s.test(r.answer),r);

  r=K.respond('全MAX込みで腕力が高い英傑は誰？',{});
  check('full max scope clarified',r.data.needsMaxScope===true&&/個別英傑.*6人編成/s.test(r.answer),r);

  r=K.respond('母里太兵衛と百地三太夫(野望)はどっちが腕力高い？',{});
  check('hero comparison',r.data.comparison===true&&/母里太兵衛.*3514/.test(r.answer)&&/百地三太夫\(野望\).*3470/.test(r.answer),r);
  r=K.respond('母里太兵衛と百地三太夫(野望)はどっちが強い？',{});
  check('vague comparison clarifies stat',r.data.needsClarification===true&&/どの能力/.test(r.answer),r);

  check('page navigation not stolen',K.respond('英傑一覧を開いて',{}).handled===false);
  check('bare jinpo-style stat not stolen',K.respond('腕力高いの',{}).handled===false);
  check('jinpo search not stolen',K.respond('腕力高いの検索して',{}).handled===false);
  check('tool data not stolen',K.respond('鬼神石の腕力トップ3',{}).handled===false);

  r=await B.handle({message:'英欠で腕力高いの誰？',history:[]});
  check('bot typo normalizes and routes hero',r.mode==='英傑マスター実データ'&&/母里太兵衛/.test(r.answer),r);
  r=await B.handle({message:'英傑一覧を開いて',history:[]});
  check('bot page request remains guide',r.mode==='サイト総合案内'&&r.data.siteItem==='heroes',r);
  r=await B.handle({message:'腕力高いの検索して',history:[]});
  check('bot jinpo search remains guide',r.mode!=='英傑マスター実データ',r);

  let s=session();
  r=await s.ask('腕力トップ5');
  check('context ranking base',r.data.ranking===true&&r.data.heroes[0]==='母里太兵衛',r);
  r=await s.ask('1位の因子は？');
  check('ranking ordinal followup',r.data.hero==='母里太兵衛'&&/僧兵/.test(r.answer),r);
  r=await s.ask('その人の技能も');
  check('deictic hero followup',r.data.hero==='母里太兵衛'&&/技能/.test(r.answer),r);
  r=await s.ask('3位の知力は？');
  check('older ranking ordinal retained',r.data.hero==='遠足娘まり'&&/知力は 2553/.test(r.answer),r);

  s=session();r=await s.ask('豊臣秀なかの腕力は？');
  check('bot ambiguity context',r.data.needsClarification===true,r);
  r=await s.ask('秀長の方');
  check('candidate fragment selection',r.data.hero==='豊臣秀長'&&/職業 侍/.test(r.answer),r);

  console.log(`HERO MASTER KNOWLEDGE: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
