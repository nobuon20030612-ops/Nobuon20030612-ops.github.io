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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',stoneName:d.stoneName||'',siteLinkDestinationExplanation:!!d.siteLinkDestinationExplanation,sitePostOpenGuidance:!!d.sitePostOpenGuidance}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function monkyoku(r){return !!(r&&r.links&&r.links.length===1&&/seikai\.html\?stone=26#monkyoku/.test(String(r.links[0].url||'')));}
function extractMainScript(html){const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);return scripts[scripts.length-1]||'';}
(async()=>{
  let s=session(),r=await s.ask('文曲の輝光');
  check('bare stone keeps exact deep link without claiming automatic navigation',/星海の荒石の「文曲」合成早見表はこちらです/.test(r.answer||'')&&r.data&&r.data.siteOpen===true&&!(r.data.siteAutoNavigate===true)&&monkyoku(r),r);
  check('bare stone does not over-explain recipe',!/紺碧.*山吹.*濡羽.*朽葉/.test(r.answer||''),r);

  r=await session().ask('文曲の作り方を見たい');
  check('explicit recipe request explains recipe',/紺碧.*山吹.*濡羽.*朽葉/.test(r.answer||'')&&/生命1500、知力250/.test(r.answer||'')&&monkyoku(r),r);

  s=session();await s.ask('文曲の輝光');r=await s.ask('これどこに飛ぶ？');
  check('destination wording describes future navigation',/「文曲」表示へ移動します/.test(r.answer||'')&&!/開いた状態/.test(r.answer||'')&&monkyoku(r),r);

  s=session();await s.ask('文曲の輝光');r=await s.ask('じゃあそれ開いて');
  check('explicit open still recalls the exact deep link',/このリンクから開けます/.test(r.answer||'')&&monkyoku(r),r);
  r=await s.ask('開いたらまず何をすればいい？');
  check('next-step wording stays conditional',/リンクを開くと.*「文曲」合成早見表/.test(r.answer||'')&&!/開いた状態|すでに開いて/.test(r.answer||'')&&monkyoku(r),r);

  const html=fs.readFileSync(path.join(siteRoot,'seikai.html'),'utf8'),script=extractMainScript(html);
  const display={innerHTML:''},button={attrs:{},setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;}},listeners={};
  const ctx={console,URLSearchParams,location:{search:'?stone=26',hash:'#monkyoku',href:'https://example.test/seikai.html?stone=26#monkyoku'},document:{title:'',getElementById:id=>id==='display'?display:null,querySelector:sel=>sel.includes('show(26)')?button:null},window:{addEventListener:(ev,fn)=>{listeners[ev]=fn;}}};
  ctx.window.location=ctx.location;ctx.window.document=ctx.document;vm.createContext(ctx);vm.runInContext(script,ctx);
  check('deep link actually renders monkyoku content',/文曲の輝光\s*合成早見表/.test(display.innerHTML)&&/生命/.test(display.innerHTML)&&ctx.document.title==='文曲の輝光 | 星海の荒石',display.innerHTML.slice(0,300));
  check('deep link lifecycle is resilient',typeof listeners.pageshow==='function'&&typeof listeners.hashchange==='function'&&typeof listeners.popstate==='function',Object.keys(listeners));

  console.log(`STAGE14AL SEIKAI RESPONSE ACTION CONSISTENCY: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
