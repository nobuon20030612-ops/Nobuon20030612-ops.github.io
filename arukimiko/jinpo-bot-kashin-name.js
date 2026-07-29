/*
 * 歩き巫女 家臣名付け v1.1.1
 * 信長の野望Onlineの家臣向け。苗字6文字・名前6文字以内。
 * 好みを会話で聞き出し、希望なしなら完全おまかせで候補を作る。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_KASHIN_NAME)return;

  var VERSION='1.1.2';
  var KEY='arukimikoKashinNaming.v1';

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function load(){
    try{return JSON.parse(sessionStorage.getItem(KEY)||'null')||{};}catch(e){return{};}
  }
  function save(x){try{sessionStorage.setItem(KEY,JSON.stringify(x||{}));}catch(e){}}
  function clear(){try{sessionStorage.removeItem(KEY);}catch(e){}}
  function chars(s){return Array.from(String(s||'')).length;}
  function validPart(s){return !!s&&chars(s)<=6;}

  function isTrigger(text){
    var t=S(text);
    return /(?:家臣|かしん).*(?:名前|なまえ|名付け|なづけ|命名|めいめい)|(?:名前|なまえ|名付け|なづけ|命名).*(?:家臣|かしん)|家臣名|かしんめい/.test(t);
  }
  function isRandom(text){
    return /おまかせ|お任せ|任せ(?:る|て|ます|よう)?|なんでも|何でも|適当|てきとう|ランダム|らんだむ|希望なし|特にない|とくにない|ないよ|なし/.test(S(text));
  }
  function isCancel(text){return /やめ|中止|キャンセル|名付けやめ/.test(S(text));}
  function wantsMore(text){return /もっと|別の|べつの|もう.*個|他の|ほかの|やり直|再生成/.test(S(text));}

  function isMetaControl(text){
    return /話.*戻|前の話|さっきの話|元の話|話.*変|別の話/.test(S(text));
  }

  function isClearlyOtherTopic(text){
    var t=S(text);
    return /カープ|かーぷ|広島東洋|野球|順位|試合結果|選手|天気|気温|予報|ニュース|為替|ドル円|カウンター|かうんた|九十九|鬼神石|魔導結晶|陣法|因縁|陣形|英傑|全MAX/.test(t);
  }

  function isRelevantContinuation(text,st){
    var t=S(text);
    if(!t)return false;
    if(isCancel(t)||isMetaControl(t)||isClearlyOtherTopic(t))return false;
    if(isTrigger(t)||isRandom(t)||wantsMore(t))return true;
    if(/もう出して|候補出して|名前出して|作って|考えて/.test(t))return true;
    if(/男|男性|女|女性|中性|どっちでも|性別/.test(t))return true;
    if(/強|武骨|猛将|豪傑|勇猛|かわい|可愛|雅|上品|綺麗|優雅|神秘|妖|闇|夜|珍し|変わった|個性的|レア|戦国|武将|古風|王道|普通|実在|創作|ファンタジ/.test(t))return true;
    if(/桜|月|雪|龍|風|花|星|水/.test(t))return true;
    if(/^(?:全部)?(?:なし|ない|特にない|おまかせ|お任せ|任せ(?:る|て|ます)?|どれでも|なんでも)$/.test(t))return true;
    if(/^[1-5１-５](?:番|ばん|個目|こめ)/.test(t))return true;

    // Do not consume ordinary free conversation just because a naming flow is active.
    return false;
  }

  function pause(){
    var st=load();
    if(st&&st.active){
      st.active=false;
      st.paused=true;
      st.pausedAt=Date.now();
      save(st);
    }
    return st;
  }

  function resume(){
    var st=load();
    if(!st||(!st.paused&&!st.active))return null;
    st.active=true;
    st.paused=false;
    delete st.pausedAt;
    save(st);

    if(st.step==='done'&&Array.isArray(st.last)&&st.last.length){
      return {handled:true,answer:'家臣名付けの話に戻ったのですよ。前に出した候補はこちらです。\n'+formatCandidates(st.last)+'\n\n「もっと」「別の5個」「もっと渋く」など、そのまま続けられます。',mode:'家臣名付け'};
    }
    if(st.step==='gender')return {handled:true,answer:'家臣名付けの話に戻ったのですよ。男性っぽい・女性っぽい・中性的・おまかせ、どれが近いですか？',mode:'家臣名付け'};
    if(st.step==='style')return {handled:true,answer:'家臣名付けの話に戻ったのですよ。王道の戦国風・強そう・雅・かわいい・神秘的・珍しい、どれが近いですか？',mode:'家臣名付け'};
    if(st.step==='theme')return {handled:true,answer:'家臣名付けの話に戻ったのですよ。入れたい漢字やイメージがあれば教えてください。なければ「なし」で続けられます。',mode:'家臣名付け'};
    return {handled:true,answer:'家臣名付けの話に戻ったのですよ。前の条件を保持したまま続けられます。「もう出して」「もっと」など、そのまま言ってください。',mode:'家臣名付け'};
  }

  var surnames={
    classic:['黒田','白石','真壁','榊原','小笠原','結城','相馬','久世','風間','水城','月岡','花房','榎本','早川','一条','九条','神谷','橘','藤堂','桐生'],
    strong:['鬼塚','剣持','赤城','武藤','岩城','雷門','荒神','虎石','龍崎','獅子堂','黒鋼','御剣','火神','鉄山','大嶽','不破'],
    elegant:['月影','白妙','花菱','藤宮','雪代','桜庭','水無瀬','綾小路','香月','朝霧','星野','紫藤','篠宮','九重','月城','白峰'],
    cute:['桃井','小春','花野','桜井','星川','白兎','月乃','甘露','鈴森','春日','千草','雛森'],
    mysterious:['夜刀','月詠','星詠','天霧','神楽','朧月','宵宮','常闇','水鏡','白夜','玄月','霞城'],
    rare:['鵺塚','鴉羽','薄墨','東雲','十六夜','不知火','百鬼','久遠','天羽','四方堂','六合','八雲']
  };

  var given={
    male:['宗真','景綱','兼久','信景','隆真','義景','晴政','政宗','玄蕃','左近','弥九郎','清綱','兼定','冬馬','蒼真','龍之介','朔夜','隼人'],
    female:['千鶴','小夜','綾乃','桜子','静香','雪乃','琴音','紫苑','初音','美月','千景','楓','巴','凛','灯','鈴音','月乃','花蓮'],
    neutral:['伊織','千尋','薫','真琴','晶','楓','朔','凪','光','悠','奏','澪','環','紫苑','千景','時雨'],
    strong:['剛毅','烈火','玄武','虎徹','雷牙','龍胆','武尊','鉄心','征十郎','義烈','修羅','豪真'],
    elegant:['雅臣','綾人','雅','千歳','瑞穂','紫乃','香澄','月詠','清雅','雪華','琴葉','紅葉'],
    cute:['こはる','ひより','すず','ももか','ことね','みつき','ひなた','小鈴','花音','鈴花','千花','桃香'],
    mysterious:['朧','夜叉','月読','宵月','紫月','時雨','白夜','玄夜','幽玄','神楽','星羅','久遠'],
    rare:['一閃','零','天狼','深緋','翠嵐','朱雀','青龍','白鷺','黒曜','霞丸','風雅','暁月']
  };

  var themes={
    '桜':['桜庭','桜井','花菱','桜子','桜花','千桜'],
    '月':['月影','月城','月岡','月詠','美月','宵月'],
    '雪':['雪代','白峰','白妙','雪乃','雪華','白夜'],
    '龍':['龍崎','龍門','龍之介','龍胆','青龍'],
    '風':['風間','朝霧','天霧','風雅','翠嵐'],
    '花':['花房','花野','花菱','花音','花蓮'],
    '夜':['夜刀','白夜','玄夜','宵宮','宵月'],
    '星':['星野','星川','星詠','星羅'],
    '水':['水城','水無瀬','水鏡','瑞穂']
  };

  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function uniq(a){var o=[],seen={};a.forEach(function(x){if(x&&!seen[x]){seen[x]=1;o.push(x);}});return o;}

  function detectProfile(text,history){
    var t=S(text),p={gender:'',style:'',theme:'',realism:''};
    if(/男|男性|おとこ|男らし/.test(t))p.gender='male';
    else if(/女|女性|おんな|女らし/.test(t))p.gender='female';
    else if(/中性|どっちでも|性別なし/.test(t))p.gender='neutral';

    if(/強|武骨|ごつ|猛将|豪傑|勇猛/.test(t))p.style='strong';
    else if(/かわい|可愛|愛らし/.test(t))p.style='cute';
    else if(/雅|上品|綺麗|きれい|優雅|公家/.test(t))p.style='elegant';
    else if(/神秘|怪し|妖|闇|夜|不思議/.test(t))p.style='mysterious';
    else if(/珍し|変わった|個性的|レア/.test(t))p.style='rare';
    else if(/戦国|武将|古風|王道|普通|実在/.test(t))p.style='classic';

    Object.keys(themes).some(function(k){
      if(t.indexOf(k)>=0){p.theme=k;return true;}
      return false;
    });

    if(/実在|自然|本当にいそう|普通/.test(t))p.realism='real';
    else if(/創作|ファンタジ|厨二|架空/.test(t))p.realism='fiction';

    // 直近の本人発言から、明示された好みだけを軽く拾う。
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-16;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var x=S(h[i].text);
      if(!p.style){
        if(/かわい|可愛/.test(x))p.style='cute';
        else if(/渋|武骨|強そう/.test(x))p.style='strong';
        else if(/雅|綺麗|きれい/.test(x))p.style='elegant';
      }
      if(!p.theme){
        Object.keys(themes).some(function(k){if(x.indexOf(k)>=0){p.theme=k;return true;}return false;});
      }
    }
    return p;
  }

  function mergeProfile(a,b){
    a=a||{};b=b||{};
    ['gender','style','theme','realism'].forEach(function(k){if(b[k])a[k]=b[k];});
    return a;
  }

  function surnamePool(p){
    var pool=[];
    if(p.style&&surnames[p.style])pool=pool.concat(surnames[p.style]);
    pool=pool.concat(surnames.classic);
    if(p.theme&&themes[p.theme])pool=pool.concat(themes[p.theme].filter(validPart));
    return uniq(pool.filter(validPart));
  }

  function givenPool(p){
    var pool=[];
    if(p.gender&&given[p.gender])pool=pool.concat(given[p.gender]);
    if(p.style&&given[p.style])pool=pool.concat(given[p.style]);
    if(!p.gender)pool=pool.concat(given.male,given.female,given.neutral);
    if(!p.style)pool=pool.concat(given.elegant,given.strong,given.mysterious,given.cute);
    if(p.theme&&themes[p.theme])pool=pool.concat(themes[p.theme].filter(validPart));
    return uniq(pool.filter(validPart));
  }

  function generate(profile,count){
    profile=profile||{};
    var sp=surnamePool(profile),gp=givenPool(profile),out=[],seen={},tries=0;
    count=count||5;
    while(out.length<count&&tries<200){
      tries++;
      var s=pick(sp),g=pick(gp);
      if(!validPart(s)||!validPart(g))continue;
      var key=s+' '+g;if(seen[key])continue;
      seen[key]=1;
      var reason=[];
      if(profile.style)reason.push({classic:'戦国らしい王道',strong:'強く武骨',elegant:'雅で上品',cute:'親しみやすく可愛い',mysterious:'神秘的',rare:'少し珍しい'}[profile.style]||'');
      if(profile.theme)reason.push(profile.theme+'の雰囲気');
      if(profile.gender)reason.push({male:'男性寄り',female:'女性寄り',neutral:'中性的'}[profile.gender]);
      out.push({surname:s,given:g,reason:reason.filter(Boolean).join('・')||'おまかせ'});
    }
    return out;
  }

  function formatCandidates(list){
    return list.map(function(x,i){
      return (i+1)+'. '+x.surname+' '+x.given+'　（'+x.reason+'）';
    }).join('\n');
  }

  function start(history,text){
    var inferred=detectProfile(text,history);
    var st={active:true,step:'gender',profile:inferred,last:[],startedAt:Date.now()};
    save(st);
    if(isRandom(text)){
      var list=generate(inferred,5);st.step='done';st.last=list;save(st);
      return {handled:true,answer:'完全おまかせで5つ考えたのですよ。苗字も名前も6文字以内です。\n'+formatCandidates(list)+'\n\n「もっと」「もっと渋く」「2番目が好き」みたいに続けても大丈夫なのです。',mode:'家臣名付け'};
    }
    if(inferred.gender||inferred.style||inferred.theme){
      st.step='more';save(st);
      return {handled:true,answer:'家臣の名付けですね。今の話から好みを少し拾ったのですよ。\nもう一つだけ、実在しそうな戦国風・創作寄り・完全おまかせのどれが近いですか？\n「もう出して」で今の情報だけでも候補を作れます。',mode:'家臣名付け'};
    }
    return {handled:true,answer:'もちろん名付けるのですよ。苗字6文字・名前6文字以内で考えます。\n何も決まっていなければ私から聞いていくのです。\nまず、男性っぽい・女性っぽい・中性的・おまかせ、どれが近いですか？\n「全部おまかせ」なら今すぐランダムで出せます。',mode:'家臣名付け'};
  }

  function continueFlow(text,history){
    var st=load();if(!st.active)return null;
    if(isCancel(text)){clear();return {handled:true,answer:'名付けはいったん中止したのですよ。また「家臣の名前考えて」でいつでも再開できます。',mode:'家臣名付け'};}

    var t=S(text);
    var p=mergeProfile(st.profile||{},detectProfile(t,history));
    st.profile=p;

    if(isRandom(t)||/もう出して|候補出して|名前出して|作って|考えて/.test(t)){
      var list=generate(p,5);st.step='done';st.last=list;save(st);
      return {handled:true,answer:'では今の好みで5つ出すのですよ。\n'+formatCandidates(list)+'\n\n気に入らなければ「もっと」「もっと雅に」「別の5個」で何度でも作れます。',mode:'家臣名付け'};
    }

    if(st.step==='gender'){
      if(!p.gender){
        return {handled:true,answer:'性別の雰囲気は決めずに進めても大丈夫なのですよ。\n次は、王道の戦国風・強そう・雅・かわいい・神秘的・珍しい、どれが好きですか？',mode:'家臣名付け'};
      }
      st.step='style';save(st);
      return {handled:true,answer:'了解なのですよ。次は雰囲気です。\n王道の戦国風・強そう・雅・かわいい・神秘的・珍しい、どれが近いですか？\n特になければ「おまかせ」で大丈夫です。',mode:'家臣名付け'};
    }

    if(st.step==='style'){
      st.step='theme';save(st);
      return {handled:true,answer:'いいですね。最後に、入れたい漢字やイメージはありますか？\n例えば「桜」「月」「雪」「龍」「風」「花」など。なければ「なし」で、そのまま名付けます。',mode:'家臣名付け'};
    }

    if(st.step==='theme'||st.step==='more'){
      var list2=generate(p,5);st.step='done';st.last=list2;save(st);
      return {handled:true,answer:'好みが見えてきたので候補を作ったのですよ。\n'+formatCandidates(list2)+'\n\n「もっと」「別の」「もっと渋く」などもそのまま言ってください。',mode:'家臣名付け'};
    }

    if(st.step==='done'){
      if(wantsMore(t)||p.style||p.theme||p.gender){
        var list3=generate(p,5);st.last=list3;save(st);
        return {handled:true,answer:'少し方向を変えて、もう5つ出すのですよ。\n'+formatCandidates(list3),mode:'家臣名付け'};
      }
      var m=t.match(/([1-5１-５])(?:番|ばん|個目|こめ)/);
      if(m&&st.last&&st.last.length){
        var n=Number(m[1].replace(/[１-５]/g,function(x){return String.fromCharCode(x.charCodeAt(0)-0xFEE0);}));
        var x=st.last[n-1];
        if(x)return {handled:true,answer:n+'番目の「'+x.surname+' '+x.given+'」ですね。苗字'+chars(x.surname)+'文字・名前'+chars(x.given)+'文字で条件内なのですよ。かなり良いと思うのです。',mode:'家臣名付け'};
      }
    }
    save(st);
    return {handled:true,answer:'名付けの続きですね。「もっと」「別の5個」「もっと渋く」「桜を入れて」みたいに言ってくれれば、その方向で作り直すのですよ。',mode:'家臣名付け'};
  }

  function respond(text,opt){
    opt=opt||{};
    var st=load();
    if(st.active){
      if(!isRelevantContinuation(text,st)){
        pause();
        return {handled:false};
      }
      var r=continueFlow(text,opt.history||[]);
      if(r)return r;
    }
    if(isTrigger(text))return start(opt.history||[],text);
    return {handled:false};
  }

  window.JINPO_BOT_KASHIN_NAME={
    version:VERSION,
    respond:respond,
    isTrigger:isTrigger,
    generate:generate,
    validPart:validPart,
    clear:clear,
    pause:pause,
    resume:resume,
    state:load,
    isRelevantContinuation:isRelevantContinuation
  };
})();
