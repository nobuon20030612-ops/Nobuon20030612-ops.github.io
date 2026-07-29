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
load('jinpo-bot-casual.js');
const C=global.JINPO_BOT_CONVERSATION,S=global.JINPO_BOT_SMALLTALK,R=global.JINPO_BOT_CASUAL;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function eq(name,got,want){check(name,got===want,JSON.stringify(got)+' != '+JSON.stringify(want));}
function includes(name,got,parts){const s=String(got||'');check(name,parts.every(p=>s.includes(p)),s);}

// 1. ラフ入力: 短い崩れだけを直し、固有名詞は触らない。
eq('normalize どゆこと',C.normalizeCasualInput('どゆこと？').text,'どういうこと?');
eq('normalize りょかい',C.normalizeCasualInput('りょかい').text,'了解');
eq('keep proper 黒田',C.normalizeCasualInput('黒田博樹').text,'黒田博樹');
eq('keep proper Firebase',C.normalizeCasualInput('Firebase').text,'Firebase');
eq('keep word 桶狭間',C.normalizeCasualInput('桶狭間について').text,'桶狭間について');

// 2. 短い反応の立場。
eq('stance agreement',C.conversationalStance([],'そうだね').type,'agreement');
eq('stance skepticism',C.conversationalStance([],'そうかな？').type,'skepticism');
eq('stance disagreement',C.conversationalStance([],'それは違うと思う').type,'disagreement');
eq('stance partial ellipsis',C.conversationalStance([],'確かにそうだけど…').type,'partial_agreement');

// 3. 冗談 / 本気 / 皮肉可能性。
eq('tone joke',C.pragmaticTone([],'冗談だよ').type,'joke');
eq('tone serious',C.pragmaticTone([],'冗談抜きで本気').type,'serious');
eq('tone irony possible',C.pragmaticTone([],'最高だね、またエラーだよ').type,'possible_irony');

// 4. 具体的な話題枝へ短い追質問を接続。
const hBranch=[
  {role:'user',text:'黒田博樹について教えて'},
  {role:'assistant',text:'黒田博樹について説明します。'},
  {role:'user',text:'家族は？'},
  {role:'assistant',text:'黒田博樹の家族について説明します。'}
];
for(const q of ['それで？','続きは？','その続きは？']){
  const r=C.resolve(q,hBranch);check('branch continue '+q,/黒田博樹.*家族.*続きを教えて/.test(r.message),r.message);
}
check('branch conclusion',/黒田博樹.*家族.*要点と結論/.test(C.resolve('結局？',hBranch).message),C.resolve('結局？',hBranch).message);
check('meaning followup',/黒田博樹.*家族.*どういう意味/.test(C.resolve('どゆこと？',hBranch).message),C.resolve('どゆこと？',hBranch).message);

// 5. 候補確認のライフサイクル。
const hAmb=[
  {role:'user',text:'足利義輝と足利義昭について教えて'},
  {role:'assistant',text:'足利義輝と足利義昭について説明します。'},
  {role:'user',text:'その人は封印編？'},
  {role:'assistant',text:'「その人」が複数候補に当てはまるのですよ。足利義輝、足利義昭のどれか、名前で教えてください。'}
];
for(const [q,name] of [['前者','足利義輝'],['2番目','足利義昭'],['義輝の方','足利義輝'],['前者じゃなくて後者','足利義昭'],['義昭じゃなくて義輝','足利義輝']]){
  const r=C.resolve(q,hAmb);check('clarification '+q,r.message.startsWith(name)&&r.message.includes('封印編'),r.message);
}
let r=C.resolve('どっちでもない',hAmb);check('clarification reject',!!r.referenceClarification&&!r.message.includes('カウンター'),r);
r=C.resolve('両方',hAmb);check('clarification both',r.message.includes('足利義輝と足利義昭')&&r.message.includes('封印編'),r.message);
const hAmb3=[
  {role:'user',text:'足利義輝と足利義昭と徳川家康について教えて'},
  {role:'assistant',text:'足利義輝、足利義昭、徳川家康について説明します。'},
  {role:'user',text:'その人は対象？'},
  {role:'assistant',text:'候補が複数あります。足利義輝、足利義昭、徳川家康のどれか教えてください。'}
];
r=C.resolve('3番目',hAmb3);check('clarification third',r.message.includes('徳川家康'),r.message);
r=C.resolve('両方',hAmb3);check('clarification 3+ no guess',!!r.referenceClarification,r);

