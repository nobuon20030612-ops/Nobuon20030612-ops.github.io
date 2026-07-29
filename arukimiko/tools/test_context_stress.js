#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const store={};
global.window=global;
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
load('jinpo-bot-carp-knowledge-data.js');
load('jinpo-bot-conversation.js');
load('jinpo-bot-kashin-name.js');
const C=global.JINPO_BOT_CONVERSATION,K=global.JINPO_BOT_KASHIN_NAME;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function eq(name,got,want){check(name,got===want,JSON.stringify(got)+' != '+JSON.stringify(want));}
function namingStart(){K.clear();return K.respond('家臣の名前つけて',{history:[]});}
function candidateCount(answer){return (String(answer||'').match(/^\d+\. /gm)||[]).length;}

// 1. スクショ再現: 名付け開始 → 「全部お任せ」で即候補。
let r=namingStart();
check('naming start asks preference',r&&r.handled&&/全部おまかせ/.test(r.answer||''),r);
r=K.respond('全部お任せ',{history:[{role:'user',text:'家臣の名前つけて'},{role:'assistant',text:'男性っぽい・女性っぽい・中性的・おまかせ、どれが近いですか？'}]});
check('naming 全部お任せ handled',r&&r.handled===true,r);
check('naming 全部お任せ generates 5',candidateCount(r&&r.answer)===5,r&&r.answer);

// 本番と同じく会話ルーターを先に通しても、家臣名付け文脈を維持する。
K.clear();
const firstNaming=K.respond('家臣の名前つけて',{history:[]});
const namingHistory=[{role:'user',text:'家臣の名前つけて'},{role:'assistant',text:firstNaming.answer}];
const routedNaming=C.resolve('全部お任せ',namingHistory);
check('naming routed domain kept',routedNaming&&routedNaming.domain==='kashin_name',routedNaming);
const routedReply=K.respond(routedNaming.message,{history:namingHistory});
check('naming routed flow generates 5',routedReply&&routedReply.handled&&candidateCount(routedReply.answer)===5,routedReply);

// 2. 表記揺れも同じ意味で受ける。
for(const q of ['全部おまかせ','全部任せて','お任せします','任せる','なんでもいい']){
  namingStart();
  const x=K.respond(q,{history:[]});
  check('naming random variant '+q,x&&x.handled&&candidateCount(x.answer)===5,x);
}

// 3. 名付け中に明確な別話題へ行ったら横取りしない。
namingStart();
r=K.respond('カープの順位は？',{history:[]});
check('naming does not consume other topic',r&&r.handled===false,r);
check('naming pauses on other topic',K.state()&&K.state().paused===true,K.state());

// 4. Bot回答内に別人物が出ても、ユーザーが指定した主役を維持。
const hPrimary=[
  {role:'user',text:'黒田博樹はどう思う？'},
  {role:'assistant',text:'黒田博樹はカープで大きな存在です。新井貴浩も同時代の中心人物でした。'}
];
eq('primary bare family',C.resolve('家族',hPrimary).message,'黒田博樹の家族について');
eq('primary bare stats',C.resolve('成績',hPrimary).message,'黒田博樹の成績について');
eq('primary bare career',C.resolve('現役時代',hPrimary).message,'黒田博樹の経歴について');
eq('primary bare anecdote',C.resolve('逸話',hPrimary).message,'黒田博樹の逸話について');

