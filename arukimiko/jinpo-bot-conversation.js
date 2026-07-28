/*
 * 歩き巫女 共通会話ルーター v1.0.0
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
  var VERSION='1.0.0';

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function C(v){
    return S(v).toLowerCase().replace(/[？?！!。、・「」『』【】（）()\[\]［］\s]/g,'');
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
    if(counterCue(t)||/天下統一奇譚|修羅の間|天下武技大会|二条城|桶狭間|比叡山|賤ヶ岳/.test(t))return'counter';
    if(/九十九|つくも/.test(t))return'tsukumo';
    if(/鬼神石|きしん/.test(t))return'kishin';
    if(/魔導結晶|魔導|まどう/.test(t))return'madou';
    if(/家臣.*(?:名前|名付|命名)|(?:名前|名付|命名).*家臣/.test(t))return'kashin_name';
    if(/天気|気温|予報|降水|雨|雪|湿度|風速/.test(t))return'weather';
    if(/陣法|因縁|陣形|鶴翼|方円|魚鱗|衡軛|英傑|全MAX/.test(t))return'jinpo';
    return'';
  }

  function isWeakAssistantText(text){
    var t=S(text);
    return /ページはこちら|こちらから開け|入口がある|サイト内のページ案内|該当ページを開く/.test(t);
  }

  function recentDomain(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-14;i--){
      if(!h[i])continue;
      var d=domainFromText(h[i].text||'');
      if(d)return d;
    }
    return'';
  }

  function lastSubstantiveUser(history){
    var h=Array.isArray(history)?history:[];
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

  function carryByDomain(text,domain){
    var t=S(text);
    if(!domain)return'';

    if(domain==='carp'){
      if(/^(?:順位|何位|なんい|選手|選手一覧|メンバー|日程|予定|結果|試合結果|先発|スタメン|打率|本塁打|防御率|誰がいる)[？?]?$/.test(t))
        return'カープの'+t;
    }

    if(domain==='counter'){
      if(!counterCue(t)&&shortFollowup(t)&&
         !/ページ|サイト|リンク|開いて|どこにある/.test(t)&&
         !/^(?:もっと|詳しく|なんで|なぜ|どうして)$/.test(t)){
        return t.replace(/[？?]$/,'')+'のカウンターは？';
      }
    }

    if(domain==='tsukumo'&&shortFollowup(t)&&!/九十九|つくも/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|トップ|一番/.test(t))return'九十九の'+t;

    if(domain==='kishin'&&shortFollowup(t)&&!/鬼神石|きしん/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|トップ|一番/.test(t))return'鬼神石の'+t;

    if(domain==='madou'&&shortFollowup(t)&&!/魔導|まどう/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|トップ|一番/.test(t))return'魔導結晶の'+t;

    return'';
  }

  function genericFollowup(text,history){
    var t=S(text),ant=lastSubstantiveUser(history);
    if(!ant)return'';
    if(/^(?:もっと|もう少し|詳しく|くわしく)[？?]?$/.test(t))
      return ant.replace(/[？?]$/,'')+'について、もう少し詳しく教えて';
    if(/^(?:なんで|なぜ|どうして)[？?]?$/.test(t))
      return ant.replace(/[？?]$/,'')+'について、なぜそうなるの？';
    if(/^(?:それは|それって|それ何|それなに)[？?]?$/.test(t))
      return ant.replace(/[？?]$/,'')+'について説明して';
    return'';
  }

  function resolve(text,history,opt){
    var original=S(text);
    var correction=stripCorrection(original);
    var message=correction.text;
    var domain=domainFromText(message);
    var prevDomain=recentDomain(history);
    var carried='';

    if(!domain){
      carried=carryByDomain(message,prevDomain);
      if(carried){
        message=carried;
        domain=domainFromText(message)||prevDomain;
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
      fact:fact
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
    isWeakAssistantText:isWeakAssistantText
  };
})();
