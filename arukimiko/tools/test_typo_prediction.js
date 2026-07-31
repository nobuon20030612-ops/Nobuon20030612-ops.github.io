#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
global.window=global;
global.location={href:'https://example.test/陣法/jinpo.html',origin:'https://example.test',pathname:'/陣法/jinpo.html'};
global.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
global.sessionStorage=global.localStorage;
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
load('jinpo-bot-conversation.js');
load('jinpo-bot-parser.js');
load('jinpo-bot-nlu.js');
const C=global.JINPO_BOT_CONVERSATION,P=global.JINPO_BOT_PARSER,N=global.JINPO_BOT_NLU;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function pipeline(input){let text=String(input);['normalizeCasualInput','normalizeKanaInput','normalizeKnownInput'].forEach(fn=>{const r=C[fn](text);if(r&&r.text)text=String(r.text);});return text;}
const corrected=[
  ['鬼神席の使方おしえて','鬼神石の使い方教えて'],
  ['魔導結品の入手どこ','魔導結晶の入手どこ'],
  ['英傑一欄みたい','英傑一覧みたい'],
  ['天下統一奇談のぺーじ','天下統一奇譚のページ'],
  ['家臣計算気どこ','家臣計算機どこ'],
  ['検索結かの2位にして','検索結果の2位にして'],
  ['魔導晶結のページ','魔導結晶のページ'],
  ['魔導結のページ','魔導結晶のページ'],
  ['鬼神席と魔導結品を比較したい','鬼神石と魔導結晶を比較したい'],
  ['陣型は鶴翼で耐久高いの探して','陣形は鶴翼で耐久高いの探して'],
  ['全MXこみで検索','全MAX込みで検索'],
  ['英傑一覽を開いて','英傑一覧を開いて']
];
corrected.forEach(([src,want])=>check('correct '+src,pipeline(src)===want,{got:pipeline(src),want}));
const stable=['鬼神石の使い方教えて','魔導結晶のページ','英傑一覧を開いて','全MAX込みで検索'];
stable.forEach(x=>check('idempotent '+x,pipeline(pipeline(x))===pipeline(x),pipeline(pipeline(x))));
const negatives=['アライグマを見た','お祭りに行く','いかがですか','そこにいる','真法について','親戚の話','九十人いる','能力が高い人','家臣の名前つけて','朝比奈康元は？'];
negatives.forEach(x=>{const a=pipeline(x).replace(/[?？！!。]/g,''),b=x.replace(/[?？！!。]/g,'');check('false positive blocked '+x,a===b,{got:pipeline(x)});});
const plan=P.parse('鶴翼の7因縁で耐久1200以上、全MX込みで検索');
check('parser recognizes typo-corrected search',!!plan&&plan.recognized===true,plan);
check('parser keeps formation',plan&&plan.searchPatch&&plan.searchPatch.formation==='鶴翼',plan&&plan.searchPatch);
check('parser keeps count',plan&&plan.searchPatch&&plan.searchPatch.count===7,plan&&plan.searchPatch);
check('parser corrects fullmax',plan&&plan.searchPatch&&plan.searchPatch.searchBasis==='fullmax',plan&&plan.searchPatch);
check('parser keeps range',plan&&plan.searchPatch&&plan.searchPatch.priority1&&plan.searchPatch.priority1.min===1200,plan&&plan.searchPatch);
const ex=N.debugExtract('陣型は鶴翼、耐久1200以上で探して');
check('NLU receives known correction',ex&&ex.formation==='鶴翼'&&ex.range&&ex.range.min===1200,ex);
check('known typo distance supports transposition',C.knownTypoDistance('魔導晶結','魔導結晶')===1,C.knownTypoDistance('魔導晶結','魔導結晶'));
console.log(`TYPO PREDICTION: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
