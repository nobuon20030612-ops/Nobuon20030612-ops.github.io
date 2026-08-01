/*
 * 歩き巫女 サイト共通ローダー v3.44.0-local-only
 * すべてのページで同じ /arukimiko/ 配下の仕様・知識・会話エンジンを共有する。
 * 陣法ページだけ陣法操作モジュールを追加読み込みし、TOP/一般ページには陣法専用メニューを出さない。
 */
(function(){
  'use strict';
  if(window.__ARUKIMIKO_SHARED_LOADER__)return;
  window.__ARUKIMIKO_SHARED_LOADER__=true;

  var current=document.currentScript,src=current&&current.src?current.src:'';
  var base='';
  try{base=new URL('.',src||location.href).href;}catch(e){base='/arukimiko/';}
  window.JINPO_BOT_BASE_URL=base;
  var ASSET_VERSION='3.44.0';

  function decodedPath(){
    try{return decodeURIComponent(location.pathname||'');}catch(e){return String(location.pathname||'');}
  }
  function detectMode(){
    var p=decodedPath();
    if(p==='/'||/\/index\.html$/i.test(p))return'top';
    if(/\/(?:陣法\/)?jinpo\.html$/i.test(p))return'jinpo';
    return'site';
  }

  var mode=detectMode();
  window.JINPO_BOT_PAGE_MODE=mode;
  window.JINPO_BOT_DISABLE_JINPO_GUIDE=mode!=='jinpo';
  window.ARUKIMIKO_SHARED={version:'3.44.0-local-only',baseUrl:base,pageMode:mode,loading:true,ready:false};

  var loadT0=(window.performance&&typeof performance.now==='function')?performance.now():Date.now();
  window.ARUKIMIKO_LOAD_METRICS={
    version:'3.44.0',
    mode:mode,
    startedAt:Date.now(),
    scriptCount:0,
    scriptsReadyMs:null,
    cssReadyMs:null,
    readyMs:null
  };
  function elapsed(){
    var now=(window.performance&&typeof performance.now==='function')?performance.now():Date.now();
    return Math.max(0,Math.round(now-loadT0));
  }

  function addCss(name){
    return new Promise(function(resolve){
      var existing=document.querySelector('link[data-arukimiko-css="'+name+'"]');
      if(existing){
        if(existing.sheet){resolve({ok:true,name:name,existing:true});return;}
        existing.addEventListener('load',function(){resolve({ok:true,name:name,existing:true});},{once:true});
        existing.addEventListener('error',function(){resolve({ok:false,name:name,existing:true});},{once:true});
        setTimeout(function(){resolve({ok:!!existing.sheet,name:name,existing:true,timeout:true});},3500);
        return;
      }

      function append(url,retry){
        var l=document.createElement('link');
        l.rel='stylesheet';
        l.href=url;
        l.setAttribute('data-arukimiko-css',name);
        l.setAttribute('data-arukimiko-css-retry',String(retry||0));

        l.onload=function(){
          resolve({ok:true,name:name,retry:retry||0,url:url});
        };
        l.onerror=function(){
          try{l.remove();}catch(e){}
          if(!retry){
            // GitHub Pages / browser cache race recovery.
            var retryUrl=new URL(name,location.origin+'/arukimiko/').href+
              '?v='+encodeURIComponent(ASSET_VERSION)+'&retry='+Date.now();
            append(retryUrl,1);
          }else{
            console.error('歩き巫女 CSS load failed:',name,url);
            resolve({ok:false,name:name,retry:1,url:url});
          }
        };
        document.head.appendChild(l);
      }

      append(new URL(name,base).href+'?v='+encodeURIComponent(ASSET_VERSION),0);
    });
  }
  function load(name){
    return new Promise(function(resolve,reject){
      var existing=document.querySelector('script[data-arukimiko-script="'+name+'"]');
      if(existing){
        if(existing.getAttribute('data-arukimiko-loaded')==='1'){resolve();return;}
        existing.addEventListener('load',function(){resolve();},{once:true});
        existing.addEventListener('error',function(){reject(new Error('load failed: '+name));},{once:true});
        return;
      }

      var s=document.createElement('script');
      // async=falseで実行順を維持しつつ、全scriptを先にappendして取得だけ並列化。
      s.async=false;
      s.src=new URL(name,base).href+'?v='+encodeURIComponent(ASSET_VERSION);
      s.setAttribute('data-arukimiko-script',name);
      if(name==='jinpo-ai-chat.js')s.setAttribute('fetchpriority','high');
      s.onload=function(){
        s.setAttribute('data-arukimiko-loaded','1');
        resolve();
      };
      s.onerror=function(){reject(new Error('load failed: '+name));};
      document.head.appendChild(s);
    });
  }

  var cssReady=[
    addCss('jinpo-ai-chat.css'),
    addCss('jinpo-bot-adv-theme.css')
  ];
  if(mode==='jinpo')cssReady.push(addCss('jinpo-bot-guide.css'));

  // ------------------------------------------------------------
  // v3.3.8 二段階ロード
  //
  // 1) visual:
  //    チャットUIとADV見た目だけを最優先。
  //
  // 2) core:
  //    通常会話・陣法操作に必要な基礎だけ。
  //
  // 3) optional:
  //    大きな正本データ、Web、カープ、命名、雑談などは
  //    話題に応じて初めて読む。
  // ------------------------------------------------------------

  var visualScripts=[
    'jinpo-ai-chat.js',
    'jinpo-bot-adv-theme.js'
  ];

  var coreCommon=[
    'arukimiko-local-only-guard.js',
    'jinpo-bot-conversation.js',
    'jinpo-bot-context.js',
    'jinpo-bot-dialog.js',
    'jinpo-bot-page-context.js',
    'jinpo-bot-site-source-data.js',
    'jinpo-bot-site-guide.js',
    'jinpo-bot-memory.js',
    'jinpo-bot-arukimiko.js'
  ];

  var coreJinpo=[
    'jinpo-bot-state.js',
    'jinpo-bot-actions.js',
    'jinpo-bot-casual.js',
    'jinpo-bot-nlu.js',
    'jinpo-bot-parser.js',
    'jinpo-bot-interpret.js'
  ];

  var coreTail=[
    'jinpo-bot.js',
    'jinpo-bot-persona.js'
  ];

  if(mode==='jinpo'){
    coreTail=coreTail.concat(['jinpo-bot-suggest.js','jinpo-bot-guide.js']);
  }

  var lazyGroups={
    learning:[
      'jinpo-bot-learning.js'
    ],
    help:[
      'jinpo-bot-help.js',
      'jinpo-bot-capabilities.js'
    ],
    smalltalk:[
      'jinpo-bot-smalltalk.js'
    ],
    tool:[
      'jinpo-bot-tool-data.js',
      'jinpo-bot-tool-knowledge.js'
    ],
    hero:[
      'jinpo-bot-hero-data.js',
      'jinpo-bot-hero-knowledge.js'
    ],
    tairano:[
      'jinpo-bot-tairano-data.js',
      'jinpo-bot-tairano-knowledge.js'
    ],
    web:[
      'jinpo-bot-web.js'
    ],
    carp:[
      'jinpo-bot-carp-knowledge-data.js',
      'jinpo-bot-carp-knowledge.js',
      'jinpo-bot-carp.js'
    ],
    kashin:[
      'jinpo-bot-kashin-name.js'
    ],
    firebase:[
      'jinpo-bot-firebase-config.js',
      'jinpo-bot-firebase-memory.js'
    ]
  };

  var lazyState={};
  var lazyLoaded={};

  function uniqueNames(list){
    var seen={},out=[];
    (list||[]).forEach(function(name){
      name=String(name||'');
      if(name&&!seen[name]){seen[name]=1;out.push(name);}
    });
    return out;
  }

  function loadOrdered(names){
    names=uniqueNames(names);
    if(!names.length)return Promise.resolve(true);
    return Promise.all(names.map(load)).then(function(){return true;});
  }

  function ensureGroup(name){
    name=String(name||'');
    if(!lazyGroups[name])return Promise.resolve(false);
    if(lazyLoaded[name])return Promise.resolve(true);
    if(lazyState[name])return lazyState[name];

    lazyState[name]=loadOrdered(lazyGroups[name]).then(function(){
      lazyLoaded[name]=true;
      delete lazyState[name];
      return true;
    }).catch(function(e){
      delete lazyState[name];
      throw e;
    });
    return lazyState[name];
  }

  // カープ正本955名の氏名だけを軽量ヒントとして保持。
  // 本文データは従来どおりカープ話題時だけlazy読込。
  var carpNameHints=["クリストファー・カンバーランド","ウィルフィレーセル・ゲレロ","エマイリン・モンティージャ","エリック・シュールストロム","ジャレッド・フェルナンデス","フランシスコ・デラクルーズ","アルフォンソ・ソリアーノ","エイドリアン・ギャレット","ジャスティン・ヒューバー","デビッド・ランドクィスト","ドビーダス・ネバラスカス","フェリックス・ラミーレス","ブレイディン・ヘーゲンズ","アレファンドロ・ケサダ","アンディ・フィリップス","アンヘル・バウチスター","エスターリン・フランコ","エリック・ラドウィック","サルバトーレ・ウルソー","ジェイソン・プライディ","ディオーニ・ソリアーノ","ドリュー・アンダーソン","フアン・フェリシアーノ","フェリックス・ペルドモ","ブライアン・バリントン","ブラッド・エルドレッド","マリオ・サンギルベルト","ライアン・マクブルーム","レスリー・フィルキンス","アレハンドロ・メヒア","アントニオ・グスマン","エスマイリン・カリダ","エレフリス・モンテロ","ケーシー・ローレンス","サビエル・バティスタ","サンドロ・ファビアン","ザック・フィリップス","ジェイク・シャイナー","ジョアン・タバーレス","ジョニー・ヘルウェグ","ジョハン・ドミンゲス","スコット・マクレーン","スティーブ・デラバー","ソイロ・ベルサイエス","ティム・アイルランド","ネイト・シアーホルツ","フレディ・ターノック","ブライアン・バーデン","ヘロニモ・フランスア","ベン・コズロースキー","マイク・ザガースキー","マット・デビッドソン","ミゲル・ソコロビッチ","ミッキー・マクガイア","ライアン・ブレイシア","ランディ・ジョンソン","ロベルト・コルニエル","アラン・ニューマン","アルフレッド・メナ","アンディー・シーツ","アンヘル・ブリトー","アート・ガードナー","ウェイド・ロードン","エジソン・レイノソ","エリック・スタルツ","カイル・レグナルト","キャム・ミコライオ","クリス・ジョンソン","グレッグ・ラロッカ","ケニー・レイボーン","ゲイル・ホプキンス","ショーン・ダグラス","ジェイ・ジャクソン","ジオ・アルバラード","スコット・シーボル","スコット・ドーマン","チャド・トレーシー","テイラー・スコット","デベルソン・アリア","デュアンテ・ヒース","デーブ・レーシッチ","トニー・ゴンザレス","ナタナエル・マテオ","ネイサン・ミンチー","ネルソン・ロベルト","マイク・デュプリー","マット・レイノルズ","マーティ・ブラウン","モイセス・ラミレス","ライネル・ロサリオ","ラモン・ラミーレス","ルイス・メディーナ","レオネル・カンポス","ロビンソン・チェコ","ロブ・スタニファー","ヴィニー・チューク","DJ.ジョンソン","エディ・ディアス","カルロス・リベラ","キラ・カアイフエ","クリス・ブロック","コルビー・ルイス","ジミー・ハースト","ジム・ブラウワー","テイラー・ハーン","デニス・サファテ","トーマス・ハッチ","ニック・ターリー","ビクトル・マルテ","フアン・サンタナ","フレッド・ルイス","ヘスス・グスマン","ホセ・マルチネス","マイク・シュルツ","マーク・ワトソン","ラミロ・ペーニャ","リゴ・ベルトラン","リック・デハート","山田勉（外野手）","エクトル・ルナ","カイル・バード","ケビン・クロン","ジェフ・ボール","ジム・ヒックス","ジム・ライトル","ジョン・ベイル","ティム・ヤング","ティモ・ペレス","トム・デイビー","マイク・ヤング","マイク・ロマノ","ルイス・ロペス","ロッド・アレン","山田勉（投手）","ホセ・ピレラ","ロナルド大森","大久保美智男","アドゥワ誠","アレックス","バークレオ","三島富久雄","上土井勝利","上野山猛士","中本富士雄","伊与田一範","佐々岡真司","佐々木勝利","佐々木有三","佐藤柳之介","佐野真樹夫","保手浜清利","北原喜久男","千代丸亮彦","及川美喜男","外木場義郎","大瀬良大地","大石弥太郎","天谷宗一郎","安仁屋宗八","宮本洋二郎","小山田保裕","小島心二郎","小早川幸二","小早川毅彦","山元二三男","山崎慎太郎","山田喜久夫","島内颯太郎","常廣羽也斗","恵川康太郎","杉本喜久雄","杉浦竜太郎","東瀬耕太郎","梶原寿美生","榊原聡一郎","横山小次郎","池ノ内亮介","池谷公二郎","深堀十三昭","町田公二郎","羽月隆太郎","苫米地鉄人","荻本伊三武","菊地ハルン","藤原鉄之助","辰見鴻之介","迫丸金次郎","野々垣武志","野村謙二郎","金城宰之左","鈴木銀之助","長谷川昌幸","長谷川良平","長谷部銀次","門前眞佐人","高橋千年美","オスカル","ケムナ誠","シェーン","デヘスス","一岡竜司","三原卓三","三好功一","三好幸雄","三家和真","三島正三","三村敏之","三浦和美","上垣内誠","上本孝一","上本崇司","上村和裕","上田利治","上田好剛","上野弘文","上野義秋","下地勝治","下村栄二","下水流昂","中尾明生","中山正嘉","中川惣一","中本俊彦","中村亘佑","中村健人","中村光良","中村基昭","中村奨成","中村忠男","中村恭平","中村来生","中村真崇","中村祐太","中村貴浩","中東直己","中神拓都","中﨑翔太","久保俊巳","久保祥次","久本祐一","乗替寿好","九里亜蓮","二俣翔一","井上卓也","井上善夫","井上嘉弘","井上弘昭","井上浩司","井上祐二","井上紘一","井生崇光","井石広一","井石礼司","今井啓介","今井譲二","今津光男","仲田侑仁","伊東昂大","伊藤博之","伊藤嘉彦","伊藤寿文","佐々木伸","佐々木健","佐々木泰","佐伯和司","佐川守一","佐竹健太","佐藤剛士","佐藤啓介","佐藤康幸","佐藤玖光","佐藤祥万","佐藤英雄","佐藤裕幸","佐藤貞治","佐藤邦弘","佐野嘉幸","備前喜夫","児玉好弘","入江道生","兵動秀治","内田湘大","内田照文","内田順三","内藤幸三","内間拓馬","前川誠太","前田三郎","前田健太","前田智徳","前田耕司","劔持節雄","加古安宏","加川敏治","加藤伸一","加藤哲郎","加藤英司","北別府学","北崎純一","原田信吉","原田喜臣","原田高史","古沢憲司","古河有一","古神利明","古葉竹識","吉岡厚司","吉年滝徳","吉田勝彦","吉若昌弘","名原典彦","品田寛介","問矢福雄","国木剛太","国貞泰汎","土井文夫","土居正史","土屋雅敬","土生翔平","坂井豊司","坂倉将吾","坂平竜男","城野勝博","堀場英孝","堂園喜義","堂林翔太","塚本博睦","塚本善之","塚田晃平","塹江敦哉","多田大輔","多田昌弘","大下剛史","大原徹也","大和田明","大塚賢一","大島崇行","大沢伸夫","大石昌義","大道温貴","大須賀允","天野浩一","太田直幸","太田龍生","宇草孔基","宇野雅美","守岡茂樹","安竹俊喜","安部友裕","宗近守平","定岡徹久","宮崎仁郎","宮川孝雄","宮本幸信","宮﨑充登","富岡久貴","寺田吉孝","小前博文","小園海斗","小坂佳隆","小塚弘司","小川弘文","小川達明","小川邦和","小林一史","小林幹英","小林敦司","小林樹斗","小林正之","小林結太","小林英樹","小林誠二","小畑幸司","小窪哲也","小西正夫","小谷信雄","小野一也","小野幸一","小野淳平","尾形佳紀","山中達也","山内一弘","山内敬太","山内泰幸","山口喜司","山口慶一","山口政信","山崎明男","山崎隆造","山川武範","山形和幸","山本一義","山本兵吾","山本和男","山本文男","山本浩二","山本真一","山本芳彦","山本通夫","山根和夫","山根雅仁","山田和利","山田治之","山田清志","山田真介","山足達也","山野恭介","山﨑浩司","岡上和典","岡村孝雄","岡林飛翔","岡田忠弘","岡田明丈","岩井活水","岩崎智史","岩崎良夫","岩本貴裕","岩見優輝","岸本大希","岸本秀樹","島原幸雄","島村雄二","川中圭三","川内雄富","川原政数","川口和久","川口盛外","川本徳三","川畑和人","川越亀二","工藤泰己","市田夏生","平岡一郎","平岡敬人","平川雅敏","平田憲穏","平田英之","広岡富夫","広池浩司","庄司隼人","床田寛樹","弘瀬昌彦","弦本悠希","御船英之","徳本政敬","戸根千明","戸田隆矢","拝藤宣雄","持丸泰輝","斉藤優汰","斉藤浩行","斎藤宗美","斎藤達雄","新井貴浩","新田幸夫","日髙暖己","早瀬方禧","星原一彦","曽根海成","有田哲三","服部武夫","望月卓也","望月重勝","朝井茂治","朝山東洋","木下元秀","木下富雄","木下強三","木原彰彦","木原義隆","木山英求","木本茂美","木村一喜","木村俊一","木村国勇","木村拓也","木村昇吾","木村聡司","末包昇大","末永真史","本原正治","本村信吾","杉原望来","杉本正志","杉田久雄","東出輝裕","東山親雄","松下建夫","松井隆昌","松山竜平","松川博爾","松本和弘","松本奉文","松本竜也","松本高明","松林和雄","松浦耕大","松田和久","松田翔太","栄屋悦男","栗原健太","栗林良吏","桜井忠之","桝岡憲三","梁川郁雄","梅原伸亮","梅津智弘","梅田正巳","森下暢仁","森内勝巳","森圭二郎","森川卓郎","森永勝也","森浦大輔","森脇浩司","森重泰浩","植村秀明","植田幸弘","榊原盛毅","榎本直樹","樋笠一夫","横山弘樹","横山竜士","横松寿一","横田斉夫","橋本敬包","橋本甚松","正垣宏倫","正田耕三","正隨優弥","武内久士","比嘉寿光","水上善雄","水本勝己","水沢英樹","水沼四郎","水谷実雄","永井康雄","永井敦士","永川光浩","永川勝浩","永本裕章","永田利則","永田徹登","江原清治","江草仁貴","池田英俊","池田郁夫","沢幡誠士","河井昭司","河内貴哉","河村英文","河田雄祐","河野昌人","河野誠之","津田恒実","浜納一志","深沢修一","淵上信彦","清川栄治","清水叶人","渡辺伸治","渡辺俊治","渡辺信義","渡辺弘基","渡辺澄雄","渡辺秀武","渡邉悠斗","滝口光則","滝村修平","滝浪隆雄","滝田一希","漆畑勝久","澤﨑俊和","瀬戸和則","瀬戸輝信","熊澤秀浩","片岡一美","片岡光宏","片平哲也","片瀬清利","片田謙二","玉山健太","玉木朋孝","玉木重雄","玉村昇悟","田中健二","田中和博","田中広輔","田中成豪","田中敬人","田中昭夫","田中法彦","田中由基","田代尚幸","田所重歳","田村俊介","田村彰啓","田村政男","田村純樹","田辺繁文","甲斐雅人","白井康勝","白武佳久","白濱裕太","白石勝巳","白石静生","皆川康夫","益田尚哉","益田武尚","相澤寿聡","矢崎健治","矢崎拓也","矢野修平","矢野雅哉","石井和行","石井琢朗","石井高雄","石原慶幸","石原貴規","石川喜理","石川政雄","石川清逸","石本龍臣","石橋尚登","石橋文雄","石淵国博","石貫宏臣","磯村嘉孝","磯田憲一","神垣雅詔","神崎安隆","福井保夫","福井優也","福井敬治","福地寿樹","福士敬章","福嶋久晃","福本卓二","秋山正信","秋山翔吾","秋本祐作","秋村謙宏","稲尾義文","稲生高善","窪田幸則","竹下元章","竹下海斗","竹村元雄","竹野吉郎","笘篠賢治","筒井正也","箱田義勝","篠田純平","米山光男","米山哲夫","紀藤真琴","紺田周三","緋本祥男","緒方孝市","美間優槻","興津立雄","船越涼太","芦沢公一","苑田聡彦","若林隆信","若生智男","草深正広","菊地博仁","菊地原毅","菊地武和","菊池保則","菊池敏郎","菊池涼介","萩原康弘","薮田和樹","藤井皓哉","藤井黎來","藤原克巳","藤本典征","藤本勝利","藤本和宏","藤村隆男","衛藤雅登","衣笠祥雄","西原圭大","西原恭治","西山弘二","西山敏明","西山秀二","西川克弘","西川慎一","西川篤夢","西川龍馬","西本明和","西沢正次","西田真二","角南効永","角本義昭","谷下和人","谷内聖樹","谷村豊明","赤井勝利","赤塚健利","赤木晴哉","赤松真人","迎祐一郎","近藤芳久","道原裕幸","達川光男","遠藤淳志","遠藤竜志","酒井大輔","重光芳次","野上浩郷","野崎泰一","野村克彦","野村祐輔","野林大樹","野田誠二","野間峻祥","金丸将也","金城基泰","金城鉄治","金山次郎","金本知憲","金田留広","金石昭人","鈴木健矢","鈴木宇成","鈴木寛人","鈴木将光","鈴木誠也","鈴衛佑規","銚子利夫","銭村健三","銭村健四","鍋屋道夫","長井良太","長冨浩志","長尾辰雄","長島吉邦","長嶋清幸","長持栄吉","長谷部稔","長野久義","門田純良","門田良三","阪田清春","阿南準郎","阿部慶二","雑賀幸男","青木勇人","青木勝男","青木孝夫","青木智史","青木高広","鞘師智也","韮澤雄也","須山成二","飯塚佳寛","飯浜孫美","飯田哲矢","飯田宏行","飯盛節一","高代延博","高山健一","高山郁夫","高岡重樹","高月敏文","高木宣宏","高木真一","高橋俊春","高橋保隆","高橋慶彦","高橋昂也","高橋朗浩","高橋樹也","高橋直樹","高橋英樹","高橋里志","高橋顕法","高沢秀昭","髙木快大","髙木翔斗","髙橋大樹","鵜狩道夫","鵜飼克雄","黒原拓未","黒木宗行","黒田博樹","齊藤悠葵","齊藤汰直","ニック","フィオ","ランス","三好匠","三村勲","三輪悟","上原晃","中村憲","中田廉","中谷翼","丸佳浩","丸岡栄","丸木唯","久保修","井上修","井洋雄","仁平馨","仁部智","今村猛","伊藤真","佐藤剛","倉義和","光吉勉","入来智","八木孝","前間卓","勝田成","北林久","千葉剛","原伸次","原勇治","吉本亮","吉田圭","吉田稔","喜田剛","坂田怜","坪井猛","多田勉","大盛穂","大石清","大竹寛","大羽進","大西馨","大野豊","天本光","奥昌男","安東功","宣山明","宮脇敏","富永一","寺口弘","寺岡孝","寺本勇","小俣進","小原修","小松剛","小船翼","小野拓","小鶴誠","山中潔","山口晋","山口翔","山本穰","山本翔","山田潤","山﨑健","岡本駿","岡義朗","岩本章","島崎毅","嶋重宣","川島堅","川端順","平山智","平川蓮","広島衛","廣瀬純","新家颯","新美敏","會澤翼","望月一","木村勉","杉斉英","杉田健","杉田勇","村上毅","松山昇","松本隆","松林茂","松田隆","松野保","林昌樹","林晃汰","林次郎","林正毅","柴田猛","栗田聡","栫政彦","根建忍","桒原樹","桧垣忠","梵英心","棟居進","森下宗","森井茂","森厚三","森笠繁","森翔平","森跳二","横溝桂","橋本啓","武智修","永射保","江夏豊","江藤智","沢野肇","河野佳","津野浩","浅井樹","渋谷通","片山博","牧野塁","田中尊","田中彰","田村恵","申成鉉","畝章真","畝龍実","石黒忠","福良徹","竹中昭","笠松実","管田薫","羽里功","萩本保","蔦行雄","藤井弘","行木俊","西村宏","西清孝","豊田清","足立亘","辻井弘","辻大雅","鈴木健","鈴木哲","鎌田豊","長内孝","長崎元","門谷昭","関根勇","青木陸","音重鎮","高信二","高木茂","高橋建","髙太一","鳥谷元","鶴田泰","黒川浩","龍憲一","辻空"];

  var carpAliasHints=["エルドレッド","ジョンソン","ノムケン","ブラウン","ラロッカ","佐々岡","北別府","大瀬良","会沢","前田","坂倉","堂林","小園","床田","新井","會澤","栗林","森下","江夏","津田","浩二","秋山","緒方","菊池","衣笠","誠也","達川","野間","金本","黒田","丸"];

  // カウンター正本の読みだけを軽量ヒントとして保持。本文と数値は従来どおりlazy読込。
  var tairanoReadingHints=["きょくかんきほうてんぐ","ざんぎゃくなるまじゅう","だいろくてんしゅらおう","しれんのふうまいしゃ","すぎたにぜんじゅぼう","ひょうけつのまちょう","ふかんぜんなきょじん","ほんがんじきょうにょ","かみいずみのぶつな","きょうらんこんごう","ごうせつおんりょう","こばやかわたかかげ","しらつゆのあいこん","ほうじょううじやす","ほんがんじけんにょ","まつだいらもとやす","むめいのこぶしょう","ゆきやまのせいれい","あさくらかげのり","あさくらそうてき","あさくらよしかげ","あさひなやすとも","あしかがよしあき","あしかがよしてる","いしかわいえなり","いまがわうじざね","いまがわよしもと","うえすぎけんしん","うごめくじゃれい","かげふみのてんぐ","きえないおんねん","げんえいだいじゃ","ごうゆうのあっき","さいとうどうさん","しもつまらいれん","せきぐちうじひろ","たちばなむねしげ","とくがわいえやす","とこよのじゅつし","とこよのせんぺい","なだかきくぎょう","はっとりはんぞう","はなかげのめがみ","はなさきのめがみ","ひたんのせいれい","ふなおかやまうば","ほそかわふじたか","むめいのくぎょう","ももちさんだゆう","あざいすけまさ","あざいながまさ","あらきむらしげ","いそのかずまさ","おかべもとのぶ","くろだかんべえ","ごほうあしゅら","さいかまごいち","さかいただつぐ","さなだまさゆき","しまづよしひろ","しゅてんどうじ","しゅらふうじん","しゅららいじん","しんあんのおに","じんらいらせつ","すずきしげおき","ぜんませっさい","たけだしんげん","たけだのぶとら","なぞのばけもの","はしばひでよし","ふうまこたろう","まがらなおたか","まついむねのぶ","みよしながやす","みよしながよし","やまとのまえい","よしだやまうば","いいなおもり","おだのぶゆき","かてんやしゃ","きそよしなか","ぐふうらせつ","じょろうぐも","だてまさむね","なぞのおとこ","もりよしなり","じゅけいに","おいち","おまつ","ぜつ"];

  function normalizeKanaForRouting(text){
    var raw=String(text||''),out=raw;
    try{
      var conv=window.JINPO_BOT_CONVERSATION;
      if(conv&&typeof conv.normalizeCasualInput==='function'){
        var casual=conv.normalizeCasualInput(out);
        if(casual&&casual.text)out=String(casual.text);
      }
      if(conv&&typeof conv.normalizeKanaInput==='function'){
        var kana=conv.normalizeKanaInput(out);
        if(kana&&kana.text)out=String(kana.text);
      }
      if(conv&&typeof conv.normalizeKnownInput==='function'){
        var known=conv.normalizeKnownInput(out);
        if(known&&known.text)out=String(known.text);
      }
    }catch(e){}
    return out;
  }

  function carpHintFold(value){
    var s=String(value||'');
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[ァ-ヶ]/g,function(ch){return String.fromCharCode(ch.charCodeAt(0)-0x60);}).replace(/ヴ/g,'ゔ').toLowerCase();
  }

  function compactHintFold(value){
    return carpHintFold(value).replace(/[\s、。,.!！?？「」『』（）()・〜~ー―…:：;；\[\]【】\/／_-]/g,'');
  }

  function looseHintFold(value){
    var s=String(value||'');
    try{s=s.normalize('NFKC');}catch(e){}
    try{
      var conv=window.JINPO_BOT_CONVERSATION;
      if(conv&&typeof conv.looseKanaFold==='function')s=conv.looseKanaFold(s);
      else s=carpHintFold(s);
    }catch(e){s=carpHintFold(s);}
    return String(s).toLowerCase().replace(/[\s、。,.!！?？「」『』（）()・〜~ー―…:：;；\[\]【】\/／_-]/g,'');
  }


  function omissionHintKeys(value,minOriginalLength,minVariantLength){
    var base=compactHintFold(value),out=[],seen=Object.create(null);
    var minOriginal=minOriginalLength||6,minVariant=minVariantLength||5;
    if(!base||base.length<minOriginal||!/^[ぁ-ゖ]+$/.test(base))return out;
    for(var i=1;i<base.length;i++){
      var key=base.slice(0,i)+base.slice(i+1);
      if(key.length<minVariant||seen[key])continue;
      seen[key]=1;out.push(key);
    }
    return out;
  }

  function escapeHintRe(value){return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

  function omissionHintMatches(text,folded,keys,topicRe){
    if(!keys||!keys.length)return false;
    var suffixRe=/^(?:は|って|の|について|をおしえて|おしえて|です|だよ|かな|か|を|が|も|さん|せんしゅ|かんとく|とうしゅ|かぞく|しんぞく|おくさん|つま|せいせき|けいれき|いつわ|げんえき|いんたい|ねんれい|なんさい|かうんた)/;
    for(var i=0;i<keys.length;i++){
      var key=keys[i];if(!key)continue;
      var whole=new RegExp('^'+escapeHintRe(key)+'(?:は|って|の|について|をおしえて|おしえて|です|だよ|かな|か)?$');
      if(whole.test(folded))return true;
      if(topicRe&&topicRe.test(text)){
        var at=folded.indexOf(key);
        while(at>=0){
          var before=folded.slice(0,at),after=folded.slice(at+key.length);
          var beforeOk=!before||/(?:は|って|の|について|を|が|も)$/.test(before);
          var afterOk=!after||suffixRe.test(after);
          if(beforeOk&&afterOk)return true;
          at=folded.indexOf(key,at+1);
        }
      }
    }
    return false;
  }


  // 英傑マスター383名の氏名だけをlazy読込判定用の軽量ヒントとして保持。
  var heroNameHints=["豊臣秀長","片倉景綱(右腕)","竹中半兵衛(右腕)","酒井忠次(通)","薄田兼相","島津日新斎","百地三太夫(野望)","風魔小太郎(野望)","毛利隆元","斎藤義龍(新春)","斎藤義龍","前田利家(雄材)","安国寺恵瓊","上杉憲政","武田晴信","三条の方","堀秀政","雫の者","伊達政宗(起源)","北条氏照(剛柔)","甲斐宗運","佐竹義重","片倉景綱","今川義元","平手政秀","島津家久","上杉謙信","長宗我部元親","本願寺顕如","吉川元春","黒百合(納涼)","黒百合","丹羽長秀(風雲)","直江兼続(王佐)","安宅冬康","稲葉一鉄","斎藤朝信","支倉常長","十河一存","北条氏邦","井伊直政","谷忠澄","伊奈忠次","唐沢玄蕃","御子神典膳","大熊朝秀","関口氏広","岡国高","鈴木元信","渡辺了","安藤良整","大沢正秀","下間頼竜","斎藤利三(神祇)","斎藤利三","織田信忠","大野治長","早川殿","武田信繁","庵原将監","林崎甚助","直江景綱","山上道及","雑賀孫市(道化)","望月千代女(道化)","鍋島直茂(乱雲)","鍋島直茂","島津義久","蜂須賀正勝","前田利家(兎忍)","納涼忍お綾","九鬼嘉隆","大谷吉継(西軍)","大谷吉継","島津豊久","伊賀崎道順","石川数正(臥薪)","石川数正","赤尾清綱","望月吉棟","陶晴賢","山中鹿之介","豊臣秀吉","高台院","愛姫(起源)","毛利勝永","香宗我部親泰","井伊直政(勇猛)","村上義清","渡辺守綱","豊臣秀次","細川忠興(山紫)","大内義隆","金森長近","柳生宗矩","大久保忠世","妙玖","義姫","明石全登","竹中重門","山県昌景(泰然)","真田信幸(泰然)","長野業正","霧隠才蔵","尼子経久","木下秀長","井伊直虎","名古屋山三郎","大祝鶴","下間頼廉(籠城)","北条綱成(籠城)","甲斐姫","宇喜多直家","細川藤孝(立役)","羽柴秀吉","小早川隆景","藤堂高虎(名臣)","宝蔵院胤栄","上泉信綱","朝倉宗滴","加藤段蔵","藤林正保","望月千代女","黒田官兵衛","竹中半兵衛","本多正信","浅井長政","朝倉義景","石田三成","蒲生氏郷","真柄直隆","伊達政宗","雑賀孫市","愛姫","鈴木重意","岡吉正","原田宗時","足利義輝","朝比奈泰朝","和田惟政","三淵晴員","瀬名氏俊","猿飛佐助","杉谷善住坊","室賀正武","植田光次","斎藤道三","武田勝頼","直江兼続","本願寺証如","七里頼周","本庄繁長","ねね(納涼)","羽柴秀吉(納涼)","前田慶次","筒井順慶","小西行長","北条氏康","風魔小太郎","服部半蔵","板部岡江雪斎","雑賀孫六","本願寺教如","三好長慶","太原雪斎","松永久秀","真田昌幸","真田幸村","遠山景任","浅井久政","足利義昭","北条幻庵","明智光安","織田信長","明智光秀(十七)","立花誾千代","徳川家康","森田浄雲","百地三太夫","本多忠勝","武田信玄","宇佐美定満","真田幸隆","お市(婚礼)","伊達政宗(新星)","今川義元(周年)","斎藤道三(巳)","雑賀孫市(陣羽織)","三好長慶(生殺)","上杉謙信(野望)","織田信長(周年)","織田信長(覇王)","真田幸村(新星)","真田昌幸(吸血)","浅井長政(婚礼)","足利義輝(野望)","大友宗麟","長宗我部元親(納涼)","長尾景虎","長尾虎","徳川家康(東軍)","武田信玄(野望)","北条氏康(獅子)","毛利元就","おまつ(奇譚)","お江","ガラシャ(聖)","ねね(和装)","まつ(兎忍)","もののふ小町","愛姫(特別)","梓","遠足娘まり","加藤清正","帰蝶","宮本武蔵(涼)","蛍(吸血)","後藤又兵衛","江里口信常","降神祈祷師","高橋紹運","黒田長政","黒猫ノア","佐々木小次郎(涼)","柴田勝家(風雲)","種子島時堯","出雲阿国(周年)","出雲阿国(神将)","出雲阿国(野望)","小松姫(航海)","小松姫(水練)","小早川隆景(羽織)","晶","松永久秀(野望)","城大工かんな","森長可","森蘭丸(凶禍)","真田幸村(水練)","真田信幸(航海)","石田三成(西軍)","仙桃院","前田慶次(神将)","前田慶次(野望)","滝川一益(風雲)","竹中半兵衛(知将)","島左近","道場娘まり","道場娘まり(和装)","鍋島直茂(人狼)","濃姫","濃姫(特別)","福島正則","北条氏政(獅子)","本多忠勝(盛夏)","魔女ルシア","魔女娘まり","明智光秀(闇)","明智光秀(初期)","立花宗茂","立花宗茂(盛夏)","立花誾千代(猫又)","お知恵","サンチョ","もの知り爺","愛弟子ノア","安藤守就","伊達成実","雨森弥兵衛","鵜殿長持","遠藤直経","岡部元信","岡部正綱","海北綱親","鎧鍛冶次郎","柿崎景家","関掃部","願証寺証恵","鬼庭綱元","鬼庭左月斎","京極高吉","興正寺顕尊","光教寺顕誓","高坂昌信","細川晴元","細川藤孝","榊原康政","三井遊雲軒","三好義賢","三好長逸","山県昌景","山中俊房","氏家卜全","柴田勝家","酒井忠次","出浦盛清","小松姫","色部勝長","伸介","森蘭丸","真田信幸","陣蔵","西光寺真敬","滝川一益","丹羽長秀","池田勝正","朝倉景紀","朝倉景鏡","朝倉景隆","朝倉景連","的場源四郎","藤岡屋伝助","道場忍お綾","内藤昌豊","馬場信春","伴長信","不破光治","片倉重長","北条高広","北条氏規","北条氏照","北条氏政","魔導士ルシア","明智光秀","矢沢頼綱","窯隠れの才蔵","鈴木重朝","粟津元隈","伊達実元","一宮宗是","果心居士","岩成友通","蛍","原虎胤","古田織部","甲山太郎次郎","荒木村重","高力清長","今川氏真","佐久間信盛","佐々成政","細川忠興","山本勘助","上杉景勝","新庄直頼","新発田長敦","真田信尹","石川昭光","朝倉景恒","鳥居景近","鳥居元忠","津田監物","福島勝広","北条綱成","本願寺実悟","来福寺左京","井伊直親","印牧能信","塩屋秋貞","下間頼廉","下津一通","可児才蔵","鬼小島弥太郎","小山田信茂","小雀","新開実綱","清水康英","石川五右衛門","泉田重光","内藤正成","脇坂安治","簗田新八","藤堂高虎","筧十蔵","母里太兵衛","甲斐姫(鷹爪)","尼子晴久","小田氏治","朝倉義景(八雷)","お市(八雷)","荒木村重(風雅)","真田幸村(神魔)","茶々","北条氏邦(獅子)"];

  var carpHintRows=null,tairanoHintRows=null;
  function ensureCarpHintRows(){
    if(carpHintRows)return carpHintRows;
    var all=carpNameHints.concat(carpAliasHints),seen=Object.create(null);
    carpHintRows=[];
    all.forEach(function(name){
      var exact=compactHintFold(name),loose=looseHintFold(name),key=name+'\u0001'+exact+'\u0001'+loose;
      if(seen[key])return;seen[key]=1;
      carpHintRows.push({name:name,exact:exact,loose:loose,allowLoose:!!(loose&&loose.length>=5&&loose!==exact),omissions:omissionHintKeys(exact,6,5)});
    });
    var omissionMap=Object.create(null);
    carpHintRows.forEach(function(row){(row.omissions||[]).forEach(function(key){if(!omissionMap[key])omissionMap[key]=Object.create(null);omissionMap[key][row.name]=1;});});
    carpHintRows.forEach(function(row){row.omissions=(row.omissions||[]).filter(function(key){return Object.keys(omissionMap[key]||{}).length===1;});});
    carpHintRows.sort(function(a,b){return Math.max(b.exact.length,b.loose.length)-Math.max(a.exact.length,a.loose.length);});
    return carpHintRows;
  }

  function ensureTairanoHintRows(){
    if(tairanoHintRows)return tairanoHintRows;
    var looseMap=Object.create(null);
    tairanoReadingHints.forEach(function(reading){
      var loose=looseHintFold(reading);
      if(!loose||loose.length<5)return;
      if(!looseMap[loose])looseMap[loose]=Object.create(null);
      looseMap[loose][reading]=1;
    });
    var omissionMap=Object.create(null);
    tairanoReadingHints.forEach(function(reading){
      omissionHintKeys(reading,6,5).forEach(function(key){if(!omissionMap[key])omissionMap[key]=Object.create(null);omissionMap[key][reading]=1;});
    });
    tairanoHintRows=tairanoReadingHints.map(function(reading){
      var exact=compactHintFold(reading),loose=looseHintFold(reading);
      var omissions=omissionHintKeys(reading,6,5).filter(function(key){return Object.keys(omissionMap[key]||{}).length===1;});
      return {exact:exact,loose:loose,allowLoose:!!(loose&&loose.length>=5&&looseMap[loose]&&Object.keys(looseMap[loose]).length===1),omissions:omissions};
    }).sort(function(a,b){return Math.max(b.exact.length,b.loose.length)-Math.max(a.exact.length,a.loose.length);});
    return tairanoHintRows;
  }

  function hasCarpNameHint(text){
    var t=normalizeKanaForRouting(text),folded=compactHintFold(t),loose=looseHintFold(t),rows=ensureCarpHintRows();
    for(var i=0;i<rows.length;i++){
      var row=rows[i];
      if(t.indexOf(row.name)>=0||(row.exact&&folded.indexOf(row.exact)>=0)||(row.allowLoose&&loose.indexOf(row.loose)>=0)||omissionHintMatches(t,folded,row.omissions,/カープ|広島|選手|監督|家族|親族|奥さん|成績|経歴|逸話|現役|引退|年齢|何歳/))return true;
    }
    return false;
  }

  function hasTairanoReadingHint(text){
    var raw=String(text||''),folded=compactHintFold(raw),loose=looseHintFold(raw),rows=ensureTairanoHintRows();
    if(!folded)return false;
    for(var i=0;i<rows.length;i++){
      var row=rows[i],hint=row.exact;
      if(!hint)continue;
      if(hint.length>=5&&folded.indexOf(hint)>=0)return true;
      if(row.allowLoose&&loose.indexOf(row.loose)>=0)return true;
      if(omissionHintMatches(text,folded,row.omissions,/カウンター|天下統一奇譚|天下武技大会|修羅の間|二条城|桶狭間|封印|場所|入手|正本/))return true;
      // 短い読みは一般語との衝突を避け、名前そのものを尋ねている形だけに限定する。
      if(hint.length>=3&&new RegExp('^'+hint+'(?:は|って|の|について|をおしえて|おしえて|です|だよ|かな|か)?$').test(folded))return true;
    }
    return false;
  }

  function hasHeroNameHint(text){
    var folded=compactHintFold(normalizeKanaForRouting(text));
    if(!folded)return false;
    for(var i=0;i<heroNameHints.length;i++){
      var key=compactHintFold(heroNameHints[i]);
      if(key&&folded.indexOf(key)>=0)return true;
    }
    return false;
  }
  function shortEditDistance(a,b,max){
    a=String(a||'');b=String(b||'');if(Math.abs(a.length-b.length)>max)return max+1;
    var prev=[],cur=[],i,j,rowMin;for(j=0;j<=b.length;j++)prev[j]=j;
    for(i=1;i<=a.length;i++){
      cur[0]=i;rowMin=cur[0];
      for(j=1;j<=b.length;j++){cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));if(cur[j]<rowMin)rowMin=cur[j];}
      if(rowMin>max)return max+1;
      var tmp=prev;prev=cur;cur=tmp;
    }
    return prev[b.length];
  }
  function hasHeroFuzzyNameHint(text){
    var t=normalizeKanaForRouting(text),m=t.match(/^(.{2,24}?)(?:の|って|は|について|よりも?|に比べて)?(?:強み|つよみ|強いところ|強いとこ|弱み|よわみ|弱いところ|弱いとこ|得意|とくい|苦手|にがて|順位|何位|どんな英傑|どんな人|どんなやつ|生命|気合|腕力|腕りょく|うでりょく|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性|上位互換|下位互換|完全上位|完全下位)/);
    if(!m)return false;
    var q=compactHintFold(m[1].replace(/^(?:英傑|武将|キャラ)[の ]*/,''));
    if(q.length<4)return false;
    var found=0;
    for(var i=0;i<heroNameHints.length;i++){
      var key=compactHintFold(heroNameHints[i]),lim=Math.max(q.length,key.length)>=8?2:1;
      if(Math.abs(q.length-key.length)>lim)continue;
      if(shortEditDistance(q,key,lim)<=lim){found++;if(found>=1)return true;}
    }
    return false;
  }

  function recentTairanoAmbiguity(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-10;i--){
      if(!h[i]||h[i].role!=='assistant')continue;
      var raw=String(h[i].text||'');
      if(/候補が複数/.test(raw)&&/場所か名前/.test(raw))return true;
    }
    return false;
  }

  function counterCandidateSelector(text){
    var t=normalizeKanaForRouting(text)
      .replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'')
      .replace(/[？?！!。]+$/,'')
      .trim();

    if(!t||t.length>40)return false;

    t=t
      .replace(/^(?:いや|違う|ちがう|そうじゃない|それじゃない|そっちじゃない|訂正|やっぱり|やっぱ|ごめん|すまん|まちがえた|間違えた)[、,\s]*/,'')
      .trim();
    var parts=t.split(/(?:じゃなくて|じゃなく|ではなくて|ではなく|でなくて|でなく)/);
    if(parts.length>=2)t=parts[parts.length-1].trim();

    if(/^(?:[1-6一二三四五六](?:番|番目|つ目)?|上から[1-6一二三四五六](?:番|番目|つ目)?|最初|一番上|上(?:のやつ|の方|のほう)?|真ん中|中(?:のやつ|の方|のほう)?|最後|一番下|下(?:のやつ|の方|のほう)?)$/.test(t))return true;

    return /桶狭間|富士地下洞穴|武技大会|大会天|大会地|京都|二条城|修羅の間|封印|今川義元|今川氏真|足利義輝|足利義昭|義元|氏真|義輝|義昭/.test(t);
  }

  function recentHeroKnowledge(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-12;i--){
      var m=h[i]||{},meta=m.meta||{},d=meta.data||{};
      if(m.role==='assistant'&&d.heroKnowledge)return true;
      if(m.role==='user'&&/カープ|カウンター|鬼神石|九十九|魔導結晶|陣法検索|家臣計算/.test(String(m.text||'')))break;
    }
    return false;
  }
  function heroContinuationHint(text,history){
    if(!recentHeroKnowledge(history))return false;
    var t=normalizeKanaForRouting(text);
    if(!t||t.length>42||/全英傑|英傑全体|全部の英傑/.test(t))return false;
    return /^(?:じゃあ|では|なら|あと|次は|今度は|そこから|そのまま|さらに|続けて)?[、,\s　]*(?:(?:侍|さむらい|傾奇者|かぶきもの|僧|忍者|にんじゃ|神主|巫女|神職|薬師|くすし|鍛冶屋|かじや|陰陽師|おんみょうじ)(?:だけ|のみ|以外|じゃない|ではない|除いて|抜き)|(?:コスト|コスと|こすと)\s*[4-8](?:だけ|のみ|以外|じゃない|ではない|除いて|抜き)|(?:生命|気合|腕力|腕りょく|うでりょく|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性).*(?:順|ランキング|トップ|高い|低い|平均|中央値|以上|以下|未満)|(?:技能|固有技能).*(?:ある|あり|ない|なし|未登録|登録|だけ)|因子.*(?:だけ|のみ|以外|なし|持ち|持たない)|(?:一番|最も)?(?:差が大きい|差が小さい|差がない|能力ごと|各能力|能力別|1位を取|トップを取|共通点|同じところ)|(?:割合|比率|登録値|数値差)(?:だと|では|で|なら)?)/.test(t);
  }

  function groupsForMessage(text,history){
    var t=normalizeKanaForRouting(text);
    var groups=[];

    // 常時小さな学習補助。外部生成AIは使用しない。
    groups.push('learning');

    if(/九十九|つくも|鬼神石|魔導結晶|まどう|不壊金剛|八幡神の武運/.test(t)){
      groups.push('tool');
    }

    if(
      /英傑|英欠|英決|武将|固有技能|因子|職業|コスト|コスと|こすと/.test(t) ||
      hasHeroNameHint(t) ||
      hasHeroFuzzyNameHint(t) ||
      (/(?:追加行動|再行動|武装解除|回復|蘇生|標的固定|行動不能|術耐性|物理耐性|全体攻撃|単体攻撃|継続回復)/.test(t)&&/(?:英傑|武将|キャラ|誰|だれ|何人|何名|技能|持つ|ある|できる|する)/.test(t)) ||
      (/(?:平均|平均値|中央値|真ん中の値)/.test(t)&&/(?:生命|気合|腕力|腕りょく|うでりょく|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性)/.test(t)) ||
      (/(?:前後|ぜんご|付近|ふきん|近い|ちかい|近辺|[0-9]000台|[0-9]{3,5}\s*(?:から|〜|～|~|－|-)\s*[0-9]{3,5}|[0-9]{1,3}位(?:から|〜|～|~|－|-)[0-9]{1,3}位|上位\s*[0-9]{1,3}\s*(?:%|％|パーセント)|同じ(?:数値|値|英傑)?)/.test(t)&&/(?:生命|気合|腕力|腕りょく|うでりょく|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性)/.test(t)) ||
      (/(?:より|上回|下回|超え|勝って|勝る|上位互換|下位互換)/.test(t)&&/(?:生命|気合|腕力|腕りょく|うでりょく|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性|全能力|全ステ)/.test(t)) ||
      (/(?:生命|気合|腕力|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性)/.test(t) &&
       !/(?:陣法|編成|組み合わせ|因縁|陣形|検索|適用|差替|配置|除外|全MAX|九十九|鬼神石|魔導結晶|鎮魂符)/.test(t) &&
       (/(?:誰|だれ|どれ|ランキング|トップ|上位|下位|一番|最高|最低)/.test(t) ||
        /^.{2,24}の(?:生命|気合|腕力|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性)/.test(t))) ||
      heroContinuationHint(t,history)
    ){
      groups.push('hero');
    }

    if(
      /カウンター|かうんた|修羅の間|天下武技大会|天下統一奇譚|二条城|桶狭間|封印|足利義昭|禅魔|雪斎/.test(t) ||
      hasTairanoReadingHint(t) ||
      (recentTairanoAmbiguity(history)&&counterCandidateSelector(t))
    ){
      groups.push('tairano');
    }

    if(
      /カープ|広島東洋|広島カープ|NPB|セ・リーグ|セリーグ|江夏の21球|赤ヘル|樽募金|カープ女子|マツダスタジアム|ズムスタ/.test(t) ||
      hasCarpNameHint(t)
    ){
      groups.push('carp');
    }

    if(/天気|気温|降水|雨|雪|台風|為替|円安|円高|ドル|ユーロ|ニュース|最新|現在|今どう|最近どう|調べて|検索して/.test(t)){
      groups.push('web');
    }

    if(/家臣/.test(t)&&/(?:名前|名付け|命名|名字|苗字|姓|名を)/.test(t)){
      groups.push('kashin');
    }

    if(/何ができ|なにができ|できること|使い方|どう使|とは|意味|教えて|説明|って何|ってなに|何\?|何？|なに\?|なに？|どういう/.test(t)){
      groups.push('help');
    }

    if(/覚え|記憶|前に話|前の会話|共有記憶|Firebase|ファイアベース/.test(t)){
      groups.push('firebase');
    }

    // 専用話題に当たらない通常会話は雑談エンジンも読む。
    // 専用話題に当たらない会話はローカル雑談エンジンを使う。
    var hasSpecialist=groups.some(function(g){return g!=='learning';});
    if(!hasSpecialist||/こんにちは|こんばんは|おはよう|疲れ|眠い|暑い|寒い|暇|お腹|腹減|元気|ありがとう|ごめん|ほんと|ばか|おばか|雑談|話そう/.test(t)){
      groups.push('smalltalk');
    }

    return uniqueNames(groups);
  }

  function ensureForMessage(text,history){
    var groups=groupsForMessage(text,history);
    return Promise.all(groups.map(ensureGroup)).then(function(){
      return {ok:true,groups:groups};
    }).catch(function(e){
      console.error('歩き巫女 lazy load:',e);
      return {ok:false,groups:groups,error:String(e&&e.message||e)};
    });
  }

  function loadLightIdleOptional(){
    // 起動直後に先読みするのは、小さく使用頻度の高い会話補助だけ。
    // Web / カープ / 家臣命名 / 正本データは実際に使うまで取得しない。
    var idleGroups=['learning','help','smalltalk'];
    return Promise.all(idleGroups.map(ensureGroup)).then(function(){
      window.ARUKIMIKO_LOAD_METRICS.lightOptionalReadyMs=elapsed();
      window.ARUKIMIKO_SHARED.lightOptionalReady=true;
      return true;
    });
  }

  function loadFirebaseIdle(){
    // 共有記憶は初期表示と競合させず、さらに後から準備。
    return ensureGroup('firebase').then(function(){
      window.ARUKIMIKO_LOAD_METRICS.firebaseReadyMs=elapsed();
      window.ARUKIMIKO_SHARED.firebaseReady=true;
      return true;
    });
  }

  window.ARUKIMIKO_LAZY={
    version:'1.0.0',
    groups:lazyGroups,
    loaded:lazyLoaded,
    ensureGroup:ensureGroup,
    ensureForMessage:ensureForMessage,
    groupsForMessage:groupsForMessage,
    recentTairanoAmbiguity:recentTairanoAmbiguity,
    counterCandidateSelector:counterCandidateSelector,
    hasCarpNameHint:hasCarpNameHint,
    hasHeroNameHint:hasHeroNameHint,
    loadLightIdleOptional:loadLightIdleOptional,
    loadFirebaseIdle:loadFirebaseIdle
  };

  var coreScripts=coreCommon
    .concat(mode==='jinpo'?coreJinpo:[])
    .concat(coreTail);

  window.ARUKIMIKO_LOAD_METRICS.visualScriptCount=visualScripts.length;
  window.ARUKIMIKO_LOAD_METRICS.coreScriptCount=coreScripts.length;
  window.ARUKIMIKO_LOAD_METRICS.lazyScriptCount=uniqueNames(
    Object.keys(lazyGroups).reduce(function(a,k){return a.concat(lazyGroups[k]);},[])
  ).length;
  window.ARUKIMIKO_LOAD_METRICS.scriptCount=
    window.ARUKIMIKO_LOAD_METRICS.visualScriptCount+
    window.ARUKIMIKO_LOAD_METRICS.coreScriptCount;
  window.ARUKIMIKO_LOAD_METRICS.uiReadyMs=null;
  window.ARUKIMIKO_LOAD_METRICS.firstPaintMs=null;
  window.ARUKIMIKO_LOAD_METRICS.coreStartMs=null;
  window.ARUKIMIKO_LOAD_METRICS.coreReadyMs=null;
  window.ARUKIMIKO_LOAD_METRICS.lightOptionalReadyMs=null;
  window.ARUKIMIKO_LOAD_METRICS.firebaseReadyMs=null;

  function waitOnePaint(){
    return new Promise(function(resolve){
      if(typeof requestAnimationFrame==='function'){
        requestAnimationFrame(function(){
          window.ARUKIMIKO_LOAD_METRICS.firstPaintMs=elapsed();
          resolve(true);
        });
      }else{
        setTimeout(function(){
          window.ARUKIMIKO_LOAD_METRICS.firstPaintMs=elapsed();
          resolve(true);
        },16);
      }
    });
  }

  // CSSは従来どおり同時開始。
  var cssPromise=Promise.all(cssReady).then(function(cssResults){
    window.ARUKIMIKO_SHARED.css=cssResults;
    window.ARUKIMIKO_LOAD_METRICS.cssReadyMs=elapsed();
    var adv=cssResults.filter(function(x){return x&&x.name==='jinpo-bot-adv-theme.css';})[0];
    if(!adv||!adv.ok)console.error('歩き巫女 ADVテーマCSSを読み込めませんでした。',adv||{});
    return cssResults;
  });

  // ------------------------------------------------------------
  // 真のvisual-first起動
  //
  // v3.3.8ではvisualPromiseとcorePromiseを同じタイミングで作っていたため、
  // coreの通信も直後に始まり、初期UIと帯域を取り合う可能性があった。
  //
  // v3.3.9:
  // visual読込完了
  //   → ブラウザに1回描画機会を渡す
  //   → その後core取得開始
  // ------------------------------------------------------------
  var visualPromise=loadOrdered(visualScripts).then(function(){
    window.ARUKIMIKO_SHARED.uiReady=true;
    window.ARUKIMIKO_LOAD_METRICS.uiReadyMs=elapsed();

    try{
      if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
        window.JINPO_AI_CHAT.setBrainStatus('読込中…','基本機能を準備中');
      }
    }catch(e){}

    return waitOnePaint();
  });

  var corePromise=visualPromise.then(function(){
    window.ARUKIMIKO_LOAD_METRICS.coreStartMs=elapsed();
    return loadOrdered(coreScripts);
  }).then(function(){
    window.ARUKIMIKO_LOAD_METRICS.scriptsReadyMs=elapsed();
    window.ARUKIMIKO_LOAD_METRICS.coreReadyMs=elapsed();
    window.ARUKIMIKO_SHARED.loading=false;
    window.ARUKIMIKO_SHARED.ready=true;
    window.ARUKIMIKO_SHARED.coreReady=true;
    window.ARUKIMIKO_LOAD_METRICS.readyMs=elapsed();

    try{
      if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
        window.JINPO_AI_CHAT.setBrainStatus('案内・検索OK','基本機能の起動完了');
      }
    }catch(e){}

    try{
      window.dispatchEvent(new CustomEvent('arukimiko-ready',{
        detail:{metrics:window.ARUKIMIKO_LOAD_METRICS}
      }));
    }catch(e){}

    // 軽い会話補助だけ3秒後のidleで先読み。
    setTimeout(function(){
      var run=function(){
        loadLightIdleOptional().catch(function(e){
          console.error('歩き巫女 light idle preload:',e);
        });
      };
      if(typeof requestIdleCallback==='function'){
        requestIdleCallback(run,{timeout:4000});
      }else{
        setTimeout(run,500);
      }
    },3000);

    // Firebase共有記憶はさらに後ろへ。
    // Web/カープ/家臣命名/tool/tairanoは完全オンデマンド。
    setTimeout(function(){
      var run=function(){
        loadFirebaseIdle().catch(function(e){
          console.error('歩き巫女 firebase idle preload:',e);
        });
      };
      if(typeof requestIdleCallback==='function'){
        requestIdleCallback(run,{timeout:6000});
      }else{
        setTimeout(run,1000);
      }
    },12000);

    return true;
  });

  visualPromise.catch(function(e){
    console.error('歩き巫女 visual loader:',e);
  });
  corePromise.catch(function(e){
    window.ARUKIMIKO_SHARED.loading=false;
    console.error('歩き巫女 core loader:',e);
  });
  cssPromise.catch(function(e){console.error('歩き巫女 CSS:',e);});
})();
