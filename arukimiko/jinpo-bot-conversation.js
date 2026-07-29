/*
 * 歩き巫女 共通会話ルーター v3.3.0
 *
 * 目的:
 * - 「ページ案内」「事実質問」「会話の続き」を各モジュール任せにせず最初に一度だけ判定。
 * - 短い追質問を直前の話題へ接続。
 * - 「違う」「そうじゃなくて」の後半を優先。
 * - ページ案内は明示的に移動を頼まれた時だけ。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_CONVERSATION)return;
  var VERSION='3.3.0';
  var RESET_KEY='arukimikoConversationResetAt.v1';

  function resetContext(){
    var at=Date.now();
    try{sessionStorage.setItem(RESET_KEY,String(at));}catch(e){}
    return at;
  }

  function resetAt(){
    try{
      var n=Number(sessionStorage.getItem(RESET_KEY)||0);
      return isFinite(n)&&n>0?n:0;
    }catch(e){return 0;}
  }

  function filterHistory(history){
    var h=Array.isArray(history)?history:[];
    var cut=resetAt();
    if(!cut)return h.slice();
    return h.filter(function(x){return x&&Number(x.at||0)>=cut;});
  }


  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function C(v){
    return S(v).toLowerCase().replace(/[？?！!。、・「」『』【】（）()\[\]［］\s]/g,'');
  }

  function isExplicitTopicShift(text){
    var t=S(text);
    return /^(?:そういえば|ところで|それはそうと|話(?:は|を)?変(?:わる|える)(?:けど|が|と)?|話題(?:は|を)?変(?:わる|える)(?:けど|が|と)?|別件(?:だけど|ですが|なんだけど|で)?|全然(?:関係ない|別の)(?:話)?(?:だけど|ですが|なんだけど)?)[、,\s]*/.test(t);
  }

  // ユーザーが実際に使っている会話テンポだけを、セッション内の軽い信号として読む。
  // 個人属性は推測せず、長さ・敬体/常体・勢いなど返答の見た目に必要な範囲だけを扱う。
  function interactionStyle(history,currentMessage){
    var h=filterHistory(history),cur=S(currentMessage),items=[];
    if(cur)items.push(cur);
    for(var i=h.length-1;i>=0&&items.length<12;i--){
      var x=h[i];if(!x||x.role!=='user')continue;
      var t=S(x.text);if(!t||t===cur&&items[0]===cur)continue;
      items.push(t);
    }
    if(!items.length)return {pace:'normal',register:'neutral',energy:'neutral',avgLength:0,samples:0,topicShift:false};
    var total=0,shortN=0,longN=0,polite=0,casual=0,lively=0,calm=0;
    items.forEach(function(t){
      var n=t.length;total+=n;if(n<=14)shortN++;if(n>=56)longN++;
      if(/(?:です|ます|ください|お願いします|でしょう|ですか|ません)(?:[。！？!?]|$)/.test(t))polite++;
      if(/(?:だね|だよ|だな|だろ|じゃん|かな|かも|だわ|だぞ|だぜ|って感じ|なんだよ)(?:[。！？!?]|$)/.test(t)||/^(?:うん|いや|まじ|マジ|そうそう|そっか|なるほど|了解|おけ|おっけ)/.test(t))casual++;
      if(/[!！]{2,}|(?:ｗ|w){2,}|笑|草|すげ|最高|やば/.test(t))lively++;
      if(/(?:ゆっくり|落ち着いて|静かに|淡々|冷静)/.test(t))calm++;
    });
    var avg=total/items.length,pace='normal';
    if(shortN/items.length>=0.6&&avg<=22)pace='terse';
    else if(longN/items.length>=0.25||(items.length>=3&&avg>=32))pace='elaborate';
    var register='neutral';
    if(polite>=Math.max(2,casual+1))register='polite';
    else if(casual>=Math.max(2,polite+1))register='casual';
    var energy='neutral';
    if(lively>=2&&lively>calm)energy='lively';
    else if(calm>=2&&calm>lively)energy='calm';
    return {pace:pace,register:register,energy:energy,avgLength:Math.round(avg),samples:items.length,topicShift:isExplicitTopicShift(cur)};
  }


  function carriedListenIntent(history,currentMessage){
    var cur=S(currentMessage);
    if(!cur||isExplicitTopicShift(cur)||/(?:まあいいや|もういい|この話は終わり|話変えよう|別の話)/.test(cur))return false;
    // 明確な新しい質問・調べものは、話題転換語がなくても「聞き役継続」より現在の依頼を優先する。
    if(/[？?]/.test(cur)||/(?:教えて|知りたい|調べて|検索して|って何|ってなに|とは|誰|だれ|どこ|いつ|なぜ|なんで|どうして)/.test(cur))return false;
    var h=historyBeforeCurrent(history,cur),seen=0;
    for(var i=h.length-1;i>=0&&seen<6;i--){
      var x=h[i];if(!x||x.role!=='user')continue;
      var t=S(x.text);if(!t)continue;seen++;
      if(isExplicitTopicShift(t)||/(?:まあいいや|もういい|この話は終わり|話変えよう|別の話)/.test(t))return false;
      // 後から相談・意見要求へ切り替えた記録があれば、古い「聞いて」指定は引き継がない。
      if(/(?:どうしたら|どうすれば|どうするのがいい|アドバイス(?:して|ください|ほしい|欲しい|お願い)|一緒に考えて|どう思う|意見(?:を)?(?:聞きたい|教えて))/.test(t))return false;
      if(/(?:ただ|とりあえず)?(?:聞いて|聞いてほしい|話を聞いて|愚痴(?:を)?聞いて|吐き出したい|話したいだけ)|(?:アドバイス|助言|解決策|改善策|対処法|意見)(?:は|なんて|とか)?(?:いらない|要らない|不要|求めてない|いらん)/.test(t))return true;
    }
    return false;
  }

  // その発言で明示された「会話上どう受けてほしいか」だけを読む。
  // 心理状態や性格は推測せず、助言希望・ただ聞いてほしい・喜び共有など返答形式に必要な信号だけを返す。
  function listeningSignals(history,currentMessage){
    var t=S(currentMessage),c=C(t);
    if(!t)return {mode:'neutral',need:'respond',valence:'neutral',intensity:'normal',openness:'neutral',avoidAdvice:false,explicit:false};

    var need='respond',mode='conversation',explicit=false;
    // 「アドバイスはいらない」のような明示的な拒否は、語中の「アドバイス」に先に反応させない。
    if(/(?:ただ|とりあえず)?(?:聞いて|聞いてほしい|話を聞いて|愚痴(?:を)?聞いて|吐き出したい|話したいだけ)|(?:アドバイス|助言|解決策|改善策|対処法|意見)(?:は|なんて|とか)?(?:いらない|要らない|不要|求めてない|いらん)/.test(t)){
      need='listen';mode='listen_only';explicit=true;
    }else if(/(?:アドバイス(?:して|ください|ほしい|欲しい|ある|お願い)|助言(?:して|ください|ほしい|欲しい|お願い)|どうしたら|どうすれば|どうするのがいい|相談(?:したい|乗って|に乗って)|解決(?:策|方法)(?:を)?(?:教えて|ほしい|欲しい|考えて)|改善(?:策|方法)(?:を)?(?:教えて|ほしい|欲しい|考えて)|対処(?:法|方法)(?:を)?(?:教えて|ほしい|欲しい)|手伝って|一緒に考えて|直して|修正して|原因(?:を)?(?:見て|調べて))/.test(t)){
      need='advice';mode='advice';explicit=true;
    }else if(/(?:どう思う|どう感じる|意見(?:を)?(?:聞きたい|教えて)|率直にどう|感想(?:を)?(?:聞きたい|教えて))/.test(t)){
      need='opinion';mode='opinion_request';explicit=true;
    }

    var carriedListen=need==='respond'&&carriedListenIntent(history,t);
    if(carriedListen){need='listen';mode='listen_only';}

    var positive=/^(?:やった|やったー|やったぞ)[！!。\s]*$/.test(t)||/(?:うれしい|嬉しい|できた|成功(?:した)?|うまくいった|最高|楽しかった|助かった|勝った|当たった|完成した|通った|合格した|受かった|採用された|達成した|公開できた|リリースできた|直った)(?:んだ|んだよ|よ|ね|ぞ)?[！!。\s]*$/.test(t)||/(?:めっちゃ|すごく|かなり).*(?:うれしい|嬉しい|楽しい|よかった|良かった)/.test(t);
    var negative=/(?:つらい|つらかった|辛い|辛かった|きつい|きつかった|しんどい|疲れた|最悪|落ち込|へこん|困った|嫌だった|いやだった|悲しい|かなしい|うまくいかない|失敗した|怒られた|ミスした|腹立つ|むかつく|悔しい|不安|心配|迷ってる|迷っている|忙しい|バタバタ|時間ない|手が回らない|めんどくさい|面倒くさい|バグ(?:った|出た|が出た)|エラー(?:が)?出た|動かない|壊れた)/.test(t);
    var uncertain=/(?:迷ってる|迷っている|決めきれない|どうしようかな|悩んでる|悩んでいる|自信ない|よく分からない|よくわからない)/.test(t);

    var valence=positive&&!negative?'positive':negative&&!positive?'negative':positive&&negative?'mixed':'neutral';
    var infoQuestion=need==='respond'&&/[？?]/.test(t);
    if(need==='respond'&&!infoQuestion){
      if(positive&&negative)mode='mixed_sharing';
      else if(positive)mode='celebration';
      else if(negative)mode=uncertain?'uncertain':'venting';
      else if(/(?:今日|昨日|きのう|さっき|この前|最近).*(?:した|してた|だった|あった|起きた|言われた|なった)|(?:したんだ|だったんだ|あったんだ|してたんだ)(?:よ|けど|けどさ)?[。！!]*$/.test(t))mode='sharing';
    }

    var intensity='normal';
    if(/[!！]{3,}|(?:めちゃくちゃ|めっちゃ|本当に|ほんとに|かなり|最悪|最高|やばい|ヤバい)/.test(t))intensity='strong';
    else if(/[!！]{1,2}|(?:ちょっと|少し|なんか)/.test(t))intensity='light';

    var openness='neutral';
    if(/(?:聞いて|話したい|ちょっといい|まだある|続きが|それでね|それでさ)/.test(t))openness='open';
    else if(/(?:まあいいや|もういい|この話は終わり|それだけ|以上|話変えよう|別の話)/.test(t))openness='closed';

    return {
      mode:mode,
      need:need,
      valence:valence,
      intensity:intensity,
      openness:openness,
      avoidAdvice:need==='listen'||(need==='respond'&&(mode==='venting'||mode==='sharing'||mode==='celebration'||mode==='mixed_sharing')),
      explicit:explicit,
      carriedListen:carriedListen,
      compact:c
    };
  }

  // 短い反応が「同意」「保留」「軽い反論」「訂正」のどれかを読む。
  // 単語だけではなく、発話全体の形を見て「違いを教えて」のような通常質問を反論扱いしない。
  function conversationalStance(history,currentMessage){
    var t=S(currentMessage),c=C(t);
    if(!t)return {type:'neutral',confidence:'low',explicit:false};
    var infoRequest=/(?:教えて|知りたい|調べて|検索して|とは|って何|ってなに|違い(?:は|を)|比較|どっち|どちら|何が違)/.test(t);
    if(infoRequest&&!/^(?:いや|でも|うーん|んー|そうかな|本当かな|ほんとかな|それは違|そうじゃ)/.test(t))return {type:'neutral',confidence:'low',explicit:false};

    if(/^(?:いや[、,\s]*)?(?:違う|そうじゃない|そこじゃない|そういう意味じゃない|そういうことじゃない|言いたいのは違う|話が違う)(?:[。！!…\s]|$)/.test(t)||/^(?:いや|違う)[、,\s]+.{2,}/.test(t))
      return {type:'correction',confidence:'high',explicit:true};
    if(/^(?:いや|でも|ただ)[、,\s]*(?:それは違う|違うと思う|そうは思わない|納得できない|ちょっと違う|違う気がする)|^(?:それは|そこは)?(?:違うと思う|そうは思わない|納得できない|ちょっと違う|違う気がする)/.test(t))
      return {type:'disagreement',confidence:'high',explicit:true};
    if(/^(?:そうかな|そうなのかな|本当かな|ほんとかな|本当にそう|ほんとにそう|どうだろう|どうなんだろう|うーん|んー|微妙(?:だな|かも)?|そうとも限らない)(?:[。！!？?…\s]|$)/.test(t))
      return {type:'skepticism',confidence:/[？?]/.test(t)?'high':'medium',explicit:true};
    if(/^(?:まあ|確かに|たしかに|そうだね|そうなんだけど|分かる|わかる|それはそう)(?:[^。！？!?]{0,30})?(?:けど|けれど|ただ|でも)(?:[、,\s]|$)/.test(t))
      return {type:'partial_agreement',confidence:'high',explicit:true};
    if(/^(?:うん|うんうん|そうだね|そうそう|確かに|たしかに|その通り|分かる|わかる|そう思う|同感|なるほどね|たしかにね|確かにね)(?:[。！!\s]|$)/.test(t) && t.length<=36)
      return {type:'agreement',confidence:'high',explicit:true};
    return {type:'neutral',confidence:'low',explicit:false,compact:c};
  }

  // 「けど…」「でも…」のように結論を置かず発話を開いたままにしている形。
  // こちらで続きを補完せず、相手に発話権を残すための信号としてのみ使う。
  function unfinishedThoughtCue(text){
    var t=S(text);if(!t||/[？?]/.test(t))return false;
    if(/(?:けど|けれど|けれども|けどさ|でも|でもさ|ただ|たださ|というか|ていうか|なんというか|なんていうか|なんか|まあ)[、,…\.\s]*$/.test(t))return true;
    if(/(?:けどね|でもね|ただね|まあね)[…\.]+$/.test(t))return true;
    if(/(?:うーん|んー|えっと|あの)[…\.\s]*$/.test(t))return true;
    return false;
  }

  // 「冗談」「本気」「軽い皮肉の可能性」を、明示的な言葉だけから保守的に読む。
  // 皮肉は断定せず possible_irony として返し、文字通りの称賛へ決め打ちしないためにだけ使う。
  function pragmaticTone(history,currentMessage){
    var t=S(currentMessage),c=C(t);
    if(!t)return {type:'neutral',confidence:'low',explicit:false};

    if(/(?:冗談じゃなく|冗談じゃない|冗談抜き(?:で(?:本気|真面目(?:に)?|まじめ(?:に)?)?)?|ふざけ(?:て)?ない|本気で|本気なんだけど|マジで(?:相談|困|聞|言)|真面目に|まじめに)(?:[、,。！!？?…\s]|$)/.test(t))
      return {type:'serious',confidence:'high',explicit:true};
    if(/(?:って(?:いう|の)は冗談|冗談(?:だよ|です|だけど|だけね|だから)|なんちゃって|うそうそ|ウソウソ|嘘嘘|ジョーク(?:だよ|です)?)(?:[、,。！!…\s]|$)/.test(t))
      return {type:'joke',confidence:'high',explicit:true};
    if(/(?:皮肉(?:だよ|です|だから)|[（(]\s*棒\s*[）)]|棒読み|はいはい[、,\s]*(?:さすが|最高|すごい)|(?:最高|ありがたい|助かる|さすが)(?:だね|ですね|だな)?[、,。.!！\s]*(?:また|なのに|バグ|エラー|失敗|落ち|動かない|最悪))/.test(t))
      return {type:'possible_irony',confidence:/[（(]\s*棒/.test(t)?'high':'medium',explicit:/[（(]\s*棒|棒読み/.test(t)};
    if(/(?:www+|ｗｗ+|草(?:$|[。！!\s])|[（(]?笑[）)]?\s*$)/i.test(t)&&t.length<=80)
      return {type:'playful',confidence:'low',explicit:false};
    return {type:'neutral',confidence:'low',explicit:false,compact:c};
  }


  // 冗談へどの程度「冗談で返すか」を会話の勢いから決める。
  // 冗談を検出したからといって毎回大きくボケ返さず、真面目・皮肉・聞き役では抑える。
  function humorResponsePolicy(history,currentMessage){
    var t=S(currentMessage),tone=pragmaticTone(history,t),style=interactionStyle(history,t),listen=listeningSignals(history,t);
    var h=historyBeforeCurrent(history,t),recentPlayful=0,seen=0;
    for(var i=h.length-1;i>=0&&seen<5;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;seen++;
      if(/(?:ふふ|冗談|なんちゃって|ボケ|ツッコミ|笑|ｗ|w{2,}|草)/i.test(S(x.text)))recentPlayful++;
    }
    if(tone.type==='serious')return {mode:'none',reason:'serious',confidence:'high'};
    if(tone.type==='possible_irony')return {mode:'ack',reason:'possible_irony',confidence:tone.confidence||'medium'};
    if(listen&&listen.need==='listen'&&(listen.valence==='negative'||listen.valence==='mixed'))return {mode:'ack',reason:'listening_first',confidence:'high'};
    if(tone.type==='joke'){
      if(recentPlayful>=2)return {mode:'light',reason:'avoid_humor_pileup',confidence:'high'};
      if(style.energy==='lively'||style.register==='casual')return {mode:'playful',reason:'explicit_joke_lively_context',confidence:'medium'};
      return {mode:'light',reason:'explicit_joke',confidence:'high'};
    }
    if(tone.type==='playful'){
      if(recentPlayful>=2)return {mode:'ack',reason:'recent_playful_replies',confidence:'medium'};
      return {mode:'light',reason:'playful_signal',confidence:'low'};
    }
    return {mode:'none',reason:'no_humor_signal',confidence:'low'};
  }

  // ユーザー自身の「考えが変わった」と、歩き巫女への「前の説明と違う」を区別する。
  // 前者は矛盾として責めず最新の発言を採用し、後者だけ正本再確認の対象にする。
  function continuitySignal(history,currentMessage){
    var t=S(currentMessage);if(!t)return {type:'none',confidence:'low'};
    if(/(?:前と違う|さっきと違う|前に言ってたのと違う|さっき言ってたのと違う|言ってること(?:が)?違う|矛盾して(?:る|ない)|どっちが正しい|どちらが正しい)/.test(t))
      return {type:'assistant_conflict',confidence:'high',latestWins:false};
    if(/(?:さっき|前に|この前)(?:は|、|そう)?[^。！？]{0,50}(?:って言った|と言った|思ってた|思っていた|言ってた|言っていた)[^。！？]{0,30}(?:けど|けれど|が)[^。！？]{0,40}(?:やっぱり|今は|今回は)/.test(t)||
       /(?:やっぱり|やっぱ)[、\s]*[^。！？]{1,60}(?:にする|がいい|と思う|好き|嫌い|違う|かな|かも|だな)(?:[。！!\s]|$)/.test(t))
      return {type:'user_revision',confidence:'high',latestWins:true};
    if(/(?:前は|以前は)[^。！？]{2,70}(?:てた|ていた|だった|してた|していた|思ってた|好きだった|嫌いだった)[^。！？]{0,35}(?:けど|が|でも)[、\s]*(?:今は|最近は|今だと|今なら)/.test(t))
      return {type:'temporal_update',confidence:'high',latestWins:true};
    return {type:'none',confidence:'low'};
  }


  // 会話履歴の中でユーザー自身が明示した予定・約束を軽量に保持する。
  // ここで扱うのは「会話上そう言った」という記録だけで、実際のリマインダー作成や実行完了を意味しない。
  function planTimePhrase(text){
    var t=S(text),m=t.match(/(?:今日(?:中)?|今夜|今晩|明日|明後日|あさって|週末|今週|来週|再来週|来月|[月火水木金土日]曜(?:日)?|\d{1,2}月\d{1,2}日|\d{1,2}日|\d{1,2}時(?:\d{1,2}分)?|あとで|後で|そのうち)/);
    return m?m[0]:'';
  }
  function isPlanRecallCue(text){
    var t=S(text);if(!t)return false;
    return /(?:前に|さっき|この前)?(?:言ってた|話してた|決めた)?(?:予定|つもり|約束)(?:は|って)?(?:何|なんだっけ|何だっけ|どうだった|どうなった|覚えてる)|(?:何|なに)(?:する|やる)(?:って)?(?:言ってた|決めてた|予定だった)(?:っけ|かな)?|(?:明日|今夜|週末|来週)(?:は)?(?:何|なに)(?:する|やる)(?:って)?(?:言ってた|決めてた)?(?:っけ|かな)?|(?:あの|その|前の)?予定(?:って|は)?(?:どうなった|終わった|済んだ|完了した|まだある|残ってる)(?:っけ|かな|の)?/.test(t);
  }
  function isPlanCancellation(text){
    var t=S(text);if(!t)return false;
    return /(?:やっぱり|予定(?:を)?変更|予定変え|予定が変わ|予定なくな|キャンセル|延期).*(?:やめ|しない|延期|変更|別の日|なくな|キャンセル)|(?:明日|今夜|週末|来週).*(?:やめる|やらない|しない|延期する|変更する)/.test(t);
  }
  function explicitUserPlan(text){
    var t=S(text);if(!t||/[？?]/.test(t))return null;
    if(/(?:予定|日程|スケジュール|次の試合).*(?:教えて|知りたい|何|なに|いつ)/.test(t))return null;
    var strong=/(?:予定(?:だ|です|にしてる|にしている)|つもり(?:だ|です)?|ことにした|やることにした|することにした|約束(?:した|してる|している)|忘れないように(?:する|しないと))/.test(t);
    var timed=/(?:今日(?:中)?|今夜|今晩|明日|明後日|あさって|週末|今週|来週|再来週|来月|[月火水木金土日]曜(?:日)?|\d{1,2}月\d{1,2}日|\d{1,2}時|あとで|後で).{0,48}(?:する|やる|行く|見る|更新する|公開する|試す|確認する|直す|修正する|作る|送る|アップする|差し替える|差替える|休む|寝る|話す|続ける)(?:よ|ね|から|予定|つもり|ことにした|。|$)/.test(t);
    if(!strong&&!timed)return null;
    if(/^(?:カープ|試合|天気|ニュース).*(?:予定|日程)/.test(t))return null;
    return {text:t,time:planTimePhrase(t),kind:/約束/.test(t)?'commitment':'plan'};
  }
  function isPlanCompletion(text){
    var t=S(text);if(!t||/[？?]/.test(t))return false;
    return /(?:終わった|終えた|済んだ|すんだ|完了した|片付いた|片づいた|やり終えた|やってきた|できた|出来た|公開した|更新した|送った|アップした|差し替えた|差替えた)(?:よ|ね|ぞ|。|！|!|$)/.test(t);
  }
  function planActionFingerprint(text){
    var t=S(text)
      .replace(/(?:今日(?:中)?|今夜|今晩|明日|明後日|あさって|週末|今週|来週|再来週|来月|[月火水木金土日]曜(?:日)?|\d{1,2}月\d{1,2}日|\d{1,2}日|\d{1,2}時(?:\d{1,2}分)?|あとで|後で|そのうち)/g,'')
      .replace(/(?:予定(?:だ|です|にしてる|にしている)?|つもり(?:だ|です)?|ことにした|やることにした|することにした|約束(?:した|してる|している)?|忘れないように(?:する|しないと))/g,'')
      .replace(/(?:終わった|終えた|済んだ|すんだ|完了した|片付いた|片づいた|やり終えた|やってきた|できた|出来た)/g,'')
      .replace(/(?:する|やる|行く|見る|試す|確認する|直す|修正する|作る|休む|寝る|話す|続ける)$/,'')
      .replace(/[「」『』、,。.!！?？\s]/g,'');
    return t;
  }
  function planEventScore(plan,eventText){
    var a=planActionFingerprint(plan&&plan.text||''),b=planActionFingerprint(eventText||'');
    if(!a||!b)return 0;
    if(a===b)return 1;
    if(a.indexOf(b)>=0||b.indexOf(a)>=0)return Math.min(a.length,b.length)/Math.max(a.length,b.length)+0.35;
    return statementSimilarity(a,b);
  }
  function planLedger(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),list=[],start=Math.max(0,h.length-180),retracted=retractedMemoryIndexes(h,'');
    for(var i=start;i<h.length;i++){
      var x=h[i];if(!x||x.role!=='user')continue;
      var t=S(x.text);if(!t)continue;
      if(isPlanCancellation(t)){
        var tm=planTimePhrase(t),best=-1,bestScore=0;
        for(var r=list.length-1;r>=0;r--){
          if(list[r].status!=='active')continue;
          var sc=planEventScore(list[r],t)+(tm&&list[r].time===tm?1:0);
          if(sc>bestScore){bestScore=sc;best=r;}
        }
        if(best<0){for(var r2=list.length-1;r2>=0;r2--)if(list[r2].status==='active'){best=r2;break;}}
        if(best>=0){list[best].status=/延期/.test(t)?'postponed':'cancelled';list[best].closedBy=t;list[best].closedIndex=i;}
        continue;
      }
      if(isPlanCompletion(t)){
        var cbest=-1,cscore=0;
        for(var cr=list.length-1;cr>=0;cr--){
          if(list[cr].status!=='active')continue;
          var cs=planEventScore(list[cr],t);if(cs>cscore){cscore=cs;cbest=cr;}
        }
        // 十分に同じ行動だと確認できた時だけ完了扱い。単なる「できた」は勝手に結び付けない。
        if(cbest>=0&&cscore>=0.34){list[cbest].status='completed';list[cbest].closedBy=t;list[cbest].closedIndex=i;}
      }
      var p=explicitUserPlan(t);if(!p||retracted[i])continue;
      p.index=i;p.at=Number(x.at||0);p.entities=entityCandidatesFromText(t,domainFromHistoryItem(x)||'');p.status='active';p.closedBy='';p.closedIndex=-1;
      var key=C(p.text),duplicate=false;
      for(var j=list.length-1;j>=0;j--){if(C(list[j].text)===key&&list[j].status==='active'){duplicate=true;break;}}
      if(!duplicate)list.push(p);
      if(list.length>12)list.shift();
    }
    return list;
  }
  function planMemory(history,currentMessage){
    return planLedger(history,currentMessage||'').filter(function(x){return x&&x.status==='active';}).slice(-8);
  }
  function recallPlan(history,currentMessage){
    var t=S(currentMessage);if(!isPlanRecallCue(t))return null;
    var statusCue=/(?:どうなった|終わった|終えた|済んだ|完了|キャンセル|延期|まだ|残って)/.test(t);
    var list=statusCue?planLedger(history,t):planMemory(history,t);if(!list.length)return {found:false,candidates:[]};
    var tm=planTimePhrase(t),hits=tm?list.filter(function(x){return x.time===tm||x.text.indexOf(tm)>=0;}):list.slice(-4);
    if(!hits.length)hits=list.slice(-4);
    // 質問中に予定本文の語があれば優先する。
    hits=hits.map(function(x){return {x:x,score:planEventScore(x,t)+(x.status==='active'?0.05:0)};}).sort(function(a,b){return b.score-a.score||b.x.index-a.x.index;}).map(function(v){return v.x;});
    if(hits.length===1)return {found:true,plan:hits[0],candidates:hits};
    var s1=planEventScore(hits[0],t),s2=planEventScore(hits[1],t);
    if(s1>=0.34&&s1>s2+0.08)return {found:true,plan:hits[0],candidates:hits};
    return {found:true,ambiguous:true,plan:hits[0],candidates:hits.slice(0,4)};
  }

  // ユーザーが「自分で明言した」現在の選択・好みだけを会話履歴から整理する。
  // 推測した性格・嗜好は入れない。更新語がある時だけ古い同種レコードを置き換え扱いにする。
  function cleanPositionValue(v){
    var x=S(v).replace(/^(?:私は|わたしは|俺は|僕は|自分は|今は|今なら|今回は|結局|やっぱり|やっぱ|正直)[、,\s]*/,'');
    if(/(?:じゃなくて|ではなく|じゃなく|よりも)/.test(x))x=S(x.split(/(?:じゃなくて|ではなく|じゃなく|よりも)/).pop());
    if(/なら/.test(x))x=S(x.split(/なら/).pop());
    return x.replace(/^(?:やっぱり|やっぱ|今は|今回は|結局)[、,\s]*/,'').replace(/[「」『』]/g,'').trim();
  }
  function positionRevisionCue(text){
    var t=S(text);return /(?:やっぱり|やっぱ|今は|今なら|今回は|結局|前は.*(?:けど|が|でも).*今は|じゃなくて|ではなく|訂正|変更|変え(?:る|た)|にし直す|考え直した)/.test(t);
  }
  function explicitUserPosition(text){
    var t=S(text),m,value='';if(!t||/[？?]/.test(t))return null;
    // 「AとBどっちが好き？」のような質問や、他人の好みを述べる文は記憶しない。
    if(/(?:どっち|どれ|何|なに).*(?:好き|好み|選ぶ|選ん|にする|決め)/.test(t))return null;
    if(/(?:らしい|みたい|と言ってた|って言ってた|そうだ)/.test(t)&&!/(?:私は|わたしは|俺は|僕は|自分は)/.test(t))return null;

    m=t.match(/(.{1,58}?)(?:の方|のほう)?(?:が|は)(?:一番|いちばん)?(?:好き|好み)(?:だ|です|かな|かも|なんだ|なの)?(?:[。！!]|$)/);
    if(m){value=cleanPositionValue(m[1]);if(value)return {kind:'preference',polarity:'positive',value:value,text:t,revision:positionRevisionCue(t)};}
    m=t.match(/(.{1,58}?)(?:が|は)(?:嫌い|苦手)(?:だ|です|かな|かも|なんだ|なの)?(?:[。！!]|$)/);
    if(m){value=cleanPositionValue(m[1]);if(value)return {kind:'preference',polarity:'negative',value:value,text:t,revision:positionRevisionCue(t)};}
    m=t.match(/(.{1,64}?)(?:にする|でいく|に決めた|に決める|を選ぶ|を選んだ|を採用する|を採用した|にしようと思う|で進める)(?:[。！!]|$)/);
    if(m){value=cleanPositionValue(m[1]);if(value)return {kind:'decision',polarity:'selected',value:value,text:t,revision:positionRevisionCue(t)||/(?:決めた|採用した)/.test(t)};}
    m=t.match(/(.{1,58}?)(?:の方|のほう)?(?:が|は)(?:いい|良い)(?:と思う|かな|かも|な|です)?(?:[。！!]|$)/);
    if(m&&/(?:私は|わたしは|俺は|僕は|自分は|なら|やっぱ|今は|正直|と思う)/.test(t)){
      value=cleanPositionValue(m[1]);if(value)return {kind:'preference',polarity:'positive',value:value,text:t,revision:positionRevisionCue(t)};
    }
    return null;
  }
  function isPositionRecallCue(text){
    var t=S(text);if(!t)return false;
    var recall=/(?:前に|さっき|この前|以前|前は|結局).*(?:言ってた|言った|話してた|決めてた|選んでた|好きって|好みって)|(?:どっち|どれ|何|なに).*(?:好き|好み|にする|選ぶ|選んだ|決めた).*(?:言ってた|話してた|決めてた|っけ|かな)|(?:何|なに)(?:に|を)(?:する|選ぶ|決める)(?:って)?(?:言ってた|決めてた)?(?:っけ|かな)/.test(t);
    return recall;
  }
  function positionMemory(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),records=[],start=Math.max(0,h.length-180),retracted=retractedMemoryIndexes(h,'');
    for(var i=start;i<h.length;i++){
      var x=h[i];if(!x||x.role!=='user')continue;
      var p=explicitUserPosition(x.text);if(!p||retracted[i])continue;
      p.index=i;p.at=Number(x.at||0);p.status='active';p.replacedBy=-1;
      p.domain=domainFromHistoryItem(x)||domainFromText(p.text)||'';
      p.entities=entityCandidatesFromText(p.text,p.domain||'');
      if(p.revision){
        for(var r=records.length-1;r>=0;r--){
          var old=records[r];if(!old||old.status!=='active'||old.kind!==p.kind)continue;
          // 更新の明示がある時だけ、直前の同種判断を過去扱いにする。
          old.status='replaced';old.replacedBy=i;break;
        }
      }
      records.push(p);
      if(records.length>16)records.shift();
    }
    return records;
  }
  function recallPosition(history,currentMessage){
    var t=S(currentMessage);if(!isPositionRecallCue(t))return null;
    var all=positionMemory(history,t);if(!all.length)return {found:false,candidates:[]};
    var kind=/好き|好み|嫌い|苦手|どっちがいい|どれがいい/.test(t)?'preference':(/にする|選ぶ|選ん|決め/.test(t)?'decision':'');
    var wantsPast=/(?:前は|以前は|元々|もともと)/.test(t);
    var pool=all.filter(function(x){return (!kind||x.kind===kind)&&(wantsPast?x.status==='replaced':x.status==='active');});
    if(!pool.length&&wantsPast)pool=all.filter(function(x){return !kind||x.kind===kind;}).slice(0,-1);
    if(!pool.length)pool=all.filter(function(x){return !kind||x.kind===kind;});
    if(!pool.length)return {found:false,candidates:[]};

    var cueEntities=entityCandidatesFromText(t,domainFromText(t)||''),ranked=pool.map(function(x){
      var score=x.index/100000,cv=C(x.value);if(cv&&C(t).indexOf(cv)>=0)score+=20;
      (cueEntities||[]).forEach(function(e){var ev=C(e&&e.value);if(!ev)return;(x.entities||[]).forEach(function(pe){if(C(pe&&pe.value)===ev)score+=8;});});
      if(x.status==='active'&&!wantsPast)score+=2;
      return {x:x,score:score};
    }).sort(function(a,b){return b.score-a.score||b.x.index-a.x.index;});
    var top=ranked[0],second=ranked[1];
    if(second&&Math.abs(top.score-second.score)<0.01&&top.x.value!==second.x.value){
      return {found:true,ambiguous:true,position:top.x,candidates:ranked.slice(0,4).map(function(v){return v.x;})};
    }
    return {found:true,position:top.x,candidates:ranked.slice(0,4).map(function(v){return v.x;})};
  }

  function isMemoryRetractionCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:今の(?:は)?なし|さっきの(?:は)?なし|今言ったの(?:は)?なし|それ(?:は|も)?覚えなくていい|それ(?:は|も)?記憶しないで|今の(?:は)?忘れて|さっきの(?:は)?忘れて|忘れといて|忘れておいて)[。！!？?]*$/.test(t)||
      /(?:その|この|さっきの)?(?:予定|約束|好み|選択|決めたこと)(?:は|を)?(?:なしにして|忘れて|覚えなくていい|記憶しないで)/.test(t);
  }
  function retractedMemoryIndexes(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),map={},lastPlan=null,lastPosition=null,userSerial=0;
    for(var i=0;i<h.length;i++){
      var x=h[i];if(!x||x.role!=='user')continue;userSerial++;
      var t=S(x.text);if(!t)continue;
      if(isMemoryRetractionCue(t)){
        var target=null,maxAge=3;
        if(/予定|約束/.test(t)){target=lastPlan;maxAge=10;}
        else if(/好み|選択|決めたこと/.test(t)){target=lastPosition;maxAge=10;}
        else{
          if(lastPlan&&lastPosition)target=lastPlan.serial>lastPosition.serial?lastPlan:lastPosition;
          else target=lastPlan||lastPosition;
        }
        if(target&&userSerial-target.serial<=maxAge)map[target.index]=true;
        continue;
      }
      var pp=explicitUserPlan(t);if(pp)lastPlan={index:i,serial:userSerial};
      var pos=explicitUserPosition(t);if(pos)lastPosition={index:i,serial:userSerial};
    }
    return map;
  }

  function statementSimilarity(a,b){
    var x=C(a),y=C(b);if(!x||!y)return 0;
    if(x===y)return 1;if(x.indexOf(y)>=0||y.indexOf(x)>=0)return Math.min(x.length,y.length)/Math.max(x.length,y.length)+0.35;
    function grams(v){var o={};if(v.length<2){o[v]=1;return o;}for(var i=0;i<v.length-1;i++)o[v.slice(i,i+2)]=1;return o;}
    var gx=grams(x),gy=grams(y),inter=0,total=0,k;
    for(k in gx){total++;if(gy[k])inter++;}for(k in gy)if(!gx[k])total++;
    return total?inter/total:0;
  }
  function priorStatementReference(history,currentMessage){
    var t=S(currentMessage);if(!t)return null;
    var cue=/(?:前に|さっき|この前|以前)(?:[^。！？]{0,90})?(?:って|と)?(?:言ってた|言っていた|言った|話してた|話していた|言ってなかった|言ったよね|言ってたよね)|(?:前にも|さっきも)(?:そう|同じこと)(?:言ってた|言った)/.test(t);
    if(!cue)return null;
    var speaker='assistant';
    if(/(?:私|俺|僕|自分)(?:が|は)?.{0,40}(?:言ってた|言った|話してた)/.test(t))speaker='user';
    else if(/(?:歩き巫女|あなた|君|きみ|そっち)(?:が|は)?.{0,40}(?:言ってた|言った|話してた)/.test(t))speaker='assistant';
    var claimed='';
    var m=t.match(/(?:前に|さっき|この前|以前)(?:歩き巫女|あなた|君|きみ|私|俺|僕|自分)?(?:が|は)?[、,\s]*([^。！？]{2,90}?)(?:って|と)(?:言ってた|言っていた|言った|話してた|話していた|言ってなかった)/);
    if(m)claimed=S(m[1]).replace(/^(?:そう|同じこと)$/,'');
    var h=historyBeforeCurrent(history,t),best=null,bestScore=0;
    for(var i=h.length-1,seen=0;i>=0&&seen<80;i--){
      var x=h[i];if(!x||x.role!==speaker||!S(x.text))continue;seen++;
      var tx=S(x.text);if(!claimed){best={speaker:speaker,text:tx,index:i,score:0.5};break;}
      var sc=statementSimilarity(claimed,tx);
      if(sc>bestScore){bestScore=sc;best={speaker:speaker,text:tx,index:i,score:sc};}
    }
    if(best&&(!claimed||bestScore>=0.16))return {found:true,speaker:speaker,claimed:claimed,match:best.text,index:best.index,score:best.score};
    return {found:false,speaker:speaker,claimed:claimed,match:'',score:bestScore};
  }

  function isGeneralResumeCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:(?:じゃあ|では|さて)[、,\s]*)?(?:前回|この前)(?:の)?(?:話|続き)(?:から|を|に|へ)?(?:続け(?:よう|て)|話(?:そう|して)|戻(?:ろう|って|る|して))?[？?！!。]*$/.test(t)||
      /^(?:(?:じゃあ|では)[、,\s]*)?さっきの続き(?:から|を|に|へ)?(?:続け(?:よう|て)|話(?:そう|して))?[？?！!。]*$/.test(t)||
      /^(?:続きから|続き(?:を)?話そう|続き(?:を)?しよう|前回どこまで話した(?:っけ|かな)?|どこまで話した(?:っけ|かな)?)[？?！!。]*$/.test(t);
  }
  function isResumeNoise(text){
    var t=S(text);return /^(?:こんにちは|こんばんは|おはよう(?:ございます)?|ただいま|おかえり|ありがとう|ありがと|了解|わかった|分かった|またね|じゃあね|おやすみ|久しぶり|ひさしぶり)[。！!？?]*$/.test(t);
  }
  function restoreNaturalResume(history,currentMessage){
    if(!isGeneralResumeCue(currentMessage))return null;
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h,{limit:48});
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f||!S(f.userText)||isResumeNoise(f.userText)||isBackCue(f.userText)||isTopicChangeCue(f.userText)||isGeneralResumeCue(f.userText))continue;
      if(isPlanRecallCue(f.userText))continue;
      var b=frameAsBranch(f);if(!b||!b.message)continue;
      if(f.primary||f.domain||f.aspect||S(f.userText).length>=6)return {control:'back',restoreMessage:b.message,domain:b.domain||'',sourceText:b.sourceText||'',sourceIndex:b.index,branch:true,resume:true,aspect:b.aspect||'',primary:b.primary||null};
    }
    return null;
  }

  // 「あれ」「あの件」「そっちの話」など、人物名を含まない談話指示語を具体的な会話枝へ戻す。
  // 並行話題が複数残る「そっち」は勝手に一つへ決めない。
  function resolveDiscourseDeictic(text,history){
    var t=S(text);if(!t||t.length>72)return null;
    var m=t.match(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(あれ|あの件|あの話|さっきのやつ|前のやつ|その前のやつ|そっち|そっちの話|あっち|あっちの話)(.*)$/);
    if(!m)return null;
    var head=m[1],suffix=S(m[2]||''),h=historyBeforeCurrent(history,t);
    if(/^(?:そっち|あっち)/.test(head)){
      var ps=parallelTopics(h,t);
      if(ps.length>1)return {ambiguous:true,candidates:ps.map(function(x){return x.subject||x.message;}).filter(Boolean).slice(0,4),kind:'parallel_deictic'};
    }
    var branches=recentTopicBranches(h,t),depth=/その前/.test(head)?1:0;
    if(branches.length<=depth)return null;
    var b=branches[depth];
    if(!suffix||/^(?:は|って)?[？?！!。]*$/.test(suffix))suffix='について';
    var base=b.message||b.sourceText;
    if(!base)return null;
    if(/^の/.test(suffix)&&b.primary&&b.primary.value)base=b.primary.value;
    else if(/^について/.test(suffix)&&b.primary&&b.primary.value)base=b.primary.value;
    else suffix=suffix.replace(/^は[、,\s]*/,'');
    return {message:base+(suffix==='について'?'':(/^の|^について/.test(suffix)?suffix:('、'+suffix))),reference:b.primary||null,branch:b,kind:'discourse_deictic'};
  }

  // 「続きは後で話す」「もう一つあるけど後で」のような、ユーザー自身が置いた会話の伏線。
  // 内容を推測せず、どの会話枝に紐づいた未回収メモかだけを保持する。
  function isConversationHookCue(text){
    var t=S(text);if(!t)return false;
    return /(?:この話には|この件には|それには)?(?:まだ)?(?:続き|もう一つ|もうひとつ|別の話|話したいこと)(?:が)?(?:ある|あって).*(?:あとで|後で)|(?:あとで|後で)(?:話す|話したい|言う|教える|続き(?:を)?話す)|(?:続きは|もう一つは|もうひとつは)(?:あとで|後で)/.test(t);
  }
  function isResumeHookCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:(?:じゃあ|では|そういえば)[、,\s]*)?(?:さっき|前に|この前)(?:言ってた|言っていた|話してた|話していた)?(?:続き|もう一つ|もうひとつ|件|やつ|話)(?:に|へ)?(?:戻(?:ろう|って|る|して)|続け(?:よう|て)|話(?:そう|して))?[？?！!。]*$/.test(t)||
      /^(?:さっきの|前の)(?:続き|もう一つ|もうひとつ)(?:に|へ)?戻(?:ろう|って|る|して)[？?！!。]*$/.test(t);
  }
  function conversationHooks(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h,{limit:64}),stack=[];
    for(var i=0;i<frames.length;i++){
      var f=frames[i];if(!f||!S(f.userText))continue;
      var t=S(f.userText);
      if(isResumeHookCue(t)){if(stack.length)stack.pop();continue;}
      if(!isConversationHookCue(t))continue;
      var target=null;
      if(f.primary&&f.primary.value)target=frameAsBranch(f);
      if(!target){
        for(var j=i-1;j>=0;j--){if(frames[j]&&S(frames[j].userText)){target=frameAsBranch(frames[j]);break;}}
      }
      stack.push({sourceText:t,message:target&&target.message||'',domain:target&&target.domain||'',aspect:target&&target.aspect||'',primary:target&&target.primary||null,index:f.index});
      if(stack.length>5)stack.shift();
    }
    return stack;
  }
  function restoreConversationHook(history,currentMessage){
    var list=conversationHooks(history,currentMessage||'');if(!list.length)return null;
    var x=list[list.length-1];
    return {control:'back',restoreMessage:x.message||x.sourceText,domain:x.domain||'',sourceText:x.sourceText||'',sourceIndex:x.index,branch:true,hook:true,aspect:x.aspect||'',primary:x.primary||null};
  }

  function isParallelCue(text){
    var t=S(text);if(!t)return false;
    return /(?:両方|両方とも|どっちも|どちらも|それぞれ|並行(?:して)?|交互に).*(?:気になる|知りたい|話したい|進めたい|見たい|覚えて|追いたい)|(?:気になる|知りたい|話したい|進めたい).*(?:両方|どっちも|どちらも|それぞれ|並行)/.test(t);
  }
  function isResumeParallelCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:(?:じゃあ|では)[、,\s]*)?(?:もう片方|もう一方)(?:の)?(?:話|方|ほう)?(?:は|に|へ)?(?:戻(?:ろう|って|る|して)|続け(?:よう|て)|どう|教えて)?[？?！!。]*$/.test(t)||
      /^(?:(?:じゃあ|では)[、,\s]*)?(?:もうひとつ|もう一つ)の話(?:は|に|へ)?(?:戻(?:ろう|って|る|して)|続け(?:よう|て)|どう|教えて)?[？?！!。]*$/.test(t)||
      /^(?:並行してた|両方追ってた)(?:話|やつ)?(?:の)?(?:もう片方|もう一方|もうひとつ|もう一つ)(?:は|に|へ)?(?:戻(?:ろう|って|る|して)|続け(?:よう|て))?[？?！!。]*$/.test(t);
  }
  // 明示的に「両方/並行」と言われた時だけ、同じ発言に出た複数人物を並行スロットとして保持する。
  // 一般の「AとB」を勝手に並行タスクへしない。
  function parallelTopics(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h,{limit:48}),latest=null;
    for(var i=0;i<frames.length;i++){
      var f=frames[i];if(!f)continue;
      if(/(?:両方|並行|この二つ|この2つ)(?:の話)?(?:は|を)?(?:もう)?(?:いい|終わり|終わろう|やめよう|閉じよう)/.test(S(f.userText))){latest=null;continue;}
      if(!isParallelCue(f.userText))continue;
      var vals=entityValues(f.userEntities),uniq=[];
      vals.forEach(function(v){if(v&&uniq.indexOf(v)<0)uniq.push(v);});
      if(uniq.length<2)continue;
      latest=uniq.slice(0,4).map(function(v){
        var ent=(f.userEntities||[]).find(function(x){return x&&x.value===v;})||{};
        return {message:v+'について',subject:v,type:ent.type||'topic',domain:f.domain||'',aspect:f.aspect||'',sourceText:f.userText,index:f.index};
      });
    }
    return latest||[];
  }
  function restoreParallelTopic(history,currentMessage){
    var list=parallelTopics(history,currentMessage||'');if(list.length<2)return null;
    var recent=recentSubjects(historyBeforeCurrent(history,currentMessage||''),{limit:4}),current=recent.length?recent[0].value:'';
    var options=list.filter(function(x){return x.subject!==current;});
    if(options.length===1){
      var x=options[0];return {control:'back',restoreMessage:x.message,domain:x.domain||'',sourceText:x.sourceText||'',sourceIndex:x.index,branch:true,parallel:true,primary:{value:x.subject,type:x.type||'topic'}};
    }
    return {control:'back',restoreMessage:'',domain:'',sourceText:'',parallel:true,ambiguous:true,candidates:options.map(function(x){return x.subject;}).slice(0,4)};
  }

  // 「前の内容を直す」のか「同じ内容を言い換える」のか「情報を足すだけ」なのかを分ける。
  // 補足を訂正として扱って前の文脈を捨てないための会話信号。
  function utteranceRepair(history,currentMessage){
    var t=S(currentMessage);if(!t)return {type:'none',confidence:'low',preservePrevious:true};
    if(/^(?:訂正(?:すると|です|、|,)?|違う[、,\s]|いや[、,\s]*(?:違う|そうじゃなく)|言い間違えた|言い間違い|間違えた|正しくは|正確には).{1,}/.test(t)||/(?:じゃなくて|ではなくて|じゃなく|ではなく).{1,}/.test(t))
      return {type:'correction',confidence:'high',preservePrevious:false};
    if(/^(?:言い直すと|言い換えると|というより|ていうより|もう少し正確に言うと|正確に言うなら|要するに[、,]).{2,}/.test(t))
      return {type:'rephrase',confidence:'high',preservePrevious:true};
    if(/^(?:補足(?:すると|だけど|ですが)?|付け加えると|あと(?:もう一つ)?[、,]|それと[、,]|ちなみに[、,]).{2,}/.test(t))
      return {type:'supplement',confidence:'high',preservePrevious:true};
    return {type:'none',confidence:'low',preservePrevious:true};
  }

  // ユーザーがこの発言で実際に強調している「会話上の焦点」を読む。
  // 心理や本音は推測せず、質問・強調語・対比・繰り返し・発言末尾など観測できる手掛かりだけを使う。
  function focusClauses(text){
    var t=S(text).replace(/^(?:そういえば|ところで|それはそうと|話(?:は|を)?変(?:わる|える)(?:けど|が|と)?|話題(?:は|を)?変(?:わる|える)(?:けど|が|と)?|別件(?:だけど|ですが|なんだけど|で)?)[、,\s]*/,'');
    if(!t)return[];
    var first=t.split(/[。！？!?\n]+/).map(S).filter(Boolean),out=[];
    first.forEach(function(part){
      var pieces=part.split(/(?:、|,)\s*(?=(?:でも|ただ|それでも|とはいえ|特に|とくに|一番|いちばん|結局|やっぱり|その中でも|それが|そこが))/).map(S).filter(Boolean);
      pieces.forEach(function(piece){
        var m=piece.match(/^(.{3,}?)(?:けど|けれども|けれど|けどさ|けどね)[、,\s]*(.{3,})$/);
        // 「黒田は好きだけど…」の末尾の三点リーダーだけを“後半主張”として切り出さない。
        if(m&&/[一-龯々ぁ-んァ-ヶA-Za-z0-9]/.test(S(m[2]))){out.push({text:S(m[1]),contrast:false});out.push({text:S(m[2]),contrast:true});}
        else out.push({text:piece,contrast:/^(?:でも|ただ|それでも|とはいえ)/.test(piece)});
      });
    });
    return out.slice(0,8);
  }

  function isVagueFocusClause(text){
    var t=S(text);
    return /^(?:それ|これ|そこ|そういうの|そういうこと)(?:が|は|も)?(?:一番|いちばん|かなり|本当に|ほんとに)?(?:きつい|きつかった|つらい|つらかった|辛い|辛かった|大変|大変だった|嫌|いや|うれしい|嬉しい|よかった|良かった|気になる|引っかかる)(?:んだ|んだよ|んだよね|んだね|ね|よ)?$/.test(t);
  }

  function conversationalFocus(history,currentMessage){
    var t=S(currentMessage),clauses=focusClauses(t),ls=listeningSignals(history,t),h=historyBeforeCurrent(history,t);
    if(!t)return {text:'',concreteText:'',reason:'none',confidence:'low',flow:'respond',askPolicy:'optional',narrativeMomentum:false};
    if(!clauses.length)clauses=[{text:t,contrast:false}];

    var recent=recentSubjects(h,{limit:4}),hasQuestion=/[？?]/.test(t)||/(?:教えて|知りたい|どう思う|どうしたら|どうすれば|何|なに|誰|だれ|どこ|いつ|なぜ|なんで|どうして|どっち)/.test(t);
    var scored=clauses.map(function(x,idx){
      var c=S(x.text),score=0,reasons=[];
      if(!c)return {text:c,score:-99,reasons:[],idx:idx,contrast:!!x.contrast};
      score+=Math.min(3,Math.max(0,c.length-3)/12);
      var cq=/[？?]/.test(c)||/(?:教えて|知りたい|どう思う|どうしたら|どうすれば|何|なに|誰|だれ|どこ|いつ|なぜ|なんで|どうして|どっち)/.test(c);
      if(cq){score+=hasQuestion?9:5;reasons.push('question');}
      else if(hasQuestion)score-=3;
      if(/(?:一番|いちばん|特に|とくに|何より|なにより|結局|やっぱり|一番言いたい|問題は|困るのは|気になるのは|引っかかるのは)/.test(c)){score+=6;reasons.push('emphasis');}
      if(x.contrast||/^(?:でも|ただ|それでも|とはいえ)/.test(c)){score+=4;reasons.push('contrast');}
      if(/(?:つらい|辛い|しんどい|疲れた|最悪|嫌|いや|困った|悔しい|不安|心配|うれしい|嬉しい|最高|楽しい|助かった|成功|できた|完成|直った|公開|リリース|バグ|エラー|動かない|手こず|苦労|びっくり|驚いた)/.test(c)){score+=3;reasons.push('concrete_reaction');}
      if(/[0-9０-９]|(?:回|個|人|時間|分|件|日|週間|ヶ月|年)/.test(c)){score+=1.5;reasons.push('detail');}
      recent.forEach(function(r){
        var a=S(r&&r.value);if(a&&c.indexOf(a)>=0){score+=2.5;reasons.push('recent_subject');}
      });
      if(idx===clauses.length-1){score+=1.5;reasons.push('latest');}
      if(/^(?:まあ|うん|いや|なんか|とりあえず)[、,\s]/.test(c))score-=1;
      if(isVagueFocusClause(c))score-=2;
      return {text:c,score:score,reasons:reasons,idx:idx,contrast:!!x.contrast};
    }).sort(function(a,b){return b.score-a.score||b.idx-a.idx;});

    var best=scored[0]||{text:t,score:0,reasons:[],idx:0},concrete=S(best.text);
    if(isVagueFocusClause(concrete)&&best.idx>0){
      var prev=clauses[best.idx-1]&&S(clauses[best.idx-1].text);
      if(prev&&prev.length>=4){
        // 「それが一番きつかった」のような指示語なら、直前節のうち最後の具体部分を焦点として使う。
        var prevParts=prev.split(/[、,]/).map(S).filter(Boolean);
        concrete=prevParts.length?prevParts[prevParts.length-1]:prev;
      }
    }
    concrete=concrete.replace(/^(?:でも|ただ|それでも|とはいえ|特に|とくに|その中でも)[、,\s]*/,'').slice(0,100);

    var stance=conversationalStance(h,t),unfinished=unfinishedThoughtCue(t);
    var narrativeMomentum=unfinished || /(?:それで|それでさ|でさ|そしたら|そのあと(?:さ|ね)?|まだ(?:あって|続きがあって)|続きがある|聞いてよ|聞いてほしい)[…。、\s]*$/.test(t) ||
      (ls.openness==='open'&&!hasQuestion&&/(?:それで|まだ|続き|話したい|聞いて)/.test(t));
    var flow='respond',askPolicy='optional';
    var currentClosed=/もういい|十分|そこまで|興味(?:は)?ない|興味なくな|気にならない|もう気にならない|知りたくない/.test(t);
    var currentEngaged=!currentClosed&&/(?:もっと|さらに|もう少し|面白い|おもしろい|興味(?:ある|がある|深い)|気になる|掘りたい|深掘り)/.test(t);
    // 「興味は薄いけど必要なので教えて」のように明示依頼がある時は、閉じる語より依頼を優先する。
    if(ls.need==='advice'||ls.need==='opinion'||hasQuestion){flow='answer';askPolicy='none';}
    else if(ls.openness==='closed'||currentClosed){flow='close';askPolicy='none';}
    else if(ls.mode==='listen_only'||narrativeMomentum){flow='yield';askPolicy='none';}
    else if(stance.type==='correction'||stance.type==='disagreement'||stance.type==='skepticism'||stance.type==='partial_agreement'){flow='respond';askPolicy='none';}
    else if(ls.mode==='venting'||ls.mode==='mixed_sharing'||ls.mode==='sharing'||ls.mode==='celebration'||ls.mode==='uncertain'){flow='reflect';askPolicy='optional';}
    else{
      var sig=conversationSignals(h);
      if(currentEngaged||(sig&&sig.engagement==='engaged'&&Number(sig.engagementAge||99)<=3)){flow='expand';askPolicy='prefer_statement';}
    }

    return {
      text:S(best.text),
      concreteText:concrete,
      reason:(best.reasons||[]).join('+')||'latest_clause',
      confidence:best.score>=8?'high':best.score>=4?'medium':'low',
      score:Math.round(best.score*10)/10,
      flow:flow,
      askPolicy:askPolicy,
      narrativeMomentum:narrativeMomentum,
      unfinishedThought:unfinished,
      stance:stance.type||'neutral',
      stanceConfidence:stance.confidence||'low',
      pragmaticTone:(pragmaticTone(h,t).type||'neutral'),
      repairType:(utteranceRepair(h,t).type||'none'),
      explicitQuestion:hasQuestion,
      listeningMode:ls.mode||'conversation'
    };
  }

  function historyBeforeCurrent(history,current){
    var h=filterHistory(history),cur=C(current);
    while(h.length&&h[h.length-1]&&h[h.length-1].role==='system')h.pop();
    if(h.length&&h[h.length-1]&&h[h.length-1].role==='user'&&C(h[h.length-1].text)===cur)h.pop();
    return h;
  }

  function recentAssistantAnswers(history,limit){
    var h=filterHistory(history),out=[],n=Number(limit)||5;
    for(var i=h.length-1;i>=0&&out.length<n;i--){
      if(!h[i]||h[i].role!=='assistant')continue;
      var t=S(h[i].text);if(t)out.push(t);
    }
    return out;
  }

  function stablePick(list,seed,history){
    if(!list||!list.length)return'';
    var recent=recentAssistantAnswers(history,5).map(C);
    var candidates=list.filter(function(x){return recent.indexOf(C(x))<0;});
    if(!candidates.length&&recent.length){
      candidates=list.filter(function(x){return C(x)!==recent[0];});
    }
    if(!candidates.length)candidates=list.slice();
    seed=S(seed);var h=0;
    for(var i=0;i<seed.length;i++)h=((h<<5)-h+seed.charCodeAt(i))|0;
    return candidates[Math.abs(h)%candidates.length];
  }

  function naturalReaction(text,history){
    var t=S(text),c=C(t);
    if(!t||t.length>24)return null;

    var kind='';
    if(/^(?:違う|それは違う|違うと思う|そうは思わない|ちょっと違う|違う気がする)$/.test(c))kind='disagreement';
    else if(/^(?:そうかな|そうなのかな|本当かな|ほんとかな|どうだろう|うーん|んー|微妙)$/.test(c))kind='skepticism';
    else if(/^(?:まあそうだけど|確かにそうだけど|たしかにそうだけど|そうなんだけど|分かるけど|わかるけど)$/.test(c))kind='partial_agreement';
    else if(/^(?:なるほど|そうなんだ|そうなのか|そうか|そっか|そうだね|だよね|ふむ|ふむふむ|へえ|へー|ほう|確かに|たしかに|たしかにね|そういうことか|理解した|把握した)$/.test(c))kind='ack';
    else if(/^(?:いいね|それいいね|面白い|おもしろい|それ面白い|それおもしろい|それは面白い|それはおもしろい|それ面白いね|それおもしろいね|それは面白いね|それはおもしろいね|面白いね|おもしろいね|すごい|すげえ|それはすごい|さすが|おお|おー|興味深い|きょうみぶかい)$/.test(c))kind='positive';
    else if(/^(?:知らなかった|しらなかった|初めて知った|はじめて知った|そんなことあったんだ|そんなことがあったんだ|意外だね|いがいだね|意外だった|びっくり|びっくりした|驚いた|おどろいた)$/.test(c))kind='surprise';
    else if(/^(?:(?:昔|当時)は)?(?:そんなに|かなり|ずいぶん|相当)?(?:すごかった|強かった|有名だった|人気だった|活躍してた|活躍していた|大変だった|苦労した)(?:んだね|んですね|んだな|のか|んだ|んですねえ)?$/.test(c))kind='reflection';
    else if(/^(?:わかった|分かった|了解|りょうかい|おっけー|オッケー|ok)$/.test(c))kind='understood';
    if(!kind)return null;

    // 操作確認の「了解」等は会話反応で奪わない。main側でもpending時は早期雑談を止める。
    var h=historyBeforeCurrent(history,t);
    if(!h.length)return null;

    var lastAssistant='';
    for(var i=h.length-1;i>=0;i--){
      if(h[i]&&h[i].role==='assistant'&&S(h[i].text)){lastAssistant=S(h[i].text);break;}
    }
    if(!lastAssistant)return null;

    var domain=recentDomain(h),label='';
    if(domain==='carp')label='カープ';
    else if(domain==='counter')label='カウンター';
    else if(domain==='jinpo')label='陣法';
    else if(domain==='weather')label='天気';
    else if(domain==='kashin_name')label='家臣名付け';
    else if(domain==='tsukumo')label='九十九';
    else if(domain==='kishin')label='鬼神石';
    else if(domain==='madou')label='魔導結晶';

    var subject='',personAmbiguous=false;
    try{
      var personRef=findRecentEntity(h,{personOnly:true});
      personAmbiguous=!!(personRef&&personRef.ambiguous);
      if(personRef&&!personRef.ambiguous&&personRef.value)subject=personRef.value;
      // 同じ返答に人物が複数いる時は、感想だけから誰か一人を勝手に選ばない。
      if(!subject&&!personAmbiguous){
        var entityRef=findRecentEntity(h);
        if(entityRef&&!entityRef.ambiguous&&entityRef.value)subject=entityRef.value;
      }
    }catch(subjectErr){}

    var seed=t+'|'+lastAssistant.slice(0,120)+'|'+domain+'|'+subject;
    var answers;
    var domainAck={
      carp:[
        'そうなんですよ。カープの話は、選手や時代をたどっていくとどんどんつながってくるのです。',
        'そうなんですよ。カープは昔の話まで掘っていくと、いろいろつながって面白いのです。'
      ],
      counter:[
        'そうなんですよ。カウンターは章や相手を取り違えないように見るのが大事なのです。',
        'そういうことなのです。カウンターは同じ呼び方でも対象をきちんと分けて見る必要があるのですよ。'
      ],
      jinpo:[
        'そうなんですよ。陣法は条件を少し変えるだけでも結果が動くので、話しながら詰めるのが合っているのです。',
        'そういうことなのです。陣法は条件同士がつながっているので、一つずつ見ていくと分かりやすいのですよ。'
      ],
      weather:[
        'そうなんですよ。天気の続きなら、場所や日付だけ変えてそのまま聞いて大丈夫なのです。',
        'そういうことなのです。天気はこのまま地域や日付を変えて続けられるのですよ。'
      ],
      kashin_name:['そうなんですよ。名前は候補を見ながら少しずつ好みに寄せていくと選びやすいのです。'],
      tsukumo:['そうなんですよ。九十九は正本の数値を見ながら、そのまま条件を変えて比べられるのです。'],
      kishin:['そうなんですよ。鬼神石は正本の数値を基準に、そのまま比較していけるのです。'],
      madou:['そうなんですよ。魔導結晶は正本の数値を基準に、そのまま比較していけるのです。']
    };
    var domainPositive={
      carp:['ですよね。カープは逸話や選手同士のつながりまで入ると、さらに面白くなるのです。'],
      counter:['そこ、面白いところなのですよ。章や相手ごとの差まで見ると、かなり奥が深いのです。'],
      jinpo:['そこが陣法の面白いところなのですよ。条件を変えた時の動きまで見ると、かなり奥が深いのです。'],
      weather:['分かるのですよ。天気は日ごとの差を見ると意外と変化があって面白いのです。']
    };

    if(kind==='disagreement'){
      answers=subject?[
        'なるほど。「'+subject+'」のその点は、前の説明を押し通さずに捉え直します。',
        'そこは違うということですね。「'+subject+'」について、今の指摘を優先して見直します。'
      ]:[
        'なるほど、そこは同じ見方ではないんですね。前の説明を押し通さずに捉え直します。',
        '分かりました。そこは前の言い方に固執せず、いったん切り分けます。'
      ];
    }else if(kind==='skepticism'){
      answers=subject?[
        'そうかな、というところですね。「'+subject+'」のその点は、いったん断定せずに見ます。',
        'そこは少し引っかかりますよね。「'+subject+'」について、前の言い方をそのまま確定扱いしないでおきます。'
      ]:[
        'そうかな、というところですね。そこは断定せずに見たほうがよさそうです。',
        'うん、そこは少し引っかかるところですね。前の言い方をそのまま押し通さないでおきます。'
      ];
    }else if(kind==='partial_agreement'){
      answers=[
        'そこまでは同意だけど、後半には引っかかりがあるという感じですね。留保のほうも無視せず見ます。',
        '分かります。全部に同意というより、納得できる部分と違う部分があるということですね。'
      ];
    }else if(kind==='positive'){
      if(subject){
        answers=[
          'ですよね。「'+subject+'」の話として前後までつなげて見ると、さらに面白くなるのです。',
          '分かるのですよ。「'+subject+'」は、今の話の続きとしてもう少し掘ると見え方が広がるのです。',
          'そこ、面白いところなのですよ。「'+subject+'」を軸にすると話がつながりやすいのです。'
        ];
      }else{
        answers=domainPositive[domain]||[
          'ですよね。そこ、ちょっと面白いところなのです。',
          'ふふっ、そこに反応してもらえるとうれしいのですよ。',
          '分かるのですよ。そこはもう少し掘ってみたくなるところですね。'
        ];
      }
    }else if(kind==='surprise'){
      answers=subject?[
        '意外に感じますよね。「'+subject+'」の話としてつなげて見ると、印象が変わるところなのです。',
        'そうなんですよ。「'+subject+'」には、こうして続けて見ないと気づきにくい話もあるのです。',
        'そこは驚きますよね。「'+subject+'」の続きを追うと、前の話とのつながりも見えやすくなるのです。'
      ]:[
        '意外に感じますよね。こういうところは、前後の話までつなげると見え方が変わるのです。',
        'そうなんですよ。知っているつもりでも、掘ると初めて出てくる話があるのです。',
        'そこはちょっと驚くところですよね。'
      ];
    }else if(kind==='reflection'){
      answers=subject?[
        'そう感じますよね。今話していた「'+subject+'」は、当時の話と今を分けて見ると整理しやすいのです。',
        'そうなんですよ。「'+subject+'」を当時の文脈で見ると、今の印象とはまた違って見えるのです。',
        'ですよね。「'+subject+'」は、その時代の中で見ていくと話がつながりやすいのです。'
      ]:[
        'そう感じますよね。当時の話として見ると、今とはまた違った見え方になるのです。',
        'ですよね。昔の話は、その時代の流れまで見ると印象が変わるのです。',
        'そうなんですよ。今の感覚だけでなく、当時の文脈で見ると分かりやすいのです。'
      ];
    }else if(kind==='understood'){
      answers=[
        '了解なのですよ。続けましょう。',
        '分かりました。では、そのまま続けますね。',
        '了解です。次もそのままどうぞなのですよ。'
      ];
    }else{
      answers=domainAck[domain]||[
        'そうなんですよ。',
        'そういうことなのです。',
        'なるほど、という感じなのですよ。'
      ];
    }

    // 短いテンポで会話している相手には、相槌だけ急に長文化させない。
    // 内容の正確さや人格は変えず、返答量だけ自然に合わせる。
    var style=interactionStyle(h,t);
    if(style.pace==='terse'){
      if(kind==='understood')answers=['了解です。','わかりました。','はい、そのまま進めます。'];
      else if(kind==='disagreement')answers=['了解です。そこは捉え直します。','そこは違うんですね。押し通さず見直します。'];
      else if(kind==='skepticism')answers=['そこは断定しないで見ます。','うん、そこは少し引っかかりますね。'];
      else if(kind==='partial_agreement')answers=['なるほど、全部に同意というわけではないんですね。','そこは分けて見ます。'];
      else if(kind==='ack')answers=['そうなんです。','その理解で大丈夫です。','うん、そういうことです。'];
      else if(kind==='positive')answers=subject?['ですよね。「'+subject+'」、そこ面白いです。','「'+subject+'」のそこ、面白いところです。','分かります。「'+subject+'」はそこが面白いです。']:['ですよね。そこ面白いです。','分かります。そこ、いいところです。'];
      else if(kind==='surprise')answers=['そこは意外ですよね。','そうなんです。ちょっと驚くところです。'];
      else if(kind==='reflection')answers=['そう感じますよね。','当時の文脈で見ると印象が変わります。'];
    }
    return {handled:true,kind:kind,domain:domain,answer:stablePick(answers,seed,h)};
  }

  function stripCorrection(text){
    var t=S(text);
    var before=t;
    t=t.replace(
      /^(?:(?:そう|そっち|それ)(?:じゃ|では)?(?:ない|なくて|なく|違う)|(?:いや|いえ|違う|ちがう|訂正|ごめん|ごめんね|やっぱり|やっぱ))[、。,:：\s]*/,
      ''
    ).trim();
    return {text:t||before,corrected:t!==before};
  }

  function navigationCue(text){
    var t=S(text);
    // 「どこで取れる」は入手情報であり、ページ移動ではない。
    if(/どこで(?:取|と)れる|入手|手に入|取り方|とりかた/.test(t))return false;
    return /(?:ページ|サイト|リンク).*(?:開|見|行|案内|どこ)|(?:開いて|ひらいて|見せて|みせて|移動して|案内して|リンクちょうだい|リンク教えて)|(?:どこにある|どのページ)/.test(t);
  }

  function counterCue(text){
    return /カウンター|カウンタ|かうんたー|かうんた|かうん|counter/i.test(S(text));
  }

  function factCue(text){
    var t=S(text);
    if(counterCue(t))return true;
    if(/何位|順位|何番|なんばん|いくつ|数値|効果|倍率|上限|下限|必要数|何個|何人|誰|だれ|いつ|どれ|いくら|どのくらい|どれくらい/.test(t))return true;
    if(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/.test(t)&&/[？?]|は$|いくつ|高い|最大|トップ/.test(t))return true;
    if(/どこで(?:取|と)れる|入手|手に入|取り方|とりかた/.test(t))return true;
    return false;
  }

  function domainFromText(text){
    var t=S(text);
    if(/カープ|かーぷ|広島東洋|carp/i.test(t))return'carp';
    if(counterCue(t)||/天下統一奇譚|修羅の間|天下武技大会|二条城|桶狭間|比叡山|賤ヶ岳|封印/.test(t))return'counter';
    if(/九十九|つくも/.test(t))return'tsukumo';
    if(/鬼神石|きしん/.test(t))return'kishin';
    if(/魔導結晶|魔導|まどう/.test(t))return'madou';
    if(/家臣.*(?:名前|名付|命名)|(?:名前|名付|命名).*家臣/.test(t))return'kashin_name';
    if(/天気|気温|予報|降水|雨|雪|湿度|風速/.test(t))return'weather';
    if(/陣法|因縁|陣形|鶴翼|方円|魚鱗|衡軛|英傑|全MAX/.test(t))return'jinpo';
    if(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/.test(t)&&
       /高い|高め|強い|おすすめ|一番|最も|トップ|最大|重視|検索|探して|比較/.test(t))return'jinpo';
    return'';
  }

  function isWeakAssistantText(text){
    var t=S(text);
    return /ページはこちら|こちらから開け|入口がある|サイト内のページ案内|該当ページを開く/.test(t);
  }

  function domainFromHistoryItem(item){
    if(!item)return'';
    var d=domainFromText(item.text||'');
    if(d)return d;
    var mode=S(item.meta&&item.meta.mode||'');
    if(/カープ/.test(mode))return'carp';
    if(/カウンター|たいらの野望/.test(mode))return'counter';
    if(/陣法|検索結果|おすすめ陣法/.test(mode))return'jinpo';
    if(/天気/.test(mode))return'weather';
    if(/家臣.*(?:名前|名付)/.test(mode))return'kashin_name';
    if(/九十九/.test(mode))return'tsukumo';
    if(/鬼神石/.test(mode))return'kishin';
    if(/魔導/.test(mode))return'madou';
    return'';
  }

  function recentDomain(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-14;i--){
      if(!h[i])continue;
      var d=domainFromHistoryItem(h[i]);
      if(d)return d;
    }
    return'';
  }

  var ENTITY_STOP={
    '歩き巫女':1,'カープ':1,'広島東洋カープ':1,'陣法':1,'天気':1,'全MAX':1,
    '資料基準日':1,'正本資料':1,'正本':1,'候補':1,'選手':1,'監督':1,'投手':1,
    '野手':1,'家族':1,'親族':1,'試合':1,'結果':1,'順位':1,'今日':1,'明日':1,
    '昨日':1,'今回':1,'現在':1,'最新情報':1,'検索結果':1,'おすすめ':1,
    '代表例':1,'代表':1,'一例':1,'具体例':1,'例':1
  };

  function cleanEntityCandidate(v){
    var x=S(v)
      .replace(/^[「『【\[（(\s]+|[」』】\]）)\s]+$/g,'')
      .replace(/^(?:その中でも|中でも|特に|とくに|例えば|たとえば|なお|ちなみに)[、\s]*/,'')
      .replace(/(?:選手|監督|投手|野手|捕手|内野手|外野手|氏|さん|くん|ちゃん)$/,'')
      .trim();
    if(!x||x.length<2||x.length>30||ENTITY_STOP[x])return'';
    if(/^(?:そう|これ|それ|その|この|あの|ここ|そこ|どこ|もの|こと|ため|よう|感じ|内容|情報)$/.test(x))return'';
    if(/^[0-9０-９.,年月日時分秒\-\/]+$/.test(x))return'';
    return x;
  }

  function looksLikePersonName(v){
    var x=cleanEntityCandidate(v);if(!x)return false;
    // 一般トピックを「その人」の候補にしない。固有名詞らしい英字/漢字でも、
    // 開発・仕事・ゲーム等の語は会話上のtopicとして保持する。
    if(ENTITY_STOP[x]||/年|月|日|試合|球団|資料|情報|記録|成績|順位|逸話|歴史|カウンター|編集|運営|経営|開発|機能|検索|設定|サイト|動画|ゲーム|野球|仕事|会社|プログラム|コード|Firebase|Gemini|ChatGPT|JavaScript|CSS|AI$|編$|章$/i.test(x))return false;
    if(/^[一-龠々]{2,8}$/.test(x))return true;
    if(/^[ァ-ヶA-Za-z][ァ-ヶA-Za-z・ー.'’\- ]{2,28}$/.test(x))return true;
    return false;
  }

  function entityCandidatesFromText(text,domain){
    var t=S(text),out=[],seen={};
    function add(value,type,score){
      var x=cleanEntityCandidate(value);if(!x||seen[x])return;
      seen[x]=1;out.push({value:x,type:type||'topic',score:Number(score)||0});
    }

    // カープ正本が既に読込済みなら、955名索引を最優先の人物辞書として使う。
    try{
      if(window.JINPO_BOT_CARP_KNOWLEDGE&&typeof window.JINPO_BOT_CARP_KNOWLEDGE.foundNames==='function'){
        var names=window.JINPO_BOT_CARP_KNOWLEDGE.foundNames(t)||[];
        names.slice(0,4).forEach(function(name){add(name,'person',120);});
      }
    }catch(e){}

    // たいらの野望で取り違えやすい人物は明示的に人物として保持する。
    var knownPeople=t.match(/今川義元|今川氏真|足利義輝|足利義昭|織田信長|豊臣秀吉|徳川家康/g)||[];
    knownPeople.forEach(function(name){add(name,'person',115);});

    // 見出しは回答の主題になりやすい。「【江夏の21球】」などを拾う。
    var m,re=/【([^】]{2,30})】/g;
    while((m=re.exec(t)))add(m[1],looksLikePersonName(m[1])?'person':'topic',92);

    // 「○○選手」「○○監督」などは一般人物名として扱える。
    re=/([一-龠々ァ-ヶA-Za-z・ー.'’\-]{2,28})(?:選手|監督|投手|野手|捕手|内野手|外野手|氏|さん)(?=[はがの、。！？\s]|$)/g;
    while((m=re.exec(t)))add(m[1],'person',88);

    // 回答冒頭や文頭の「黒田博樹は」「新井貴浩について」のような主語。
    re=/(?:^|[\n。！？])\s*([一-龠々]{2,8}|[ァ-ヶA-Za-z][ァ-ヶA-Za-z・ー.'’\- ]{2,28})(?:は|が|について)/g;
    while((m=re.exec(t)))add(m[1],looksLikePersonName(m[1])?'person':'topic',78);

    // 一般テーマも会話グラフの主役として保持する。
    // 「サイト運営について話そう」「動画編集についてどう思う？」のような混在文字列を拾う。
    re=/(?:^|[\n。！？])\s*([^\n。！？、]{2,24}?)(?:について|の話)(?:を)?(?:教えて|知りたい|話そう|話したい|詳しく|どう思う|どうなの|しよう|する)?(?=[？?！!。\s]|$)/g;
    while((m=re.exec(t)))add(m[1],looksLikePersonName(m[1])?'person':'topic',76);

    // 「新井貴浩の家族」「黒田博樹の経歴」のような所有・観点表現。
    // 正本の人物索引がまだ遅延読込されていない起動直後でも主役を保持する。
    re=/(?:^|[\n。！？、])\s*([一-龠々]{2,8}|[ァ-ヶA-Za-z][ァ-ヶA-Za-z・ー.'’\- ]{2,28})の(?:家族|親族|経歴|成績|逸話|歴史|父|母|兄|弟|姉|妹|息子|娘|妻|夫)/g;
    while((m=re.exec(t)))add(m[1],'person',84);

    // 家族説明の「弟は新井良太」「父：○○」から、回答内の関係人物を拾う。
    re=/(?:父|母|兄|弟|姉|妹|息子|娘|妻|夫|配偶者|長男|次男|三男|長女|次女|三女)(?:は|が|[:：])\s*([一-龠々]{2,8}|[ァ-ヶA-Za-z][ァ-ヶA-Za-z・ー.'’\- ]{2,28})(?=[です、。！？\s]|$)/g;
    while((m=re.exec(t)))add(m[1],'person',86);

    // 引用された短い固有名詞も汎用の話題として保持する。
    re=/「([^」]{2,30})」/g;
    while((m=re.exec(t)))add(m[1],looksLikePersonName(m[1])?'person':'topic',70);

    out.sort(function(a,b){return b.score-a.score;});
    return out;
  }

  function findRecentEntity(history,opt){
    opt=opt||{};
    var h=filterHistory(history),wantPerson=!!opt.personOnly,limit=Number(opt.limit)||18;
    for(var i=h.length-1,age=0;i>=0&&age<limit;i--,age++){
      var item=h[i];if(!item||!S(item.text))continue;
      var d=domainFromHistoryItem(item)||recentDomain(h.slice(0,i+1));
      var list=entityCandidatesFromText(item.text,d).filter(function(x){return !wantPerson||x.type==='person';});
      if(!list.length)continue;

      // 同じ直近発言に人物が複数いる時、「その人」を片方へ決め打ちしない。
      if(wantPerson){
        var people=[];
        list.forEach(function(x){if(people.indexOf(x.value)<0)people.push(x.value);});
        if(people.length>1){
          return {ambiguous:true,candidates:people.slice(0,6),type:'person',domain:d||'',role:item.role||'',sourceText:S(item.text),index:i};
        }
      }

      return {value:list[0].value,type:list[0].type,domain:d||'',role:item.role||'',sourceText:S(item.text),index:i};
    }
    return null;
  }

  function aspectFromText(text){
    var t=S(text);if(!t)return'';
    if(/家族|親族|父|母|兄|弟|姉|妹|息子|娘|妻|夫|配偶者|子供|子ども/.test(t))return'family';
    if(/逸話|昔話|名場面|伝説|エピソード/.test(t))return'anecdote';
    if(/歴史|創設|沿革|昔の名前|由来/.test(t))return'history';
    if(/現在|今は|今どう|最近|最新|その後|それから/.test(t))return'current';
    if(/成績|打率|本塁打|ホームラン|打点|防御率|勝率|勝ち|セーブ|ホールド|記録/.test(t))return'stats';
    if(/経歴|所属|移籍|入団|退団|引退|現役|ドラフト/.test(t))return'career';
    if(/順位|何位|ゲーム差/.test(t))return'rank';
    if(/日程|予定|次の試合|対戦相手/.test(t))return'schedule';
    if(/結果|スコア|勝った|負けた|引き分け/.test(t))return'result';
    if(/比較|比べ|どっち|違い/.test(t))return'compare';
    if(/カウンター/.test(t))return'counter';
    // 人物・話題そのものを尋ねる「概要」。特定観点より後で判定し、
    // 「家族について教えて」などをoverviewへ潰さない。
    if(/について(?:教えて|知りたい|説明して|詳しく(?:教えて)?)|どんな(?:人|選手|人物|監督)|何者|(?:誰|だれ)(?:なの|ですか|だった)/.test(t))return'overview';
    return'';
  }

  function entityValues(list,type){
    var out=[];
    (Array.isArray(list)?list:[]).forEach(function(x){
      if(!x||!x.value||(type&&x.type!==type)||out.indexOf(x.value)>=0)return;
      out.push(x.value);
    });
    return out;
  }

  function choosePrimaryEntity(userEntities,assistantEntities,previousFrame,userText){
    var up=entityValues(userEntities,'person');
    if(up.length)return {value:up[0],type:'person',source:'user'};
    var ue=entityValues(userEntities);
    if(ue.length)return {value:ue[0],type:(userEntities.find(function(x){return x&&x.value===ue[0];})||{}).type||'topic',source:'user'};

    // 「その人」「その選手」「今はどう？」のような追質問は、前フレームの主役を継承する。
    if(previousFrame&&previousFrame.primary&&(
       /^(?:(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*)?(?:その人|この人|あの人|さっきの人|前の人|その選手|この選手|さっきの選手|前の選手|その監督|その投手|その野手|それ|これ|その件|その話|さっきの話|今の話|前の話|今は|現在は|その後|それから|もっと|詳しく)/.test(S(userText)) ||
       (aspectFromText(userText)&&S(userText).length<=24)
    )){
      return {value:previousFrame.primary.value,type:previousFrame.primary.type||'topic',source:'carry'};
    }

    var ap=entityValues(assistantEntities,'person');
    // 回答に一人だけ人物が出た時だけ、回答側から主役を補う。複数なら決め打ちしない。
    if(ap.length===1)return {value:ap[0],type:'person',source:'assistant'};
    var ae=entityValues(assistantEntities);
    if(ae.length===1)return {value:ae[0],type:(assistantEntities.find(function(x){return x&&x.value===ae[0];})||{}).type||'topic',source:'assistant'};
    return null;
  }

  // 会話を「ユーザー質問 + その回答」のフレームにまとめる。
  // 主役・分野・質問した観点・回答内に出た人物を分離し、直前回答の脇役を主語と誤認しにくくする。
  function topicFrames(history,opt){
    opt=opt||{};
    var h=filterHistory(history),frames=[],current=null;
    for(var i=0;i<h.length;i++){
      var item=h[i];if(!item||!S(item.text)||item.role==='system')continue;
      if(item.role==='user'){
        current={
          index:i,at:Number(item.at||0),userText:S(item.text),assistantText:'',
          domain:domainFromHistoryItem(item)||'',aspect:aspectFromText(item.text),
          userEntities:entityCandidatesFromText(item.text,domainFromHistoryItem(item)||''),
          assistantEntities:[],primary:null,secondaryPeople:[]
        };
        var prev=frames.length?frames[frames.length-1]:null;
        // 「それは知ってる」「そこは分かってる」は、直前に説明した観点を既知として保持する。
        // 以後の「他には？」で同じ観点へ戻りにくくする。
        if(!current.aspect&&prev&&prev.aspect&&/^(?:それ|そこ|その話)?(?:は|もう)?(?:知ってる|知っている|分かってる|わかってる|分かっている|わかっている)(?:よ|って|から)?[。！!？?]*$/.test(current.userText)){
          current.aspect=prev.aspect;
        }
        current.primary=choosePrimaryEntity(current.userEntities,[],prev,current.userText);
        if(!current.domain&&prev&&current.primary&&prev.primary&&current.primary.value===prev.primary.value)current.domain=prev.domain||'';
        frames.push(current);
      }else if(item.role==='assistant'){
        if(!current){
          current={index:i,at:Number(item.at||0),userText:'',assistantText:'',domain:domainFromHistoryItem(item)||'',aspect:'',userEntities:[],assistantEntities:[],primary:null,secondaryPeople:[]};
          frames.push(current);
        }
        current.assistantText+=(current.assistantText?'\n':'')+S(item.text);
        // 「前の話に戻ろう」のような制御発言はユーザー文だけでは観点が分からない。
        // 戻した直後の回答に明示された観点だけを補い、次の「さらに前へ」で枝を失わないようにする。
        if(!current.aspect&&isBackCue(current.userText)){
          var restoredAspect=aspectFromText(item.text);if(restoredAspect)current.aspect=restoredAspect;
        }
        var ad=domainFromHistoryItem(item)||'';
        if(!current.domain&&ad)current.domain=ad;
        current.assistantEntities=current.assistantEntities.concat(entityCandidatesFromText(item.text,current.domain||ad));
        if(!current.primary){
          var prevFrame=frames.length>1?frames[frames.length-2]:null;
          current.primary=choosePrimaryEntity(current.userEntities,current.assistantEntities,prevFrame,current.userText);
        }
        var pp=current.primary&&current.primary.value||'';
        current.secondaryPeople=entityValues(current.assistantEntities,'person').filter(function(x){return x!==pp;});
      }
    }
    var frameLimit=Math.max(8,Math.min(64,Number(opt.limit)||16));
    return frames.slice(-frameLimit);
  }

  function recentSubjects(history,opt){
    opt=opt||{};
    var frames=topicFrames(history),out=[],seen={};
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i],p=f&&f.primary;if(!p||!p.value)continue;
      if(opt.personOnly&&p.type!=='person')continue;
      var key=p.type+'|'+p.value;if(seen[key])continue;seen[key]=1;
      out.push({value:p.value,type:p.type||'topic',domain:f.domain||'',aspect:f.aspect||'',frameIndex:i,userText:f.userText||'',assistantText:f.assistantText||'',secondaryPeople:(f.secondaryPeople||[]).slice()});
      if(out.length>=(Number(opt.limit)||8))break;
    }
    return out;
  }

  function normalizeAnchor(v){
    return C(v).replace(/(?:選手|監督|投手|野手|さん|氏)$/,'');
  }

  function findSubjectByAnchor(history,anchor,opt){
    var a=normalizeAnchor(anchor);if(!a)return null;
    var list=recentSubjects(history,opt||{}),hits=[];
    list.forEach(function(x){
      var v=normalizeAnchor(x.value);
      if(v===a||v.indexOf(a)>=0||a.indexOf(v)>=0)hits.push(x);
    });
    if(hits.length===1)return hits[0];
    if(hits.length>1)return {ambiguous:true,candidates:hits.map(function(x){return x.value;}).slice(0,6)};
    return null;
  }

  function previousDistinctSubject(history,opt){
    var list=recentSubjects(history,opt||{});
    return {current:list[0]||null,previous:list[1]||null,list:list};
  }

  // 回答内に出た「主役以外の人物」を、話題移動用の脇役として保持する。
  // 直近フレームを優先し、同一人物の重複は除く。
  function recentSecondaryPeople(history,opt){
    opt=opt||{};
    var frames=topicFrames(history),out=[],seen={},limit=Number(opt.limit)||8;
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f)continue;
      var pp=f.primary&&f.primary.value||'';
      var people=Array.isArray(f.secondaryPeople)?f.secondaryPeople:[];
      for(var j=0;j<people.length;j++){
        var v=people[j];if(!v||v===pp||seen[v])continue;
        seen[v]=1;
        out.push({value:v,type:'person',domain:f.domain||'',aspect:f.aspect||'',frameIndex:i,primary:pp,userText:f.userText||'',assistantText:f.assistantText||''});
        if(out.length>=limit)return out;
      }
    }
    return out;
  }

  function latestSecondaryFrame(history,opt){
    opt=opt||{};
    var frames=topicFrames(history);
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f)continue;
      if(opt.aspect&&f.aspect!==opt.aspect)continue;
      var pp=f.primary&&f.primary.value||'';
      var people=(f.secondaryPeople||[]).filter(function(v){return v&&v!==pp;});
      var uniq=[];people.forEach(function(v){if(uniq.indexOf(v)<0)uniq.push(v);});
      if(uniq.length)return {frame:f,people:uniq};
    }
    return null;
  }

  function findPersonByAnchor(history,anchor){
    var a=normalizeAnchor(anchor);if(!a)return null;
    var pool=recentSubjects(history,{personOnly:true,limit:10}).concat(recentSecondaryPeople(history,{limit:10}));
    var hits=[],seen={};
    pool.forEach(function(x){
      if(!x||!x.value||seen[x.value])return;
      var v=normalizeAnchor(x.value);
      if(v===a||v.indexOf(a)>=0||a.indexOf(v)>=0){seen[x.value]=1;hits.push(x);}
    });
    if(hits.length===1)return hits[0];
    if(hits.length>1)return {ambiguous:true,candidates:hits.map(function(x){return x.value;}).slice(0,6)};
    return null;
  }

  function pairFromNamedAnchors(history,left,right){
    var a=findPersonByAnchor(history,left);
    var b=findPersonByAnchor(history,right);
    if(a&&a.ambiguous)return {ambiguous:true,candidates:a.candidates||[],side:'left'};
    if(b&&b.ambiguous)return {ambiguous:true,candidates:b.candidates||[],side:'right'};
    if(!a||!a.value||!b||!b.value||a.value===b.value)return null;
    return {left:a,right:b};
  }

  function relationPeopleFromFrame(frame,relation){
    if(!frame)return[];
    var pp=frame.primary&&frame.primary.value||'',people=(frame.secondaryPeople||[]).filter(function(v){return v&&v!==pp;});
    var text=S(frame.assistantText||''),out=[];
    if(!people.length||!text)return out;
    var aliases={
      '父':['父','父親','お父さん'], '母':['母','母親','お母さん'],
      '兄':['兄','兄貴','お兄さん'], '弟':['弟','弟さん'], '姉':['姉','お姉さん'], '妹':['妹','妹さん'],
      '息子':['息子','長男','次男','三男'], '娘':['娘','長女','次女','三女'],
      '妻':['妻','奥さん','夫人','配偶者'], '夫':['夫','旦那','配偶者'], '子供':['子供','子ども','子']
    };
    var words=aliases[relation]||[relation],scores={};
    function positions(hay,needle){
      var a=[],from=0,p;while((p=hay.indexOf(needle,from))>=0){a.push(p);from=p+Math.max(1,needle.length);}return a;
    }
    words.forEach(function(w){
      positions(text,w).forEach(function(wp){
        people.forEach(function(name){
          positions(text,name).forEach(function(np){
            var left=Math.min(wp,np),right=Math.max(wp+w.length,np+name.length);
            var between=text.slice(left,right);
            if(/[。！？\n]/.test(between))return;
            var after=np>=wp+w.length;
            var dist=after?(np-(wp+w.length)):(wp-(np+name.length)+12);
            if(dist<0||dist>36)return;
            if(scores[name]==null||dist<scores[name])scores[name]=dist;
          });
        });
      });
    });
    var ranked=Object.keys(scores).sort(function(a,b){return scores[a]-scores[b];});
    if(ranked.length){
      var best=scores[ranked[0]];
      // ほぼ同距離の候補が複数なら、関係を決め打ちしない。
      return ranked.filter(function(name){return scores[name]<=best+1;});
    }
    // 文構造が特殊な時だけ、同じ文に関係語と人物がいるかを保守的に見る。
    var sentences=text.split(/[。！？\n]/).filter(Boolean);
    sentences.forEach(function(sentence){
      if(!words.some(function(w){return sentence.indexOf(w)>=0;}))return;
      people.forEach(function(name){if(sentence.indexOf(name)>=0&&out.indexOf(name)<0)out.push(name);});
    });
    return out;
  }

  function askedHistory(history,limit){
    var frames=topicFrames(history),out=[],n=Number(limit)||6;
    for(var i=frames.length-1;i>=0&&out.length<n;i--){
      var f=frames[i];if(!f||!f.userText)continue;
      out.push({subject:f.primary&&f.primary.value||'',domain:f.domain||'',aspect:f.aspect||'',question:f.userText,index:f.index});
    }
    return out;
  }

  function subjectMemory(history){
    var frames=topicFrames(history),out=[],map={};
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i],p=f&&f.primary;if(!p||!p.value)continue;
      var key=(p.type||'topic')+'|'+p.value,m=map[key];
      if(!m){
        m=map[key]={subject:p.value,type:p.type||'topic',domain:f.domain||'',aspects:[],questions:[],lastAssistant:f.assistantText||'',lastIndex:f.index};
        out.push(m);
      }
      if(f.aspect&&m.aspects.indexOf(f.aspect)<0)m.aspects.push(f.aspect);
      if(f.userText&&m.questions.indexOf(f.userText)<0)m.questions.push(f.userText);
      if(!m.domain&&f.domain)m.domain=f.domain;
      if(!m.lastAssistant&&f.assistantText)m.lastAssistant=f.assistantText;
    }
    return out.slice(0,8);
  }


  // セッション内だけの会話傾向。個人属性を推測せず、ユーザーが実際に示した
  // 「そこは知っている」「もっと知りたい」「違う」などの会話上の信号だけを圧縮する。
  function conversationSignals(history){
    var h=filterHistory(history),frames=topicFrames(h),known=[],corrections=[],engagement='neutral',engagementAge=0,seenKnown={};
    var userCount=0,explicitDepth='',depthPersistent=false;

    // 「これからは短く/詳しく」のような継続指定は、100件履歴の範囲で最後の指定を保持する。
    for(var pi=h.length-1;pi>=0;pi--){
      var px=h[pi];if(!px||px.role!=='user')continue;
      var pt=S(px.text);if(!pt||!/(?:今後|これから|以降|これ以降)/.test(pt))continue;
      if(/短く|簡潔|簡単に|要点だけ/.test(pt)){explicitDepth='brief';depthPersistent=true;break;}
      if(/詳しく|深く|細かく|徹底的/.test(pt)){explicitDepth='deep';depthPersistent=true;break;}
    }

    for(var i=h.length-1;i>=0&&userCount<14;i--){
      var item=h[i];if(!item||item.role!=='user')continue;
      var t=S(item.text);if(!t)continue;
      userCount++;

      if(!explicitDepth&&/(?:短く|簡潔に|要点だけ).*(?:答えて|話して|お願い)/.test(t)){
        explicitDepth='brief';
      }else if(!explicitDepth&&/(?:詳しく|深く|細かく).*(?:答えて|話して|お願い)/.test(t)){
        explicitDepth='deep';
      }

      if(corrections.length<3&&/(?:違う|ちがう|そうじゃない|それじゃない|前と違|さっきと違|矛盾|間違|まちが)/.test(t)){
        corrections.push(t.slice(0,160));
      }

      if(engagement==='neutral'){
        // 「興味ない」「もう気にならない」は、語中に「興味」「気になる」があっても閉じる合図を優先する。
        if(/もういい|十分|そこまで|話変え|別の話|次の話|興味(?:は)?ない|興味なくな|気にならない|もう気にならない|知りたくない/.test(t)){engagement='closed';engagementAge=userCount;}
        else if(/もっと|他には|ほかには|続き|詳しく|面白い|おもしろい|興味(?:ある|がある|深い)|気になる|知りたい|初めて知った|知らなかった/.test(t)){engagement='engaged';engagementAge=userCount;}
      }
    }

    for(var j=frames.length-1;j>=0&&known.length<8;j--){
      var f=frames[j];if(!f||!f.userText)continue;
      if(!/(?:知ってる|知っている|分かってる|わかってる|分かっている|わかっている|既に知って|もう知って)/.test(f.userText))continue;
      var subject=f.primary&&f.primary.value||'';
      var aspect=f.aspect||'';
      var key=subject+'|'+aspect;
      if(seenKnown[key])continue;
      seenKnown[key]=1;
      known.push({subject:subject,aspect:aspect,text:S(f.userText).slice(0,160)});
    }

    return {
      engagement:engagement,
      engagementAge:engagementAge,
      known:known,
      corrections:corrections,
      depth:explicitDepth,
      depthPersistent:depthPersistent
    };
  }

  function graphNodeId(type,value){
    return String(type||'topic')+'|'+String(value||'');
  }

  // 会話内だけの関係を保持する軽量グラフ。
  // ここでは外部事実を推測せず、「質問した」「回答内に出た」「家族回答で弟として出た」
  // といった会話上で確認済みの接続だけを記録する。
  function conversationGraph(history){
    var frames=topicFrames(history),nodes=[],edges=[],nodeMap={},edgeMap={};

    function ensureNode(value,type,domain,index){
      if(!value)return null;
      type=type||'topic';
      var id=graphNodeId(type,value),n=nodeMap[id];
      if(!n){
        n=nodeMap[id]={id:id,subject:value,type:type,domain:domain||'',aspects:[],questions:[],lastQuestion:'',lastAssistant:'',lastIndex:Number(index)||0};
        nodes.push(n);
      }
      if(domain&&!n.domain)n.domain=domain;
      if(Number(index)>n.lastIndex)n.lastIndex=Number(index);
      return n;
    }
    function addEdge(from,to,relation,label,index){
      if(!from||!to||from.id===to.id)return;
      relation=relation||'mentioned';
      var key=from.id+'>'+to.id+'|'+relation;
      if(edgeMap[key])return;
      edgeMap[key]=1;
      edges.push({from:from.id,to:to.id,relation:relation,label:label||relation,lastIndex:Number(index)||0});
    }

    frames.forEach(function(f){
      if(!f)return;
      var p=f.primary&&f.primary.value?ensureNode(f.primary.value,f.primary.type||'topic',f.domain||'',f.index):null;
      if(p){
        if(f.aspect&&p.aspects.indexOf(f.aspect)<0)p.aspects.push(f.aspect);
        if(f.userText&&p.questions.indexOf(f.userText)<0)p.questions.push(f.userText);
        if(f.userText)p.lastQuestion=S(f.userText).slice(0,220);
        if(f.assistantText)p.lastAssistant=S(f.assistantText).slice(0,420);
      }

      var secondary=(f.secondaryPeople||[]).filter(Boolean);
      secondary.forEach(function(name){
        var sn=ensureNode(name,'person',f.domain||'',f.index);
        if(p)addEdge(p,sn,'mentioned','回答内で言及',f.index);
      });

      // 家族回答で関係語と人物が同じ文脈に結び付いた場合だけ、関係エッジを追加する。
      if(p&&f.aspect==='family'){
        ['父','母','兄','弟','姉','妹','息子','娘','妻','夫','子供'].forEach(function(rel){
          relationPeopleFromFrame(f,rel).forEach(function(name){
            var rn=ensureNode(name,'person',f.domain||'',f.index);
            addEdge(p,rn,'family:'+rel,rel,f.index);
          });
        });
      }

      // 比較質問でユーザー側に2人以上が明示されている時だけ比較接続を記録する。
      if(f.aspect==='compare'){
        var people=entityValues(f.userEntities,'person');
        for(var i=0;i<people.length;i++)for(var j=i+1;j<people.length;j++){
          addEdge(ensureNode(people[i],'person',f.domain||'',f.index),ensureNode(people[j],'person',f.domain||'',f.index),'compared','比較した',f.index);
        }
      }
    });

    nodes.sort(function(a,b){return b.lastIndex-a.lastIndex;});
    edges.sort(function(a,b){return b.lastIndex-a.lastIndex;});
    return {nodes:nodes.slice(0,24),edges:edges.slice(0,48)};
  }

  function memoryForSubject(history,subject){
    var a=normalizeAnchor(subject);if(!a)return null;
    var mem=conversationGraph(history).nodes||[],hits=[];
    mem.forEach(function(x){
      var v=normalizeAnchor(x.subject);
      if(v===a||v.indexOf(a)>=0||a.indexOf(v)>=0)hits.push(x);
    });
    return hits.length===1?hits[0]:null;
  }

  var ASPECT_LABELS={career:'経歴',stats:'成績',anecdote:'逸話',family:'家族',current:'現在',history:'歴史'};
  function nextUnaskedAspect(history,subject,domain){
    var mem=memoryForSubject(history,subject);if(!mem)return'';
    domain=domain||mem.domain||'';
    // 現時点では正本の観点分けが最も安定しているカープ人物を中心に広げる。
    // 他ドメインは既存の専門ルーターへ任せ、会話グラフが勝手に質問内容を作らない。
    var plan=domain==='carp'?['career','stats','anecdote','family','current']:[];
    if(!plan.length)return'';
    var seen=mem.aspects||[];
    for(var i=0;i<plan.length;i++)if(seen.indexOf(plan[i])<0)return plan[i];
    return'';
  }

  function genericOverviewAnchor(text){
    var t=S(text).replace(/[？?！!。]+$/,'').trim(),m;
    m=t.match(/^(.{1,32}?)(?:について|って)(?:教えて|知りたい|説明して|詳しく(?:教えて)?)$/);
    if(m)return S(m[1]);
    m=t.match(/^(.{1,24}?)(?:は|って)?どんな(?:人|選手|人物|監督)(?:なの|ですか|だった)?$/);
    if(m)return S(m[1]);
    return'';
  }

  // 同じ概要説明をそのまま繰り返す代わりに、まだ聞いていない観点へ自然に展開する。
  // 「もう一度」「最初から」など再説明を明示した場合は一切変換しない。
  function conversationGraphExpansion(text,history){
    var t=S(text);if(!t||t.length>80)return null;
    if(/もう一度|もう一回|改めて|あらためて|最初から|同じ説明|さっきの説明/.test(t))return null;
    var h=historyBeforeCurrent(history,t);if(!h.length)return null;

    var ref=null,reason='';
    if(isMoreCue(t)){
      var frames=topicFrames(h),last=frames.length?frames[frames.length-1]:null;
      // 逸話・家族など特定観点の直後の「他には？」は、その観点の続きを意味し得るため既存処理を優先。
      if(last&&last.aspect&&last.aspect!=='overview')return null;
      var recent=recentSubjects(h,{limit:1});
      if(recent.length)ref=recent[0];
      reason='more_after_overview';
    }else{
      var anchor=genericOverviewAnchor(t);if(!anchor)return null;
      ref=findSubjectByAnchor(h,anchor);
      if(!ref||ref.ambiguous||!ref.value)return null;
      var mem=memoryForSubject(h,ref.value);if(!mem)return null;
      // 概要をまだ聞いていないなら通常の概要質問をそのまま通す。
      if((mem.aspects||[]).indexOf('overview')<0)return null;
      reason='repeated_overview';
    }

    if(!ref||!ref.value)return null;
    var aspect=nextUnaskedAspect(h,ref.value,ref.domain||'');
    if(!aspect)return null;
    var label=ASPECT_LABELS[aspect]||'';if(!label)return null;
    return {
      message:ref.value+'の'+label+'について教えて',
      reference:ref,
      aspect:aspect,
      reason:reason,
      kind:'conversation_graph_expansion'
    };
  }

  function recentFrameByAspect(history,aspect){
    var frames=topicFrames(history);
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];
      if(f&&f.aspect===aspect&&f.primary&&f.primary.value)return f;
    }
    return null;
  }

  function workingMemory(history){
    var h=filterHistory(history),entity=findRecentEntity(h),person=findRecentEntity(h,{personOnly:true});
    var frames=topicFrames(h),subjects=recentSubjects(h,{limit:8}),people=recentSubjects(h,{personOnly:true,limit:8});
    return {
      domain:recentDomain(h),
      entity:entity,
      person:person,
      lastUser:lastSubstantiveUser(h),
      lastAssistant:recentAssistantAnswers(h,1)[0]||'',
      frames:frames,
      subjects:subjects,
      people:people,
      asked:askedHistory(h,8),
      subjectMemory:subjectMemory(h),
      signals:conversationSignals(h),
      interactionStyle:interactionStyle(h,''),
      graph:conversationGraph(h),
      hooks:conversationHooks(h,''),
      parallelTopics:parallelTopics(h,''),
      positions:positionMemory(h,''),
      continuity:continuitySignal(h,'')
    };
  }

  function multiTurnReference(text,history){
    var t=S(text);if(!t||t.length>100)return null;
    var h=historyBeforeCurrent(history,t),m,anchor,tail,ref,pair;
    if(!h.length)return null;

    // 「さっき聞いた家族の続きは？」のように、質問済みの観点から主役を呼び戻す。
    m=t.match(/^(?:じゃあ[、,\s]*)?(?:さっき|前に)(?:聞いた|聞いてた|話した|話してた)?(?:の)?(家族|親族|逸話|昔話|歴史|成績|経歴)(?:の)?(?:話|こと)?(?:の)?続き(?:は|って)?[？?！!。]*$/);
    if(m){
      var aspectMap={家族:'family',親族:'family',逸話:'anecdote',昔話:'anecdote',歴史:'history',成績:'stats',経歴:'career'};
      var af=recentFrameByAspect(h,aspectMap[m[1]]||'');
      if(af&&af.primary&&af.primary.value)return {message:af.primary.value+'の'+m[1]+'について、もう少し続けて',reference:{value:af.primary.value,type:af.primary.type||'topic',domain:af.domain||''},kind:'asked_aspect'};
    }

    // 「家族の話に戻って」「逸話に戻ろう」のように、観点だけで過去の枝へ戻る。
    m=t.match(/^(家族|親族|逸話|昔話|歴史|成績|経歴|現在)(?:の)?(?:話|こと)?(?:に|へ)?戻(?:って|ろう|る|して)(?:[、,\s]*(.*))?[？?！!。]*$/);
    if(m){
      var backAspectMap={家族:'family',親族:'family',逸話:'anecdote',昔話:'anecdote',歴史:'history',成績:'stats',経歴:'career',現在:'current'};
      var bf=recentFrameByAspect(h,backAspectMap[m[1]]||'');
      if(bf&&bf.primary&&bf.primary.value){
        var bt=S(m[2]||'');
        return {message:bf.primary.value+'の'+m[1]+'について'+(bt?'、'+bt:''),reference:{value:bf.primary.value,type:bf.primary.type||'topic',domain:bf.domain||''},kind:'aspect_back'};
      }
    }

    // 「さっき黒田の話で言ってた家族の方は？」のように、数ターン前の主役を名前で呼び戻す。
    m=t.match(/^(?:じゃあ[、,\s]*)?(?:さっき|前に|この前)(?:の)?(.{1,24}?)(?:の)?話(?:で)?(?:言ってた|言っていた|出てた|出ていた|話してた|話していた|触れてた|触れていた)?[、,\s]*(.+)$/);
    if(m){
      anchor=S(m[1]);tail=S(m[2]);
      ref=findSubjectByAnchor(h,anchor);
      if(ref&&ref.ambiguous)return {ambiguous:true,candidates:ref.candidates||[],kind:'named_history'};
      if(ref&&ref.value){
        tail=tail.replace(/^(?:その|この|あの)/,'').replace(/^(?:人|選手)の/,'');
        return {message:ref.value+'について、'+tail,reference:ref,kind:'named_history'};
      }
    }

    // 「黒田の話に戻って、家族は？」のような明示的な話題復帰。
    m=t.match(/^(.{1,24}?)(?:の)?話(?:に|へ)?戻(?:って|ろう|る|して)[、,\s]*(.+)$/);
    if(m){
      ref=findSubjectByAnchor(h,m[1]);
      if(ref&&ref.ambiguous)return {ambiguous:true,candidates:ref.candidates||[],kind:'named_back'};
      if(ref&&ref.value)return {message:ref.value+'について、'+S(m[2]),reference:ref,kind:'named_back'};
    }

    // 「前の二人ならどっち？」は、直近で主役だった別人物2人を比較する。
    if(/(?:前|さっき|今まで)(?:の)?(?:二人|2人)/.test(t)&&/(?:なら|どっち|どちら|比べ|比較|違い)/.test(t)){
      var recentPair=recentSubjects(h,{personOnly:true,limit:3});
      if(recentPair.length>=2){
        return {message:recentPair[0].value+'と'+recentPair[1].value+'を比較すると？',reference:recentPair[1],current:recentPair[0],kind:'recent_two_people_compare'};
      }
    }

    // 「その二人ってどういう関係？」は、直近の別人物2人を明示して専門知識側へ渡す。
    // 会話グラフは関係そのものを推測せず、対象人物の特定だけを担う。
    if(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(?:その|この|さっきの|前の)?(?:二人|2人)(?:って|は|の)?(?:どういう|どんな)?(?:関係|つながり|繋がり)(?:なの|ですか|だった|だったの)?[？?！!。]*$/.test(t)){
      var relationPair=recentSubjects(h,{personOnly:true,limit:3});
      if(relationPair.length>=2){
        return {message:relationPair[0].value+'と'+relationPair[1].value+'はどういう関係？',reference:relationPair[1],current:relationPair[0],kind:'recent_two_people_relation'};
      }
    }

    // 「黒田と新井なら？」のように、最近の会話に出た略称2人をフルネームへ戻して比較する。
    m=t.match(/^(.{1,18}?)(?:と|＆|&)(.{1,18}?)(?:(?:なら|だったら|ならば)(?:[、,\s]*(?:どっち|どちら)(?:が)?[^？?！!。]*)?|[、,\s]*(?:どっち|どちら)(?:が)?[^？?！!。]*)[？?！!。]*$/);
    if(m){
      var namedPair=pairFromNamedAnchors(h,m[1],m[2]);
      if(namedPair&&namedPair.ambiguous)return {ambiguous:true,candidates:namedPair.candidates||[],kind:'named_pair'};
      if(namedPair&&namedPair.left&&namedPair.right){
        return {message:namedPair.left.value+'と'+namedPair.right.value+'を比較すると？',reference:namedPair.right,current:namedPair.left,kind:'named_pair_compare'};
      }
    }

    // 「さっき出てきた別の人は？」は、回答内に一人だけ出た脇役人物へ話題を移す。
    if(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(?:さっき|前に|今)(?:の話で)?(?:出てきた|出てた|出ていた|名前(?:が)?出た|触れてた)?(?:別の|ほかの|他の|もう一人の?)(?:人|選手|人物)?(.*)$/.test(t)){
      var sec=latestSecondaryFrame(h);
      if(sec){
        if(sec.people.length>1)return {ambiguous:true,candidates:sec.people.slice(0,6),kind:'secondary_person'};
        var sm=t.match(/(?:人|選手|人物)(.*)$/),ss=S(sm&&sm[1]||'');
        if(!ss||/^(?:は|って)?[？?！!。]*$/.test(ss))ss='について';
        return {message:sec.people[0]+ss,reference:{value:sec.people[0],type:'person',domain:sec.frame.domain||''},kind:'secondary_person'};
      }
    }

    // 「その弟について詳しく」のように、家族回答で示された関係から人物を特定する。
    m=t.match(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(?:その|この|さっきの|前の)?(?:お)?(父|母|兄|弟|姉|妹|息子|娘|妻|夫|奥さん|旦那|配偶者|子供|子ども)(?:さん)?(?:の)?(?:人|方|人物)?(.*)$/);
    if(m){
      var rel=m[1],relKey=rel;
      if(rel==='奥さん')relKey='妻';else if(rel==='旦那')relKey='夫';else if(rel==='子ども')relKey='子供';
      var framesForRel=topicFrames(h);
      for(var rfi=framesForRel.length-1;rfi>=0;rfi--){
        var rf=framesForRel[rfi];if(!rf||rf.aspect!=='family')continue;
        var rp=relationPeopleFromFrame(rf,relKey);
        if(!rp.length)continue;
        if(rp.length>1)return {ambiguous:true,candidates:rp.slice(0,6),kind:'family_relation_person'};
        var rs=S(m[2]||'');if(!rs||/^(?:は|って)?[？?！!。]*$/.test(rs))rs='について';
        return {message:rp[0]+rs,reference:{value:rp[0],type:'person',domain:rf.domain||''},kind:'family_relation_person'};
      }
    }

    // 「その家族の人について詳しく」は、直近の家族回答で主役以外に出た人物へ移る。
    if(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(?:その|この|さっきの|前の)?(?:家族|親族)(?:の)?(?:人|方|人物)(.*)$/.test(t)){
      var fam=latestSecondaryFrame(h,{aspect:'family'});
      if(fam){
        if(fam.people.length>1)return {ambiguous:true,candidates:fam.people.slice(0,6),kind:'family_secondary_person'};
        var fm=t.match(/(?:人|方|人物)(.*)$/),fs=S(fm&&fm[1]||'');
        if(!fs||/^(?:は|って)?[？?！!。]*$/.test(fs))fs='について';
        return {message:fam.people[0]+fs,reference:{value:fam.people[0],type:'person',domain:fam.frame.domain||''},kind:'family_secondary_person'};
      }
    }

    // 「その前の選手と比べると？」は、今の主役と一つ前の別人物を比較する。
    if(/(?:その前|一つ前|ひとつ前|前に話してた|前に話した)(?:の)?(?:選手|人|監督|投手|野手)/.test(t)){
      pair=previousDistinctSubject(h,{personOnly:true});
      if(pair.previous){
        if(/比べ|比較|どっち|違い/.test(t)&&pair.current){
          return {message:pair.current.value+'と'+pair.previous.value+'を比較すると？',reference:pair.previous,current:pair.current,kind:'previous_person_compare'};
        }
        var rewritten=t.replace(/(?:その前|一つ前|ひとつ前|前に話してた|前に話した)(?:の)?(?:選手|人|監督|投手|野手)/,pair.previous.value);
        return {message:rewritten,reference:pair.previous,kind:'previous_person'};
      }
    }

    // 「さっきの選手と前の選手を比べて」のような二重参照。
    if(/(?:さっき|今)(?:の)?(?:選手|人).*(?:前|その前)(?:の)?(?:選手|人)/.test(t)&&/比べ|比較|どっち|違い/.test(t)){
      pair=previousDistinctSubject(h,{personOnly:true});
      if(pair.current&&pair.previous)return {message:pair.current.value+'と'+pair.previous.value+'を比較して',reference:pair.previous,current:pair.current,kind:'two_person_compare'};
    }

    return null;
  }

  function resolveEntityReference(text,history){
    var t=S(text);if(!t||t.length>64)return null;
    var h=historyBeforeCurrent(history,t),m,suffix,ref;

    m=t.match(/^(?:(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*)?(?:その人|この人|あの人|さっきの人|前の人|その選手|この選手|さっきの選手|前の選手|その監督|さっきの監督|その投手|その野手|彼)(.*)$/);
    if(m){
      suffix=S(m[1]);
      if(!suffix||/^(?:は|って)?[？?]?$|^(?:の|は|って|について|を|が|も|以外|以外の).+/.test(suffix)){
        ref=findRecentEntity(h,{personOnly:true});
        if(ref&&ref.ambiguous)return {ambiguous:true,candidates:ref.candidates||[],reference:ref,kind:'person'};
        if(ref&&ref.value)return {message:ref.value+(suffix||'について'),reference:ref,kind:'person'};
      }
    }

    m=t.match(/^(?:(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*)?(?:それ|これ|その件|この件|その話|この話|さっきの話|今の話|前の話|さっきの|今の|前の)(.*)$/);
    if(m){
      suffix=S(m[1]);
      // 「それいいね」等の感想は参照解決しない。
      if(suffix&&!/^(?:は|って)?[？?]?$|^(?:の|は|って|について|を|が|で|も|以外|以外の).+/.test(suffix))return null;
      ref=findRecentEntity(h);
      if(ref)return {message:ref.value+(suffix||'について'),reference:ref,kind:'entity'};
    }
    return null;
  }

  function lastSubstantiveUser(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-18;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var t=S(h[i].text);
      if(!t)continue;
      if(/^(?:もっと|詳しく|くわしく|なんで|なぜ|どうして|それ|これ|じゃあ|では|なら|順位|選手|明日|今日)[？?]?$/.test(t))continue;
      return t;
    }
    return'';
  }

  function shortFollowup(text){
    var t=S(text);
    return t.length>0&&t.length<=18;
  }

  function cleanFollowupTarget(text){
    var t=S(text)
      .replace(/^(?:じゃあ|では|なら|それじゃ|それなら|次は|つぎは)[、,\s]*/,'')
      .replace(/[？?！!。]+$/,'')
      .trim();
    t=t.replace(/(?:は|って|の方|のほう)$/,'').trim();
    return t;
  }

  function recentText(history,pattern,limit){
    var h=filterHistory(history),n=Number(limit)||20;
    for(var i=h.length-1;i>=0&&i>=h.length-n;i--){
      var t=S(h[i]&&h[i].text);
      if(t&&pattern.test(t))return t;
    }
    return'';
  }

  function recentCarpSubtopic(history){
    if(recentText(history,/逸話|昔話|名場面|伝説|他の逸話|別の逸話/,24))return'anecdote';
    if(recentText(history,/順位|何位|ゲーム差|勝率|何勝|何敗/,18))return'rank';
    if(recentText(history,/選手|メンバー|投手|野手|捕手|内野手|外野手|監督|コーチ/,18))return'players';
    if(recentText(history,/日程|予定|次の試合|今日(?:の)?試合|明日(?:の)?試合|明後日(?:の)?試合|試合ある|対戦相手/,18))return'schedule';
    if(recentText(history,/結果|スコア|勝った|勝って|負けた|負けて|引き分け|昨日(?:の)?試合|一昨日(?:の)?試合/,18))return'result';
    if(recentText(history,/歴史|創設|球団名|昔の名前/,18))return'history';
    return'';
  }

  function recentJinpoStatStyle(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-18;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var t=S(h[i].text);
      if(!t)continue;
      var stat=(t.match(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/)||[])[0]||'';
      if(!stat)continue;
      if(/高い|高め|強い|おすすめ|一番|最も|トップ|最大|重視/.test(t)){
        return {stat:stat,kind:'high'};
      }
    }
    return null;
  }

  function isMoreCue(text){
    return /^(?:もっと|他にも|ほかにも|他には|ほかには|別のも|別の|もう一つ|もう1つ|続き|つづき|まだある|ほかは)[？?！!。]*$/.test(S(text));
  }

  function recentCounterAmbiguity(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-10;i--){
      if(!h[i]||h[i].role!=='assistant')continue;
      var raw=String(h[i].text||'');
      if(/候補が複数/.test(raw)&&/場所か名前/.test(raw))return true;
    }
    return false;
  }

  function counterCandidateSelector(text){
    var t=S(text)
      .replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'')
      .replace(/[？?！!。]+$/,'')
      .trim();

    if(!t||t.length>40)return false;

    t=t
      .replace(/^(?:いや|違う|ちがう|そうじゃない|それじゃない|そっちじゃない|訂正|やっぱり|やっぱ|ごめん|すまん|まちがえた|間違えた)[、,\s]*/,'')
      .trim();
    var parts=t.split(/(?:じゃなくて|じゃなく|ではなくて|ではなく|でなくて|でなく)/);
    if(parts.length>=2)t=parts[parts.length-1].trim();

    if(/^(?:[1-6一二三四五六](?:番|番目|つ目)?|上から[1-6一二三四五六](?:番|番目|つ目)?|最初|一番上|上(?:のやつ|の方|のほう)?|真ん中|中(?:のやつ|の方|のほう)?|最後|一番下|下(?:のやつ|の方|のほう)?)$/.test(t))return true;

    if(/桶狭間|富士地下洞穴|武技大会|大会天|大会地|京都|二条城|修羅の間|封印/.test(t))return true;
    if(/今川義元|今川氏真|足利義輝|足利義昭|義元|氏真|義輝|義昭/.test(t))return true;

    return false;
  }

  function isCounterCandidateFollowup(text,history){
    return recentCounterAmbiguity(history)&&counterCandidateSelector(text);
  }

  function isToolDatasetDomain(domain){
    return domain==='tsukumo'||domain==='kishin'||domain==='madou';
  }

  function toolDatasetLabel(domain){
    if(domain==='tsukumo')return'九十九';
    if(domain==='kishin')return'鬼神石';
    if(domain==='madou')return'魔導結晶';
    return'';
  }

  function portableToolIntentFromText(text){
    var t=S(text),stat=(t.match(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/)||[])[0]||'';
    var num=0,m=t.match(/([0-9０-９]{1,4})\s*(?:番|ばん)(?!目)/);
    if(m){
      num=Number(m[1].replace(/[０-９]/g,function(c){
        return String.fromCharCode(c.charCodeAt(0)-0xFEE0);
      }))||0;
    }

    var top=0;
    m=t.match(/(?:トップ|top|上位)\s*([1-9１-９][0-9０-９]?)/i);
    if(m){
      top=Number(m[1].replace(/[０-９]/g,function(c){
        return String.fromCharCode(c.charCodeAt(0)-0xFEE0);
      }))||0;
    }

    var ranking=!!(stat&&/一番|いちばん|最大|最高|トップ|top|上位|高い|高め|強い/.test(t));
    if(ranking&&!top)top=1;

    if(stat)return {kind:ranking?'stat_ranking':'stat',stat:stat,top:top};
    if(num)return {kind:'number',number:num};
    return null;
  }

  function recentPortableToolIntent(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-18;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var d=domainFromText(h[i].text||'');
      if(!isToolDatasetDomain(d))continue;
      var intent=portableToolIntentFromText(h[i].text||'');
      if(intent){
        intent.domain=d;
        return intent;
      }
    }
    return null;
  }

  function isDatasetOnlySwitch(text,domain){
    if(!isToolDatasetDomain(domain))return false;

    var t=S(text)
      .replace(/^(?:じゃあ|では|なら|それじゃ|それなら|次は|つぎは)[、,\s]*/,'')
      .replace(/[？?！!。]+$/,'')
      .trim();

    if(domain==='tsukumo')t=t.replace(/九十九|つくも/g,'');
    if(domain==='kishin')t=t.replace(/鬼神石|きしん(?:せき)?/g,'');
    if(domain==='madou')t=t.replace(/魔導結晶|魔導|まどう(?:けっしょう)?/g,'');

    t=t.replace(/^(?:で|では|は|なら|だと|の場合|の方|のほう)+/,'')
       .replace(/(?:で|では|は|なら|だと|の場合|の方|のほう)+$/,'')
       .trim();

    // 今の入力に新しい条件が書かれているなら、古い条件を足さない。
    if(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/.test(t))return false;
    if(/[0-9０-９]+\s*(?:番|ばん|位)/.test(t))return false;
    if(/トップ|top|上位|一番|最大|最高|高い|高め|強い/.test(t))return false;
    if(/入手|どこで|取れる|取り方|詳細|全部|他の能力|ほかの能力/.test(t))return false;

    return t===''||/^(?:で|では|は|なら|だと|の場合|の方|のほう)*$/.test(t);
  }

  function carryExplicitToolDatasetSwitch(text,currentDomain,previousDomain,history){
    if(!isToolDatasetDomain(currentDomain))return'';
    if(!isToolDatasetDomain(previousDomain))return'';
    if(currentDomain===previousDomain)return'';
    if(!isDatasetOnlySwitch(text,currentDomain))return'';

    var intent=recentPortableToolIntent(history);
    if(!intent)return'';

    var label=toolDatasetLabel(currentDomain);
    if(intent.kind==='stat_ranking'){
      if(intent.top>1)return label+'で'+intent.stat+'トップ'+intent.top;
      return label+'で'+intent.stat+'一番高いのは？';
    }
    if(intent.kind==='stat')return label+'の'+intent.stat+'は？';
    if(intent.kind==='number')return label+intent.number+'番は？';
    return'';
  }

  function carryByDomain(text,domain,history){
    var t=S(text);
    if(!domain)return'';

    if(domain==='carp'){
      var ct=t.replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'');
      var ctCore=ct.replace(/は(?=[？?]?$)/,'');
      if(/^(?:順位|何位|なんい|選手|選手一覧|メンバー|日程|予定|結果|試合結果|先発|スタメン|打率|本塁打|防御率|誰がいる|逸話|他の逸話|別の逸話|昔話|歴史|名場面|伝説|スター|名選手)[？?]?$/.test(ctCore)){
        return'カープの'+ctCore;
      }
      var dayOnly=t.replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'');
      if(/^(?:今日|きょう|昨日|きのう|明日|あした|明後日|あさって|一昨日|おととい)(?:は)?[？?]?$/.test(dayOnly)){
        var subDay=recentCarpSubtopic(history);
        var dword=dayOnly.replace(/(?:は)?[？?]$/,'');
        if(subDay==='result')return'カープの'+dword+'の試合結果';
        return'カープの'+dword+'の試合';
      }

      if(isMoreCue(t)){
        var sub=recentCarpSubtopic(history);
        if(sub==='anecdote')return'カープの他の逸話';
        if(sub==='players')return'カープの選手をもう少し';
        if(sub==='history')return'カープの歴史をもう少し詳しく';
      }
    }

    if(domain==='counter'){
      // 候補一覧の続きは、候補選択エンジンへ生のまま渡す。
      if(isCounterCandidateFollowup(t,history))return t;

      if(!counterCue(t)&&shortFollowup(t)&&
         !/ページ|サイト|リンク|開いて|どこにある/.test(t)&&
         !/^(?:もっと|詳しく|なんで|なぜ|どうして)$/.test(t)){
        var target=cleanFollowupTarget(t);
        if(target&&target.length<=18){
          return target+'のカウンターは？';
        }
      }
    }

    if(domain==='jinpo'){
      var jt=cleanFollowupTarget(t);
      var stat=(jt.match(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/)||[])[0]||'';
      if(stat&&shortFollowup(t)&&!/陣形|因縁|英傑|全MAX/.test(t)){
        var prev=recentJinpoStatStyle(history);
        if(prev&&prev.kind==='high'&&!/高い|高め|一番|最も|トップ|最大|おすすめ|重視/.test(jt)){
          return stat+'高いの';
        }
      }
    }

    if(domain==='tsukumo'&&shortFollowup(t)&&!/九十九|つくも/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|取れる|とれる|取り方|トップ|一番|詳細|全部|他の能力|ほかの能力/.test(t))return'九十九の'+t;

    if(domain==='kishin'&&shortFollowup(t)&&!/鬼神石|きしん/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|取れる|とれる|取り方|トップ|一番|詳細|全部|他の能力|ほかの能力/.test(t))return'鬼神石の'+t;

    if(domain==='madou'&&shortFollowup(t)&&!/魔導|まどう/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|取れる|とれる|取り方|トップ|一番|詳細|全部|他の能力|ほかの能力/.test(t))return'魔導結晶の'+t;

    return'';
  }

  // 「今はどうなんだろう」「その後どうなった？」のような、
  // 主語を省いた自然な続き方を直前の回答側の人物・出来事へ接続する。
  function openEndedFollowup(text,history){
    var t=S(text);
    if(!t||t.length>36)return null;

    var kind='';
    if(/^(?:じゃあ[、,\s]*)?(?:今は|今だと|現在は|今現在は|今のところは|いまは)?(?:どうなんだろう|どうなんだろ|どうなの|どうなってる(?:の)?|どうなっている(?:の)?|どうなんですか|どうですか)[？?！!。]*$/.test(t) ||
       /^(?:じゃあ[、,\s]*)?(?:今|現在)(?:は)?[？?！!。]*$/.test(t))kind='current';
    else if(/^(?:じゃあ[、,\s]*)?(?:その後|それから|以後|そのあと)(?:は|って)?(?:どうなった(?:の)?|どうなってる(?:の)?|どうなったんだろう|どうだった(?:の)?|は)?[？?！!。]*$/.test(t))kind='after';
    if(!kind)return null;

    var h=historyBeforeCurrent(history,t);
    if(!h.length)return null;

    var person=findRecentEntity(h,{personOnly:true});
    if(person&&person.ambiguous){
      return {ambiguous:true,candidates:person.candidates||[],kind:kind};
    }

    // 人物に限定せず、見出し化された出来事・制度なども直前の主題として使う。
    var ref=findRecentEntity(h);
    if(!ref&&person&&person.value)ref=person;
    var target=ref&&ref.value?ref.value:'';
    if(!target){
      var ant=lastSubstantiveUser(h);
      if(ant)target=cleanFollowupTarget(ant);
    }
    if(!target)return null;

    return {
      message:kind==='current'
        ?target+'について、現在はどうなっている？'
        :target+'について、その後どうなった？',
      reference:ref||null,
      kind:kind
    };
  }

  function genericFollowup(text,history){
    var t=S(text),ant=lastSubstantiveUser(history);
    if(!ant)return'';

    var d=recentDomain(history);
    if(isMoreCue(t)){
      if(d==='carp'&&recentCarpSubtopic(history)==='anecdote')return'カープの他の逸話';
      return ant.replace(/[？?]$/,'')+'について、もう少し続けて';
    }

    if(/^(?:もっと|もう少し|詳しく|くわしく)[？?]?$/.test(t))
      return ant.replace(/[？?]$/,'')+'について、もう少し詳しく教えて';
    if(/^(?:なんで|なぜ|どうして)[？?]?$/.test(t))
      return ant.replace(/[？?]$/,'')+'について、なぜそうなるの？';
    if(/^(?:それは|それって|それ何|それなに)[？?]?$/.test(t))
      return ant.replace(/[？?]$/,'')+'について説明して';
    return'';
  }

  var BRANCH_ASPECT_LABELS={overview:'概要',family:'家族',anecdote:'逸話',history:'歴史',stats:'成績',career:'経歴',current:'現在',schedule:'日程',result:'結果',ranking:'順位',comparison:'比較',counter:'カウンター'};
  function branchMessage(frame){
    if(!frame)return'';
    var p=frame.primary&&frame.primary.value?S(frame.primary.value):'',a=S(frame.aspect),u=S(frame.userText);
    if(p){
      var label=BRANCH_ASPECT_LABELS[a]||'';
      if(label&&a!=='overview')return p+'の'+label+'について';
      return p+'について';
    }
    return u;
  }
  function recentTopicBranches(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h),out=[],seen={};
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f||!S(f.userText)||isBackCue(f.userText)||isTopicChangeCue(f.userText))continue;
      var p=f.primary&&f.primary.value?S(f.primary.value):'',a=S(f.aspect),d=S(f.domain);
      var key=p?((f.primary.type||'topic')+'|'+p+'|'+(a||'overview')):(d?('domain|'+d+'|'+C(f.userText)):'text|'+C(f.userText));
      if(!key||seen[key])continue;seen[key]=1;
      out.push({message:branchMessage(f),sourceText:S(f.userText),domain:d,aspect:a,primary:f.primary||null,index:f.index});
      if(out.length>=8)break;
    }
    return out;
  }

  function isDeferCue(text){
    var t=S(text);if(!t)return false;
    // 「続きは後で話す」はユーザーが自分で後から話す“伏線”であり、
    // 歩き巫女がその話題を保留して回答へ戻る指示とは分ける。
    if(isConversationHookCue(t))return false;
    return /(?:この話|その話|それ|これ|.+?の話|.+?について)?(?:は|を)?[、,\s]*(?:いったん|一旦)?(?:置いといて|置いておいて|置いとく|保留(?:にして|して)?|後回し(?:にして)?|あとで(?:にして|話そう|戻ろう)?|後で(?:にして|話そう|戻ろう)?)/.test(t);
  }

  function isResumeDeferredCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:(?:じゃあ|では|そろそろ)[、,\s]*)?(?:さっき|前に)?(?:保留(?:に)?した|保留してた|置いといた|置いてた|後回しにした|あとにした|後にした)(?:話|やつ|件)(?:に|へ)?(?:戻(?:ろう|って|る|して)|続け(?:よう|て)|話(?:そう|して))?[？?！!。]*$/.test(t) ||
      /^(?:保留中|保留してた)(?:の)?(?:話|やつ|件)(?:に|へ)?戻(?:ろう|って|る|して)[？?！!。]*$/.test(t);
  }

  function frameAsBranch(f){
    if(!f)return null;
    return {message:branchMessage(f),sourceText:S(f.userText),domain:S(f.domain),aspect:S(f.aspect),primary:f.primary||null,index:f.index};
  }

  function deferTargetFromText(text,priorFrames){
    var t=S(text),prefix=t.split(/(?:は|を)?[、,\s]*(?:いったん|一旦)?(?:置いといて|置いておいて|置いとく|保留(?:にして|して)?|後回し(?:にして)?|あとで|後で)/)[0]||'';
    prefix=S(prefix).replace(/^(?:じゃあ|では|その|この)[、,\s]*/,'').replace(/(?:この話|その話|それ|これ)$/,'');
    var aspect=aspectFromText(prefix);
    var entities=entityCandidatesFromText(prefix,domainFromText(prefix));
    var primary=entities.length?entities[0]:null;
    if(primary&&primary.value){
      var synthetic={userText:prefix,domain:domainFromText(prefix)||'',aspect:aspect||'',primary:primary,index:-1};
      return frameAsBranch(synthetic);
    }
    if(aspect){
      for(var ai=priorFrames.length-1;ai>=0;ai--){
        if(priorFrames[ai]&&priorFrames[ai].aspect===aspect&&priorFrames[ai].primary)return frameAsBranch(priorFrames[ai]);
      }
    }
    for(var i=priorFrames.length-1;i>=0;i--){
      var f=priorFrames[i];if(!f||!S(f.userText)||isBackCue(f.userText)||isTopicChangeCue(f.userText))continue;
      return frameAsBranch(f);
    }
    return null;
  }

  // 明示的に「後で」「保留」とされた話題だけをスタックとして復元する。
  // 会話履歴から毎回再構成するので、永続状態が壊れて古い保留が残ることを避ける。
  function deferredTopics(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h,{limit:48}),stack=[];
    for(var i=0;i<frames.length;i++){
      var f=frames[i];if(!f||!S(f.userText))continue;
      var t=S(f.userText);
      if(isResumeDeferredCue(t)){
        if(stack.length)stack.pop();
        continue;
      }
      if(!isDeferCue(t))continue;
      var target=deferTargetFromText(t,frames.slice(0,i));
      if(!target||!target.message)continue;
      var key=(target.primary&&target.primary.value||'')+'|'+(target.aspect||'')+'|'+target.message;
      for(var j=stack.length-1;j>=0;j--){
        var x=stack[j],xk=(x.primary&&x.primary.value||'')+'|'+(x.aspect||'')+'|'+x.message;
        if(xk===key)stack.splice(j,1);
      }
      stack.push(target);
      if(stack.length>6)stack.shift();
    }
    return stack;
  }

  function restoreDeferredTopic(history,currentMessage){
    var list=deferredTopics(history,currentMessage||'');if(!list.length)return null;
    var x=list[list.length-1];
    return {control:'back',restoreMessage:x.message||x.sourceText,domain:x.domain||'',sourceText:x.sourceText||'',sourceIndex:x.index,branch:true,deferred:true,aspect:x.aspect||'',primary:x.primary||null};
  }

  function isBackCue(text){
    return /^(?:話(?:を|に)?戻(?:そう|ろう|して|す|る)|前の話(?:に|へ)?戻(?:そう|ろう|して|る)?|さっきの話(?:に|へ)?戻(?:そう|ろう|して|る)?|その前の話(?:に|へ)?戻(?:そう|ろう|して|る)?|さらに前(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|る)?|(?:二つ|2つ|二個|2個)前(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|る)?|一個前(?:に)?戻(?:そう|ろう|して|る)?|元の話(?:に)?戻(?:そう|ろう|して|る)?|戻ろう|もどろう)[？?！!。]*$/.test(S(text));
  }

  function isTopicChangeCue(text){
    return /^(?:話(?:を)?変え(?:よう|たい|る)|話題(?:を)?変え(?:よう|たい|る)|別の話(?:にしよう|したい)?)[？?！!。]*$/.test(S(text));
  }

  function userTopicCandidates(history){
    var h=filterHistory(history),out=[];
    for(var i=h.length-1;i>=0&&i>=h.length-30;i--){
      var x=h[i];
      if(!x||x.role!=='user')continue;
      var t=S(x.text);
      if(!t||isBackCue(t)||isTopicChangeCue(t))continue;
      var d=domainFromText(t);
      if(!d)continue;
      if(out.some(function(y){return y.domain===d;}))continue;
      out.push({text:t,domain:d,index:i});
      if(out.length>=6)break;
    }
    return out;
  }

  function restorePreviousTopic(history,currentMessage){
    // まず同一ドメイン内の枝（例: 黒田の家族 → 新井の経歴）まで含めて戻す。
    var branches=recentTopicBranches(history,currentMessage||''),cue=S(currentMessage||''),depth=1;
    if(/^(?:その前|さらに前|(?:二つ|2つ|二個|2個)前)/.test(cue))depth=2;
    else if(/^元の話/.test(cue))depth=Math.max(1,branches.length-1);
    if(branches.length>depth){
      var b=branches[depth];
      return {control:'back',restoreMessage:b.message||b.sourceText,domain:b.domain||'',sourceText:b.sourceText,sourceIndex:b.index,branch:true,branchDepth:depth,aspect:b.aspect||'',primary:b.primary||null};
    }

    // 人物・話題フレームが作れない天気などは従来のドメイン単位へフォールバック。
    var list=userTopicCandidates(history);
    if(!list.length)return branches.length?{control:'back',restoreMessage:branches[0].message||branches[0].sourceText,domain:branches[0].domain||'',sourceText:branches[0].sourceText,sourceIndex:branches[0].index,branch:true}:null;

    var x=list.length>=2?list[1]:list[0];
    var message=x.text;

    if(x.domain==='carp'&&!/カープ|かーぷ|広島東洋|carp/i.test(message)){
      message='カープの'+message;
    }
    if(x.domain==='weather'&&!/天気|気温|予報|雨|雪/.test(message)){
      message=message+'の天気';
    }

    return {control:'back',restoreMessage:message,domain:x.domain,sourceText:x.text,sourceIndex:x.index};
  }

  function latestByDomain(history,domain){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];
      if(!x||x.role!=='user')continue;
      var t=S(x.text);
      if(domainFromText(t)===domain)return t;
    }
    return'';
  }


  function control(text,history){
    var t=S(text);

    var named='';
    if(/カープ.*(?:戻|もど)/.test(t))named='carp';
    else if(/天気.*(?:戻|もど)/.test(t))named='weather';
    else if(/(?:陣法|陣形).*(?:戻|もど)/.test(t))named='jinpo';
    else if(/カウンター.*(?:戻|もど)/.test(t))named='counter';
    else if(/家臣.*(?:戻|もど)/.test(t))named='kashin_name';

    if(named){
      var prev=latestByDomain(history,named);
      if(prev){
        if(named==='carp'&&!/カープ|かーぷ|広島東洋/i.test(prev))prev='カープの'+prev;
        return {control:'back',restoreMessage:prev,domain:named,sourceText:prev};
      }
    }

    if(isResumeHookCue(t)){
      var hr=restoreConversationHook(history,t);
      return hr||restoreNaturalResume(history,t)||{control:'back',restoreMessage:'',domain:'',sourceText:'',hook:true};
    }
    if(isGeneralResumeCue(t)){
      var nr=restoreNaturalResume(history,t);
      return nr||{control:'back',restoreMessage:'',domain:'',sourceText:'',resume:true};
    }
    if(isResumeParallelCue(t)){
      var pr=restoreParallelTopic(history,t);
      return pr||{control:'back',restoreMessage:'',domain:'',sourceText:'',parallel:true};
    }
    if(isResumeDeferredCue(t)){
      var dr=restoreDeferredTopic(history,t);
      return dr||{control:'back',restoreMessage:'',domain:'',sourceText:'',deferred:true};
    }
    if(isBackCue(t)){
      var r=restorePreviousTopic(history,t);
      return r||{control:'back',restoreMessage:'',domain:'',sourceText:''};
    }
    if(isTopicChangeCue(t)){
      return {control:'change',restoreMessage:'',domain:'',sourceText:''};
    }
    // 「ところで黒田は？」「そういえば別件だけど…」は、新しい発言そのものを止めずに
    // 古い質問待ちだけ破棄するソフトな話題転換として扱う。
    if(isExplicitTopicShift(t)){
      return {control:'soft_change',restoreMessage:'',domain:'',sourceText:t};
    }
    return null;
  }


  function compoundClauseScore(text){
    var t=S(text);if(!t)return 0;
    var score=0,d=domainFromText(t);
    if(d)score+=2;
    if(/[？?]/.test(t))score+=2;
    if(/(?:教えて|知りたい|調べて|見せて|見たい|探して|検索して|比較して|お願い|してほしい|して欲しい|どう|どこ|いつ|誰|だれ|何|なに|なぜ|なんで|順位|成績|逸話|歴史|家族|親族|現在|最新)/.test(t))score+=1;
    if(/^(?:こんにちは|こんばんは|おはよう|ありがとう|ありがと|了解|わかった|なるほど|そうなんだ)[。！!？?]*$/.test(t))score-=2;
    return score;
  }

  // 1発言に複数の依頼・質問がある時だけ、安全な境界で分割する。
  // 「腕力と耐久」「黒田と新井」のような同一条件・並列表現は分割しない。
  function splitCompoundIntents(text){
    var rawText=String(text==null?'':text);
    try{rawText=rawText.normalize('NFKC');}catch(e){}
    rawText=rawText.replace(/[\u3000\t]+/g,' ').replace(/ *\r?\n */g,'\n').trim();
    var original=S(rawText);if(!original||original.length<8||original.length>500)return [];
    var mark='\u241e',t=rawText;

    // 「〜を知りたいし、〜も教えて」のような依頼接続。
    t=t.replace(/((?:知りたい|教えて|調べて|見せて|見たい|探して|検索して|比較して|お願い|してほしい|して欲しい))\s*し[、,]?\s*/g,'$1'+mark);

    // 明示的に別件を足す接続語。文頭の「あと」は対象外。
    t=t.replace(/[、,]\s*(?:それと|それから|あと|ついでに|もう一つ|もう1つ)[、,\s]*/g,mark);
    t=t.replace(/\s+(?:それと|それから|ついでに)\s+/g,mark);

    // 疑問符・改行は強い発話境界。疑問符自体は前の節に残す。
    t=t.replace(/[？?]+\s*(?=\S)/g,function(m){return m.charAt(0)+mark;});
    t=t.replace(/\s*\n+\s*/g,mark);

    // 句点は両側が質問/依頼らしい時だけ後段の検証で採用する。
    t=t.replace(/。\s*(?=\S)/g,'。'+mark);

    var raw=t.split(mark).map(function(x){
      return S(x).replace(/^(?:それと|それから|ついでに|もう一つ|もう1つ)[、,\s]*/,'').replace(/^あと[、,\s]+/,'');
    }).filter(Boolean);
    if(raw.length<2||raw.length>4)return [];
    if(raw.some(function(x){return x.length<2;}))return [];

    var scored=raw.map(compoundClauseScore);
    var meaningful=scored.filter(function(x){return x>0;}).length;
    if(meaningful<2)return [];

    // 「こんにちは。今日は暑いね」のような単なる雑談2文は複合タスク扱いしない。
    if(scored.some(function(x){return x<=0;}))return [];

    // 同じ内容を句読点だけで重複させたケースは除外。
    var compact=raw.map(C),seen={};
    for(var i=0;i<compact.length;i++){
      if(seen[compact[i]])return [];
      seen[compact[i]]=1;
    }
    return raw;
  }

  function resolve(text,history,opt){
    var original=S(text);
    var priorHistory=historyBeforeCurrent(history,original);
    var correction=stripCorrection(original);
    var message=correction.text;
    var domain=domainFromText(message);
    var explicitTopicShift=isExplicitTopicShift(message);
    // 「ところで」「話変わるけど」など明示的な話題転換では、旧ドメインの省略補完を持ち込まない。
    var prevDomain=explicitTopicShift?'':recentDomain(priorHistory);
    var carried='',referenceClarification='',conversationExpansion=null;

    // 「あれ」「あの件」「そっちの話」のような談話指示語は、人物名ではなく具体的な会話枝から解決する。
    var discourseRef=resolveDiscourseDeictic(message,priorHistory);
    if(discourseRef&&discourseRef.ambiguous){
      referenceClarification='指している話題が複数あるのですよ。'+(discourseRef.candidates||[]).join('、')+'のどれか教えてください。';
    }else if(discourseRef&&discourseRef.message){
      message=discourseRef.message;
      domain=domainFromText(message)||(discourseRef.branch&&discourseRef.branch.domain)||domain||prevDomain;
      carried=message;
    }

    // 数ターン前の主役を明示/相対参照する表現を、直前指示語より先に解決する。
    var multiRef=!referenceClarification?multiTurnReference(message,priorHistory):null;
    if(multiRef&&multiRef.ambiguous){
      referenceClarification='前の話題に候補が複数あるのですよ。'+(multiRef.candidates||[]).join('、')+'のどれか、名前で教えてください。';
    }else if(multiRef&&multiRef.message){
      message=multiRef.message;
      domain=domainFromText(message)||(multiRef.reference&&multiRef.reference.domain)||domain||prevDomain;
      carried=message;
    }

    // 「その人」「その選手」「それはいつ？」などは、直前の回答側に出た対象も参照する。
    // 「封印編」のような属性語からdomainが先に付いても、指示語そのものは解決する。
    var entityRef=!referenceClarification&&!discourseRef?resolveEntityReference(message,priorHistory):null;
    if(entityRef&&entityRef.ambiguous){
      referenceClarification='「その人」が複数候補に当てはまるのですよ。'+(entityRef.candidates||[]).join('、')+'のどれか、名前で教えてください。';
    }else if(entityRef&&entityRef.message){
      message=entityRef.message;
      domain=domainFromText(message)||(entityRef.reference&&entityRef.reference.domain)||domain||prevDomain;
      carried=message;
    }

    // 主語を省いた「今はどう？」「その後は？」も、直前の回答内容へ接続する。
    if(!referenceClarification){
      var openFollow=openEndedFollowup(message,priorHistory);
      if(openFollow&&openFollow.ambiguous){
        referenceClarification='直前に人物が複数出ているのですよ。'+(openFollow.candidates||[]).join('、')+'のどれについて聞いているか、名前で教えてください。';
      }else if(openFollow&&openFollow.message){
        message=openFollow.message;
        domain=domainFromText(message)||(openFollow.reference&&openFollow.reference.domain)||domain||prevDomain;
        carried=message;
      }
    }

    // 同じ人物・話題の概要を再度聞かれた時は、会話グラフ上でまだ未質問の観点へ広げる。
    // 明示的な再説明要求や、逸話/家族など特定観点の「他には？」は既存経路を優先する。
    if(!referenceClarification){
      var graphExpansion=conversationGraphExpansion(message,priorHistory);
      if(graphExpansion&&graphExpansion.message){
        message=graphExpansion.message;
        domain=domainFromText(message)||(graphExpansion.reference&&graphExpansion.reference.domain)||domain||prevDomain;
        carried=message;
        conversationExpansion=graphExpansion;
      }
    }

    // 新しいデータ種別は今の発言を最優先。
    // ただし「じゃあ鬼神石では？」のように対象だけ切り替えた時は、
    // 直前の腕力/知力/トップN/番号など移植可能な条件だけ引き継ぐ。
    if(domain&&isToolDatasetDomain(domain)&&isToolDatasetDomain(prevDomain)&&domain!==prevDomain){
      var switched=carryExplicitToolDatasetSwitch(message,domain,prevDomain,priorHistory);
      if(switched){
        message=switched;
        carried=switched;
      }
    }

    if(!domain){
      if(prevDomain==='counter'&&isCounterCandidateFollowup(message,priorHistory)){
        carried=message;
        domain='counter';
      }else{
        carried=carryByDomain(message,prevDomain,priorHistory);
        if(carried){
          message=carried;
          domain=domainFromText(message)||prevDomain;
        }
      }
    }

    if(!carried){
      var generic=genericFollowup(message,priorHistory);
      if(generic){
        message=generic;
        domain=domainFromText(message)||prevDomain;
        carried=generic;
      }
    }

    var nav=navigationCue(message);
    var fact=factCue(message);

    var intent='conversation';
    if(nav)intent='navigation';
    else if(fact)intent='fact';
    else if(domain==='kashin_name')intent='task';
    else if(domain)intent='topic';

    return {
      original:original,
      message:message,
      corrected:correction.corrected,
      carried:!!carried,
      domain:domain||prevDomain||'',
      previousDomain:prevDomain,
      intent:intent,
      navigation:nav,
      fact:fact,
      referenceClarification:referenceClarification,
      conversationExpansion:conversationExpansion,
      planRecall:recallPlan(priorHistory,original),
      positionRecall:recallPosition(priorHistory,original),
      priorStatement:priorStatementReference(priorHistory,original)
    };
  }

  window.JINPO_BOT_CONVERSATION={
    version:VERSION,
    resolve:resolve,
    navigationCue:navigationCue,
    factCue:factCue,
    domainFromText:domainFromText,
    recentDomain:recentDomain,
    stripCorrection:stripCorrection,
    isWeakAssistantText:isWeakAssistantText,
    control:control,
    isBackCue:isBackCue,
    isTopicChangeCue:isTopicChangeCue,
    isExplicitTopicShift:isExplicitTopicShift,
    interactionStyle:interactionStyle,
    listeningSignals:listeningSignals,
    conversationalStance:conversationalStance,
    pragmaticTone:pragmaticTone,
    humorResponsePolicy:humorResponsePolicy,
    continuitySignal:continuitySignal,
    planTimePhrase:planTimePhrase,
    isPlanRecallCue:isPlanRecallCue,
    explicitUserPlan:explicitUserPlan,
    isPlanCompletion:isPlanCompletion,
    planLedger:planLedger,
    planMemory:planMemory,
    recallPlan:recallPlan,
    explicitUserPosition:explicitUserPosition,
    isPositionRecallCue:isPositionRecallCue,
    positionMemory:positionMemory,
    recallPosition:recallPosition,
    isMemoryRetractionCue:isMemoryRetractionCue,
    retractedMemoryIndexes:retractedMemoryIndexes,
    priorStatementReference:priorStatementReference,
    isGeneralResumeCue:isGeneralResumeCue,
    restoreNaturalResume:restoreNaturalResume,
    resolveDiscourseDeictic:resolveDiscourseDeictic,
    utteranceRepair:utteranceRepair,
    isConversationHookCue:isConversationHookCue,
    isResumeHookCue:isResumeHookCue,
    conversationHooks:conversationHooks,
    restoreConversationHook:restoreConversationHook,
    isParallelCue:isParallelCue,
    isResumeParallelCue:isResumeParallelCue,
    parallelTopics:parallelTopics,
    restoreParallelTopic:restoreParallelTopic,
    unfinishedThoughtCue:unfinishedThoughtCue,
    conversationalFocus:conversationalFocus,
    focusClauses:focusClauses,
    carriedListenIntent:carriedListenIntent,
    restorePreviousTopic:restorePreviousTopic,
    recentTopicBranches:recentTopicBranches,
    isDeferCue:isDeferCue,
    isResumeDeferredCue:isResumeDeferredCue,
    deferredTopics:deferredTopics,
    restoreDeferredTopic:restoreDeferredTopic,
    resetContext:resetContext,
    filterHistory:filterHistory,
    resetAt:resetAt,
    cleanFollowupTarget:cleanFollowupTarget,
    recentCarpSubtopic:recentCarpSubtopic,
    recentJinpoStatStyle:recentJinpoStatStyle,
    recentCounterAmbiguity:recentCounterAmbiguity,
    counterCandidateSelector:counterCandidateSelector,
    isCounterCandidateFollowup:isCounterCandidateFollowup,
    isToolDatasetDomain:isToolDatasetDomain,
    portableToolIntentFromText:portableToolIntentFromText,
    recentPortableToolIntent:recentPortableToolIntent,
    isDatasetOnlySwitch:isDatasetOnlySwitch,
    carryExplicitToolDatasetSwitch:carryExplicitToolDatasetSwitch,
    naturalReaction:naturalReaction,
    domainFromHistoryItem:domainFromHistoryItem,
    entityCandidatesFromText:entityCandidatesFromText,
    findRecentEntity:findRecentEntity,
    topicFrames:topicFrames,
    recentSubjects:recentSubjects,
    findSubjectByAnchor:findSubjectByAnchor,
    previousDistinctSubject:previousDistinctSubject,
    recentSecondaryPeople:recentSecondaryPeople,
    latestSecondaryFrame:latestSecondaryFrame,
    findPersonByAnchor:findPersonByAnchor,
    pairFromNamedAnchors:pairFromNamedAnchors,
    relationPeopleFromFrame:relationPeopleFromFrame,
    askedHistory:askedHistory,
    subjectMemory:subjectMemory,
    conversationSignals:conversationSignals,
    conversationGraph:conversationGraph,
    memoryForSubject:memoryForSubject,
    nextUnaskedAspect:nextUnaskedAspect,
    conversationGraphExpansion:conversationGraphExpansion,
    recentFrameByAspect:recentFrameByAspect,
    multiTurnReference:multiTurnReference,
    resolveEntityReference:resolveEntityReference,
    workingMemory:workingMemory,
    splitCompoundIntents:splitCompoundIntents,
    compoundClauseScore:compoundClauseScore,
    openEndedFollowup:openEndedFollowup
  };
})();
