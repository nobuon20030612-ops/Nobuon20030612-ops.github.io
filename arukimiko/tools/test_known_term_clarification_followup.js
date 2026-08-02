#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};global.addEventListener=()=>{};
global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function historyMeta(r){
  const d=r&&r.data||{},c=d.context||{};let data=null;
  if(d.conversationRepair)data={conversationRepair:true,contextBoundary:d.contextBoundary!==false};
  else if(d.knownTermClarification)data={knownTermClarification:true,clarificationReason:String(d.clarificationReason||d.reason||''),siteItem:String(d.siteItem||'jinpo'),termKey:String(d.termKey||'placement'),normalizedTerm:String(d.normalizedTerm||''),pendingHero:String(d.pendingHero||'')};
  else if(d.siteGuide)data={siteGuide:true,siteItem:String(d.siteItem||''),knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),resolutionReason:String(c.reason||''),contextMessage:String(c.message||'')};
  else if(c.resolved&&String(c.siteItem||'')==='jinpo')data={jinpoContinuation:true,siteItem:'jinpo',resolutionReason:String(c.reason||''),contextMessage:String(c.message||'')};
  else if(d.heroKnowledge)data={heroKnowledge:true,hero:String(d.hero||'')};
  return {mode:r&&r.mode||'',data};
}
async function sequence(messages){const history=[],out=[];for(const text of messages){history.push({role:'user',text});const r=await B.handle({message:text,history:history.slice()});out.push(r);history.push({role:'assistant',text:String(r.answer||''),meta:historyMeta(r)});}return out;}
function contextMessage(r){return String(r&&r.data&&r.data.context&&r.data.context.message||'');}
(async()=>{
  let x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','前田慶次']);
  check('placement multiple clarification accepts one bare hero',contextMessage(x[2])==='前田慶次を入れて探して',x[2]);
  x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','前田慶次から']);
  check('placement multiple clarification accepts hero plus kara',contextMessage(x[2])==='前田慶次を入れて探して',x[2]);
  x=await sequence(['除外英傑','前田慶次と真田幸村を外して','前田慶次']);
  check('exclusion multiple clarification accepts one bare hero',contextMessage(x[2])==='前田慶次を除外して',x[2]);
  x=await sequence(['除外英傑','戻して','前田慶次']);
  check('restore clarification accepts one bare hero',contextMessage(x[2])==='前田慶次の除外を解除',x[2]);
  check('top-page restore stays in site guide instead of hero or Carp route',x[2]&&x[2].mode==='サイト総合案内'&&x[2].data&&x[2].data.siteGuide===true,x[2]);

  x=await sequence(['配置英傑','前田慶次を入れて','了解','やっぱり外して','除外に入れて']);
  check('placement ambiguity choice uses pending hero for exclusion',contextMessage(x[4])==='前田慶次を除外して',x[4]);
  x=await sequence(['配置英傑','前田慶次を入れて','了解','やっぱり外して','真田幸村を除外して']);
  check('explicit different hero overrides pending hero',contextMessage(x[4])==='真田幸村を除外して',x[4]);

  x=await sequence(['配置英傑','前田慶次を入れて','了解','やっぱり外して','配置から外して']);
  check('placement choice asks for slot instead of malformed exclusion',x[4]&&x[4].mode==='会話確認'&&/1〜3のどの枠/.test(x[4].answer||''),x[4]);
  x=await sequence(['配置英傑','前田慶次を入れて','了解','やっぱり外して','配置から外して','1']);
  check('slot number resolves repeated clarification',contextMessage(x[5])==='配置英傑1を解除',x[5]);

  x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','前田慶次','もう一人は真田幸村']);
  check('second placement hero continues after clarification action',contextMessage(x[3])==='真田幸村を入れて探して',x[3]);
  x=await sequence(['除外英傑','前田慶次と真田幸村を外して','前田慶次','次は真田幸村']);
  check('second exclusion hero continues after clarification action',contextMessage(x[3])==='真田幸村を除外して',x[3]);
  x=await sequence(['除外英傑','戻して','前田慶次','次は真田幸村も戻して']);
  check('second restored hero continues after clarification action',contextMessage(x[3])==='真田幸村の除外を解除',x[3]);
  x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','前田慶次','了解','もう一人は真田幸村']);
  check('second placement hero survives one acknowledgement',contextMessage(x[4])==='真田幸村を入れて探して',x[4]);

  x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','今日は暑いね']);
  check('unrelated conversation is not forced into placement',x[2]&&x[2].mode==='日常会話'&&!x[2].data.knownTermClarification,x[2]);
  x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','前田慶次と真田幸村を入れて']);
  check('repeated multiple answer asks one hero again',x[2]&&x[2].mode==='会話確認'&&/1人だけ/.test(x[2].answer||''),x[2]);

  console.log(`KNOWN TERM CLARIFICATION FOLLOWUP: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
