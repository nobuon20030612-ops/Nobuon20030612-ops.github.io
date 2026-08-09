#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),siteRoot=path.resolve(root,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
function stone(r,id,key){return !!(r&&r.links&&r.links.length===1&&String(r.links[0].url||'').includes('seikai.html?stone='+id+'#'+key));}
async function ask(q){return B.handle({message:q,history:[{role:'user',text:q}]});}
(async()=>{
  let r=await ask('文曲の輝光');
  check('revised monkyoku contract disables automatic navigation',r.data&&r.data.siteOpen===true&&!(r.data.siteAutoNavigate===true)&&stone(r,26,'monkyoku'),r);
  check('reply no longer claims movement already happened',/星海の荒石の「文曲」合成早見表はこちらです/.test(r.answer||'')&&!/開いた状態で.*表示します|移動しました|開きました/.test(r.answer||''),r.answer);
  check('bare exact request stays concise',!/紺碧.*山吹.*濡羽.*朽葉/.test(r.answer||''),r.answer);

  r=await ask('武曲の合成');
  check('other exact stone follows revised confirmation-ready contract',r.data&&r.data.siteOpen===true&&!(r.data.siteAutoNavigate===true)&&stone(r,23,'bukyoku'),r);

  r=await ask('星海の荒石');
  check('generic page mention is not marked for forced navigation',!(r.data&&r.data.siteOpen===true),r);
  r=await ask('文曲');
  check('ambiguous bare stone name is not force-navigated',!(r.data&&r.data.siteAutoNavigate===true),r);

  const chat=fs.readFileSync(path.join(root,'jinpo-ai-chat.js'),'utf8');
  check('old automatic navigation scheduler is removed',!/scheduleExactGuideAutoNavigation\(result\)/.test(chat)&&/scheduleGuideNavigationConfirmation\(result\)/.test(chat),null);
  check('chat confirmation reuses common yes-no modal when available',/window\.__jinpoAskYesNo/.test(chat)&&/ページ移動の確認/.test(chat),null);

  const html=fs.readFileSync(path.join(siteRoot,'seikai.html'),'utf8');
  check('destination page still resolves exact stone from URL',/function showLinkedStone\(\)/.test(html)&&/URLSearchParams\(location\.search\)/.test(html)&&/show\(id\)/.test(html)&&/hashchange/.test(html),null);

  console.log(`STAGE14AM REVISED NAVIGATION CONTRACT: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
