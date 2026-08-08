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
function one(q,id){const r=G.respond(q,{});check(q,r.handled&&r.data&&r.data.siteItem===id&&r.data.pageFreeGoal&&r.links&&r.links.length===1,r);}
one('英傑の因子を調べたい','heroes');
one('合成最低発現数を見たい','kishin');
one('6人の組み合わせを探したい','jinpo');
one('輝光の材料を見たい','seikai');
one('敵の数値を確認したい','counter');
one('名物の合計を見たい','meibutsu');
let r=G.respond('8個選んで合計を見たい',{});
check('ambiguous eight-item goal',r.handled&&r.data&&r.data.needsClarification&&r.data.candidates.join(',')==='kishin,tsukumo,mado'&&r.links.length===3,r);
r=G.respond('保存できる計算機どれ',{});
check('savable calculator candidates',r.handled&&r.data&&r.data.needsClarification&&r.data.candidates.join(',')==='stats,retainer'&&r.links.length===2,r);
r=G.respond('なんとなく便利なの',{});
check('vague request not guessed',!r.handled,r);
console.log(`PAGE-FREE GOAL GUIDANCE: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