// bot本体でresolveが前後2回通っても選択内容を壊さない。
for(const q of ['前者','2番目','両方']){
  const first=C.resolve(q,hAmb),second=C.resolve(first.message,hAmb);
  check('double resolve '+q,second.message.includes('封印編')&&!/(?:前者|2番目|両方)/.test(second.message),second.message);
}

// 6. 「前と違う」は事実質問だけ再確認し、操作は再実行しない。
const hFact=[{role:'user',text:'黒田博樹の家族は？'},{role:'assistant',text:'家族について説明します。'}];
r=C.resolve('さっきと違う',hFact);check('fact recheck',!!r.conflictRecheck&&r.message.includes('黒田博樹'),r);
const hAction=[{role:'user',text:'腕力高いの検索して'},{role:'assistant',text:'検索しました。'}];
r=C.resolve('さっきと違う',hAction);check('no action replay',!r.conflictRecheck&&r.message==='さっきと違う',r);

// 7. 並行話題: 正本遅延読込前でも明示された2主題だけ保持。
const hParallel=[
  {role:'user',text:'黒田博樹と新井貴浩、両方気になる'},
  {role:'assistant',text:'両方ですね。'},
  {role:'user',text:'まず黒田博樹について教えて'},
  {role:'assistant',text:'黒田博樹について説明します。'}
];
const par=C.parallelTopics(hParallel,'');
check('parallel has two',par.length===2&&par[0].subject==='黒田博樹'&&par[1].subject==='新井貴浩',par);
const pr=C.restoreParallelTopic(hParallel,'もう片方は？');
check('parallel restore other',pr&&pr.restoreMessage==='新井貴浩について',pr);
const statEnt=C.entityCandidatesFromText('腕力と耐久、両方気になる','jinpo');
check('stats not people',statEnt.every(x=>x.type!=='person'),statEnt);

// 8. 保留・伏線。
const hDeferred=[
  {role:'user',text:'黒田の家族について教えて'},
  {role:'assistant',text:'家族の説明です。'},
  {role:'user',text:'この話はいったん置いといて、新井について教えて'},
  {role:'assistant',text:'新井の説明です。'}
];
const dr=C.restoreDeferredTopic(hDeferred,'保留した話に戻ろう');
check('deferred restore family',dr&&/黒田.*家族/.test(dr.restoreMessage),dr);
const hHook=[
  {role:'user',text:'黒田の家族には続きがあるけど後で話す'},
  {role:'assistant',text:'わかりました。'},
  {role:'user',text:'新井について教えて'},
  {role:'assistant',text:'新井について説明します。'}
];
const hr=C.restoreConversationHook(hHook,'さっきの続きに戻ろう');
check('hook restore family',hr&&/黒田.*家族/.test(hr.restoreMessage),hr);

