#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const context={console,URL,window:{},location:{href:'https://example.test/index.html',origin:'https://example.test',pathname:'/index.html'}};
context.window=context;context.window.location=context.location;
vm.createContext(context);
function load(name){vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});}
load('jinpo-bot-conversation.js');load('jinpo-bot-site-source-data.js');load('jinpo-bot-site-guide.js');
const G=context.JINPO_BOT_SITE_GUIDE;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
function route(q,opt){return G.respond(q,opt||{});}
[
  ['文曲の輝光',26,'monkyoku'],
  ['文曲の',26,'monkyoku'],
  ['文曲の作り方を見たい',26,'monkyoku'],
  ['輝光の文曲を開いて',26,'monkyoku'],
  ['武曲の合成',23,'bukyoku'],
  ['貪狼の荒石を見たい',29,'tanrou']
].forEach(([q,id,key])=>{
  const r=route(q),u=String(r.links&&r.links[0]&&r.links[0].url||'');
  check(q,r.handled&&r.data&&r.data.siteItem==='seikai'&&r.data.stoneId===id&&u.includes('stone='+id)&&u.includes('#'+key),r);
});
const ambiguous=route('文曲');
check('bare 文曲 remains available to other domains',!ambiguous.handled||!(ambiguous.data&&ambiguous.data.siteInternal==='stone'),ambiguous);
const contextual=route('じゃあ文曲は',{history:[{role:'assistant',text:'星海の荒石はこちらです。',meta:{data:{siteItem:'seikai'},links:[{url:'https://example.test/seikai.html'}]}}]});
check('contextual 文曲',contextual.handled&&contextual.data&&contextual.data.stoneId===26,contextual);
check('文曲 answer is helpful',/紺碧.*山吹.*濡羽.*朽葉/.test(route('文曲の輝光').answer||''),route('文曲の輝光'));
console.log(`SEIKAI NATURAL LINKS: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
