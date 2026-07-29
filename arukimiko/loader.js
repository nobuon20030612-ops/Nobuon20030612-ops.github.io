/*
 * 歩き巫女 サイト共通ローダー v3.20.0-memory-resume
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
  var ASSET_VERSION='3.20.0';

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
  window.ARUKIMIKO_SHARED={version:'3.20.0-memory-resume',baseUrl:base,pageMode:mode,loading:true,ready:false};

  var loadT0=(window.performance&&typeof performance.now==='function')?performance.now():Date.now();
  window.ARUKIMIKO_LOAD_METRICS={
    version:'3.20.0',
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
    'jinpo-bot-conversation.js',
    'jinpo-bot-context.js',
    'jinpo-bot-dialog.js',
    'jinpo-bot-page-context.js',
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
    ai:[
      'jinpo-bot-firebase-config.js',
      'jinpo-bot-ai-config.js',
      'jinpo-bot-ai-brain.js'
    ],
    tool:[
      'jinpo-bot-tool-data.js',
      'jinpo-bot-tool-knowledge.js'
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

  function hasCarpNameHint(text){
    var t=String(text||'');
    for(var i=0;i<carpNameHints.length;i++){
      if(t.indexOf(carpNameHints[i])>=0)return true;
    }
    for(var j=0;j<carpAliasHints.length;j++){
      if(t.indexOf(carpAliasHints[j])>=0)return true;
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
    var t=String(text||'')
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


  function instantLocalMessage(text){
    var t=String(text||'').trim();
    return /^(?:こんにちは|こんにちわ|おはよう(?:ございます)?|こんばんは|こんばんわ|ありがとう(?:ございます)?|ありがと|ごめん(?:なさい)?|すみません|おやすみ(?:なさい)?|またね|ばいばい|バイバイ|ただいま|いってきます|行ってきます)[。！!？?ー〜~\s]*$/i.test(t);
  }

  function groupsForMessage(text,history){
    var t=String(text||'');
    var groups=[];

    // 常時小さな学習補助。挨拶など完全ローカルで完結する短文はAI読込を待たせない。
    groups.push('learning');
    if(!instantLocalMessage(t))groups.push('ai');

    if(/九十九|つくも|鬼神石|魔導結晶|まどう|不壊金剛|八幡神の武運/.test(t)){
      groups.push('tool');
    }

    if(
      /カウンター|かうんた|修羅の間|天下武技大会|天下統一奇譚|二条城|桶狭間|封印|足利義昭|禅魔|雪斎/.test(t) ||
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
    // AIが未設定・無料枠到達・通信失敗でも、自然会話をすぐローカルへ戻せるようにする。
    var hasSpecialist=groups.some(function(g){return g!=='learning'&&g!=='ai';});
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
    var idleGroups=['learning','help','smalltalk','ai'];
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
