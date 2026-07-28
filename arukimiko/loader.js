/*
 * 歩き巫女 サイト共通ローダー v3.1.5
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
  var ASSET_VERSION='3.0.5';

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
  window.ARUKIMIKO_SHARED={version:'3.1.5',baseUrl:base,pageMode:mode};

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
      if(document.querySelector('script[data-arukimiko-script="'+name+'"]')){resolve();return;}
      var s=document.createElement('script');
      s.src=new URL(name,base).href+'?v='+encodeURIComponent(ASSET_VERSION);s.async=false;s.setAttribute('data-arukimiko-script',name);
      s.onload=function(){resolve();};
      s.onerror=function(){reject(new Error('load failed: '+name));};
      document.head.appendChild(s);
    });
  }

  var cssReady=[
    addCss('jinpo-ai-chat.css'),
    addCss('jinpo-bot-adv-theme.css')
  ];
  if(mode==='jinpo')cssReady.push(addCss('jinpo-bot-guide.css'));

  var common=[
    'jinpo-ai-chat.js',
    'jinpo-bot-conversation.js',
    'jinpo-bot-context.js',
    'jinpo-bot-dialog.js',
    'jinpo-bot-page-context.js',
    'jinpo-bot-learning.js',
    'jinpo-bot-tool-data.js',
    'jinpo-bot-tool-knowledge.js',
    'jinpo-bot-tairano-data.js',
    'jinpo-bot-tairano-knowledge.js',
    'jinpo-bot-site-guide.js'
  ];

  var jinpoCore=[
    'jinpo-bot-state.js',
    'jinpo-bot-actions.js',
    'jinpo-bot-capabilities.js',
    'jinpo-bot-help.js',
    'jinpo-bot-casual.js',
    'jinpo-bot-nlu.js'
  ];

  var commonAfterCore=[
    'jinpo-bot-memory.js',
    'jinpo-bot-firebase-config.js',
    'jinpo-bot-ai-config.js',
    'jinpo-bot-firebase-memory.js',
    'jinpo-bot-web.js',
    'jinpo-bot-carp.js',
    'jinpo-bot-kashin-name.js',
    'jinpo-bot-arukimiko.js',
    'jinpo-bot-smalltalk.js',
    'jinpo-bot-ai-brain.js'
  ];

  var jinpoTail=[
    'jinpo-bot-parser.js',
    'jinpo-bot-interpret.js'
  ];

  var tail=[
    'jinpo-bot.js'
  ];
  if(mode==='jinpo')tail=tail.concat(['jinpo-bot-suggest.js','jinpo-bot-guide.js']);
  tail=tail.concat(['jinpo-bot-persona.js','jinpo-bot-adv-theme.js']);

  var scripts=common
    .concat(mode==='jinpo'?jinpoCore:[])
    .concat(commonAfterCore)
    .concat(mode==='jinpo'?jinpoTail:[])
    .concat(tail);

  Promise.all(cssReady)
    .then(function(cssResults){
      window.ARUKIMIKO_SHARED.css=cssResults;
      var adv=cssResults.filter(function(x){return x&&x.name==='jinpo-bot-adv-theme.css';})[0];
      if(!adv||!adv.ok)console.error('歩き巫女 ADVテーマCSSを読み込めませんでした。',adv||{});
      return scripts.reduce(function(p,name){return p.then(function(){return load(name);});},Promise.resolve());
    })
    .catch(function(e){console.error('歩き巫女 共通ローダー:',e);});
})();
