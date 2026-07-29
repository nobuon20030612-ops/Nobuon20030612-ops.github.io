/*
 * 歩き巫女 共通会話ルーター v2.7.0
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
  var VERSION='2.7.0';
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
    var negative=/(?:つらい|辛い|しんどい|疲れた|最悪|落ち込|へこん|困った|嫌だった|いやだった|悲しい|かなしい|うまくいかない|失敗した|怒られた|ミスした|腹立つ|むかつく|悔しい|不安|心配|迷ってる|迷っている|忙しい|バタバタ|時間ない|手が回らない|めんどくさい|面倒くさい|バグ(?:った|出た|が出た)|エラー(?:が)?出た|動かない|壊れた)/.test(t);
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
    if(/^(?:なるほど|そうなんだ|そうなのか|そうか|そっか|そうだね|だよね|ふむ|ふむふむ|へえ|へー|ほう|確かに|たしかに|たしかにね|そういうことか|理解した|把握した)$/.test(c))kind='ack';
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

    if(kind==='positive'){
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
      else if(kind==='ack')answers=['そうなんです。','その理解で大丈夫です。','うん、そういうことです。'];
      else if(kind==='positive')answers=subject?['ですよね。「'+subject+'」、そこ面白いです。','そこ、面白いところです。']:['ですよね。そこ面白いです。','分かります。そこ、いいところです。'];
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
  function topicFrames(history){
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
    return frames.slice(-16);
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
    var h=filterHistory(history),frames=topicFrames(h),known=[],corrections=[],engagement='neutral',seenKnown={};
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
        if(/もっと|他には|ほかには|続き|詳しく|面白い|おもしろい|興味|気になる|知りたい|初めて知った|知らなかった/.test(t))engagement='engaged';
        else if(/もういい|十分|そこまで|話変え|別の話|次の話/.test(t))engagement='closed';
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
      graph:conversationGraph(h)
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

  function isBackCue(text){
    return /^(?:話(?:を|に)?戻(?:そう|して|す|る)|前の話(?:に|へ)?戻(?:そう|して|る)?|さっきの話(?:に|へ)?戻(?:そう|して|る)?|一個前(?:に)?戻(?:そう|して|る)?|元の話(?:に)?戻(?:そう|して|る)?|戻ろう|もどろう)[？?！!。]*$/.test(S(text));
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

  function restorePreviousTopic(history){
    var list=userTopicCandidates(history);
    if(!list.length)return null;

    var x=list.length>=2?list[1]:list[0];
    var message=x.text;

    if(x.domain==='carp'&&!/カープ|かーぷ|広島東洋|carp/i.test(message)){
      message='カープの'+message;
    }
    if(x.domain==='weather'&&!/天気|気温|予報|雨|雪/.test(message)){
      message=message+'の天気';
    }

    return {
      control:'back',
      restoreMessage:message,
      domain:x.domain,
      sourceText:x.text,
      sourceIndex:x.index
    };
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

    if(isBackCue(t)){
      var r=restorePreviousTopic(history);
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

    // 数ターン前の主役を明示/相対参照する表現を、直前指示語より先に解決する。
    var multiRef=multiTurnReference(message,priorHistory);
    if(multiRef&&multiRef.ambiguous){
      referenceClarification='前の話題に候補が複数あるのですよ。'+(multiRef.candidates||[]).join('、')+'のどれか、名前で教えてください。';
    }else if(multiRef&&multiRef.message){
      message=multiRef.message;
      domain=domainFromText(message)||(multiRef.reference&&multiRef.reference.domain)||domain||prevDomain;
      carried=message;
    }

    // 「その人」「その選手」「それはいつ？」などは、直前の回答側に出た対象も参照する。
    // 「封印編」のような属性語からdomainが先に付いても、指示語そのものは解決する。
    var entityRef=!referenceClarification?resolveEntityReference(message,priorHistory):null;
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
      conversationExpansion:conversationExpansion
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
    carriedListenIntent:carriedListenIntent,
    restorePreviousTopic:restorePreviousTopic,
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
