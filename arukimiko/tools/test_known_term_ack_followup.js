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
const B=global.JINPO_BOT,G=global.JINPO_BOT_SITE_GUIDE;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){
  const d=r&&r.data||{};
  return {links:r&&r.links||[],mode:r&&r.mode||'',data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),
    knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm
  }};
}
async function triplet(first,ack,third){
  const history=[{role:'user',text:first}];
  const a=await B.handle({message:first,history:history.slice()});
  history.push({role:'assistant',text:String(a.answer||''),meta:compactMeta(a)});
  history.push({role:'user',text:ack});
  const b=await B.handle({message:ack,history:history.slice()});
  history.push({role:'assistant',text:String(b.answer||''),meta:compactMeta(b)});
  history.push({role:'user',text:third});
  const c=await B.handle({message:third,history:history.slice()});
  return {first:a,ack:b,third:c,history};
}
(async()=>{
  let x=await triplet('九十九','なるほど','1番の能力');
  check('ack itself remains smalltalk for tsukumo',x.ack&&x.ack.mode==='日常会話'&&!/九十九.*なるほど/.test(x.ack.answer||''),x.ack);
  check('one ack preserves tsukumo subject',x.third&&x.third.mode==='たいらの野望ツール実データ'&&/八幡神の武運/.test(x.third.answer||''),x.third);

  x=await triplet('英傑','了解','コスト7は？');
  check('ack itself remains smalltalk for hero term',x.ack&&x.ack.mode==='日常会話',x.ack);
  check('one ack preserves hero subject',x.third&&x.third.mode==='英傑マスター実データ'&&/コスト7の英傑は 162人/.test(x.third.answer||''),x.third);
  check('hero followup after ack never becomes carp',x.third&&x.third.mode!=='カープ専用正本知識'&&!/ジミー・ハースト/.test(x.third.answer||''),x.third);

  x=await triplet('天下武技大会','うん','天を見たい');
  check('one ack preserves tournament hierarchy',x.third&&x.third.mode==='サイト総合案内'&&x.third.data&&x.third.data.siteItem==='ten_mode',x.third);

  x=await triplet('配置英傑','わかった','前田慶次を入れて');
  check('placement acknowledgement is not converted to operation text',x.ack&&x.ack.mode==='日常会話'&&!/わかったを入れて探して|カウンター値/.test(x.ack.answer||''),x.ack);
  check('placement subject survives one acknowledgement',x.third&&x.third.mode==='サイト総合案内'&&x.third.data&&x.third.data.siteItem==='jinpo'&&x.third.data.context&&x.third.data.context.message==='前田慶次を入れて探して',x.third);

  const fakeHistory=[
    {role:'user',text:'英傑'},
    {role:'assistant',text:'英傑の話ですね',meta:{data:{siteGuide:true,siteItem:'heroes',knownTermGuidance:true,termKey:'hero',normalizedTerm:'英傑'}}},
    {role:'user',text:'了解'},
    {role:'assistant',text:'わかりました',meta:{data:{}}},
    {role:'user',text:'コスト7は？'}
  ];
  const ctx=G.historyGuideContext(fakeHistory);
  check('known term freshness accepts one acknowledgement',G.knownTermContextFresh(fakeHistory,ctx)===true,ctx);
  check('acknowledgement is never expanded by itself',G.expandKnownTermFollowup('了解',fakeHistory.slice(0,3))===null,G.expandKnownTermFollowup('了解',fakeHistory.slice(0,3)));

  console.log(`KNOWN TERM ACK FOLLOWUP: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
