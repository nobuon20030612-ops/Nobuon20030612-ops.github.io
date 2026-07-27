/*
 * 歩き巫女 Firebase共有記憶 v1.1.0
 * Cloud Firestore + Firebase Anonymous Authentication を遅延読込する。
 * 未設定/障害/無料枠到達時は黙ってローカル記憶へフォールバックし、
 * 陣法検索やBot本体を停止させない。
 *
 * 保存対象: 公開Webで調べた再利用可能な知識のみ。
 * 生チャット全文・陣法の個人操作履歴は保存しない。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SHARED_MEMORY)return;

  var VERSION='1.1.0';
  var ctx={ready:false,initializing:null,app:null,auth:null,db:null,api:null,uid:'',lastError:'',lastOkAt:0};

  function S(v){return String(v==null?'':v).trim();}
  function cfg(){return window.JINPO_BOT_FIREBASE_CONFIG||{};}
  function fcfg(){return cfg().firebaseConfig||{};}
  function configured(){
    var c=cfg(),f=fcfg();
    return !!(c.enabled&&S(f.apiKey)&&S(f.authDomain)&&S(f.projectId)&&S(f.appId));
  }
  function normalize(q){
    var m=window.JINPO_BOT_MEMORY;
    if(m&&typeof m.normalize==='function')return m.normalize(q);
    q=S(q);try{q=q.normalize('NFKC');}catch(e){}
    return q.toLowerCase().replace(/[\s　]+/g,' ').replace(/[？?！!。、・「」『』【】()（）［］\[\]]/g,'').trim().slice(0,120);
  }
  function isVolatile(q){
    var m=window.JINPO_BOT_MEMORY;
    return !!(m&&typeof m.isVolatile==='function'&&m.isVolatile(q));
  }
  function ttlFor(query,opt){
    opt=opt||{};
    if(Number(opt.ttlMs)>0)return Number(opt.ttlMs);
    var c=cfg();
    return isVolatile(query)?(Number(c.volatileTtlMs)||600000):(Number(c.defaultTtlMs)||2592000000);
  }
  function bucketFor(ttlMs,t){return Math.floor((Number(t)||Date.now())/Math.max(60000,ttlMs));}
  async function sha256(text){
    try{
      if(window.crypto&&window.crypto.subtle&&window.TextEncoder){
        var data=new TextEncoder().encode(text),buf=await window.crypto.subtle.digest('SHA-256',data),a=Array.from(new Uint8Array(buf));
        return a.map(function(x){return x.toString(16).padStart(2,'0');}).join('').slice(0,32);
      }
    }catch(e){}
    var h=2166136261>>>0;
    for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return ('00000000'+h.toString(16)).slice(-8);
  }
  function safeDocId(hash,bucket){return 'k_'+hash+'_'+String(bucket);}
  function safeError(e){ctx.lastError=S(e&&((e.code||'')+' '+(e.message||''))).slice(0,240);return null;}
  function timeout(p,ms){
    return Promise.race([p,new Promise(function(_,reject){setTimeout(function(){reject(new Error('firebase-timeout'));},ms||4500);})]);
  }

  async function init(){
    if(ctx.ready)return ctx;
    if(!configured())return null;
    if(ctx.initializing)return ctx.initializing;
    ctx.initializing=(async function(){
      try{
        var v=S(cfg().sdkVersion)||'12.16.0',base='https://www.gstatic.com/firebasejs/'+v+'/';
        var mods=await timeout(Promise.all([
          import(base+'firebase-app.js'),
          import(base+'firebase-auth.js'),
          import(base+'firebase-firestore.js')
        ]),Number(cfg().timeoutMs)||4500);
        var appM=mods[0],authM=mods[1],fsM=mods[2];
        var apps=typeof appM.getApps==='function'?appM.getApps():[],named=null;
        for(var ai=0;ai<apps.length;ai++){if(apps[ai]&&apps[ai].name==='arukimiko-shared-memory'){named=apps[ai];break;}}
        ctx.app=named||appM.initializeApp(fcfg(),'arukimiko-shared-memory');
        ctx.auth=authM.getAuth(ctx.app);
        if(!ctx.auth.currentUser){
          var cred=await timeout(authM.signInAnonymously(ctx.auth),Number(cfg().timeoutMs)||4500);
          ctx.uid=cred&&cred.user?S(cred.user.uid):'';
        }else ctx.uid=S(ctx.auth.currentUser.uid);
        ctx.db=fsM.getFirestore(ctx.app);
        ctx.api={app:appM,auth:authM,fs:fsM};

        var ac=cfg().appCheck||{};
        if(ac.enabled&&S(ac.siteKey)){
          try{
            var checkM=await timeout(import(base+'firebase-app-check.js'),Number(cfg().timeoutMs)||4500);
            if(ac.provider==='recaptcha-enterprise'&&typeof checkM.ReCaptchaEnterpriseProvider==='function'){
              checkM.initializeAppCheck(ctx.app,{provider:new checkM.ReCaptchaEnterpriseProvider(S(ac.siteKey)),isTokenAutoRefreshEnabled:true});
            }else if(ac.provider==='recaptcha-v3'&&typeof checkM.ReCaptchaV3Provider==='function'){
              checkM.initializeAppCheck(ctx.app,{provider:new checkM.ReCaptchaV3Provider(S(ac.siteKey)),isTokenAutoRefreshEnabled:true});
            }
          }catch(appCheckError){/* App Check未設定でも共有記憶本体は止めない */}
        }
        ctx.ready=true;ctx.lastError='';ctx.lastOkAt=Date.now();return ctx;
      }catch(e){ctx.ready=false;safeError(e);return null;}
      finally{ctx.initializing=null;}
    })();
    return ctx.initializing;
  }

  function validRecord(d,norm,ttl){
    if(!d||S(d.normalizedKey)!==norm||!S(d.answer))return false;
    var f=Number(d.fetchedAt)||0;
    if(!f||Date.now()-f>ttl)return false;
    if(Number(d.expiresAt)>0&&Date.now()>Number(d.expiresAt))return false;
    return true;
  }

  async function find(query,opt){
    if(!configured())return null;
    var norm=normalize(query);if(!norm)return null;
    var c=await init();if(!c||!c.ready)return null;
    try{
      var ttl=ttlFor(query,opt),hash=await sha256(norm),bucket=bucketFor(ttl),fs=c.api.fs,col=S(cfg().collection)||'arukimiko_shared_knowledge_v1';
      var ids=[safeDocId(hash,bucket),safeDocId(hash,bucket-1)];
      for(var i=0;i<ids.length;i++){
        var snap=await timeout(fs.getDoc(fs.doc(c.db,col,ids[i])),Number(cfg().timeoutMs)||4500);
        if(snap&&snap.exists()){
          var d=snap.data();
          if(validRecord(d,norm,ttl)){
            ctx.lastOkAt=Date.now();ctx.lastError='';
            return {key:norm,query:S(d.query),title:S(d.title),answer:S(d.answer),url:S(d.url),source:S(d.source)||'共有記憶',fetchedAt:Number(d.fetchedAt)||0,expiresAt:Number(d.expiresAt)||0,volatile:!!d.volatile,shared:true};
          }
        }
      }
      return null;
    }catch(e){return safeError(e);}
  }

  async function remember(query,result,opt){
    if(!configured())return null;
    result=result||{};opt=opt||{};
    var norm=normalize(query||result.query||result.title),answer=S(result.answer||result.extract);
    if(!norm||!answer)return null;
    var c=await init();if(!c||!c.ready)return null;
    try{
      var ttl=ttlFor(query,opt),hash=await sha256(norm),bucket=bucketFor(ttl),fs=c.api.fs,col=S(cfg().collection)||'arukimiko_shared_knowledge_v1';
      var id=safeDocId(hash,bucket),fetchedAt=Number(result.fetchedAt)||Date.now();
      var data={
        schemaVersion:1,
        keyHash:hash,
        normalizedKey:norm.slice(0,120),
        query:S(query||result.query).slice(0,120),
        title:S(result.title||query).slice(0,160),
        answer:answer.slice(0,1200),
        url:S(result.url).slice(0,500),
        source:S(result.source||'Wikipedia').slice(0,80),
        fetchedAt:fetchedAt,
        expiresAt:fetchedAt+ttl,
        volatile:!!result.volatile,
        freshness:result.volatile?'live':'general',
        createdBy:ctx.uid,
        createdAt:fs.serverTimestamp()
      };
      await timeout(fs.setDoc(fs.doc(c.db,col,id),data),Number(cfg().timeoutMs)||4500);
      ctx.lastOkAt=Date.now();ctx.lastError='';return Object.assign({shared:true,id:id},data);
    }catch(e){
      /* create-onlyルールで既存docへの書込が拒否されるケースも正常フォールバック */
      safeError(e);return null;
    }
  }

  function status(){return {version:VERSION,enabled:!!cfg().enabled,configured:configured(),ready:ctx.ready,uid:ctx.uid,lastError:ctx.lastError,lastOkAt:ctx.lastOkAt};}
  function reset(){ctx.ready=false;ctx.initializing=null;ctx.app=null;ctx.auth=null;ctx.db=null;ctx.api=null;ctx.uid='';ctx.lastError='';ctx.lastOkAt=0;}

  window.JINPO_BOT_SHARED_MEMORY={version:VERSION,configured:configured,init:init,find:find,remember:remember,status:status,reset:reset,normalize:normalize};
})();