// 5. 「前の話に戻って」で一つ前の会話枝へ戻る。
const hBack=[
  {role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹の概要です。'},
  {role:'user',text:'家族は？'},{role:'assistant',text:'黒田博樹の家族についてです。'},
  {role:'user',text:'新井貴浩について教えて'},{role:'assistant',text:'新井貴浩の概要です。'}
];
check('back cue 戻って',C.isBackCue('前の話に戻って')===true,C.isBackCue('前の話に戻って'));
r=C.control('前の話に戻って',hBack);
check('back restores previous branch',r&&/黒田博樹.*家族/.test(r.restoreMessage||''),r);
check('back cue hiragana',C.isBackCue('前の話にもどって')===true,C.isBackCue('前の話にもどって'));
check('back cue previous thing',C.isBackCue('前のやつに戻って')===true,C.isBackCue('前のやつに戻って'));
check('back cue recent shorthand',C.isBackCue('さっきのに戻って')===true,C.isBackCue('さっきのに戻って'));
check('back cue two branches ago shorthand',C.isBackCue('その前に戻って')===true,C.isBackCue('その前に戻って'));
const rTwoBack=C.control('その前に戻って',[
  {role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹の概要です。'},
  {role:'user',text:'新井貴浩について教えて'},{role:'assistant',text:'新井貴浩の概要です。'},
  {role:'user',text:'Firebaseについて教えて'},{role:'assistant',text:'Firebaseの概要です。'}
]);
check('two branches ago shorthand depth',rTwoBack&&/黒田博樹/.test(rTwoBack.restoreMessage||''),rTwoBack);

// 6. 検索命令そのものへ一般質問を誤接続しない。
const hAction=[{role:'user',text:'腕力高いの検索して'},{role:'assistant',text:'腕力優先で検索しました。候補結果75件です。'}];
r=C.resolve('無料？',hAction);
eq('action then free remains free',r.message,'無料?');
check('action then free not carried',r.carried===false,r);

// 7. 説明対象なら一般追質問は従来どおり接続。
const hFirebase=[{role:'user',text:'Firebaseについて教えて'},{role:'assistant',text:'FirebaseはGoogleの開発サービスです。'}];
r=C.resolve('無料？',hFirebase);
check('knowledge then free carries topic',/Firebase.*無料/.test(r.message),r);

// 8. 別の実質話題へ移った後、昔の人物を裸の観点で復活させない。
const hSwitched=[...hPrimary,{role:'user',text:'Firebaseについて教えて'},{role:'assistant',text:'Firebaseの概要です。'}];
r=C.resolve('家族',hSwitched);
check('no old person resurrection',!/黒田博樹/.test(r.message),r);

// 9. 自然な「だったっけ」系の人物追質問。
const hPerson=[{role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹について説明します。'}];
eq('person age recollection',C.resolve('何歳だったっけ？',hPerson).message,'黒田博樹の年齢は？');
eq('person active recollection',C.resolve('現役だったっけ？',hPerson).message,'黒田博樹は現在も現役？');
eq('person retirement recollection',C.resolve('いつ引退したっけ？',hPerson).message,'黒田博樹はいつ引退した？');
eq('person spouse wife alias',C.resolve('奥さんは？',hPerson).message,'黒田博樹の妻は？');
eq('person spouse lady alias',C.resolve('夫人は？',hPerson).message,'黒田博樹の妻は？');
eq('person spouse generic alias',C.resolve('配偶者は？',hPerson).message,'黒田博樹の妻は？');

// 10. 長い混在履歴: 人物 → 一般テーマ → 陣法操作 → 相槌が続いても枝を混同しない。
const hLong=[
  {role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹の概要です。'},
  {role:'user',text:'家族は？'},{role:'assistant',text:'黒田博樹の家族についてです。'},
  {role:'user',text:'Firebaseについて教えて'},{role:'assistant',text:'Firebaseの概要です。'},
  {role:'user',text:'安全？'},{role:'assistant',text:'Firebaseの安全性についてです。'},
  {role:'user',text:'腕力高いの検索して'},{role:'assistant',text:'腕力優先で検索しました。'}
];
for(let i=0;i<12;i++)hLong.push({role:'user',text:i%2?'そっか':'ありがとう'},{role:'assistant',text:'どういたしまして。'});
const longBack=C.control('前の話に戻って',hLong);
check('long mixed back restores general topic',longBack&&/Firebase/.test(longBack.restoreMessage||''),longBack);
const longNamed=C.resolve('黒田の話に戻って、家族は？',hLong);
check('long mixed named return restores person branch',/黒田博樹.*家族/.test(longNamed.message),longNamed);

// 11. 観点だけの短文を新しい主役として記憶しない。
const hAspectBranch=[
  {role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹の概要です。'},
  {role:'user',text:'家族は？'},{role:'assistant',text:'黒田博樹の家族です。'},
  {role:'user',text:'新井貴浩について教えて'},{role:'assistant',text:'新井貴浩の概要です。'},
  {role:'user',text:'成績は？'},{role:'assistant',text:'新井貴浩の成績です。'}
];
const aspectFrames=C.topicFrames(hAspectBranch,{limit:48});
const lastAspectFrame=aspectFrames[aspectFrames.length-1];
check('bare aspect keeps person primary',lastAspectFrame&&lastAspectFrame.primary&&lastAspectFrame.primary.value==='新井貴浩',lastAspectFrame);
check('bare aspect keeps stats aspect',lastAspectFrame&&lastAspectFrame.aspect==='stats',lastAspectFrame);
const aspectBranches=C.recentTopicBranches(hAspectBranch,'');
check('aspect branch not duplicated noun',aspectBranches[0]&&aspectBranches[0].message==='新井貴浩の成績について',aspectBranches[0]);
eq('deictic recent thing keeps full branch',C.resolve('さっきのやつは？',hAspectBranch).message,'新井貴浩の成績について');
eq('deictic previous thing keeps person',C.resolve('前のやつは？',hAspectBranch).message,'新井貴浩について');

// 12. 「前の話へ戻る」は、その場の返答だけでなく次ターンの主役も復帰先へ固定する。
const hBackPersist=[
  {role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹の概要です。',meta:{mode:'カープ専用正本知識'}},
  {role:'user',text:'新井貴浩について教えて'},{role:'assistant',text:'新井貴浩の概要です。',meta:{mode:'カープ専用正本知識'}},
  {role:'user',text:'前の話に戻って'},{role:'assistant',text:'黒田博樹についての概要です。新井貴浩との優勝逸話もあります。',meta:{mode:'カープ専用正本知識'}}
];
const backPersistFrame=C.topicFrames(hBackPersist).slice(-1)[0];
check('back frame primary is restored person',backPersistFrame&&backPersistFrame.primary&&backPersistFrame.primary.value==='黒田博樹',backPersistFrame);
eq('back next bare family keeps restored person',C.resolve('家族は？',hBackPersist).message,'黒田博樹の家族について');

// 13. 家臣名候補は実在人物・天気などの会話主語へ混入しない。
const hNamingContamination=[
  {role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹の概要です。',meta:{mode:'カープ専用正本知識'}},
  {role:'user',text:'家臣の名前つけて'},{role:'assistant',text:'全部おまかせでも出せます。',meta:{mode:'家臣名付け'}},
  {role:'user',text:'全部お任せ'},{role:'assistant',text:'1. 黒田 時雨  2. 新井 小雪  3. 森下 風花',meta:{mode:'家臣名付け'}}
];
const namingFrames=C.topicFrames(hNamingContamination,{limit:20});
const namingLast=namingFrames[namingFrames.length-1];
check('naming generated names do not become primary',namingLast&&namingLast.domain==='kashin_name'&&!namingLast.primary,namingLast);
const namingBack=C.control('前の話に戻って',hNamingContamination);
check('back across naming restores prior carp person',namingBack&&namingBack.primary&&namingBack.primary.value==='黒田博樹',namingBack);

// 14. 「前の話に戻って」を連続したら一段ずつさらに前へ進む。
const hRepeatedBack=[
  {role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹の概要です。',meta:{mode:'カープ専用正本知識'}},
  {role:'user',text:'新井貴浩について教えて'},{role:'assistant',text:'新井貴浩の概要です。',meta:{mode:'カープ専用正本知識'}},
  {role:'user',text:'Firebaseについて教えて'},{role:'assistant',text:'Firebaseの概要です。'}
];
const repeated1=C.control('前の話に戻って',hRepeatedBack);
check('repeated back first goes one branch',repeated1&&repeated1.primary&&repeated1.primary.value==='新井貴浩',repeated1);
hRepeatedBack.push({role:'user',text:'前の話に戻って'},{role:'assistant',text:'新井貴浩の概要です。',meta:{mode:'カープ専用正本知識'}});
const repeated2=C.control('前の話に戻って',hRepeatedBack);
check('repeated back second goes another branch',repeated2&&repeated2.primary&&repeated2.primary.value==='黒田博樹',repeated2);


// 15. 分割発話は一度だけ連結し、途中キャンセルで古い断片を残さない。
const hFragments=[
  {role:'user',text:'黒田の'},{role:'assistant',text:'うん、続けてどうぞ。'},
  {role:'user',text:'家族の'},{role:'assistant',text:'うん、続けてどうぞ。'}
];
let fragmentResolved=C.resolve('逸話',hFragments);
eq('fragment stitched once',fragmentResolved.message,'黒田の家族の逸話');
// handle()内の2段目resolve相当で、連結済み文をもう一度渡しても二重化しない。
fragmentResolved=C.resolve(fragmentResolved.message,hFragments);
eq('fragment no double stitch',fragmentResolved.message,'黒田の家族の逸話');
const fragmentCancel=C.control('やっぱりいいや',hFragments);
check('fragment cancel control',fragmentCancel&&fragmentCancel.control==='fragment_cancel',fragmentCancel);

// 16. ドメイン名を指定した復帰は、具体的な人物枝を次ターンにも保持する。
const hNamedBack=[
  {role:'user',text:'黒田博樹について教えて'},{role:'assistant',text:'黒田博樹の概要です。',meta:{mode:'カープ専用正本知識'}},
  {role:'user',text:'Firebaseについて教えて'},{role:'assistant',text:'Firebaseの概要です。'},
  {role:'user',text:'カープの話に戻って'},{role:'assistant',text:'黒田博樹についての概要です。新井貴浩にも触れます。',meta:{mode:'カープ専用正本知識'}}
];
const namedBackControl=C.control('カープの話に戻って',hNamedBack.slice(0,4));
check('named carp back restores kuroda',namedBackControl&&namedBackControl.primary&&namedBackControl.primary.value==='黒田博樹',namedBackControl);
const namedBackFrame=C.topicFrames(hNamedBack).slice(-1)[0];
check('named carp back persists primary',namedBackFrame&&namedBackFrame.primary&&namedBackFrame.primary.value==='黒田博樹',namedBackFrame);
eq('named carp back next family',C.resolve('家族は？',hNamedBack).message,'黒田博樹の家族について');

// 17. 明示的な複合質問は、その2項目を前者/後者として参照できる。
const hCompoundDifferent=[
  {role:'user',text:'黒田の家族と新井の成績を教えて'},
  {role:'assistant',text:'黒田の家族と新井の成績です。',meta:{mode:'カープ専用正本知識'}}
];
let compoundRef=C.control('前者は？',hCompoundDifferent);
eq('compound diff first ref',compoundRef&&compoundRef.restoreMessage,'黒田の家族について教えて');
compoundRef=C.control('後者は？',hCompoundDifferent);
eq('compound diff last ref',compoundRef&&compoundRef.restoreMessage,'新井の成績について教えて');
const hCompoundSame=[
  {role:'user',text:'黒田の家族と成績を教えて'},
  {role:'assistant',text:'黒田の家族と成績です。',meta:{mode:'カープ専用正本知識'}}
];
compoundRef=C.control('前者は？',hCompoundSame);
eq('compound same first ref',compoundRef&&compoundRef.restoreMessage,'黒田の家族について教えて');
compoundRef=C.control('後者は？',hCompoundSame);
eq('compound same last ref',compoundRef&&compoundRef.restoreMessage,'黒田の成績について教えて');


// 18. 分割発話の途中で観点を言い直した時は、古い観点を捨てて主題だけ保持する。
const hFragmentRepair=[
  {role:'user',text:'黒田の'},{role:'assistant',text:'うん、続けてどうぞ。'},
  {role:'user',text:'家族の'},{role:'assistant',text:'うん、続けてどうぞ。'}
];
let fragmentRepair=C.resolve('いや成績',hFragmentRepair);
eq('fragment repair aspect',fragmentRepair.message,'黒田の成績について');
check('fragment repair metadata',fragmentRepair.fragmentCorrection===true,fragmentRepair);
fragmentRepair=C.resolve(fragmentRepair.message,hFragmentRepair);
eq('fragment repair no second stitch',fragmentRepair.message,'黒田の成績について');

// 19. 前者/後者で選んだ枝は、その次の省略質問でも主役・観点を保持する。
const hParallelPersist=[
  {role:'user',text:'黒田の家族と新井の成績を教えて'},
  {role:'assistant',text:'黒田の家族と新井の成績です。',meta:{mode:'カープ専用正本知識'}},
  {role:'user',text:'後者は？'},
  {role:'assistant',text:'新井貴浩の成績です。',meta:{mode:'カープ専用正本知識'}}
];
const parallelPersistFrame=C.topicFrames(hParallelPersist).slice(-1)[0];
check('parallel selected primary persists',parallelPersistFrame&&parallelPersistFrame.primary&&/新井/.test(parallelPersistFrame.primary.value),parallelPersistFrame);
eq('parallel selected aspect persists',parallelPersistFrame&&parallelPersistFrame.aspect,'stats');
check('parallel next current stays arai',/新井/.test(C.resolve('今何してる？',hParallelPersist).message),C.resolve('今何してる？',hParallelPersist));

console.log(`CONTEXT STRESS: ${pass}/${pass+fail} PASS`);
if(fail)process.exit(1);
