#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{}};
global.addEventListener=()=>{};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-carp-knowledge-data.js',
  'jinpo-bot-conversation.js',
  'jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js',
  'jinpo-bot-carp.js',
  'jinpo-bot-kashin-name.js',
  'jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function candidateCount(answer){return (String(answer||'').match(/^\d+\. /gm)||[]).length;}
(async()=>{
  let h=[];
  let r=await B.handle({message:'家臣の名前つけて',history:h});
  check('route naming start',r&&r.mode==='家臣名付け'&&/全部おまかせ/.test(r.answer||''),r);
  h.push({role:'user',text:'家臣の名前つけて'},{role:'assistant',text:r.answer,meta:{mode:r.mode}});
  r=await B.handle({message:'全部お任せ',history:h});
  check('route naming all random',r&&r.mode==='家臣名付け'&&candidateCount(r.answer)===5,r);

  h=[];
  async function say(q){
    const out=await B.handle({message:q,history:h});
    h.push({role:'user',text:q},{role:'assistant',text:out.answer,meta:{mode:out.mode}});
    return out;
  }
  r=await say('黒田博樹について教えて');
  check('route kuroda intro',r&&/黒田博樹/.test(r.answer||''),r);
  check('route kuroda intro profile first',r&&/黒田博樹について分かっていることをまとめます。\n【人物:黒田博樹】/.test(r.answer||''),r&&r.answer);
  r=await say('家族は？');
  check('route family stays kuroda',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r&&r.answer);
  check('route family no unrelated comeback',!/2015年:黒田博樹の広島復帰/.test(r&&r.answer||''),r&&r.answer);

  r=await say('何歳だったっけ？');
  check('route kuroda age stays subject',r&&/黒田博樹/.test(r.answer||'')&&/確認でき(?:ない|ません)/.test(r.answer||''),r&&r.answer);
  check('route kuroda age no secondary person',!/新井貴浩/.test(r&&r.answer||''),r&&r.answer);
  r=await say('奥さんは？');
  check('route kuroda spouse stays subject',r&&/黒田博樹/.test(r.answer||'')&&/妻・配偶者/.test(r.answer||''),r&&r.answer);
  check('route kuroda spouse no parent fallback',!/父・黒田一博|黒田博樹の父母/.test(r&&r.answer||''),r&&r.answer);
  r=await say('いつ引退したっけ？');
  check('route kuroda retirement stays subject',r&&/黒田博樹/.test(r.answer||'')&&/引退年/.test(r.answer||''),r&&r.answer);
  r=await say('現役だったっけ？');
  check('route kuroda active uses canonical',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/現役選手名簿/.test(r.answer||''),r);
  r=await say('今何してる？');
  check('route kuroda current stays subject',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/確認でき(?:ない|ません)/.test(r.answer||''),r);

  r=await say('新井貴浩について教えて');
  check('route arai intro',r&&/新井貴浩/.test(r.answer||''),r);
  check('route arai intro profile first',r&&/新井貴浩について分かっていることをまとめます。\n【人物:新井貴浩】/.test(r.answer||''),r&&r.answer);
  r=await say('成績は？');
  check('route arai stats concrete',r&&/2000安打/.test(r.answer||'')&&/300本塁打/.test(r.answer||''),r&&r.answer);
  check('route arai stats no family',!/兄弟でプロ野球/.test(r&&r.answer||''),r&&r.answer);

  r=await say('さっきのやつは？');
  check('route deictic keeps arai stats',r&&/新井貴浩/.test(r.answer||'')&&/2000安打/.test(r.answer||''),r&&r.answer);
  r=await say('今何してる？');
  check('route arai current manager',r&&r.mode==='カープ専用正本知識'&&/新井貴浩/.test(r.answer||'')&&/監督/.test(r.answer||'')&&!/兄弟でプロ野球/.test(r.answer||''),r);
  r=await say('奥さんは？');
  check('route arai spouse does not become brother',r&&/新井貴浩/.test(r.answer||'')&&/妻・配偶者/.test(r.answer||'')&&!/兄弟でプロ野球/.test(r.answer||''),r&&r.answer);

  // 戻った話題を次ターンでも主役として維持する。
  h=[];
  r=await say('黒田博樹について教えて');
  r=await say('新井貴浩について教えて');
  r=await say('前の話に戻って');
  check('route back answers kuroda',r&&/黒田博樹/.test(r.answer||''),r&&r.answer);
  r=await say('家族は？');
  check('route back persists kuroda next turn',r&&/黒田博樹/.test(r.answer||'')&&!/新井貴浩\/新井良太/.test(r.answer||''),r&&r.answer);

  // 家臣名付けを1つの会話枝として扱い、生成名を人物/天気文脈へ混入させない。
  h=[];
  r=await say('黒田博樹について教えて');
  r=await say('家臣の名前つけて');
  r=await say('全部お任せ');
  let lastFrame=global.JINPO_BOT_CONVERSATION.topicFrames(h).slice(-1)[0];
  check('route naming frame domain stable',lastFrame&&lastFrame.domain==='kashin_name'&&!lastFrame.primary,lastFrame);
  r=await say('前の話に戻って');
  check('route back across naming returns kuroda',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||''),r);
  r=await say('成績は？');
  check('route back across naming persists kuroda',r&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||''),r&&r.answer);

  // 逆方向: 家臣名付けを保留して別話題へ行った後も、その状態へ戻れる。
  h=[];
  r=await say('家臣の名前つけて');
  r=await say('全部お任せ');
  const namingCandidates=String(r&&r.answer||'').split('\n').filter(x=>/^\d+\. /.test(x)).join('\n');
  r=await say('黒田博樹について教えて');
  r=await say('前の話に戻って');
  check('route back resumes paused naming',r&&r.mode==='家臣名付け'&&r.data&&r.data.resumedNaming===true,r);
  check('route back keeps prior naming candidates',namingCandidates&&namingCandidates.split('\n').every(x=>String(r.answer||'').includes(x)),r&&r.answer);
  r=await say('もっと');
  check('route resumed naming accepts continuation',r&&r.mode==='家臣名付け'&&candidateCount(r.answer)===5,r);

  // 名付け中に別人物へ移ったら名付けを一時停止し、その人物の「もっと」を横取りしない。
  h=[];
  r=await say('家臣の名前つけて');
  r=await say('全部お任せ');
  r=await say('黒田博樹について教えて');
  check('route person switch pauses naming',global.JINPO_BOT_KASHIN_NAME.state()&&global.JINPO_BOT_KASHIN_NAME.state().paused===true&&!global.JINPO_BOT_KASHIN_NAME.state().active,global.JINPO_BOT_KASHIN_NAME.state());
  r=await say('もっと');
  check('route more after person switch stays person',r&&r.mode!=='家臣名付け'&&/黒田博樹/.test(r.answer||''),r);
  r=await say('ありがとう');
  check('route thanks after person remains smalltalk',r&&r.mode==='日常会話',r);

  // 連続した「前の話に戻って」は一段ずつさらに前へ進む。
  h=[];
  r=await say('黒田博樹について教えて');
  r=await say('新井貴浩について教えて');
  r=await say('大瀬良大地について教えて');
  r=await say('前の話に戻って');
  check('route repeated back first arai',r&&/新井貴浩/.test(r.answer||''),r&&r.answer);
  r=await say('前の話に戻って');
  check('route repeated back second kuroda',r&&/黒田博樹/.test(r.answer||''),r&&r.answer);


  // 分割発話は本番ルートでも二重連結せず、途中キャンセルできる。
  h=[];
  r=await say('黒田の');
  check('route fragment first waits',r&&r.mode==='日常会話'&&/続けて/.test(r.answer||''),r);
  r=await say('家族の');
  check('route fragment second waits',r&&r.mode==='日常会話'&&/続けて/.test(r.answer||''),r);
  r=await say('逸話');
  check('route fragment stitched once',r&&r.data&&r.data.context&&r.data.context.message==='黒田の家族の逸話',r&&r.data);
  check('route fragment answer remains kuroda',r&&/黒田博樹/.test(r.answer||''),r&&r.answer);

  h=[];
  await say('黒田の');
  await say('家族の');
  r=await say('やっぱりいいや');
  check('route fragment cancel',r&&r.data&&r.data.fragmentCancelled===true&&r.data.conversationControl==='fragment_cancel',r);
  r=await say('新井について教えて');
  check('route fragment cancel clears old subject',r&&/新井貴浩/.test(r.answer||'')&&!/黒田博樹について分かっていることをまとめます/.test(r.answer||''),r&&r.answer);

  // 「カープの話に戻って」は直近の具体的なカープ枝へ戻り、次ターンにも主役を維持する。
  h=[];
  await say('黒田博樹について教えて');
  await say('Firebaseについて教えて');
  r=await say('カープの話に戻って');
  check('route named carp back restores kuroda',r&&/黒田博樹/.test(r.answer||''),r&&r.answer);
  r=await say('家族は？');
  check('route named carp back persists kuroda',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r&&r.answer);

  // 複合質問の前者/後者を、本番ルートでも元の項目へ戻す。
  h=[];
  r=await say('黒田の家族と新井の成績を教えて');
  check('route compound different initial',r&&r.data&&r.data.compound===true,r);
  r=await say('前者は？');
  check('route compound different first',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r&&r.answer);
  r=await say('後者は？');
  check('route compound different last',r&&/新井貴浩/.test(r.answer||'')&&/2000安打/.test(r.answer||''),r&&r.answer);

  h=[];
  r=await say('黒田の家族と成績を教えて');
  check('route compound same initial',r&&r.data&&r.data.compound===true,r);
  r=await say('前者は？');
  check('route compound same first',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r&&r.answer);
  r=await say('後者は？');
  check('route compound same last',r&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||''),r&&r.answer);


  // 分割途中の観点訂正を本番ルートでも古い「家族」へ戻さない。
  h=[];
  await say('黒田の');
  await say('家族の');
  r=await say('いや成績');
  check('route fragment aspect correction context',r&&r.data&&r.data.context&&/黒田.*成績/.test(r.data.context.message||'')&&!/家族.*成績/.test(r.data.context.message||''),r&&r.data);
  check('route fragment aspect correction answer',r&&/日米通算200勝/.test(r.answer||'')&&!/父・黒田一博/.test(r.answer||''),r&&r.answer);

  // 後者を選んだ後の省略質問でも、選択した新井を主役として維持する。
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  r=await say('後者は？');
  check('route parallel selected arai',r&&/新井貴浩/.test(r.answer||''),r&&r.answer);
  r=await say('今何してる？');
  check('route parallel selected persists next turn',r&&/新井貴浩/.test(r.answer||'')&&/監督/.test(r.answer||'')&&!/兄弟でプロ野球/.test(r.answer||''),r&&r.answer);

  // 前者/後者へ観点を直接足す形も元の対象へ解決する。
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  r=await say('後者の家族は？');
  check('route parallel suffix family',r&&/新井貴浩/.test(r.answer||'')&&/新井良太/.test(r.answer||''),r&&r.answer);
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  r=await say('前者の成績は？');
  check('route parallel suffix stats',r&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||''),r&&r.answer);

  // 実質的な別話題へ移った後は、昔の人物やBot回答内の脇役を裸の省略質問で復活させない。
  h=[];
  await say('黒田博樹について教えて');
  r=await say('バグ出た');
  check('route substantive everyday switch leaves carp',r&&r.mode==='日常会話',r);
  r=await say('家族は？');
  check('route no stale person after everyday switch',r&&r.mode!=='カープ専用正本知識'&&!/黒田博樹|新井貴浩|ジェイ・ジャクソン|上本崇司|堂林翔太/.test(r.answer||''),r);

  // ただの相槌・感謝は話題を切らない。
  h=[];
  await say('黒田博樹について教えて');
  r=await say('ありがとう');
  check('route thanks remains smalltalk',r&&r.mode==='日常会話',r);
  r=await say('家族は？');
  check('route thanks keeps kuroda branch',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r&&r.answer);

  // 一般テーマへ明示的に移った後も、古いカープ回答本文から人物・年度を拾い直さない。
  h=[];
  await say('黒田博樹について教えて');
  await say('Firebaseについて教えて');
  r=await say('家族は？');
  check('route general topic blocks stale carp fallback',r&&r.mode==='会話確認'&&r.data&&r.data.missingSubject===true&&/誰の家族/.test(r.answer||'')&&!/黒田博樹|新井貴浩|ジェイ・ジャクソン|上本崇司|堂林翔太/.test(r.answer||''),r);

  h=[];
  r=await say('奥さんは？');
  check('route spouse without subject asks who',r&&r.mode==='会話確認'&&r.data&&r.data.missingSubject===true&&/誰の配偶者/.test(r.answer||''),r);

  // 「前回の続き」は実際に枝を再開し、次ターンにも主役を維持する。
  h=[];
  await say('黒田博樹について教えて');
  await say('バグ出た');
  r=await say('前回の続き');
  check('route natural resume restores kuroda',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||''),r);
  r=await say('家族は？');
  check('route natural resume persists kuroda',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r&&r.answer);

  // 「どこまで話したっけ？」は履歴確認だけ。古い人物枝を再開したことにはしない。
  h=[];
  await say('黒田博樹について教えて');
  await say('バグ出た');
  r=await say('どこまで話したっけ？');
  check('route recall reports prior kuroda without resuming',r&&r.mode==='会話記憶'&&/黒田博樹/.test(r.answer||''),r);
  r=await say('家族は？');
  check('route recall does not reactivate kuroda',r&&r.mode!=='カープ専用正本知識'&&!/黒田博樹|新井貴浩|ジェイ・ジャクソン|上本崇司|堂林翔太/.test(r.answer||''),r);

  // 一般テーマ Firebase はネット取得なしでも基本説明でき、省略追質問を維持する。
  h=[];
  r=await say('Firebaseについて教えて');
  check('route firebase local overview',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&/認証|データベース/.test(r.answer||''),r);
  r=await say('何ができる？');
  check('route firebase followup capabilities',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&/Firestore|認証/.test(r.answer||''),r);
  r=await say('使い方は？');
  check('route firebase followup usage',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&/SDK/.test(r.answer||''),r);

  // Firebase / Firestore を「両方気になる」と明示した時だけ、前者・後者を並行保持する。
  h=[];
  r=await say('FirebaseとFirestore、両方気になる');
  check('route firebase firestore parallel intro',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&/Firestore/.test(r.answer||''),r);
  r=await say('前者は？');
  check('route firebase firestore first',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||''),r);
  r=await say('何ができる？');
  check('route firebase first persists',r&&/Firebase/.test(r.answer||'')&&/認証|Hosting/.test(r.answer||''),r);
  r=await say('後者は？');
  check('route firebase firestore second',r&&r.mode==='日常会話'&&/Firestore/.test(r.answer||''),r);
  r=await say('使い方は？');
  check('route firestore second persists',r&&/Firestore/.test(r.answer||'')&&/コレクション|ドキュメント/.test(r.answer||''),r);

  // 一般テーマの復帰も次ターンまで維持する。
  h=[];
  await say('Firebaseについて教えて');
  await say('バグ出た');
  r=await say('前回の続き');
  check('route firebase natural resume',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||''),r);
  r=await say('使い方は？');
  check('route firebase natural resume persists',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&/SDK/.test(r.answer||''),r);

  // 「カープに戻って」の短い表記でも具体的な人物枝へ戻る。
  h=[];
  await say('黒田博樹について教えて');
  await say('Firebaseについて教えて');
  r=await say('カープに戻って');
  check('route named carp short variant',r&&/黒田博樹/.test(r.answer||''),r&&r.answer);
  r=await say('家族は？');
  check('route named carp short persists',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r&&r.answer);

  // 現在の人物枝が明確なら「その人」は回答本文の脇役人物より主役を優先する。
  h=[];
  await say('黒田博樹について教えて');
  await say('家族は？');
  r=await say('その人の成績は？');
  check('route pronoun person prefers active primary',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||''),r);
  r=await say('それの逸話は？');
  check('route pronoun aspect switches to anecdote',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/広島復帰|抱擁/.test(r.answer||''),r);
  r=await say('もっと');
  check('route person anecdote more stays person',r&&r.data&&r.data.context&&/黒田博樹の逸話/.test(r.data.context.message||'')&&!/カープの他の逸話/.test(r.data.context.message||''),r);

  // 同一発話内の訂正後観点を履歴へ残し、「その話もっと」でも訂正前へ戻らない。
  h=[];
  r=await say('黒田の家族、いや成績');
  check('route inline correction stats answer',r&&/日米通算200勝/.test(r.answer||'')&&!/父・黒田一博/.test(r.answer||''),r&&r.answer);
  r=await say('その話もっと');
  check('route that topic more keeps corrected stats',r&&r.data&&r.data.context&&/黒田博樹の成績/.test(r.data.context.message||'')&&!/家族/.test(r.data.context.message||''),r);
  r=await say('家族に戻って');
  check('route aspect named back family clean',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||'')&&!(r.data&&r.data.context&&/もっと.*もっと/.test(r.data.context.message||'')),r);
  r=await say('もっと');
  check('route family more stays family',r&&r.data&&r.data.context&&/黒田博樹の家族/.test(r.data.context.message||'')&&!/カープの選手をもう少し/.test(r.data.context.message||''),r);
  r=await say('もっと');
  check('route repeated family more keeps aspect',r&&r.data&&r.data.context&&/黒田博樹の家族/.test(r.data.context.message||''),r);

  // ドメイン名ではない一般テーマ名でも、そのテーマの具体的な枝へ戻せる。
  h=[];
  await say('Firebaseについて教えて');
  await say('新井貴浩について教えて');
  r=await say('Firebaseに戻って');
  check('route named general topic back firebase',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&!/新井貴浩/.test(r.answer||''),r);
  r=await say('何ができる？');
  check('route named general topic back persists',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&/認証|Hosting/.test(r.answer||''),r);

  // 2人を同時に尋ねた直後の「その人」は安全に確認し、略称とフルネームを重複候補にしない。
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  r=await say('その人の家族は？');
  check('route compound pronoun remains ambiguous',r&&r.mode==='会話文脈'&&/複数候補/.test(r.answer||''),r);
  check('route compound pronoun candidates dedup aliases',r&&/黒田博樹、新井貴浩/.test(r.answer||'')&&!/新井貴浩、黒田/.test(r.answer||'')&&!/黒田博樹、新井貴浩、黒田/.test(r.answer||''),r&&r.answer);

  // 一般テーマでも「それ／その話」は現在主題へ接続し、歩き巫女自身の説明へ横取りされない。
  h=[];
  await say('Firebaseについて教えて');
  r=await say('それの使い方は？');
  check('route firebase deictic usage',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&/SDK/.test(r.answer||'')&&!/雑談、サイト案内/.test(r.answer||''),r);
  r=await say('その話もっと');
  check('route firebase that-topic-more',r&&r.data&&r.data.context&&/Firebase/.test(r.data.context.message||''),r);
  r=await say('それは安全？');
  check('route firebase deictic safety',r&&/Firebase/.test(r.answer||'')&&/Security Rules|設定次第/.test(r.answer||''),r);

  // 曖昧確認の2候補に「両方」と答えた場合は再確認せず、両方を選択済みとして扱う。
  h=[];
  await say('FirebaseとFirestore、両方気になる');
  await say('それは？');
  r=await say('両方');
  check('route general ambiguity both resolves',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&/Firestore/.test(r.answer||'')&&!/どちらか教えて/.test(r.answer||''),r);
  r=await say('使い方は？');
  check('route general ambiguity both followup keeps both',r&&/Firebase/.test(r.answer||'')&&/Firestore/.test(r.answer||'')&&/SDK/.test(r.answer||''),r);

  h=[];
  await say('黒田の家族と新井の成績を教えて');
  await say('その人は？');
  r=await say('両方');
  check('route person ambiguity both resolves without reprompt',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||'')&&!/名前で教えて/.test(r.answer||''),r);

  // 並行一般テーマの「それ」は対象選択まで曖昧さを維持する。
  h=[];
  await say('FirebaseとFirestore、両方気になる');
  r=await say('それは？');
  check('route general parallel that ambiguous',r&&r.mode==='会話文脈'&&/Firebase、Firestore/.test(r.answer||'')&&/複数の話題/.test(r.answer||''),r);
  r=await say('その話の使い方は？');
  check('route pending general ambiguity persists',r&&r.mode==='会話文脈'&&/Firebase、Firestore/.test(r.answer||'')&&/複数/.test(r.answer||''),r);


  // 並行2項目を一度選んだ後でも、「いや前者」「違う、前の方」で選択を訂正できる。
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  await say('後者は？');
  r=await say('いや前者');
  check('route parallel correction switches to first',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||'')&&!/2000安打/.test(r.answer||''),r&&r.answer);
  r=await say('もっと');
  check('route parallel correction persists first',r&&r.data&&r.data.context&&/黒田博樹の家族/.test(r.data.context.message||'')&&!/新井/.test(r.data.context.message||''),r);

  h=[];
  await say('黒田の家族と新井の成績を教えて');
  await say('後者は？');
  r=await say('違う、前の方');
  check('route parallel correction front wording',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||'')&&r.mode!=='カープ公式順位',r);

  // 一般テーマの前者/後者訂正も、その次の省略質問まで選んだ主題を維持する。
  h=[];
  await say('FirebaseとFirestore、両方気になる');
  await say('後者は？');
  r=await say('いや前者');
  check('route general parallel correction first',r&&r.mode==='日常会話'&&/Firebase/.test(r.answer||'')&&!/^Firestoreは/.test(r.answer||''),r);
  r=await say('使い方は？');
  check('route general parallel correction first persists',r&&/Firebase/.test(r.answer||'')&&/SDK/.test(r.answer||''),r);

  // 「それ」が曖昧で確認中でも、「違う、後者」で明示選択すれば確認状態を解消する。
  h=[];
  await say('FirebaseとFirestore、両方気になる');
  await say('それは？');
  r=await say('違う、後者');
  check('route pending ambiguity correction selects firestore',r&&r.mode==='日常会話'&&/^Firestoreは/.test(r.answer||''),r);
  r=await say('使い方は？');
  check('route resolved ambiguity no stale reprompt',r&&r.mode==='日常会話'&&/Firestore/.test(r.answer||'')&&/コレクション|ドキュメント/.test(r.answer||'')&&!/どちらか教えて/.test(r.answer||''),r);

  // 確認待ち中でも、候補名と質問内容を明示したら元の「それは？」へ巻き戻さない。
  h=[];
  await say('FirebaseとFirestore、両方気になる');
  await say('それは？');
  r=await say('Firestoreの使い方は？');
  check('route pending ambiguity explicit detailed selection',r&&r.mode==='日常会話'&&/Firestore/.test(r.answer||'')&&/コレクション|ドキュメント/.test(r.answer||''),r);

  // 「今の新井の方」は最新情報要求ではなく、直前に話した新井への選択訂正として扱う。
  h=[];
  await say('黒田博樹について教えて');
  await say('新井貴浩について教えて');
  await say('前の話に戻って');
  r=await say('いや、今の新井の方');
  check('route named correction current wording no realtime hijack',r&&r.mode==='カープ専用正本知識'&&/新井貴浩/.test(r.answer||'')&&r.mode!=='カープ最新Web',r);
  r=await say('成績は？');
  check('route named correction persists arai',r&&/新井貴浩/.test(r.answer||'')&&/2000安打/.test(r.answer||''),r&&r.answer);

  // 部分同意の後半に質問がある場合は、前半の相槌で質問を消さない。
  h=[];
  await say('黒田博樹について教えて');
  await say('家族は？');
  r=await say('まあそれは分かるけど成績は？');
  check('route partial agreement trailing question keeps person stats',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||'')&&r.mode!=='カープ公式順位',r);
  r=await say('もっと');
  check('route partial agreement trailing question persists stats',r&&r.data&&r.data.context&&/黒田博樹の成績/.test(r.data.context.message||''),r);

  // 「それは違うと思う」は推量ではなく、直前回答への反論として受ける。
  h=[];
  await say('黒田博樹について教えて');
  await say('家族は？');
  r=await say('それは違うと思う');
  check('route disagreement with think not uncertainty',r&&r.mode==='日常会話'&&/違う|見直|捉え直/.test(r.answer||'')&&!/断定ではない|かもしれない/.test(r.answer||''),r);


  // 「前のは／その前のは」も日常相槌へ横取りせず、談話参照として復帰し続ける。
  h=[];
  await say('黒田博樹について教えて');
  await say('新井貴浩について教えて');
  r=await say('前のは');
  check('route previous-one short restores kuroda',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||''),r);
  r=await say('家族は？');
  check('route previous-one short persists kuroda',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r&&r.answer);

  h=[];
  await say('黒田博樹について教えて');
  await say('新井貴浩について教えて');
  r=await say('その前のは');
  check('route that-previous short clamps oldest branch',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||''),r);
  r=await say('成績は？');
  check('route that-previous short persists oldest branch',r&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||''),r&&r.answer);

  // 「前のやつ」はその場の表示だけでなく、次ターンの主役として復帰を固定する。
  h=[];
  await say('黒田博樹について教えて');
  await say('新井貴浩について教えて');
  r=await say('前のやつ');
  check('route previous-thing restores kuroda',r&&/黒田博樹/.test(r.answer||''),r&&r.answer);
  r=await say('成績は？');
  check('route previous-thing persists kuroda',r&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||'')&&!/2000安打/.test(r.answer||''),r&&r.answer);

  // 主語と観点を同時に訂正した場合は、そのターンの表示も訂正後へ合わせる。
  h=[];
  await say('黒田博樹について教えて');
  await say('家族は？');
  r=await say('違う、新井の家族');
  check('route correction subject and aspect same turn',r&&/新井貴浩/.test(r.answer||'')&&/新井良太/.test(r.answer||'')&&!/父・黒田一博/.test(r.answer||''),r&&r.answer);
  r=await say('もっと');
  check('route correction subject and aspect persists',r&&r.data&&r.data.context&&/新井貴浩の家族/.test(r.data.context.message||''),r);

  // 区切りを省いた一般テーマ訂正も、そのターンから訂正後テーマを表示する。
  h=[];
  await say('Firebaseについて教えて');
  r=await say('いやFirestore');
  check('route compact general topic correction',r&&r.mode==='日常会話'&&/^Firestoreは/.test(r.answer||''),r);
  r=await say('使い方は？');
  check('route compact general topic correction persists',r&&/Firestore/.test(r.answer||'')&&/コレクション|ドキュメント/.test(r.answer||''),r);

  // 「AじゃなくてB」と両側を同時に言った場合は、否定されたAではなくBを最終選択にする。
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  await say('前者は？');
  r=await say('前者じゃなくて後者');
  check('route negated parallel selection chooses positive side',r&&r.mode==='カープ専用正本知識'&&/新井貴浩/.test(r.answer||'')&&/2000安打/.test(r.answer||''),r&&r.answer);
  r=await say('もっと');
  check('route negated parallel selection persists positive side',r&&r.data&&r.data.context&&/新井貴浩の成績/.test(r.data.context.message||''),r);

  h=[];
  await say('FirebaseとFirestore、両方気になる');
  await say('前者は？');
  r=await say('前者じゃなくて後者');
  check('route general negated parallel selection chooses firestore',r&&r.mode==='日常会話'&&/^Firestoreは/.test(r.answer||''),r);
  r=await say('使い方は？');
  check('route general negated parallel selection persists firestore',r&&/Firestore/.test(r.answer||'')&&/コレクション|ドキュメント/.test(r.answer||''),r);

  // 2人物を「両方」と明示選択した後の裸の観点質問は、片方やカープ全体へ寄せない。
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  await say('その人は？');
  r=await say('両方');
  check('route both-person ambiguity accepts both',r&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||''),r&&r.answer);
  r=await say('家族は？');
  check('route both-person family keeps both',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||'')&&/父/.test(r.answer||'')&&/新井良太/.test(r.answer||''),r);
  r=await say('成績は？');
  check('route both-person stats keeps both',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||'')&&/新井貴浩/.test(r.answer||'')&&/2000安打/.test(r.answer||''),r);
  r=await say('逸話は？');
  check('route both-person anecdote keeps both',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||''),r);

  r=await say('もっと');
  check('route both-person more keeps both',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||''),r);
  r=await say('家族は？');
  check('route both-person family after more still both',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||''),r);
  r=await say('もっと詳しく');
  check('route both-person aspect more keeps both',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||''),r);

  // 前者/後者を明示した時点で「両方」状態を終了し、その後は選んだ1人物だけを維持する。
  r=await say('前者は？');
  check('route both-person explicit first exits both',r&&/黒田博樹/.test(r.answer||''),r&&r.answer);
  r=await say('成績は？');
  check('route both-person after first stays single',r&&(!r.data||r.data.compound!==true)&&/黒田博樹/.test(r.answer||'')&&/日米通算200勝/.test(r.answer||'')&&!/2000安打/.test(r.answer||''),r);

  // 2人物の枝を別話題で中断しても、「前の話に戻って」で2人＋観点まで復元し、その次ターンも維持する。
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  await say('その人は？');
  await say('両方');
  await say('家族は？');
  await say('Firebaseについて教えて');
  r=await say('前の話に戻って');
  check('route both-person back restores shared branch',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||'')&&/父/.test(r.answer||'')&&/新井良太/.test(r.answer||''),r);
  r=await say('成績は？');
  check('route both-person back persists both next turn',r&&r.data&&r.data.compound===true&&/日米通算200勝/.test(r.answer||'')&&/2000安打/.test(r.answer||''),r);
  r=await say('もっと');
  check('route both-person back persists both more',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||''),r);

  // 両方から前者を明示選択した後は、別話題を挟んで戻っても両方へ勝手に復活しない。
  h=[];
  await say('黒田の家族と新井の成績を教えて');
  await say('その人は？');
  await say('両方');
  await say('前者は？');
  await say('Firebaseについて教えて');
  r=await say('前の話に戻って');
  check('route both-person selected-single back stays single',r&&(!r.data||r.data.compound!==true)&&/黒田博樹/.test(r.answer||''),r);
  r=await say('成績は？');
  check('route both-person selected-single persists after back',r&&(!r.data||r.data.compound!==true)&&/日米通算200勝/.test(r.answer||'')&&!/2000安打/.test(r.answer||''),r);

  // 実UIは現在のユーザー発言を履歴へ保存してからhandleへ渡すため、その形式でも重複しないことを固定する。
  let uiHistory=[];
  async function sayUiStyle(q){
    uiHistory.push({role:'user',text:q,at:Date.now()});
    const out=await B.handle({message:q,history:uiHistory});
    uiHistory.push({role:'assistant',text:out.answer,meta:{mode:out.mode},at:Date.now()+1});
    return out;
  }
  await sayUiStyle('黒田の家族と新井の成績を教えて');
  await sayUiStyle('その人は？');
  r=await sayUiStyle('両方');
  check('route ui-history both-person selection compound',r&&r.data&&r.data.compound===true&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||''),r);
  r=await sayUiStyle('家族は？');
  check('route ui-history both-person family no duplicate current',r&&r.data&&r.data.compound===true&&r.data.parts&&r.data.parts.length===2&&/黒田博樹/.test(r.answer||'')&&/新井貴浩/.test(r.answer||''),r);
  r=await sayUiStyle('成績は？');
  check('route ui-history both-person stats no duplicate current',r&&r.data&&r.data.compound===true&&r.data.parts&&r.data.parts.length===2&&/日米通算200勝/.test(r.answer||'')&&/2000安打/.test(r.answer||''),r);

  console.log(`BOT ROUTE CONTEXT: ${pass}/${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
