/* 歩き巫女 ADVテーマ DOM追加 v2.3.1 */
(function(){
  'use strict';
  if(window.__JINPO_BOT_ADV_THEME_INSTALLED__) return;
  window.__JINPO_BOT_ADV_THEME_INSTALLED__=true;

  var VERSION='2.4.1',BOT_NAME='歩き巫女',LAYOUT_MIGRATION_KEY='jinpoBotAdvLayout.v231Large',SIZE_RESTORE_KEY='jinpoBotAdvSize.v272Large';
  var heroObserver=null;
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
    try{
      var raw=localStorage.getItem('jinpoAiChatUi.v1'),st=raw?JSON.parse(raw):{};
      if(st&&typeof st==='object'){
        delete st.width;
        delete st.height;
        localStorage.setItem('jinpoAiChatUi.v1',JSON.stringify(st));
      }
      localStorage.setItem(SIZE_RESTORE_KEY,'1');
    }catch(e){}
    // 位置情報はそのまま。サイズ指定だけCSSへ戻す。
    win.style.width='';
    win.style.height='';
  }

  function makeHero(){
    var hero=document.createElement('section');
    hero.id='jinpoAiAdvHero';
    hero.setAttribute('aria-label',BOT_NAME+' キャラクター');

    var img=document.createElement('img');
    img.id='jinpoAiAdvHeroImg';
    img.src=assetUrl('assets/jinpo-bot-portrait-real.webp');
    img.alt=BOT_NAME+'のキャラクター';
    img.decoding='async';
    img.draggable=false;
    img.addEventListener('load',function(){hero.classList.add('isImageReady');hero.classList.remove('isImageError');},{once:true});
    img.addEventListener('error',function(){hero.classList.add('isImageError');hero.classList.remove('isImageReady');},{once:true});

    var name=document.createElement('div');
    name.id='jinpoAiAdvNameplate';
    name.innerHTML='<span class="jinpoAiAdvSpark">✦</span><span>'+BOT_NAME+'</span>';

    var tag=document.createElement('div');
    tag.id='jinpoAiAdvTagline';
    tag.textContent=pageMode()==='site'?'サイト案内や調べものをお手伝いするのですよ。':'気軽に陣法探しをお手伝いするのですよ。';

    hero.appendChild(img);hero.appendChild(name);hero.appendChild(tag);
    return hero;
  }

  /*
   * v1.6: キャラ画像を会話履歴の左上へ固定する。
   * 会話欄そのものを広く使い、画像は左寄せの小さな立ち絵として扱う。
   */
  function ensureHeroInMessages(win,messages){
    if(!win||!messages)return null;
    var hero=q('#jinpoAiAdvHero',messages);
    if(!hero){
      var old=q('#jinpoAiAdvHero',win);
      hero=old||makeHero();
      messages.insertBefore(hero,messages.firstChild||null);
    }else if(messages.firstChild!==hero){
      messages.insertBefore(hero,messages.firstChild||null);
    }
    win.classList.add('hasJinpoAdvHero');
    return hero;
  }

  function watchHero(win,messages){
    if(heroObserver||typeof MutationObserver==='undefined')return;
    heroObserver=new MutationObserver(function(){
      if(!q('#jinpoAiAdvHero',messages)){
        ensureHeroInMessages(win,messages);
      }
    });
    heroObserver.observe(messages,{childList:true});
  }

  function decorate(){
    var root=q('#jinpoAiRoot'),win=q('#jinpoAiWindow'),messages=q('.jinpoAiMessages',win),launcher=q('#jinpoAiLauncher');
    if(!root||!win||!messages||!launcher)return false;
    root.classList.add('jinpoAdvTheme');
    migrateLayoutToRight(win);
    restoreLargeSizeOnce(win);

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

    ensureHeroInMessages(win,messages);
    watchHero(win,messages);

    var first=q('.jinpoAiMessageRow.assistant .jinpoAiBubble',messages);
    if(first&&/^こんにちは。/.test(first.textContent||'')){
      first.textContent=pageMode()==='site'
        ?'こんにちは。'+BOT_NAME+'なのですよ。\nサイトの案内、調べもの、雑談までそのまま話しかけてくださいね。'
        :'こんにちは。'+BOT_NAME+'なのですよ。\nざっくり選ぶだけでも探せますし、手入力でも大丈夫なのですよ。';
    }
    var sys=q('.jinpoAiMessageRow.system .jinpoAiBubble',messages);
    if(sys&&/AI接続|基礎機能/.test(sys.textContent||''))sys.textContent='サイト内だけで動く無料Botなのですよ。';
    return true;
  }

  function diagnostics(){
    var portrait=q('#jinpoAiAdvHeroImg'),mascot=q('.jinpoAiMascot'),st=q('.jinpoAiStatus');
    var actionCount=window.JINPO_BOT_ACTIONS&&Array.isArray(window.JINPO_BOT_ACTIONS.registry)?window.JINPO_BOT_ACTIONS.registry.length:0;
    var bridge=window.JINPO_BOT_ACTIONS&&typeof window.JINPO_BOT_ACTIONS.verifySearchBridge==='function'?window.JINPO_BOT_ACTIONS.verifySearchBridge():{ok:false,missing:['verifySearchBridge']};
    var ready=pageMode()==='site'
      ?!!(window.JINPO_BOT&&window.JINPO_BOT_CONTEXT&&window.JINPO_BOT_SITE_GUIDE&&window.JINPO_BOT_SMALLTALK&&window.JINPO_BOT_ARUKIMIKO&&typeof window.JINPO_AI_TRANSPORT==='function')
      :!!(window.JINPO_BOT&&window.JINPO_BOT_ACTIONS&&window.JINPO_BOT_PARSER&&window.JINPO_BOT_INTERPRETER&&window.JINPO_BOT_STATE&&window.JINPO_BOT_HELP&&window.JINPO_BOT_NLU&&window.JINPO_BOT_ARUKIMIKO&&typeof window.JINPO_AI_TRANSPORT==='function'&&actionCount>=99&&window.JINPO_BOT_CAPABILITIES&&window.JINPO_BOT_CAPABILITIES.count>=99&&bridge.ok);
    var info={
      ready:ready,actionCount:actionCount,transport:typeof window.JINPO_AI_TRANSPORT==='function',bridge:bridge,
      portraitLoaded:!!(portrait&&portrait.complete&&portrait.naturalWidth>0),
      portraitSize:portrait?[portrait.naturalWidth||0,portrait.naturalHeight||0]:[0,0],
      portraitInMessages:!!(portrait&&portrait.closest&&portrait.closest('.jinpoAiMessages')),
      mascotBackground:mascot?getComputedStyle(mascot).backgroundImage:'',
      mascotSize:mascot?[Math.round(mascot.getBoundingClientRect().width),Math.round(mascot.getBoundingClientRect().height)]:[0,0]
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

// v1.8: 外部AI接続待ちの文言ではなく、ローカルBotの準備状態を表示する。
(function syncLocalBotStatus(){
  var tries=0,t=setInterval(function(){
    tries++;var st=document.getElementById('jinpoAiStatus');
    if(st&&window.JINPO_AI_TRANSPORT)st.textContent='準備OK';
    if(tries>=20||!document.documentElement.contains(st||document.documentElement))clearInterval(t);
  },250);
})();
