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
function compactMeta(r){
  const d=r&&r.data||{};
  return {links:r&&r.links||[],mode:r&&r.mode||'',data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),
    siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],siteSourceCandidates:Array.isArray(d.siteSourceCandidates)?d.siteSourceCandidates.slice(0,8):[],
    selectedSiteItem:String(d.selectedSiteItem||''),knownTermGuidance:!!d.knownTermGuidance,
    termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm,needsClarification:!!d.needsClarification
  }};
}
async function pair(first,second){
  const history=[{role:'user',text:first}];
  const a=await B.handle({message:first,history:history.slice()});
  history.push({role:'assistant',text:String(a.answer||''),meta:compactMeta(a)});
  history.push({role:'user',text:second});
  const b=await B.handle({message:second,history:history.slice()});
  return {first:a,second:b,history};
}
async function triplet(first,second,third){
  const x=await pair(first,second),history=x.history.slice();
  history.push({role:'assistant',text:String(x.second.answer||''),meta:compactMeta(x.second)});
  history.push({role:'user',text:third});
  const c=await B.handle({message:third,history:history.slice()});
  return {first:x.first,second:x.second,third:c,history};
}
function guide(r,id){const d=r&&r.data||{};return !!(r&&r.mode==='サイト総合案内'&&d.siteGuide&&(!id||d.siteItem===id));}
(async()=>{
  let x=await pair('えいけつ','コスト7は？');
  check('hiragana hero term becomes hero guidance',x.first&&x.first.data&&x.first.data.knownTermGuidance&&x.first.data.termKey==='hero'&&x.first.data.normalizedTerm==='英傑',x.first);
  check('hiragana hero followup reaches hero master',x.second&&x.second.mode==='英傑マスター実データ'&&/コスト7の英傑は 162人/.test(x.second.answer||''),x.second);
  check('hiragana hero followup never becomes carp name',x.second&&x.second.mode!=='カープ専用正本知識'&&!/ジミー・ハースト/.test(x.second.answer||''),x.second);

  x=await pair('ジンケイ','魚鱗で');
  check('katakana formation followup is not early smalltalk',x.second&&x.second.mode!=='日常会話',x.second);
  check('katakana formation followup keeps canonical context',x.second&&x.second.data&&x.second.data.context&&x.second.data.context.message==='陣形 魚鱗で',x.second&&x.second.data&&x.second.data.context);

  x=await pair('はいちえいけつ','前田慶次を入れて');
  check('hiragana placement followup avoids hero profile',guide(x.second,'jinpo')&&x.second.mode!=='英傑マスター実データ',x.second);
  check('hiragana placement uses canonical operation phrase',x.second&&x.second.data&&x.second.data.context&&x.second.data.context.message==='前田慶次を入れて探して',x.second&&x.second.data&&x.second.data.context);

  x=await pair('じょがいえいけつ','前田慶次を外して');
  check('hiragana exclusion followup avoids hero profile',guide(x.second,'jinpo')&&x.second.mode!=='英傑マスター実データ',x.second);
  check('hiragana exclusion normalizes casual remove verb',x.second&&x.second.data&&x.second.data.context&&x.second.data.context.message==='前田慶次を除外して',x.second&&x.second.data&&x.second.data.context);

  x=await pair('天下武技大会','天を見たい');
  check('tenka tournament guidance uses relevant examples',/天を見たい/.test(x.first.answer||'')&&/地の方/.test(x.first.answer||'')&&!/桶狭間を見たい/.test(x.first.answer||''),x.first);
  check('tenka tournament ten phrase selects ten page',guide(x.second,'ten_mode'),x.second);

  x=await pair('天下武技大会','地を開いて');
  check('tenka tournament open phrase selects chi page',guide(x.second,'chi_mode')&&Array.isArray(x.second.links)&&x.second.links.length===1,x.second);

  let y=await triplet('天下武技大会','天を見たい','やっぱり地');
  check('tenka tournament correction switches to chi',guide(y.third,'chi_mode'),y.third);
  y=await triplet('天下武技大会','地を見たい','地じゃなくて天');
  check('tenka tournament explicit correction switches to ten',guide(y.third,'ten_mode'),y.third);

  x=await pair('つくも','今日は暑いね');
  check('kana term still releases unrelated smalltalk',x.second&&x.second.mode==='日常会話'&&!/九十九/.test(x.second.answer||''),x.second);

  console.log(`KNOWN TERM KANA FOLLOWUP: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
