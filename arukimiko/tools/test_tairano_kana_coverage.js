#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.location={href:'https://example.test/陣法/jinpo.html'};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
load('jinpo-bot-conversation.js');
load('jinpo-bot-tairano-data.js');
load('jinpo-bot-tairano-knowledge.js');

const C=global.JINPO_BOT_CONVERSATION;
const T=global.JINPO_TAIRANO_KNOWLEDGE;
const facts=global.JINPO_TAIRANO_KNOWLEDGE_DATA.facts||[];
const map=new Map();
for(const fact of facts){
  for(const reading of fact.readings||[]){
    if(!reading||reading.length<3)continue;
    if(!map.has(reading))map.set(reading,new Set());
    map.get(reading).add(fact.canonical);
  }
}
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function kata(v){return String(v).replace(/[ぁ-ゖ]/g,ch=>String.fromCharCode(ch.charCodeAt(0)+0x60)).replace(/ゔ/g,'ヴ');}
for(const [reading,names] of map){
  if(names.size!==1)continue;
  const canonical=[...names][0];
  const qH=reading+'のかうんたあ';
  const qK=kata(reading)+'ノカウンタア';
  const mixed=reading.split('').map((ch,i)=>i%2?kata(ch):ch).join('')+'のカウンター';
  const nH=C.normalizeKanaInput(qH).text;
  const nK=C.normalizeKanaInput(qK).text;
  const nM=C.normalizeKanaInput(mixed).text;
  check('normalize hira '+reading,nH.includes(canonical),{q:qH,n:nH,canonical});
  check('normalize kata '+reading,nK.includes(canonical),{q:qK,n:nK,canonical});
  check('normalize mixed '+reading,nM.includes(canonical),{q:mixed,n:nM,canonical});
  const r=T.respond(qK,{history:[]});
  check('respond '+reading,!!(r&&r.handled&&String(r.answer||'').includes(canonical)),r&&r.answer);
}
console.log(`TAIRANO KANA COVERAGE: ${pass} / ${pass+fail} PASS (${map.size} readings)`);
if(fail)process.exit(1);
