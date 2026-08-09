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
function deep(r,id,key){return !!(r&&r.links&&r.links.length===1&&String(r.links[0].url||'').includes('seikai.html?stone='+id+'#'+key));}
async function ask(q){return B.handle({message:q,history:[{role:'user',text:q}]});}
function extractFunction(src,name){
  const start=src.indexOf('function '+name+'(');if(start<0)return '';
  const brace=src.indexOf('{',start);if(brace<0)return '';
  let depth=0,quote='',esc=false;
  for(let i=brace;i<src.length;i++){
    const c=src[i];
    if(quote){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  return '';
}
(async()=>{
  let r=await ask('文曲の輝光');
  check('monkyoku keeps exact expanded destination',r.data&&r.data.siteOpen===true&&r.data.siteInternal==='stone'&&r.data.stoneName==='文曲'&&deep(r,26,'monkyoku'),r);
  check('monkyoku no longer declares automatic navigation',!(r.data&&r.data.siteAutoNavigate===true)&&!/開いた状態で.*表示します|移動しました|開きました/.test(r.answer||''),r);
  check('monkyoku keeps a separate conversation link',r.links&&r.links.length===1&&/文曲の輝光を開く/.test(r.links[0].label||''),r.links);

  r=await ask('武曲の合成');
  check('other exact stone uses the same confirmation-ready contract',r.data&&r.data.siteOpen===true&&!(r.data.siteAutoNavigate===true)&&deep(r,23,'bukyoku'),r);

  r=await ask('九十九を開いて');
  check('explicit generic page open is confirmation-ready',r.data&&r.data.siteOpen===true&&r.links&&r.links.length===1&&/九十九\.html/.test(decodeURIComponent(String(r.links[0].url||''))),r);
  r=await ask('九十九って何？');
  check('information-only question does not trigger navigation confirmation',!(r.data&&r.data.siteOpen===true),r);

  const chat=fs.readFileSync(path.join(root,'jinpo-ai-chat.js'),'utf8');
  const targetFn=extractFunction(chat,'guideNavigationTarget'),askFn=extractFunction(chat,'askGuideNavigationYesNo'),scheduleFn=extractFunction(chat,'scheduleGuideNavigationConfirmation');
  check('production chat uses yes-no confirmation instead of auto-navigation',!!targetFn&&!!askFn&&!!scheduleFn&&/window\.__jinpoAskYesNo/.test(chat)&&/いいえ/.test(chat)&&/はい/.test(chat)&&!/scheduleExactGuideAutoNavigation\(result\)/.test(chat),null);
  const common={opts:null},commonCtx={Promise,window:{__jinpoAskYesNo:opts=>{common.opts=opts;return Promise.resolve(false);}}};
  vm.createContext(commonCtx);vm.runInContext(askFn,commonCtx);await commonCtx.askGuideNavigationYesNo('確認文');
  check('jinpo page reuses the existing common confirmation modal',common.opts&&common.opts.title==='ページ移動の確認'&&common.opts.message==='確認文',common.opts);
  check('fallback keeps the same yes-no order and common gold-red modal tone',/arukimikoSiteNavConfirmNo[\s\S]*いいえ[\s\S]*arukimikoSiteNavConfirmYes[\s\S]*はい/.test(chat)&&/#e7bd5c/.test(chat)&&/#a83224/.test(chat),null);

  const nav={assigned:'',decision:false,prompt:''};
  const loc={href:'https://example.test/index.html',origin:'https://example.test',assign:u=>{nav.assigned=String(u);}};
  const ctx={URL,Promise,setTimeout:fn=>{fn();return 1;},location:loc,window:{location:loc,open:()=>null},askGuideNavigationYesNo:msg=>{nav.prompt=String(msg);return Promise.resolve(nav.decision);}};
  vm.createContext(ctx);vm.runInContext(targetFn+'\n'+scheduleFn,ctx);
  const monkyoku=await ask('文曲の輝光');
  check('declining the modal keeps the current page',ctx.scheduleGuideNavigationConfirmation(monkyoku)===true,monkyoku);
  await Promise.resolve();await Promise.resolve();
  check('no means no navigation and prompt names expanded monkyoku destination',nav.assigned===''&&/星海の荒石の「文曲」合成早見表へ移動しますか/.test(nav.prompt),{assigned:nav.assigned,prompt:nav.prompt});
  nav.decision=true;nav.assigned='';nav.prompt='';ctx.scheduleGuideNavigationConfirmation(monkyoku);await Promise.resolve();await Promise.resolve();
  check('yes moves to exact expanded monkyoku destination',/seikai\.html\?stone=26#monkyoku$/.test(nav.assigned),nav.assigned);

  const html=fs.readFileSync(path.join(siteRoot,'seikai.html'),'utf8');
  check('destination renderer remains intact',/function showLinkedStone\(\)/.test(html)&&/URLSearchParams\(location\.search\)/.test(html)&&/hashchange/.test(html),null);

  console.log(`STAGE14AN NAVIGATION CONFIRMATION: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
