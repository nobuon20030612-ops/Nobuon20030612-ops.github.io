/*
 * 歩き巫女 サイト共通ローダー v1.1.0
 * TOPや他ツールページに <script src="/陣法/jinpo-bot-loader.js"></script> を1行追加すると、
 * サイト案内・日常会話・Web参照が使える共通歩き巫女を読み込む。
 * 陣法固有の検索操作モジュールは読み込まないため、他ページへの副作用を抑える。
 */
(function(){
  'use strict';
  if(window.__JINPO_BOT_SITE_LOADER__)return;
  window.__JINPO_BOT_SITE_LOADER__=true;
  var current=document.currentScript,src=current&&current.src?current.src:'';
  var base='';try{base=new URL('.',src||location.href).href;}catch(e){base='/陣法/';}
  window.JINPO_BOT_BASE_URL=base;
  window.JINPO_BOT_PAGE_MODE='site';

  function addCss(name){
    var href=new URL(name,base).href;
    if(document.querySelector('link[data-jinpo-bot-css="'+name+'"]'))return;
    var l=document.createElement('link');l.rel='stylesheet';l.href=href;l.setAttribute('data-jinpo-bot-css',name);document.head.appendChild(l);
  }
  function load(name){
    return new Promise(function(resolve,reject){
      var s=document.createElement('script');s.src=new URL(name,base).href;s.async=false;s.setAttribute('data-jinpo-bot-script',name);
      s.onload=function(){resolve();};s.onerror=function(){reject(new Error('load failed: '+name));};document.head.appendChild(s);
    });
  }

  addCss('jinpo-ai-chat.css');
  addCss('jinpo-bot-adv-theme.css');

  var scripts=[
    'jinpo-ai-chat.js',
    'jinpo-bot-context.js',
    'jinpo-bot-learning.js',
    'jinpo-bot-tairano-data.js',
    'jinpo-bot-tairano-knowledge.js',
    'jinpo-bot-site-guide.js',
    'jinpo-bot-memory.js',
    'jinpo-bot-firebase-config.js',
    'jinpo-bot-firebase-memory.js',
    'jinpo-bot-web.js',
    'jinpo-bot-carp.js',
    'jinpo-bot-arukimiko.js',
    'jinpo-bot-smalltalk.js',
    'jinpo-bot.js',
    'jinpo-bot-persona.js',
    'jinpo-bot-adv-theme.js'
  ];
  scripts.reduce(function(p,name){return p.then(function(){return load(name);});},Promise.resolve())
    .catch(function(e){console.error('歩き巫女 共通ローダー:',e);});
})();
