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
  'jinpo-bot-smalltalk.js','jinpo-bot-kashin-name.js','jinpo-bot.js','jinpo-bot-persona.js'
].forEach(load);
const B=global.JINPO_BOT,CV=global.JINPO_BOT_CONVERSATION;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactData(data){
  data=data||{};
  if(data.conversationRepair)return {
    conversationRepair:true,contextBoundary:data.contextBoundary!==false,pendingRepair:!!data.pendingRepair,
    rejectedRoute:String(data.rejectedRoute||''),repairTargetDomain:String(data.repairTargetDomain||''),
    preservedQuery:String(data.preservedQuery||''),subjectHint:String(data.subjectHint||''),
    topicSwitch:!!data.topicSwitch,lastMode:String(data.lastMode||'')
  };
  if(data.heroKnowledge)return {heroKnowledge:true,hero:String(data.hero||''),heroes:Array.isArray(data.heroes)?data.heroes.slice(0,24):[],candidates:Array.isArray(data.candidates)?data.candidates.slice(0,12):[],stats:Array.isArray(data.stats)?data.stats.slice(0,12):[],heroRefinement:data.heroRefinement||null};
  if(data.carp)return {carp:true};
  if(data.siteGuide)return {siteGuide:true,siteItem:String(data.siteItem||''),siteConditions:Array.isArray(data.siteConditions)?data.siteConditions.slice(0,12):[]};
  return data;
}
async function createConversation(){
  const history=[];
  async function say(q){
    const r=await B.handle({message:q,history});
    history.push({role:'user',text:q},{role:'assistant',text:r.answer,meta:{mode:r.mode,data:compactData(r.data)}});
    return r;
  }
  return {history,say};
}
(async()=>{
  let c=await createConversation(),r;
  r=await c.say('苗字が前田の英傑');
  check('repair setup hero answer',r&&r.data&&r.data.heroKnowledge===true&&/前田慶次/.test(r.answer||''),r);
  r=await c.say('英傑じゃないよ');
  check('explicit rejection becomes repair',r&&r.mode==='会話修正'&&r.data&&r.data.conversationRepair===true,r);
  check('repair does not return understanding failure',!/理解不能|絞り切れなかった|うまく受け取れなかった/.test(r.answer||''),r&&r.answer);
  check('repair preserves useful query',/苗字が前田/.test(r.answer||'')&&r.data.preservedQuery==='苗字が前田',r);
  r=await c.say('選手の方');
  check('short correction follows pending route',r&&r.data&&r.data.carp===true&&/前田智徳/.test(r.answer||''),r);

  c=await createConversation();
  await c.say('前田智徳について');
  r=await c.say('カープじゃなくて英傑の前田');
  check('contrast correction switches carp to hero',r&&r.data&&r.data.heroKnowledge===true&&/前田利家/.test(r.answer||'')&&!/前田智徳/.test(r.answer||''),r);

  c=await createConversation();
  await c.say('苗字が前田の英傑');
  r=await c.say('それも違う、苗字が前田の選手');
  check('correction tail routes immediately',r&&r.data&&r.data.carp===true&&/前田智徳/.test(r.answer||''),r);

  c=await createConversation();
  await c.say('苗字が前田の英傑');
  r=await c.say('違う');
  check('generic rejection asks focused clarification',r&&r.mode==='会話修正'&&/何を探しているか|正しい分野/.test(r.answer||''),r);

  c=await createConversation();
  await c.say('苗字が前田の英傑');
  r=await c.say('話題をカープに変えて');
  check('explicit topic switch acknowledged',r&&r.mode==='会話修正'&&r.data&&r.data.repairTargetDomain==='carp',r);
  r=await c.say('前田');
  check('short followup stays switched carp topic',r&&r.data&&r.data.carp===true&&/前田智徳/.test(r.answer||''),r);

  c=await createConversation();
  await c.say('前田智徳について');
  r=await c.say('話題を英傑に変えて');
  check('hero topic switch recorded',r&&r.data&&r.data.repairTargetDomain==='hero',r);
  r=await c.say('腕力高いのは？');
  check('short stat question stays hero after switch',r&&r.data&&r.data.heroKnowledge===true&&/母里太兵衛/.test(r.answer||'')&&!/陣法検索/.test(r.answer||''),r);

  c=await createConversation();
  await c.say('苗字が前田の英傑');
  r=await c.say('話を変えて、黒田博樹について');
  check('prefix topic change uses corrected tail',r&&r.data&&r.data.carp===true&&/黒田博樹/.test(r.answer||'')&&!/差し替える/.test(r.answer||''),r);
  r=await c.say('家族は？');
  check('old hero context does not resurrect after boundary',r&&/黒田博樹/.test(r.answer||'')&&!/前田慶次|前田利家/.test(r.answer||''),r);

  check('difference question is not repair',CV.repairDirective('違いを教えて',[])===null,CV.repairDirective('違いを教えて',[]));
  check('normal previous-topic command is not repair',CV.repairDirective('前の話に戻って',[])===null,CV.repairDirective('前の話に戻って',[]));

  console.log(`CONVERSATION REPAIR CONTROL: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
