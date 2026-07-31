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
const C=global.JINPO_BOT_CONVERSATION,T=global.JINPO_TAIRANO_KNOWLEDGE;
const facts=global.JINPO_TAIRANO_KNOWLEDGE_DATA.facts||[];
let pass=0,fail=0,smallCount=0,looseCount=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function uniqueReadingRules(){
  const exact=new Map();
  for(const fact of facts){
    for(const reading of fact.readings||[]){
      if(!reading||reading.length<3)continue;
      if(!exact.has(reading))exact.set(reading,new Set());
      exact.get(reading).add(fact.canonical);
    }
  }
  return [...exact].filter(([,names])=>names.size===1).map(([reading,names])=>({reading,canonical:[...names][0]}));
}
function uniqueByFold(rows,fold,min){
  const m=new Map();
  for(const row of rows){
    const key=fold(row.reading);
    if(!key||key.length<min||key===row.reading)continue;
    if(!m.has(key))m.set(key,new Set());
    m.get(key).add(row.canonical);
  }
  return [...m].filter(([,names])=>names.size===1).map(([key,names])=>({key,canonical:[...names][0]}));
}
const rows=uniqueReadingRules();
const smallRows=uniqueByFold(rows,C.smallKanaFold,4);
const looseRows=uniqueByFold(rows,C.looseKanaFold,5);
for(const row of smallRows){
  smallCount++;
  const q=row.key+'のかうんたあ';
  const n=C.normalizeKanaInput(q).text;
  check('small normalize '+row.key,n.includes(row.canonical),{q,n,canonical:row.canonical});
  const r=T.respond(q,{history:[]});
  check('small respond '+row.key,!!(r&&r.handled&&String(r.answer||'').includes(row.canonical)),r&&r.answer);
}
for(const row of looseRows){
  looseCount++;
  const q=row.key+'のかうんたあ';
  const n=C.normalizeKanaInput(q).text;
  check('loose normalize '+row.key,n.includes(row.canonical),{q,n,canonical:row.canonical});
  const r=T.respond(q,{history:[]});
  check('loose respond '+row.key,!!(r&&r.handled&&String(r.answer||'').includes(row.canonical)),r&&r.answer);
}
check('has small fuzzy cases',smallCount>0,smallCount);
check('has loose fuzzy cases',looseCount>0,looseCount);
console.log(`TAIRANO KANA FUZZY COVERAGE: ${pass} / ${pass+fail} PASS (${smallCount} small, ${looseCount} loose)`);
if(fail)process.exit(1);