// 9. 予定: 完了・延期・無関係な取消を混同しない。
const p1=C.planLedger([{role:'user',text:'明日サイト更新する予定'},{role:'assistant',text:'了解です。'},{role:'user',text:'サイト更新終わった'}]);
eq('plan completed',p1[0]&&p1[0].status,'completed');
const p2=C.planLedger([{role:'user',text:'来週、資料整理する予定'},{role:'assistant',text:'了解です。'},{role:'user',text:'資料整理は延期する'}]);
eq('plan postponed',p2[0]&&p2[0].status,'postponed');
const p3=C.planLedger([{role:'user',text:'明日サイト更新する予定'},{role:'assistant',text:'了解です。'},{role:'user',text:'ゲームはやめる'}]);
eq('unrelated cancel safe',p3[0]&&p3[0].status,'active');
const p4=C.planLedger([{role:'user',text:'明日サイト更新する予定'},{role:'assistant',text:'了解です。'},{role:'user',text:'やっぱり延期する'}]);
eq('single generic postpone',p4[0]&&p4[0].status,'postponed');
const p5=C.planLedger([{role:'user',text:'明日サイト更新する予定'},{role:'assistant',text:'了解です。'},{role:'user',text:'来週資料整理する予定'},{role:'assistant',text:'了解です。'},{role:'user',text:'延期する'}]);
check('multiple generic postpone no guess',p5.filter(x=>x.status==='active').length===2,p5);

// 10. 現在の好みと過去の好みを分離。
const hPos=[{role:'user',text:'黒田が好き'},{role:'assistant',text:'いいですね。'},{role:'user',text:'やっぱり今は新井が好き'},{role:'assistant',text:'そうなんですね。'}];
let pos=C.recallPosition(hPos,'どっちが好きって言ってたっけ？');
eq('position current',pos&&pos.position&&pos.position.value,'新井');
pos=C.recallPosition(hPos,'前はどっちが好きって言ってたっけ？');
eq('position past',pos&&pos.position&&pos.position.value,'黒田');

// 11. 複合質問は安全な境界だけ分割。
check('compound two tasks',C.splitCompoundIntents('黒田の逸話も知りたいし、カープの順位も教えて').length===2,C.splitCompoundIntents('黒田の逸話も知りたいし、カープの順位も教えて'));
check('compound stats not split',C.splitCompoundIntents('腕力と耐久が高い編成を探して').length===0,C.splitCompoundIntents('腕力と耐久が高い編成を探して'));
check('compound people not split',C.splitCompoundIntents('黒田と新井について教えて').length===0,C.splitCompoundIntents('黒田と新井について教えて'));

// 11.5 一般テーマ: Firebase / Firestore の基本説明はローカルで成立し、変動情報はWeb経路へ残す。
let fbIntro=S.local('Firebaseについて教えて',{history:[]})||'';
check('firebase local overview',/Firebase/.test(fbIntro)&&/認証|データベース/.test(fbIntro),fbIntro);
let fsIntro=S.local('Firestoreって何？',{history:[]})||'';
check('firestore local overview',/Firestore/.test(fsIntro)&&/NoSQL|データベース/.test(fsIntro),fsIntro);
const hFirebase=[{role:'user',text:'Firebaseについて教えて'},{role:'assistant',text:fbIntro}];
let fbFollow=C.resolve('何ができる？',hFirebase);
check('firebase followup carries subject',/Firebase/.test(fbFollow.message)&&/何ができる/.test(fbFollow.message),fbFollow);
check('firebase followup local answer',/Firestore|認証/.test(S.local(fbFollow.message,{history:hFirebase})||''),S.local(fbFollow.message,{history:hFirebase}));
eq('firebase pricing remains dynamic route',S.local('Firebaseの料金は？',{history:hFirebase}),null);
let fbFsBoth=S.local('FirebaseとFirestore、両方気になる',{history:[]})||'';
check('firebase firestore parallel intro',/Firebase/.test(fbFsBoth)&&/Firestore/.test(fbFsBoth)&&/両方/.test(fbFsBoth),fbFsBoth);
check('firebase firestore stable difference',/サービス群/.test(S.local('FirebaseとFirestoreの違いは？',{history:[]})||''),S.local('FirebaseとFirestoreの違いは？',{history:[]}));

