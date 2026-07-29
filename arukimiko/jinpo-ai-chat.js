/*
 * たいらの野望 / 歩き巫女 共通フローティングチャット UI v1.0.6-local-only
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
  function saveHistory(list){
    memoryHistory = (list || []).slice(-MAX_HISTORY);
    try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(memoryHistory)); }catch(e){}
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
    var label = minimized ? '元に戻す' : '画面最小化';
    minBtn.textContent = label;
    minBtn.setAttribute('aria-label', label);
    minBtn.title = label;
  }

  function restore(){
    var s = loadUi();
    if(s.hidden){
      root.classList.add('isBotHidden');
      restoreBtn.hidden=false;
      scheduleRestorePosition();
    }
    if(window.matchMedia('(max-width:760px)').matches){
      if(s.minimized) win.classList.add('isMinimized');
      syncMinimizeButton();
      if(s.open&&!s.hidden) open(false);
      return;
    }
    if(s.userMoved){
      if(Number.isFinite(s.left)) win.style.left = s.left + 'px';
      if(Number.isFinite(s.top)) win.style.top = s.top + 'px';
      if(Number.isFinite(s.left) || Number.isFinite(s.top)){ win.style.right='auto'; win.style.bottom='auto'; }
    }
    applyResponsiveWindowSize(s);
    applyResponsiveWindowPosition(s);
    if(s.userMoved&&(Number.isFinite(s.left)||Number.isFinite(s.top))) keepInViewport();
    if(s.minimized) win.classList.add('isMinimized');
    syncMinimizeButton();
    if(s.open&&!s.hidden) open(false);
  }

  function clamp(v,min,max){ return Math.min(max,Math.max(min,Number(v)||0)); }
  function open(focus){
    showLauncher(false);
    syncMinimizeButton();
    win.classList.add('isOpen'); launcher.setAttribute('aria-expanded','true'); saveUi({open:true,hidden:false});
    keepInViewport();
    if(focus !== false) setTimeout(function(){ if(!win.classList.contains('isMinimized')) input.focus(); },0);
  }
  function close(){ win.classList.remove('isOpen'); launcher.setAttribute('aria-expanded','false'); saveUi({open:false}); }
  function hideAll(){
    hideAiInfo();
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
    if(!on){ keepInViewport(); setTimeout(function(){ input.focus(); },0); }
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
        addBubble('assistant','この端末の会話履歴を削除しました。たいらの野望の正本知識やFirebaseの共有知識は消していないのですよ。',{ephemeral:true});
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
      addBubble('assistant','この端末に保存されている会話履歴を削除しますか？\n削除する場合は「削除する」、やめる場合は「やめる」と送ってください。\n他の利用者の履歴や、たいらの野望の正本知識は対象外なのですよ。');
      input.focus();return;
    }
    addBubble('user',text); setBusy(true); var typing=addTyping();
    try{
      var result=await requestAi(text,currentHistory()); if(typing&&typing.parentNode)typing.remove();
      addBubble('assistant',result.answer||'回答を取得できませんでした。',{sources:result.sources||[],links:result.links||[],mode:result.mode||''});
      setBrainStatus('案内・検索OK',String(result.mode||'歩き巫女'));
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
    if(typeof data==='string') return {answer:data,sources:[],mode:''};
    data=data||{}; return {answer:String(data.answer||data.message||''),sources:Array.isArray(data.sources)?data.sources:[],links:Array.isArray(data.links)?data.links:[],mode:String(data.mode||'')};
  }

  function clearHistory(){ pendingHistoryClear=false; clearHistoryStorage(); renderHistory(); }
  function setTransport(fn){
    window.JINPO_AI_TRANSPORT = typeof fn==='function'?fn:null;
    if(statusEl&&!busy)statusEl.textContent=brainStatus;
  }

  window.JINPO_AI_CHAT = {
    version:'1.0.6-local-only', open:open, close:close, hide:hideAll, show:showLauncher, minimize:function(){ if(!win.classList.contains('isMinimized'))toggleMinimize(); },
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
