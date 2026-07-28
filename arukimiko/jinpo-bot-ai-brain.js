/*
 * 歩き巫女 AI会話脳 v1.0.0
 *
 * Firebase AI Logic / Gemini を「頭脳」にする。
 * 正確な数値・最新情報・サイト操作は Function Calling で既存の正本/機能を使う。
 * AIが利用できない時は既存ローカルエンジンへ自動フォールバック。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_AI_BRAIN)return;

  var VERSION='1.0.0';
  var ctx={
    app:null,
    api:null,
    ai:null,
    initializing:null,
    lastError:'',
    lastErrorAt:0,
    lastOkAt:0,
    calls:0
  };

  function S(v){return String(v==null?'':v).trim();}
  function cfg(){return window.JINPO_BOT_AI_CONFIG||{};}
  function firebaseCfg(){
    var c=window.JINPO_BOT_FIREBASE_CONFIG||{};
    return c.firebaseConfig||{};
  }
  function configured(){
    var c=cfg(),f=firebaseCfg();
    return !!(c.enabled&&S(f.apiKey)&&S(f.projectId)&&S(f.appId));
  }
  function errorText(e){
    return S(e&&((e.code?e.code+' ':'')+(e.message||e))).slice(0,300);
  }
  function inCooldown(){
    return !!(ctx.lastErrorAt&&Date.now()-ctx.lastErrorAt<(Number(cfg().cooldownMs)||300000));
  }
  function safeClone(value,depth){
    depth=depth==null?0:depth;
    if(depth>5)return null;
    if(value==null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
    if(Array.isArray(value))return value.slice(0,30).map(function(x){return safeClone(x,depth+1);});
    if(typeof value==='object'){
      var out={},count=0;
      Object.keys(value).forEach(function(k){
        if(count>=40)return;
        var v=value[k];
        if(typeof v==='function'||typeof v==='undefined')return;
        out[k]=safeClone(v,depth+1);count++;
      });
      return out;
    }
    return String(value);
  }
  function normalizeToolResult(r){
    r=r||{};
    return {
      ok:r.handled!==false,
      handled:!!r.handled,
      answer:S(r.answer),
      mode:S(r.mode),
      data:safeClone(r.data||{}),
      sources:safeClone(Array.isArray(r.sources)?r.sources:[]),
      links:safeClone(Array.isArray(r.links)?r.links:[])
    };
  }

  async function init(){
    if(ctx.api&&ctx.ai&&ctx.app)return ctx;
    if(!configured())return null;
    if(ctx.initializing)return ctx.initializing;

    ctx.initializing=(async function(){
      try{
        var v=S(cfg().sdkVersion)||'12.16.0';
        var base='https://www.gstatic.com/firebasejs/'+v+'/';
        var mods=await Promise.all([
          import(base+'firebase-app.js'),
          import(base+'firebase-ai.js')
        ]);
        var appM=mods[0],aiM=mods[1],apps=appM.getApps?appM.getApps():[],app=null;
        for(var i=0;i<apps.length;i++){
          if(apps[i]&&apps[i].name==='arukimiko-ai-brain'){app=apps[i];break;}
        }
        ctx.app=app||appM.initializeApp(firebaseCfg(),'arukimiko-ai-brain');
        ctx.api=aiM;
        ctx.ai=aiM.getAI(ctx.app,{backend:new aiM.GoogleAIBackend()});
        ctx.lastError='';ctx.lastErrorAt=0;
        return ctx;
      }catch(e){
        ctx.lastError=errorText(e);ctx.lastErrorAt=Date.now();
        return null;
      }finally{
        ctx.initializing=null;
      }
    })();

    return ctx.initializing;
  }

  function trimHistory(history,currentMessage){
    var h=Array.isArray(history)?history.slice():[];
    var max=Math.max(4,Number(cfg().maxHistoryMessages)||18);

    // UIは送信前に現在のuser bubbleをhistoryへ追加するため、最後の同一文は除外。
    if(h.length){
      var last=h[h.length-1];
      if(last&&last.role==='user'&&S(last.text)===S(currentMessage))h.pop();
    }

    h=h.slice(-max);
    var out=[];
    h.forEach(function(x){
      if(!x)return;
      var text=S(x.text);if(!text)return;
      var role=x.role==='assistant'?'model':x.role==='user'?'user':'';
      if(!role)return;
      out.push({role:role,parts:[{text:text.slice(0,5000)}]});
    });

    // Gemini chat history must alternate reasonably; collapse duplicate roles.
    var clean=[];
    out.forEach(function(x){
      var prev=clean[clean.length-1];
      if(prev&&prev.role===x.role){
        prev.parts[0].text+='\n'+x.parts[0].text;
      }else clean.push(x);
    });
    if(clean.length&&clean[0].role==='model')clean.shift();
    return clean;
  }

  function pageInfo(opt){
    opt=opt||{};
    var p=opt.pageContext||{};
    return {
      mode:S(p.mode||window.JINPO_BOT_PAGE_MODE||''),
      title:S(p.title||document.title||''),
      path:S(p.path||location.pathname||'')
    };
  }

  function systemInstruction(opt){
    var p=pageInfo(opt);
    return [
      'あなたは「たいらの野望」サイト常駐AIの歩き巫女です。',
      'ユーザーとは自然な日本語で会話してください。機械的なメニュー会話を避け、前後の文脈・省略・ひらがな・軽い誤字を意味から理解します。',
      '口調は可愛く丁寧で、必要な時だけ「〜なのですよ」「〜なのです」を自然に使います。毎文につけないでください。',
      '',
      '最重要ルール:',
      '1. ゲーム内の数値、カウンター、九十九、鬼神石、魔導結晶、陣法検索結果などは絶対に推測しません。必ず利用可能な正本ツールを使います。',
      '2. カープ順位・試合・天気・ニュース・最新情報など鮮度が必要な内容も、必ず対応ツールを使います。',
      '3. 「ページはこちら」はユーザーが「開いて」「どこ」「ページ」「リンク」など移動を求めた時だけ使います。質問にはまず答えそのものを返します。',
      '4. ツールが未登録・取得失敗なら、適当な数字を作らず、そのことを自然に伝えます。',
      '5. 「カープ→順位」「天気→東京→明日は？」「カウンターの話→天海は？」のような短い続きは、会話履歴から自然に補います。',
      '6. 家臣名付けでは、相手の好みを会話で少しずつ聞き、面倒そうならすぐ候補を出します。苗字6文字・名前6文字以内は必ず守ります。',
      '7. 陣法ページで検索・適用・全MAX・差替など実際の画面操作を頼まれたら、jinpo_local_commandツールを使い、成功結果を確認してから「できた」と言います。',
      '8. TOPや通常ページでは陣法の「おすすめ/指定して探す」メニューを会話で押し付けません。陣法操作が必要なら必要に応じてページ案内します。',
      '',
      '現在ページ: mode='+p.mode+' / title='+p.title+' / path='+p.path,
      '',
      '返答方針:',
      '- 最初にユーザーが知りたい答えを言う。',
      '- 不要な前置きや同じ説明の反復を避ける。',
      '- 会話として自然なら短く、説明が必要なら十分に詳しくする。',
      '- ツール結果の数字・固有名詞を勝手に変更しない。'
    ].join('\n');
  }

  function makeSchema(aiM){
    return aiM.Schema.object({
      properties:{
        query:aiM.Schema.string({description:'ユーザーの意図を保った検索・操作文。省略語は必要なら自然な日本語へ補完する。'})
      }
    });
  }

  function buildTools(aiM,opt,meta){
    opt=opt||{};meta=meta||{};
    var schema=makeSchema(aiM);

    function record(r){
      r=r||{};
      if(Array.isArray(r.sources))meta.sources=meta.sources.concat(r.sources);
      if(Array.isArray(r.links))meta.links=meta.links.concat(r.links);
      if(r.mode)meta.modes.push(S(r.mode));
      return normalizeToolResult(r);
    }

    async function tairano(args){
      var q=S(args&&args.query);
      try{
        if(window.JINPO_TAIRANO_KNOWLEDGE&&typeof window.JINPO_TAIRANO_KNOWLEDGE.respond==='function'){
          return record(window.JINPO_TAIRANO_KNOWLEDGE.respond(q,{history:opt.history||[]}));
        }
      }catch(e){}
      return {ok:false,handled:false,error:'たいらの野望正本を利用できません'};
    }

    async function toolData(args){
      var q=S(args&&args.query);
      try{
        if(window.JINPO_BOT_TOOL_KNOWLEDGE&&typeof window.JINPO_BOT_TOOL_KNOWLEDGE.respond==='function'){
          return record(window.JINPO_BOT_TOOL_KNOWLEDGE.respond(q,{history:opt.history||[]}));
        }
      }catch(e){}
      return {ok:false,handled:false,error:'ツール実データを利用できません'};
    }

    async function carp(args){
      var q=S(args&&args.query);
      try{
        if(window.JINPO_BOT_CARP&&typeof window.JINPO_BOT_CARP.respond==='function'){
          return record(await window.JINPO_BOT_CARP.respond(q,{history:opt.history||[]}));
        }
      }catch(e){}
      return {ok:false,handled:false,error:'カープ情報を取得できません'};
    }

    async function realtime(args){
      var q=S(args&&args.query);
      try{
        var w=window.JINPO_BOT_WEB;
        if(w){
          var r;
          if(typeof w.isRealtime==='function'&&w.isRealtime(q)&&typeof w.lookupRealtime==='function')r=await w.lookupRealtime(q);
          else if(typeof w.lookup==='function')r=await w.lookup(q);
          if(r){
            var answer=S(r.extract||r.answer);
            return record({
              handled:!!r.ok,
              answer:answer,
              mode:r.kind==='weather'?'天気':'Web',
              sources:Array.isArray(r.sources)?r.sources:(r.url?[{title:S(r.title||r.source||'参照元'),url:S(r.url)}]:[]),
              links:[],
              data:safeClone(r)
            });
          }
        }
      }catch(e){}
      return {ok:false,handled:false,error:'Web/天気情報を取得できません'};
    }

    async function kashin(args){
      var q=S(args&&args.query);
      try{
        if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.respond==='function'){
          return record(window.JINPO_BOT_KASHIN_NAME.respond(q,{history:opt.history||[]}));
        }
      }catch(e){}
      return {ok:false,handled:false,error:'家臣名付け機能を利用できません'};
    }

    async function guide(args){
      var q=S(args&&args.query);
      try{
        if(window.JINPO_BOT_SITE_GUIDE&&typeof window.JINPO_BOT_SITE_GUIDE.respond==='function'){
          return record(window.JINPO_BOT_SITE_GUIDE.respond(q,{
            history:opt.history||[],
            intentInfo:{intent:'navigation',navigation:true}
          }));
        }
      }catch(e){}
      return {ok:false,handled:false,error:'サイト案内を利用できません'};
    }

    async function local(args){
      var q=S(args&&args.query);
      if(typeof opt.localHandle!=='function')return {ok:false,handled:false,error:'陣法操作はこのページでは利用できません'};
      try{
        return record(await opt.localHandle(q));
      }catch(e){
        return {ok:false,handled:false,error:'陣法操作に失敗しました'};
      }
    }

    return [{
      functionDeclarations:[
        {
          name:'lookup_tairano_knowledge',
          description:'たいらの野望のゲーム専用正本を検索する。天下統一奇譚、修羅の間、天下武技大会、人物カウンターなどの数値は必ずこのツールで確認する。',
          parameters:schema,
          functionReference:tairano
        },
        {
          name:'lookup_game_tool_data',
          description:'九十九・鬼神石・魔導結晶の番号、名称、能力値、入手先、最大値・順位を正本CSVから確認する。これらの数値質問では必ず使う。',
          parameters:schema,
          functionReference:toolData
        },
        {
          name:'lookup_carp_current',
          description:'広島東洋カープの現在順位、試合、日程、選手、成績など最新情報を確認する。カープの現在情報では必ず使う。',
          parameters:schema,
          functionReference:carp
        },
        {
          name:'lookup_web_or_weather',
          description:'天気、ニュース、現在・今日・明日・最新情報、一般Web情報を確認する。鮮度が必要な質問では使う。',
          parameters:schema,
          functionReference:realtime
        },
        {
          name:'name_kashin',
          description:'信長の野望Onlineの家臣の名前を考える。好みを聞く会話や候補生成を行い、苗字6文字・名前6文字以内を守る。',
          parameters:schema,
          functionReference:kashin
        },
        {
          name:'open_site_page',
          description:'ユーザーがページを開きたい、場所を知りたい、リンクが欲しいと明示した時だけサイト内ページを案内する。普通の質問には使わない。',
          parameters:schema,
          functionReference:guide
        },
        {
          name:'jinpo_local_command',
          description:'陣法ページで検索、条件変更、全MAX、英傑配置・除外、差替、結果適用など実際のサイト操作を行う。操作依頼では必ずこのツールを使う。',
          parameters:schema,
          functionReference:local
        }
      ]
    }];
  }

  async function respond(message,opt){
    opt=opt||{};
    message=S(message);
    if(!message||!configured()||inCooldown())return {handled:false};

    var c=await init();
    if(!c||!c.api||!c.ai)return {handled:false};

    var meta={sources:[],links:[],modes:[]};

    try{
      var aiM=c.api;
      var tools=buildTools(aiM,opt,meta);

      var model=aiM.getGenerativeModel(
        c.ai,
        {
          model:S(cfg().model)||'gemini-3.6-flash',
          systemInstruction:systemInstruction(opt),
          tools:tools
        },
        {
          timeout:Number(cfg().timeoutMs)||18000,
          maxSequentialFunctionCalls:Number(cfg().maxSequentialFunctionCalls)||6
        }
      );

      var chat=model.startChat({
        history:trimHistory(opt.history||[],message)
      });

      ctx.calls++;
      var result=await chat.sendMessage(message);
      var text=result&&result.response&&typeof result.response.text==='function'
        ?S(result.response.text()):'';

      if(!text){
        throw new Error('AI response was empty');
      }

      ctx.lastOkAt=Date.now();ctx.lastError='';ctx.lastErrorAt=0;

      // 重複メタデータ除去
      var seenS={},sources=[];
      meta.sources.forEach(function(x){
        x=x||{};var key=S(x.url)+'|'+S(x.title);
        if(!key||seenS[key])return;seenS[key]=1;sources.push(x);
      });
      var seenL={},links=[];
      meta.links.forEach(function(x){
        x=x||{};var key=S(x.url)+'|'+S(x.label);
        if(!key||seenL[key])return;seenL[key]=1;links.push(x);
      });

      return {
        handled:true,
        answer:text,
        sources:sources.slice(0,8),
        links:links.slice(0,6),
        mode:'AI歩き巫女',
        data:{
          aiBrain:true,
          model:S(cfg().model)||'gemini-3.6-flash',
          toolModes:meta.modes.slice(0,8)
        }
      };
    }catch(e){
      ctx.lastError=errorText(e);
      ctx.lastErrorAt=Date.now();
      return {handled:false,error:ctx.lastError};
    }
  }

  function status(){
    return {
      version:VERSION,
      enabled:!!cfg().enabled,
      configured:configured(),
      cooldown:inCooldown(),
      model:S(cfg().model),
      calls:ctx.calls,
      lastOkAt:ctx.lastOkAt,
      lastError:ctx.lastError,
      lastErrorAt:ctx.lastErrorAt
    };
  }

  function reset(){
    ctx.lastError='';ctx.lastErrorAt=0;ctx.lastOkAt=0;ctx.calls=0;
  }

  window.JINPO_BOT_AI_BRAIN={
    version:VERSION,
    respond:respond,
    status:status,
    reset:reset,
    configured:configured,
    _trimHistory:trimHistory,
    _systemInstruction:systemInstruction
  };
})();
