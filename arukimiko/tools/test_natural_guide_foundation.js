#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const context={console,URL,window:{},location:{href:'https://example.test/index.html',origin:'https://example.test',pathname:'/index.html'}};
context.window=context;context.window.location=context.location;vm.createContext(context);
function load(name){vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});}
load('jinpo-bot-conversation.js');load('jinpo-bot-site-source-data.js');load('jinpo-bot-site-guide.js');
const G=context.JINPO_BOT_SITE_GUIDE;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
[
  ['九十九の','tsukumo'],['鬼神石の','kishin'],['魔導の','mado'],['鎮魂符の','chinkon'],
  ['家臣計算の','retainer'],['能力計算の','stats'],['英傑一覧の','heroes'],['食料の','food']
].forEach(([q,id])=>{const r=G.respond(q,{});check(q,r.handled&&r.data&&r.data.siteItem===id&&r.data.incompletePossessive===true&&r.links&&r.links.length===1,r);});
const stone=G.respond('文曲の',{});
check('文曲の keeps specific stone route',stone.handled&&stone.data&&stone.data.siteInternal==='stone'&&stone.data.stoneId===26,stone);
const unknown=G.respond('知らない言葉の',{});
check('unknown possessive is not guessed',!unknown.handled,unknown);
console.log(`NATURAL GUIDE FOUNDATION: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
