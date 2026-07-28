/*
 * 歩き巫女 広島東洋カープ正本知識検索 v1.1.0
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_CARP_KNOWLEDGE)return;

  var VERSION='1.1.0';
  var D=window.JINPO_BOT_CARP_KNOWLEDGE_DATA||{};
  var RECORDS=Array.isArray(D.records)?D.records:[];
  var CURRENT=Array.isArray(D.currentPlayers)?D.currentPlayers:[];
  var HIST=Array.isArray(D.historicalPlayers)?D.historicalPlayers:[];
  var ALL_NAMES=CURRENT.map(function(x){return x.name;}).concat(HIST);
  var NAME_SET={};
  ALL_NAMES.forEach(function(n){NAME_SET[n]=1;});

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
    var t=S(text),out=[];
    var sorted=ALL_NAMES.slice().sort(function(a,b){return b.length-a.length;});
    for(var i=0;i<sorted.length;i++){
      if(t.indexOf(sorted[i])>=0){
        out.push(sorted[i]);
        if(out.length>=4)break;
      }
    }
    return out;
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

  function recentContext(history){
    var h=Array.isArray(history)?history:[];
    var ctx={player:'',year:0,topic:'',sourceText:''};

    for(var pass=0;pass<2;pass++){
      for(var i=h.length-1;i>=0&&i>=h.length-24;i--){
        var x=h[i]||{};
        if(pass===0&&x.role!=='user')continue;
        if(pass===1&&x.role!=='assistant')continue;

        var t=S(x.text);
        if(!t)continue;

        if(!ctx.player){
          var names=foundNames(t);
          if(names.length)ctx.player=names[0];
        }
        if(!ctx.year){
          var ym=t.match(/((?:19|20)\d{2})年?/);
          if(ym)ctx.year=Number(ym[1]);
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
        if((ctx.player||ctx.year)&&!ctx.sourceText)ctx.sourceText=t;
        if(ctx.player&&ctx.year&&ctx.topic)break;
      }
    }
    return ctx;
  }

  function isContextualFollowup(text,history){
    var t=S(text),ctx=recentContext(history);
    if(!ctx.player&&!ctx.year)return false;
    if(t.length>36)return false;
    if(foundNames(t).length||/(?:19|20)\d{2}/.test(t))return false;

    return /怪我|けが|ケガ|故障|アキレス腱|家族|親族|奥さん|妻|嫁|夫|父|母|兄|弟|姉|妹|娘|息子|逸話|エピソード|昔話|伝説|他の逸話|もっと|他にも|監督|コーチ|主力|メンバー|スタメン|打順|順位|成績|優勝|日本一|前年|翌年|次の年|その年|どんな選手|経歴|プロフィール/.test(t);
  }

  function resolveFollowup(text,opt){
    opt=opt||{};
    var t=S(text),ctx=recentContext(opt.history||[]);

    if(!isContextualFollowup(t,opt.history||[])){
      return {text:t,resolved:false,context:ctx};
    }

    if(ctx.year){
      if(/(?:その)?前年|一年前|1年前/.test(t)){
        var py=ctx.year-1;
        return {text:py+'年のカープの順位と監督は？',resolved:true,context:{player:ctx.player,year:py,topic:'season'}};
      }
      if(/翌年|次の年|その次の年/.test(t)){
        var ny=ctx.year+1;
        return {text:ny+'年のカープの順位と監督は？',resolved:true,context:{player:ctx.player,year:ny,topic:'season'}};
      }
      if(/監督|コーチ|首脳陣/.test(t))
        return {text:ctx.year+'年のカープの監督は？',resolved:true,context:ctx};
      if(/主力|メンバー|選手|打線/.test(t))
        return {text:ctx.year+'年のカープの主力選手は？',resolved:true,context:ctx};
      if(/スタメン|打順/.test(t))
        return {text:ctx.year+'年のカープのスタメンは？',resolved:true,context:ctx};
      if(/順位|成績/.test(t))
        return {text:ctx.year+'年のカープの順位と成績は？',resolved:true,context:ctx};
      if(/優勝|日本一/.test(t))
        return {text:ctx.year+'年のカープの優勝は？',resolved:true,context:ctx};
    }

    if(ctx.player){
      if(/怪我|けが|ケガ|故障|アキレス腱|負傷/.test(t))
        return {text:ctx.player+'の怪我・故障の逸話',resolved:true,context:ctx};

      if(/家族|親族|奥さん|妻|嫁|夫|旦那|父|母|兄|弟|姉|妹|娘|息子/.test(t)){
        var tail=t.replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'').replace(/[？?！!。]+$/,'');
        return {text:ctx.player+'の'+tail,resolved:true,context:ctx};
      }

      if(/他の逸話|別の逸話|もっと.*逸話|他にも|もっと/.test(t))
        return {text:ctx.player+'の他の逸話',resolved:true,context:{player:ctx.player,year:ctx.year,topic:'player_more'}};

      if(/逸話|エピソード|昔話|伝説|名場面/.test(t))
        return {text:ctx.player+'の逸話',resolved:true,context:{player:ctx.player,year:ctx.year,topic:'anecdote'}};

      if(/どんな選手|経歴|プロフィール|どんな人/.test(t))
        return {text:ctx.player+'について',resolved:true,context:{player:ctx.player,year:ctx.year,topic:'player'}};
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
    var hits=search(text,5);
    if(!hits.length)return null;

    var names=foundNames(text);
    var t=S(text);
    var familyCue=/家族|親族|妻|嫁|奥さん|夫|旦那|父|母|兄|弟|姉|妹|娘|息子|兄弟|夫婦/.test(t);
    var scandalCue=/スキャンダル|不祥事|事件|問題|処分|ドーピング|逮捕|起訴|判決|暴力|論争|の件/.test(t);
    var anecdoteCue=/逸話|伝説|名場面|昔話|エピソード|江夏の21球|神ってる|樽募金|赤ヘル/.test(t);

    var preferred=hits.filter(function(h){
      if(familyCue)return h.record.category==='family';
      if(scandalCue)return h.record.category==='scandal';
      if(anecdoteCue)return h.record.category==='anecdote';
      return true;
    });
    if(preferred.length){
      var rest=hits.filter(function(x){return preferred.indexOf(x)<0;});
      hits=preferred.concat(rest);
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
    recentContext:recentContext,
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
