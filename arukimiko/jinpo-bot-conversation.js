/*
 * 歩き巫女 共通会話ルーター v1.8.0
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
  var VERSION='1.8.0';
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
    else if(/^(?:いいね|それいいね|面白い|おもしろい|それ面白い|それおもしろい|それは面白い|それはおもしろい|すごい|すげえ|それはすごい|さすが|おお|おー)$/.test(c))kind='positive';
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

    var seed=t+'|'+lastAssistant.slice(0,120)+'|'+domain;
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
      answers=domainPositive[domain]||[
        'ですよね。そこ、ちょっと面白いところなのです。',
        'ふふっ、そこに反応してもらえるとうれしいのですよ。',
        '分かるのですよ。そこはもう少し掘ってみたくなるところですね。'
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
    '昨日':1,'今回':1,'現在':1,'最新情報':1,'検索結果':1,'おすすめ':1
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
    if(ENTITY_STOP[x]||/年|月|日|試合|球団|資料|情報|記録|成績|順位|逸話|歴史|カウンター|編$|章$/.test(x))return false;
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

  function workingMemory(history){
    var h=filterHistory(history),entity=findRecentEntity(h),person=findRecentEntity(h,{personOnly:true});
    return {
      domain:recentDomain(h),
      entity:entity,
      person:person,
      lastUser:lastSubstantiveUser(h),
      lastAssistant:recentAssistantAnswers(h,1)[0]||''
    };
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
    return null;
  }

  function resolve(text,history,opt){
    var original=S(text);
    var correction=stripCorrection(original);
    var message=correction.text;
    var domain=domainFromText(message);
    var prevDomain=recentDomain(history);
    var carried='',referenceClarification='';

    // 「その人」「その選手」「それはいつ？」などは、直前の回答側に出た対象も参照する。
    // 「封印編」のような属性語からdomainが先に付いても、指示語そのものは解決する。
    var entityRef=resolveEntityReference(message,history);
    if(entityRef&&entityRef.ambiguous){
      referenceClarification='「その人」が複数候補に当てはまるのですよ。'+(entityRef.candidates||[]).join('、')+'のどれか、名前で教えてください。';
    }else if(entityRef&&entityRef.message){
      message=entityRef.message;
      domain=domainFromText(message)||(entityRef.reference&&entityRef.reference.domain)||domain||prevDomain;
      carried=message;
    }

    // 新しいデータ種別は今の発言を最優先。
    // ただし「じゃあ鬼神石では？」のように対象だけ切り替えた時は、
    // 直前の腕力/知力/トップN/番号など移植可能な条件だけ引き継ぐ。
    if(domain&&isToolDatasetDomain(domain)&&isToolDatasetDomain(prevDomain)&&domain!==prevDomain){
      var switched=carryExplicitToolDatasetSwitch(message,domain,prevDomain,history);
      if(switched){
        message=switched;
        carried=switched;
      }
    }

    if(!domain){
      if(prevDomain==='counter'&&isCounterCandidateFollowup(message,history)){
        carried=message;
        domain='counter';
      }else{
        carried=carryByDomain(message,prevDomain,history);
        if(carried){
          message=carried;
          domain=domainFromText(message)||prevDomain;
        }
      }
    }

    if(!carried){
      var generic=genericFollowup(message,history);
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
      referenceClarification:referenceClarification
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
    resolveEntityReference:resolveEntityReference,
    workingMemory:workingMemory
  };
})();
