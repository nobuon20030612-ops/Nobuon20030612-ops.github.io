/*
 * 歩き巫女 表情・動作ランタイム Stage13Z9
 * Official-image DOM overlay only. No persistence or Bot logic access.
 */
(function(){
  'use strict';
  if(window.__ARUKIMIKO_EXPRESSION_RUNTIME_STAGE13Z9__)return;
  window.__ARUKIMIKO_EXPRESSION_RUNTIME_STAGE13Z9__=true;

  var VERSION='13Z9.0-v3.69.0-exact';
  var STATE_CLASSES=['idle','input','thinking','searching','reply','success','warning','error','cannot','sentence','minimize','sleep','wake'];
  var current='idle', layer=null, face=null, symbol=null, glow=null, returnTimer=0;
  var assetUrl='';

  var EXPRESSIONS={
    idle:{symbol:'',glow:false,cover:true,brows:['M58 57 Q84 49 112 55','M148 55 Q176 48 205 59'],eyes:['M61 83 Q88 74 116 83 Q88 93 61 83','M145 84 Q174 75 204 84 Q174 94 145 84'],pupils:[[88,83,6],[174,84,6]],mouth:'M92 163 Q130 176 169 161',blush:.10},
    input:{symbol:'',glow:true,cover:true,brows:['M58 51 Q84 39 112 48','M148 48 Q176 38 205 52'],eyes:['M59 83 Q88 67 117 83 Q88 99 59 83','M144 84 Q174 68 205 84 Q174 100 144 84'],pupils:[[88,82,7],[174,83,7]],mouth:'M107 160 Q130 150 153 160',blush:.13},
    thinking:{symbol:'…',glow:false,cover:true,brows:['M58 55 Q83 61 109 57','M150 57 Q176 61 202 55'],eyes:['M61 85 Q88 81 115 85','M146 86 Q174 82 202 86'],pupils:[[86,87,5],[171,88,5]],mouth:'M107 164 Q130 158 153 164',blush:.06},
    searching:{symbol:'⌕',glow:true,cover:true,brows:['M58 53 Q84 47 111 52','M149 52 Q176 47 204 54'],eyes:['M60 84 Q87 75 115 84 Q87 93 60 84','M145 84 Q174 75 204 84 Q174 93 145 84'],pupils:[[81,84,5],[167,84,5]],mouth:'M101 164 L158 164',blush:.04},
    reply:{symbol:'',glow:false,cover:true,brows:['M58 57 Q84 49 112 55','M148 55 Q176 48 205 59'],eyes:['M61 83 Q88 74 116 83 Q88 93 61 83','M145 84 Q174 75 204 84 Q174 94 145 84'],pupils:[[88,83,6],[174,84,6]],mouth:'M91 160 Q130 180 170 158',blush:.16},
    success:{symbol:'✦',glow:true,cover:true,brows:['M57 48 Q84 34 113 45','M147 45 Q176 33 206 50'],eyes:['M58 82 Q88 64 118 82 Q88 100 58 82','M143 83 Q174 65 206 83 Q174 101 143 83'],pupils:[[88,80,7],[174,81,7]],mouth:'M83 154 Q130 197 178 153',blush:.28},
    warning:{symbol:'!',glow:false,cover:true,brows:['M57 52 Q83 62 111 57','M149 57 Q177 63 205 51'],eyes:['M60 84 Q88 77 116 84 Q88 90 60 84','M144 84 Q174 77 205 84 Q174 90 144 84'],pupils:[[88,84,6],[174,84,6]],mouth:'M96 165 L164 165',blush:0},
    error:{symbol:'×',glow:false,cover:true,brows:['M58 56 Q83 45 109 51','M151 51 Q177 45 203 57'],eyes:['M61 87 Q87 83 113 87','M148 88 Q174 84 201 88'],pupils:[[86,88,5],[172,89,5]],mouth:'M96 169 Q130 151 164 169',blush:.07},
    cannot:{symbol:'?',glow:false,cover:true,brows:['M57 49 Q79 36 105 45','M153 57 Q177 68 203 60'],eyes:['M58 83 Q86 67 116 83 Q86 100 58 83','M144 84 Q174 69 206 84 Q174 100 144 84'],pupils:[[86,84,6],[174,85,6]],mouth:'M108 160 Q130 149 153 161 Q130 174 108 160',blush:.10},
    sentence:{symbol:'',glow:false,cover:true,brows:['M58 57 Q84 49 112 55','M148 55 Q176 48 205 59'],eyes:['M61 83 Q88 74 116 83 Q88 93 61 83','M145 84 Q174 75 204 84 Q174 94 145 84'],pupils:[[88,83,6],[174,84,6]],mouth:'M91 160 Q130 180 170 158',blush:.16},
    minimize:{symbol:'',glow:false,cover:true,brows:['M58 57 Q84 51 112 56','M148 56 Q176 50 205 59'],eyes:['M61 86 Q88 89 115 86','M146 87 Q174 90 202 87'],pupils:[],mouth:'M99 163 Q130 168 161 163',blush:.05},
    sleep:{symbol:'Zzz',glow:false,cover:true,brows:['M58 57 Q84 54 110 58','M150 58 Q176 54 203 57'],eyes:['M61 87 Q88 91 115 87','M146 88 Q174 92 202 88'],pupils:[],mouth:'M101 164 Q130 170 160 164',blush:.08},
    wake:{symbol:'',glow:true,cover:true,brows:['M57 47 Q84 32 113 43','M147 43 Q176 31 206 48'],eyes:['M58 82 Q88 63 118 82 Q88 101 58 82','M143 83 Q174 64 206 83 Q174 102 143 83'],pupils:[[88,80,7],[174,81,7]],mouth:'M105 160 Q130 148 155 160',blush:.12}
  };

  function findAssetUrl(){
    var img=document.getElementById('jinpoAiWindowCharacterImg');
    if(img&&img.src)return img.src;
    var base=String(window.JINPO_BOT_BASE_URL||'');
    try{return new URL('assets/arukimiko-chat-top.png',base||location.href).href;}catch(e){return 'assets/arukimiko-chat-top.png';}
  }

  function skinCoverSvg(){
    /* Original features are first covered with soft skin patches before new features are drawn. */
    return ''+
      '<defs>'+
        '<filter id="amfxSoft"><feGaussianBlur stdDeviation="2.4"/></filter>'+
        '<linearGradient id="amfxSkinL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecc09e"/><stop offset=".55" stop-color="#dca984"/><stop offset="1" stop-color="#c98d6b"/></linearGradient>'+
        '<linearGradient id="amfxSkinR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efc5a4"/><stop offset=".58" stop-color="#dda981"/><stop offset="1" stop-color="#c98d69"/></linearGradient>'+
        '<linearGradient id="amfxSkinM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8b894"/><stop offset="1" stop-color="#d79f79"/></linearGradient>'+
      '</defs>'+
      '<ellipse cx="88" cy="82" rx="36" ry="23" fill="url(#amfxSkinL)" opacity=".93" filter="url(#amfxSoft)"/>'+
      '<ellipse cx="174" cy="83" rx="37" ry="23" fill="url(#amfxSkinR)" opacity=".93" filter="url(#amfxSoft)"/>'+
      '<rect x="51" y="38" width="66" height="31" rx="15" fill="url(#amfxSkinL)" opacity=".78" filter="url(#amfxSoft)"/>'+
      '<rect x="143" y="39" width="69" height="31" rx="15" fill="url(#amfxSkinR)" opacity=".78" filter="url(#amfxSoft)"/>'+
      '<ellipse cx="130" cy="163" rx="51" ry="24" fill="url(#amfxSkinM)" opacity=".92" filter="url(#amfxSoft)"/>';
  }

  function expressionSvg(name){
    var e=EXPRESSIONS[name]||EXPRESSIONS.idle;
    var pupils=(e.pupils||[]).map(function(p){
      return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+p[2]+'" fill="#3a272f"/>'+
             '<circle cx="'+(p[0]-2)+'" cy="'+(p[1]-2)+'" r="1.7" fill="#fff" opacity=".9"/>';
    }).join('');
    var blush=e.blush?'<ellipse cx="58" cy="122" rx="20" ry="11" fill="#f38aa8" opacity="'+e.blush+'"/>'+
      '<ellipse cx="204" cy="122" rx="20" ry="11" fill="#f38aa8" opacity="'+e.blush+'"/>':'';
    return '<svg viewBox="0 0 260 240" role="img" aria-label="'+name+'表情">'+
      skinCoverSvg()+blush+
      '<path d="'+e.brows[0]+'" fill="none" stroke="#4d2a34" stroke-width="5.5" stroke-linecap="round"/>'+
      '<path d="'+e.brows[1]+'" fill="none" stroke="#4d2a34" stroke-width="5.5" stroke-linecap="round"/>'+
      '<path d="'+e.eyes[0]+'" fill="none" stroke="#3e2931" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'+
      '<path d="'+e.eyes[1]+'" fill="none" stroke="#3e2931" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'+pupils+
      '<path d="'+e.mouth+'" fill="none" stroke="#a64f67" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>'+
      '</svg>';
  }

  function ensure(){
    layer=document.getElementById('jinpoAiWindowCharacter');
    if(!layer)return false;
    if(layer.classList.contains('arukimikoFxInstalled')){
      face=layer.querySelector('.arukimikoFxFace');
      symbol=layer.querySelector('.arukimikoFxSymbol');
      glow=layer.querySelector('.arukimikoFxGlow');
      return !!face;
    }
    layer.classList.add('arukimikoFxInstalled');
    glow=document.createElement('span');glow.className='arukimikoFxGlow';
    face=document.createElement('span');face.className='arukimikoFxFace';
    symbol=document.createElement('span');symbol.className='arukimikoFxSymbol';
    layer.appendChild(glow);layer.appendChild(face);layer.appendChild(symbol);
    assetUrl=findAssetUrl();
    applyExpression('idle');
    setMotion('idle');
    return true;
  }

  function clearStateClasses(){
    if(!layer)return;
    STATE_CLASSES.forEach(function(s){layer.classList.remove('arukimikoFx-'+s);});
    layer.classList.remove('arukimikoFxShowSymbol','arukimikoFxGlowOn');
  }
  function setMotion(name){
    if(!ensure())return false;
    clearStateClasses();
    layer.classList.add('arukimikoFx-'+name);
    return true;
  }
  function applyExpression(name,options){
    if(!ensure())return false;
    var e=EXPRESSIONS[name]||EXPRESSIONS.idle;
    face.innerHTML=expressionSvg(name);
    symbol.textContent=e.symbol||'';
    layer.classList.toggle('arukimikoFxShowSymbol',!!(e.symbol&&!(options&&options.hideSymbol)));
    layer.classList.toggle('arukimikoFxGlowOn',!!(e.glow&&!(options&&options.hideGlow)));
    layer.setAttribute('data-arukimiko-expression',name);
    return true;
  }
  function emit(name,detail){
    try{window.dispatchEvent(new CustomEvent('arukimiko:expression-state',{detail:Object.assign({state:name,version:VERSION,at:Date.now()},detail||{})}));}catch(e){}
  }
  function play(name,options){
    options=options||{};
    if(!ensure())return false;
    clearTimeout(returnTimer);returnTimer=0;
    current=STATE_CLASSES.indexOf(name)>=0?name:'idle';
    applyExpression(current,options);
    setMotion(current);
    /* setMotion clears flags, so expression flags are applied once more. */
    applyExpression(current,options);
    emit(current,options);
    if(options.returnTo){
      returnTimer=setTimeout(function(){play(options.returnTo);},Math.max(0,Number(options.duration)||600));
    }
    return true;
  }
  function stop(){
    clearTimeout(returnTimer);returnTimer=0;
    if(!ensure())return false;
    current='idle';clearStateClasses();applyExpression('idle');layer.style.removeProperty('opacity');emit('stop');return true;
  }
  function getState(){return current;}
  function diagnostics(){
    return {version:VERSION,installed:!!ensure(),state:current,layer:!!layer,face:!!face,symbol:!!symbol,assetUrl:assetUrl,storageAccess:false};
  }

  window.ARUKIMIKO_EXPRESSION_RUNTIME={version:VERSION,ensure:ensure,play:play,stop:stop,getState:getState,diagnostics:diagnostics,expressions:Object.keys(EXPRESSIONS)};
  var tries=0,t=setInterval(function(){tries++;if(ensure()||tries>160)clearInterval(t);},50);
})();