// 12. 感情と質問が同居しても、質問を雑談が横取りしない。
for(const q of ['疲れたけど黒田について教えて','今日は最悪だった。カープの順位は？','うれしい！ところで全MAXって何？','バグ出て最悪。鬼神石の耐久トップ3は？','眠いけど陣法検索したい']){
  eq('mixed question yields '+q,S.local(q,{history:[]}),null);
}
const adviceHistory=[{role:'user',text:'朝から会議が3つあって昼休みも取れなかった'},{role:'assistant',text:'それは大変でしたね。'}];
check('advice switches from listening',/今日中|後へ回せる/.test(S.local('どうしたらいい？',{history:adviceHistory})||''),S.local('どうしたらいい？',{history:adviceHistory}));
check('advice no context asks context',/何について/.test(S.local('どうしたらいい？',{history:[]})||''),S.local('どうしたらいい？',{history:[]}));
check('advice same utterance bug',/再現条件|直前/.test(S.local('バグが出て動かない。どうしたらいい？',{history:[]})||''),S.local('バグが出て動かない。どうしたらいい？',{history:[]}));
check('advice same utterance choice',/基準|優先/.test(S.local('AとBで迷ってる。どうしたらいい？',{history:[]})||''),S.local('AとBで迷ってる。どうしたらいい？',{history:[]}));

// 13. ローカル定型返答は完全一致を連発しにくい。
S.resetRecentReplies();
const s1=S.local('ありがとう',{history:[]}),s2=S.local('ありがとう',{history:[{role:'assistant',text:s1}]});
check('smalltalk repeat avoided',!!s1&&!!s2&&s1!==s2,[s1,s2]);

// 14. 陣法のラフ入力は明確な検索文脈だけ補正し、一般文は触らない。
const casualCases=[
  ['たいきゅ高いの探して','耐久力'],['わんりょ高め','腕力'],['かくよ 7で検索','鶴翼'],
  ['ほえん8因縁','方円'],['ぎょり 6探して','魚鱗'],['こうや 9因縁','衡軛'],['いんえ7で検索','因縁']
];
for(const [q,w] of casualCases)check('casual jinpo '+q,R.rewrite(q,{}).text.includes(w),R.rewrite(q,{}));
eq('casual no false かくよ',R.rewrite('かくよって言葉',{}).text,'かくよって言葉');
eq('casual no false 休業日',R.rewrite('たいきゅうびについて',{}).text,'たいきゅうびについて');
eq('casual no false 高野豆腐',R.rewrite('こうや豆腐について',{}).text,'こうや豆腐について');

// 15. 長い履歴でも最新の予定と伏線を扱う。
const long=[];
long.push({role:'user',text:'黒田の家族には続きがあるけど後で話す'},{role:'assistant',text:'わかりました。'});
for(let i=0;i<28;i++)long.push({role:'user',text:'話題'+i+'について話そう'},{role:'assistant',text:'話題'+i+'についてですね。'});
const longHook=C.restoreConversationHook(long,'さっきの続きに戻ろう');
check('long hook restore',longHook&&/黒田.*家族/.test(longHook.restoreMessage),longHook);
for(let i=0;i<150;i++)long.push({role:'user',text:'雑談'+i},{role:'assistant',text:'返答'+i});
long.push({role:'user',text:'明日サイト更新する予定'},{role:'assistant',text:'了解です。'});
const longPlan=C.recallPlan(long,'明日何するって言ってたっけ？');
check('long latest plan',longPlan&&longPlan.found&&longPlan.plan&&/サイト更新/.test(longPlan.plan.text),longPlan);

