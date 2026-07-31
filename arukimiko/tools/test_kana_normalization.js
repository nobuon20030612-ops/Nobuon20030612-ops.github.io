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
const preDataKana=global.JINPO_BOT_CONVERSATION.normalizeKanaInput('あさひなやすともは？').text;
[
  'jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js',
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-carp-knowledge.js',
  'jinpo-bot-parser.js','jinpo-bot-nlu.js'
].forEach(load);

const C=global.JINPO_BOT_CONVERSATION;
const Tool=global.JINPO_BOT_TOOL_KNOWLEDGE;
const Tairano=global.JINPO_TAIRANO_KNOWLEDGE;
const Carp=global.JINPO_BOT_CARP_KNOWLEDGE;
const Parser=global.JINPO_BOT_PARSER;
const NLU=global.JINPO_BOT_NLU;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function eq(name,got,want){check(name,got===want,JSON.stringify(got)+' != '+JSON.stringify(want));}
function norm(text){return C.normalizeKanaInput(text).text;}

// 遅延読込前に一度解析済みでも、正本読込後は読み辞書を更新する。
eq('pre-data unknown reading stays kana',preDataKana,'あさひなやすともは?');
eq('post-data cache refresh',norm('あさひなやすともは？'),'朝比奈泰朝は?');

// サイト・ツール名。
eq('hiragana kishinseki',norm('きしんせきのつかいかた'),'鬼神石の使い方');
eq('katakana kishinseki',norm('キシンセキノツカイカタ'),'鬼神石の使い方');
eq('hiragana madou',norm('まどうけっしょうのにゅうしゅ'),'魔導結晶の入手');
eq('katakana tsukumo',norm('ツクモノセイメイ'),'九十九の生命');
eq('hiragana tairano',norm('たいらのやぼうにもどって'),'たいらの野望に戻って');
eq('katakana counter',norm('アシカガヨシテルノカウンタア'),'足利義輝のカウンター');
eq('hiragana site page',norm('せいかいのあらいしのちゅういてん'),'星海の荒石の注意点');

// 陣法・能力・画面操作。
eq('hiragana formation search',norm('かくよくのなないんねんでたいきゅうたかいのけんさく'),'鶴翼の7因縁で耐久高いの検索');
eq('katakana formation search',norm('カクヨクノナナインネンデタイキュウタカイノケンサク'),'鶴翼の7因縁で耐久高いの検索');
eq('hero list open',norm('えいけついちらんをひらいて'),'英傑一覧を開いて');
eq('all clear',norm('ゼンカイジョ'),'全解除');
eq('hide',norm('ひひょうじにして'),'非表示にして');
eq('fullmax basis',norm('ぜんまっくすこみのけんさくきじゅん'),'全MAX込みの検索基準');
eq('sort total',norm('こみごうけいでならべかえ'),'込み合計で並べ替え');

// 番号・順位・上下限。
eq('hiragana item number',norm('きしんせきいちばんのにゅうしゅ'),'鬼神石1番の入手');
eq('katakana item number',norm('キシンセキイチバンノニュウシュ'),'鬼神石1番の入手');
eq('rank apply',norm('けんさくけっかのにいをてきよう'),'検索結果の2位を適用');
eq('rank apply katakana',norm('ケンサクケッカノニイヲテキヨウ'),'検索結果の2位を適用');
eq('numeric minimum',norm('たいきゅう1200いじょうでけんさく'),'耐久1200以上で検索');
eq('numeric maximum',norm('たいきゅう1200いかでけんさく'),'耐久1200以下で検索');

