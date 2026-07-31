#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
global.window=global;
global.location={href:'https://example.test/arukimiko/loader.js',origin:'https://example.test',pathname:'/陣法/jinpo.html'};
function element(){
  const attrs={};
  return {sheet:null,setAttribute:(k,v)=>{attrs[k]=String(v);},getAttribute:k=>attrs[k]||null,addEventListener:()=>{},remove:()=>{}};
}
global.document={
  currentScript:{src:'https://example.test/arukimiko/loader.js'},
  querySelector:()=>null,
  createElement:()=>element(),
  head:{appendChild:()=>{}},
  readyState:'loading',
  addEventListener:()=>{}
};
global.addEventListener=()=>{};
global.sessionStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
global.localStorage=global.sessionStorage;
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
load('jinpo-bot-conversation.js');
load('loader.js');
const L=global.ARUKIMIKO_LAZY;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function groups(q){return L.groupsForMessage(q,[]);}
check('loader exports lazy router',!!L&&typeof L.groupsForMessage==='function',L);
check('katakana tool lazy group',groups('キシンセキノツカイカタ').includes('tool'),groups('キシンセキノツカイカタ'));
check('hiragana tool lazy group',groups('まどうけっしょうのつかいかた').includes('tool'),groups('まどうけっしょうのつかいかた'));
check('katakana counter lazy group',groups('アシカガヨシテルノカウンタア').includes('tairano'),groups('アシカガヨシテルノカウンタア'));
check('hiragana Carp name lazy group',groups('くろだひろきのかぞく').includes('carp'),groups('くろだひろきのかぞく'));
check('katakana Carp name lazy group',groups('クロダヒロキノカゾク').includes('carp'),groups('クロダヒロキノカゾク'));
check('foreign name hiragana lazy group',groups('えるどれっどのかぞく').includes('carp'),groups('えるどれっどのかぞく'));
check('kana kashin lazy group',groups('カシンノナマエツケ').includes('kashin'),groups('カシンノナマエツケ'));
check('dynamic tairano reading hiragana',groups('あさひなやすともは？').includes('tairano'),groups('あさひなやすともは？'));
check('dynamic tairano reading katakana',groups('アサヒナヤストモハ？').includes('tairano'),groups('アサヒナヤストモハ？'));
check('dynamic tairano monster reading',groups('うごめくじゃれいは？').includes('tairano'),groups('うごめくじゃれいは？'));
check('dynamic tairano mixed kana',groups('トコヨノせんぺいは？').includes('tairano'),groups('トコヨノせんぺいは？'));
check('short reading false positive blocked',!groups('おまつりにいく').includes('tairano'),groups('おまつりにいく'));
check('halfwidth tool lazy group',groups('ｷｼﾝｾｷ１ﾊﾞﾝﾉﾆｭｳｼｭ').includes('tool'),groups('ｷｼﾝｾｷ１ﾊﾞﾝﾉﾆｭｳｼｭ'));
check('small kana tool lazy group',groups('まとうけつしようのにゆうしゆ').includes('tool'),groups('まとうけつしようのにゆうしゆ'));
check('loose tairano reading lazy group',groups('とこよのせんへいは？').includes('tairano'),groups('とこよのせんへいは？'));
check('loose Carp alias lazy group',groups('えるとれつとのかそく').includes('carp'),groups('えるとれつとのかそく'));
check('loose false positive new law blocked',!groups('しんほうについて').includes('tairano'),groups('しんほうについて'));

check('spaced kana tool lazy group',groups('き し ん せ き の つ か い か た').includes('tool'),groups('き し ん せ き の つ か い か た'));
check('one kana omitted tool lazy group',groups('きしせきのつかいかた').includes('tool'),groups('きしせきのつかいかた'));
check('one kana omitted tairano lazy group',groups('あさひなやすものかうんたあ').includes('tairano'),groups('あさひなやすものかうんたあ'));
check('one kana omitted foreign Carp lazy group',groups('えるどれどのかぞく').includes('carp'),groups('えるどれどのかぞく'));
check('one kana omitted ordinary relative blocked',!groups('しんせきのはなし').includes('tool')&&!groups('しんせきのはなし').includes('tairano'),groups('しんせきのはなし'));

check('transposed name alone blocked',!groups('あさひなやすもとは？').includes('tairano'),groups('あさひなやすもとは？'));
check('known kanji typo tool lazy group',groups('鬼神席1番の入手').includes('tool'),groups('鬼神席1番の入手'));
check('known mixed typo tool lazy group',groups('魔導結品の能力').includes('tool'),groups('魔導結品の能力'));
check('known omission tool lazy group',groups('魔導結の入手').includes('tool'),groups('魔導結の入手'));
check('ordinary ninety people remains blocked',!groups('九十人いる').includes('tool'),groups('九十人いる'));
check('ordinary relative remains blocked after known typo layer',!groups('親戚の話').includes('tool'),groups('親戚の話'));
console.log(`LOADER KANA ROUTING: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
