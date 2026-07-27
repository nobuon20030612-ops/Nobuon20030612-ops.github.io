/*
 * 歩き巫女 サイト総合案内 v1.2.0
 * たいらの野望の現行トップページ構成を基準に、ページ案内と内部リンクを返す。
 * 数値・ゲーム仕様は推測せず、ここでは「どのページへ行けばよいか」を担当する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SITE_GUIDE)return;
  var VERSION='1.2.0';

  function S(v){var s=String(v==null?'':v);try{s=s.normalize('NFKC');}catch(e){}return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();}
  function rootUrl(){try{return new URL('/',location.href).href;}catch(e){return'/';}}
  function abs(path){try{return new URL(path,rootUrl()).href;}catch(e){return path;}}
  function link(label,path,external){return {label:label,url:external?path:abs(path)};}

  var ITEMS=[
    {id:'jinpo',name:'陣法検索',path:'陣法/jinpo.html',aliases:['陣法','陣法検索','因縁検索','英傑組み合わせ','組み合わせ検索'],desc:'6人の英傑編成を、陣形・因縁数・ステータス条件などから探すページです。'},
    {id:'heroes',name:'英傑一覧',path:'英傑一覧.html',aliases:['英傑一覧','英傑リスト','英傑を見る','英傑確認'],desc:'英傑を一覧で確認したい時はこちらです。'},
    {id:'party',name:'徒党登録',path:'shuugou.html',aliases:['徒党登録','徒党','集合','徒党募集'],desc:'徒党登録・集合に使うページです。'},
    {id:'stats',name:'能力計算',path:'能力計算機.html',aliases:['能力計算','能力計算機','ステータス計算','能力値計算'],desc:'能力値を計算・確認したい時に使うページです。'},
    {id:'retainer',name:'家臣計算機',path:'家臣計算機.html',aliases:['家臣計算','家臣計算機','家臣の計算'],desc:'家臣の能力計算に使うページです。'},
    {id:'shichisei',name:'七星転生',path:'shichiseitensei.html',aliases:['七星転生','七星','転生計算'],desc:'七星転生に関する計算・確認用ページです。'},
    {id:'food',name:'食料',path:'shokuryou.html',aliases:['食料','食料計算','食料計算機'],desc:'食料に関する計算・確認用ページです。'},
    {id:'seikai',name:'星海の荒石',path:'seikai.html',aliases:['星海の荒石','荒石','星海'],desc:'星海の荒石に関するページです。'},
    {id:'kishin',name:'鬼神石',path:'鬼神石.html',aliases:['鬼神石','鬼神石計算','鬼神石ツール'],desc:'鬼神石の確認・計算に使うページです。'},
    {id:'tsukumo',name:'九十九',path:'九十九.html',aliases:['九十九','九十九ツール','九十九計算'],desc:'九十九の組み合わせや確認に使うページです。'},
    {id:'mado',name:'魔導結晶',path:'魔導結晶.html',aliases:['魔導結晶','魔導','魔導結晶計算'],desc:'魔導結晶に関する計算・確認用ページです。'},
    {id:'counter',name:'カウンター',path:'counter.html',aliases:['カウンター','数取器','カウント'],desc:'サイト内のカウンターツールです。'},
    {id:'okuraban',name:'御蔵番拡張',path:'okuraban.html',aliases:['御蔵番拡張','御蔵番','蔵拡張'],desc:'御蔵番拡張に関するページです。'},
    {id:'chinkon',name:'鎮魂符',path:'鎮魂符.html',aliases:['鎮魂符','鎮魂符ツール'],desc:'鎮魂符に関するページです。'},
    {id:'roulette',name:'ルーレット',path:'ルーレット.html',aliases:['ルーレット'],desc:'ルーレット機能のページです。'},
    {id:'tournament',name:'トーナメント',path:'トーナメント.html',aliases:['トーナメント'],desc:'トーナメント機能のページです。'},
    {id:'official',name:'信長の野望Online公式サイト',path:'https://www.gamecity.ne.jp/nol/index.htm',external:true,aliases:['信オン公式','公式サイト','信長の野望オンライン公式','ゲームシティ'],desc:'信長の野望Onlineの公式サイトです。'},
    {id:'wiki',name:'信長の野望Online攻略Wiki',path:'https://wiki.ohmynobu.net/nol/',external:true,aliases:['信オンwiki','攻略wiki','wiki','ウィキ'],desc:'信長の野望Online攻略Wikiです。'},
    {id:'youtube',name:'たいらのYouTube',path:'https://www.youtube.com/@%E3%81%9F%E3%81%84%E3%82%89%E3%81%AEzzz',external:true,aliases:['youtube','ユーチューブ','たいらのyoutube','動画チャンネル'],desc:'たいらののYouTubeチャンネルです。'}
  ];

  function pageMode(){
    if(window.JINPO_BOT_PAGE_MODE)return String(window.JINPO_BOT_PAGE_MODE);
    var p='';try{p=decodeURIComponent(location.pathname||'');}catch(e){p=String(location.pathname||'');}
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
  function hasNavigationCue(t){return /どこ|ページ|開い|見たい|行きたい|案内|リンク|場所|使いたい|使う|計算したい|調べたい|確認したい|やりたい|戻りたい|移動/.test(S(t));}
  function hasJinpoOperation(t){t=S(t);return /陣形|因縁|腕力|耐久|器用|知力|魅力|生命|気合|土属性|水属性|火属性|風属性|英傑.*(?:差替|固定|除外|配置)|差替|込み合計|全MAX|検索結果|鶴翼|方円|魚鱗|衡軛|こうやく/.test(t)||/(?:鬼神石|見聞録|転生).*(?:MAX|マックス|設定|解除|数値)/.test(t)||/(?:MAX|マックス).*(?:鬼神石|見聞録|転生)/.test(t);}
  function homeLink(){return link('トップページを開く','');}

  function respond(text,opt){
    var t=S(text);if(!t)return {handled:false};
    var mode=pageMode(),cur=currentItem();

    if(/(?:このサイト|サイト).*(?:何ができる|何できる|何がある|機能|ツール|案内)|^(?:サイト案内|ツール一覧|何ができる[？?]?)$/.test(t)){
      return {handled:true,mode:'サイト総合案内',answer:'たいらの野望には、陣法検索・英傑一覧・能力計算・家臣計算機・七星転生・食料・星海の荒石・鬼神石・九十九・魔導結晶などのツールがあるのですよ。\n「鬼神石を使いたい」「英傑一覧どこ？」のように目的をそのまま言ってくれれば、合うページへ案内するのです。',links:[
        link('陣法検索','陣法/jinpo.html'),link('英傑一覧','英傑一覧.html'),link('能力計算','能力計算機.html'),link('鬼神石','鬼神石.html'),link('九十九','九十九.html'),link('家臣計算機','家臣計算機.html')
      ]};
    }

    if(/(?:トップ|ホーム|最初のページ)(?:へ|に)?(?:戻|行|移動|開)|トップページ(?:どこ|開いて|へ)/.test(t)){
      return {handled:true,mode:'サイト総合案内',answer:'トップページはこちらなのですよ。',links:[homeLink()]};
    }

    if(/(?:ここ|このページ).*(?:何|なに|どんな|使い方|できる)/.test(t)&&cur){
      var l=cur.id==='home'?[]:[link(cur.name+'を開く',cur.path)];
      return {handled:true,mode:'サイト総合案内',answer:cur.name+'ですね。'+cur.desc,links:l};
    }

    // TOPや他ページで陣法の具体的な操作条件を言われたら、陣法ページへ誘導する。
    if(mode!=='jinpo'&&hasJinpoOperation(t)){
      return {handled:true,mode:'サイト総合案内',answer:'その条件は「陣法検索」で扱えるのですよ。陣法ページを開けば、歩き巫女が陣形・因縁・ステータス条件までそのまま操作できるのです。',links:[link('陣法検索を開く','陣法/jinpo.html')]};
    }

    var item=findItem(t);
    if(item){
      // 陣法ページの中で「鬼神石MAX」等を操作している時は、単語一致だけでページ案内に奪わない。
      if(mode==='jinpo'&&!hasNavigationCue(t)&&hasJinpoOperation(t))return {handled:false};
      if(item.id==='jinpo'&&mode==='jinpo'&&!hasNavigationCue(t))return {handled:false};
      var suffix=item.external?'別タブで開けるのですよ。':'こちらから開けるのですよ。';
      return {handled:true,mode:'サイト総合案内',answer:item.name+'ですね。'+item.desc+' '+suffix,links:[link(item.name+'を開く',item.path,item.external)]};
    }

    if(/(?:公式|wiki|ウィキ|攻略サイト).*(?:どこ|ある|開|案内)/i.test(t)){
      return {handled:true,mode:'サイト総合案内',answer:'公式サイトと攻略Wikiの両方を案内できるのですよ。',links:[link('信長の野望Online公式',ITEMS[16].path,true),link('攻略Wiki',ITEMS[17].path,true)]};
    }

    return {handled:false};
  }

  window.JINPO_BOT_SITE_GUIDE={version:VERSION,items:ITEMS.slice(),respond:respond,findItem:findItem,currentItem:currentItem,pageMode:pageMode,absoluteUrl:abs};
})();