// 半角、全角数字、小書き文字、濁点抜け。
eq('halfwidth katakana and number',norm('ｷｼﾝｾｷ１ﾊﾞﾝﾉﾆｭｳｼｭ'),'鬼神石1番の入手');
eq('small kana expanded',norm('まどうけつしようのにゆうしゆ'),'魔導結晶の入手');
eq('halfwidth small kana expanded',norm('ﾏﾄｳｹﾂｼﾖｳﾉﾆﾕｳｼﾕ'),'魔導結晶の入手');
eq('dakuten omitted tool',norm('まとうけつしようのにゆうしゆ'),'魔導結晶の入手');
eq('fullwidth mixed numeric',norm('ﾀｲｷｭｳ１２00ｲｼﾞｮｳﾃﾞｹﾝｻｸ'),'耐久1200以上で検索');
eq('small kana ui word',norm('けんさくけつかのしようさい'),'検索結果の詳細');


// 音声入力などでかなの間に空白が入った場合。
eq('spaced hiragana tool',norm('き し ん せ き の つ か い か た'),'鬼神石の使い方');
eq('spaced katakana person',norm('クロダ ヒロキ ノ カゾク'),'黒田博樹の家族');
eq('spaced mixed formation',norm('かくよく の 7 いんねん で たいきゅう たかい の けんさく'),'鶴翼の7因縁で耐久高いの検索');

// 長い登録語で1文字だけ抜けた入力。候補が一つに決まる語だけ復元する。
eq('one kana omitted tool',norm('きしせきのつかいかた'),'鬼神石の使い方');
eq('one kana omitted ui word',norm('けんさくけかのしょうさい'),'検索結果の詳細');
eq('one kana omitted person tail',norm('くろだひろのかぞく'),'黒田博樹の家族');

// 人物名。主要な漢字名は読みから正規名へ戻す。
eq('kuroda hiragana',norm('くろだひろきのかぞく'),'黒田博樹の家族');
eq('kuroda katakana',norm('クロダヒロキノカゾク'),'黒田博樹の家族');
eq('suekane hiragana',norm('すえかねしょうたのせいせき'),'末包昇大の成績');
eq('suekane katakana',norm('スエカネショウタノセイセキ'),'末包昇大の成績');
eq('ashikaga hiragana',norm('あしかがよしてるのかうんたあ'),'足利義輝のカウンター');
eq('person dakuten omitted',norm('おたのふなかのいつわ'),'織田信長の逸話');
eq('person small kana expanded',norm('ほそかわふしたかのけいれき'),'細川藤孝の経歴');

// カウンター正本に読みがある名前は、手登録なしでも全体から自動認識する。
eq('dynamic tairano hiragana',norm('あさひなやすともは？'),'朝比奈泰朝は?');
eq('dynamic tairano katakana',norm('アサヒナヤストモハ？'),'朝比奈泰朝は?');
eq('dynamic tairano mixed kana',norm('アサヒナやすともは？'),'朝比奈泰朝は?');
eq('dynamic tairano monster',norm('うごめくじゃれいのかうんたあ'),'蠢く邪霊のカウンター');
eq('dynamic tairano enemy katakana',norm('トコヨノセンペイハ？'),'常世の尖兵は?');
eq('dynamic tairano dakuten omitted',norm('とこよのせんへいのかうんたあ'),'常世の尖兵のカウンター');
eq('dynamic tairano small kana expanded',norm('うこめくしやれいのかうんたあ'),'蠢く邪霊のカウンター');

// 画面・検索・設定系の一般語も、漢字を使わず操作意図へつなげる。
eq('ui filter save',norm('しぼりこみじょうけんをほぞん'),'絞り込み条件を保存');
eq('ui hide button',norm('ガメンノボタンヲヒヒョウジ'),'画面のボタンを非表示');
eq('ui input clear',norm('にゅうりょくらんをけす'),'入力欄を消す');
eq('ui result detail',norm('けんさくけっかのしょうさい'),'検索結果の詳細');
eq('hero factor job',norm('えいけつのいんしとしょくぎょう'),'英傑の因子と職業');

