/*
 * 歩き巫女 サイト共通ローダー v3.4.9-visualfirst
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
  var ASSET_VERSION='3.3.9';

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
  window.ARUKIMIKO_SHARED={version:'3.4.9-visualfirst',baseUrl:base,pageMode:mode,loading:true,ready:false};

  var loadT0=(window.performance&&typeof performance.now==='function')?performance.now():Date.now();
  window.ARUKIMIKO_LOAD_METRICS={
    version:'3.3.9',
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

  function groupsForMessage(text){
    var t=String(text||'');
    var groups=[];

    // 常時小さな学習補助。初回メッセージ時のみ。
    groups.push('learning');

    if(/九十九|つくも|鬼神石|魔導結晶|まどう|不壊金剛|八幡神の武運/.test(t)){
      groups.push('tool');
    }

    if(/カウンター|かうんた|修羅の間|天下武技大会|天下統一奇譚|二条城|桶狭間|足利義昭|禅魔|雪斎/.test(t)){
      groups.push('tairano');
    }

    if(/カープ|広島東洋|広島カープ|NPB|セ・リーグ|セリーグ/.test(t)){
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

    // 専用話題に当たらない通常会話は雑談エンジンを読む。
    if(groups.length===1||/こんにちは|こんばんは|おはよう|疲れ|眠い|暑い|寒い|暇|お腹|腹減|元気|ありがとう|ごめん|ほんと|ばか|おばか|雑談|話そう/.test(t)){
      groups.push('smalltalk');
    }

    return uniqueNames(groups);
  }

  function ensureForMessage(text){
    var groups=groupsForMessage(text);
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
