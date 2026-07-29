/*
 * 歩き巫女 bootstrap v1.1.0-fast
 * 軽量起動:
 * - CSSとloader.jsを同時開始
 * - リリースversion付きURLでブラウザキャッシュを利用
 * - 時刻付きURLによる毎回の強制再取得を廃止
 */
(function(){
  'use strict';
  if(window.__ARUKIMIKO_BOOTSTRAP_RUNNING__)return;
  window.__ARUKIMIKO_BOOTSTRAP_RUNNING__=true;

  var current=document.currentScript;
  var base='/arukimiko/';
  var VERSION='3.9.0';
  try{
    if(current&&current.src)base=new URL('./',current.src).href;
  }catch(e){}

  function abs(name){return new URL(name,base).href;}

  function startCss(name){
    if(document.querySelector(
      'link[data-arukimiko-css="'+name+'"],link[href*="/arukimiko/'+name+'"]'
    ))return;

    var l=document.createElement('link');
    l.rel='stylesheet';
    l.href=abs(name)+'?v='+encodeURIComponent(VERSION);
    l.setAttribute('data-arukimiko-css',name);
    (document.head||document.documentElement).appendChild(l);
  }

  startCss('jinpo-ai-chat.css');
  startCss('jinpo-bot-adv-theme.css');
  try{
    var p=decodeURIComponent(location.pathname||'');
    if(/\/(?:陣法\/)?jinpo\.html$/i.test(p))startCss('jinpo-bot-guide.css');
  }catch(e){}

  if(document.querySelector(
    'script[data-arukimiko-loader],script[src*="/arukimiko/loader.js"]'
  ))return;

  var sc=document.createElement('script');
  sc.async=false;
  sc.src=abs('loader.js')+'?v='+encodeURIComponent(VERSION);
  sc.setAttribute('data-arukimiko-loader','fast-v110');
  (document.head||document.documentElement).appendChild(sc);
})();
