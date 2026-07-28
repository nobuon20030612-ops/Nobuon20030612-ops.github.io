/*
 * 歩き巫女 共通会話ルーター v1.5.0
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
  var VERSION='1.5.0';
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
    if(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/.test(t)&&
       /高い|高め|強い|おすすめ|一番|最も|トップ|最大|重視|検索|探して|比較/.test(t))return'jinpo';
    return'';
  }

  function isWeakAssistantText(text){
    var t=S(text);
    return /ページはこちら|こちらから開け|入口がある|サイト内のページ案内|該当ページを開く/.test(t);
  }

  function recentDomain(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-14;i--){
      if(!h[i])continue;
      var d=domainFromText(h[i].text||'');
      if(d)return d;
    }
    return'';
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

  function carryByDomain(text,domain,history){
    var t=S(text);
    if(!domain)return'';

    if(domain==='carp'){
      var ct=t.replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'');
      if(/^(?:順位|何位|なんい|選手|選手一覧|メンバー|日程|予定|結果|試合結果|先発|スタメン|打率|本塁打|防御率|誰がいる|逸話|他の逸話|別の逸話|昔話|歴史|名場面|伝説|スター|名選手)[？?]?$/.test(ct)){
        return'カープの'+ct;
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
    var carried='';

    if(!domain){
      carried=carryByDomain(message,prevDomain,history);
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
    recentJinpoStatStyle:recentJinpoStatStyle
  };
})();
