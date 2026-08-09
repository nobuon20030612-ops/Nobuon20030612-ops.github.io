/*
 * たいらの野望 / 歩き巫女 共通フローティングチャット UI v1.0.13-local-only
 * Stage 1: UI / 移動 / リサイズ / 最小化 / 会話履歴 / 将来API接続口。
 * 既存の陣法検索ロジックには触れない。
 */
(function(){
  'use strict';
  if(window.__JINPO_AI_CHAT_UI_INSTALLED__) return;
  window.__JINPO_AI_CHAT_UI_INSTALLED__ = true;

  var STORAGE_KEY = 'jinpoAiChatUi.v1';
  var HISTORY_KEY = 'jinpoAiChatHistory.v1';
  var MAX_HISTORY = 100;
  var root, launcher, restoreBtn, win, header, messages, input, sendBtn, statusEl, minBtn, resetBtn;
  var brainStatus=(window.ARUKIMIKO_SHARED&&window.ARUKIMIKO_SHARED.loading)?'読込中…':'案内・検索OK';
  var pendingHistoryClear = false;
  var restorePositionTimer = 0;
  var dragging = null;
  var busy = false;
  var manualResizeActive = false;
  var lastViewportW = 0;
  var lastViewportH = 0;
  var memoryUi = {};
  var memoryHistory = [];

  function cfg(){
    return {title:'歩き巫女'};
  }

  function safeParse(raw, fallback){
    try{ var v = JSON.parse(raw); return v == null ? fallback : v; }catch(e){ return fallback; }
  }
  function loadUi(){
    try{ return safeParse(localStorage.getItem(STORAGE_KEY), memoryUi); }catch(e){ return Object.assign({}, memoryUi); }
  }
  function saveUi(extra){
    try{
      var old = loadUi();
      var next = Object.assign({}, old, extra || {});
      memoryUi = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }catch(e){ memoryUi = Object.assign({}, memoryUi, extra || {}); }
  }
  function loadHistory(){
    var list;
    try{ list = safeParse(localStorage.getItem(HISTORY_KEY), memoryHistory); }catch(e){ list = memoryHistory.slice(); }
    if(!Array.isArray(list)) return [];
    return list.filter(function(x){ return x && (x.role === 'user' || x.role === 'assistant' || x.role === 'system') && typeof x.text === 'string'; }).slice(-MAX_HISTORY);
  }
  function pruneHistoryMetadata(list,heavyLimit,maxItems){
    var out=(list||[]).slice(-(maxItems||MAX_HISTORY)).map(function(item){
      if(!item||typeof item!=='object')return item;
      var copy=Object.assign({},item);
      if(item.meta&&typeof item.meta==='object'){
        copy.meta=Object.assign({},item.meta);
        if(item.meta.data&&typeof item.meta.data==='object')copy.meta.data=Object.assign({},item.meta.data);
      }
      return copy;
    });
    var heavy=0;
    for(var i=out.length-1;i>=0;i--){
      var x=out[i]||{},meta=x.meta||{},data=meta.data||{};
      if(!data.heroRefinement)continue;
      heavy++;
      if(heavy>(heavyLimit||12)){
        delete data.heroRefinement;
        delete data.heroRefinementChange;
        delete data.previousCandidates;
        delete data.addedCandidates;
        delete data.removedCandidates;
      }
    }
    return out;
  }
  function saveHistory(list){
    // 英傑の候補状態は会話継続に必要だが、全100件へ重複保存すると
    // localStorage上限で履歴保存そのものが止まる。直近12状態だけ完全保持する。
    memoryHistory = pruneHistoryMetadata(list,12,MAX_HISTORY);
    try{
      var raw=JSON.stringify(memoryHistory);
      // 一般的なlocalStorage上限へ近づく前に、古い重い状態をさらに縮める。
      if(raw.length>3500000){
        memoryHistory=pruneHistoryMetadata(memoryHistory,4,70);
        raw=JSON.stringify(memoryHistory);
      }
      localStorage.setItem(HISTORY_KEY,raw);
    }catch(e){
      // 容量超過時も会話履歴を完全に失わず、直近中心へ縮めて一度だけ再試行する。
      memoryHistory=pruneHistoryMetadata(memoryHistory,2,50);
      try{localStorage.setItem(HISTORY_KEY,JSON.stringify(memoryHistory));}catch(_e){}
    }
  }

  function el(tag, cls, attrs){
    var node = document.createElement(tag);
    if(cls) node.className = cls;
    if(attrs) Object.keys(attrs).forEach(function(k){
      if(k === 'text') node.textContent = attrs[k];
      else if(k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    return node;
  }

  function build(){
    root = el('div','', {id:'jinpoAiRoot'});
    root.setAttribute('aria-live','polite');
    root.setAttribute('data-jinpo-page-mode',String(window.JINPO_BOT_PAGE_MODE||'jinpo'));

    launcher = el('button','', {id:'jinpoAiLauncher',type:'button','aria-label':'歩き巫女を開く','aria-expanded':'false'});
    var mascot = el('span','jinpoAiMascot');
    mascot.appendChild(el('i','jinpoAiMascotDot left'));
    mascot.appendChild(el('i','jinpoAiMascotDot right'));
    launcher.appendChild(mascot);
    launcher.appendChild(el('span','jinpoAiLauncherLabel',{text:cfg().title}));

    win = el('section','', {id:'jinpoAiWindow','aria-label':'歩き巫女チャット'});
    header = el('div','jinpoAiHeader');
    header.appendChild(el('span','jinpoAiHeaderMark',{text:'AI'}));
    var htext = el('div','jinpoAiHeaderText');
    htext.appendChild(el('div','jinpoAiTitle',{text:cfg().title}));
    statusEl = el('div','jinpoAiStatus',{text:brainStatus});
    htext.appendChild(statusEl); header.appendChild(htext);

    var trainingBadge = el('div','jinpoAiTrainingBadge',{
      title:'歩き巫女はただいま育成中です'
    });
    trainingBadge.appendChild(el('span','jinpoAiTrainingSpark',{text:'✦'}));
    trainingBadge.appendChild(el('span','jinpoAiTrainingText',{text:'育成中につき\nまだおばかです'}));
    trainingBadge.appendChild(el('span','jinpoAiTrainingSpark',{text:'✦'}));

    var actions = el('div','jinpoAiHeaderActions');
    resetBtn = el('button','jinpoAiHeaderBtn jinpoAiHeaderResetBtn',{
      type:'button',
      'aria-label':'会話をリセット',
      title:'会話の流れだけをリセット',
      text:'会話リセット'
    });
    minBtn = el('button','jinpoAiHeaderBtn jinpoAiHeaderMinBtn',{type:'button','aria-label':'画面最小化',title:'画面最小化',text:'画面最小化'});
    var hideBtn = el('button','jinpoAiHeaderBtn jinpoAiHeaderHideBtn',{type:'button','aria-label':'歩き巫女を非表示',title:'歩き巫女を非表示',text:'非表示'});
    actions.appendChild(resetBtn);
    actions.appendChild(minBtn);
    actions.appendChild(hideBtn);

    header.appendChild(trainingBadge);
    header.appendChild(actions);

    messages = el('div','jinpoAiMessages',{role:'log','aria-label':'会話履歴'});
    var composer = el('div','jinpoAiComposer');
    var row = el('div','jinpoAiComposerRow');
    input = el('textarea','',{id:'jinpoAiInput',rows:'1',placeholder:'メッセージを入力…','aria-label':'歩き巫女へのメッセージ'});
    sendBtn = el('button','',{id:'jinpoAiSend',type:'button',text:'送信'});
    row.appendChild(input); row.appendChild(sendBtn); composer.appendChild(row);
    var note = el('div','jinpoAiComposerNote');
    note.appendChild(el('span','',{text:'Enterで送信 / Shift+Enterで改行'}));
    composer.appendChild(note);

    win.appendChild(header);
    win.appendChild(messages);
    win.appendChild(composer);
    restoreBtn = el('button','',{id:'jinpoAiRestoreTab',type:'button',text:'巫女',title:'歩き巫女を表示（Alt+M）','aria-label':'歩き巫女を表示'});
    restoreBtn.hidden = true;
    root.appendChild(launcher); root.appendChild(win); root.appendChild(restoreBtn); document.body.appendChild(root);

    launcher.addEventListener('click', function(){ if(win.classList.contains('isOpen')) close(); else open(); });
    resetBtn.addEventListener('click', function(ev){ ev.stopPropagation(); resetConversationFromButton(); });
    minBtn.addEventListener('click', function(ev){ ev.stopPropagation(); toggleMinimize(); });
    hideBtn.addEventListener('click', function(ev){ ev.stopPropagation(); hideAll(); });
    restoreBtn.addEventListener('click', function(ev){ ev.stopPropagation(); showLauncher(); open(); });
    document.addEventListener('keydown', function(ev){
      if(ev.altKey && !ev.ctrlKey && !ev.metaKey && String(ev.key||'').toLowerCase()==='m'){
        ev.preventDefault();
        if(root.classList.contains('isBotHidden')){ showLauncher(); open(); }
        else hideAll();
      }
    });
    sendBtn.addEventListener('click', submit);
    input.addEventListener('keydown', function(ev){
      if(ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); submit(); }
    });
    input.addEventListener('input', autoGrow);
    bindDrag(); bindResizeSave(); restore(); renderHistory();
  }

  function syncMinimizeButton(){
    if(!minBtn || !win) return;
    var minimized = win.classList.contains('isMinimized');
    var label = minimized ? '会話' : '画面最小化';
    minBtn.textContent = label;
    minBtn.setAttribute('aria-label', label);
    minBtn.title = label;
  }

  function restore(){
    var s = loadUi();

    /*
     * v1.0.10:
     * サイトを新しく開いた時の表示状態は、過去の open / hidden / minimized
     * 保存値を復元しない。位置・サイズなどの設定だけは従来どおり利用し、
     * チャット欄は必ず「表示中かつ最小化」で開始する。
     */
    root.classList.remove('isBotHidden');
    if(restoreBtn) restoreBtn.hidden=true;

    if(!window.matchMedia('(max-width:760px)').matches){
      if(s.userMoved){
        if(Number.isFinite(s.left)) win.style.left = s.left + 'px';
        if(Number.isFinite(s.top)) win.style.top = s.top + 'px';
        if(Number.isFinite(s.left) || Number.isFinite(s.top)){ win.style.right='auto'; win.style.bottom='auto'; }
      }
      applyResponsiveWindowSize(s);
      applyResponsiveWindowPosition(s);
      if(s.userMoved&&(Number.isFinite(s.left)||Number.isFinite(s.top))) keepInViewport();
    }

    win.classList.add('isMinimized');
    syncMinimizeButton();
    open(false);
    saveUi({open:true,hidden:false,minimized:true});
  }

  function clamp(v,min,max){ return Math.min(max,Math.max(min,Number(v)||0)); }
  function open(focus){
    showLauncher(false);
    syncMinimizeButton();
    win.classList.add('isOpen'); launcher.setAttribute('aria-expanded','true'); saveUi({open:true,hidden:false});
    syncResponsiveWindowClasses();
    keepInViewport();
    if(focus !== false) setTimeout(function(){ if(!win.classList.contains('isMinimized')) input.focus(); },0);
  }
  function close(){ win.classList.remove('isOpen'); launcher.setAttribute('aria-expanded','false'); saveUi({open:false}); }
  function hideAll(){
    // 旧UI側の補助情報を閉じる関数が存在する場合だけ呼ぶ。
    // v3.23.0では関数本体が無いため、無条件呼出しするとここで例外停止し、
    // 非表示処理そのものが実行されない。
    try{if(typeof window.hideAiInfo==='function')window.hideAiInfo();}catch(e){}
    win.classList.remove('isOpen');
    launcher.setAttribute('aria-expanded','false');
    win.classList.remove('isMinimized');
    syncMinimizeButton();
    root.classList.add('isBotHidden');
    if(restoreBtn)restoreBtn.hidden=false;
    scheduleRestorePosition();
    saveUi({open:false,hidden:true,minimized:false});
  }
  function showLauncher(save){
    root.classList.remove('isBotHidden');
    if(restoreBtn)restoreBtn.hidden=true;
    if(save!==false)saveUi({hidden:false});
  }
  function isInteractiveElement(node){
    if(!node||node===restoreBtn||!node.matches)return false;
    return node.matches('a[href],button,input,select,textarea,summary,[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[tabindex]:not([tabindex="-1"]),[onclick]');
  }
  function rectOverlap(a,b){
    var x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
    var y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    return x*y;
  }
  function candidateScore(c,w,h){
    var rect={left:c.left,top:c.top,right:c.left+w,bottom:c.top+h};
    var score=0;
    var nodes=[];
    try{nodes=document.querySelectorAll('a[href],button,input,select,textarea,summary,[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[tabindex]:not([tabindex="-1"]),[onclick]');}catch(e){}
    for(var i=0;i<nodes.length;i++){
      var n=nodes[i];
      if(n===restoreBtn||n.closest&&n.closest('#jinpoAiRoot'))continue;
      var cs=null;try{cs=getComputedStyle(n);}catch(e){}
      if(cs&&(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0))continue;
      var r=n.getBoundingClientRect();
      if(r.width<2||r.height<2||r.bottom<0||r.right<0||r.top>innerHeight||r.left>innerWidth)continue;
      var area=rectOverlap(rect,r);
      if(area>0)score+=area+5000;
    }
    return score;
  }
  function positionRestoreTab(){
    if(!restoreBtn||restoreBtn.hidden||!root.classList.contains('isBotHidden'))return;
    var br=restoreBtn.getBoundingClientRect(),w=Math.max(28,Math.round(br.width||44)),h=Math.max(32,Math.round(br.height||36)),gap=2;
    var vh=Math.max(240,innerHeight||document.documentElement.clientHeight||720);
    var vw=Math.max(320,innerWidth||document.documentElement.clientWidth||1280);
    var ys=[.10,.22,.34,.46,.58,.70,.82,.92].map(function(v){return Math.round(vh*v-h/2);});
    var candidates=[];
    ys.forEach(function(y){
      y=clamp(y,6,Math.max(6,vh-h-6));
      candidates.push({left:vw-w-gap,top:y,side:'right'});
      candidates.push({left:gap,top:y,side:'left'});
    });
    var best=candidates[0],bestScore=Infinity;
    candidates.forEach(function(c){var sc=candidateScore(c,w,h);if(sc<bestScore){best=c;bestScore=sc;}});
    restoreBtn.style.left=Math.round(best.left)+'px';
    restoreBtn.style.top=Math.round(best.top)+'px';
    restoreBtn.style.right='auto';restoreBtn.style.bottom='auto';
    restoreBtn.setAttribute('data-edge',best.side);
    // PCで左右どこにも安全な空きがない時は、サイト操作を塞がないことを最優先。
    // 復帰は Alt+M。空きが見つかれば通常どおりクリックできる細いタブを表示する。
    if(bestScore>0 && !window.matchMedia('(max-width:760px)').matches){
      restoreBtn.style.opacity='0';
      restoreBtn.style.pointerEvents='none';
      restoreBtn.setAttribute('data-keyboard-only','1');
    }else{
      restoreBtn.style.opacity='';
      restoreBtn.style.pointerEvents='auto';
      restoreBtn.removeAttribute('data-keyboard-only');
    }
  }
  function scheduleRestorePosition(){
    clearTimeout(restorePositionTimer);
    restorePositionTimer=setTimeout(positionRestoreTab,40);
  }

  function toggleMinimize(){
    var on = win.classList.toggle('isMinimized');
    syncMinimizeButton();
    saveUi({minimized:on});
    if(!on){
      syncResponsiveWindowClasses();
      keepInViewport();
      setTimeout(function(){ syncResponsiveWindowClasses(); input.focus(); },0);
    }
  }

  function viewportMetrics(){
    var de=document.documentElement||{};
    var iw=Number(window.innerWidth)||Number(de.clientWidth)||1280;
    var ih=Number(window.innerHeight)||Number(de.clientHeight)||720;
    var vv=window.visualViewport;
    var vw=iw,vh=ih;
    /* ブラウザの可視領域を優先。ズーム/ブラウザUI変化でも見切れないようにする。 */
    if(vv){
      var vvw=Number(vv.width),vvh=Number(vv.height);
      if(Number.isFinite(vvw)&&vvw>0)vw=Math.min(vw,vvw);
      if(Number.isFinite(vvh)&&vvh>0)vh=Math.min(vh,vvh);
    }
    return {vw:Math.max(320,Math.floor(vw)),vh:Math.max(240,Math.floor(vh))};
  }

  function responsiveDefaultTop(vw,vh,external){
    if(!external) return 12;
    var medium=vw<=980;
    /* 枠上キャラを残しつつ、チャット本文へ高さを多く割り当てる。 */
    return medium
      ? clamp(Math.round(vh*.18),132,185)
      : clamp(Math.round(vh*.20),150,220);
  }

  function responsiveSizeLimits(){
    var vp=viewportMetrics(),vw=vp.vw,vh=vp.vh;
    var external=!!(win&&win.classList&&win.classList.contains('hasJinpoExternalCharacter'));
    var medium=vw<=980&&vw>760;
    var sideGap=medium?20:24;
    var bottomGap=10;
    var topReserve=responsiveDefaultTop(vw,vh,external);
    var maxW=Math.max(310,vw-sideGap);
    var maxH=Math.max(260,vh-(external?topReserve+bottomGap:sideGap));
    var minW=Math.min(medium?440:560,maxW);
    var minH=Math.min(external?(medium?300:340):(medium?400:480),maxH);
    return {vw:vw,vh:vh,medium:medium,external:external,topReserve:topReserve,bottomGap:bottomGap,maxW:maxW,maxH:maxH,minW:minW,minH:minH};
  }

  function syncResponsiveWindowClasses(){
    if(!win)return;
    var r=win.getBoundingClientRect();
    var w=Number(r.width)||0,h=Number(r.height)||0;
    /* viewport幅ではなくBot窓そのものの幅でヘッダー密度を変える。 */
    win.classList.toggle('jinpoHeaderCompact',w>0&&w<780);
    win.classList.toggle('jinpoHeaderTight',w>0&&w<620);
    win.classList.toggle('jinpoHeightTight',h>0&&h<560);
  }

  function applyResponsiveWindowSize(state){
    if(!win || window.matchMedia('(max-width:760px)').matches || win.classList.contains('isMinimized')) return;
    var s=state||loadUi();
    var lim=responsiveSizeLimits();
    var w,h;
    /* 自動計算で保存された比率ではなく、本当に手動リサイズした時だけ比率を再利用する。 */
    if(s&&s.userResized&&Number.isFinite(s.widthRatio)&&Number.isFinite(s.heightRatio)){
      w=lim.vw*s.widthRatio;
      h=lim.vh*s.heightRatio;
    }else{
      /* 画面がやや狭いPCでは横幅を少し広めに確保し、ヘッダー/本文の見切れを防ぐ。 */
      var autoWidthRatio=lim.medium?.60:(lim.vw<1500?.50:.42);
      w=lim.vw*autoWidthRatio;
      h=lim.vh*.72;
    }
    win.style.width=clamp(w,lim.minW,lim.maxW)+'px';
    win.style.height=clamp(h,lim.minH,lim.maxH)+'px';
    lastViewportW=lim.vw; lastViewportH=lim.vh;
    syncResponsiveWindowClasses();
  }

  function applyResponsiveWindowPosition(state){
    if(!win || window.matchMedia('(max-width:760px)').matches || win.classList.contains('isMinimized')) return;
    var s=state||loadUi();
    if(s&&s.userMoved) return;
    if(!win.classList.contains('hasJinpoExternalCharacter')) return;
    var lim=responsiveSizeLimits();
    win.style.left='auto';
    win.style.right=(lim.medium?'16px':'24px');
    win.style.top=lim.topReserve+'px';
    win.style.bottom='auto';
  }

  function expandedWindowMinTop(){
    if(!win||window.matchMedia('(max-width:760px)').matches||win.classList.contains('isMinimized'))return 8;
    // 枠上キャラクターの最小表示幅(約250px)を、枠上辺との接点を保ったまま収める余白。
    return win.classList.contains('hasJinpoExternalCharacter')?126:8;
  }

  function keepInViewport(){
    if(!win || !win.classList.contains('isOpen') || window.matchMedia('(max-width:760px)').matches) return;
    var vp=viewportMetrics();
    var minTop=expandedWindowMinTop();
    var r=win.getBoundingClientRect();

    /* 先に寸法を可視領域へ収める。位置だけclampすると下端/右端が切れるため。 */
    var maxWidth=Math.max(310,vp.vw-16);
    var maxHeight=Math.max(260,vp.vh-minTop-8);
    if(r.width>maxWidth+1){win.style.width=Math.floor(maxWidth)+'px';}
    if(r.height>maxHeight+1){win.style.height=Math.floor(maxHeight)+'px';}
    r=win.getBoundingClientRect();

    var left=clamp(r.left,8,Math.max(8,vp.vw-r.width-8));
    var maxTop=Math.max(minTop,vp.vh-r.height-8);
    var top=clamp(r.top,minTop,maxTop);
    win.style.left=left+'px';win.style.top=top+'px';win.style.right='auto';win.style.bottom='auto';
    syncResponsiveWindowClasses();
  }

  function bindDrag(){
    header.addEventListener('pointerdown', function(ev){
      if(window.matchMedia('(max-width:760px)').matches) return;
      if(ev.target && ev.target.closest && ev.target.closest('button')) return;
      var r = win.getBoundingClientRect();
      dragging = {id:ev.pointerId, dx:ev.clientX-r.left, dy:ev.clientY-r.top};
      header.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    header.addEventListener('pointermove', function(ev){
      if(!dragging || dragging.id !== ev.pointerId) return;
      var r = win.getBoundingClientRect();
      var vp=viewportMetrics();
      var left = clamp(ev.clientX-dragging.dx,8,Math.max(8,vp.vw-r.width-8));
      var minTop=expandedWindowMinTop();
      var top = clamp(ev.clientY-dragging.dy,minTop,Math.max(minTop,vp.vh-r.height-8));
      win.style.left=left+'px'; win.style.top=top+'px'; win.style.right='auto'; win.style.bottom='auto';
    });
    function end(ev){
      if(!dragging || dragging.id !== ev.pointerId) return;
      dragging=null; var r=win.getBoundingClientRect(); saveUi({left:Math.round(r.left),top:Math.round(r.top),userMoved:true});
    }
    header.addEventListener('pointerup',end); header.addEventListener('pointercancel',end);
  }

  function bindResizeSave(){
    var timer=0, lastW=0, lastH=0;
    var initialVp=viewportMetrics();
    lastViewportW=initialVp.vw;
    lastViewportH=initialVp.vh;

    win.addEventListener('pointerdown',function(ev){
      if(window.matchMedia('(max-width:980px)').matches||win.classList.contains('isMinimized')) return;
      var r=win.getBoundingClientRect();
      manualResizeActive=(r.right-ev.clientX<=28 && r.bottom-ev.clientY<=28);
    });
    window.addEventListener('pointerup',function(){
      if(!manualResizeActive||!win||win.classList.contains('isMinimized')){ manualResizeActive=false; return; }
      manualResizeActive=false;
      var b=win.getBoundingClientRect();
      var vp=viewportMetrics(),vw=vp.vw,vh=vp.vh;
      saveUi({userResized:true,width:Math.round(b.width),height:Math.round(b.height),widthRatio:b.width/vw,heightRatio:b.height/vh,viewportWidth:vw,viewportHeight:vh,left:Math.round(b.left),top:Math.round(b.top)});
    });

    if(typeof ResizeObserver !== 'undefined'){
      new ResizeObserver(function(entries){
        if(window.matchMedia('(max-width:760px)').matches || win.classList.contains('isMinimized')) return;
        var r=entries[0] && entries[0].contentRect; if(!r) return;
        if(Math.abs(r.width-lastW)<1 && Math.abs(r.height-lastH)<1) return; lastW=r.width; lastH=r.height;
        clearTimeout(timer); timer=setTimeout(function(){
          var b=win.getBoundingClientRect();
          var vp=viewportMetrics(),vw=vp.vw,vh=vp.vh;
          var extra={
            width:Math.round(b.width),height:Math.round(b.height),left:Math.round(b.left),top:Math.round(b.top),
            viewportWidth:vw,viewportHeight:vh
          };
          /* 自動レスポンシブで縮んだ寸法を、手動リサイズ比率へ上書きしない。 */
          if(manualResizeActive){
            extra.userResized=true;
            extra.widthRatio=b.width/vw;
            extra.heightRatio=b.height/vh;
          }
          saveUi(extra);keepInViewport();
        },180);
      }).observe(win);
    }
    function handleViewportResize(){
      if(!window.matchMedia('(max-width:760px)').matches && win && !win.classList.contains('isMinimized')){
        applyResponsiveWindowSize();
        applyResponsiveWindowPosition();
      }
      keepInViewport();scheduleRestorePosition();syncResponsiveWindowClasses();
      var vp=viewportMetrics();lastViewportW=vp.vw;lastViewportH=vp.vh;
    }
    window.addEventListener('resize',handleViewportResize);
    if(window.visualViewport&&window.visualViewport.addEventListener){
      window.visualViewport.addEventListener('resize',handleViewportResize,{passive:true});
    }
    window.addEventListener('scroll', function(){ if(root&&root.classList.contains('isBotHidden'))scheduleRestorePosition(); },{passive:true});
  }

  function autoGrow(){
    input.style.height='auto'; input.style.height=Math.min(126,Math.max(42,input.scrollHeight))+'px';
  }

  function currentHistory(){ return loadHistory(); }
  function pushHistory(role,text,meta){
    var h=currentHistory(); h.push({role:role,text:String(text||''),meta:meta||null,at:Date.now()}); saveHistory(h); return h;
  }
  function renderHistory(){
    messages.textContent=''; var h=currentHistory();
    if(!h.length){
      addBubble('assistant',window.JINPO_BOT_PAGE_MODE==='top'?'こんにちは。歩き巫女なのですよ。\nここではサイト案内、たいらの野望の情報、カープ、天気、調べもの、雑談などをそのまま話しかけてくださいね。':(window.JINPO_BOT_PAGE_MODE==='site'?'こんにちは。歩き巫女なのですよ。\nこのページの案内・調べもの・雑談まで、気軽に話しかけてくださいね。':'こんにちは。歩き巫女なのですよ。\nクリックでも手入力でも、陣法探しを一緒に進められるのですよ。'),{ephemeral:true});
      return;
    }
    h.forEach(function(m){ addBubble(m.role,m.text,Object.assign({},m.meta||{},{ephemeral:true})); });
    scrollBottom();
  }

  function botMessageCharacterUrl(){
    var base=String(window.JINPO_BOT_BASE_URL||'');
    if(base && base.charAt(base.length-1)!=='/') base += '/';
    return base + 'assets/arukimiko-message.png';
  }

  function addBubble(role,text,meta){
    role = role === 'user' ? 'user' : role === 'system' ? 'system' : 'assistant';
    var row=el('div','jinpoAiMessageRow '+role); var bubble=el('div','jinpoAiBubble');
    if(role==='assistant'){
      var character=el('img','jinpoAiMessageCharacter',{src:botMessageCharacterUrl(),alt:'','aria-hidden':'true'});
      character.decoding='async';
      character.draggable=false;
      row.appendChild(character);
    }
    bubble.textContent=String(text||'');
    if(meta && Array.isArray(meta.sources) && meta.sources.length){
      var list=el('div','jinpoAiSourceList');
      meta.sources.slice(0,8).forEach(function(src){
        if(!src) return; var url=String(src.url||'').trim(); var title=String(src.title||url||'参照元').trim();
        if(!/^https:\/\//i.test(url)) return;
        var a=el('a','jinpoAiSourceLink',{href:url,target:'_blank',rel:'noopener noreferrer',text:title}); list.appendChild(a);
      });
      if(list.childNodes.length) bubble.appendChild(list);
    }
    if(meta && Array.isArray(meta.links) && meta.links.length){
      var nav=el('div','jinpoAiActionLinks');
      meta.links.slice(0,8).forEach(function(item){
        if(!item) return; var raw=String(item.url||'').trim(); var label=String(item.label||'ページを開く').trim();
        if(!raw) return;
        var href=''; try{ href=new URL(raw,location.href).href; }catch(e){ return; }
        if(!/^https:\/\//i.test(href)) return;
        var external=(new URL(href)).origin!==location.origin;
        var a=el('a','jinpoAiActionLink',{href:href,text:label});
        if(external){a.target='_blank';a.rel='noopener noreferrer';}
        nav.appendChild(a);
      });
      if(nav.childNodes.length) bubble.appendChild(nav);
    }
    if(meta&&meta.silentGuide) row.setAttribute('data-jinpo-guide-silent','1');
    row.appendChild(bubble); messages.appendChild(row); scrollBottom();
    if(!(meta&&meta.ephemeral)) pushHistory(role,text,meta);
    return row;
  }

  function addTyping(){
    var row=el('div','jinpoAiMessageRow assistant'); row.setAttribute('data-jinpo-ai-typing','1');
    var b=el('div','jinpoAiBubble'); var t=el('span','jinpoAiTyping'); t.innerHTML='<i></i><i></i><i></i>'; b.appendChild(t); row.appendChild(b); messages.appendChild(row); scrollBottom(); return row;
  }
  function scrollBottom(){ requestAnimationFrame(function(){ messages.scrollTop=messages.scrollHeight; }); }

  // サイト案内で移動先が一意に決まった場合も、勝手には移動しない。
  // 会話内リンクは常に残し、実際の移動は既存の「はい／いいえ」確認モーダルでユーザーが選ぶ。
  function guideNavigationTarget(result){
    var data=result&&result.data&&typeof result.data==='object'?result.data:null;
    if(!data||data.siteOpen!==true)return null;
    var links=Array.isArray(result.links)?result.links:[];if(links.length!==1)return null;
    try{
      var raw=String(links[0]&&links[0].url||'').trim();if(!raw)return null;
      var url=new URL(raw,location.href);if(!/^https?:$/i.test(url.protocol))return null;
      var label=String(links[0]&&links[0].label||'ページ').trim()||'ページ';
      var external=url.origin!==location.origin;
      var message='';
      if(data.siteInternal==='stone'&&data.stoneName){
        message='星海の荒石の「'+String(data.stoneName)+'」合成早見表へ移動しますか？';
      }else{
        var name=label.replace(/(?:を別タブで開く|を開く|ページを開く|開く)$/,'').trim()||label;
        message=external?'「'+name+'」を別タブで開きますか？':'「'+name+'」へ移動しますか？';
      }
      return {href:url.href,external:external,message:message};
    }catch(e){return null;}
  }
  function ensureGuideNavigationConfirmFallback(){
    var back=document.getElementById('arukimikoSiteNavConfirmBackdrop');if(back)return back;
    if(!document.getElementById('arukimiko-site-nav-confirm-style')){
      var st=document.createElement('style');st.id='arukimiko-site-nav-confirm-style';
      st.textContent='#arukimikoSiteNavConfirmBackdrop{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;background:rgba(0,0,0,.76);backdrop-filter:blur(2px)}#arukimikoSiteNavConfirmBackdrop.isOpen{display:flex}.arukimikoSiteNavConfirmBox{width:min(620px,94vw);overflow:hidden;border:2px solid #e7bd5c;border-radius:18px;background:linear-gradient(180deg,#2b170d,#100b07 82%);box-shadow:0 24px 80px rgba(0,0,0,.72),0 0 30px rgba(231,189,92,.28)}.arukimikoSiteNavConfirmHead{padding:17px 20px;border-bottom:1px solid rgba(231,189,92,.42);background:linear-gradient(90deg,rgba(122,33,24,.92),rgba(42,22,9,.96));color:#ffe8a6;font-size:25px;font-weight:1000;text-align:center;letter-spacing:.03em}.arukimikoSiteNavConfirmMessage{padding:26px 24px 20px;color:#fff3d1;font-size:20px;font-weight:800;line-height:1.65;text-align:center;white-space:pre-line}.arukimikoSiteNavConfirmActions{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 22px 22px}.arukimikoSiteNavConfirmBtn{min-height:58px;border:2px solid #e7bd5c!important;border-radius:12px!important;font-size:21px!important;font-weight:1000!important;letter-spacing:.05em!important;cursor:pointer!important}.arukimikoSiteNavConfirmNo{background:linear-gradient(#3b3328,#17120d)!important;color:#f7e8c1!important}.arukimikoSiteNavConfirmYes{background:linear-gradient(#a83224,#63150f)!important;color:#fff4d5!important;box-shadow:0 0 16px rgba(255,67,43,.34)!important}.arukimikoSiteNavConfirmBtn:hover,.arukimikoSiteNavConfirmBtn:focus-visible{filter:brightness(1.18)!important;box-shadow:0 0 20px rgba(231,189,92,.54)!important;outline:none!important}@media(max-width:760px){.arukimikoSiteNavConfirmHead{font-size:21px}.arukimikoSiteNavConfirmMessage{font-size:17px;padding:20px 16px}.arukimikoSiteNavConfirmActions{gap:10px;padding:0 14px 16px}.arukimikoSiteNavConfirmBtn{min-height:54px;font-size:18px!important}}';
      (document.head||document.documentElement).appendChild(st);
    }
    back=document.createElement('div');back.id='arukimikoSiteNavConfirmBackdrop';
    back.innerHTML='<div class="arukimikoSiteNavConfirmBox" role="dialog" aria-modal="true" aria-labelledby="arukimikoSiteNavConfirmTitle" aria-describedby="arukimikoSiteNavConfirmMessage"><div id="arukimikoSiteNavConfirmTitle" class="arukimikoSiteNavConfirmHead">ページ移動の確認</div><div id="arukimikoSiteNavConfirmMessage" class="arukimikoSiteNavConfirmMessage"></div><div class="arukimikoSiteNavConfirmActions"><button type="button" class="arukimikoSiteNavConfirmBtn arukimikoSiteNavConfirmNo">いいえ</button><button type="button" class="arukimikoSiteNavConfirmBtn arukimikoSiteNavConfirmYes">はい</button></div></div>';
    document.body.appendChild(back);return back;
  }
  function askGuideNavigationYesNo(message){
    if(typeof window.__jinpoAskYesNo==='function'){
      try{return Promise.resolve(window.__jinpoAskYesNo({title:'ページ移動の確認',message:String(message||'ページへ移動しますか？')})).then(function(ok){return !!ok;});}catch(e){}
    }
    var back=ensureGuideNavigationConfirmFallback(),msg=back.querySelector('#arukimikoSiteNavConfirmMessage');if(msg)msg.textContent=String(message||'ページへ移動しますか？');
    back.classList.add('isOpen');var last=document.activeElement;
    return new Promise(function(resolve){
      var no=back.querySelector('.arukimikoSiteNavConfirmNo'),yes=back.querySelector('.arukimikoSiteNavConfirmYes'),done=false;
      function finish(ok){if(done)return;done=true;back.classList.remove('isOpen');no.removeEventListener('click',onNo);yes.removeEventListener('click',onYes);back.removeEventListener('click',onBack);document.removeEventListener('keydown',onKey);try{if(last&&typeof last.focus==='function')last.focus();}catch(e){}resolve(!!ok);}
      function onNo(){finish(false);}function onYes(){finish(true);}function onBack(ev){if(ev.target===back)finish(false);}function onKey(ev){if(ev.key==='Escape'){ev.preventDefault();finish(false);}}
      no.addEventListener('click',onNo);yes.addEventListener('click',onYes);back.addEventListener('click',onBack);document.addEventListener('keydown',onKey);setTimeout(function(){try{no.focus();}catch(e){}},0);
    });
  }
  function scheduleGuideNavigationConfirmation(result){
    var target=guideNavigationTarget(result);if(!target)return false;
    setTimeout(function(){
      askGuideNavigationYesNo(target.message).then(function(ok){
        if(!ok)return;
        try{
          if(target.external){var w=window.open(target.href,'_blank','noopener,noreferrer');if(w)try{w.opener=null;}catch(e){}}
          else if(window.location&&typeof window.location.assign==='function')window.location.assign(target.href);
          else window.location.href=target.href;
        }catch(e){if(!target.external)try{window.location.href=target.href;}catch(ignore){}}
      });
    },80);
    return true;
  }

  function setBusy(v){
    busy=!!v;
    sendBtn.disabled=busy;
    input.disabled=busy;
    statusEl.textContent=busy?'考えています…':brainStatus;
  }

  function setBrainStatus(status,detail){
    brainStatus=String(status||'案内・検索OK');
    var mode=String(detail||'').trim();
    if(statusEl&&!busy)statusEl.textContent=brainStatus;
    try{
      root.setAttribute('data-bot-status',brainStatus);
      if(mode)root.setAttribute('data-bot-detail',mode.slice(0,180));
    }catch(e){}
  }

  function isHistoryClearRequest(text){
    return /^(?:会話|チャット|ちゃっと)?(?:履歴|ログ)(?:を)?(?:削除|消して|消す|クリア|リセット)(?:して)?[。！!？?]*$|^(?:会話|チャット|ちゃっと)(?:を)?リセット(?:して)?[。！!？?]*$/i.test(String(text||'').trim());
  }
  function isHistoryClearConfirm(text){
    return /^(?:削除する|消す|消して|はい削除|はい消す|履歴削除する|会話履歴削除する)[。！!？?]*$/i.test(String(text||'').trim());
  }
  function isCancel(text){return /^(?:やめる|キャンセル|取消|取り消し|いいえ|しない)[。！!？?]*$/i.test(String(text||'').trim());}
  function clearHistoryStorage(){
    memoryHistory=[];
    try{localStorage.removeItem(HISTORY_KEY);}catch(e){}
    try{
      if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.resetContext==='function'){
        window.JINPO_BOT_CONVERSATION.resetContext();
      }
    }catch(e){}
  }

  function resetConversationFromButton(){
    if(busy)return;

    pendingHistoryClear=false;

    var result={ok:true};
    try{
      if(window.JINPO_BOT_RESET_CONVERSATION&&typeof window.JINPO_BOT_RESET_CONVERSATION==='function'){
        result=window.JINPO_BOT_RESET_CONVERSATION({source:'button'})||result;
      }else{
        if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.resetContext==='function'){
          window.JINPO_BOT_CONVERSATION.resetContext();
        }
        if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.clearPending==='function'){
          window.JINPO_BOT_DIALOG.clearPending();
        }
        if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.clear==='function'){
          window.JINPO_BOT_KASHIN_NAME.clear();
        }
        if(window.JINPO_BOT_GUIDE&&typeof window.JINPO_BOT_GUIDE.resetFlow==='function'){
          window.JINPO_BOT_GUIDE.resetFlow();
        }
      }
    }catch(e){
      result={ok:false,error:String(e&&e.message||e)};
    }

    // Visible log is intentionally preserved. Only the context from here onward is fresh.
    addBubble(
      'system',
      result&&result.ok===false
        ? '会話のリセット中に一部エラーがありました。もう一度押すか「話題リセット」と送ってください。'
        : '── 会話をリセットしました。ここから新しい話です。 ──'
    );

    try{input.focus();}catch(e){}
  }

  async function submit(){
    if(busy) return; var text=String(input.value||'').trim(); if(!text) return;
    input.value=''; autoGrow();
    if(pendingHistoryClear){
      if(isHistoryClearConfirm(text)){
        pendingHistoryClear=false;
        clearHistoryStorage();
        renderHistory();
        addBubble('assistant','この端末の会話履歴を削除しました。たいらの野望の案内情報やFirebaseの共有内容は消していないのですよ。',{ephemeral:true});
        input.focus();return;
      }
      if(isCancel(text)){
        pendingHistoryClear=false;
        addBubble('user',text);
        addBubble('assistant','履歴削除はやめたのですよ。今までの会話はそのまま残しています。');
        input.focus();return;
      }
      pendingHistoryClear=false;
    }
    if(isHistoryClearRequest(text)){
      addBubble('user',text);
      pendingHistoryClear=true;
      addBubble('assistant','この端末に保存されている会話履歴を削除しますか？\n削除する場合は「削除する」、やめる場合は「やめる」と送ってください。\n他の利用者の履歴や、たいらの野望の案内情報は対象外なのですよ。');
      input.focus();return;
    }
    addBubble('user',text); setBusy(true); var typing=addTyping();
    try{
      var result=await requestAi(text,currentHistory()); if(typing&&typing.parentNode)typing.remove();
      var historyData=null;
      if(result.data&&result.data.conversationRepair){
        historyData={
          conversationRepair:true,
          contextBoundary:result.data.contextBoundary!==false,
          pendingRepair:!!result.data.pendingRepair,
          rejectedRoute:String(result.data.rejectedRoute||''),
          repairTargetDomain:String(result.data.repairTargetDomain||''),
          preservedQuery:String(result.data.preservedQuery||''),
          subjectHint:String(result.data.subjectHint||''),
          topicSwitch:!!result.data.topicSwitch,
          lastMode:String(result.data.lastMode||'')
        };
      }else if(result.data&&result.data.knownTermClarification){
        // 配置・除外の安全確認へユーザーが答えた次の1ターンだけ、
        // 聞き直しの種類と対象英傑を保持する。回答全文や検索状態は保存しない。
        historyData={
          knownTermClarification:true,
          clarificationReason:String(result.data.clarificationReason||result.data.reason||''),
          siteItem:String(result.data.siteItem||'jinpo'),
          termKey:String(result.data.termKey||'placement'),
          normalizedTerm:String(result.data.normalizedTerm||''),
          pendingHero:String(result.data.pendingHero||'')
        };
      }else if(result.data&&result.data.siteGuide){
        historyData={
          siteGuide:true,
          siteItem:String(result.data.siteItem||''),
          siteFeature:String(result.data.siteFeature||''),
          siteFeatureSubjects:Array.isArray(result.data.siteFeatureSubjects)?result.data.siteFeatureSubjects.slice(0,8):[],
          siteItems:Array.isArray(result.data.siteItems)?result.data.siteItems.slice(0,8):[],
          siteComparison:Array.isArray(result.data.siteComparison)?result.data.siteComparison.slice(0,8):[],
          candidates:Array.isArray(result.data.candidates)?result.data.candidates.slice(0,8):[],
          siteCandidates:Array.isArray(result.data.siteCandidates)?result.data.siteCandidates.slice(0,8):[],
          siteSourceCandidates:Array.isArray(result.data.siteSourceCandidates)?result.data.siteSourceCandidates.slice(0,8):[],
          siteOpenedItems:Array.isArray(result.data.siteOpenedItems)?result.data.siteOpenedItems.slice(0,8):[],
          siteExcludedItems:Array.isArray(result.data.siteExcludedItems)?result.data.siteExcludedItems.slice(0,8):[],
          siteConditions:Array.isArray(result.data.siteConditions)?result.data.siteConditions.slice(0,12):[],
          selectedSiteItem:String(result.data.selectedSiteItem||''),
          previousSelectedSiteItem:String(result.data.previousSelectedSiteItem||''),
          siteLinkMissRecovery:!!result.data.siteLinkMissRecovery,
          siteLinkMissNeedsSelection:!!result.data.siteLinkMissNeedsSelection,
          siteLinkMissRejectedItem:String(result.data.siteLinkMissRejectedItem||''),
          siteLinkMissSelectionResolved:!!result.data.siteLinkMissSelectionResolved,
          siteLinkMissRecoveryContinuation:!!result.data.siteLinkMissRecoveryContinuation,
          siteGuidePauseTurns:Number(result.data.siteGuidePauseTurns||0),
          siteGuideReturnWithGoal:!!result.data.siteGuideReturnWithGoal,
          siteGuideReturnTarget:String(result.data.siteGuideReturnTarget||''),
          siteInlineGoalRevision:!!result.data.siteInlineGoalRevision,
          siteConditionalOpen:!!result.data.siteConditionalOpen,
          siteConditionRemoved:!!result.data.siteConditionRemoved,
          knownTermGuidance:!!result.data.knownTermGuidance,
          termKey:String(result.data.termKey||''),
          normalizedTerm:String(result.data.normalizedTerm||''),
          approximateTerm:!!result.data.approximateTerm,
          siteVagueCapability:String(result.data.siteVagueCapability||''),
          siteVagueCapabilityClarification:!!result.data.siteVagueCapabilityClarification,
          siteVagueCapabilityFollowup:!!result.data.siteVagueCapabilityFollowup,
          siteVagueCapabilityAnswer:!!result.data.siteVagueCapabilityAnswer,
          siteVagueCapabilityRevision:!!result.data.siteVagueCapabilityRevision,
          siteVagueCapabilityCancelled:!!result.data.siteVagueCapabilityCancelled,
          firstComparisonItem:String(result.data.firstComparisonItem||''),
          siteGuideContextCleared:!!result.data.siteGuideContextCleared,
          needsClarification:!!result.data.needsClarification,
          // サイト案内経由で陣法操作へ進んだ場合も、直前の操作対象だけを軽量保存する。
          resolutionReason:String(result.data.context&&result.data.context.reason||''),
          contextMessage:String(result.data.context&&result.data.context.message||'')
        };
      }else if(result.data&&result.data.context&&result.data.context.resolved&&String(result.data.context.siteItem||'')==='jinpo'){
        // 用語案内から実際の陣法操作へ進んだことを、次の短い変更まで保持する。
        // 回答全文やサイト状態は保存せず、会話接続に必要な最小情報だけを残す。
        historyData={
          jinpoContinuation:true,
          siteItem:'jinpo',
          resolutionReason:String(result.data.context.reason||''),
          contextMessage:String(result.data.context.message||'')
        };
      }else if(result.data&&result.data.needsSpecifiedSearchCondition){
        // 「7因縁で探して」→「陣形だけ教えて」のような途中状態も、
        // 相づち後の「8にして」へ主語を引き継げるようにする。
        historyData={
          jinpoContinuation:true,
          siteItem:'jinpo',
          resolutionReason:'specified_search_partial'
        };
      }else if(result.data&&result.data.heroKnowledge){
        historyData={
          heroKnowledge:true,
          hero:String(result.data.hero||''),
          heroes:Array.isArray(result.data.heroes)?result.data.heroes.slice(0,24):[],
          // 「コスト7」→「じゃあ8」、「腕力順」→「じゃあ知力」のような
          // 同種の短い変更だけを次ターンへ接続するための軽量種別。
          cost:Number(result.data.cost||result.data.filters&&result.data.filters.cost)||0,
          list:!!result.data.list,
          costEdge:!!result.data.costEdge,
          ranking:!!result.data.ranking,
          low:!!result.data.low,
          candidates:Array.isArray(result.data.candidates)?result.data.candidates.slice(0,12):[],
          needsClarification:!!result.data.needsClarification,
          stats:Array.isArray(result.data.stats)?result.data.stats.slice(0,12):[],
          factors:Array.isArray(result.data.factors)?result.data.factors.slice(0,12):[],
          names:Array.isArray(result.data.names)?result.data.names.slice(0,24):[],
          pairGap:!!result.data.pairGap,
          percentage:!!result.data.percentage,
          smallest:!!result.data.smallest,
          sameOnly:!!result.data.sameOnly,
          perStatLeaders:!!result.data.perStatLeaders,
          leaderCounts:!!result.data.leaderCounts,
          commonRegistration:!!result.data.commonRegistration,
          factorComparison:!!result.data.factorComparison,
          pairwiseWins:!!result.data.pairwiseWins,
          fullComparison:!!result.data.fullComparison,
          comparison:!!result.data.comparison,
          gaps:Array.isArray(result.data.gaps)?result.data.gaps.slice(0,12):[],
          heroRefinement:result.data.heroRefinement||null,
          heroRefinementChange:result.data.heroRefinementChange||null,
          previousCandidates:Array.isArray(result.data.previousCandidates)?result.data.previousCandidates.slice():[],
          addedCandidates:Array.isArray(result.data.addedCandidates)?result.data.addedCandidates.slice():[],
          removedCandidates:Array.isArray(result.data.removedCandidates)?result.data.removedCandidates.slice():[]
        };
      }
      addBubble('assistant',result.answer||'回答を取得できませんでした。',{sources:result.sources||[],links:result.links||[],mode:result.mode||'',data:historyData});
      setBrainStatus('案内・検索OK',String(result.mode||'歩き巫女'));
      scheduleGuideNavigationConfirmation(result);
    }catch(err){
      if(typing&&typing.parentNode)typing.remove();
      addBubble('assistant',humanError(err));
    }finally{ setBusy(false); input.focus(); }
  }

  function humanError(err){
    var code=err && err.code;
    if(code==='NO_TRANSPORT') return '歩き巫女の基本機能をまだ読み込んでいるのですよ。少ししてから、もう一度話しかけてください。';
    return '今の言葉をうまく受け取れなかったのですよ。少し言い方を変えて、もう一度話しかけてみてくださいね。';
  }

  function waitForTransport(ms){
    ms=Math.max(0,Number(ms)||0);
    if(window.JINPO_AI_TRANSPORT&&typeof window.JINPO_AI_TRANSPORT==='function')return Promise.resolve(true);
    if(!window.ARUKIMIKO_SHARED||!window.ARUKIMIKO_SHARED.loading)return Promise.resolve(false);

    return new Promise(function(resolve){
      var started=Date.now();
      var timer=setInterval(function(){
        if(window.JINPO_AI_TRANSPORT&&typeof window.JINPO_AI_TRANSPORT==='function'){
          clearInterval(timer);resolve(true);return;
        }
        if(!window.ARUKIMIKO_SHARED||!window.ARUKIMIKO_SHARED.loading||Date.now()-started>=ms){
          clearInterval(timer);resolve(false);
        }
      },40);
    });
  }

  async function requestAi(text,history){
    if(
      (!window.JINPO_AI_TRANSPORT||typeof window.JINPO_AI_TRANSPORT!=='function') &&
      window.ARUKIMIKO_SHARED&&window.ARUKIMIKO_SHARED.loading
    ){
      await waitForTransport(2500);
    }

    if(window.JINPO_AI_TRANSPORT && typeof window.JINPO_AI_TRANSPORT === 'function'){
      return normalizeResponse(await window.JINPO_AI_TRANSPORT({message:text,history:history}));
    }
    var no=new Error('local transport is not ready'); no.code='NO_TRANSPORT'; throw no;
  }

  function normalizeResponse(data){
    if(typeof data==='string') return {answer:data,sources:[],links:[],mode:'',data:null};
    data=data||{};
    return {
      answer:String(data.answer||data.message||''),
      sources:Array.isArray(data.sources)?data.sources:[],
      links:Array.isArray(data.links)?data.links:[],
      mode:String(data.mode||''),
      // 会話継続用の構造化dataを落とさない。
      // 以前はここで破棄していたため、英傑候補・サイト候補・訂正状態が
      // 実ブラウザの次ターンへ渡らず、テスト上の修正が画面で効かない原因になっていた。
      data:data.data&&typeof data.data==='object'?data.data:null
    };
  }

  function clearHistory(){ pendingHistoryClear=false; clearHistoryStorage(); renderHistory(); }
  function setTransport(fn){
    window.JINPO_AI_TRANSPORT = typeof fn==='function'?fn:null;
    if(statusEl&&!busy)statusEl.textContent=brainStatus;
  }

  window.JINPO_AI_CHAT = {
    version:'1.0.13-local-only', open:open, close:close, hide:hideAll, show:showLauncher, minimize:function(){ if(!win.classList.contains('isMinimized'))toggleMinimize(); },
    restore:function(){ if(win.classList.contains('isMinimized'))toggleMinimize(); open(); }, clearHistory:clearHistory, setTransport:setTransport,
    send:function(text){ open(); input.value=String(text||''); autoGrow(); return submit(); },
    addMessage:function(role,text,meta){ open(false); return addBubble(role,text,meta||{}); },
    getHistory:currentHistory,
    resetConversation:resetConversationFromButton,
    setBrainStatus:setBrainStatus,
    getBrainStatus:function(){return brainStatus;}
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build,{once:true}); else build();
})();
