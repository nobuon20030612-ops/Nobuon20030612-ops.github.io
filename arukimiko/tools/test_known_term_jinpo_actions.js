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
global.JINPO_BOT_HELP={
  respond:text=>{
    if(/全MAX.*意味/.test(text))return {handled:true,answer:'fullmax help',key:'allmax'};
    if(/文曲.*意味/.test(text))return {handled:true,answer:'bunkyoku help',key:'bunkyoku'};
    return null;
  },
  get:()=>''
};
load('jinpo-bot.js');
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){
  const d=r&&r.data||{};
  return {links:r&&r.links||[],mode:r&&r.mode||'',data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),knownTermGuidance:!!d.knownTermGuidance,
    termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm
  }};
}
async function pair(first,second){
  actionLog=[];
  const history=[{role:'user',text:first}];
  const a=await B.handle({message:first,history:history.slice()});
  history.push({role:'assistant',text:String(a.answer||''),meta:compactMeta(a)});
  history.push({role:'user',text:second});
  const b=await B.handle({message:second,history:history.slice()});
  return {first:a,second:b,actions:actionLog.slice()};
}
async function triplet(first,second,third){
  actionLog=[];
  const history=[{role:'user',text:first}];
  const a=await B.handle({message:first,history:history.slice()});
  history.push({role:'assistant',text:String(a.answer||''),meta:compactMeta(a)});
  history.push({role:'user',text:second});
  const b=await B.handle({message:second,history:history.slice()});
  const secondActions=actionLog.slice();
  history.push({role:'assistant',text:String(b.answer||''),meta:compactMeta(b)});
  history.push({role:'user',text:third});
  actionLog=[];
  const c=await B.handle({message:third,history:history.slice()});
  return {first:a,second:b,third:c,secondActions:secondActions,actions:actionLog.slice()};
}
function countAction(result,name){return result.actions.filter(x=>x.name===name).length;}
function findAction(result,name){return result.actions.find(x=>x.name===name);}
(async()=>{
  let x=await pair('因縁','7で探して');
  check('bond followup asks only for missing formation',/因縁数は7因縁で分かっています。陣形だけ教えてください/.test(x.second.answer||'')&&x.actions.length===0,x);

  x=await pair('見聞録','MAXにして');
  check('kenbun followup executes panel max',countAction(x,'panel_max')===1&&findAction(x,'panel_max').args.panel==='kenbun',x);

  x=await pair('文曲','2人除外');
  check('bunkyoku followup executes factor exclusion once',countAction(x,'apply_search')===1&&findAction(x,'apply_search').args.factor4Exclude===2,x);
  check('bunkyoku followup never excludes a hero named bunkyoku',countAction(x,'set_excluded_hero')===0,x);

  x=await pair('全MAX','解除して');
  check('all max followup executes clear',countAction(x,'clear_all_max')===1,x);

  x=await pair('配置英傑','前田慶次を入れて');
  check('placement followup executes owned hero action',countAction(x,'set_owned_hero_auto')===1&&findAction(x,'set_owned_hero_auto').args.hero==='前田慶次',x);
  check('placement followup reruns search and avoids profile route',countAction(x,'rerun_search')===1&&x.second.mode!=='英傑マスター実データ'&&x.second.mode!=='広島カープ専用知識',x);

  x=await pair('除外英傑','前田慶次');
  check('exclusion followup executes excluded hero action',countAction(x,'set_excluded_hero')===1&&findAction(x,'set_excluded_hero').args.hero==='前田慶次'&&findAction(x,'set_excluded_hero').args.excluded===true,x);
  check('exclusion followup reruns search',countAction(x,'rerun_search')===1,x);

  x=await pair('差替候補','見せて');
  check('swap followup executes candidate retrieval',countAction(x,'get_swap_candidates')===1,x);

  x=await pair('全MAX','って何？');
  check('all max meaning remains help only',/fullmax help/.test(x.second.answer||'')&&x.actions.length===0,x);

  x=await pair('文曲','転生MAXではどうなる？');
  check('bunkyoku meaning remains help only',/bunkyoku help/.test(x.second.answer||'')&&x.actions.length===0,x);

  let y=await triplet('配置英傑','わかった','前田慶次を入れて');
  check('placement acknowledgement executes no site action',y.second&&y.second.mode==='日常会話'&&y.secondActions.length===0,y);
  check('placement after acknowledgement executes owned hero action',countAction(y,'set_owned_hero_auto')===1&&findAction(y,'set_owned_hero_auto').args.hero==='前田慶次',y);
  check('placement after acknowledgement reruns search',countAction(y,'rerun_search')===1,y);

  y=await triplet('全MAX','了解','解除して');
  check('all max acknowledgement executes no site action',y.second&&y.second.mode==='日常会話'&&y.secondActions.length===0,y);
  check('all max clear survives one acknowledgement',countAction(y,'clear_all_max')===1,y);

  console.log(`KNOWN TERM JINPO ACTIONS: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(error=>{console.error(error);process.exit(1);});
