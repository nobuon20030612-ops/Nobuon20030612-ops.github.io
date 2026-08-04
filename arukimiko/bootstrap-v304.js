/*
 * Arukimiko hard bootstrap v3.0.5-fast
 * New filename intentionally bypasses old loader/bootstrap cache paths.
 */
(function(){
  'use strict';
  if(window.__ARUKIMIKO_BOOT_V304__)return;
  window.__ARUKIMIKO_BOOT_V304__=true;
  window.ARUKIMIKO_BOOT_VERSION='3.0.5-fast';

  var BASE='/arukimiko/';
  var VERSION='3.69.0-stage13ZG';

  function abs(name){
    return new URL(name,location.origin+BASE).href;
  }

  function loadCss(name){
    return new Promise(function(resolve){
      var existing=document.querySelector(
        'link[data-arukimiko-css="'+name+'"],link[href*="/arukimiko/'+name+'"]'
      );
      if(existing){
        if(existing.sheet){
          resolve({ok:true,name:name,existing:true,url:existing.href||''});
          return;
        }
        existing.addEventListener('load',function(){
          resolve({ok:true,name:name,existing:true,url:existing.href||''});
        },{once:true});
        existing.addEventListener('error',function(){
          resolve({ok:false,name:name,existing:true,url:existing.href||''});
        },{once:true});
        return;
      }

      var link=document.createElement('link');
      link.rel='stylesheet';
      link.href=abs(name)+'?v='+encodeURIComponent(VERSION);
      link.setAttribute('data-arukimiko-css',name);
      link.setAttribute('data-arukimiko-hardboot','3.0.5-fast');
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
      var existing=document.querySelector(
        'script[data-arukimiko-loader],script[src*="/arukimiko/'+name+'"]'
      );
      if(existing&&existing!==document.currentScript){
        if(existing.getAttribute('data-arukimiko-loaded')==='1'){
          resolve();
          return;
        }
        existing.addEventListener('load',function(){resolve();},{once:true});
        existing.addEventListener('error',function(){reject(new Error('loader-failed'));},{once:true});
        return;
      }

      var sc=document.createElement('script');
      sc.async=false;
      sc.src=abs(name)+'?v='+encodeURIComponent(VERSION);
      sc.setAttribute('data-arukimiko-loader','hard-v305-fast');
      sc.onload=function(){
        sc.setAttribute('data-arukimiko-loaded','1');
        resolve();
      };
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

  // CSSを待たず、loader.jsも同時に開始する。
  Promise.all(css).then(function(results){
    window.ARUKIMIKO_HARDBOOT_CSS=results;
  }).catch(function(e){
    console.error('Arukimiko CSS bootstrap failed:',e);
  });

  loadScript('loader.js').catch(function(e){
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
