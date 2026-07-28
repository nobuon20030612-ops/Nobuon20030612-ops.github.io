/*
 * 歩き巫女 サイト共通ローダー v2.4.0
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
  var ASSET_VERSION='2.8.3';

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
  window.ARUKIMIKO_SHARED={version:'2.4.0',baseUrl:base,pageMode:mode};

  function addCss(name){
    var href=new URL(name,base).href+'?v='+encodeURIComponent(ASSET_VERSION);
    if(document.querySelector('link[data-arukimiko-css="'+name+'"]'))return;
    var l=document.createElement('link');
    l.rel='stylesheet';l.href=href;l.setAttribute('data-arukimiko-css',name);
    document.head.appendChild(l);
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

  addCss('jinpo-ai-chat.css');
  addCss('jinpo-bot-adv-theme.css');
  if(mode==='jinpo')addCss('jinpo-bot-guide.css');

  var common=[
    'jinpo-ai-chat.js',
    'jinpo-bot-context.js',
    'jinpo-bot-dialog.js',
    'jinpo-bot-page-context.js',
    'jinpo-bot-learning.js',
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
    'jinpo-bot-firebase-memory.js',
    'jinpo-bot-web.js',
    'jinpo-bot-carp.js',
    'jinpo-bot-kashin-name.js',
    'jinpo-bot-arukimiko.js',
    'jinpo-bot-smalltalk.js'
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

  scripts.reduce(function(p,name){return p.then(function(){return load(name);});},Promise.resolve())
    .catch(function(e){console.error('歩き巫女 共通ローダー:',e);});
})();