// 16. 意見要求は直前の具体話へつなぎ、正本が必要な人物評価は通常Botが作らない。
const hOpinionDesign=[{role:'user',text:'ボタンを少し大きくして光らせた'},{role:'assistant',text:'かなり目立つようになりました。'}];
eq('opinion signal direct',C.listeningSignals(hOpinionDesign,'どう思う？').mode,'opinion_request');
eq('opinion signal choice',C.listeningSignals(hOpinionDesign,'どっちがいいと思う？').mode,'opinion_request');
eq('opinion signalあり',C.listeningSignals(hOpinionDesign,'それってあり？').mode,'opinion_request');
let op=C.resolve('どう思う？',hOpinionDesign);check('opinion resolve quoted statement',/「ボタンを少し大きくして光らせた」について、どう思う/.test(op.message),op.message);
let opLocal=S.local('どう思う？',{history:hOpinionDesign});check('opinion local design',/あり|方向/.test(opLocal||''),opLocal);
const hOpinionChoice=[{role:'user',text:'黒背景と白背景で迷ってる'},{role:'assistant',text:'どちらも方向性がありますね。'}];
opLocal=S.local('どっちがいいと思う？',{history:hOpinionChoice});check('opinion choice no arbitrary guess',/決め打ち|優先/.test(opLocal||''),opLocal);
const hOpinionPerson=[{role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹について説明します。'}];
eq('opinion person yields specialist',S.local('どう思う？',{history:hOpinionPerson}),null);
op=C.resolve('それってあり？',hOpinionPerson);check('opinion pronoun no nonsense person',op.message==='黒田博樹について、どう思う？',op.message);
check('opinion no context asks target',/何について/.test(S.local('どう思う？',{history:[]})||''),S.local('どう思う？',{history:[]}));


// 17. 一般訂正: 主役だけ/観点だけを差し替え、短い反論を人物指示語へ誤変換しない。
const hCorrection=[{role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹について説明します。'}];
eq('correction subject surname',C.resolve('黒田じゃなくて新井',hCorrection).message,'新井について');
eq('correction subject casual',C.resolve('いや違う、新井のこと',hCorrection).message,'新井について');
eq('correction aspect family',C.resolve('そこじゃなくて家族の話',hCorrection).message,'黒田博樹の家族について');
eq('correction aspect anecdote',C.resolve('いや、成績じゃなくて逸話',hCorrection).message,'黒田博樹の逸話について');
const hCorrectionFamily=[{role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'説明します。'},{role:'user',text:'家族は？'},{role:'assistant',text:'家族です。'}];
eq('correction subject keeps aspect',C.resolve('黒田じゃなくて新井',hCorrectionFamily).message,'新井の家族について');
eq('stance それは違くない',C.conversationalStance(hCorrection,'それは違くない？').type,'skepticism');
eq('skepticism no entity rewrite',C.resolve('それは違くない？',hCorrection).message,'それは違くない?');
eq('opinion challenge branch',C.resolve('でもそれってどうなの？',hCorrection).message,'黒田博樹について、どう思う？');



// 18. 省略された人物追質問を、直前の主役へつなぐ。
const hPersonFollow=[{role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹について説明します。'}];
eq('followup impressive',C.resolve('何がすごいの？',hPersonFollow).message,'黒田博樹について、何が特にすごいの？');
eq('followup famous',C.resolve('一番有名なのは？',hPersonFollow).message,'黒田博樹について、一番有名な出来事は？');
eq('followup simplify',C.resolve('もっと簡単に',hPersonFollow).message,'黒田博樹について、もっと簡単に説明して');
eq('followup fact verify',C.resolve('それ本当？',hPersonFollow).message,'黒田博樹について、本当か事実確認して');
eq('followup relation',C.resolve('新井とは？',hPersonFollow).message,'黒田博樹と新井はどういう関係？');
eq('followup weakness grounded',C.resolve('逆に弱点は？',hPersonFollow).message,'黒田博樹の弱点や欠点として確認できることは？');
const hFamilyFollow=[...hPersonFollow,{role:'user',text:'家族は？'},{role:'assistant',text:'家族について説明します。'}];
eq('family father carry',C.resolve('父親は？',hFamilyFollow).message,'黒田博樹の父親は？');
eq('family sibling carry',C.resolve('兄弟は？',hFamilyFollow).message,'黒田博樹の兄弟は？');
eq('return to person overview',C.resolve('本人の話に戻って',hFamilyFollow).message,'黒田博樹について教えて');
eq('specialist skepticism yields',S.local('マジ？',{history:hPersonFollow}),null);

// 19. 一般的な二択は、ユーザーが傾いた側だけ受け取り、決め打ちしない。
const hBinary=[{role:'user',text:'黒背景と白背景で迷ってる'},{role:'assistant',text:'どちらも方向性があります。'}];
check('choice tentative black',/黒背景.*傾いて/.test(S.local('黒かな',{history:hBinary})||''),S.local('黒かな',{history:hBinary}));
check('choice decisive white',/白背景.*選ぶ方向/.test(S.local('いや白',{history:hBinary})||''),S.local('いや白',{history:hBinary}));
check('choice recommendation no arbitrary',/決め打ち|優先/.test(S.local('おすすめは？',{history:hBinary})||''),S.local('おすすめは？',{history:hBinary}));
check('decision accept',/方向/.test(S.local('それならいいかな',{history:[{role:'user',text:'ボタンを少し大きくした'},{role:'assistant',text:'見やすくなりました。'}]})||''),'');
check('decision reconsider',/前の案.*候補/.test(S.local('前の方がよかったかも',{history:[{role:'user',text:'ボタンを少し大きくした'},{role:'assistant',text:'見やすくなりました。'}]})||''),'');


// 20. 日常雑談: 普通の共有や対象付き感想を、成功報告・自己への褒め言葉と誤解しない。
let everyday=S.local('今日は楽しかった',{history:[]})||'';
check('everyday positive experience handled',!!everyday,everyday);
check('everyday positive experience not achievement',!/やりました|成功です/.test(everyday),everyday);
check('everyday game activity',!!S.local('昨日ゲームやってた',{history:[]}),S.local('昨日ゲームやってた',{history:[]}));
check('everyday game activity no date',!!S.local('ゲームしてた',{history:[]}),S.local('ゲームしてた',{history:[]}));
let cat=S.local('猫かわいい',{history:[]})||'';
check('everyday cat cute handled',/猫/.test(cat),cat);
check('everyday cat cute not self compliment',!/ありがとう|照れ/.test(cat),cat);
let gameFun=S.local('このゲーム面白い',{history:[]})||'';
check('everyday game fun handled',/ゲーム/.test(gameFun),gameFun);
check('everyday rain dislike',!!S.local('雨やだ',{history:[]}),S.local('雨やだ',{history:[]}));
check('everyday came home',/おかえり/.test(S.local('帰った',{history:[]})||''),S.local('帰った',{history:[]}));
eq('everyday explicit welcome home',S.local('おかえりって言って',{history:[]}),'おかえり。');
check('everyday lets talk',!!S.local('ちょっと話そう',{history:[]}),S.local('ちょっと話そう',{history:[]}));
check('everyday recent status',!!S.local('最近どう？',{history:[]}),S.local('最近どう？',{history:[]}));
check('everyday funny story',!!S.local('面白い話して',{history:[]}),S.local('面白い話して',{history:[]}));
eq('positive sharing signal',C.listeningSignals([],'今日は楽しかった').mode,'positive_sharing');
eq('achievement stays celebration',C.listeningSignals([],'サイト公開できた').mode,'celebration');


// 21. 日常の短い追質問は「決定」と誤解せず、具体的な主題へ戻す。
const hFullMax=[{role:'user',text:'全MAXって何？'},{role:'assistant',text:'全MAXは見聞録・鬼神石・転生MAXをまとめて反映する機能です。'}];
eq('continuation not decision local',S.local('それで？',{history:hFullMax}),null);
eq('continuation branch clean',C.resolve('それで？',hFullMax).message,'全MAXについて、続きを教えて');
eq('meaning branch clean',C.resolve('どゆこと？',hFullMax).message,'全MAXについて、どういう意味か説明して');
eq('confusion branch',C.resolve('まだよくわからん',hFullMax).message,'全MAXについて、もう少し分かりやすく説明して');
eq('repeat branch',C.resolve('もう一回',hFullMax).message,'全MAXについて、もう一度説明して');
eq('shorter branch',C.resolve('もっと短く',hFullMax).message,'全MAXについて、もっと短く説明して');
eq('example branch',C.resolve('例ある？',hFullMax).message,'全MAXについて、具体例を一つ挙げて');

// 22. さらに日常的な一言も会話を途切れさせない。
for(const q of ['まあまあだった','今日つまんなかった','友達と話してた','家でゴロゴロしてた','昼寝してた','今起きた','もう夕方か','もうこんな時間','明日休み','明日仕事','休みだ','ゲームしようかな','何のゲームしようかな','なんか面白い話ない？','適当に話して','ねえ','そっか','それな','わかる']){
  check('everyday extended '+q,!!S.local(q,{history:[]}),S.local(q,{history:[]}));
}
check('opener invites naturally',/どうした/.test(S.local('ねえ',{history:[]})||''),S.local('ねえ',{history:[]}));


// 23. 説明途中の省略表現も直前主題へ自然につなぐ。
eq('followup rough summary',C.resolve('ざっくり',hFullMax).message,'全MAXについて、ざっくり要点だけ説明して');
eq('followup one line',C.resolve('一言で',hFullMax).message,'全MAXについて、一言で要点を説明して');
eq('followup concrete',C.resolve('具体的には？',hFullMax).message,'全MAXについて、具体的に説明して');
eq('followup example style',C.resolve('例で教えて',hFullMax).message,'全MAXについて、具体例を一つ挙げて');
eq('followup reverse view',C.resolve('逆に？',hFullMax).message,'全MAXについて、逆の見方や反対側の面も教えて');
eq('followup merits',C.resolve('メリットは？',hFullMax).message,'全MAXについて、良いところや評価されている点は？');
eq('followup demerits',C.resolve('デメリットは？',hFullMax).message,'全MAXについて、注意点や弱いところは？');
eq('followup thats all',C.resolve('それだけ？',hFullMax).message,'全MAXについて、もう少し続けて');
eq('followup more exists',C.resolve('もっとある？',hFullMax).message,'全MAXについて、もう少し続けて');


// 24. 一語返事: 「わかった」を感謝と誤認せず、短い相槌で会話を切らない。
let understood=S.local('わかった',{history:[]})||'';
check('understood not thanks',!/どういたしまして|いえいえ|こちらこそ/.test(understood),understood);
check('understood acknowledged',/了解|分かりました|承知/.test(understood),understood);
for(const q of ['うん','ううん','いや','まじ','えー','ふーん','まあいいや','もういい','いいね','微妙']){
  check('single reaction '+q,!!S.local(q,{history:[]}),S.local(q,{history:[]}));
}


// 25. 日常の相談・活動・短い感想。
const hWeakAdvice=[{role:'user',text:'黒背景と白背景で迷ってる'},{role:'assistant',text:'どちらも方向性があります。'}];
check('weak advice context',/基準|優先/.test(S.local('どうしよ',{history:hWeakAdvice})||''),S.local('どうしよ',{history:hWeakAdvice}));
check('weak advice typo context',/基準|優先/.test(S.local('どしよ',{history:hWeakAdvice})||''),S.local('どしよ',{history:hWeakAdvice}));
check('weak advice no context',/何について/.test(S.local('どうしよ',{history:[]})||''),S.local('どうしよ',{history:[]}));
for(const q of ['映画見た','YouTube見てた','難しい','簡単だった','なんでもない','気にしないで']){
  check('everyday activity/reaction '+q,!!S.local(q,{history:[]}),S.local(q,{history:[]}));
}


// 26. 1発言に相反・複数の生活情報があっても片方だけに寄せない。
let multi=S.local('最近ちょっと忙しいけど元気',{history:[]})||'';
check('multi busy but fine',/忙しい.*元気|元気.*忙しい/.test(multi),multi);
multi=S.local('眠いけどまだ寝たくない',{history:[]})||'';
check('multi sleepy but awake',/眠い.*寝たくない|寝たくない.*眠い/.test(multi),multi);
multi=S.local('仕事大変だったけど終わった',{history:[]})||'';
check('multi hard work completed',/大変.*終わった|終わった.*大変/.test(multi),multi);
multi=S.local('ゲームは面白いけど難しい',{history:[]})||'';
check('multi game fun difficult',/面白い.*難しい|難しい.*面白い/.test(multi),multi);
check('multi work meal',/仕事.*ごはん|ごはん.*仕事/.test(S.local('仕事終わって今ご飯食べてる',{history:[]})||''),S.local('仕事終わって今ご飯食べてる',{history:[]}));
check('multi movie mediocre',/微妙|合わな/.test(S.local('昨日映画見たけど微妙だった',{history:[]})||''),S.local('昨日映画見たけど微妙だった',{history:[]}));
check('multi holiday game',/休み.*ゲーム|ゲーム.*休み/.test(S.local('明日休みだからゲームしようかな',{history:[]})||''),S.local('明日休みだからゲームしようかな',{history:[]}));
check('multi idle acceptance',/何もしない|そういう日/.test(S.local('今日は何もしてないけどまあいいか',{history:[]})||''),S.local('今日は何もしてないけどまあいいか',{history:[]}));


// 27. 挨拶の近似一致は昼夜を取り違えず、「助かった」「わかった」も意図を分離。
for(const q of ['こんばんは','こんばんわ','こんばわ'])check('evening greeting '+q,/こんばんは/.test(S.local(q,{history:[]})||''),S.local(q,{history:[]}));
for(const q of ['こんにちは','こんにちわ','こんちわ'])check('hello greeting '+q,/こんにちは/.test(S.local(q,{history:[]})||''),S.local(q,{history:[]}));
check('thanks helped',/よかった/.test(S.local('助かった',{history:[]})||''),S.local('助かった',{history:[]}));
check('understood remains ack',/了解|分かりました|承知/.test(S.local('わかった',{history:[]})||''),S.local('わかった',{history:[]}));


// 28. 追質問・相槌を新しい話題として記憶せず、聞き役も内容に反応する。
const hFollowChain=[
  {role:'user',text:'全MAXって何？'},{role:'assistant',text:'全MAXの説明です。'},
  {role:'user',text:'どゆこと？'},{role:'assistant',text:'もう少し説明です。'},
  {role:'user',text:'ざっくり'},{role:'assistant',text:'要点です。'}
];
eq('follow chain keeps topic example',C.resolve('例ある？',hFollowChain).message,'全MAXについて、具体例を一つ挙げて');
eq('follow chain keeps topic continue',C.resolve('それで？',hFollowChain).message,'全MAXについて、続きを教えて');
check('follow-only helper ack',C.isFollowupOnlyUtterance('なるほどね')===true,C.isFollowupOnlyUtterance('なるほどね'));
check('follow-only helper style',C.isFollowupOnlyUtterance('ざっくり')===true,C.isFollowupOnlyUtterance('ざっくり'));
let listenHistory=[{role:'user',text:'ちょっと聞いて'},{role:'assistant',text:'うん、聞いてます。'}];
let listenReply=S.local('今日仕事大変だった',{history:listenHistory})||'';
check('carried listen reacts work',/大変/.test(listenReply),listenReply);
listenHistory.push({role:'user',text:'今日仕事大変だった'},{role:'assistant',text:listenReply});
listenReply=S.local('でも終わった',{history:listenHistory})||'';
check('carried listen reacts completion',/終わった/.test(listenReply),listenReply);
listenHistory.push({role:'user',text:'でも終わった'},{role:'assistant',text:listenReply});
listenReply=S.local('明日休み',{history:listenHistory})||'';
check('carried listen reacts holiday',/休み/.test(listenReply),listenReply);

console.log(`LOCAL CONVERSATION REGRESSION: ${pass}/${pass+fail} PASS`);
if(fail)process.exit(1);
