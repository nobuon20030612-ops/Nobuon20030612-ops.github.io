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
function groups(q,history){return L.groupsForMessage(q,history||[]);}
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
check('hero ranking lazy group',groups('腕力が高い英傑は誰？').includes('hero'),groups('腕力が高い英傑は誰？'));
check('hero surname query lazy group',groups('苗字が前田の英傑').includes('hero'),groups('苗字が前田の英傑'));
check('hero natural surname wording lazy group',groups('前田と言う英傑をすべて欲しえて').includes('hero'),groups('前田と言う英傑をすべて欲しえて'));
check('hero exact name lazy group',groups('母里太兵衛について').includes('hero'),groups('母里太兵衛について'));
check('hero typo name with stat lazy group',groups('母里太兵枝の腕力は？').includes('hero'),groups('母里太兵枝の腕力は？'));
check('hero rough kana ranking lazy group',groups('えいけつでうでりょくたかいのだれ').includes('hero'),groups('えいけつでうでりょくたかいのだれ'));
check('hero fuzzy name strength lazy group',groups('母里太兵枝のつよみなに').includes('hero'),groups('母里太兵枝のつよみなに'));
check('hero skill detail lazy group',groups('追加行動するの誰？').includes('hero'),groups('追加行動するの誰？'));
check('hero average lazy group',groups('侍の平均腕力は？').includes('hero'),groups('侍の平均腕力は？'));
check('hero rough cost lazy group',groups('こすと7でちりょくたかいえいけつだれ').includes('hero'),groups('こすと7でちりょくたかいえいけつだれ'));
check('hero numeric near lazy group',groups('腕力2500前後の英傑は？').includes('hero'),groups('腕力2500前後の英傑は？'));
check('hero rough numeric near lazy group',groups('うでりょく2500ぜんごの英傑').includes('hero'),groups('うでりょく2500ぜんごの英傑'));
check('hero rank range lazy group',groups('腕力6位から10位を教えて').includes('hero'),groups('腕力6位から10位を教えて'));
check('hero percentile lazy group',groups('腕力上位10%は誰？').includes('hero'),groups('腕力上位10%は誰？'));
check('hero tie lazy group',groups('腕力が同じ英傑はいる？').includes('hero'),groups('腕力が同じ英傑はいる？'));
check('hero multi percentile rough lazy group',groups('えいけつでうでりょくとちりょくがりょうほうじょうい10ぱーせんと').includes('hero'),groups('えいけつでうでりょくとちりょくがりょうほうじょうい10ぱーせんと'));
check('hero average threshold rough lazy group',groups('侍でうでりょくがへいきんいじょうのえいけつ').includes('hero'),groups('侍でうでりょくがへいきんいじょうのえいけつ'));
check('hero multi nearest rough lazy group',groups('豊臣秀長とうでりょくとちりょくがにてるえいけつ').includes('hero'),groups('豊臣秀長とうでりょくとちりょくがにてるえいけつ'));
check('hero top entry rough lazy group',groups('ぜんのうりょくでとっぷ10いりがおおいえいけつ').includes('hero'),groups('ぜんのうりょくでとっぷ10いりがおおいえいけつ'));
check('hero relative exact name lazy group',groups('豊臣秀長より腕力も知力も高い英傑').includes('hero'),groups('豊臣秀長より腕力も知力も高い英傑'));
check('hero relative typo name lazy group',groups('母里太兵枝よりうでりょくが高い英傑').includes('hero'),groups('母里太兵枝よりうでりょくが高い英傑'));
check('hero pairwise wins lazy group',groups('豊臣秀長と竹中半兵衛(右腕)はどっちが何項目高い').includes('hero'),groups('豊臣秀長と竹中半兵衛(右腕)はどっちが何項目高い'));
check('hero upgrade wording lazy group',groups('豊臣秀長の上位互換は？').includes('hero'),groups('豊臣秀長の上位互換は？'));
const heroHistory=[{role:'assistant',meta:{data:{heroKnowledge:true}}}];
check('hero short job continuation lazy group',groups('侍だけ',heroHistory).includes('hero'),groups('侍だけ',heroHistory));
check('hero short rerank continuation lazy group',groups('じゃあ知力順',heroHistory).includes('hero'),groups('じゃあ知力順',heroHistory));
check('hero short negative cost continuation lazy group',groups('コスト7を除いて',heroHistory).includes('hero'),groups('コスト7を除いて',heroHistory));
check('hero comparison gap continuation lazy group',groups('一番差が大きい能力は？',heroHistory).includes('hero'),groups('一番差が大きい能力は？',heroHistory));
check('hero ratio continuation lazy group',groups('割合だと？',heroHistory).includes('hero'),groups('割合だと？',heroHistory));
check('hero per-stat leader continuation lazy group',groups('能力ごとのトップは？',heroHistory).includes('hero'),groups('能力ごとのトップは？',heroHistory));
check('hero pair replacement continuation lazy group',groups('後者を母里太兵衛に変えて',heroHistory).includes('hero'),groups('後者を母里太兵衛に変えて',heroHistory));
check('hero typo replacement continuation lazy group',groups('後者を母里太兵枝に変えて',heroHistory).includes('hero'),groups('後者を母里太兵枝に変えて',heroHistory));
check('hero all threshold continuation lazy group',groups('この3人でぜんいん3000いじょうの能力は？',heroHistory).includes('hero'),groups('この3人でぜんいん3000いじょうの能力は？',heroHistory));
check('hero any threshold continuation lazy group',groups('誰か1人でも3500以上の能力は？',heroHistory).includes('hero'),groups('誰か1人でも3500以上の能力は？',heroHistory));
check('hero refinement remove stat condition lazy group',groups('知力条件は外して',heroHistory).includes('hero'),groups('知力条件は外して',heroHistory));
check('hero refinement reset all lazy group',groups('条件を全部外して',heroHistory).includes('hero'),groups('条件を全部外して',heroHistory));
check('hero refinement restore root lazy group',groups('元の候補に戻して',heroHistory).includes('hero'),groups('元の候補に戻して',heroHistory));
check('hero refinement reverse sort lazy group',groups('並びを逆にして',heroHistory).includes('hero'),groups('並びを逆にして',heroHistory));
check('hero group third replacement lazy group',groups('3人目を遠足娘まりに変えて',heroHistory).includes('hero'),groups('3人目を遠足娘まりに変えて',heroHistory));
check('hero refinement undo lazy group',groups('条件を一つ前に戻して',heroHistory).includes('hero'),groups('条件を一つ前に戻して',heroHistory));
check('hero refinement redo lazy group',groups('取り消しをやり直して',heroHistory).includes('hero'),groups('取り消しをやり直して',heroHistory));
check('hero removed candidates question lazy group',groups('誰が外れた？',heroHistory).includes('hero'),groups('誰が外れた？',heroHistory));
check('hero refinement change summary lazy group',groups('前の結果と何人変わった？',heroHistory).includes('hero'),groups('前の結果と何人変わった？',heroHistory));
check('hero candidate reason continuation lazy group',groups('林崎甚助が候補に入っている理由は？',heroHistory).includes('hero'),groups('林崎甚助が候補に入っている理由は？',heroHistory));
check('hero candidate reason kana continuation lazy group',groups('林崎甚介がこうほにはいってるりゆうは？',heroHistory).includes('hero'),groups('林崎甚介がこうほにはいってるりゆうは？',heroHistory));
const heroSavedHistory=[{role:'assistant',meta:{data:{heroKnowledge:true,heroRefinement:{savedViews:[{name:'A'},{name:'B'},{name:'C'},{name:'高腕力'}]}}}}];
check('hero save current result lazy group',groups('今の結果をBとして保存',heroHistory).includes('hero'),groups('今の結果をBとして保存',heroHistory));
check('hero saved view list lazy group',groups('保存した結果の一覧',heroHistory).includes('hero'),groups('保存した結果の一覧',heroHistory));
check('hero saved view restore lazy group',groups('Aに戻して',heroSavedHistory).includes('hero'),groups('Aに戻して',heroSavedHistory));
check('hero saved view compare lazy group',groups('Aと高腕力の違い',heroSavedHistory).includes('hero'),groups('Aと高腕力の違い',heroSavedHistory));
check('hero current versus saved lazy group',groups('今の結果とAを比べて',heroSavedHistory).includes('hero'),groups('今の結果とAを比べて',heroSavedHistory));
check('hero saved view detail lazy group',groups('Aはどんな条件で何人？',heroSavedHistory).includes('hero'),groups('Aはどんな条件で何人？',heroSavedHistory));
check('hero saved filter transfer lazy group',groups('Aの条件を高腕力にかけて表示',heroSavedHistory).includes('hero'),groups('Aの条件を高腕力にかけて表示',heroSavedHistory));
check('hero saved sort transfer lazy group',groups('Aの並び順を高腕力に使って表示',heroSavedHistory).includes('hero'),groups('Aの並び順を高腕力に使って表示',heroSavedHistory));
check('hero saved condition config compare lazy group',groups('AとBの条件の違い',heroSavedHistory).includes('hero'),groups('AとBの条件の違い',heroSavedHistory));
check('hero saved sort config compare lazy group',groups('AとBの並び順は同じ？',heroSavedHistory).includes('hero'),groups('AとBの並び順は同じ？',heroSavedHistory));
check('hero saved directional condition delta lazy group',groups('BにあってAにない条件をCに適用して表示',heroSavedHistory).includes('hero'),groups('BにあってAにない条件をCに適用して表示',heroSavedHistory));
check('hero saved partial job delta lazy group',groups('BにあってAにない条件のうち職業条件だけをCに適用して表示',heroSavedHistory).includes('hero'),groups('BにあってAにない条件のうち職業条件だけをCに適用して表示',heroSavedHistory));
check('hero saved partial stat delta lazy group',groups('BにあってAにない知力条件だけをCに適用して表示',heroSavedHistory).includes('hero'),groups('BにあってAにない知力条件だけをCに適用して表示',heroSavedHistory));
check('hero saved inverted delta lazy group',groups('BにあってAにない職業条件を反転してCに適用して表示',heroSavedHistory).includes('hero'),groups('BにあってAにない職業条件を反転してCに適用して表示',heroSavedHistory));
check('hero saved rough kana partial delta lazy group',groups('BにあってAにない条件のうちしょくぎょうじょうけんだけをCに適用して表示',heroSavedHistory).includes('hero'),groups('BにあってAにない条件のうちしょくぎょうじょうけんだけをCに適用して表示',heroSavedHistory));
check('hero saved rough kana inverted delta lazy group',groups('BにあってAにないしょくぎょう条件をはんてんしてCに適用して表示',heroSavedHistory).includes('hero'),groups('BにあってAにないしょくぎょう条件をはんてんしてCに適用して表示',heroSavedHistory));
check('hero saved ambiguous condition delta lazy group',groups('AとBの条件差をCに適用',heroSavedHistory).includes('hero'),groups('AとBの条件差をCに適用',heroSavedHistory));
check('hero saved view intersection lazy group',groups('Aと高腕力の共通だけ表示',heroSavedHistory).includes('hero'),groups('Aと高腕力の共通だけ表示',heroSavedHistory));
check('hero saved view union lazy group',groups('Aと高腕力をまとめて表示',heroSavedHistory).includes('hero'),groups('Aと高腕力をまとめて表示',heroSavedHistory));
check('hero saved view symmetric difference lazy group',groups('Aと高腕力の片方だけ表示',heroSavedHistory).includes('hero'),groups('Aと高腕力の片方だけ表示',heroSavedHistory));
check('hero saved view directional difference lazy group',groups('Aから高腕力を除いて表示',heroSavedHistory).includes('hero'),groups('Aから高腕力を除いて表示',heroSavedHistory));
check('hero saved view derived save lazy group',groups('Aと高腕力の共通をCとして保存',heroSavedHistory).includes('hero'),groups('Aと高腕力の共通をCとして保存',heroSavedHistory));
check('hero saved view delete lazy group',groups('高腕力を削除して',heroSavedHistory).includes('hero'),groups('高腕力を削除して',heroSavedHistory));
check('bare refinement undo without hero history blocked',!groups('条件を一つ前に戻して').includes('hero'),groups('条件を一つ前に戻して'));
check('bare removed candidates without hero history blocked',!groups('誰が外れた？').includes('hero'),groups('誰が外れた？'));
check('bare saved result restore without hero history blocked',!groups('Aに戻して').includes('hero'),groups('Aに戻して'));
check('bare save result without hero history blocked',!groups('今の結果をBとして保存').includes('hero'),groups('今の結果をBとして保存'));
check('bare ratio without hero history blocked',!groups('割合だと？').includes('hero'),groups('割合だと？'));
check('bare short job without hero history blocked',!groups('侍だけ').includes('hero'),groups('侍だけ'));
check('bare jinpo stat does not load hero',!groups('腕力高いの').includes('hero'),groups('腕力高いの'));
check('jinpo search does not load hero',!groups('腕力高いの検索して').includes('hero'),groups('腕力高いの検索して'));
check('tool stat does not load hero',!groups('鬼神石の腕力トップ3').includes('hero'),groups('鬼神石の腕力トップ3'));

console.log(`LOADER KANA ROUTING: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
