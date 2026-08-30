/*
 * 歩き巫女 Firebase共有記憶 設定 v1.1.0
 *
 * Firebaseコンソールで「歩き巫女」専用Webアプリを登録した後、
 * firebaseConfig の値を貼り付けて enabled:true にする。
 * Firebase Webの firebaseConfig はクライアントへ置く前提の識別情報であり、
 * 秘密鍵ではない。実際の保護は Firestore Security Rules / App Check で行う。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_FIREBASE_CONFIG)return;
  window.JINPO_BOT_FIREBASE_CONFIG={
    version:'1.1.0',
    enabled:true,
    sdkVersion:'12.16.0',
    firebaseConfig:{
      apiKey:'AIzaSyC4OduyeWdOSBfieNpaJ5QQGOfmdsNFP3Y',
      authDomain:'arukimiko-jinpo.firebaseapp.com',
      projectId:'arukimiko-jinpo',
      storageBucket:'arukimiko-jinpo.firebasestorage.app',
      messagingSenderId:'756914751145',
      appId:'1:756914751145:web:e86a5958cc9735dedbcbb8'
    },
    collection:'arukimiko_shared_knowledge_v1',
    defaultTtlMs:30*24*60*60*1000,
    volatileTtlMs:10*60*1000,
    timeoutMs:4500,
    appCheck:{
      enabled:false,
      provider:'recaptcha-enterprise',
      siteKey:''
    }
  };
})();
