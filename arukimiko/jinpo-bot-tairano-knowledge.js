/*
 * 歩き巫女 たいらの野望 専用知識エンジン v1.4.0
 *
 * v1.1:
 * - ひらがな/カタカナ統一
 * - 長音を省いた入力（カウンター→かうんた）
 * - 「ぜんまかうんた」のような無スペース省略
 * - 読みの前方/後方/部分省略
 * - 1文字程度のタイプミス
 * - 同名・同姓候補の曖昧さを検出して勝手に決めない
 * - 公開サイトの正本値をWeb検索より優先
 */
(function(){
  'use strict';
  if(window.JINPO_TAIRANO_KNOWLEDGE)return;
  var VERSION='1.4.0';

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function hira(v){
    var s=S(v).toLowerCase();
    s=s.replace(/[\u30a1-\u30f6]/g,function(ch){
      return String.fromCharCode(ch.charCodeAt(0)-0x60);
    });
    return s
      .replace(/[ｰー]/g,'')
      .replace(/[？?！!。、・「」『』【】（）()\[\]［］:：=＝,，.\s]/g,'');
  }
  function N(v){ return hira(v); }

  function rootUrl(){
    try{return new URL('/',location.href).href;}catch(e){return'/';}
  }
  function pageLink(label,path){
    try{return {label:label,url:new URL(path,rootUrl()).href};}
    catch(e){return {label:label,url:path};}
  }
  function wantsNavigation(text){
    return /どこ|ページ|開い|見たい|行きたい|案内|リンク|表を開|表見せ|確認ページ|移動/.test(S(text));
  }

  function recentText(history,role,limit){
    var h=Array.isArray(history)?history:[],out=[];
    for(var i=h.length-1;i>=0&&out.length<(limit||8);i--){
      if(!h[i]||h[i].role!==role)continue;
      if(S(h[i].text))out.push(S(h[i].text));
    }
    return out;
  }
  function recentHas(history,re){
    return recentText(history,'assistant',7)
      .concat(recentText(history,'user',7))
      .some(function(t){return re.test(t);});
  }

  function editDistance(a,b,max){
    a=N(a);b=N(b);
    var la=a.length,lb=b.length;
    if(a===b)return 0;
    if(!la)return lb;if(!lb)return la;
    if(max!=null&&Math.abs(la-lb)>max)return max+1;
    var prev=new Array(lb+1),cur=new Array(lb+1);
    for(var j=0;j<=lb;j++)prev[j]=j;
    for(var i=1;i<=la;i++){
      cur[0]=i;var rowMin=cur[0];
      for(var k=1;k<=lb;k++){
        var cost=a.charAt(i-1)===b.charAt(k-1)?0:1;
        cur[k]=Math.min(cur[k-1]+1,prev[k]+1,prev[k-1]+cost);
        if(cur[k]<rowMin)rowMin=cur[k];
      }
      if(max!=null&&rowMin>max)return max+1;
      var tmp=prev;prev=cur;cur=tmp;
    }
    return prev[lb];
  }

  var COUNTER_FORMS=[
    'かうんた','かうんたあ','かうん','かうんたー','かうんたぁ',
    'かんうた','かうた','かんた','counter','カウンター','カウンタ'
  ].map(N).filter(Boolean);

  function detectCue(text){
    var t=N(text),best='';
    for(var i=0;i<COUNTER_FORMS.length;i++){
      var c=COUNTER_FORMS[i];
      if(t.indexOf(c)>=0&&c.length>best.length)best=c;
    }
    if(best)return {found:true,form:best,fuzzy:false};
    // 4文字以上の入力片に対し1編集まで許容。短すぎる誤爆は避ける。
    for(var start=0;start<t.length;start++){
      for(var len=3;len<=6&&start+len<=t.length;len++){
        var part=t.slice(start,start+len);
        for(var j=0;j<COUNTER_FORMS.length;j++){
          var target=COUNTER_FORMS[j];
          if(target.length<3)continue;
          if(editDistance(part,target,1)<=1){
            return {found:true,form:part,fuzzy:true};
          }
        }
      }
    }
    return {found:false,form:'',fuzzy:false};
  }

  function stripCounterCue(text,cue){
    var t=N(text);
    if(cue&&cue.form)t=t.replace(cue.form,'');
    t=t.replace(/(?:ひょう|表|ぺえじ|ページ)?(?:を)?(?:ひらいて|開いて|みせて|見せて|みたい|見たい|かくにん|確認)+$/g,'');
    t=t.replace(/(?:の|は|って|を|おしえて|教えて|いくつ|なんばん|何番|なに|何)+$/g,'');
    t=t.replace(/^(?:じゃあ|では|なら|えっと|ねえ|ねぇ)+/g,'');
    return t;
  }

  function unique(arr){
    var seen={},out=[];
    (arr||[]).forEach(function(x){x=N(x);if(x&&!seen[x]){seen[x]=1;out.push(x);}});
    return out;
  }

  function nameForms(f){
    var base=[];
    (f.aliases||[]).forEach(function(x){base.push(x);});
    (f.readings||[]).forEach(function(x){base.push(x);});
    base.push(f.canonical||'');
    var forms=unique(base),more=[];
    forms.forEach(function(x){
      if(x.length>=5){
        more.push(x.slice(0,3),x.slice(0,4),x.slice(0,5));
        more.push(x.slice(-3),x.slice(-4),x.slice(-5));
      }else if(x.length===4){
        more.push(x.slice(0,3),x.slice(-3));
      }
    });
    return unique(forms.concat(more));
  }

  function nameMatchScore(rem,f,cueFound){
    rem=N(rem);
    if(!rem)return {score:0,kind:''};
    var forms=nameForms(f),best=0,kind='';
    for(var i=0;i<forms.length;i++){
      var x=forms[i],s=0,k='';
      if(rem===x){s=92;k='exact';}
      else if(rem.length>=2&&x.indexOf(rem)>=0){
        s=cueFound?(rem.length>=3?78:55):48;k='abbrev';
      }else if(x.length>=2&&rem.indexOf(x)>=0){
        s=cueFound?82:58;k='contains';
      }else if(((rem.length>=3&&x.length>=3)||(cueFound&&rem.length>=2&&x.length>=3))){
        var max=(Math.max(rem.length,x.length)>=7)?2:1;
        if(Math.abs(rem.length-x.length)<=max&&editDistance(rem,x,max)<=max){
          s=cueFound?72:50;k='typo';
        }
      }
      if(s>best){best=s;kind=k;}
    }
    return {score:best,kind:kind};
  }

  function contextScore(text,f,history){
    var t=N(text),s=0,hit=false;
    (f.contexts||[]).forEach(function(c){
      var x=N(c);
      if(x&&t.indexOf(x)>=0){s+=32;hit=true;}
    });
    if(!hit){
      var recent=recentText(history,'assistant',6).concat(recentText(history,'user',6)).map(N).join(' ');
      (f.contexts||[]).forEach(function(c){
        var x=N(c);if(x&&recent.indexOf(x)>=0){s+=12;hit=true;}
      });
    }
    return {score:Math.min(s,48),hit:hit};
  }

  function factScore(text,f,history){
    var t=N(text),cue=detectCue(t),rem=stripCounterCue(t,cue);
    // 質問内の場所語は名前照合から外す。
    // 例:「きょうとぜつかうんた」→ 名前部分は「ぜつ」。
    var nameRem=rem;
    var ctxForms=unique(f.contexts||[]).sort(function(a,b){return b.length-a.length;});
    ctxForms.forEach(function(c){
      if(c&&c.length>=2)nameRem=nameRem.split(c).join('');
    });
    var nm=nameMatchScore(nameRem||rem,f,cue.found);
    var cx=contextScore(t,f,history);
    var score=nm.score+cx.score;
    if(cue.found)score+=34;
    else if(recentHas(history,/カウンター|かうんた|counter/i))score+=18;
    if(nm.score&&cue.found)score+=16;
    return {
      score:score,
      nameKind:nm.kind,
      cue:cue,
      remainder:rem,
      contextHit:cx.hit
    };
  }

  function topicScore(text,x){
    var t=N(text),s=0,name=false,cue=false;
    (x.names||[]).forEach(function(v){var n=N(v);if(n&&t.indexOf(n)>=0){s+=48;name=true;}});
    (x.cues||[]).forEach(function(v){var n=N(v);if(n&&t.indexOf(n)>=0){s+=22;cue=true;}});
    return name?(s+(cue?15:0)):0;
  }

  function counterAnswer(f,meta,original){
    var v=S(f.value),none=(v==='なし'||v==='無'||v==='0'||v==='none');
    var interpreted='';
    if(meta&&(meta.nameKind==='abbrev'||meta.nameKind==='typo')){
      interpreted='「'+S(original)+'」は、'+S(f.canonical)+'のカウンターのことですね。\n';
    }
    var body=none
      ? S(f.location)+'の'+S(f.canonical)+'は、カウンター持ちは無しなのですよ。'
      : S(f.location)+'の'+S(f.canonical)+'ですね。カウンターは'+v+'なのですよ。';
    return {
      handled:true,
      answer:interpreted+body,
      mode:'たいらの野望専用知識',
      sources:[],
      links:(f.page&&wantsNavigation(original))?[pageLink(S(f.canonical)+'の表を確認',f.page)]:[],
      data:{
        knowledgeId:f.id,kind:f.kind,canonical:f.canonical,value:f.value,
        location:f.location,authoritative:true,matchKind:meta&&meta.nameKind||''
      }
    };
  }

  function ambiguityAnswer(list,original){
    var labels=list.slice(0,4).map(function(x){
      return '・'+S(x.f.location)+'：'+S(x.f.canonical);
    });
    return {
      handled:true,
      answer:'「'+S(original)+'」だと候補が複数あるのですよ。\n'+labels.join('\n')+'\n場所か名前をもう少し足してもらえれば、勝手に決めずに絞り込むのです。',
      mode:'たいらの野望専用知識',
      sources:[],links:[],
      data:{ambiguous:true,candidates:list.slice(0,4).map(function(x){return x.f.id;})}
    };
  }

  function respond(text,opt){
    var d=window.JINPO_TAIRANO_KNOWLEDGE_DATA;if(!d)return {handled:false};
    var original=S(text),history=opt&&opt.history||[];
    if(!original)return {handled:false};

    var ranked=[];
    (d.facts||[]).forEach(function(f){
      var m=factScore(original,f,history);
      if(m.score>0)ranked.push({f:f,m:m,score:m.score});
    });
    ranked.sort(function(a,b){return b.score-a.score;});

    if(ranked.length&&ranked[0].score>=92){
      var top=ranked[0],same=[];
      for(var i=0;i<ranked.length;i++){
        if(ranked[i].score>=top.score-7) same.push(ranked[i]);
      }
      // 同じ人物・同じ値の重複行は曖昧扱いにしない。
      var distinct={},distinctList=[];
      same.forEach(function(x){
        var key=N(x.f.canonical)+'|'+N(x.f.location)+'|'+S(x.f.value);
        if(!distinct[key]){distinct[key]=1;distinctList.push(x);}
      });
      if(distinctList.length>1){
        // 明確な場所文脈がトップだけに当たっているなら即答してよい。
        var ctxTop=distinctList.filter(function(x){return x.m.contextHit;});
        if(ctxTop.length===1)return counterAnswer(ctxTop[0].f,ctxTop[0].m,original);
        return ambiguityAnswer(distinctList,original);
      }
      return counterAnswer(top.f,top.m,original);
    }

    // 人物名 + カウンター意図があるのに正本に一致しない場合、
    // genericなカウンターメニュー説明へ落とさない。
    var missingCue=detectCue(original);
    if(missingCue.found){
      var missingTarget=stripCounterCue(original,missingCue);
      if(missingTarget){
        return {
          handled:true,
          answer:'「'+S(missingTarget)+'」のカウンター値を聞いているのですね。今の歩き巫女の正本には、その名前のカウンター値がまだ登録されていないのですよ。\nカウンターページの案内ではなく、値そのものを答える質問として扱っています。確認できた値だけ数字で答えるのです。',
          mode:'たいらの野望専用知識',
          sources:[],links:[],
          data:{counterQuestion:true,missingKnowledge:true,target:S(missingTarget),authoritative:false}
        };
      }
    }

    var bt=null,ts=0;
    (d.topics||[]).forEach(function(x){
      var s=topicScore(original,x);if(s>ts){ts=s;bt=x;}
    });
    if(bt&&ts>=70){
      return {
        handled:true,answer:S(bt.answer),mode:'たいらの野望専用知識',sources:[],
        links:(bt.page&&wantsNavigation(original))?[pageLink('該当ページを開く',bt.page)]:[],
        data:{knowledgeId:bt.id,authoritative:true}
      };
    }
    return {handled:false};
  }

  function search(text,opt){
    var r=respond(text,opt||{});return r&&r.handled?r:null;
  }

  window.JINPO_TAIRANO_KNOWLEDGE={
    version:VERSION,respond:respond,search:search,normalize:N,
    _test:{detectCue:detectCue,nameForms:nameForms,editDistance:editDistance,factScore:factScore,nameMatchScore:nameMatchScore}
  };
})();