// 外国人など元からカタカナの正本名は、ひらがな入力でも照合する。
check('foreign player hiragana fold',Carp.foundNames('えるどれっどのかぞく').includes('ブラッド・エルドレッド'),Carp.foundNames('えるどれっどのかぞく'));
check('foreign player katakana exact',Carp.foundNames('エルドレッドノカゾク').includes('ブラッド・エルドレッド'),Carp.foundNames('エルドレッドノカゾク'));
check('foreign player loose kana',Carp.foundNames('えるとれつとのかそく').includes('ブラッド・エルドレッド'),Carp.foundNames('えるとれつとのかそく'));
check('foreign player halfwidth loose',Carp.foundNames('ｴﾙﾄﾚﾂﾄﾞﾉｶｿﾞｸ').includes('ブラッド・エルドレッド'),Carp.foundNames('ｴﾙﾄﾚﾂﾄﾞﾉｶｿﾞｸ'));
check('kanji player kana normalized into Carp',Carp.foundNames('クロダヒロキノカゾク').includes('黒田博樹'),Carp.foundNames('クロダヒロキノカゾク'));
check('kanji player dakuten omitted into Carp',Carp.foundNames('くろたひろきのかそく').includes('黒田博樹'),Carp.foundNames('くろたひろきのかそく'));

// 誤変換防止。
eq('do not convert raccoon',norm('アライグマ'),'アライグマ');
eq('do not convert festival into Omatsu',norm('おまつりにいく'),'おまつりにいく');
eq('do not convert ikaga',norm('いかがですか'),'いかがですか');
eq('do not convert niiru',norm('そこにいる'),'そこにいる');
eq('do not guess abnormal',norm('バグにいじょうがある'),'バグにいじょうがある');
eq('do not convert new law into jinpo',norm('しんほうについて'),'しんほうについて');
eq('do not convert ordinary voiced omission',norm('かそくといっしょ'),'かそくといっしょ');

eq('ordinary spaced kana only joins',norm('これは いい'),'これはいい');
eq('do not turn relative into kishinseki',norm('しんせきのはなし'),'しんせきのはなし');

eq('do not treat transposition as omission',norm('あさひなやすもとは？'),'あさひなやすもとは?');

// 何回通しても同じ結果になる。
for(const q of ['カウンタア','キシンセキイチバンノニュウシュ','クロダヒロキノカゾク','カクヨクノナナインネン','きしせきのつかいかた','き し ん せ き の つ か い か た']){
  const once=norm(q),twice=norm(once),third=norm(twice);
  check('idempotent '+q,once===twice&&twice===third,{once,twice,third});
}

// 各専門エンジン・陣法解析まで実際につながる。
let r=Tool.respond('キシンセキイチバンノニュウシュ',{history:[]});
check('tool responder kana',r&&r.handled&&/鬼神石 1番「不壊金剛」/.test(r.answer)&&/入手/.test(r.answer),r&&r.answer);
r=Tairano.respond('アシカガヨシテルノカウンタア',{history:[]});
check('tairano responder kana',r&&r.handled&&/足利義輝/.test(r.answer)&&/候補が複数/.test(r.answer)&&!/カウンターーー/.test(r.answer),r&&r.answer);
let p=Parser.parse('カクヨクノナナインネンデタイキュウタカイノケンサク');
check('parser kana formation',p&&p.recognized&&p.searchPatch&&p.searchPatch.formation==='鶴翼'&&p.searchPatch.count===7&&p.searchPatch.priority1&&p.searchPatch.priority1.stat==='耐久',p);
let n=NLU.infer('カクヨクノナナインネンデタイキュウタカイノケンサク');
check('nlu kana formation',n&&n.decision==='execute'&&/鶴翼/.test(n.canonical)&&/7因縁/.test(n.canonical)&&/耐久/.test(n.canonical),n);
p=Parser.parse('ケンサクケッカノニイヲテキヨウ');
check('parser kana rank',p&&p.actions&&p.actions.some(a=>a.name==='apply_result'&&a.args&&a.args.rank===2),p);

console.log(`KANA NORMALIZATION: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
