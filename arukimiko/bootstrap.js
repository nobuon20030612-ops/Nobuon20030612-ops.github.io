/*
 * 歩き巫女 bootstrap v1.0.0
 * This file is intentionally stable.
 * Every page loads this file; it fetches the current loader.js without reusing an old cached URL.
 */
(function(){
  'use strict';
  if(window.__ARUKIMIKO_BOOTSTRAP_RUNNING__)return;
  window.__ARUKIMIKO_BOOTSTRAP_RUNNING__=true;

  var current=document.currentScript;
  var base='/arukimiko/';
  try{
    if(current&&current.src)base=new URL('./',current.src).href;
  }catch(e){}

  var s=document.createElement('script');
  s.src=new URL('loader.js?fresh='+Date.now(),base).href;
  s.async=false;
  s.setAttribute('data-arukimiko-loader','1');
  (document.head||document.documentElement).appendChild(s);
})();
