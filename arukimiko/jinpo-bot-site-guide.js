/*
 * 歩き巫女 サイト総合案内 v1.7.0
 * たいらの野望の現行トップページ構成を基準に、ページ案内と内部リンクを返す。
 * 数値・ゲーム仕様は推測せず、ここでは「どのページへ行けばよいか」を担当する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SITE_GUIDE)return;
  var VERSION='1.7.0';

  function S(v){var s=String(v==null?'':v);try{s=s.normalize('NFKC');}catch(e){}return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();}
  function rootUrl(){try{return new URL('/',location.href).href;}catch(e){return'/';}}
  function abs(path){try{return new URL(path,rootUrl()).href;}catch(e){return path;}}
  function link(label,path,external){return {label:label,url:external?path:abs(path)};}

  var ITEMS=[
    {id:'jinpo',name:'陣法検索',path:'陣法/jinpo.html',aliases:['陣法','陣法検索','因縁検索','英傑組み合わせ','組み合わせ検索','6人編成','六人編成','編成検索','じんぽう','じんぽ','じんぽうけんさく'],desc:'6人の英傑編成を、陣形・因縁数・ステータス条件などから探すページです。'},
    {id:'heroes',name:'英傑一覧',path:'英傑一覧.html',aliases:['英傑一覧','英傑リスト','英傑を見る','英傑確認','英傑の能力','英傑ステータス','英傑の因子','えいけつ','えいけついちらん'],desc:'英傑を一覧で確認したい時はこちらです。'},
    {id:'party',name:'徒党登録',path:'shuugou.html',aliases:['徒党登録','徒党','集合','徒党募集'],desc:'徒党登録・集合に使うページです。'},
    {id:'stats',name:'能力計算',path:'能力計算機.html',aliases:['能力計算','能力計算機','ステータス計算','能力値計算','ステ計算','能力を計算','のうりょく','のうりょくけいさん'],desc:'能力値を計算・確認したい時に使うページです。'},
    {id:'retainer',name:'家臣計算機',path:'家臣計算機.html',aliases:['家臣計算','家臣計算機','家臣の能力計算','家臣ステータス','かしんけいさん'],desc:'家臣の能力計算に使うページです。'},
    {id:'shichisei',name:'七星転生',path:'shichiseitensei.html',aliases:['七星転生','七星','転生計算','しちせい','しちせいてんせい'],desc:'七星転生に関する計算・確認用ページです。'},
    {id:'food',name:'食料',path:'shokuryou.html',aliases:['食料','食料計算','食料計算機','しょくりょう'],desc:'食料に関する計算・確認用ページです。'},
    {id:'seikai',name:'星海の荒石',path:'seikai.html',aliases:['星海の荒石','荒石','星海','せいかい','あらいし'],desc:'星海の荒石に関するページです。'},
    {id:'kishin',name:'鬼神石',path:'鬼神石.html',aliases:['鬼神石','鬼神石計算','鬼神石ツール','きしんせき','きしん'],desc:'鬼神石の確認・計算に使うページです。'},
    {id:'tsukumo',name:'九十九',path:'九十九.html',aliases:['九十九','九十九ツール','九十九計算','つくも','つくもがみ'],desc:'九十九の組み合わせや確認に使うページです。'},
    {id:'mado',name:'魔導結晶',path:'魔導結晶.html',aliases:['魔導結晶','魔導','魔導結晶計算','まどう','まどうけっしょう'],desc:'魔導結晶に関する計算・確認用ページです。'},
    {id:'counter',name:'カウンター',path:'counter.html',aliases:['カウンター','数取器','カウント','かうんた','かうんたー'],desc:'サイト内のカウンターツールです。'},
    {id:'okuraban',name:'御蔵番拡張',path:'okuraban.html',aliases:['御蔵番拡張','御蔵番','蔵拡張','おくらばん','おくら'],desc:'御蔵番拡張に関するページです。'},
    {id:'chinkon',name:'鎮魂符',path:'鎮魂符.html',aliases:['鎮魂符','鎮魂符ツール','ちんこんふ','ちんこん'],desc:'鎮魂符に関するページです。'},
    {id:'roulette',name:'ルーレット',path:'ルーレット.html',aliases:['ルーレット'],desc:'ルーレット機能のページです。'},
    {id:'tournament',name:'トーナメント',path:'トーナメント.html',aliases:['トーナメント'],desc:'トーナメント機能のページです。'},
    {id:'official',name:'信長の野望Online公式サイト',path:'https://www.gamecity.ne.jp/nol/index.htm',external:true,aliases:['信オン公式','公式サイト','信長の野望オンライン公式','ゲームシティ'],desc:'信長の野望Onlineの公式サイトです。'},
    {id:'wiki',name:'信長の野望Online攻略Wiki',path:'https://wiki.ohmynobu.net/nol/',external:true,aliases:['信オンwiki','攻略wiki','wiki','ウィキ'],desc:'信長の野望Online攻略Wikiです。'},
    {id:'youtube',name:'たいらのYouTube',path:'https://www.youtube.com/@%E3%81%9F%E3%81%84%E3%82%89%E3%81%AEzzz',external:true,aliases:['youtube','ユーチューブ','たいらのyoutube','動画チャンネル'],desc:'たいらののYouTubeチャンネルです。'}
  ];

  function pageMode(){
    if(window.JINPO_BOT_PAGE_MODE)return String(window.JINPO_BOT_PAGE_MODE);
    var p='';try{p=decodeURIComponent(location.pathname||'');}catch(e){p=String(location.pathname||'');}
    if(p==='/'||/\/index\.html$/i.test(p))return 'top';
    return /\/陣法\/jinpo\.html$/i.test(p)?'jinpo':'site';
  }
  function currentItem(){
    var href='';try{href=decodeURIComponent(location.pathname||'');}catch(e){href=String(location.pathname||'');}
    for(var i=0;i<ITEMS.length;i++){
      if(ITEMS[i].external)continue;
      var p='/'+ITEMS[i].path.replace(/^\//,'');
      if(href===p||href.endsWith(p))return ITEMS[i];
    }
    if(href==='/'||/\/index\.html$/i.test(href))return {id:'home',name:'トップページ',path:'',desc:'たいらの野望の各ツールへの入口です。'};
    return null;
  }
  function itemScore(text,item){
    var t=S(text).toLowerCase(),score=0;
    item.aliases.forEach(function(a){var x=String(a).toLowerCase();if(t===x)score=Math.max(score,100+x.length);else if(t.indexOf(x)>=0)score=Math.max(score,40+x.length);});
    return score;
  }
  function findItem(text){
    var best=null,bs=0;ITEMS.forEach(function(item){var s=itemScore(text,item);if(s>bs){best=item;bs=s;}});return best;
  }
  function purposeItem(text){
    var t=S(text);

    if(/家臣.*(?:名前|名付け|命名)/.test(t))return null;

    if(/(?:6人|六人|編成|組み合わせ|因縁).*(?:探|検索|組)|(?:腕力|耐久|器用|知力|魅力|生命|気合).*(?:高い|高め|探|検索)/.test(t))
      return ITEMS.filter(function(x){return x.id==='jinpo';})[0];

    if(/英傑.*(?:一覧|能力|ステータス|因子|見る|確認)/.test(t))
      return ITEMS.filter(function(x){return x.id==='heroes';})[0];

    if(/家臣.*(?:能力|ステータス|計算)/.test(t))
      return ITEMS.filter(function(x){return x.id==='retainer';})[0];

    if(/(?:能力|ステータス|ステ).*(?:計算|シミュ)/.test(t)&&!/家臣/.test(t))
      return ITEMS.filter(function(x){return x.id==='stats';})[0];

    if(/九十九|つくも/.test(t))
      return ITEMS.filter(function(x){return x.id==='tsukumo';})[0];
    if(/鬼神石|きしんせき/.test(t))
      return ITEMS.filter(function(x){return x.id==='kishin';})[0];
    if(/魔導結晶|まどうけっしょう|魔導/.test(t))
      return ITEMS.filter(function(x){return x.id==='mado';})[0];
    if(/七星転生|七星/.test(t))
      return ITEMS.filter(function(x){return x.id==='shichisei';})[0];
    if(/星海の荒石|荒石/.test(t))
      return ITEMS.filter(function(x){return x.id==='seikai';})[0];
    if(/御蔵番|蔵拡張/.test(t))
      return ITEMS.filter(function(x){return x.id==='okuraban';})[0];
    if(/鎮魂符/.test(t))
      return ITEMS.filter(function(x){return x.id==='chinkon';})[0];

    return null;
  }

  function hasNavigationCue(t){return /どこ|ページ|開い|見たい|行きたい|案内|リンク|場所|使いたい|使う|計算したい|調べたい|確認したい|やりたい|戻りたい|探したい|探す|移動/.test(S(t));}
  function hasFactCue(t){
    t=S(t);
    return /カウンター|かうんた|かうん|counter|何番|なんばん|いくつ|数値|何位|順位|成績|勝敗|勝率|効果|倍率|上限|下限|必要数|何個|なんこ|何人|誰|だれ|いつ|どれ|どの|いくら|どのくらい|どれくらい/.test(t);
  }
  function exactAliasOnly(t,item){
    var x=S(t).toLowerCase();
    return item.aliases.some(function(a){return x===String(a).toLowerCase();});
  }
  function looksLikeSpecificCounterQuestion(t,item){
    t=S(t);
    if(item.id!=='counter')return false;
    if(!/(?:カウンター|かうんた|かうん|counter)/i.test(t))return false;
    var rest=t
      .replace(/カウンター|かうんたー|かうんた|かうん|counter/ig,'')
      .replace(/[のはって？?！!。、・「」『』【】（）()\s]/g,'');
    return rest.length>0;
  }
  function hasJinpoOperation(t){t=S(t);return /陣形|因縁|腕力|耐久|器用|知力|魅力|生命|気合|土属性|水属性|火属性|風属性|英傑.*(?:差替|固定|除外|配置)|差替|込み合計|全MAX|検索結果|鶴翼|方円|魚鱗|衡軛|こうやく/.test(t)||/(?:鬼神石|見聞録|転生).*(?:MAX|マックス|設定|解除|数値)/.test(t)||/(?:MAX|マックス).*(?:鬼神石|見聞録|転生)/.test(t);}
  function homeLink(){return link('トップページを開く','');}

  function respond(text,opt){
    var t=S(text);if(!t)return {handled:false};
    var mode=pageMode(),cur=currentItem();
    var pageCtx=null;try{pageCtx=window.JINPO_BOT_PAGE_CONTEXT&&window.JINPO_BOT_PAGE_CONTEXT.snapshot?window.JINPO_BOT_PAGE_CONTEXT.snapshot():null;}catch(e){}

    if(/(?:このサイト|サイト).*(?:何ができる|何できる|何がある|機能|ツール|案内)|^(?:サイト案内|ツール一覧|何ができる[？?]?)$/.test(t)){
      return {handled:true,mode:'サイト総合案内',answer:'たいらの野望には、陣法検索・英傑一覧・能力計算・家臣計算・七星転生・鬼神石・九十九・魔導結晶・食料・星海の荒石などがあります。\n「英傑の能力を見たい」「鬼神石見たい」「6人編成を探したい」みたいに、やりたいことをそのまま言ってくれれば案内できます。',links:[
        link('陣法検索','陣法/jinpo.html'),link('英傑一覧','英傑一覧.html'),link('能力計算','能力計算機.html'),link('鬼神石','鬼神石.html'),link('九十九','九十九.html'),link('家臣計算機','家臣計算機.html')
      ]};
    }

    if(/(?:トップ|ホーム|最初のページ)(?:へ|に)?(?:戻|行|移動|開)|トップページ(?:どこ|開いて|へ)/.test(t)){
      return {handled:true,mode:'サイト総合案内',answer:'トップページはこちらなのですよ。',links:[homeLink()]};
    }

    if(/(?:ここ|このページ).*(?:何|なに|どんな|使い方|できる)/.test(t)&&cur){
      var l=cur.id==='home'?[]:[link(cur.name+'を開く',cur.path)];
      if(cur.id==='home')return {handled:true,mode:'サイト総合案内',answer:'ここは「たいらの野望」のトップページなのですよ。陣法・英傑一覧・鬼神石・九十九・魔導結晶・能力計算・家臣計算・カウンターなどへ案内できます。やりたいことを普通に話してくれれば、合うページを探すのです。',links:[]};
      return {handled:true,mode:'サイト総合案内',answer:cur.name+'ですね。'+cur.desc,links:l};
    }

    // TOPや他ページで陣法の具体的な操作条件を言われたら、陣法ページへ誘導する。
    if(mode!=='jinpo'&&hasJinpoOperation(t)){
      return {handled:true,mode:'サイト総合案内',answer:'その条件は「陣法検索」で扱えるのですよ。陣法ページを開けば、歩き巫女が陣形・因縁・ステータス条件までそのまま操作できるのです。',links:[link('陣法検索を開く','陣法/jinpo.html')]};
    }

    var item=findItem(t)||purposeItem(t);
    if(item){
      var routedIntent=opt&&opt.intentInfo?String(opt.intentInfo.intent||''):'';
      var nav=hasNavigationCue(t)||(routedIntent==='navigation');

      // サイト案内は「移動したい」という明示要求だけを担当する。
      // 単語だけ、事実質問、会話の続きは他の回答モジュールへ渡す。
      if(!nav)return {handled:false};

      if(mode==='jinpo'&&!nav&&hasJinpoOperation(t))return {handled:false};
      if(item.id==='jinpo'&&mode==='jinpo'&&!nav)return {handled:false};

      var suffix=item.external?'別タブで開けるのですよ。':'こちらから開けるのですよ。';
      return {handled:true,mode:'サイト総合案内',answer:item.name+'ですね。'+item.desc+' '+suffix,links:[link(item.name+'を開く',item.path,item.external)]};
    }

    if(/(?:公式|wiki|ウィキ|攻略サイト).*(?:どこ|ある|開|案内)/i.test(t)){
      return {handled:true,mode:'サイト総合案内',answer:'公式サイトと攻略Wikiの両方を案内できるのですよ。',links:[link('信長の野望Online公式',ITEMS[16].path,true),link('攻略Wiki',ITEMS[17].path,true)]};
    }

    return {handled:false};
  }

  window.JINPO_BOT_SITE_GUIDE={version:VERSION,items:ITEMS.slice(),respond:respond,findItem:findItem,purposeItem:purposeItem,currentItem:currentItem,pageMode:pageMode,absoluteUrl:abs};
})();
