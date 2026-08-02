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
function historyMeta(r){
  const d=r&&r.data||{},c=d.context||{};
  let data={};
  if(d.siteGuide){data={siteGuide:true,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm};}
  else if(c.resolved&&String(c.siteItem||'')==='jinpo'){data={jinpoContinuation:true,siteItem:'jinpo',resolutionReason:String(c.reason||'')};}
  else if(d.needsSpecifiedSearchCondition){data={jinpoContinuation:true,siteItem:'jinpo',resolutionReason:'specified_search_partial'};}
  else if(d.heroKnowledge){data={heroKnowledge:true,hero:String(d.hero||''),heroes:Array.isArray(d.heroes)?d.heroes.slice(0,24):[]};}
  return {links:r&&r.links||[],mode:r&&r.mode||'',data:data};
}
async function sequence(messages){
  const history=[],out=[];
  for(const text of messages){
    history.push({role:'user',text:text});
    const r=await B.handle({message:text,history:history.slice()});
    out.push(r);
    history.push({role:'assistant',text:String(r.answer||''),meta:historyMeta(r)});
  }
  return out;
}
function guide(r,id,feature){const d=r&&r.data||{};return !!(r&&r.mode==='サイト総合案内'&&d.siteItem===id&&(!feature||d.siteFeature===feature));}
(async()=>{
  let x=await sequence(['星海の荒石','文曲','なるほど','武曲']);
  check('stone choice survives acknowledgement after first selection',guide(x[3],'seikai','inputs')&&/「武曲」のボタン/.test(x[3].answer||''),x[3]);

  x=await sequence(['鎮魂符','頭','了解','足']);
  check('body part choice survives acknowledgement after first selection',guide(x[3],'chinkon','inputs')&&/「足」の枠/.test(x[3].answer||''),x[3]);

  x=await sequence(['英傑','コスト7は？','なるほど','コスト6は？']);
  check('hero cost subject survives acknowledgement after data answer',x[3]&&x[3].mode==='英傑マスター実データ'&&/コスト6の英傑は 116人/.test(x[3].answer||''),x[3]);
  check('post-answer hero cost never becomes carp',x[3]&&x[3].mode!=='カープ専用正本知識'&&!/ジミー・ハースト/.test(x[3].answer||''),x[3]);

  x=await sequence(['配置英傑','前田慶次を入れて','了解','真田幸村も入れて']);
  check('top page placement subject survives action answer and acknowledgement',x[3]&&x[3].mode==='サイト総合案内'&&x[3].data&&x[3].data.context&&x[3].data.context.message==='真田幸村を入れて探して',x[3]);

  x=await sequence(['除外英傑','前田慶次','了解','真田幸村も外して']);
  check('top page exclusion subject survives action answer and acknowledgement',x[3]&&x[3].mode==='サイト総合案内'&&x[3].data&&x[3].data.context&&x[3].data.context.message==='真田幸村を除外して',x[3]);

  x=await sequence(['因縁','7因縁で探して','了解','8にして']);
  check('bond count change survives partial answer and acknowledgement',x[3]&&x[3].mode==='サイト総合案内'&&x[3].data&&x[3].data.context&&x[3].data.context.message==='8因縁で探して',x[3]);

  x=await sequence(['全MAX','設定して','了解','解除して']);
  check('all max clear survives action answer and acknowledgement',x[3]&&x[3].mode==='サイト総合案内'&&x[3].data&&x[3].data.context&&x[3].data.context.message==='全MAX解除',x[3]);

  x=await sequence(['文曲','2人除外','了解','1人にして']);
  check('bunkyoku count change survives action answer and acknowledgement',x[3]&&x[3].mode==='サイト総合案内'&&x[3].data&&x[3].data.context&&x[3].data.context.message==='文曲を1人除外',x[3]);

  x=await sequence(['全MAX','設定して','今日は暑いね','了解','解除して']);
  check('unrelated topic prevents old all max context revival',!(x[4]&&x[4].data&&x[4].data.context&&x[4].data.context.reason==='allmax_context'),x[4]);

  x=await sequence(['全MAX','設定して','了解','はい','解除して']);
  check('two acknowledgements do not extend old operation context indefinitely',!(x[4]&&x[4].data&&x[4].data.context&&x[4].data.context.reason==='allmax_context'),x[4]);

  console.log(`KNOWN TERM POST ACTION ACK: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
