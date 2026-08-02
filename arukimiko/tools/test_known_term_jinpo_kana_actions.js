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
  readSiteState:()=>JSON.parse(JSON.stringify(site)),
  captureSnapshot:()=>JSON.parse(JSON.stringify(site)),
  execute:async(name,args)=>{actionLog.push({name,args:args||{}});if(name==='apply_search')Object.assign(site,args||{});return {ok:true,message:name+' done',data:{}};}
};
global.JINPO_BOT_HELP={respond:()=>null,get:()=>''};
load('jinpo-bot.js');
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){const d=r&&r.data||{};return {links:r&&r.links||[],mode:r&&r.mode||'',data:{siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm}};}
async function pair(first,second){actionLog=[];const history=[{role:'user',text:first}];const a=await B.handle({message:first,history:history.slice()});history.push({role:'assistant',text:String(a.answer||''),meta:compactMeta(a)});history.push({role:'user',text:second});const b=await B.handle({message:second,history:history.slice()});return {first:a,second:b,actions:actionLog.slice()};}
function countAction(result,name){return result.actions.filter(x=>x.name===name).length;}
function findAction(result,name){return result.actions.find(x=>x.name===name);}
(async()=>{
  let x=await pair('じんけい','方円にして');
  check('kana formation executes set formation',countAction(x,'set_formation')===1&&findAction(x,'set_formation').args.formation==='方円',x);

  x=await pair('ジンケイ','魚鱗で');
  check('katakana formation asks only missing bond count',/魚鱗は分かっています。因縁数だけ教えてください/.test(x.second.answer||'')&&x.actions.length===0,x);

  x=await pair('いんねん','7で探して');
  check('kana bond asks only missing formation',/因縁数は7因縁で分かっています。陣形だけ教えてください/.test(x.second.answer||'')&&x.actions.length===0,x);

  x=await pair('けんぶんろく','MAXにして');
  check('kana kenbun executes panel max',countAction(x,'panel_max')===1&&findAction(x,'panel_max').args.panel==='kenbun',x);

  x=await pair('ぶんきょく','2人除外');
  check('kana bunkyoku executes factor exclusion once',countAction(x,'apply_search')===1&&findAction(x,'apply_search').args.factor4Exclude===2,x);
  check('kana bunkyoku never excludes hero name',countAction(x,'set_excluded_hero')===0,x);

  x=await pair('ぜんまっくす','解除して');
  check('kana all max executes clear',countAction(x,'clear_all_max')===1,x);

  x=await pair('はいちえいけつ','前田慶次を入れて');
  check('kana placement executes owned hero action',countAction(x,'set_owned_hero_auto')===1&&findAction(x,'set_owned_hero_auto').args.hero==='前田慶次',x);
  check('kana placement reruns search',countAction(x,'rerun_search')===1,x);

  x=await pair('じょがいえいけつ','前田慶次を外して');
  check('kana exclusion executes excluded hero action',countAction(x,'set_excluded_hero')===1&&findAction(x,'set_excluded_hero').args.hero==='前田慶次'&&findAction(x,'set_excluded_hero').args.excluded===true,x);
  check('kana exclusion reruns search',countAction(x,'rerun_search')===1,x);

  x=await pair('さしかえこうほ','見せて');
  check('kana swap followup executes candidate retrieval',countAction(x,'get_swap_candidates')===1,x);

  console.log(`KNOWN TERM JINPO KANA ACTIONS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
