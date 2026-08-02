#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};global.addEventListener=()=>{};
global.location={href:'https://example.test/陣法/jinpo.html',pathname:'/陣法/jinpo.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='jinpo';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot-parser.js','jinpo-bot-nlu.js','jinpo-bot-interpret.js','jinpo-bot-state.js'].forEach(load);
let actionLog=[];global.JINPO_BOT_ACTIONS={readSiteState:()=>({formation:'方円',count:7,searchBasis:'base',priority1:'',priority2:'',grade3:false,factor4Exclude:0,sumSort:false,owned:[],excluded:[],recommendActive:false,allMax:false}),captureSnapshot:()=>({}),execute:async(name,args)=>{actionLog.push({name,args:args||{}});return {ok:true,message:name+' done',data:{hero:args&&args.hero,excluded:args&&args.excluded}};}};global.JINPO_BOT_HELP={respond:()=>null,get:()=>''};load('jinpo-bot.js');
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function historyMeta(r){const d=r&&r.data||{},c=d.context||{};let data=null;if(d.knownTermClarification)data={knownTermClarification:true,clarificationReason:String(d.clarificationReason||d.reason||''),siteItem:String(d.siteItem||'jinpo'),termKey:String(d.termKey||'placement'),normalizedTerm:String(d.normalizedTerm||''),pendingHero:String(d.pendingHero||'')};else if(d.siteGuide)data={siteGuide:true,siteItem:String(d.siteItem||''),knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),resolutionReason:String(c.reason||''),contextMessage:String(c.message||'')};else if(c.resolved&&String(c.siteItem||'')==='jinpo')data={jinpoContinuation:true,siteItem:'jinpo',resolutionReason:String(c.reason||''),contextMessage:String(c.message||'')};return {mode:r&&r.mode||'',data};}
async function sequence(messages){for(const k of Object.keys(store))delete store[k];if(global.JINPO_BOT_STATE){global.JINPO_BOT_STATE.resetConditions();global.JINPO_BOT_STATE.clearUndo();global.JINPO_BOT_STATE.clearLastSearch();global.JINPO_BOT_STATE.clearSearchHistory();}const history=[],out=[];for(const text of messages){history.push({role:'user',text});actionLog=[];const r=await B.handle({message:text,history:history.slice()});out.push({response:r,actions:actionLog.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:historyMeta(r)});}return out;}
function acts(step,name){return step.actions.filter(x=>x.name===name);}function first(step,name){return acts(step,name)[0];}

const CASES=[
  async()=>{let x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','前田慶次']);check('one selected placement hero executes once',acts(x[2],'set_owned_hero_auto').length===1&&first(x[2],'set_owned_hero_auto').args.hero==='前田慶次',x[2]);check('selected placement reruns once',acts(x[2],'rerun_search').length===1,x[2]);},
  async()=>{let x=await sequence(['除外英傑','前田慶次と真田幸村を外して','前田慶次']);check('one selected exclusion hero executes once',acts(x[2],'set_excluded_hero').length===1&&first(x[2],'set_excluded_hero').args.hero==='前田慶次'&&first(x[2],'set_excluded_hero').args.excluded===true,x[2]);},
  async()=>{let x=await sequence(['除外英傑','戻して','前田慶次']);check('restore clarification executes false once',acts(x[2],'set_excluded_hero').length===1&&first(x[2],'set_excluded_hero').args.hero==='前田慶次'&&first(x[2],'set_excluded_hero').args.excluded===false,x[2]);},
  async()=>{let x=await sequence(['配置英傑','前田慶次を入れて','了解','やっぱり外して','除外に入れて']);check('ambiguous remove exclusion choice uses pending hero',acts(x[4],'set_excluded_hero').length===1&&first(x[4],'set_excluded_hero').args.hero==='前田慶次',x[4]);check('ambiguous remove never uses phrase as hero',!x[4].actions.some(a=>a.args&&/^(?:配置から|除外に)$/.test(String(a.args.hero||''))),x[4]);},
  async()=>{let x=await sequence(['配置英傑','前田慶次を入れて','了解','やっぱり外して','配置から外して']);check('slot clarification executes no action',x[4].actions.length===0&&x[4].response.mode==='会話確認',x[4]);},
  async()=>{let x=await sequence(['配置英傑','前田慶次を入れて','了解','やっぱり外して','配置から外して','2番']);check('slot answer clears only selected slot',acts(x[5],'clear_owned_hero').length===1&&first(x[5],'clear_owned_hero').args.slot===2,x[5]);check('slot answer never excludes pending hero',acts(x[5],'set_excluded_hero').length===0,x[5]);},
  async()=>{let x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','前田慶次','もう一人は真田幸村']);check('second placement hero executes once',acts(x[3],'set_owned_hero_auto').length===1&&first(x[3],'set_owned_hero_auto').args.hero==='真田幸村',x[3]);},
  async()=>{let x=await sequence(['除外英傑','前田慶次と真田幸村を外して','前田慶次','次は真田幸村']);check('second exclusion hero executes once',acts(x[3],'set_excluded_hero').length===1&&first(x[3],'set_excluded_hero').args.hero==='真田幸村'&&first(x[3],'set_excluded_hero').args.excluded===true,x[3]);},
  async()=>{let x=await sequence(['除外英傑','戻して','前田慶次','次は真田幸村も戻して']);check('second restore hero executes once',acts(x[3],'set_excluded_hero').length===1&&first(x[3],'set_excluded_hero').args.hero==='真田幸村'&&first(x[3],'set_excluded_hero').args.excluded===false,x[3]);},
  async()=>{let x=await sequence(['配置英傑','前田慶次と真田幸村を入れて','今日は暑いね']);check('unrelated answer executes no jinpo action',x[2].actions.length===0,x[2]);}
];

(async()=>{
  const selected=process.env.JINPO_CLARIFICATION_ACTION_CASE;
  if(selected!==undefined){
    const index=Number(selected);
    if(!Number.isInteger(index)||index<0||index>=CASES.length)throw new Error('invalid case index');
    await CASES[index]();
    console.log(JSON.stringify({pass,fail}));
    process.exit(fail?1:0);
  }
  const cp=require('child_process');
  let totalPass=0,totalFail=0;
  for(let i=0;i<CASES.length;i++){
    const child=cp.spawnSync(process.execPath,[__filename],{
      env:Object.assign({},process.env,{JINPO_CLARIFICATION_ACTION_CASE:String(i)}),
      encoding:'utf8',timeout:90000,maxBuffer:1024*1024*8
    });
    const lines=String(child.stdout||'').trim().split(/\r?\n/).filter(Boolean);
    let result=null;
    try{result=JSON.parse(lines[lines.length-1]||'');}catch(e){}
    if(child.error||child.status!==0||!result){
      totalFail++;
      console.error('FAIL: isolated action case '+(i+1),child.error||child.stderr||child.stdout||'no result');
      continue;
    }
    totalPass+=Number(result.pass)||0;
    totalFail+=Number(result.fail)||0;
  }
  console.log(`KNOWN TERM CLARIFICATION JINPO: ${totalPass} / ${totalPass+totalFail} PASS`);
  process.exit(totalFail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
