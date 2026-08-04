/*
 * 歩き巫女 演出アダプター Stage13Z9 exact v3.69.0 adapter
 * Verified target: Bot v3.69.0 exact ZIP c2763b849e6ad7a58bb4f5755b2025b39b2a38e08a8e0a809db79f01192d4d67.
 * Compatibility rules:
 * - preserves every Transport argument via apply()
 * - uses bounded retries and explicit refresh events; no permanent polling
 * - ignores hydrated/history rows unless a live Transport flow exists
 * - prioritizes explicit expression metadata and never treats mode=search as success
 * - keeps Bot result objects and errors unchanged
 */
(function(){
  'use strict';
  if(window.__ARUKIMIKO_EXPRESSION_ADAPTER_STAGE13Z9__)return;
  window.__ARUKIMIKO_EXPRESSION_ADAPTER_STAGE13Z9__=true;

  var VERSION='13Z9.0-v3.69.0-exact';
  var TARGET_ZIP_SHA256='c2763b849e6ad7a58bb4f5755b2025b39b2a38e08a8e0a809db79f01192d4d67';
  var TARGET='3.69.0';
  var ui=null,installed=false,transportWrapped=false,originalTransport=null,wrappedTransport=null;
  var pendingResult='reply',pendingResultToken=0,activeTransportToken=0,flowToken=0;
  var idleTimer=0,wakeIdleTimer=0,inputNoticeTimer=0,minimizeTimer=0,sentenceTimers=[];
  var ignoreFocusUntil=0,lastTypingNoticeAt=0,IDLE_MS=8000,logs=[],API=null;
  var bypassMin=false,toggleLock=false,toggleUnlockTimer=0;
  var messageObserver=null,classObserver=null,transportRetryTimer=0,transportRetryCount=0,transportVerifyTimer=0,transportVerifyCount=0;
  var hydratedRows=typeof WeakSet==='function'?new WeakSet():null;
  var stats={plays:0,activities:0,inputNotices:0,minimizeRequests:0,minimizeDebounced:0,hiddenStops:0,ignoredRows:0,historyRowsIgnored:0,transportStarts:0,transportResults:0,transportWrapAttempts:0};

  function runtime(){return window.ARUKIMIKO_EXPRESSION_RUNTIME;}
  function now(){return new Date().toLocaleTimeString('ja-JP',{hour12:false});}
  function log(type,detail){
    var row={at:Date.now(),time:now(),type:String(type||''),detail:String(detail||'')};
    logs.push(row);if(logs.length>120)logs.shift();
    try{window.dispatchEvent(new CustomEvent('arukimiko:adapter-log',{detail:row}));}catch(e){}
    return row;
  }
  function play(name,options){
    var r=runtime();if(!r||typeof r.play!=='function')return false;
    stats.plays++;log('state',name);return r.play(name,options||{});
  }
  function clearSentenceTimers(){sentenceTimers.forEach(clearTimeout);sentenceTimers=[];}
  function clearIdle(){clearTimeout(idleTimer);clearTimeout(wakeIdleTimer);idleTimer=0;wakeIdleTimer=0;}
  function clearInputNotice(){clearTimeout(inputNoticeTimer);inputNoticeTimer=0;}
  function clearToggleTimers(){clearTimeout(minimizeTimer);clearTimeout(toggleUnlockTimer);minimizeTimer=0;toggleUnlockTimer=0;toggleLock=false;}
  function clearTransportRetry(){clearTimeout(transportRetryTimer);transportRetryTimer=0;}
  function clearTransportVerify(){clearTimeout(transportVerifyTimer);transportVerifyTimer=0;}
  function cancelDeferred(reason){clearSentenceTimers();clearIdle();clearInputNotice();clearToggleTimers();clearTransportRetry();if(reason)log('cancel',reason);}
  function visible(){return !!(ui&&ui.root&&ui.win&&!ui.root.classList.contains('isBotHidden')&&ui.win.classList.contains('isOpen')&&!ui.win.classList.contains('isMinimized'));}
  function busy(){return !!(ui&&ui.input&&ui.input.disabled);}
  function scheduleIdle(reason){
    clearIdle();
    if(!visible()||busy())return;
    idleTimer=setTimeout(function(){idleTimer=0;if(!visible()||busy())return;play('sleep');log('idle','sleep:'+String(reason||''));},IDLE_MS);
  }
  function activity(reason){
    stats.activities++;
    if(!visible())return;
    var s=runtime()&&runtime().getState?runtime().getState():'idle';
    clearIdle();
    if(s==='sleep'){
      play('wake',{returnTo:'idle',duration:720});log('activity','wake:'+String(reason||''));
      wakeIdleTimer=setTimeout(function(){wakeIdleTimer=0;scheduleIdle('after-wake');},760);
    }else scheduleIdle(reason);
  }

  function isSearchMessage(text,history){
    try{
      if(window.ARUKIMIKO_LAZY&&typeof window.ARUKIMIKO_LAZY.groupsForMessage==='function'){
        var groups=window.ARUKIMIKO_LAZY.groupsForMessage(text,history||[]);
        if(Array.isArray(groups)&&groups.indexOf('web')>=0)return true;
      }
    }catch(e){}
    return /調べ|検索|最新|現在|天気|気温|ニュース|為替|カープ.*(?:今|今日)/.test(String(text||''));
  }
  function explicitExpressionState(result,data){
    var allowed={idle:1,input:1,thinking:1,searching:1,reply:1,success:1,warning:1,error:1,cannot:1,sentence:1,minimize:1,sleep:1,wake:1};
    var values=[result&&result.expressionState,result&&result.uiState,result&&result.resultState,data&&data.expressionState,data&&data.uiState,data&&data.resultState];
    for(var i=0;i<values.length;i++){
      var value=String(values[i]||'').toLowerCase();
      if(allowed[value])return value;
    }
    return '';
  }
  function resultState(result){
    var answer=String(result&&((result.answer!=null&&result.answer)||result.message)||'');
    var data=result&&result.data&&typeof result.data==='object'?result.data:{};
    var explicit=explicitExpressionState(result,data);
    if(explicit)return explicit;
    if(data.needsClarification||result&&result.needsClarification||/もう少し|どちら|候補が複数|複数候補|意味を取りきれ|聞き直|確認させ|何について|どれか.*教えて|名前で教えて/.test(answer))return'cannot';
    if(result&&result.ok===false||data.error===true||/エラー|失敗|取得できません|うまく受け取れなかった|読み込.*でき/.test(answer))return'error';
    if(data.warning===true||/注意|気をつけ|対象外|できません|利用できません|確認してください|未対応/.test(answer))return'warning';
    /* Search and knowledge answers are normal replies. Success requires explicit execution evidence. */
    if(data.actionExecuted===true||data.executed===true||data.applied===true||result&&result.actionExecuted===true||/適用しました|設定しました|解除しました|配置しました|除外しました|完了しました/.test(answer))return'success';
    return'reply';
  }

  function setChatTransport(fn){
    if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setTransport==='function'){
      window.JINPO_AI_CHAT.setTransport(fn);
    }else{
      window.JINPO_AI_TRANSPORT=fn;
    }
  }
  function wrapTransport(){
    stats.transportWrapAttempts++;
    var t=window.JINPO_AI_TRANSPORT;
    if(typeof t!=='function')return false;
    if(t===wrappedTransport){transportWrapped=true;return true;}
    if(t.__arukimikoExpressionStage13Z9){
      wrappedTransport=t;originalTransport=t.__arukimikoExpressionOriginal||originalTransport;transportWrapped=true;return true;
    }
    /* Never stack on an older expression wrapper. Recover its original Bot transport first. */
    if(t.__arukimikoExpressionWrapped&&t.__arukimikoExpressionOriginal)t=t.__arukimikoExpressionOriginal;
    originalTransport=t;
    function wrapped(){
      var args=arguments,payload=args[0];
      var text=typeof payload==='string'?payload:String(payload&&payload.message||'');
      var history=payload&&Array.isArray(payload.history)?payload.history:[];
      var context=this,my=++flowToken;
      activeTransportToken=my;
      stats.transportStarts++;pendingResult='reply';pendingResultToken=0;
      clearSentenceTimers();clearIdle();clearInputNotice();
      if(visible())play('thinking');log('transport','start:'+my);
      var search=isSearchMessage(text,history);
      var beforeTransport=Promise.resolve();
      if(search){
        log('transport','search-detected:'+my);
        /* v3.69.0のローカル処理は同期計算が長い場合があるため、計算開始前に一度描画機会を渡す。 */
        beforeTransport=new Promise(function(resolve){
          setTimeout(function(){
            if(activeTransportToken===my&&visible()){play('searching');log('transport','search-visible:'+my);}
            resolve();
          },180);
        });
      }
      return beforeTransport.then(function(){return originalTransport.apply(context,args);}).then(function(result){
        if(my===flowToken){ignoreFocusUntil=Date.now()+1200;pendingResult=resultState(result);pendingResultToken=my;stats.transportResults++;log('transport','result:'+pendingResult+':'+my);}
        return result;
      },function(err){
        if(my===flowToken){pendingResult='error';pendingResultToken=my;if(visible())play('error',{returnTo:'idle',duration:1100});log('transport','error:'+my);}
        throw err;
      });
    }
    wrapped.__arukimikoExpressionWrapped=true;
    wrapped.__arukimikoExpressionStage13Z9=true;
    wrapped.__arukimikoExpressionOriginal=t;
    wrappedTransport=wrapped;
    setChatTransport(wrapped);
    transportWrapped=window.JINPO_AI_TRANSPORT===wrapped;
    log('install','transport-wrapper');return transportWrapped;
  }
  function scheduleTransportRetry(){
    clearTransportRetry();
    if(transportRetryCount>=100)return;
    transportRetryCount++;
    transportRetryTimer=setTimeout(function(){transportRetryTimer=0;if(!wrapTransport())scheduleTransportRetry();},100);
  }
  function startTransportVerification(reason){
    clearTransportVerify();transportVerifyCount=0;
    function verify(){
      transportVerifyTimer=0;transportVerifyCount++;
      if(window.JINPO_AI_TRANSPORT!==wrappedTransport){transportWrapped=false;wrapTransport();}
      if(transportVerifyCount<60)transportVerifyTimer=setTimeout(verify,100);
      else log('transport-verify',String(reason||'')+':complete');
    }
    verify();
  }
  function refreshTransport(reason){
    if(wrapTransport()){
      clearTransportRetry();log('transport-refresh',String(reason||'manual')+':wrapped');return true;
    }
    scheduleTransportRetry();log('transport-refresh',String(reason||'manual')+':waiting');return false;
  }

  function sentenceCount(text){var m=String(text||'').match(/[。！？!?\n]/g);return Math.min(8,m?m.length:0);}
  function isHydratedHistoryRow(row){
    if(hydratedRows&&hydratedRows.has(row))return true;
    if(!activeTransportToken)return true;
    return false;
  }
  function onAssistantRow(row){
    if(!row||row.getAttribute('data-jinpo-ai-typing')==='1')return;
    if(isHydratedHistoryRow(row)){stats.historyRowsIgnored++;log('dom','assistant-ignored-history');return;}
    if(!visible()){stats.ignoredRows++;log('dom','assistant-ignored-not-visible');return;}
    var bubble=row.querySelector('.jinpoAiBubble');
    var text=bubble?String(bubble.textContent||''):'';
    var my=activeTransportToken||flowToken;
    if(!my){stats.historyRowsIgnored++;log('dom','assistant-ignored-no-live-flow');return;}
    if(pendingResultToken&&pendingResultToken!==my){stats.ignoredRows++;log('dom','assistant-ignored-stale');return;}
    ignoreFocusUntil=Date.now()+1200;
    play('reply');log('dom','assistant-display:'+my);
    var count=sentenceCount(text),base=360;
    for(var i=0;i<count;i++)(function(index){sentenceTimers.push(setTimeout(function(){
      if(my!==flowToken||!visible())return;
      play('sentence',{returnTo:'reply',duration:380});log('sentence',String(index+1));
    },base+index*520));})(i);
    var finalDelay=Math.max(700,base+count*520);
    sentenceTimers.push(setTimeout(function(){
      if(my!==flowToken||!visible())return;
      var finalState=(pendingResultToken===my?pendingResult:'reply')||'reply';
      if(finalState==='reply')play('reply',{returnTo:'idle',duration:950});
      else play(finalState,{returnTo:'idle',duration:finalState==='success'?1250:1100});
      log('result-state',finalState);
      activeTransportToken=0;
      sentenceTimers.push(setTimeout(function(){if(my===flowToken)scheduleIdle('answer-end');},finalState==='success'?1320:1180));
    },finalDelay));
  }

  function markExistingRowsAsHydrated(){
    if(!ui||!ui.messages||!hydratedRows)return;
    var rows=ui.messages.querySelectorAll('.jinpoAiMessageRow.assistant');
    Array.prototype.forEach.call(rows,function(row){hydratedRows.add(row);});
    if(rows.length)log('history','marked:'+rows.length);
  }
  function observeMessages(){
    messageObserver=new MutationObserver(function(records){
      records.forEach(function(rec){Array.prototype.forEach.call(rec.addedNodes||[],function(node){
        if(!node||node.nodeType!==1)return;
        var rows=[];
        if(node.matches&&node.matches('.jinpoAiMessageRow'))rows.push(node);
        if(node.querySelectorAll)Array.prototype.push.apply(rows,node.querySelectorAll('.jinpoAiMessageRow'));
        rows.forEach(function(row){
          if(row.getAttribute('data-jinpo-ai-typing')==='1'){if(activeTransportToken&&visible())play('thinking');log('dom','typing');}
          else if(row.classList.contains('assistant'))onAssistantRow(row);
        });
      });});
    });
    messageObserver.observe(ui.messages,{childList:true,subtree:true});
    return messageObserver;
  }

  function requestInputNotice(reason){
    if(!visible())return;
    refreshTransport('input-'+String(reason||''));
    stats.inputNotices++;var my=++flowToken;
    activeTransportToken=0;
    clearSentenceTimers();clearIdle();clearInputNotice();pendingResultToken=0;
    var s=runtime()&&runtime().getState?runtime().getState():'idle';
    if(s==='success'||s==='warning'||s==='error'){
      play('idle');
      inputNoticeTimer=setTimeout(function(){inputNoticeTimer=0;if(my!==flowToken||!visible())return;play('input',{returnTo:'idle',duration:470});scheduleIdle('input');},140);
      log('interrupt','short-return:'+reason);
    }else{
      play('input',{returnTo:'idle',duration:470});scheduleIdle('input');log('interrupt','direct:'+reason);
    }
  }

  function lockToggle(ms){toggleLock=true;clearTimeout(toggleUnlockTimer);toggleUnlockTimer=setTimeout(function(){toggleUnlockTimer=0;toggleLock=false;},Math.max(100,ms||380));}
  function bindUi(){
    ui.input.addEventListener('focus',function(){if(Date.now()<ignoreFocusUntil){log('focus','automatic-return-ignored');return;}requestInputNotice('focus');});
    ui.input.addEventListener('input',function(){
      activity('typing');
      var at=Date.now(),s=runtime()&&runtime().getState?runtime().getState():'idle';
      if(!busy()&&visible()&&at-lastTypingNoticeAt>520&&s!=='thinking'&&s!=='searching'){lastTypingNoticeAt=at;requestInputNotice('typing');}
    });
    ui.send.addEventListener('click',function(){clearIdle();refreshTransport('send-click');log('ui','send-click');},{capture:true});
    ui.input.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!ev.shiftKey){clearIdle();refreshTransport('send-enter');log('ui','send-enter');}},{capture:true});

    ui.min.addEventListener('click',function(ev){
      if(bypassMin)return;
      stats.minimizeRequests++;
      if(toggleLock){ev.preventDefault();ev.stopImmediatePropagation();stats.minimizeDebounced++;log('ui','minimize-debounced');return;}
      var restoring=ui.win.classList.contains('isMinimized');
      if(restoring){lockToggle(380);setTimeout(function(){if(visible()){play('wake',{returnTo:'idle',duration:720});scheduleIdle('restore');}},0);log('ui','restore');return;}
      ev.preventDefault();ev.stopImmediatePropagation();
      ++flowToken;activeTransportToken=0;pendingResultToken=0;clearSentenceTimers();clearIdle();clearInputNotice();lockToggle(520);
      play('minimize');log('ui','minimize-ending');
      minimizeTimer=setTimeout(function(){minimizeTimer=0;if(!ui||ui.root.classList.contains('isBotHidden'))return;bypassMin=true;try{ui.min.click();}finally{bypassMin=false;}},300);
    },true);

    classObserver=new MutationObserver(function(){
      if(ui.root.classList.contains('isBotHidden')){++flowToken;activeTransportToken=0;pendingResultToken=0;cancelDeferred('hidden');if(runtime())runtime().stop();stats.hiddenStops++;log('visibility','hidden-stop');return;}
      if(ui.win.classList.contains('isMinimized')){clearIdle();clearInputNotice();return;}
      if(ui.win.classList.contains('isOpen')&&!toggleLock){play('idle');scheduleIdle('window-open');}
    });
    classObserver.observe(ui.root,{attributes:true,attributeFilter:['class']});
    classObserver.observe(ui.win,{attributes:true,attributeFilter:['class']});
    document.addEventListener('pointerdown',function(ev){if(ui.root.contains(ev.target))activity('pointer');},{passive:true});
    observeMessages();
  }

  function findUi(){
    var root=document.getElementById('jinpoAiRoot'),win=document.getElementById('jinpoAiWindow'),input=document.getElementById('jinpoAiInput'),send=document.getElementById('jinpoAiSend');
    var messages=win&&win.querySelector('.jinpoAiMessages'),min=win&&win.querySelector('.jinpoAiHeaderMinBtn');
    if(!root||!win||!input||!send||!messages||!min)return null;
    return {root:root,win:win,input:input,send:send,messages:messages,min:min};
  }
  function install(){
    if(installed)return true;
    ui=findUi();if(!ui||!runtime()||!runtime().ensure())return false;
    markExistingRowsAsHydrated();
    bindUi();installed=true;refreshTransport('install');
    play('idle');scheduleIdle('install');log('install','ready');return true;
  }
  function notify(type,detail){
    type=String(type||'');detail=detail||{};
    var map={input:'input',thinking:'thinking',searching:'searching',reply:'reply',success:'success',warning:'warning',error:'error',cannot:'cannot',sentence:'sentence',minimize:'minimize',sleep:'sleep',wake:'wake',idle:'idle'};
    if(map[type])return play(map[type],detail);return false;
  }
  function diagnostics(){
    return {version:VERSION,target:TARGET,verifiedAgainstExactTargetZip:true,targetZipSha256:TARGET_ZIP_SHA256,installed:installed,transportWrapped:transportWrapped,state:runtime()&&runtime().getState?runtime().getState():'',idleMs:IDLE_MS,logCount:logs.length,storageAccess:false,ui:!!ui,visible:visible(),busy:busy(),flowToken:flowToken,activeTransportToken:activeTransportToken,pendingResult:pendingResult,pendingResultToken:pendingResultToken,toggleLock:toggleLock,transportRetryCount:transportRetryCount,transportVerifyCount:transportVerifyCount,timers:{idle:!!idleTimer,wakeIdle:!!wakeIdleTimer,inputNotice:!!inputNoticeTimer,minimize:!!minimizeTimer,sentence:sentenceTimers.length,transportRetry:!!transportRetryTimer,transportVerify:!!transportVerifyTimer},observers:{messages:!!messageObserver,classes:!!classObserver},stats:Object.assign({},stats)};
  }
  API={version:VERSION,target:TARGET,install:install,notify:notify,refreshTransport:refreshTransport,diagnostics:diagnostics,getLogs:function(){return logs.slice();},setIdleMs:function(ms){IDLE_MS=Math.max(1000,Number(ms)||8000);scheduleIdle('idle-change');return IDLE_MS;}};
  window.ARUKIMIKO_EXPRESSION_ADAPTER=API;
  window.addEventListener('arukimiko-ready',function(){refreshTransport('arukimiko-ready');startTransportVerification('arukimiko-ready');});
  window.addEventListener('load',function(){setTimeout(function(){refreshTransport('window-load');startTransportVerification('window-load');},0);},{once:true});
  window.addEventListener('arukimiko:transport-ready',function(){refreshTransport('arukimiko-transport-ready');startTransportVerification('transport-ready');});
  var tries=0,t=setInterval(function(){tries++;if(install()||tries>240)clearInterval(t);},50);
})();
