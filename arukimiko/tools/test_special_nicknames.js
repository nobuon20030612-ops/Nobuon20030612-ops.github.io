#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const store={};
global.window=global;
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
load('jinpo-bot-conversation.js');
load('jinpo-bot-smalltalk.js');
const S=global.JINPO_BOT_SMALLTALK;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function eq(name,got,want){check(name,got===want,JSON.stringify(got)+' != '+JSON.stringify(want));}
const MAMI='おやつは買ってあげないですよ＾－＾';
const AFRO='キャバクラ代浮きますね＾－＾';

[
  '真美タン','真美たんです','まみたんです','マミタンだよ','私は真美タンです',
  'わたしはマミタンといいます','名前はまみたんです','真美タンです、よろしくお願いします'
].forEach((q,i)=>eq('mami intro '+(i+1),S.local(q,{history:[]}),MAMI));

[
  'アフロ田中','あふろたなかです','アフロタナカだよ','俺はアフロ田中です',
  'おれはあふろ田中と名乗っています','名前はアフロたなかです','アフロ田中です、よろしく'
].forEach((q,i)=>eq('afro intro '+(i+1),S.local(q,{history:[]}),AFRO));

[
  ['真美タンって誰？',MAMI],
  ['真美タンを知ってる？',MAMI],
  ['私は真美タンじゃない',MAMI],
  ['アフロ田中について教えて',AFRO],
  ['アフロ田中と名乗った人がいた',AFRO],
  ['アフロ田中ではありません',AFRO]
].forEach(([q,bad],i)=>check('no false trigger '+(i+1),S.local(q,{history:[]})!==bad,S.local(q,{history:[]})));

console.log(`SPECIAL NICKNAMES: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
