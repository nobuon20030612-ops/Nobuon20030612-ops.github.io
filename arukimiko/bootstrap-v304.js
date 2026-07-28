/*
 * Arukimiko hard bootstrap v3.0.4
 * New filename intentionally bypasses old loader/bootstrap cache paths.
 */
(function(){
  'use strict';
  if(window.__ARUKIMIKO_BOOT_V304__)return;
  window.__ARUKIMIKO_BOOT_V304__=true;
  window.ARUKIMIKO_BOOT_VERSION='3.0.4';

  var BASE='/arukimiko/';
  var VERSION='3.0.5';

  function abs(name){
    return new URL(name,location.origin+BASE).href;
  }

  function removeOldCss(name){
    var nodes=document.querySelectorAll(
      'link[href*="'+name+'"],link[data-arukimiko-css="'+name+'"]'
    );
    Array.prototype.forEach.call(nodes,function(n){
      try{n.remove();}catch(e){}
    });
  }

  function loadCss(name){
    return new Promise(function(resolve){
      removeOldCss(name);

      var link=document.createElement('link');
      link.rel='stylesheet';
      link.href=abs(name)+'?v='+encodeURIComponent(VERSION)+'&fresh='+Date.now();
      link.setAttribute('data-arukimiko-css',name);
      link.setAttribute('data-arukimiko-hardboot','3.0.4');

      link.onload=function(){resolve({ok:true,name:name,url:link.href});};
      link.onerror=function(){
        console.error('Arukimiko CSS failed:',name,link.href);
        resolve({ok:false,name:name,url:link.href});
      };

      (document.head||document.documentElement).appendChild(link);
    });
  }

  function loadScript(name){
    return new Promise(function(resolve,reject){
      var old=document.querySelectorAll(
        'script[data-arukimiko-loader],script[src*="/arukimiko/loader.js"]'
      );
      Array.prototype.forEach.call(old,function(n){
        if(n===document.currentScript)return;
        try{n.remove();}catch(e){}
      });

      var sc=document.createElement('script');
      sc.src=abs(name)+'?v='+encodeURIComponent(VERSION)+'&fresh='+Date.now();
      sc.async=false;
      sc.setAttribute('data-arukimiko-loader','hard-v304');
      sc.onload=function(){resolve();};
      sc.onerror=function(){reject(new Error('loader-failed'));};
      (document.head||document.documentElement).appendChild(sc);
    });
  }

  var css=[
    loadCss('jinpo-ai-chat.css'),
    loadCss('jinpo-bot-adv-theme.css')
  ];

  if(/\/(?:%E9%99%A3%E6%B3%95|陣法)\//i.test(location.pathname)){
    css.push(loadCss('jinpo-bot-guide.css'));
  }

  Promise.all(css).then(function(results){
    window.ARUKIMIKO_HARDBOOT_CSS=results;
    return loadScript('loader.js');
  }).catch(function(e){
    console.error('Arukimiko hard bootstrap failed:',e);
  });

  window.ARUKIMIKO_UI_STATUS=function(){
    var root=document.getElementById('jinpoAiRoot');
    var adv=root?String(
      getComputedStyle(root).getPropertyValue('--arukimiko-adv-theme-loaded')||''
    ).trim().replace(/["']/g,''):'';

    return {
      boot:window.ARUKIMIKO_BOOT_VERSION||'',
      advCssLoaded:adv,
      css:window.ARUKIMIKO_HARDBOOT_CSS||[],
      root:!!root,
      className:root?root.className:'',
      size:root?[
        Math.round(root.getBoundingClientRect().width),
        Math.round(root.getBoundingClientRect().height)
      ]:[0,0]
    };
  };
})();
