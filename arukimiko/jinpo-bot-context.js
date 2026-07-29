/*
 * 歩き巫女 会話コンテキスト v2.7.0
 * 直前の会話を参照し、短い追答・指示語・不足スロットを保守的に補完する。
 * 推測し過ぎないことを優先し、確信できる場合だけ入力を補完する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_CONTEXT)return;
  var VERSION='2.7.0';

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function C(v){return S(v).toLowerCase().replace(/[\s、。,.!！?？「」『』（）()・〜~ー―…]/g,'');}
  function historyBeforeCurrent(history,current){
    var h=Array.isArray(history)?history.slice():[];
    while(h.length&&h[h.length-1]&&h[h.length-1].role==='system')h.pop();
    if(h.length&&h[h.length-1]&&h[h.length-1].role==='user'&&C(h[h.length-1].text)===C(current))h.pop();
    return h;
  }
  function lastOf(h,role){for(var i=h.length-1;i>=0;i--)if(h[i]&&h[i].role===role&&S(h[i].text))return h[i];return null;}
  function previousUserBefore(h,index){for(var i=index-1;i>=0;i--)if(h[i]&&h[i].role==='user'&&S(h[i].text))return h[i];return null;}
  function lastExchange(h){
    var ai=-1;for(var i=h.length-1;i>=0;i--)if(h[i]&&h[i].role==='assistant'&&S(h[i].text)){ai=i;break;}
    return {assistant:ai>=0?h[ai]:null,user:ai>=0?previousUserBefore(h,ai):lastOf(h,'user'),assistantIndex:ai};
  }
  function isAck(t){return /^(?:はい|うん|そう|そうです|そうだね|了解|わかった|分かった|ok|おけ|いいえ|いや|ちがう|違う|ありがとう|ありがと|なるほど)$/i.test(C(t));}
  function isFormation(t){return /^(?:衡軛|衝軛|鴻鵠|こうやく|コウヤク|鶴翼|かくよく|カクヨク|方円|ほうえん|ホウエン|魚鱗|ぎょりん|ギョリン)$/.test(S(t));}
  function hasExplicitWeather(t){return /天気|気温|天候|予報|降水|雨|雪|湿度|風速|最高気温|最低気温/.test(S(t));}
  function hasExplicitFx(t){return /為替|レート|ドル円|円ドル|米ドル|日本円|ユーロ|ポンド|JPY|USD|EUR|GBP|AUD|CAD|CHF|CNY/i.test(S(t));}
  function hasExplicitSiteIntent(t){return /陣形|因縁|腕力|耐久|器用|知力|魅力|生命|気合|土属性|水属性|火属性|風属性|英傑|配置|除外|差替|MAX|マックス|見聞録|鬼神石|転生|込み合計|検索条件|おすすめ検索|鶴翼|方円|魚鱗|衡軛|こうやく|文曲|発動因縁|検索結果/.test(S(t));}
  function looksLikeLocation(t){
    t=S(t);var c=C(t);
    if(!t||c.length<1||c.length>24||isAck(t))return false;
    if(/[？?！!]/.test(t)||/(教えて|調べて|検索|知りたい|どう|なに|何|誰|いつ|なぜ|おすすめ|好き|嫌い|疲れ|眠い|逸話|歴史|腕力|知力|耐久|器用|魅力|因縁|陣形)/.test(t))return false;
    if(/^(?:今日|きょう|明日|あした|現在|今|いま|昨日|きのう)$/.test(t))return false;
    if(/(?:都|道|府|県|市|区|町|村|郡|島|駅)$/.test(t))return true;
    if(/^(?:東京|広島|大阪|京都|名古屋|横浜|札幌|仙台|福岡|神戸|千葉|埼玉|奈良|沖縄|長崎|熊本|鹿児島|金沢|新潟|静岡|浜松|岡山|高松|松山|高知|大分|宮崎|青森|盛岡|秋田|山形|福島|宇都宮|前橋|水戸|長野|甲府|富山|福井|岐阜|津|大津|和歌山|鳥取|松江|山口|徳島|佐賀)$/.test(t))return true;
    return false;
  }

  function extractWeatherTime(t){return /明日|あした/.test(S(t))?'明日の':(/今日|きょう/.test(S(t))?'今日の':'');}
  function extractWeatherPlace(t){
    t=S(t).replace(/^(?:今日|きょう|明日|あした)(?:の)?/,'')
      .replace(/(?:の)?(?:今日|きょう|明日|あした)(?:の)?(?=(?:天気|気温|予報|降水|雨|雪|湿度|風速|最高気温|最低気温))/g,'')
      .replace(/(?:の|で)?(?:天気予報|天気|気温|天候|予報|降水確率|降水|湿度|風速|最高気温|最低気温).*/,'')
      .replace(/[？?！!。、\s]+$/g,'').trim();
    return t;
  }
  function findRecentWeather(h){
    for(var i=h.length-1;i>=0&&i>=h.length-20;i--){
      var x=h[i]&&S(h[i].text);if(!x)continue;
      if(hasExplicitWeather(x)){
        var p=extractWeatherPlace(x);return {text:x,place:p,time:extractWeatherTime(x)};
      }
    }
    return null;
  }
  function topicFromText(t){
    t=S(t);if(!t)return'';
    var x=t
      .replace(/^(?:それ|これ|その件|さっきの|今の|前の)(?:について|のこと)?[、\s]*/,'')
      .replace(/(?:について)?(?:を)?(?:教えて|調べて|検索して|知りたい|詳しく)(?:ください|ほしい)?[。？?]*$/,'')
      .replace(/(?:って|とは|は)(?:何|なに|誰|だれ|どこ|いつ|どういう意味|どういうこと)?[。？?]*$/,'')
      .replace(/[。！？!?]+$/g,'').trim();
    if(hasExplicitWeather(x)){var p=extractWeatherPlace(x);return p? p+'の天気':'天気';}
    if(x.length>60)return'';
    return x;
  }
  function findAntecedent(h){
    for(var i=h.length-1;i>=0&&i>=h.length-20;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var t=S(h[i].text);if(!t||isAck(t))continue;
      var tp=topicFromText(t);if(tp&&tp.length>=2)return tp;
    }
    return'';
  }
  function liveSubjectFromText(text){
    var t=S(text)
      .replace(/^(?:それ|これ|その件|さっきの|今の|前の)(?:について|のこと)?[、\s]*/,'')
      .replace(/(?:について)?(?:の)?(?:最新ニュース|ニュース|速報|最新情報|最新の情報|最近の情報|最近の話題|最近の動き|直近の情報|直近の話題|直近の動き|今日のニュース|今日の情報|今の情報|今の状況|現在の情報|現在の状況|今週の情報|今週の話題).*/,'')
      .replace(/(?:って|とは|は)(?:誰|だれ|何|なに|どんな|どういう).*/,'')
      .replace(/(?:について|のこと)?(?:を)?(?:教えて|調べて|検索して|知りたい|詳しく).*$/,'')
      .replace(/[？?！!。、]+$/g,'').replace(/の$/,'').trim();
    if(!t||t.length>60)return'';
    if(/^(?:今日|昨日|明日|最近|直近|最新|ニュース|情報|それ|これ|さっきの)$/.test(t))return'';
    if(!/[一-龠々〆ヵヶァ-ヶA-Za-z0-9]/.test(t))return'';
    return t;
  }

  function isGeneralLiveFollowup(text){
    return /^(?:(?:それ|これ|その件|さっきの|今の|前の)(?:は|って|について)?[、\s]*)?(?:最近どう(?:なの|ですか)?|今どうなって(?:る|いる)|今どう|最新は|最新情報は|何か変わった|なにか変わった|変化あった|動きあった)[？?！!。]*$/.test(S(text)) || /^(?:昨日から|きのうから)(?:何か|なにか)?(?:変わった|変化あった|動きあった)[？?！!。]*$/.test(S(text));
  }

  function findGeneralLiveAntecedent(h){
    for(var i=h.length-1;i>=0&&i>=h.length-20;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var raw=S(h[i].text);if(!raw||isGeneralLiveFollowup(raw)||isAck(raw))continue;
      var d=domainFromText(raw);
      if(d==='carp'||d==='weather'||d==='fx'||d==='jinpo'||d==='tairano')continue;
      var subject=liveSubjectFromText(raw);if(subject)return subject;
    }
    return'';
  }

  function stripCorrectionPrefix(t){
    t=S(t);
    // 「そうじゃなくて東京の天気」「違う、東京」のような言い直しを新しい要求として扱う。
    return t.replace(/^(?:(?:そう|そっち|それ)(?:じゃ|では)?(?:ない|なくて|なく|違う)|(?:いや|いえ|違う|ちがう|訂正|ごめん|ごめんね))[、。,:：\s]*/,'').trim();
  }
  function domainFromText(t){
    t=S(t);if(!t)return'';
    if(/広島(?:東洋)?(?:カープ|かーぷ)|カープ|かーぷ|\bcarp\b/i.test(t))return'carp';
    if(hasExplicitWeather(t))return'weather';
    if(hasExplicitFx(t))return'fx';
    if(hasExplicitSiteIntent(t))return'jinpo';
    if(/たいらの野望|鬼神石|九十九|魔導結晶|七星転生|家臣計算|能力計算|天下統一奇譚|二条城|富士地下洞穴|修羅の間|天下武技大会|封印|カウンター/.test(t))return'tairano';
    return'';
  }
  function recentDomain(h){
    var score={carp:0,weather:0,fx:0,jinpo:0,tairano:0};
    for(var i=h.length-1,age=0;i>=0&&age<12;i--,age++){
      if(!h[i]||!S(h[i].text))continue;
      var d=domainFromText(h[i].text);if(!d)continue;
      // 直近ほど強くする。ユーザー発言を少し優先。
      score[d]+=Math.max(1,12-age)+(h[i].role==='user'?3:0);
    }
    var best='',bs=0;Object.keys(score).forEach(function(k){if(score[k]>bs){bs=score[k];best=k;}});
    return bs>=6?best:'';
  }
  function isShortFollowup(t){
    t=S(t);if(!t||t.length>24)return false;
    if(/[。！!]/.test(t))return false;
    return true;
  }

  function isMoreCue(t){
    return /^(?:もっと|他にも|ほかにも|他には|ほかには|別のも|別の|もう一つ|もう1つ|続き|つづき|まだある|ほかは)[？?！!。]*$/.test(S(t));
  }

  function recentContains(h,re,limit){
    limit=Number(limit)||20;
    for(var i=h.length-1;i>=0&&i>=h.length-limit;i--){
      var t=S(h[i]&&h[i].text);
      if(t&&re.test(t))return true;
    }
    return false;
  }
  function carryDomain(original,h){
    var t=S(original),d=recentDomain(h);
    if(!d||!isShortFollowup(t)||domainFromText(t))return null;

    var clean=t
      .replace(/^(?:じゃあ|では|なら|それじゃ|それなら|次は)[、,\s]*/,'')
      .replace(/[？?！!。]+$/,'')
      .replace(/(?:は|って)$/,'')
      .trim();

    if(d==='carp'){
      if(/^(?:順位|何位|選手|選手一覧|メンバー|投手|野手|捕手|内野手|外野手|監督|コーチ|日程|予定|次|次の試合|結果|試合結果|先発|スタメン|ニュース|最近|今|今日|明日|打率|本塁打|ホームラン|打点|防御率|セーブ|ホールド|誰いる|だれいる|誰がいる|だれがいる|逸話|歴史|昔話|名場面|伝説)[？?]?$/.test(t.replace(/^(?:じゃあ|では|なら)[、,\s]*/,''))){
        return {message:'カープの'+t.replace(/^(?:じゃあ|では|なら)[、,\s]*/,'').replace(/[？?]$/,'')+( /[？?]$/.test(t)?'？':''),reason:'carp_topic_carry',confidence:0.98};
      }
      if(isMoreCue(t)&&recentContains(h,/逸話|昔話|名場面|伝説/,24)){
        return {message:'カープの他の逸話',reason:'carp_anecdote_more',confidence:0.99};
      }
    }

    if(d==='weather'&&/^(?:今日|きょう|明日|あした|明後日|あさって)(?:は)?[？?]?$|^(?:雨|気温|最高|最低|降水確率|湿度|風|風速)[？?]?$/.test(t)){
      var rw=findRecentWeather(h);if(rw&&rw.place){
        var tail=t.replace(/[？?]$/,'');
        if(/^(?:今日|きょう|明日|あした|明後日|あさって)(?:は)?$/.test(tail))return {message:rw.place+'の'+tail.replace(/は$/,'')+'の天気',reason:'weather_topic_carry_short',confidence:0.97};
        return {message:rw.place+'の'+tail,reason:'weather_topic_carry_short',confidence:0.92};
      }
    }

    if(d==='jinpo'&&clean){
      var st=(clean.match(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/)||[])[0]||'';
      if(st&&recentContains(h,/(?:生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風).*(?:高い|高め|おすすめ|一番|最も|トップ|最大|重視)/,20)){
        if(!/高い|高め|おすすめ|一番|最も|トップ|最大|重視/.test(clean)){
          return {message:st+'高いの',reason:'jinpo_stat_followup',confidence:0.96};
        }
      }
    }

    if(d==='tairano'){
      if(/カウンター|かうんた|counter/i.test(h.map(function(x){return S(x&&x.text);}).join(' '))){
        if(clean&&clean.length<=18&&!/使い方|どこ|ページ|数値|いくつ|何番/.test(clean)){
          return {message:clean+'のカウンターは？',reason:'counter_topic_carry',confidence:0.96};
        }
      }
      if(/^(?:使い方|どう使う|どこ|開いて|ページ|数値|いくつ|何番|カウンター|かうんた|かうん)[？?]?$/.test(t)){
        var ant=findAntecedent(h);if(ant)return {message:ant+' '+t,reason:'tairano_topic_carry',confidence:0.90};
      }
    }
    return null;
  }

  function recentCounterAmbiguity(history){
    var h=Array.isArray(history)?history:[];
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

  function resolve(text,history,opt){
    var original=S(text),resolved=original,reason='',confidence=0;
    var h=historyBeforeCurrent(history,original),ex=lastExchange(h),a=S(ex.assistant&&ex.assistant.text),u=S(ex.user&&ex.user.text);
    var counterCandidateFollowup=recentCounterAmbiguity(h)&&counterCandidateSelector(original);


    // 明示的な言い直しは、以前の誤解より新しい内容を優先する。
    var corrected=stripCorrectionPrefix(original);
    if(corrected&&corrected!==original&&corrected.length>=2){
      resolved=corrected;reason='explicit_correction';confidence=0.995;
    }

    // 共通会話ルーターの短期ワーキングメモリを使い、回答側に新しく出た人物・対象も参照できるようにする。
    if(resolved===original){
      try{
        if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.resolveEntityReference==='function'){
          var entityRef=window.JINPO_BOT_CONVERSATION.resolveEntityReference(original,h);
          if(entityRef&&entityRef.message){
            resolved=entityRef.message;reason=entityRef.kind==='person'?'working_memory_person':'working_memory_entity';confidence=0.97;
          }
        }
      }catch(entityRefErr){}
    }

    // 「カープ」→「順位」→「選手」のような、人なら分かる短い追質問を前の話題へ結ぶ。
    if(resolved===original&&!counterCandidateFollowup){
      var carried=carryDomain(original,h);
      if(carried){resolved=carried.message;reason=carried.reason;confidence=carried.confidence;}
    }

    // 「天気」→「場所を教えて」→「東京」のような不足情報への追答。
    if(looksLikeLocation(original)&&(
      /(?:天気|気温|予報).*(?:場所|地域)|場所だけ教えて|どこ(?:の|で).*天気|地域で変わる/.test(a) ||
      (u&&hasExplicitWeather(u)&&!extractWeatherPlace(u))
    )){
      var wt=extractWeatherTime(u||a);resolved=original+'の'+wt+'天気';reason='weather_location_followup';confidence=0.99;
    }

    // 天気の話題が継続中に「明日」「今日」だけ返した時は直前の地域を引き継ぐ。
    if(resolved===original&&/^(?:今日|きょう|明日|あした)(?:は)?[？?]?$/.test(original)){
      var rw=findRecentWeather(h);
      if(rw&&rw.place){resolved=rw.place+'の'+(/明日|あした/.test(original)?'明日の':'今日の')+'天気';reason='weather_time_followup';confidence=0.96;}
    }

    // 陣法の不足陣形を質問された直後の「鶴翼」等を、元の条件へ結合する。
    if(resolved===original&&isFormation(original)&&/陣形.*(?:指定|選|どれ|どう|未選択)/.test(a)&&u){
      resolved=u+' '+original;reason='formation_followup';confidence=0.98;
    }

    // 一般の最新話題を短い追質問で継続。
    if(resolved===original&&isGeneralLiveFollowup(original)){
      var liveSubject=findGeneralLiveAntecedent(h);
      if(liveSubject){
        if(/昨日から|きのうから/.test(original)){resolved=liveSubject+'の昨日からの最新情報';reason='general_live_since_yesterday';}
        else{resolved=liveSubject+'の最新情報';reason='general_live_followup';}
        confidence=0.94;
      }else{
        // カープは一般Webに流さず、直前の専用質問へ戻す。
        for(var li=h.length-1;li>=0&&li>=h.length-12;li--){
          if(!h[li]||h[li].role!=='user')continue;
          var prior=S(h[li].text),pd=domainFromText(prior);
          if(pd==='carp'){
            var pant=findAntecedent(h);
            if(pant){resolved=pant+'は今どう？';reason='carp_live_followup';confidence=0.96;}
            break;
          }
        }
      }
    }

    // 人が会話でよく使う短い追質問。「詳しく」「なんで？」「どこ？」など。
    // 直前のユーザー話題がはっきりしている時だけ補完し、無関係な新話題へは広げない。
    if(resolved===original&&/^(?:もっと|もう少し|もうちょい|他にも|ほかにも|他には|ほかには|別の|もう一つ|もう1つ|詳しく|くわしく|具体的には|具体例は|たとえば|例えば|例は|要するに|簡単に言うと|かんたんに|つまり|結局|逆に|反対は|逆の場合は|なんで|なぜ|どうして|どこ|いつ|誰|だれ|何|なに|どういうこと|どういう意味|意味は|どのくらい|どれくらい|本当|ほんと|マジ|まじ|それ本当|それほんと|それで|で[？?]?|続き|つづき|もう一回説明|もう1回説明)[？?]?$/.test(original)){
      var gant=findAntecedent(h);
      if(gant){
        var gc=C(original),gs='';
        if(/他にも|ほかにも|他には|ほかには|別の|もう一つ|もう1つ/.test(original))gs='について別のものも教えて';
        else if(/もう一回説明|もう1回説明/.test(original))gs='についてもう一度説明して';
        else if(/具体的には|具体例は|たとえば|例えば|例は/.test(original))gs='について具体例も含めて教えて';
        else if(/要するに|簡単に言うと|かんたんに|つまり|結局/.test(original))gs='について要点と結論を短く教えて';
        else if(/逆に|反対は|逆の場合は/.test(original))gs='について逆の場合はどうなる？';
        else if(/本当|ほんと|マジ|まじ/.test(original))gs='について事実確認して';
        else if(/もっと|もう少し|もうちょい|詳しく|くわしく/.test(original))gs='についてもう少し詳しく教えて';
        else if(/なんで|なぜ|どうして/.test(original))gs='はなぜ？';
        else if(/どこ/.test(original))gs='はどこ？';
        else if(/いつ/.test(original))gs='はいつ？';
        else if(/誰|だれ/.test(original))gs='は誰？';
        else if(/どのくらい|どれくらい/.test(original))gs='はどのくらい？';
        else if(/何|なに|どういうこと|どういう意味|意味は/.test(original))gs='ってどういう意味？';
        else gs='について続きを教えて';
        resolved=gant+gs;reason='generic_followup';confidence=0.88;
      }
    }

    // 指示語だけで前の話題を指す場合。「それの歴史」「さっきの全MAX」等。
    if(resolved===original&&/^(?:それ|これ|その件|さっきの|今の|前の)(?:の|について|を|で|は)?/.test(original)){
      var ant=findAntecedent(h),suffix=original.replace(/^(?:それ|これ|その件|さっきの|今の|前の)/,'').replace(/^について/,'について');
      if(ant){resolved=ant+suffix;reason='pronoun_reference';confidence=0.88;}
    }

    // 「じゃあ足利は？」「では義昭は？」のような短い追質問は、
    // 直前の話題がカウンター等ではっきりしている場合だけ、その話題語を補う。
    if(resolved===original&&!counterCandidateFollowup&&/^(?:じゃあ|では|なら)?\s*[^？?]{1,18}(?:は|って)?[？?]?$/.test(original)){
      var recentAll='';
      for(var ri=h.length-1;ri>=0&&ri>=h.length-8;ri--){
        if(h[ri]&&S(h[ri].text))recentAll+=' '+S(h[ri].text);
      }
      if(/カウンター|かうんた|かうん|counter/i.test(recentAll)&&!/カウンター|かうんた|かうん|counter/i.test(original)){
        var shortName=original.replace(/^(?:じゃあ|では|なら)\s*/,'').replace(/(?:は|って)?[？?]$/,'').trim();
        if(shortName&&shortName.length<=18){
          resolved=shortName+'のカウンターは？';reason='counter_followup';confidence=0.90;
        }
      }
    }

    // 「東京」単独を一般検索へ飛ばす前に、直近が天気なら天気の追答として扱う。
    if(resolved===original&&looksLikeLocation(original)){
      var recentWeather=findRecentWeather(h);
      if(recentWeather&&(!lastOf(h,'user')||h.length<=12)){
        var lastAi=S(lastOf(h,'assistant')&&lastOf(h,'assistant').text);
        if(/天気|気温|予報|場所|地域/.test(lastAi)){
          resolved=original+'の'+(recentWeather.time||'')+'天気';reason='weather_topic_carry';confidence=0.91;
        }
      }
    }

    if(counterCandidateFollowup&&resolved===original){
      reason='counter_candidate_followup';
      confidence=0.995;
    }

    return {original:original,message:resolved,resolved:resolved!==original,reason:reason,confidence:confidence,history:h};
  }

  window.JINPO_BOT_CONTEXT={version:VERSION,resolve:resolve,looksLikeLocation:looksLikeLocation,findRecentWeather:findRecentWeather,findAntecedent:findAntecedent,domainFromText:domainFromText,recentDomain:recentDomain,stripCorrectionPrefix:stripCorrectionPrefix,liveSubjectFromText:liveSubjectFromText,isGeneralLiveFollowup:isGeneralLiveFollowup,findGeneralLiveAntecedent:findGeneralLiveAntecedent,recentCounterAmbiguity:recentCounterAmbiguity,counterCandidateSelector:counterCandidateSelector};
})();
