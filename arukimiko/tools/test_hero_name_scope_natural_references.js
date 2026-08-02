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
  'jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js',
  'jinpo-bot-smalltalk.js','jinpo-bot.js','jinpo-bot-persona.js'
].forEach(load);
const K=global.JINPO_BOT_HERO_KNOWLEDGE,B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function push(h,q,r){h.push({role:'user',content:q});h.push({role:'assistant',content:r.answer,meta:{data:r.data}});}
async function startMaeda(){const h=[],r=await B.handle({message:'前田の英傑を全部教えて',history:h});push(h,'前田の英傑を全部教えて',r);return {h,r};}
(async()=>{
  const direct=[
    ['前田とつく英傑全員知りたい','contains'],
    ['英傑で名前が前田の人全部','prefix'],
    ['名前に前田がある英傑全部','contains'],
    ['前田の付いた英傑全部','contains']
  ];
  for(const [q,mode] of direct){
    const r=K.respond(q,{});
    check('direct natural name reference: '+q,r.handled&&r.data&&r.data.namePattern===true&&r.data.query==='前田'&&r.data.matchMode===mode&&r.data.count===5,r);
  }
  let r=K.respond('豊臣秀長ってどんな英傑？',{});
  check('exact hero detail remains exact',r.handled&&r.data&&r.data.hero==='豊臣秀長'&&!r.data.namePattern,r);
  r=await B.handle({message:'前田智徳って名前の選手を教えて',history:[]});
  check('Carp player is not stolen',r.data&&r.data.carp===true&&/前田智徳/.test(r.answer)&&!r.data.namePattern,r);

  let s=await startMaeda();
  r=await B.handle({message:'それぞれの職業',history:s.h});
  check('それぞれ uses current five',r.data&&r.data.multiHeroFields===true&&r.data.heroes.length===5&&r.data.fields.job===true,r);

  s=await startMaeda();
  r=await B.handle({message:'この人たちのコスト',history:s.h});
  check('この人たち uses current five',r.data&&r.data.multiHeroFields===true&&r.data.heroes.length===5&&r.data.fields.cost===true,r);

  for(const q of ['コスト7はいる？','その中のコスト7']){
    s=await startMaeda();
    r=await B.handle({message:q,history:s.h});
    check('numeric cost filters current scope: '+q,r.data&&r.data.list===true&&r.data.contextScope===true&&r.data.scopeCount===5&&r.data.count===5,r);
  }

  s=await startMaeda();
  r=await B.handle({message:'武芸いる？',history:s.h});
  check('factor existence filters current scope',r.data&&r.data.list===true&&r.data.contextScope===true&&r.data.count===1&&r.data.heroes[0]==='前田利家(兎忍)',r);

  s=await startMaeda();
  r=await B.handle({message:'この中で知力2000以上',history:s.h});
  check('threshold filters current scope',r.data&&r.data.list===true&&r.data.contextScope===true&&r.data.scopeCount===5&&r.data.count===3,r);

  s=await startMaeda();
  r=await B.handle({message:'名前だけでいい',history:s.h});
  check('names only keeps name pattern',r.data&&r.data.namePattern===true&&r.data.query==='前田'&&r.data.count===5,r);

  s=await startMaeda();
  r=await B.handle({message:'他には？',history:s.h});
  check('他には reports exhausted list',r.data&&r.data.exhaustedFollowup===true&&r.data.count===5&&/ほかにはいません/.test(r.answer),r);

  s=await startMaeda();
  r=await B.handle({message:'藤堂にして',history:s.h});
  check('compact condition switch with にして',r.data&&r.data.namePattern===true&&r.data.query==='藤堂'&&r.data.count===2,r);

  s=await startMaeda();
  r=await B.handle({message:'じゃあ真田',history:s.h});
  check('bare compact condition switch',r.data&&r.data.namePattern===true&&r.data.query==='真田'&&r.data.count===11,r);

  s=await startMaeda();
  r=await B.handle({message:'前田以外',history:s.h});
  check('name exclusion stays in hero domain',r.data&&r.data.namePatternExclusion===true&&r.data.count===378&&Array.isArray(r.data.excludedHeroes)&&r.data.excludedHeroes.length===5&&!r.data.carp,r);

  s=await startMaeda();
  r=await B.handle({message:'全員を比較して',history:s.h});
  check('comparison clarification retains all five',r.data&&r.data.needsClarification===true&&Array.isArray(r.data.heroes)&&r.data.heroes.length===5&&/直前の5人/.test(r.answer),r);

  s=await startMaeda();
  r=await B.handle({message:'一番強いのは？',history:s.h});
  check('ambiguous strongest asks metric in scope',r.data&&r.data.needsMetric===true&&r.data.contextScope===true&&r.data.scopeCount===5,r);

  s=await startMaeda();
  r=await B.handle({message:'なるほど',history:s.h});push(s.h,'なるほど',r);
  r=await B.handle({message:'それぞれの職業',history:s.h});
  check('one acknowledgement preserves scope',r.data&&r.data.multiHeroFields===true&&r.data.scopeCount===5,r);

  s=await startMaeda();
  r=await B.handle({message:'なるほど',history:s.h});push(s.h,'なるほど',r);
  r=await B.handle({message:'了解',history:s.h});push(s.h,'了解',r);
  r=await B.handle({message:'それぞれの職業',history:s.h});
  check('two acknowledgements expire scope',r.data&&r.data.needsHeroScope===true&&!r.data.multiHeroFields,r);

  s=await startMaeda();
  r=await B.handle({message:'こんにちは',history:s.h});push(s.h,'こんにちは',r);
  r=await B.handle({message:'それぞれの職業',history:s.h});
  check('smalltalk expires scope',r.data&&r.data.needsHeroScope===true&&!r.data.multiHeroFields,r);

  s=await startMaeda();
  r=await B.handle({message:'豊臣秀長について',history:s.h});push(s.h,'豊臣秀長について',r);
  r=await B.handle({message:'それぞれの職業',history:s.h});
  check('single hero topic blocks older group',r.data&&r.data.needsHeroScope===true&&!r.data.multiHeroFields,r);

  s=await startMaeda();
  r=await B.handle({message:'カープの話に変えて',history:s.h});push(s.h,'カープの話に変えて',r);
  r=await B.handle({message:'それぞれの職業',history:s.h});
  check('topic switch blocks older hero scope',r.data&&r.data.carp===true&&!r.data.multiHeroFields,r);

  console.log(`HERO NAME SCOPE NATURAL REFERENCES: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
