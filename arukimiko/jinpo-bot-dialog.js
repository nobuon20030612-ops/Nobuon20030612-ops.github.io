/*
 * 歩き巫女 会話ダイアログ状態 v1.0.0
 *
 * 単発の文字列判定ではなく、「今何を聞いている途中か」を短期状態として持つ。
 * sessionStorage を使うので、同じタブでTOP→各ページへ移動しても文脈を引き継ぐ。
 * 他の端末・他のブラウザ利用者とは共有しない。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_DIALOG)return;

  var VERSION='2.3.0';
  var KEY='arukimikoDialog.v1';

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function load(){
    try{
      var x=JSON.parse(sessionStorage.getItem(KEY)||'null');
      return x&&typeof x==='object'?x:{pending:null,lastWeather:null,lastDomain:'',updatedAt:0};
    }catch(e){return {pending:null,lastWeather:null,lastDomain:'',updatedAt:0};}
  }
  function save(x){
    x=x&&typeof x==='object'?x:{};
    x.updatedAt=Date.now();
    try{sessionStorage.setItem(KEY,JSON.stringify(x));}catch(e){}
    return x;
  }
  function clearPending(){
    var x=load();x.pending=null;save(x);return x;
  }
  function formationWord(t){
    t=S(t);
    if(/鶴翼|かくよく/.test(t))return'鶴翼';
    if(/方円|ほうえん/.test(t))return'方円';
    if(/魚鱗|ぎょりん/.test(t))return'魚鱗';
    if(/衡軛|衝軛|鴻鵠|こうやく/.test(t))return'衡軛';
    return'';
  }

  function setSpecifiedSearchPending(baseText,need){
    var st=load();
    st.pending={
      intent:'specified_search',
      need:String(need||''),
      baseText:S(baseText),
      startedAt:Date.now()
    };
    save(st);
    return st.pending;
  }

  function isWeatherWord(t){
    return /天気|てんき|気温|きおん|天候|予報|よほう|降水|こうすい|雨|あめ|雪|ゆき|晴れ|はれ|曇り|くもり|湿度|しつど|風速|ふうそく|最高気温|最低気温|傘|かさ/.test(S(t));
  }
  function timeWord(t){
    t=S(t);
    if(/明日|あした/.test(t))return'tomorrow';
    if(/今日|きょう/.test(t))return'today';
    return'';
  }
  function timeJa(t){return t==='tomorrow'?'明日':t==='today'?'今日':'';}
  function explicitOtherDomain(t){
    t=S(t);
    if(!t)return false;
    if(/カープ|かーぷ|広島東洋|順位|選手|スタメン|先発/.test(t))return true;
    if(/陣法|因縁|陣形|鶴翼|方円|魚鱗|衡軛|こうやく|腕力|耐久|器用|知力|魅力|英傑|全MAX|見聞録|鬼神石MAX/.test(t))return true;
    if(/為替|ドル円|円ドル|USD|JPY|EUR|ニュース|速報/.test(t))return true;
    if(/鬼神石|九十九|魔導結晶|七星転生|家臣|カウンター|かうんた|たいらの野望/.test(t))return true;
    return false;
  }
  function stripCorrection(t){
    return S(t)
      .replace(/^(?:(?:そう|そっち|それ)(?:じゃ|では)?(?:ない|なくて|なく|違う)|(?:いや|いえ|違う|ちがう|訂正|ごめん|ごめんね|やっぱり|やっぱ))[、。,:：\s]*/,'')
      .trim();
  }
  function extractWeatherPlace(t){
    t=stripCorrection(t)
      .replace(/^(?:今日|きょう|明日|あした)(?:の)?/,'')
      .replace(/(?:の)?(?:今日|きょう|明日|あした)(?:の)?(?=(?:天気|てんき|気温|きおん|予報|よほう|雨|あめ|雪|ゆき|湿度|しつど|風速|ふうそく))/g,'')
      .replace(/(?:の|で)?(?:天気予報|天気|てんき|気温|きおん|天候|予報|よほう|降水確率|降水|雨|あめ|雪|ゆき|湿度|しつど|風速|ふうそく|最高気温|最低気温).*/,'')
      .replace(/(?:は|を)?(?:教えて|おしえて|知りたい|しりたい|調べて|しらべて|検索して)$/,'')
      .replace(/[？?！!。、\s]+$/g,'')
      .trim();
    if(/^(?:ここ|現在地|この辺|このへん|近く)$/.test(t))return'';
    return t.slice(0,60);
  }
  function isMetaConversationControl(t){
    return /話.*戻|前の話|さっきの話|元の話|一個前|戻ろう|もどろう|話.*変|別の話/.test(S(t));
  }

  function pendingExpired(pending){
    return !!(pending&&pending.startedAt&&Date.now()-Number(pending.startedAt)>5*60*1000);
  }

  function looksLikeLocationReply(t){
    t=S(t);
    if(!t||t.length>40||explicitOtherDomain(t)||isMetaConversationControl(t))return false;
    if(/[？?！!]/.test(t))return false;
    if(/教えて|おしえて|調べて|検索|どう|何|なに|誰|だれ|なぜ|好き|疲れ|眠い|逸話|歴史|腕力|知力|耐久|器用|魅力|因縁|陣形/.test(t))return false;
    if(/^(?:今日|きょう|明日|あした)$/.test(t))return false;
    if(/(?:都|道|府|県|市|区|町|村|郡|島|駅)$/.test(t))return true;
    if(/^(?:東京|広島|大阪|京都|名古屋|横浜|札幌|仙台|福岡|神戸|千葉|埼玉|奈良|沖縄|長崎|熊本|鹿児島|金沢|新潟|静岡|浜松|岡山|高松|松山|高知|大分|宮崎|青森|盛岡|秋田|山形|福島|宇都宮|前橋|水戸|長野|甲府|富山|福井|岐阜|津|大津|和歌山|鳥取|松江|山口|徳島|佐賀)$/.test(t))return true;
    return false;
  }
  function weatherRequest(text){
    var t=stripCorrection(text),tw=timeWord(t);
    if(!isWeatherWord(t))return null;
    var place=extractWeatherPlace(t);
    return {intent:'weather',place:place,time:tw,original:S(text)};
  }
  function pendingPrompt(req){
    var when=timeJa(req&&req.time);
    return (when?when+'の':'')+'天気ですね。どこの地域を見ますか？\n地名だけで大丈夫なのですよ。';
  }

  function preprocess(text,opt){
    var original=S(text),t=stripCorrection(original),st=load(),pending=st.pending;
    if(!original)return {handled:false,message:original};

    if(pendingExpired(pending)){
      st.pending=null;save(st);pending=null;
    }

    // 指定検索で不足していた「陣形 / 因縁数」だけを次の一言で補う。
    // 例:
    //   方円で耐久と魅力高いの
    //   → 因縁数だけ教えて
    //   → 7因縁
    //   → 元の全文 + 7因縁 として復元
    if(pending&&pending.intent==='specified_search'){
      var need=S(pending.need),base=S(pending.baseText),fm=formationWord(t);
      var cm=t.match(/(?:^|[^0-9])([5-9])\s*(?:因縁)?(?:で|にして|お願い)?[。！!？?\s]*$/);

      if(need==='count'&&cm){
        st.pending=null;save(st);
        return {
          handled:true,
          message:base+' '+Number(cm[1])+'因縁',
          reason:'specified_search_pending_count'
        };
      }

      if(need==='formation'&&fm){
        st.pending=null;save(st);
        return {
          handled:true,
          message:base+' '+fm,
          reason:'specified_search_pending_formation'
        };
      }

      if(need==='formation_count'){
        if(fm&&cm){
          st.pending=null;save(st);
          return {
            handled:true,
            message:base+' '+fm+' '+Number(cm[1])+'因縁',
            reason:'specified_search_pending_both'
          };
        }
        var both=t.match(/(鶴翼|かくよく|方円|ほうえん|魚鱗|ぎょりん|衡軛|衝軛|鴻鵠|こうやく).*?([5-9])\s*因縁|([5-9])\s*因縁.*?(鶴翼|かくよく|方円|ほうえん|魚鱗|ぎょりん|衡軛|衝軛|鴻鵠|こうやく)/);
        if(both){
          var form=formationWord(both[1]||both[4]||'');
          var count=Number(both[2]||both[3]);
          if(form&&count){
            st.pending=null;save(st);
            return {
              handled:true,
              message:base+' '+form+' '+count+'因縁',
              reason:'specified_search_pending_both'
            };
          }
        }
      }

      // 明確に別話題なら pending を引きずらない。
      if(explicitOtherDomain(t)&&!/陣法|因縁|陣形|鶴翼|方円|魚鱗|衡軛|腕力|耐久|器用|知力|魅力/.test(t)){
        st.pending=null;save(st);pending=null;
      }
    }

    // 「話を戻そう」「別の話にしよう」は地名として扱わない。
    if(isMetaConversationControl(t)){
      st.pending=null;
      save(st);
      return {handled:false,message:t,reason:'conversation_control'};
    }

    // はっきり別の話題へ移ったら、未完了の天気質問を引きずらない。
    if(pending&&pending.intent==='weather'&&explicitOtherDomain(t)&&!isWeatherWord(t)){
      st.pending=null;save(st);pending=null;
    }

    var req=weatherRequest(t);
    if(req){
      if(!req.place&&st.lastDomain==='weather'&&st.lastWeather&&st.lastWeather.place){
        req.place=st.lastWeather.place;
      }
      if(!req.place){
        st.pending={intent:'weather',need:'location',time:req.time||'',startedAt:Date.now()};
        st.lastDomain='weather';save(st);
        return {handled:true,direct:true,answer:pendingPrompt(req),mode:'会話文脈',data:{pendingIntent:'weather',need:'location'}};
      }
      st.pending=null;st.lastDomain='weather';
      st.lastWeather={place:req.place,time:req.time||'',at:Date.now()};save(st);
      return {handled:true,message:req.place+'の'+(req.time?timeJa(req.time)+'の':'')+'天気',intent:'weather',weather:{place:req.place,time:req.time||''},reason:'weather_explicit'};
    }

    // 「天気」への質問で場所を待っている時は、次の短い地名を必ず天気の続きとして扱う。
    if(pending&&pending.intent==='weather'&&pending.need==='location'&&looksLikeLocationReply(t)){
      var place=S(t);
      st.pending=null;st.lastDomain='weather';
      st.lastWeather={place:place,time:pending.time||'',at:Date.now()};save(st);
      return {handled:true,message:place+'の'+(pending.time?timeJa(pending.time)+'の':'')+'天気',intent:'weather',weather:{place:place,time:pending.time||''},reason:'weather_pending_location'};
    }

    // 一度地域が決まった後の短い追質問。
    var lw=st.lastWeather;
    if(lw&&lw.place&&st.lastDomain==='weather'){
      if(/^(?:今日|きょう|明日|あした)(?:は|の天気)?[？?]?$/.test(t)){
        var tm=timeWord(t);
        lw.time=tm;lw.at=Date.now();st.lastWeather=lw;save(st);
        return {handled:true,message:lw.place+'の'+timeJa(tm)+'の天気',intent:'weather',weather:{place:lw.place,time:tm},reason:'weather_follow_time'};
      }
      if(/^(?:雨|あめ|降水確率|こうすいかくりつ|気温|きおん|最高|最低|湿度|しつど|風|風速|ふうそく|晴れ|はれ|曇り|くもり|傘|かさ|暑い|あつい|寒い|さむい)(?:は|どう|いる|いらない)?[？?]?$/.test(t)){
        var detail=t.replace(/[？?]$/,'').replace(/^(?:傘|かさ).*/,'雨');
        return {handled:true,message:lw.place+'の'+(lw.time?timeJa(lw.time)+'の':'')+detail,intent:'weather',weather:{place:lw.place,time:lw.time||''},reason:'weather_follow_detail'};
      }
      var lm=t.match(/^(?:じゃあ|では|なら|やっぱ|やっぱり)?\s*([一-龠々ヶヵぁ-んァ-ヶA-Za-z0-9・ー\-]{1,24}?)(?:は|どう)?[？?]?$/);
      if(lm&&looksLikeLocationReply(lm[1])){
        var np=S(lm[1]);
        st.lastWeather={place:np,time:lw.time||'',at:Date.now()};save(st);
        return {handled:true,message:np+'の'+(lw.time?timeJa(lw.time)+'の':'')+'天気',intent:'weather',weather:{place:np,time:lw.time||''},reason:'weather_follow_location'};
      }
      if(looksLikeLocationReply(t)){
        // 「大阪」「広島」など地域だけを言った場合は天気の地域変更。
        st.lastWeather={place:t,time:lw.time||'',at:Date.now()};save(st);
        return {handled:true,message:t+'の'+(lw.time?timeJa(lw.time)+'の':'')+'天気',intent:'weather',weather:{place:t,time:lw.time||''},reason:'weather_follow_location'};
      }
    }

    return {handled:false,message:t||original};
  }

  function rememberResult(kind,data){
    var st=load();
    if(kind==='weather'&&data&&data.location){
      st.pending=null;st.lastDomain='weather';
      st.lastWeather={
        place:S(data.location.name||data.query||''),
        time:S(data.requestTime||''),
        at:Date.now()
      };
      save(st);
    }else if(kind){
      st.lastDomain=kind;save(st);
    }
  }

  function clear(){
    try{sessionStorage.removeItem(KEY);}catch(e){}
  }

  window.JINPO_BOT_DIALOG={
    version:VERSION,preprocess:preprocess,rememberResult:rememberResult,
    clearPending:clearPending,clear:clear,state:load,extractWeatherPlace:extractWeatherPlace,
    setSpecifiedSearchPending:setSpecifiedSearchPending
  };
})();
