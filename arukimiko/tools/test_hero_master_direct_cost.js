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
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
async function ask(q){return B.handle({message:q,history:[{role:'user',text:q}]});}
(async()=>{
  const expected={4:16,5:40,6:116,7:162,8:49};
  for(const cost of [4,5,6,7]){
    const r=await ask('コスト'+cost+'は？');
    check('direct cost '+cost+' uses hero master',r&&r.mode==='英傑マスター実データ'&&r.data&&r.data.cost===cost&&r.data.count===expected[cost],r);
    check('direct cost '+cost+' never becomes carp',r&&r.mode!=='カープ専用正本知識'&&!/ジミー・ハースト|ランドクィスト/.test(r.answer||''),r);
  }
  let r=await ask('コスト8の英傑');
  check('cost 8 noun form uses hero master',r&&r.mode==='英傑マスター実データ'&&r.data&&r.data.cost===8&&r.data.count===expected[8],r);

  r=await ask('コストが一番高いのは？');
  check('highest cost question uses canonical hero data',r&&r.mode==='英傑マスター実データ'&&r.data&&r.data.costEdge===true&&r.data.low===false&&r.data.cost===8&&r.data.count===49,r);

  r=await ask('一番低いコストは？');
  check('lowest cost reverse word order uses canonical hero data',r&&r.mode==='英傑マスター実データ'&&r.data&&r.data.costEdge===true&&r.data.low===true&&r.data.cost===4&&r.data.count===16,r);

  r=await ask('カープのコスト6は？');
  check('explicit carp topic is not stolen by hero cost route',r&&r.mode==='カープ専用正本知識',r);

  console.log(`HERO MASTER DIRECT COST: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
