/* 歩き巫女 ADVテーマ DOM追加 v2.4.9 */
(function(){
  'use strict';
  if(window.__JINPO_BOT_ADV_THEME_INSTALLED__) return;
  window.__JINPO_BOT_ADV_THEME_INSTALLED__=true;

  var VERSION='2.4.9',BOT_NAME='歩き巫女',LAYOUT_MIGRATION_KEY='jinpoBotAdvLayout.v231Large',SIZE_RESTORE_KEY='jinpoBotAdvSize.v317HardStandard',CHARACTER_LAYOUT_MIGRATION_KEY='jinpoBotAdvLayout.v249ExternalCharacter';
  var NORMAL_CHARACTER_ASSET='assets/arukimiko-chat-top.png';
  var characterObserver=null,characterResizeObserver=null,characterLayer=null,characterImg=null;
  function q(s,r){return (r||document).querySelector(s);}
  function pageMode(){
    if(window.JINPO_BOT_PAGE_MODE)return String(window.JINPO_BOT_PAGE_MODE);
    try{return /\/陣法\/jinpo\.html$/i.test(decodeURIComponent(location.pathname||''))?'jinpo':'site';}catch(e){return'jinpo';}
  }
  function assetUrl(rel){
    var base=String(window.JINPO_BOT_BASE_URL||'');
    if(!base){
      var scripts=document.getElementsByTagName('script');
      for(var i=scripts.length-1;i>=0;i--){
        var src=String(scripts[i].src||'');
        if(/jinpo-bot-adv-theme\.js(?:[?#]|$)/.test(src)){try{base=new URL('.',src).href;}catch(e){}break;}
      }
    }
    try{return new URL(rel,base||location.href).href;}catch(e){return rel;}
  }


  /*
   * v2.4.9:
   * キャラクター画像はチャット枠内へ置かない。
   * 通常表示は「枠の上にもたれ掛かる画像」、最小化時は「全身画像」へ切り替える。
   * 画像ファイルそのものは加工せず、DOM/CSS上の表示だけを切り替える。
   */
  function reserveCharacterTopOnce(win){
    if(!win||window.matchMedia('(max-width:760px)').matches)return;
    var done=false;try{done=localStorage.getItem(CHARACTER_LAYOUT_MIGRATION_KEY)==='1';}catch(e){}
    if(done)return;

    function apply(){
      var vh=Math.max(560,Number(window.innerHeight)||0);
      var top=Math.max(190,Math.min(285,Math.round(vh*.27)));
      var height=Math.max(360,vh-top-12);
      try{
        var raw=localStorage.getItem('jinpoAiChatUi.v1');
        var st=raw?JSON.parse(raw):{};
        if(!st||typeof st!=='object')st={};
        st.top=Math.round(top);
        st.height=Math.round(height);
        localStorage.setItem('jinpoAiChatUi.v1',JSON.stringify(st));
      }catch(e){}
      win.style.top=Math.round(top)+'px';
      win.style.bottom='auto';
      win.style.height=Math.round(height)+'px';
    }

    apply();
    setTimeout(apply,180);
    try{localStorage.setItem(CHARACTER_LAYOUT_MIGRATION_KEY,'1');}catch(e){}
  }

  function removeLegacyHero(win,messages){
    var legacy=(messages&&q('#jinpoAiAdvHero',messages))||q('#jinpoAiAdvHero',win);
    if(legacy&&legacy.parentNode)legacy.parentNode.removeChild(legacy);
    if(win){win.classList.remove('hasJinpoAdvHero');win.classList.add('hasJinpoExternalCharacter');}
  }

  function syncWindowCharacter(root,win){
    if(!characterLayer||!characterImg||!root||!win)return;
    var visible=win.classList.contains('isOpen')&&!root.classList.contains('isBotHidden');
    var minimized=!!(visible&&win.classList.contains('isMinimized'));
    root.classList.toggle('jinpoWindowMinimized',minimized);
    root.classList.toggle('jinpoWindowExpanded',!!(visible&&!minimized));
    if(!visible||minimized){characterLayer.hidden=true;return;}

    var r=win.getBoundingClientRect();
    if(!r||r.width<2||r.height<2){characterLayer.hidden=true;return;}
    var mobile=window.matchMedia('(max-width:760px)').matches;
    var src=assetUrl(NORMAL_CHARACTER_ASSET);
    if(characterImg.getAttribute('src')!==src)characterImg.setAttribute('src',src);

    characterLayer.hidden=false;
    characterLayer.classList.remove('isMinimizedCharacter');
    characterLayer.classList.add('isExpandedCharacter');

    var width,height,left,top;
    width=mobile?Math.min(r.width*.78,330):Math.min(Math.max(r.width*.68,360),560);
    /* 枠を画面上端近くへ移動した時は、キャラを切らずに収まる範囲まで自動縮小する。 */
    if(!mobile){
      var visibleHeightPerWidth=(2/3)*.776;
      var maxWidthByTop=Math.max(250,(r.top+5)/visibleHeightPerWidth);
      width=Math.min(width,maxWidthByTop);
    }
    height=width*(2/3);
    left=r.left+(r.width-width)/2;
    /* 元画像の実体下端は画像高のおよそ77.6%。そこを枠上端へ重ねる。 */
    top=r.top-height*.776+7;
    top=Math.max(2,top);
    left=Math.max(2,Math.min((window.innerWidth||document.documentElement.clientWidth)-width-2,left));

    characterLayer.style.left=Math.round(left)+'px';
    characterLayer.style.top=Math.round(top)+'px';
    characterLayer.style.width=Math.round(width)+'px';
    characterLayer.style.height=Math.round(height)+'px';
  }

  function ensureWindowCharacter(root,win){
    if(!root||!win)return null;
    characterLayer=q('#jinpoAiWindowCharacter',root);
    if(!characterLayer){
      characterLayer=document.createElement('div');
      characterLayer.id='jinpoAiWindowCharacter';
      characterLayer.setAttribute('aria-hidden','true');
      characterImg=document.createElement('img');
      characterImg.id='jinpoAiWindowCharacterImg';
      characterImg.alt='';
      characterImg.decoding='async';
      characterImg.draggable=false;
      characterLayer.appendChild(characterImg);
      root.appendChild(characterLayer);
    }else{
      characterImg=q('#jinpoAiWindowCharacterImg',characterLayer);
    }

    if(!characterObserver&&typeof MutationObserver!=='undefined'){
      characterObserver=new MutationObserver(function(){syncWindowCharacter(root,win);});
      characterObserver.observe(win,{attributes:true,attributeFilter:['class','style']});
      characterObserver.observe(root,{attributes:true,attributeFilter:['class']});
    }
    if(!characterResizeObserver&&typeof ResizeObserver!=='undefined'){
      characterResizeObserver=new ResizeObserver(function(){syncWindowCharacter(root,win);});
      characterResizeObserver.observe(win);
    }
    if(!window.__JINPO_EXTERNAL_CHARACTER_RESIZE_BOUND__){
      window.__JINPO_EXTERNAL_CHARACTER_RESIZE_BOUND__=true;
      window.addEventListener('resize',function(){syncWindowCharacter(root,win);},{passive:true});
    }

    try{
      var preload1=new Image();preload1.src=assetUrl(NORMAL_CHARACTER_ASSET);
    }catch(e){}
    syncWindowCharacter(root,win);
    return characterLayer;
  }

  function migrateLayoutToRight(win){
    if(!win||window.matchMedia('(max-width:760px)').matches)return;
    var done=false;try{done=localStorage.getItem(LAYOUT_MIGRATION_KEY)==='1';}catch(e){}
    if(done)return;
    try{
      var raw=localStorage.getItem('jinpoAiChatUi.v1'),st=raw?JSON.parse(raw):{};
      if(st&&typeof st==='object'){
        delete st.left;delete st.top;delete st.width;delete st.height;
        localStorage.setItem('jinpoAiChatUi.v1',JSON.stringify(st));
      }
      localStorage.setItem(LAYOUT_MIGRATION_KEY,'1');
    }catch(e){}
    win.style.left='auto';win.style.right='24px';win.style.top='8px';win.style.bottom='auto';win.style.width='';win.style.height='';
  }


  /*
   * v2.7.2:
   * 過去にlocalStorageへ保存された小さいwidth/heightがCSSの大型サイズを上書きする問題だけを修正。
   * left/top/right/bottom、グリッド、画像位置、会話欄構造などレイアウトには触れない。
   * PCで一度だけ保存済みwidth/heightを破棄し、既存CSSの
   * width:700px / height:calc(100vh - 24px)
   * を再び有効にする。
   */
  function restoreLargeSizeOnce(win){
    if(!win||window.matchMedia('(max-width:760px)').matches)return;

    var done=false;
    try{done=localStorage.getItem(SIZE_RESTORE_KEY)==='1';}catch(e){}
    if(done)return;

    function targetSize(){
      var vw=Math.max(0,Number(window.innerWidth)||0);
      var vh=Math.max(0,Number(window.innerHeight)||0);
      return {
        width:Math.max(360,Math.min(700,Math.max(360,vw-32))),
        height:Math.max(300,vh-24)
      };
    }

    function apply(){
      var size=targetSize();

      // CSS任せではなく、今回だけ標準値そのものを保存し直す。
      // これにより過去の小さいinline width/heightやResizeObserver保存値に勝つ。
      try{
        var raw=localStorage.getItem('jinpoAiChatUi.v1');
        var st=raw?JSON.parse(raw):{};
        if(!st||typeof st!=='object')st={};

        st.width=Math.round(size.width);
        st.height=Math.round(size.height);
        st.top=8;

        localStorage.setItem('jinpoAiChatUi.v1',JSON.stringify(st));
      }catch(e){}

      win.style.width=Math.round(size.width)+'px';
      win.style.height=Math.round(size.height)+'px';
      win.style.top='8px';
      win.style.bottom='auto';
    }

    // ADV theme is loaded after the base chat UI, but apply twice to defeat
    // any late ResizeObserver/restore race from older saved UI state.
    apply();
    setTimeout(apply,120);

    try{localStorage.setItem(SIZE_RESTORE_KEY,'1');}catch(e){}
  }

  function decorate(){
    var root=q('#jinpoAiRoot'),win=q('#jinpoAiWindow'),messages=q('.jinpoAiMessages',win),launcher=q('#jinpoAiLauncher');
    if(!root||!win||!messages||!launcher)return false;
    root.classList.add('jinpoAdvTheme');
    migrateLayoutToRight(win);
    restoreLargeSizeOnce(win);
    reserveCharacterTopOnce(win);

    var title=q('.jinpoAiTitle',win),label=q('.jinpoAiLauncherLabel',launcher),status=q('.jinpoAiStatus',win),send=q('#jinpoAiSend',win);
    if(title)title.textContent=BOT_NAME;
    if(label)label.textContent=BOT_NAME;
    if(status)status.textContent=pageMode()==='site'?'案内機能を確認中…':'操作機能を確認中…';
    if(send)send.textContent='送る';
    launcher.setAttribute('aria-label',BOT_NAME+'を開く');
    win.setAttribute('aria-label',BOT_NAME+'チャット');

    if(!q('#jinpoAiMascotSpeech',launcher)){
      var speech=document.createElement('span');
      speech.id='jinpoAiMascotSpeech';
      speech.textContent='何かお手伝いするのですよ。';
      launcher.appendChild(speech);
    }

    removeLegacyHero(win,messages);
    ensureWindowCharacter(root,win);

    var first=q('.jinpoAiMessageRow.assistant .jinpoAiBubble',messages);
    if(first&&/^こんにちは。/.test(first.textContent||'')){
      first.textContent=pageMode()==='site'
        ?'こんにちは。'+BOT_NAME+'なのですよ。\nサイトの案内、調べもの、雑談までそのまま話しかけてくださいね。'
        :'こんにちは。'+BOT_NAME+'なのですよ。\nざっくり選ぶだけでも探せますし、手入力でも大丈夫なのですよ。';
    }
    return true;
  }

  function diagnostics(){
    var root=q('#jinpoAiRoot'),portrait=q('#jinpoAiWindowCharacterImg'),mascot=q('.jinpoAiMascot'),st=q('.jinpoAiStatus');
    var actionCount=window.JINPO_BOT_ACTIONS&&Array.isArray(window.JINPO_BOT_ACTIONS.registry)?window.JINPO_BOT_ACTIONS.registry.length:0;
    var bridge=window.JINPO_BOT_ACTIONS&&typeof window.JINPO_BOT_ACTIONS.verifySearchBridge==='function'?window.JINPO_BOT_ACTIONS.verifySearchBridge():{ok:false,missing:['verifySearchBridge']};
    // v3.3.8:
    // smalltalk/help/tool/Web等の任意モジュールは遅延読込。
    // それらを「起動完了条件」にすると高速化しても表示上ずっと待つため、
    // 基本コア + transport だけで準備OKとする。
    var sharedCore=!!(window.ARUKIMIKO_SHARED&&window.ARUKIMIKO_SHARED.coreReady);
    var ready=pageMode()==='site'
      ?!!(sharedCore&&window.JINPO_BOT&&window.JINPO_BOT_CONTEXT&&window.JINPO_BOT_SITE_GUIDE&&window.JINPO_BOT_ARUKIMIKO&&typeof window.JINPO_AI_TRANSPORT==='function')
      :!!(sharedCore&&window.JINPO_BOT&&window.JINPO_BOT_ACTIONS&&window.JINPO_BOT_PARSER&&window.JINPO_BOT_INTERPRETER&&window.JINPO_BOT_STATE&&window.JINPO_BOT_NLU&&window.JINPO_BOT_ARUKIMIKO&&typeof window.JINPO_AI_TRANSPORT==='function'&&actionCount>=99&&bridge.ok);
    var info={
      ready:ready,actionCount:actionCount,transport:typeof window.JINPO_AI_TRANSPORT==='function',bridge:bridge,
      portraitLoaded:!!(portrait&&portrait.complete&&portrait.naturalWidth>0),
      portraitSize:portrait?[portrait.naturalWidth||0,portrait.naturalHeight||0]:[0,0],
      portraitInMessages:false,
      externalCharacter:!!portrait,
      mascotBackground:mascot?getComputedStyle(mascot).backgroundImage:'',
      mascotSize:mascot?[Math.round(mascot.getBoundingClientRect().width),Math.round(mascot.getBoundingClientRect().height)]:[0,0],
      advCssLoaded:root?String(getComputedStyle(root).getPropertyValue('--arukimiko-adv-theme-loaded')||'').trim().replace(/["']/g,''):''
    };
    if(st)st.textContent=ready?'準備OK':'準備を確認中…';
    return info;
  }

  function install(){
    if(!decorate()){
      var n=0,t=setInterval(function(){n++;if(decorate()||n>100){clearInterval(t);if(n<=100)diagnostics();}},80);
      return;
    }
    var checks=0,rt=setInterval(function(){checks++;var d=diagnostics();if(d.ready||checks>100)clearInterval(rt);},80);
  }

  window.JINPO_BOT_ADV_THEME={version:VERSION,name:BOT_NAME,install:install,diagnostics:diagnostics};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

// v1.8: ローカルBotの準備状態を表示する。
(function syncLocalBotStatus(){
  var tries=0,t=setInterval(function(){
    tries++;var st=document.getElementById('jinpoAiStatus');
    if(st&&window.JINPO_AI_TRANSPORT)st.textContent='準備OK';
    if(tries>=20||!document.documentElement.contains(st||document.documentElement))clearInterval(t);
  },250);
})();
