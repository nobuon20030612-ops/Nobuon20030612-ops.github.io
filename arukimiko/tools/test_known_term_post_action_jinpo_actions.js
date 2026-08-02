#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};
global.location={href:'https://example.test/陣法/jinpo.html',pathname:'/陣法/jinpo.html',origin:'https://example.test'};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
global.JINPO_BOT_PAGE_MODE='jinpo';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js',
  'jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js',
  'jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js',
  'jinpo-bot-parser.js','jinpo-bot-nlu.js','jinpo-bot-interpret.js','jinpo-bot-state.js'
].forEach(load);
let site={formation:'',count:0,searchBasis:'base',priority1:'',priority2:'',grade3:false,factor4Exclude:0,sumSort:false,owned:[],excluded:[],recommendActive:false,allMax:false};
let actionLog=[];
global.JINPO_BOT_ACTIONS={
  readSiteState:()=>JSON.parse(JSON.stringify(site)),captureSnapshot:()=>JSON.parse(JSON.stringify(site)),
  execute:async(name,args)=>{actionLog.push({name,args:args||{}});if(name==='apply_search')Object.assign(site,args||{});return {ok:true,message:name+' done',data:{}};}
};
global.JINPO_BOT_HELP={respond:()=>null,get:()=>''};
load('jinpo-bot.js');
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function historyMeta(r){
  const d=r&&r.data||{},c=d.context||{};let data={};
  if(d.siteGuide)data={siteGuide:true,siteItem:String(d.siteItem||''),knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm};
  else if(c.resolved&&String(c.siteItem||'')==='jinpo')data={jinpoContinuation:true,siteItem:'jinpo',resolutionReason:String(c.reason||'')};
  else if(d.needsSpecifiedSearchCondition)data={jinpoContinuation:true,siteItem:'jinpo',resolutionReason:'specified_search_partial'};
  else if(d.heroKnowledge)data={heroKnowledge:true,hero:String(d.hero||'')};
  return {mode:r&&r.mode||'',links:r&&r.links||[],data:data};
}
async function sequence(messages){
  const history=[],steps=[];
  for(const text of messages){
    history.push({role:'user',text:text});actionLog=[];
    const response=await B.handle({message:text,history:history.slice()});
    steps.push({response,actions:actionLog.slice()});
    history.push({role:'assistant',text:String(response.answer||''),meta:historyMeta(response)});
  }
  return steps;
}
function actions(step,name){return step.actions.filter(x=>x.name===name);}
function first(step,name){return actions(step,name)[0];}
(async()=>{
  let x=await sequence(['配置英傑','前田慶次を入れて','了解','真田幸村も入れて']);
  check('first placement executes once',actions(x[1],'set_owned_hero_auto').length===1&&first(x[1],'set_owned_hero_auto').args.hero==='前田慶次',x[1]);
  check('placement acknowledgement executes nothing',x[2].actions.length===0&&x[2].response.mode==='日常会話',x[2]);
  check('second placement after acknowledgement executes once',actions(x[3],'set_owned_hero_auto').length===1&&first(x[3],'set_owned_hero_auto').args.hero==='真田幸村',x[3]);
  check('second placement reruns search once',actions(x[3],'rerun_search').length===1,x[3]);

  x=await sequence(['除外英傑','前田慶次','了解','真田幸村も外して']);
  check('first exclusion executes once',actions(x[1],'set_excluded_hero').length===1&&first(x[1],'set_excluded_hero').args.hero==='前田慶次',x[1]);
  check('second exclusion after acknowledgement executes once',actions(x[3],'set_excluded_hero').length===1&&first(x[3],'set_excluded_hero').args.hero==='真田幸村'&&first(x[3],'set_excluded_hero').args.excluded===true,x[3]);
  check('second exclusion reruns search once',actions(x[3],'rerun_search').length===1,x[3]);

  site.formation='方円';site.count=0;
  x=await sequence(['因縁','7因縁で探して','了解','8にして']);
  check('first bond setting executes once when formation exists',actions(x[1],'apply_search').length===1&&first(x[1],'apply_search').args.count===7,x[1]);
  check('bond change after acknowledgement executes once',actions(x[3],'apply_search').length===1&&first(x[3],'apply_search').args.count===8,x[3]);

  x=await sequence(['全MAX','設定して','了解','解除して']);
  check('all max setting executes once',actions(x[1],'all_max').length===1,x[1]);
  check('all max clear after acknowledgement executes once',actions(x[3],'clear_all_max').length===1,x[3]);

  x=await sequence(['文曲','2人除外','了解','1人にして']);
  check('first bunkyoku setting executes once',actions(x[1],'apply_search').length===1&&first(x[1],'apply_search').args.factor4Exclude===2,x[1]);
  check('bunkyoku change after acknowledgement executes once',actions(x[3],'apply_search').length===1&&first(x[3],'apply_search').args.factor4Exclude===1,x[3]);
  check('bunkyoku change never excludes a hero',actions(x[3],'set_excluded_hero').length===0,x[3]);

  x=await sequence(['陣形','方円にして','了解','魚鱗にして']);
  check('formation change after acknowledgement executes once',actions(x[3],'set_formation').length===1&&first(x[3],'set_formation').args.formation==='魚鱗',x[3]);

  console.log(`KNOWN TERM POST ACTION JINPO: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
