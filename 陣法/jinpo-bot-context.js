/*
 * 歩き巫女 会話コンテキスト v1.0.0
 * 直前の会話を参照し、短い追答・指示語・不足スロットを保守的に補完する。
 * 推測し過ぎないことを優先し、確信できる場合だけ入力を補完する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_CONTEXT)return;
  var VERSION='1.2.0';

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
    if(/[？?！!]/.test(t)||/(教えて|調べて|検索|知りたい|どう|なに|何|誰|いつ|なぜ|おすすめ|好き|嫌い|疲れ|眠い)/.test(t))return false;
    if(/^(?:今日|きょう|明日|あした|現在|今|いま|昨日|きのう)$/.test(t))return false;
    if(/(?:都|道|府|県|市|区|町|村|島|駅)$/.test(t))return true;
    if(/^(?:東京|広島|大阪|京都|名古屋|横浜|札幌|仙台|福岡|神戸|千葉|埼玉|奈良|沖縄|長崎|熊本|鹿児島|金沢|新潟|静岡|浜松|岡山|高松|松山|高知|大分|宮崎|青森|盛岡|秋田|山形|福島|宇都宮|前橋|水戸|長野|甲府|富山|福井|岐阜|津|大津|和歌山|鳥取|松江|山口|徳島|佐賀)$/.test(t))return true;
    return /^[一-龠々ヶヵぁ-んァ-ヶA-Za-z]{2,12}$/.test(t);
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
  function resolve(text,history,opt){
    var original=S(text),resolved=original,reason='',confidence=0;
    var h=historyBeforeCurrent(history,original),ex=lastExchange(h),a=S(ex.assistant&&ex.assistant.text),u=S(ex.user&&ex.user.text);

    // 「天気」→「場所を教えて」→「東京」のような不足情報への追答。
    if(looksLikeLocation(original)&&(
      /(?:天気|気温|予報).*(?:場所|地域)|場所だけ教えて|どこ(?:の|で).*天気|地域で変わる/.test(a) ||
      (u&&hasExplicitWeather(u)&&!extractWeatherPlace(u))
    )){
      var wt=extractWeatherTime(u||a);resolved=original+'の'+wt+'天気';reason='weather_location_followup';confidence=0.99;
    }

    // 天気の話題が継続中に「明日」「今日」だけ返した時は直前の地域を引き継ぐ。
    if(resolved===original&&/^(?:今日|きょう|明日|あした)$/.test(original)){
      var rw=findRecentWeather(h);
      if(rw&&rw.place){resolved=rw.place+'の'+(/明日|あした/.test(original)?'明日の':'今日の')+'天気';reason='weather_time_followup';confidence=0.96;}
    }

    // 陣法の不足陣形を質問された直後の「鶴翼」等を、元の条件へ結合する。
    if(resolved===original&&isFormation(original)&&/陣形.*(?:指定|選|どれ|どう|未選択)/.test(a)&&u){
      resolved=u+' '+original;reason='formation_followup';confidence=0.98;
    }

    // 指示語だけで前の話題を指す場合。「それの歴史」「さっきの全MAX」等。
    if(resolved===original&&/^(?:それ|これ|その件|さっきの|今の|前の)(?:の|について|を|で|は)?/.test(original)){
      var ant=findAntecedent(h),suffix=original.replace(/^(?:それ|これ|その件|さっきの|今の|前の)/,'').replace(/^について/,'について');
      if(ant){resolved=ant+suffix;reason='pronoun_reference';confidence=0.88;}
    }

    // 「じゃあ足利は？」「では義昭は？」のような短い追質問は、
    // 直前の話題がカウンター等ではっきりしている場合だけ、その話題語を補う。
    if(resolved===original&&/^(?:じゃあ|では|なら)?\s*[^？?]{1,18}(?:は|って)?[？?]?$/.test(original)){
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

    return {original:original,message:resolved,resolved:resolved!==original,reason:reason,confidence:confidence,history:h};
  }

  window.JINPO_BOT_CONTEXT={version:VERSION,resolve:resolve,looksLikeLocation:looksLikeLocation,findRecentWeather:findRecentWeather,findAntecedent:findAntecedent};
})();
