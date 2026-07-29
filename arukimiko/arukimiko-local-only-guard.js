/*
 * 歩き巫女 local-only guard v1.0.1
 * 外部の生成AIサービスを会話エンジンとして接続しないための固定ガード。
 * ユーザーの明示指示なしに外部生成AI経路を追加しない。
 */
(function(){
  'use strict';
  if(window.__ARUKIMIKO_LOCAL_ONLY_GUARD__)return;
  window.__ARUKIMIKO_LOCAL_ONLY_GUARD__=true;
  window.ARUKIMIKO_LOCAL_ONLY_POLICY=Object.freeze({
    version:'1.0.1',
    externalGenerativeService:false,
    localConversationOnly:true
  });

  var blockedGlobals=[
    ['JINPO','BOT','AI','BRAIN'].join('_'),
    ['JINPO','AI','CONFIG'].join('_')
  ];
  blockedGlobals.forEach(function(name){
    try{
      Object.defineProperty(window,name,{value:undefined,writable:false,configurable:false});
    }catch(e){
      try{window[name]=undefined;}catch(ignore){}
    }
  });
})();
