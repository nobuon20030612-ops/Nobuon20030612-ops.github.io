/*
 * たいらの野望 / 陣法AI フローティングチャット UI v0.2
 * Stage 1: UI / 移動 / リサイズ / 最小化 / 会話履歴 / 将来API接続口。
 * 既存の陣法検索ロジックには触れない。
 */
(function(){
  'use strict';
  if(window.__JINPO_AI_CHAT_UI_INSTALLED__) return;
  window.__JINPO_AI_CHAT_UI_INSTALLED__ = true;

  var STORAGE_KEY = 'jinpoAiChatUi.v1';
  var HISTORY_KEY = 'jinpoAiChatHistory.v1';
  var MAX_HISTORY = 60;
  var root, launcher, restoreBtn, win, header, messages, input, sendBtn, statusEl, minBtn;
  var dragging = null;
  var busy = false;
  var memoryUi = {};
  var memoryHistory = [];

  function cfg(){
    var c = window.JINPO_AI_CONFIG || {};
    return {
      endpoint: typeof c.endpoint === 'string' ? c.endpoint.trim() : '',
      title: typeof c.title === 'string' && c.title.trim() ? c.title.trim() : '歩き巫女',
      requestTimeoutMs: Math.max(5000, Number(c.requestTimeoutMs) || 45000)
    };
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
    statusEl = el('div','jinpoAiStatus',{text:(window.JINPO_AI_TRANSPORT&&typeof window.JINPO_AI_TRANSPORT==='function')?'準備OK':'準備中…'});
    htext.appendChild(statusEl); header.appendChild(htext);

    var actions = el('div','jinpoAiHeaderActions');
    minBtn = el('button','jinpoAiHeaderBtn jinpoAiHeaderMinBtn',{type:'button','aria-label':'画面最小化',title:'画面最小化',text:'画面最小化'});
    var hideBtn = el('button','jinpoAiHeaderBtn jinpoAiHeaderHideBtn',{type:'button','aria-label':'歩き巫女を非表示',title:'歩き巫女を非表示',text:'非表示'});
    actions.appendChild(minBtn); actions.appendChild(hideBtn); header.appendChild(actions);

    messages = el('div','jinpoAiMessages',{role:'log','aria-label':'会話履歴'});
    var composer = el('div','jinpoAiComposer');
    var row = el('div','jinpoAiComposerRow');
    input = el('textarea','',{id:'jinpoAiInput',rows:'1',placeholder:'メッセージを入力…','aria-label':'歩き巫女へのメッセージ'});
    sendBtn = el('button','',{id:'jinpoAiSend',type:'button',text:'送信'});
    row.appendChild(input); row.appendChild(sendBtn); composer.appendChild(row);
    var note = el('div','jinpoAiComposerNote');
    note.appendChild(el('span','',{text:'Enterで送信 / Shift+Enterで改行'}));
    composer.appendChild(note);

    win.appendChild(header); win.appendChild(messages); win.appendChild(composer);
    restoreBtn = el('button','',{id:'jinpoAiRestoreTab',type:'button',text:'歩き巫女を表示','aria-label':'歩き巫女を表示'});
    restoreBtn.hidden = true;
    root.appendChild(launcher); root.appendChild(win); root.appendChild(restoreBtn); document.body.appendChild(root);

    launcher.addEventListener('click', function(){ if(win.classList.contains('isOpen')) close(); else open(); });
    minBtn.addEventListener('click', function(ev){ ev.stopPropagation(); toggleMinimize(); });
    hideBtn.addEventListener('click', function(ev){ ev.stopPropagation(); hideAll(); });
    restoreBtn.addEventListener('click', function(ev){ ev.stopPropagation(); showLauncher(); open(); });
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
    var label = minimized ? '元の画面に戻す' : '画面最小化';
    minBtn.textContent = label;
    minBtn.setAttribute('aria-label', label);
    minBtn.title = label;
  }

  function restore(){
    var s = loadUi();
    if(s.hidden){
      root.classList.add('isBotHidden');
      restoreBtn.hidden=false;
    }
    if(window.matchMedia('(max-width:760px)').matches){
      if(s.minimized) win.classList.add('isMinimized');
      syncMinimizeButton();
      if(s.open&&!s.hidden) open(false);
      return;
    }
    if(Number.isFinite(s.left)) win.style.left = s.left + 'px';
    if(Number.isFinite(s.top)) win.style.top = s.top + 'px';
    if(Number.isFinite(s.width)) win.style.width = clamp(s.width,310,Math.max(310,innerWidth-24)) + 'px';
    if(Number.isFinite(s.height)) win.style.height = clamp(s.height,300,Math.max(300,innerHeight-24)) + 'px';
    if(Number.isFinite(s.left) || Number.isFinite(s.top)){ win.style.right='auto'; win.style.bottom='auto'; keepInViewport(); }
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
    win.classList.remove('isOpen');
    launcher.setAttribute('aria-expanded','false');
    win.classList.remove('isMinimized');
    syncMinimizeButton();
    root.classList.add('isBotHidden');
    if(restoreBtn)restoreBtn.hidden=false;
    saveUi({open:false,hidden:true,minimized:false});
  }
  function showLauncher(save){
    root.classList.remove('isBotHidden');
    if(restoreBtn)restoreBtn.hidden=true;
    if(save!==false)saveUi({hidden:false});
  }
  function toggleMinimize(){
    var on = win.classList.toggle('isMinimized');
    syncMinimizeButton();
    saveUi({minimized:on});
    if(!on){ keepInViewport(); setTimeout(function(){ input.focus(); },0); }
  }

  function keepInViewport(){
    if(!win || !win.classList.contains('isOpen') || window.matchMedia('(max-width:760px)').matches) return;
    var r = win.getBoundingClientRect();
    var left = clamp(r.left,8,Math.max(8,innerWidth-r.width-8));
    var top = clamp(r.top,8,Math.max(8,innerHeight-r.height-8));
    win.style.left = left+'px'; win.style.top = top+'px'; win.style.right='auto'; win.style.bottom='auto';
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
      var left = clamp(ev.clientX-dragging.dx,8,Math.max(8,innerWidth-r.width-8));
      var top = clamp(ev.clientY-dragging.dy,8,Math.max(8,innerHeight-r.height-8));
      win.style.left=left+'px'; win.style.top=top+'px'; win.style.right='auto'; win.style.bottom='auto';
    });
    function end(ev){
      if(!dragging || dragging.id !== ev.pointerId) return;
      dragging=null; var r=win.getBoundingClientRect(); saveUi({left:Math.round(r.left),top:Math.round(r.top)});
    }
    header.addEventListener('pointerup',end); header.addEventListener('pointercancel',end);
  }

  function bindResizeSave(){
    var timer=0, lastW=0, lastH=0;
    if(typeof ResizeObserver !== 'undefined'){
      new ResizeObserver(function(entries){
        if(window.matchMedia('(max-width:760px)').matches || win.classList.contains('isMinimized')) return;
        var r=entries[0] && entries[0].contentRect; if(!r) return;
        if(Math.abs(r.width-lastW)<1 && Math.abs(r.height-lastH)<1) return; lastW=r.width; lastH=r.height;
        clearTimeout(timer); timer=setTimeout(function(){
          var b=win.getBoundingClientRect(); saveUi({width:Math.round(b.width),height:Math.round(b.height),left:Math.round(b.left),top:Math.round(b.top)}); keepInViewport();
        },180);
      }).observe(win);
    }
    window.addEventListener('resize', function(){ keepInViewport(); });
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
      addBubble('assistant','こんにちは。歩き巫女なのですよ。\nクリックでも手入力でも、陣法探しを一緒に進められるのですよ。',{ephemeral:true});
      addBubble('system',cfg().endpoint ? 'AI接続設定を検出しました' : '現在はチャット画面の基礎機能まで有効です',{ephemeral:true});
      return;
    }
    h.forEach(function(m){ addBubble(m.role,m.text,Object.assign({},m.meta||{},{ephemeral:true})); });
    scrollBottom();
  }

  function addBubble(role,text,meta){
    role = role === 'user' ? 'user' : role === 'system' ? 'system' : 'assistant';
    var row=el('div','jinpoAiMessageRow '+role); var bubble=el('div','jinpoAiBubble');
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
  function setBusy(v){ busy=!!v; sendBtn.disabled=busy; input.disabled=busy; statusEl.textContent=busy?'考えています…':((window.JINPO_AI_TRANSPORT&&typeof window.JINPO_AI_TRANSPORT==='function')?'準備OK':'準備中…'); }

  async function submit(){
    if(busy) return; var text=String(input.value||'').trim(); if(!text) return;
    input.value=''; autoGrow(); addBubble('user',text); setBusy(true); var typing=addTyping();
    try{
      var result=await requestAi(text,currentHistory()); if(typing&&typing.parentNode)typing.remove();
      addBubble('assistant',result.answer||'回答を取得できませんでした。',{sources:result.sources||[],mode:result.mode||''});
      if(result.mode) statusEl.textContent=String(result.mode);
    }catch(err){
      if(typing&&typing.parentNode)typing.remove();
      addBubble('assistant',humanError(err));
    }finally{ setBusy(false); input.focus(); }
  }

  function humanError(err){
    var code=err && err.code;
    if(code==='NO_ENDPOINT') return 'まだ準備中なのですよ。少し待ってから、もう一度話しかけてみてくださいね。';
    if(code==='TIMEOUT') return '応答に時間がかかっています。少し時間をおいて、もう一度お試しください。';
    return '今の言葉をうまく受け取れなかったのですよ。少し言い方を変えて、もう一度話しかけてみてくださいね。';
  }

  async function requestAi(text,history){
    if(window.JINPO_AI_TRANSPORT && typeof window.JINPO_AI_TRANSPORT === 'function'){
      return normalizeResponse(await window.JINPO_AI_TRANSPORT({message:text,history:history}));
    }
    var c=cfg(); if(!c.endpoint){ var no=new Error('AI endpoint is not configured'); no.code='NO_ENDPOINT'; throw no; }
    var controller=typeof AbortController!=='undefined'?new AbortController():null; var timer=setTimeout(function(){ if(controller)controller.abort(); },c.requestTimeoutMs);
    try{
      var res=await fetch(c.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal:controller?controller.signal:undefined,body:JSON.stringify({message:text,history:(history||[]).slice(-30),page:{name:'jinpo',url:location.href}})});
      if(!res.ok) throw new Error('HTTP '+res.status);
      return normalizeResponse(await res.json());
    }catch(e){ if(e&&e.name==='AbortError'){ e.code='TIMEOUT'; } throw e; }
    finally{ clearTimeout(timer); }
  }

  function normalizeResponse(data){
    if(typeof data==='string') return {answer:data,sources:[],mode:''};
    data=data||{}; return {answer:String(data.answer||data.message||''),sources:Array.isArray(data.sources)?data.sources:[],mode:String(data.mode||'')};
  }

  function clearHistory(){ saveHistory([]); renderHistory(); }
  function setTransport(fn){ window.JINPO_AI_TRANSPORT = typeof fn==='function'?fn:null; statusEl.textContent=window.JINPO_AI_TRANSPORT?'準備OK':'準備中…'; }

  window.JINPO_AI_CHAT = {
    version:'0.2.2', open:open, close:close, hide:hideAll, show:showLauncher, minimize:function(){ if(!win.classList.contains('isMinimized'))toggleMinimize(); },
    restore:function(){ if(win.classList.contains('isMinimized'))toggleMinimize(); open(); }, clearHistory:clearHistory, setTransport:setTransport,
    send:function(text){ open(); input.value=String(text||''); autoGrow(); return submit(); },
    addMessage:function(role,text,meta){ open(false); return addBubble(role,text,meta||{}); },
    getHistory:currentHistory
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build,{once:true}); else build();
})();
