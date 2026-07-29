/*
 * 歩き巫女 広島東洋カープ正本知識検索 v1.2.0
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_CARP_KNOWLEDGE)return;

  var VERSION='1.2.0';
  var D=window.JINPO_BOT_CARP_KNOWLEDGE_DATA||{};
  var RECORDS=Array.isArray(D.records)?D.records:[];
  var CURRENT=Array.isArray(D.currentPlayers)?D.currentPlayers:[];
  var HIST=Array.isArray(D.historicalPlayers)?D.historicalPlayers:[];
  var ALL_NAMES=CURRENT.map(function(x){return x.name;}).concat(HIST);
  var NAME_SET={};
  ALL_NAMES.forEach(function(n){NAME_SET[n]=1;});

  var ALIASES=D.aliases||{};
  var AMBIGUOUS=D.ambiguousAliases||{};

  function aliasKeys(){
    return Object.keys(ALIASES).sort(function(a,b){return b.length-a.length;});
  }

  function ambiguousKeys(){
    return Object.keys(AMBIGUOUS).sort(function(a,b){return b.length-a.length;});
  }

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }

  function compact(v){
    return S(v).toLowerCase()
      .replace(/広島東洋カープ|広島カープ|カープ|かーぷ|hiroshima\s*toyo\s*carp|hiroshima\s*carp/gi,'')
      .replace(/[\s、。,.!！?？「」『』（）()・〜~ー―…:：;；\[\]【】\/／_-]/g,'');
  }

  function cleanText(v){
    return S(v)
      .replace(/\[(?:R|S|F)\d+(?:\/(?:R|S|F)?\d+)*\]/g,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function currentYear(){
    try{return new Date().getFullYear();}catch(e){return 2026;}
  }

  function explicitHistoricalYear(text){
    var years=String(text||'').match(/(?:19|20)\d{2}/g)||[];
    if(!years.length)return 0;
    var y=Number(years[0]);
    return y<currentYear()?y:0;
  }

  function isRealtimeQuery(text){
    var t=S(text);
    if(explicitHistoricalYear(t))return false;
    if(/歴代|昔|当時|創設|逸話|伝説|名場面|家族|親族|妻|夫|父|母|兄|弟|姉|妹|娘|息子|永久欠番|アカデミー|FA移籍|ノーヒットノーラン|トリプルスリー/.test(t))return false;
    return /今日|きょう|昨日|きのう|明日|あした|明後日|あさって|今|現在|最新|速報|直近|順位|何位|試合|スコア|勝った|負けた|日程|予定|登録|抹消|一軍|先発|スタメン|ニュース|故障|けが|怪我|復帰|トレード|新外国人|今季|今シーズン/.test(t);
  }

  function foundNames(text){
    var t=S(text),out=[],seen={};
    var sorted=ALL_NAMES.slice().sort(function(a,b){return b.length-a.length;});

    for(var i=0;i<sorted.length;i++){
      if(t.indexOf(sorted[i])>=0&&!seen[sorted[i]]){
        seen[sorted[i]]=1;
        out.push(sorted[i]);
        if(out.length>=4)break;
      }
    }

    var keys=aliasKeys();
    for(var j=0;j<keys.length&&out.length<4;j++){
      var alias=keys[j],full=ALIASES[alias];
      if(t.indexOf(alias)>=0&&!seen[full]){
        seen[full]=1;
        out.push(full);
      }
    }
    return out;
  }

  function detectCurrentSubject(text){
    var t=S(text),names=foundNames(t);
    var ym=t.match(/((?:19|20)\d{2})年?/);

    if(names.length){
      return {
        explicit:true,
        kind:'player',
        player:names[0],
        players:names,
        year:ym?Number(ym[1]):0
      };
    }

    if(ym){
      return {
        explicit:true,
        kind:'year',
        player:'',
        players:[],
        year:Number(ym[1])
      };
    }

    var keys=ambiguousKeys();
    for(var i=0;i<keys.length;i++){
      var a=keys[i];
      if(t.indexOf(a)>=0){
        return {
          explicit:true,
          kind:'ambiguous_player',
          player:'',
          players:[],
          year:0,
          alias:a,
          candidates:(AMBIGUOUS[a]||[]).slice(0,6)
        };
      }
    }

    return {explicit:false,kind:'',player:'',players:[],year:0};
  }

  function ambiguityAnswer(text){
    var sub=detectCurrentSubject(text);
    if(sub.kind!=='ambiguous_player')return null;

    return {
      handled:true,
      answer:'「'+sub.alias+'」だけだとカープ在籍選手の候補が複数いるのですよ。'
        +(sub.candidates.length?' 候補：'+sub.candidates.join('、')+'。':'')
        +' フルネームか、もう少し手がかりをください。',
      kind:'ambiguous_player',
      alias:sub.alias,
      candidates:sub.candidates
    };
  }

  function hasKnownEntity(text){
    return foundNames(text).length>0;
  }

  function currentPlayerByName(name){
    for(var i=0;i<CURRENT.length;i++)if(CURRENT[i].name===name)return CURRENT[i];
    return null;
  }

  function currentPlayerByNumber(number){
    number=String(number);
    for(var i=0;i<CURRENT.length;i++)if(String(CURRENT[i].number)===number)return CURRENT[i];
    return null;
  }

  function contextBarrier(text){
    var t=S(text);
    return /天気|気温|雨|雪|台風|陣法|陣形|因縁|英傑|全MAX|九十九|鬼神石|魔導|家臣|名前考え|為替|ニュース|時刻|時間|こんにちは|こんばんは|おはよう/.test(t);
  }

  function recentContext(history){
    var h=Array.isArray(history)?history:[];
    var ctx={player:'',year:0,topic:'',sourceText:''};

    // 会話モジュールが使える時は、ユーザーが現在維持している「主役」を正とする。
    // Bot回答本文にたまたま出た脇役選手を、次の「家族は？」等の主語へ昇格させない。
    // また、人物の後にFirebase・仕事・雑談など実質的な別話題へ移った場合は、
    // 昔の人物を裸の省略質問で勝手に復活させない。
    var conv=window.JINPO_BOT_CONVERSATION,conversationAware=false;
    if(conv&&typeof conv.activeRecentSubject==='function'){
      conversationAware=true;
      try{
        var activeAny=conv.activeRecentSubject(h)||null;
        var frames=typeof conv.topicFrames==='function'?(conv.topicFrames(h,{limit:12})||[]):[];
        var latestFrame=frames.length?frames[frames.length-1]:null;

        // 直近の実質話題がカープ以外なら、過去のカープ回答本文から
        // 人物名や年度を拾って文脈を復活させない。
        // 「ありがとう」等の相槌はtopicFrames側でcarryされるため、ここでは切れない。
        if((activeAny&&activeAny.type!=='person'&&activeAny.domain!=='carp')||
           (!activeAny&&latestFrame&&latestFrame.domain!=='carp')){
          return ctx;
        }

        var active=conv.activeRecentSubject(h,{personOnly:true});
        if(active&&active.value){
          var activeSub=detectCurrentSubject(active.value);
          if(activeSub&&activeSub.kind==='player'){
            ctx.player=activeSub.player;
            ctx.sourceText=S(active.userText||active.value);
          }
        }
      }catch(activeContextError){}
    }

    // 古い話題を復活させない。
    // 最大8メッセージだけ見て、別分野のユーザー発言が出たらそこで打ち切る。
    for(var i=h.length-1,count=0;i>=0&&count<8;i--,count++){
      var x=h[i]||{};
      var t=S(x.text);
      if(!t)continue;

      if(x.role==='user'&&contextBarrier(t))break;

      var sub=detectCurrentSubject(t);
      // conversation側の主役判定が利用できる時は、履歴本文から人物を拾い直さない。
      // 特にassistant回答の列挙選手を「直前人物」と誤認するのを防ぐ。
      if(!conversationAware&&sub.kind==='player'&&!ctx.player){
        ctx.player=sub.player;
        ctx.sourceText=t;
      }
      if(sub.year&&!ctx.year){
        ctx.year=sub.year;
        if(!ctx.sourceText)ctx.sourceText=t;
      }

      if(!ctx.topic){
        if(/家族|親族|妻|嫁|奥さん|夫|旦那|父|母|兄|弟|姉|妹|娘|息子/.test(t))ctx.topic='family';
        else if(/怪我|けが|ケガ|故障|アキレス腱|負傷/.test(t))ctx.topic='injury';
        else if(/逸話|伝説|名場面|エピソード|昔話/.test(t))ctx.topic='anecdote';
        else if(/優勝|日本一|黄金期|三連覇|3連覇/.test(t))ctx.topic='championship';
        else if(/監督|コーチ|首脳陣/.test(t))ctx.topic='manager';
        else if(/スタメン|打順|主力|メンバー/.test(t))ctx.topic='lineup';
        else if(/選手|どんな選手|プロフィール|経歴/.test(t))ctx.topic='player';
      }

      if(ctx.player&&ctx.year&&ctx.topic)break;
    }
    return ctx;
  }

  function followupAttribute(text){
    var t=S(text);
    if(/怪我|けが|ケガ|故障|アキレス腱|負傷/.test(t))return'injury';
    if(/(?:何歳|なんさい|年齢|いくつ)/.test(t))return'age';
    if(/(?:生年月日|誕生日|何年生まれ|なんねんうまれ|いつ生まれ)/.test(t))return'birth';
    if(/家族|親族|奥さん|妻|嫁|夫人|配偶者|夫|旦那|父|母|兄|弟|姉|妹|娘|息子/.test(t))return'family';
    if(/逸話|エピソード|昔話|伝説|名場面|他にも|もっと|別の/.test(t))return'anecdote';
    if(/出身|出生地|どこ出身|どこ生まれ/.test(t))return'birthplace';
    if(/背番号|何番/.test(t))return'number';
    if(/ポジション|守備位置|何の選手/.test(t))return'position';
    if(/(?:現在も|まだ)?現役(?:なの|ですか|だった|だっけ|でしたっけ|か)?/.test(t))return'active';
    if(/(?:今|いま|現在)(?:は|も)?(?:何してる|なにしてる|何をしてる|何している|なにしている|何をしている)|現在の所属|現在の活動|今どこ/.test(t))return'current_activity';
    if(/在籍|何年いた|いつから|いつまで|経歴|現役時代|移籍/.test(t))return'career';
    if(/成績|打率|本塁打|ホームラン|打点|防御率|勝利|セーブ|記録|タイトル/.test(t))return'record';
    if(/引退|辞めた|やめた/.test(t))return'retirement';
    if(/監督|コーチ|首脳陣/.test(t))return'manager';
    if(/主力|メンバー|選手|打線/.test(t))return'players';
    if(/スタメン|打順/.test(t))return'lineup';
    if(/順位/.test(t))return'rank';
    if(/優勝|日本一/.test(t))return'championship';
    if(/前年|翌年|次の年|その年/.test(t))return'relative_year';
    if(/どんな選手|どんな人|プロフィール|人物|詳しく/.test(t))return'profile';
    return'';
  }

  function isContextualFollowup(text,history){
    var t=S(text);
    var current=detectCurrentSubject(t);

    // 今の発言に新しい人物/年度があるなら、過去文脈を使わない。
    if(current.explicit)return false;

    var ctx=recentContext(history);
    if(!ctx.player&&!ctx.year)return false;
    if(t.length>42)return false;
    return !!followupAttribute(t);
  }

  function resolveFollowup(text,opt){
    opt=opt||{};
    var t=S(text),current=detectCurrentSubject(t);

    // 最重要:
    // 現在の発言に人物名・姓・年度がある場合は必ず現在発言を優先。
    if(current.explicit){
      return {
        text:t,
        resolved:false,
        currentSubject:true,
        context:{
          player:current.player||'',
          year:current.year||0,
          topic:'',
          sourceText:t,
          ambiguous:current.kind==='ambiguous_player'
        }
      };
    }

    var ctx=recentContext(opt.history||[]);
    var attr=followupAttribute(t);
    if(!attr||(!ctx.player&&!ctx.year)){
      return {text:t,resolved:false,context:ctx};
    }

    if(ctx.year){
      if(attr==='relative_year'){
        if(/前年/.test(t)){
          var py=ctx.year-1;
          return {text:py+'年のカープの順位と監督は？',resolved:true,context:{player:'',year:py,topic:'season'}};
        }
        if(/翌年|次の年/.test(t)){
          var ny=ctx.year+1;
          return {text:ny+'年のカープの順位と監督は？',resolved:true,context:{player:'',year:ny,topic:'season'}};
        }
      }
      if(attr==='manager')return {text:ctx.year+'年のカープの監督は？',resolved:true,context:ctx};
      if(attr==='players')return {text:ctx.year+'年のカープの主力選手は？',resolved:true,context:ctx};
      if(attr==='lineup')return {text:ctx.year+'年のカープのスタメンは？',resolved:true,context:ctx};
      if(attr==='rank'||attr==='record')return {text:ctx.year+'年のカープの順位と成績は？',resolved:true,context:ctx};
      if(attr==='championship')return {text:ctx.year+'年のカープの優勝は？',resolved:true,context:ctx};
    }

    if(ctx.player){
      if(attr==='injury')return {text:ctx.player+'の怪我・故障の逸話',resolved:true,context:ctx};
      if(attr==='family'){
        var tail=t.replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'').replace(/[？?！!。]+$/,'');
        return {text:ctx.player+'の'+tail,resolved:true,context:ctx};
      }
      if(attr==='anecdote'){
        if(/他にも|もっと|別の|他の逸話/.test(t))
          return {text:ctx.player+'の他の逸話',resolved:true,context:{player:ctx.player,year:ctx.year,topic:'player_more'}};
        return {text:ctx.player+'の逸話',resolved:true,context:{player:ctx.player,year:ctx.year,topic:'anecdote'}};
      }
      if(attr==='age')return {text:ctx.player+'の年齢は？',resolved:true,context:ctx};
      if(attr==='birth')return {text:ctx.player+'の生年月日・生年は？',resolved:true,context:ctx};
      if(attr==='birthplace')return {text:ctx.player+'の出身・出生地',resolved:true,context:ctx};
      if(attr==='number')return {text:ctx.player+'の背番号',resolved:true,context:ctx};
      if(attr==='position')return {text:ctx.player+'のポジション・守備位置',resolved:true,context:ctx};
      if(attr==='active')return {text:ctx.player+'は現在も現役？',resolved:true,context:ctx};
      if(attr==='current_activity')return {text:ctx.player+'の現在の所属・活動は？',resolved:true,context:ctx};
      if(attr==='career')return {text:ctx.player+'の在籍年・経歴・移籍',resolved:true,context:ctx};
      if(attr==='record')return {text:ctx.player+'の成績・記録・タイトル',resolved:true,context:ctx};
      if(attr==='retirement')return {text:ctx.player+'の引退・退団',resolved:true,context:ctx};
      if(attr==='profile')return {text:ctx.player+'について',resolved:true,context:ctx};
    }

    return {text:t,resolved:false,context:ctx};
  }

  function playerRelatedRecords(name){
    name=S(name);
    if(!name)return[];
    return RECORDS.filter(function(r){
      if(['anecdote','scandal','player','family'].indexOf(r.category)<0)return false;
      return (S(r.title)+' '+S(r.text)).indexOf(name)>=0;
    }).sort(function(a,b){
      var order={anecdote:4,scandal:3,family:2,player:1};
      var da=order[a.category]||0,db=order[b.category]||0;
      if(db!==da)return db-da;
      return (b.priority||0)-(a.priority||0);
    });
  }

  function nextPlayerStory(name){
    var list=playerRelatedRecords(name);
    if(!list.length){
      return {
        handled:true,
        answer:name+'について、今のカープ正本資料では追加の人物別エピソードを確認できなかったのですよ。資料にない話を推測では足しません。',
        kind:'player_more',
        player:name
      };
    }

    var key='arukimikoCarpPlayerMore.v1.'+name,n=0;
    try{n=Number(sessionStorage.getItem(key)||0)||0;}catch(e){}
    var r=list[n%list.length];
    try{sessionStorage.setItem(key,String((n+1)%list.length));}catch(e){}

    return {
      handled:true,
      answer:'【'+cleanText(r.title)+'】\n'+snippet(r,560),
      kind:'player_more',
      player:name
    };
  }

  function membershipAnswer(text){
    var names=foundNames(text);
    if(!names.length)return null;
    var t=S(text);
    // 経歴の詳細質問を「在籍していたか」のYes/No判定へ潰さない。
    if(/経歴|在籍年|何年いた|いつから|いつまで|現役時代|移籍|FA|復帰|入団|退団|ドラフト|所属歴/.test(t))return null;
    if(!/いた|在籍|所属|元カープ|カープの選手|広島にいた|広島で|OB|選手だった|いる/.test(t))return null;

    var name=names[0],cur=currentPlayerByName(name);
    if(cur){
      return {
        handled:true,
        answer:name+'は、資料基準日（'+D.sourceDate+'）ではカープの'+cur.position+'で、背番号'+cur.number+'、'+cur.status+'なのですよ。',
        kind:'membership',
        player:name
      };
    }
    if(NAME_SET[name]){
      return {
        handled:true,
        answer:name+'は、カープの歴代在籍・退団・移籍選手索引に収録されています。カープ在籍経験がある選手として扱って大丈夫なのですよ。',
        kind:'membership',
        player:name
      };
    }
    return null;
  }

  function profileRecord(name){
    name=S(name);
    if(!name)return null;
    for(var i=0;i<RECORDS.length;i++){
      var r=RECORDS[i];
      if(S(r.title)==='人物:'+name)return r;
    }
    return null;
  }

  function focusedFamilyRelation(text){
    var t=S(text);
    if(/奥さん|妻|嫁|夫人|配偶者/.test(t))return {key:'spouse',label:'妻・配偶者',re:/妻|嫁|奥さん|夫人|配偶者/};
    if(/(?:^|の)(?:夫|旦那)(?:は|って|の|$)/.test(t))return {key:'spouse',label:'夫・配偶者',re:/夫|旦那|配偶者/};
    if(/父親|父/.test(t))return {key:'father',label:'父',re:/父|父親/};
    if(/母親|母/.test(t))return {key:'mother',label:'母',re:/母|母親/};
    if(/兄弟|兄|弟/.test(t))return {key:'brother',label:'兄弟',re:/兄弟|兄|弟/};
    if(/姉妹|姉|妹/.test(t))return {key:'sister',label:'姉妹',re:/姉妹|姉|妹/};
    if(/息子|娘|子供|子ども/.test(t))return {key:'child',label:'子ども',re:/息子|娘|子供|子ども/};
    return null;
  }

  // 人物の短い属性質問は、広い全文検索へ落として無関係な資料を混ぜない。
  // 正本に明記がなければ推測せず、その旨だけを返す。
  function playerAttributeAnswer(text){
    var t=S(text),names=foundNames(t);
    if(!names.length)return null;
    var name=names[0],attr=followupAttribute(t),profile=profileRecord(name),cur=currentPlayerByName(name);

    if(attr==='age'||attr==='birth'){
      return {
        handled:true,
        answer:name+'の'+(attr==='age'?'年齢':'生年月日・生年')+'については、今のカープ正本資料では確認できないのですよ。資料にない数字は推測で補いません。',
        kind:'player_attribute_unknown',player:name,attribute:attr
      };
    }

    if(attr==='family'){
      var rel=focusedFamilyRelation(t);
      if(!rel)return null;
      var family=RECORDS.filter(function(r){
        if(r.category!=='family')return false;
        var full=S(r.title)+' '+S(r.text);
        return full.indexOf(name)>=0&&rel.re.test(full);
      }).sort(function(a,b){return (b.priority||0)-(a.priority||0);});
      if(!family.length){
        return {
          handled:true,
          answer:name+'の'+rel.label+'については、今のカープ正本資料では確認できないのですよ。家族資料にない私生活情報は推測で補いません。',
          kind:'player_family_relation_unknown',player:name,attribute:rel.key
        };
      }
      var familyLines=[],seen={};
      for(var fi=0;fi<family.length&&familyLines.length<2;fi++){
        var fr=family[fi],sig=compact(fr.text);if(seen[sig])continue;seen[sig]=1;
        familyLines.push('【'+cleanText(fr.title)+'】\n'+snippet(fr,520));
      }
      return {
        handled:true,
        answer:name+'の'+rel.label+'について、カープ正本ではこう確認できます。\n'+familyLines.join('\n\n'),
        kind:'player_family_relation',player:name,attribute:rel.key
      };
    }

    if(attr==='retirement'){
      var tail=profile?' 正本の人物記録では「'+snippet(profile,260)+'」までは確認できます。':'';
      return {
        handled:true,
        answer:name+'の引退年については、今のカープ正本資料では「引退年」として明記された記録を確認できないのですよ。'+tail+' 引退年は推測で断定しません。',
        kind:'player_retirement',player:name,attribute:'retirement'
      };
    }

    if(attr==='active'){
      if(cur){
        return {
          handled:true,
          answer:'資料基準日（'+D.sourceDate+'）では、'+name+'はカープの現役選手名簿に載っていて、'+cur.position+'・背番号'+cur.number+'・'+cur.status+'なのですよ。',
          kind:'player_active',player:name,attribute:'active'
        };
      }
      var hist=profile?' 正本の人物記録では「'+snippet(profile,260)+'」と確認できます。':'';
      return {
        handled:true,
        answer:'資料基準日（'+D.sourceDate+'）では、'+name+'はカープの現役選手名簿には載っていません。'+hist+' 他球団を含む現在の現役状況は、この正本だけでは推測で断定しません。',
        kind:'player_active',player:name,attribute:'active'
      };
    }

    if(attr==='current_activity'){
      if(cur){
        return {
          handled:true,
          answer:'資料基準日（'+D.sourceDate+'）では、'+name+'はカープの'+cur.position+'で、背番号'+cur.number+'、'+cur.status+'なのですよ。',
          kind:'player_current_activity',player:name,attribute:'current_activity'
        };
      }
      var currentRecords=RECORDS.filter(function(r){
        var full=S(r.title)+' '+S(r.text);
        if(full.indexOf(name)<0)return false;
        return /2026年現在|2026年.*(?:監督|コーチ)|現監督|2023-\s*\/|2023年から監督|2023年.*監督に就任/.test(full);
      }).sort(function(a,b){
        function currentFocus(r){
          var title=S(r.title),text=S(r.text),score=Number(r.priority)||0;
          // 「今何してる？」では家族記事より、現在の役職・人物記録を優先する。
          if(r.category==='manager')score+=500;
          else if(r.category==='player')score+=300;
          else if(r.category==='family')score-=200;
          if(/監督時代|監督就任|在任.*監督/.test(title))score+=260;
          if(/^人物:/.test(title))score+=180;
          if(/2026年現在も監督|2026年.*(?:1軍|一軍)?監督/.test(text))score+=160;
          return score;
        }
        return currentFocus(b)-currentFocus(a);
      });
      if(currentRecords.length){
        var cr=currentRecords[0];
        return {
          handled:true,
          answer:name+'の現在の活動について、カープ正本ではこう確認できます。\n【'+cleanText(cr.title)+'】\n'+snippet(cr,560),
          kind:'player_current_activity',player:name,attribute:'current_activity'
        };
      }
      return {
        handled:true,
        answer:name+'の現在の所属・活動については、今のカープ正本資料では確認できないのですよ。最新状況を正本にない内容で推測はしません。',
        kind:'player_current_activity_unknown',player:name,attribute:'current_activity'
      };
    }

    return null;
  }

  function rosterNumberAnswer(text){
    var t=S(text),m=t.match(/背番号\s*([0-9]{1,3})/);
    if(!m)return null;
    var p=currentPlayerByNumber(m[1]);
    if(!p)return null;
    return {
      handled:true,
      answer:'資料基準日（'+D.sourceDate+'）では、カープの背番号'+p.number+'は'+p.name+'（'+p.position+'・'+p.status+'）なのですよ。現在の登録は変わる可能性があるので、最新確認が必要な時はNPB情報を優先します。',
      kind:'roster_number',
      player:p.name
    };
  }

  function seasonAnswer(text){
    var t=S(text),m=t.match(/((?:19|20)\d{2})年?/);
    if(!m)return null;
    var year=m[1],row=D.seasons&&D.seasons[year];
    if(!row)return null;
    if(!/順位|何位|監督|シーズン|年度|成績|どうだった|何だった|なんだった/.test(t))return null;
    var a=year+'年のカープは'+row.rank+'、監督は'+row.manager+'なのですよ。';
    if(row.note)a+=' '+row.note;
    return {handled:true,answer:a,kind:'season',year:year};
  }

  function mainPlayersAnswer(text){
    var t=S(text),m=t.match(/((?:19|20)\d{2})年?/);
    if(!m||!/主力|メンバー|中心選手|主力選手|打線/.test(t))return null;

    var year=Number(m[1]),hits=[];

    RECORDS.forEach(function(r){
      var title=S(r.title),full=title+' '+S(r.text);
      var rm=title.match(/((?:19|20)\d{2})\s*[-〜~]\s*((?:19|20)?\d{2})/);
      if(rm){
        var a=Number(rm[1]),b=Number(rm[2]);
        if(b<100)b=Math.floor(a/100)*100+b;
        if(year>=a&&year<=b&&/主力|打線|投手|選手|優勝|黄金期/.test(full))
          hits.push({r:r,score:30+(r.priority||0)});
      }
    });

    var decade=Math.floor(year/10)*10;
    RECORDS.forEach(function(r){
      var full=S(r.title)+' '+S(r.text);
      if(r.category==='player'&&full.indexOf(decade+'年代')>=0)
        hits.push({r:r,score:20+(r.priority||0)});
    });

    hits.sort(function(a,b){return b.score-a.score;});
    if(!hits.length)return null;

    var lines=[],seen={};
    for(var i=0;i<hits.length&&lines.length<2;i++){
      var r=hits[i].r,sig=compact(r.text);
      if(seen[sig])continue;
      seen[sig]=1;
      lines.push('【'+cleanText(r.title).replace(/^\d+(?:-\d+)?\.\s*/,'')+'】\n'+snippet(r,600));
    }

    return {
      handled:true,
      answer:year+'年の主力を見るなら、カープ正本ではこの構成が近いのですよ。\n'+lines.join('\n\n'),
      kind:'year_main_players',
      year:String(year)
    };
  }

  function championshipAnswer(text){
    var t=S(text),m=t.match(/(1975|1979|1980|1984|1986|1991|2016|2017|2018)年?/);
    if(!m)return null;
    var row=D.championships&&D.championships[m[1]];
    if(!row)return null;
    if(!/優勝|日本一|シーズン|成績|どうだった|何があった/.test(t))return null;
    return {
      handled:true,
      answer:m[1]+'年は'+row.achievement+'。成績は'+row.record+'。'+row.meaning,
      kind:'championship',
      year:m[1]
    };
  }

  var CONCEPTS=[
    ['family',['家族','親族','妻','嫁','奥さん','夫','旦那','父','父親','母','兄','弟','姉','妹','娘','息子','兄弟','夫婦']],
    ['anecdote',['逸話','伝説','名場面','昔話','エピソード','珍プレー','神ってる','江夏の21球','赤ヘル','樽募金']],
    ['scandal',['スキャンダル','不祥事','事件','問題','処分','ドーピング','逮捕','起訴','判決','暴力','金銭授受','FA移籍','論争','件']],
    ['foreign',['外国人','助っ人','アカデミー','ドミニカ']],
    ['manager',['監督','首脳陣','コーチ']],
    ['championship',['優勝','日本一','黄金期','三連覇','3連覇']],
    ['culture',['球場','市民球場','マツダスタジアム','ズムスタ','ファン','カープ女子','応援']],
    ['lineup',['スタメン','先発打順','打順','主力構成']],
    ['retired',['永久欠番','背番号3','背番号8','背番号15']],
    ['record',['記録','ノーヒットノーラン','トリプルスリー','連続安打','連続試合出場']]
  ];

  function pushTerm(arr,seen,x){
    x=S(x).replace(/^(?:元|現)/,'').replace(/(?:監督|選手|コーチ|さん|氏|くん|ちゃん|の件|件)$/g,'').trim();
    if(x.length>=2&&!seen[x]){seen[x]=1;arr.push(x);}
  }

  function queryTerms(text){
    var t=S(text),terms=[],seen={};

    foundNames(t).forEach(function(n){pushTerm(terms,seen,n);});

    var years=t.match(/(?:19|20)\d{2}/g)||[];
    years.forEach(function(y){pushTerm(terms,seen,y);});

    CONCEPTS.forEach(function(pair){
      pair[1].forEach(function(k){
        if(t.indexOf(k)>=0)pushTerm(terms,seen,k);
      });
    });

    var remainder=t
      .replace(/広島東洋カープ|広島カープ|カープ|かーぷ/gi,' ')
      .replace(/について|って何|ってなに|とは|教えて|知りたい|どんな|何があった|何だった|誰|だれ|あるの|ある？|ある\?|は？|は\?|ですか|なの|詳しく|もっと|他にも|ほかにも/g,' ');

    // Japanese follow-up phrasing:
    // 「緒方監督と野間の件」→「緒方」「野間」
    remainder.split(/(?:について|って|とは|と|の|を|が|は|へ|に|から|で|件|こと)/).forEach(function(seg){
      seg=seg.replace(/(?:監督|選手|コーチ|さん|氏|くん|ちゃん)/g,' ').trim();
      seg.split(/\s+/).forEach(function(x){pushTerm(terms,seen,x);});
    });

    return terms;
  }

  function scoreRecord(record,text,terms){
    var title=S(record.title),body=S(record.text),full=title+' '+body;
    var score=Number(record.priority)||1;
    var q=compact(text),cf=compact(full);

    if(q&&q.length>=3&&cf.indexOf(q)>=0)score+=50;

    terms.forEach(function(term){
      if(title.indexOf(term)>=0)score+=22;
      if(body.indexOf(term)>=0)score+=10;

      if(/妻|嫁|奥さん|夫|旦那|父|母|兄|弟|姉|妹|娘|息子|家族|親族/.test(term)&&record.category==='family')score+=14;
      if(/事件|不祥事|スキャンダル|処分|逮捕|起訴|判決|ドーピング|暴力|論争|件/.test(term)&&record.category==='scandal')score+=14;
      if(/逸話|伝説|名場面|昔話|エピソード/.test(term)&&record.category==='anecdote')score+=14;
    });

    var names=foundNames(text);
    if(names.length){
      names.forEach(function(name){
        if(title.indexOf(name)>=0)score+=35;
        if(body.indexOf(name)>=0)score+=24;
      });
      if(!names.some(function(name){return full.indexOf(name)>=0;}))score-=35;
    }

    // Two or more non-generic terms matching one record is highly specific.
    var matched=0;
    terms.forEach(function(term){
      if(term.length>=2&&full.indexOf(term)>=0)matched++;
    });
    if(matched>=2)score+=matched*12;

    return score;
  }

  function search(text,limit){
    limit=Math.max(1,Number(limit)||4);
    var terms=queryTerms(text);
    var scored=RECORDS.map(function(r){
      return {record:r,score:scoreRecord(r,text,terms)};
    }).filter(function(x){return x.score>=14;});

    scored.sort(function(a,b){
      if(b.score!==a.score)return b.score-a.score;
      return (b.record.priority||0)-(a.record.priority||0);
    });

    var out=[],seen={};
    for(var i=0;i<scored.length&&out.length<limit;i++){
      var r=scored[i].record,sig=compact(r.text);
      if(seen[sig])continue;
      seen[sig]=1;
      out.push({record:r,score:scored[i].score});
    }
    return out;
  }

  function snippet(record,max){
    max=max||440;
    var text=cleanText(record.text);
    if(text.length>max)text=text.slice(0,max).replace(/[、,][^、,]{0,30}$/,'')+'…';
    return text;
  }

  function answerFromSearch(text){
    var names=foundNames(text);
    var t=S(text);
    var familyCue=/家族|親族|妻|嫁|奥さん|夫|旦那|父|母|兄|弟|姉|妹|娘|息子|兄弟|夫婦/.test(t);
    var scandalCue=/スキャンダル|不祥事|事件|問題|処分|ドーピング|逮捕|起訴|判決|暴力|論争|の件/.test(t);
    var anecdoteCue=/逸話|伝説|名場面|昔話|エピソード|江夏の21球|神ってる|樽募金|赤ヘル/.test(t);
    var recordCue=/成績|記録|タイトル|打率|本塁打|ホームラン|打点|防御率|勝利|セーブ|安打|MVP|最優秀/.test(t);
    var careerCue=/経歴|在籍|現役時代|移籍|FA|復帰|入団|退団|ドラフト|所属/.test(t);
    var overviewCue=!!(names.length&&!familyCue&&!scandalCue&&!anecdoteCue&&!recordCue&&!careerCue&&
      /について(?:教えて|知りたい|説明して|詳しく)?|どんな(?:人|選手|人物)|プロフィール|人物(?:像)?/.test(t));
    var focused=!!(familyCue||scandalCue||anecdoteCue||(names.length&&(recordCue||careerCue||overviewCue)));
    // 観点指定時は上位5件だけで打ち切らず、名前一致の正本候補を少し広く見てから絞る。
    var hits=search(text,focused?14:5);
    if(!hits.length)return null;

    function fullText(h){return S(h&&h.record&&h.record.title)+' '+S(h&&h.record&&h.record.text);}
    function hasName(h){
      if(!names.length)return true;
      var full=fullText(h);
      return names.some(function(name){return full.indexOf(name)>=0;});
    }

    var preferred=hits.filter(function(h){
      var r=h.record||{},full=fullText(h),title=S(r.title);
      if(familyCue)return r.category==='family'&&hasName(h);
      if(scandalCue)return r.category==='scandal'&&hasName(h);
      if(anecdoteCue)return r.category==='anecdote'&&hasName(h);
      if(recordCue&&names.length){
        if(!hasName(h)||['family','editorial','culture','overview'].indexOf(r.category)>=0)return false;
        if(/^人物:/.test(title))return true;
        // 個人の実績・受賞・具体的な勝敗数がある資料だけを成績回答へ残す。
        if(/(?:\d{2,4}安打|\d{2,4}本塁打|通算\d{2,4}勝|日米通算\d{2,4}勝|防御率\s*\d|打率\s*[.0-9]|\d+勝\d+敗)/.test(full))return true;
        if(/MVP|最優秀|首位打者|本塁打王|打点王|最多勝|沢村賞|タイトル|記録達成/.test(title))return true;
        return false;
      }
      if(careerCue&&names.length){
        if(!hasName(h)||['family','editorial','culture','overview'].indexOf(r.category)>=0)return false;
        if(/^人物:/.test(title))return true;
        if(/移籍|FA|復帰|入団|退団|引退|ドラフト|MLB|メジャー|監督時代|監督就任/.test(title))return true;
        if(r.category==='player'&&/在籍|移籍|FA|復帰|入団|退団|引退|ドラフト|MLB|メジャー|阪神|所属/.test(full))return true;
        return false;
      }
      if(overviewCue&&names.length){
        if(!hasName(h)||['family','scandal','editorial','culture','overview','season','lineup'].indexOf(r.category)>=0)return false;
        if(/^人物:/.test(title))return true;
        return ['player','manager','anecdote','championship','history'].indexOf(r.category)>=0;
      }
      return true;
    });
    if(recordCue&&names.length&&preferred.length){
      preferred.sort(function(a,b){
        function focusScore(h){
          var r=h.record||{},full=fullText(h),title=S(r.title),score=0;
          if(/^人物:/.test(title))score+=100;
          if(/(?:\d{2,4}安打|\d{2,4}本塁打|通算\d{2,4}勝|日米通算\d{2,4}勝|防御率\s*\d|打率\s*[.0-9])/.test(full))score+=90;
          if(/MVP|最優秀|首位打者|本塁打王|打点王|最多勝|沢村賞|タイトル|記録達成/.test(full))score+=45;
          if(/\d+勝\d+敗/.test(full)&&r.category==='manager')score+=35;
          return score+(Number(h.score)||0)/1000;
        }
        return focusScore(b)-focusScore(a);
      });
    }
    if(careerCue&&names.length&&preferred.length){
      preferred.sort(function(a,b){
        function focusScore(h){
          var r=h.record||{},full=fullText(h),title=S(r.title),score=0;
          if(/^人物:/.test(title))score+=100;
          if(/移籍|FA|復帰|MLB|メジャー|阪神/.test(full))score+=70;
          if(/入団|退団|引退|ドラフト|在籍/.test(full))score+=45;
          if(/監督就任/.test(full))score+=20;
          return score+(Number(h.score)||0)/1000;
        }
        return focusScore(b)-focusScore(a);
      });
    }
    if(overviewCue&&names.length&&preferred.length){
      preferred.sort(function(a,b){
        function focusScore(h){
          var r=h.record||{},title=S(r.title),score=0;
          if(/^人物:/.test(title))score+=200;
          else if(r.category==='manager')score+=70;
          else if(r.category==='anecdote')score+=55;
          else if(r.category==='championship')score+=45;
          else if(r.category==='history')score+=35;
          else if(r.category==='player')score+=30;
          return score+(Number(h.score)||0)/1000;
        }
        return focusScore(b)-focusScore(a);
      });
    }
    if(overviewCue&&preferred.length){
      var seenOverviewCategory={};
      preferred=preferred.filter(function(h){
        var c=S(h&&h.record&&h.record.category)||'other';
        if(seenOverviewCategory[c])return false;
        seenOverviewCategory[c]=1;
        return true;
      });
    }
    // 観点が明示されている時は無関係な残りを混ぜない。
    if(preferred.length&&focused){
      hits=preferred;
    }else if(familyCue&&names.length){
      return {
        handled:true,
        answer:names[0]+'の家族・親族について、今のカープ正本資料で公表済みとして確認できる記載は見つからなかったのですよ。非公表情報は推測で補いません。',
        kind:'family_not_found',
        player:names[0]
      };
    }

    var maxBlocks=names.length?3:2,lines=[];
    for(var i=0;i<hits.length&&lines.length<maxBlocks;i++){
      var r=hits[i].record;
      var title=cleanText(r.title).replace(/^\d+(?:-\d+)?\.\s*/,'');
      var body=snippet(r,names.length?460:520);
      if(body)lines.push('【'+title+'】\n'+body);
    }
    if(!lines.length)return null;

    var lead=names.length
      ? names[0]+'について、カープ専用資料ではこう整理されています。'
      : 'カープ専用資料では、こう整理されています。';

    return {
      handled:true,
      answer:lead+'\n'+lines.join('\n\n'),
      kind:'knowledge_search',
      hits:hits.slice(0,maxBlocks).map(function(x){return x.record.id;})
    };
  }

  var MORE_KEY='arukimikoCarpKnowledgeMore.v1';
  function nextAnecdote(){
    var list=RECORDS.filter(function(r){return r.category==='anecdote';});
    if(!list.length)return null;
    var n=0;
    try{n=Number(sessionStorage.getItem(MORE_KEY)||0)||0;}catch(e){}
    var r=list[n%list.length];
    try{sessionStorage.setItem(MORE_KEY,String((n+1)%list.length));}catch(e){}
    return {handled:true,answer:'【'+cleanText(r.title)+'】\n'+snippet(r,560),kind:'anecdote'};
  }

  function answer(text,opt){
    opt=opt||{};
    var resolved=resolveFollowup(text,opt);
    var t=S(resolved.text);

    var amb=ambiguityAnswer(t);
    if(amb)return amb;

    // 年齢・配偶者・現役・引退・現在活動など人物属性は、
    // realtime判定や広い全文検索より先に正本の明記有無を確認する。
    var attributeAnswer=playerAttributeAnswer(t);
    if(attributeAnswer){attributeAnswer.resolvedQuery=t;attributeAnswer.context=resolved.context;return attributeAnswer;}

    if(isRealtimeQuery(t))return null;

    if(resolved.context&&resolved.context.player&&resolved.context.topic==='player_more'){
      var pm=nextPlayerStory(resolved.context.player);
      pm.resolvedQuery=t;pm.context=resolved.context;
      return pm;
    }

    var more=/^(?:カープの)?(?:もっと|他にも|ほかにも|他には|ほかには|別の|もう一つ|もう1つ|続き)[？?！!。]*$/.test(t);
    if(more&&opt.moreKind==='anecdote')return nextAnecdote();

    var x=rosterNumberAnswer(t);if(x){x.resolvedQuery=t;x.context=resolved.context;return x;}
    x=membershipAnswer(t);if(x){x.resolvedQuery=t;x.context=resolved.context;return x;}
    x=mainPlayersAnswer(t);if(x){x.resolvedQuery=t;x.context=resolved.context;return x;}
    x=seasonAnswer(t);if(x){x.resolvedQuery=t;x.context=resolved.context;return x;}
    x=championshipAnswer(t);if(x){x.resolvedQuery=t;x.context=resolved.context;return x;}

    if(/逸話|昔話|名場面|伝説|別の逸話|他の逸話/.test(t)&&foundNames(t).length===0){
      x=nextAnecdote();
      if(x){x.resolvedQuery=t;x.context=resolved.context;}
      return x;
    }

    x=answerFromSearch(t);
    if(x){x.resolvedQuery=t;x.context=resolved.context;}
    return x;
  }

  window.JINPO_BOT_CARP_KNOWLEDGE={
    version:VERSION,
    sourceDate:D.sourceDate||'2026-07-28',
    stats:D.stats||{},
    answer:answer,
    search:search,
    queryTerms:queryTerms,
    detectCurrentSubject:detectCurrentSubject,
    ambiguityAnswer:ambiguityAnswer,
    recentContext:recentContext,
    followupAttribute:followupAttribute,
    isContextualFollowup:isContextualFollowup,
    resolveFollowup:resolveFollowup,
    playerRelatedRecords:playerRelatedRecords,
    nextPlayerStory:nextPlayerStory,
    mainPlayersAnswer:mainPlayersAnswer,
    isRealtimeQuery:isRealtimeQuery,
    hasKnownEntity:hasKnownEntity,
    foundNames:foundNames,
    nextAnecdote:nextAnecdote,
    currentPlayerByName:currentPlayerByName,
    currentPlayerByNumber:currentPlayerByNumber
  };
})();
