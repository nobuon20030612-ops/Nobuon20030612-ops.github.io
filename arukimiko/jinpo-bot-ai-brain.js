/*
 * 歩き巫女 AI会話脳 v2.1.0
 *
 * Firebase AI Logic / Gemini を「頭脳」にする。
 * 正確な数値・最新情報・サイト操作は Function Calling で既存の正本/機能を使う。
 * AIが利用できない時は既存ローカルエンジンへ自動フォールバック。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_AI_BRAIN)return;

  var VERSION='2.1.0';
  var CONTEXT_EPOCH_KEY='jinpoAiContextEpoch.v1';

  var ctx={
    app:null,
    api:null,
    ai:null,
    appCheck:null,
    appCheckApi:null,
    initializing:null,
    lastError:'',
    lastErrorAt:0,
    lastOkAt:0,
    calls:0,
    toolCalls:0,
    phase:'idle',
    preflightAt:0,
    preflightOk:false,
    toolPreflightOk:false,
    activeModel:'',
    modelErrors:[]
  };

  function S(v){return String(v==null?'':v).trim();}
  function cfg(){return window.JINPO_BOT_AI_CONFIG||{};}
  function firebaseCfg(){
    var c=window.JINPO_BOT_FIREBASE_CONFIG||{};
    return c.firebaseConfig||{};
  }
  function appCheckCfg(){
    var root=window.JINPO_BOT_FIREBASE_CONFIG||{};
    var ac=root.appCheck||{};
    var f=root.firebaseConfig||{};
    return {
      enabled:ac.enabled!==false,
      provider:S(ac.provider||'recaptcha-v3'),
      siteKey:S(ac.siteKey||f.recaptchaSiteKey||''),
      autoRefresh:ac.autoRefresh!==false
    };
  }
  function configured(){
    var c=cfg(),f=firebaseCfg();
    return !!(c.enabled&&S(f.apiKey)&&S(f.projectId)&&S(f.appId));
  }
  function appCheckReady(){
    var c=cfg(),ac=appCheckCfg();
    if(!c.requireAppCheck)return true;
    return !!(ac.enabled&&ac.siteKey);
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

    ctx.phase='initializing';
    ctx.initializing=(async function(){
      try{
        var v=S(cfg().sdkVersion)||'12.16.0';
        var base='https://www.gstatic.com/firebasejs/'+v+'/';
        var mods=await Promise.all([
          import(base+'firebase-app.js'),
          import(base+'firebase-app-check.js'),
          import(base+'firebase-ai.js')
        ]);
        var appM=mods[0],appCheckM=mods[1],aiM=mods[2],apps=appM.getApps?appM.getApps():[],app=null;
        ctx.appCheckApi=appCheckM;
        for(var i=0;i<apps.length;i++){
          if(apps[i]&&apps[i].name==='arukimiko-ai-brain'){app=apps[i];break;}
        }
        ctx.app=app||appM.initializeApp(firebaseCfg(),'arukimiko-ai-brain');

        var ac=appCheckCfg();
        if(cfg().requireAppCheck){
          if(!ac.enabled)throw new Error('app-check-disabled');
          if(!ac.siteKey)throw new Error('app-check-site-key-missing');
        }

        if(ac.enabled&&ac.siteKey&&!ctx.appCheck){
          var provider;
          if(ac.provider==='recaptcha-v3'){
            provider=new appCheckM.ReCaptchaV3Provider(ac.siteKey);
          }else if(ac.provider==='recaptcha-enterprise'){
            provider=new appCheckM.ReCaptchaEnterpriseProvider(ac.siteKey);
          }else{
            throw new Error('app-check-provider-unsupported');
          }

          ctx.appCheck=appCheckM.initializeAppCheck(ctx.app,{
            provider:provider,
            isTokenAutoRefreshEnabled:ac.autoRefresh
          });
        }

        ctx.api=aiM;
        ctx.ai=aiM.getAI(ctx.app,{backend:new aiM.GoogleAIBackend()});
        ctx.lastError='';ctx.lastErrorAt=0;ctx.phase='ready';
        return ctx;
      }catch(e){
        ctx.lastError=errorText(e);ctx.lastErrorAt=Date.now();ctx.phase='fallback';
        return null;
      }finally{
        ctx.initializing=null;
      }
    })();

    return ctx.initializing;
  }

  function contextEpoch(){
    try{
      var n=Number(localStorage.getItem(CONTEXT_EPOCH_KEY)||0);
      return isFinite(n)&&n>0?n:0;
    }catch(e){return 0;}
  }

  function resetConversationContext(){
    var t=Date.now();
    try{localStorage.setItem(CONTEXT_EPOCH_KEY,String(t));}catch(e){}
    return t;
  }

  function clearConversationContext(){
    try{localStorage.removeItem(CONTEXT_EPOCH_KEY);}catch(e){}
    return true;
  }

  function filterRawHistory(history){
    var h=Array.isArray(history)?history.slice():[];
    var epoch=contextEpoch();
    if(!epoch)return h;
    return h.filter(function(x){
      if(!x)return false;
      var at=Number(x.at||0);
      // Legacy entries without timestamp are considered old after an explicit reset.
      return at>=epoch;
    });
  }

  function recentUserContext(history,currentMessage){
    var h=filterRawHistory(history);
    var limit=Math.max(3,Number(cfg().recentUserContextMessages)||8);
    var current=S(currentMessage);
    var out=[];

    for(var i=h.length-1;i>=0&&out.length<limit;i--){
      var x=h[i];
      if(!x||x.role!=='user')continue;
      var text=S(x.text);
      if(!text)continue;

      // UI already adds the current user bubble before transport.
      if(!out.length&&text===current)continue;

      out.push(text.slice(0,1000));
    }

    return out.reverse();
  }

  function shortFollowup(text){
    var t=S(text);
    return t.length>0&&t.length<=22;
  }

  function joinedRecentUsers(history,currentMessage){
    return recentUserContext(history,currentMessage).join(' / ');
  }

  function requiresVerifiedTool(message,opt){
    if(cfg().enforceVerifiedTools===false)return null;

    var t=S(message),history=(opt&&opt.history)||[];
    var recent=joinedRecentUsers(history,message);
    var all=(recent+' / '+t);
    var carpRecognized=false;
    try{
      carpRecognized=!!(window.JINPO_BOT_CARP&&typeof window.JINPO_BOT_CARP.isCarp==='function'&&window.JINPO_BOT_CARP.isCarp(t));
    }catch(e){}
    var carpContext=carpRecognized||/カープ|かーぷ|広島東洋|広島カープ/.test(all);

    // Page navigation only when explicitly requested.
    if(/(?:ページ|サイト|リンク).*(?:開|見|行|案内|どこ)|(?:開いて|ひらいて|見せて|移動して|案内して|リンク教えて)/.test(t)){
      return {reason:'navigation',allowed:['open_site_page']};
    }

    // Jinpo real operations must be executed, not merely described.
    if(/(?:陣法|陣形|因縁|英傑|全MAX|差替|配置|除外|検索).*(?:して|やって|探して|適用|解除|設定|変更|選んで)|(?:全MAX|差替|配置|除外).*(?:して|お願い)/.test(t)){
      return {reason:'jinpo-action',allowed:['jinpo_local_command']};
    }

    // Tairano numeric canonical knowledge.
    if(/カウンター|カウンタ|かうんた|かうん|天下統一奇譚|修羅の間|天下武技大会/.test(all)){
      if(/カウンター|カウンタ|かうんた|かうん|数値|何番|いくつ/.test(t) || shortFollowup(t)){
        return {reason:'tairano-number',allowed:['lookup_tairano_knowledge']};
      }
    }

    // Structured game CSV canonical values.
    if(/九十九|つくも|鬼神石|きしん|魔導結晶|魔導|まどう/.test(all)){
      if(/何番|番は|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|一番|トップ|最大|高い|いくつ/.test(t) || shortFollowup(t)){
        return {reason:'game-tool-data',allowed:['lookup_game_tool_data']};
      }
    }

    // 過去回答との矛盾指摘は、会話の分野に応じた正本で再検証する。
    if(/前と違|さっきと違|前に言ってた|さっき言ってた|言ってること違|矛盾|どっちが正しい|どちらが正しい/.test(t)){
      var convDomain='';
      try{
        if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.recentDomain==='function')
          convDomain=window.JINPO_BOT_CONVERSATION.recentDomain(history||[]);
      }catch(e){}
      if(convDomain==='carp'||/カープ|広島東洋|広島カープ/.test(all))return {reason:'consistency-carp',allowed:['lookup_carp_knowledge']};
      if(convDomain==='counter'||/カウンター|天下統一奇譚|修羅の間|天下武技大会/.test(all))return {reason:'consistency-tairano',allowed:['lookup_tairano_knowledge']};
      if(convDomain==='tsukumo'||convDomain==='kishin'||convDomain==='madou'||/九十九|鬼神石|魔導/.test(all))return {reason:'consistency-tool-data',allowed:['lookup_game_tool_data']};
      if(convDomain==='weather'||/天気|気温|予報/.test(all))return {reason:'consistency-realtime',allowed:['lookup_web_or_weather']};
    }

    // Current Carp info. Follow-ups like "順位は？" inherit from recent user topic.
    if(carpContext){
      if(/順位|何位|試合|日程|予定|結果|成績|選手|先発|スタメン|打率|本塁打|防御率|登録|抹消|今日|明日|今季|今年|現在|最近|今(?:どう|は|の|も|って)/.test(t)){
        return {reason:'carp-current',allowed:['lookup_carp_current']};
      }
    }

    // カープ人物・歴史の会話的な聞き方でも、事実部分は必ず専用正本へ戻す。
    // 例: 「黒田ってどんな人？」「黒田ってすごかったんだね」。好き嫌いだけの雑談は強制しない。
    if(carpRecognized&&/どんな人|どんな選手|誰|家族|逸話|歴史|経歴|成績|記録|すご(?:い|かった)|意外|有名|教えて|知りたい|について/.test(t)){
      return {reason:'carp-canonical',allowed:['lookup_carp_knowledge']};
    }

    // Fresh/current information must use retrieval.
    if(/天気|気温|予報|降水|雨|雪|湿度|風速|今日|明日|現在|最新|ニュース|速報|今の/.test(t)){
      return {reason:'realtime',allowed:['lookup_web_or_weather']};
    }

    return null;
  }

  function trustedAssistantMessage(x){
    if(!x||x.role!=='assistant')return false;
    if(cfg().trustLocalAssistantHistory)return true;
    var meta=x.meta||{},mode=S(meta.mode);
    return mode==='AI歩き巫女'||mode==='AI接続確認';
  }

  function trimHistory(history,currentMessage){
    var h=filterRawHistory(history);
    var max=Math.max(4,Number(cfg().maxHistoryMessages)||18);

    // UIは送信前に現在のuser bubbleをhistoryへ追加するため、最後の同一文は除外。
    if(h.length){
      var last=h[h.length-1];
      if(last&&last.role==='user'&&S(last.text)===S(currentMessage))h.pop();
    }

    h=h.slice(-Math.max(max*2,24));
    var out=[];

    h.forEach(function(x){
      if(!x)return;
      var text=S(x.text);if(!text)return;

      if(x.role==='assistant'){
        // 以前のルールBotの誤返答がGeminiの文脈を汚染しないようにする。
        if(!trustedAssistantMessage(x))return;
        out.push({role:'model',parts:[{text:text.slice(0,5000)}]});
        return;
      }

      if(x.role==='user'){
        out.push({role:'user',parts:[{text:text.slice(0,5000)}]});
      }
    });

    out=out.slice(-max);

    // Gemini chat historyのrole連続を整理する。
    // userが連続した場合は「過去のユーザー発言」として明確に分離して結合。
    var clean=[];
    out.forEach(function(x){
      var prev=clean[clean.length-1];
      if(prev&&prev.role===x.role){
        var sep=x.role==='user'?'\n\n[次のユーザー発言]\n':'\n\n';
        prev.parts[0].text+=sep+x.parts[0].text;
      }else{
        clean.push(x);
      }
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

  var ASPECT_JA={overview:'概要',career:'経歴',stats:'成績',anecdote:'逸話',family:'家族',current:'現在',history:'歴史',rank:'順位',schedule:'日程',result:'結果',compare:'比較',counter:'カウンター'};

  function conversationStateSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.workingMemory!=='function')return'（会話グラフ未利用）';
    try{
      var h=Array.isArray(history)?history.slice():[],cur=S(currentMessage);
      if(h.length&&h[h.length-1]&&h[h.length-1].role==='user'&&S(h[h.length-1].text)===cur)h.pop();
      var wm=conv.workingMemory(h),lines=[];
      if(wm.domain)lines.push('現在の分野: '+wm.domain);
      var subjects=Array.isArray(wm.subjects)?wm.subjects:[];
      if(subjects.length)lines.push('現在の主役: '+subjects[0].value);
      var memories=Array.isArray(wm.subjectMemory)?wm.subjectMemory:[];
      memories.slice(0,5).forEach(function(m){
        var aspects=(m.aspects||[]).map(function(a){return ASPECT_JA[a]||a;});
        var line='話題 '+m.subject+(aspects.length?' / 既に触れた観点: '+aspects.join('・'):' / まだ観点記録なし');
        if(m.questions&&m.questions.length)line+=' / 最近の質問: '+S(m.questions[0]).slice(0,120);
        lines.push(line);
      });
      var signals=wm.signals||{};
      if(Array.isArray(signals.known)&&signals.known.length){
        lines.push('ユーザーが既知と示した内容: '+signals.known.slice(0,5).map(function(x){return (x.subject?x.subject+' / ':'')+(ASPECT_JA[x.aspect]||x.aspect||'直前内容');}).join('、'));
      }
      if(signals.engagement==='engaged')lines.push('会話傾向: この話題への関心が続いている');
      if(signals.engagement==='closed')lines.push('会話傾向: 直前の話題をいったん閉じたい反応がある');
      if(signals.depth&&signals.depthPersistent)lines.push('継続的な返答希望: '+(signals.depth==='brief'?'短く要点優先':'詳しく深める'));
      if(Array.isArray(signals.corrections)&&signals.corrections.length)lines.push('会話傾向: 最近、訂正・食い違いの指摘がある');
      var g=wm.graph||{},nodes=Array.isArray(g.nodes)?g.nodes:[],edges=Array.isArray(g.edges)?g.edges:[],names={};
      nodes.forEach(function(n){if(n&&n.id)names[n.id]=n.subject;});
      nodes.slice(0,3).forEach(function(n){
        if(!n||!n.subject)return;
        if(n.lastAssistant)lines.push('前回の返答メモ['+n.subject+']: '+S(n.lastAssistant).replace(/\s+/g,' ').slice(0,220));
      });
      edges.slice(0,6).forEach(function(e){
        var a=names[e.from],b=names[e.to];if(!a||!b)return;
        lines.push('会話内の接続: '+a+' → '+(e.label||e.relation||'言及')+' → '+b);
      });
      return lines.length?lines.join('\n'):'（このリセット以降の会話状態なし）';
    }catch(e){return'（会話状態の取得に失敗）';}
  }

  function recentAssistantContinuity(history,currentMessage){
    var h=filterRawHistory(history),cur=S(currentMessage),out=[];
    if(h.length&&h[h.length-1]&&h[h.length-1].role==='user'&&S(h[h.length-1].text)===cur)h.pop();
    for(var i=h.length-1;i>=0&&out.length<4;i--){
      var x=h[i]||{},text=S(x.text);if(x.role!=='assistant'||!text)continue;
      var mode=S((x.meta||{}).mode)||'会話';
      out.push('['+mode+'] '+text.replace(/\s+/g,' ').slice(0,260));
    }
    return out.reverse();
  }

  function responseStyleSummary(history,currentMessage){
    var h=filterRawHistory(history),cur=S(currentMessage),answers=[];
    if(h.length&&h[h.length-1]&&h[h.length-1].role==='user'&&S(h[h.length-1].text)===cur)h.pop();
    for(var i=h.length-1;i>=0&&answers.length<6;i--){
      var x=h[i]||{},text=S(x.text);if(x.role!=='assistant'||!text)continue;
      answers.push(text.replace(/\s+/g,' ').trim());
    }
    if(!answers.length)return'（直近返答なし）';
    var openings=[],endings=[],nano=0;
    answers.forEach(function(t){
      var first=t.split(/[。！？!?]/)[0].slice(0,42);if(first&&openings.indexOf(first)<0)openings.push(first);
      var parts=t.split(/[。！？!?]/).filter(Boolean);var last=parts.length?parts[parts.length-1].slice(-42):'';
      if(last&&endings.indexOf(last)<0)endings.push(last);
      nano+=(t.match(/なのです(?:よ)?/g)||[]).length;
    });
    return '最近の冒頭: '+openings.slice(0,4).join(' / ')+'\n最近の締め: '+endings.slice(0,4).join(' / ')+'\n「なのです」系の使用回数: '+nano;
  }

  function currentResponsePreference(message){
    var t=S(message),out=[];
    if(/短く|簡潔|簡単に|要点だけ|一言で/.test(t))out.push('今回は短く要点優先');
    if(/詳しく|深く|細かく|徹底的|全部/.test(t))out.push('今回は十分に詳しく');
    if(/例(?:も|を)|具体例|たとえば|例えば/.test(t))out.push('具体例を含める');
    if(/結論から|先に結論/.test(t))out.push('結論を先に置く');
    return out.length?out.join(' / '):'（明示指定なし）';
  }

  function verifiedPriorOutputs(history){
    var h=filterRawHistory(history),out=[];
    var verified=/^(?:カープ専用正本知識|カープ公式情報|カープ公式日付情報|カープ公式選手情報|カープ公式順位|カープ最新Web|カープWeb調査|たいらの野望専用知識|たいらの野望ツール実データ|天気|リアルタイムWeb自動参照|無料公開Web自動参照|調査記憶|Firebase共有記憶|陣法条件修正|歩き巫女)$/;
    for(var i=h.length-1;i>=0&&out.length<3;i--){
      var x=h[i]||{},meta=x.meta||{},mode=S(meta.mode),text=S(x.text);
      if(x.role!=='assistant'||!text||!verified.test(mode))continue;
      out.push('['+mode+'] '+text.slice(0,900));
    }
    return out.reverse();
  }

  function systemInstruction(opt){
    opt=opt||{};
    var p=pageInfo(opt);
    var recentUsers=recentUserContext(opt.history||[],opt.currentMessage||'');
    var recentBlock=recentUsers.length
      ?recentUsers.map(function(x,i){return (i+1)+'. '+x;}).join('\n')
      :'（この話題リセット以降の過去発言なし）';
    var conversationBlock=conversationStateSummary(opt.history||[],opt.currentMessage||'');
    var continuity=recentAssistantContinuity(opt.history||[],opt.currentMessage||'');
    var continuityBlock=continuity.length?continuity.join('\n'):'（直近の歩き巫女返答なし）';
    var styleBlock=responseStyleSummary(opt.history||[],opt.currentMessage||'');
    var responsePreference=currentResponsePreference(opt.currentMessage||'');
    var priorVerified=verifiedPriorOutputs(opt.history||[]);
    var priorVerifiedBlock=priorVerified.length?priorVerified.join('\n\n'):'（直近に確認済みローカル出力なし）';

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
      '9. 「話を戻そう」「前の話に戻って」は、直前より前にユーザーが明示していた話題へ戻る指示です。天気の地名や家臣名付けの回答として解釈してはいけません。',
      '10. 途中の質問フローが残っていても、ユーザーが明確に別の話題を出したら古いフローを優先しません。',
      '11. 下記の「直近のユーザー発言」はユーザー本人が実際に送った内容です。短い追質問や「話を戻そう」の解釈では、古い定型フローよりこちらを優先してください。',
      '12. 正本・現在情報・実操作に該当する時は、知識だけで答えず必ず指定されたFunction Callingを実行します。',
      '13. 陣形をユーザーへ質問するのは、「指定して探す」「陣形を指定したい」「鶴翼で」など、ユーザー自身が陣形指定を望んだ場合だけです。',
      '14. 「腕力高いの」「耐久と魅力が高いの」「おすすめ」「強いの探して」のような依頼では、陣形を質問せず全陣形から検索できる方法を優先します。',
      '15. 単に「検索したい」と言われただけなら、陣形ではなく「何を重視したいか」を自然に確認します。陣形指定は任意です。',
      '16. 普通の雑談・感想・質問では、サイト機能や検索メニューの話を自分から持ち出しません。普通の人同士の会話として返します。',
      '17. 毎回質問で返さないでください。ユーザーが答えだけを求めている時は答えて終わって構いません。',
      '18. 「〜ですね」「〜なのですよ」を毎回繰り返さず、文章のリズムを自然に変えてください。',
      '19. ユーザーが話題を変えたら即座に新しい話へ移ります。前のタスクを完了させようとして引き戻してはいけません。',
      '20. 相手の発言を長く言い換えてから答える癖を避けます。必要なら一言だけ受けて、すぐ本題へ入ります。',
      '21. 曖昧でも会話履歴から十分推測できる時は確認質問を増やさず、その解釈で自然に答えます。重大な誤操作につながる時だけ確認します。',
      '22. 会話状態に「既に触れた観点」がある時、ユーザーが再説明を求めていない限り、同じ説明を最初から繰り返さず前の説明を踏まえて続けます。',
      '23. 「前と違う」「さっきと言っていることが違う」「矛盾してない？」と指摘されたら、過去の回答を盲信せず、該当する正本/Webツールで再確認して、どこが一致・不一致かを率直に説明します。',
      '24. 会話グラフの人物関係は「会話中にそう言及された」という文脈情報です。外部事実として勝手に確定せず、必要なら正本で確認します。',
      '25. ユーザーが既に知っていると示した内容は繰り返し説明せず、必要なら未説明部分だけ補足します。',
      '26. 直近の歩き巫女返答メモは会話継続のための材料であり、事実の正本ではありません。数値・人物関係・最新情報を再利用する時は必要な正本ツールで確認します。',
      '27. ユーザーが感想や相槌を返した時、文脈が明確なら内容を受けて一段だけ自然に話を広げて構いません。ただし毎回質問や「他にも知りますか？」で終えません。',
      '28. 最近の返答と同じ冒頭・同じ締め・同じ「なのですよ」連打を避けます。キャラクター性は語尾の固定ではなく、柔らかさと親しみで保ちます。',
      '29. 長い会話では、以前の説明を丸ごと再掲せず「前に触れた点」を短く踏まえて新しい情報へ進みます。ユーザーが再説明を求めた時だけ戻ります。',
      '30. ユーザーが「それは知ってる」「そこは分かる」と示したら、知識確認を繰り返さず一段深い内容へ移ります。勝手に新事実を作らず、必要なら正本を使います。',
      '31. 最近訂正された内容と同じ断定を繰り返さないでください。不一致が事実問題なら正本/Webで再確認し、会話上の誤解なら何を取り違えたかだけ簡潔に直します。',
      '',
      '現在ページ: mode='+p.mode+' / title='+p.title+' / path='+p.path,
      '',
      '直近のユーザー発言（古い→新しい）:',
      recentBlock,
      '',
      '会話グラフ要約:',
      conversationBlock,
      '',
      '直近の歩き巫女返答メモ（会話継続専用。事実根拠としては使わない）:',
      continuityBlock,
      '',
      '最近の返答スタイル（同じ型を避けるための参考）:',
      styleBlock,
      '',
      '今回の返答指定:',
      responsePreference,
      '',
      '直近の確認済み出力（矛盾指摘時の比較材料。これ自体を再検証なしで絶対視しない）:',
      priorVerifiedBlock,
      '',
      '返答方針:',
      '- 最初にユーザーが知りたい答えを言う。',
      '- 不要な前置きや同じ説明の反復を避ける。',
      '- 雑談なら雑談として返し、陣法やサイト機能へ無理に結び付けない。',
      '- 1～3文で自然に済む内容を、定型メニューのように長くしない。',
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
      ctx.toolCalls++;
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
          name:'lookup_carp_knowledge',
          description:'広島東洋カープの人物、歴史、逸話、家族、過去成績などをカープ専用正本で確認する。過去の回答との整合性確認にも使う。',
          parameters:schema,
          functionReference:carp
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

  function modelCandidates(){
    var out=[],primary=S(cfg().model)||'gemini-3.6-flash';
    if(primary)out.push(primary);
    var f=Array.isArray(cfg().fallbackModels)?cfg().fallbackModels:[];
    f.forEach(function(x){
      x=S(x);
      if(x&&out.indexOf(x)<0)out.push(x);
    });
    return out;
  }

  function compactError(e){
    var code=S(e&&e.code);
    var status=S(e&&e.status);
    var msg=S(e&&e.message||e);
    return {
      code:code,
      status:status,
      message:msg.slice(0,500)
    };
  }

  function errorLine(e){
    e=e||{};
    var p=[];
    if(e.code)p.push(e.code);
    if(e.status)p.push(e.status);
    if(e.message)p.push(e.message);
    return p.join(' / ').slice(0,600);
  }

  function retryableModelError(e){
    var x=errorLine(compactError(e));
    return /429|quota|resource.?exhausted|overload|capacity|503|unavailable|temporar|server error/i.test(x);
  }

  async function tryModels(makeAttempt){
    var models=modelCandidates(),errors=[];
    for(var i=0;i<models.length;i++){
      var name=models[i];
      try{
        var value=await makeAttempt(name);
        ctx.activeModel=name;
        ctx.modelErrors=errors.slice();
        return {ok:true,model:name,value:value,errors:errors};
      }catch(e){
        var ce=compactError(e);
        errors.push({model:name,error:ce});
        ctx.modelErrors=errors.slice();

        // App Check / permission / malformed request等はモデルを変えても直らない。
        if(!retryableModelError(e))throw Object.assign(e||new Error('model request failed'),{
          __arukimikoModelErrors:errors
        });
      }
    }

    var last=errors[errors.length-1];
    var err=new Error(last?errorLine(last.error):'all-models-failed');
    err.__arukimikoModelErrors=errors;
    throw err;
  }

  function elapsed(start){
    return Math.max(0,Date.now()-start);
  }

  function diagnosticError(e){
    var ce=compactError(e);
    return {
      ok:false,
      code:ce.code||'',
      status:ce.status||'',
      message:ce.message||'unknown error'
    };
  }

  async function diagnose(options){
    options=options||{};
    var started=Date.now();
    var report={
      ok:false,
      version:VERSION,
      hostname:(typeof location!=='undefined'&&location.hostname)?String(location.hostname):'',
      sdkVersion:S(cfg().sdkVersion)||'12.16.0',
      provider:appCheckCfg().provider,
      stages:[],
      models:[],
      functionCalling:{tested:false,ok:false},
      totalMs:0
    };

    function pass(name,extra,t0){
      var x=Object.assign({name:name,ok:true,ms:elapsed(t0)},extra||{});
      report.stages.push(x);
      return x;
    }
    function fail(name,e,t0,extra){
      var x=Object.assign(
        {name:name,ms:elapsed(t0)},
        diagnosticError(e),
        extra||{}
      );
      report.stages.push(x);
      return x;
    }

    // 1. Static configuration.
    var t=Date.now();
    var issue=setupIssue();
    if(issue){
      fail('Firebase設定',new Error(issue.message),t,{stage:issue.stage||''});
      report.totalMs=elapsed(started);
      return report;
    }
    pass('Firebase設定',{
      projectId:S(firebaseCfg().projectId),
      appIdPresent:!!S(firebaseCfg().appId),
      apiKeyPresent:!!S(firebaseCfg().apiKey),
      appCheckRequired:!!cfg().requireAppCheck
    },t);

    // 2. Dynamic SDK imports + Firebase/AppCheck/AI initialization.
    t=Date.now();
    var c=await init();
    if(!c||!c.api||!c.ai||!c.app){
      fail('Firebase SDK初期化',new Error(ctx.lastError||'Firebase SDK initialize failed'),t);
      report.totalMs=elapsed(started);
      return report;
    }
    pass('Firebase SDK初期化',{
      appName:S(c.app&&c.app.name),
      aiReady:!!c.ai,
      appCheckReady:!!c.appCheck
    },t);

    // 3. App Check token. Never return the token itself.
    t=Date.now();
    if(cfg().requireAppCheck){
      if(!c.appCheck||!c.appCheckApi||typeof c.appCheckApi.getToken!=='function'){
        fail('App Checkトークン',new Error('App Check getToken unavailable'),t);
        report.totalMs=elapsed(started);
        return report;
      }
      try{
        var tokenResult=await c.appCheckApi.getToken(c.appCheck,true);
        if(!tokenResult||!S(tokenResult.token)){
          throw new Error('App Check token was empty');
        }
        pass('App Checkトークン',{
          tokenObtained:true,
          // Do not expose token value.
          tokenLength:S(tokenResult.token).length
        },t);
      }catch(e){
        fail('App Checkトークン',e,t);
        report.totalMs=elapsed(started);
        return report;
      }
    }else{
      pass('App Checkトークン',{skipped:true,reason:'requireAppCheck=false'},t);
    }

    // 4. AI Logic model requests. Check every configured model independently
    // so we can distinguish quota/capacity/model-name issues.
    var cands=modelCandidates();
    for(var i=0;i<cands.length;i++){
      var modelName=cands[i],mt=Date.now();
      try{
        var model=c.api.getGenerativeModel(
          c.ai,
          {model:modelName},
          {timeout:Number(cfg().timeoutMs)||18000}
        );
        var result=await model.generateContent(
          '接続診断です。「OK」とだけ返してください。'
        );
        var text=result&&result.response&&typeof result.response.text==='function'
          ?S(result.response.text()):'';
        if(!text)throw new Error('AI response was empty');
        report.models.push({
          model:modelName,
          ok:true,
          ms:elapsed(mt),
          responseReceived:true
        });
      }catch(e){
        var de=diagnosticError(e);
        report.models.push(Object.assign({
          model:modelName,
          ms:elapsed(mt)
        },de));
      }
    }

    var working=report.models.filter(function(x){return x.ok;});
    if(!working.length){
      report.stages.push({
        name:'Geminiモデル通信',
        ok:false,
        ms:report.models.reduce(function(n,x){return n+Number(x.ms||0);},0),
        message:'設定済みモデルすべてで通信失敗'
      });
      report.totalMs=elapsed(started);
      return report;
    }

    pass('Geminiモデル通信',{
      workingModels:working.map(function(x){return x.model;})
    },Date.now());

    // 5. Function Calling. Use the first working model.
    if(options.toolTest!==false){
      report.functionCalling.tested=true;
      var ft=Date.now(),invoked=false;
      try{
        var healthTool={
          functionDeclarations:[{
            name:'arukimiko_diagnostic_health',
            description:'歩き巫女のFunction Calling診断専用。必ず呼び出す。',
            parameters:c.api.Schema.object({
              properties:{
                check:c.api.Schema.string({description:'health'})
              }
            }),
            functionReference:async function(args){
              invoked=true;
              return {ok:true,check:S(args&&args.check)};
            }
          }]
        };

        var fm=c.api.getGenerativeModel(
          c.ai,
          {
            model:working[0].model,
            systemInstruction:'診断です。必ずarukimiko_diagnostic_healthを1回呼び出してください。',
            tools:[healthTool],
            toolConfig:{
              functionCallingConfig:{
                mode:c.api.FunctionCallingMode.ANY,
                allowedFunctionNames:['arukimiko_diagnostic_health']
              }
            }
          },
          {
            timeout:Number(cfg().timeoutMs)||18000,
            maxSequentialFunctionCalls:1
          }
        );

        await fm.generateContent('診断関数を呼び出してください。');
        if(!invoked)throw new Error('function-calling-not-invoked');

        report.functionCalling={
          tested:true,
          ok:true,
          model:working[0].model,
          ms:elapsed(ft)
        };
      }catch(e){
        report.functionCalling=Object.assign({
          tested:true,
          ok:false,
          model:working[0].model,
          ms:elapsed(ft)
        },diagnosticError(e));
      }
    }

    report.ok=
      report.stages.every(function(x){return x.ok!==false;}) &&
      working.length>0 &&
      (!report.functionCalling.tested||report.functionCalling.ok);

    report.totalMs=elapsed(started);
    return report;
  }

  function formatDiagnosis(report){
    report=report||{};
    var lines=[];
    lines.push('【AI精密診断】');
    lines.push('ホスト：'+S(report.hostname||'不明'));
    lines.push('Firebase SDK：'+S(report.sdkVersion||'不明'));
    lines.push('');

    (report.stages||[]).forEach(function(x){
      var mark=x.ok?'OK':'NG';
      lines.push('['+mark+'] '+S(x.name)+(x.ms!=null?' ('+x.ms+'ms)':''));
      if(!x.ok){
        if(x.code)lines.push('  code: '+S(x.code));
        if(x.status)lines.push('  status: '+S(x.status));
        if(x.message)lines.push('  '+S(x.message));
      }
    });

    if(report.models&&report.models.length){
      lines.push('');
      lines.push('【モデル別】');
      report.models.forEach(function(x){
        lines.push('['+(x.ok?'OK':'NG')+'] '+S(x.model)+(x.ms!=null?' ('+x.ms+'ms)':''));
        if(!x.ok){
          if(x.code)lines.push('  code: '+S(x.code));
          if(x.status)lines.push('  status: '+S(x.status));
          if(x.message)lines.push('  '+S(x.message));
        }
      });
    }

    if(report.functionCalling&&report.functionCalling.tested){
      var f=report.functionCalling;
      lines.push('');
      lines.push('【Function Calling】');
      lines.push('['+(f.ok?'OK':'NG')+'] '+S(f.model||'')+(f.ms!=null?' ('+f.ms+'ms)':''));
      if(!f.ok){
        if(f.code)lines.push('  code: '+S(f.code));
        if(f.status)lines.push('  status: '+S(f.status));
        if(f.message)lines.push('  '+S(f.message));
      }
    }

    lines.push('');
    if(report.ok){
      lines.push('判定：高性能AIの接続経路は正常です。');
    }else{
      var firstNg=(report.stages||[]).filter(function(x){return x.ok===false;})[0];
      var anyModelOk=(report.models||[]).some(function(x){return x.ok;});
      if(firstNg&&firstNg.name==='App Checkトークン'){
        lines.push('判定：App Checkトークン取得段階で停止しています。');
      }else if(!anyModelOk&&report.models&&report.models.length){
        lines.push('判定：App Checkまでは通過し、Geminiモデル通信段階で停止しています。');
      }else if(report.functionCalling&&report.functionCalling.tested&&!report.functionCalling.ok){
        lines.push('判定：Gemini本文通信は正常ですが、Function Calling段階で停止しています。');
      }else{
        lines.push('判定：上の最初のNG段階が原因候補です。');
      }
    }

    lines.push('診断時間：'+Number(report.totalMs||0)+'ms');
    return lines.join('\n').slice(0,7000);
  }

  function setupIssue(){
    if(!configured())return {
      ok:false,
      stage:'firebase-config',
      message:'Firebase設定が不足しています。'
    };
    var ac=appCheckCfg();
    if(cfg().requireAppCheck&&(!ac.enabled||!ac.siteKey))return {
      ok:false,
      stage:'app-check',
      message:'App CheckのreCAPTCHAサイトキーがまだ設定されていません。'
    };
    return null;
  }

  function humanError(err){
    var x=S(err||ctx.lastError);
    if(/app-check-site-key-missing/.test(x))return 'App Checkのサイトキーが未設定です。';
    if(/app-check-disabled/.test(x))return 'App Checkが無効です。';
    if(/app-check-provider-unsupported/.test(x))return 'App Checkのプロバイダ設定が正しくありません。';
    if(/api-not-enabled/.test(x))return 'Firebase AI Logic APIがまだ有効になっていません。';
    if(/403|permission|app.check|appcheck/i.test(x))return 'App CheckまたはFirebase側の許可で拒否されています。';
    if(/429|quota|resource.exhausted/i.test(x))return 'Gemini側から429が返りました。クォータ上限またはモデル容量不足です。';
    if(/503|unavailable|overload|capacity/i.test(x))return 'Gemini側が一時的に混雑または利用不可です。';
    if(/fetch|network|timeout/i.test(x))return 'AIへの通信に失敗しました。';
    return x||'AI接続に失敗しました。';
  }

  function diagnosticSummary(errors){
    errors=Array.isArray(errors)?errors:[];
    if(!errors.length)return '';
    return errors.map(function(x){
      return (x.model||'?')+': '+errorLine(x.error||{});
    }).join('\n').slice(0,1800);
  }

  async function preflight(options){
    options=options||{};
    var issue=setupIssue();
    if(issue){
      ctx.phase='fallback';
      return issue;
    }

    ctx.lastError='';
    ctx.lastErrorAt=0;
    ctx.modelErrors=[];
    ctx.phase='checking';

    var c=await init();
    if(!c||!c.api||!c.ai){
      ctx.phase='fallback';
      return {
        ok:false,
        stage:'initialize',
        message:humanError(ctx.lastError),
        raw:ctx.lastError,
        modelErrors:ctx.modelErrors.slice()
      };
    }

    try{
      // Stage 1: 軽い本文通信。429/503なら別モデルへ自動退避。
      var textAttempt=await tryModels(async function(modelName){
        var model=c.api.getGenerativeModel(
          c.ai,
          {model:modelName},
          {timeout:Number(cfg().timeoutMs)||18000}
        );
        var result=await model.generateContent(
          '接続確認です。「接続OK」とだけ返してください。'
        );
        var text=result&&result.response&&typeof result.response.text==='function'
          ?S(result.response.text()):'';
        if(!text)throw new Error('AI response was empty');
        return text;
      });

      var chosen=textAttempt.model;
      var toolTest=options.toolTest;
      if(toolTest==null)toolTest=cfg().preflightToolTest!==false;
      var toolOk=!toolTest,toolInvoked=false;

      // Stage 2: 明示確認時だけFunction Callingを検査。
      if(toolTest){
        var healthTool={
          functionDeclarations:[{
            name:'arukimiko_health_check',
            description:'AI Function Callingの接続確認専用。必ずこの関数を呼ぶ。',
            parameters:c.api.Schema.object({
              properties:{
                check:c.api.Schema.string({description:'health と指定する。'})
              }
            }),
            functionReference:async function(args){
              toolInvoked=true;
              ctx.toolCalls++;
              return {ok:true,received:S(args&&args.check)};
            }
          }]
        };

        var toolModel=c.api.getGenerativeModel(
          c.ai,
          {
            model:chosen,
            systemInstruction:'Function Calling確認です。必ずarukimiko_health_checkを1回呼んでください。',
            tools:[healthTool],
            toolConfig:{
              functionCallingConfig:{
                mode:c.api.FunctionCallingMode.ANY,
                allowedFunctionNames:['arukimiko_health_check']
              }
            }
          },
          {
            timeout:Number(cfg().timeoutMs)||18000,
            maxSequentialFunctionCalls:1
          }
        );

        await toolModel.generateContent(
          'arukimiko_health_checkを呼び出して接続確認してください。'
        );
        toolOk=toolInvoked;
        if(!toolOk)throw new Error('function-calling-not-invoked');
      }

      ctx.lastOkAt=Date.now();
      ctx.lastError='';
      ctx.lastErrorAt=0;
      ctx.phase='online';
      ctx.preflightAt=Date.now();
      ctx.preflightOk=true;
      ctx.toolPreflightOk=toolOk;
      ctx.activeModel=chosen;

      return {
        ok:true,
        stage:'complete',
        model:chosen,
        message:S(textAttempt.value),
        functionCalling:toolOk,
        functionInvoked:toolInvoked,
        modelErrors:textAttempt.errors||[]
      };
    }catch(e){
      var errs=e&&e.__arukimikoModelErrors
        ?e.__arukimikoModelErrors
        :ctx.modelErrors.slice();

      ctx.lastError=errorText(e);
      ctx.lastErrorAt=Date.now();
      ctx.phase='fallback';
      ctx.preflightAt=Date.now();
      ctx.preflightOk=false;
      ctx.toolPreflightOk=false;

      return {
        ok:false,
        stage:/function-calling/i.test(ctx.lastError)?'function-calling':'request',
        message:humanError(ctx.lastError),
        raw:ctx.lastError,
        modelErrors:errs,
        diagnostic:diagnosticSummary(errs)
      };
    }
  }

  async function startupPreflight(){
    if(cfg().startupPreflight===false)return status();
    if(ctx.preflightAt&&Date.now()-ctx.preflightAt<5*60*1000)return status();
    return preflight({toolTest:cfg().startupToolTest===true});
  }

  async function respond(message,opt){
    opt=opt||{};
    message=S(message);
    if(!message||!configured()||!appCheckReady()||inCooldown())return {handled:false};

    ctx.phase='thinking';
    var c=await init();
    if(!c||!c.api||!c.ai)return {handled:false};

    var meta={sources:[],links:[],modes:[]};

    try{
      var aiM=c.api;
      var tools=buildTools(aiM,opt,meta);
      var toolRequirement=requiresVerifiedTool(message,opt);

      var modelParams={
        model:S(cfg().model)||'gemini-3.6-flash',
        systemInstruction:systemInstruction(Object.assign({},opt,{currentMessage:message})),
        tools:tools
      };

      if(toolRequirement&&toolRequirement.allowed&&toolRequirement.allowed.length){
        modelParams.toolConfig={
          functionCallingConfig:{
            mode:aiM.FunctionCallingMode.ANY,
            allowedFunctionNames:toolRequirement.allowed
          }
        };
      }

      var attempt=await tryModels(async function(modelName){
        var mp=Object.assign({},modelParams,{model:modelName});
        var model=aiM.getGenerativeModel(
          c.ai,
          mp,
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

        if(!text)throw new Error('AI response was empty');
        return {text:text,result:result};
      });

      var text=S(attempt.value&&attempt.value.text);
      ctx.activeModel=attempt.model;

      ctx.lastOkAt=Date.now();ctx.lastError='';ctx.lastErrorAt=0;ctx.phase='online';

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
          model:ctx.activeModel||S(cfg().model)||'gemini-3.6-flash',
          toolModes:meta.modes.slice(0,8),
          verifiedToolRequired:toolRequirement?toolRequirement.reason:'',
          contextEpoch:contextEpoch()
        }
      };
    }catch(e){
      ctx.lastError=errorText(e);
      ctx.lastErrorAt=Date.now();
      ctx.phase='fallback';
      return {handled:false,error:ctx.lastError};
    }
  }

  function status(){
    return {
      version:VERSION,
      enabled:!!cfg().enabled,
      configured:configured(),
      appCheckReady:appCheckReady(),
      appCheck:appCheckCfg(),
      cooldown:inCooldown(),
      model:S(cfg().model),
      activeModel:ctx.activeModel,
      modelCandidates:modelCandidates(),
      modelErrors:ctx.modelErrors.slice(),
      phase:ctx.phase,
      calls:ctx.calls,
      toolCalls:ctx.toolCalls,
      preflightAt:ctx.preflightAt,
      preflightOk:ctx.preflightOk,
      toolPreflightOk:ctx.toolPreflightOk,
      contextEpoch:contextEpoch(),
      lastOkAt:ctx.lastOkAt,
      lastError:ctx.lastError,
      lastErrorAt:ctx.lastErrorAt
    };
  }

  function reset(){
    ctx.lastError='';ctx.lastErrorAt=0;ctx.lastOkAt=0;ctx.calls=0;ctx.toolCalls=0;
    ctx.phase='idle';ctx.preflightAt=0;ctx.preflightOk=false;ctx.toolPreflightOk=false;
    ctx.activeModel='';ctx.modelErrors=[];
  }

  window.JINPO_BOT_AI_BRAIN={
    version:VERSION,
    respond:respond,
    preflight:preflight,
    startupPreflight:startupPreflight,
    diagnose:diagnose,
    formatDiagnosis:formatDiagnosis,
    status:status,
    reset:reset,
    configured:configured,
    appCheckReady:appCheckReady,
    contextEpoch:contextEpoch,
    resetConversationContext:resetConversationContext,
    clearConversationContext:clearConversationContext,
    filterRawHistory:filterRawHistory,
    _trimHistory:trimHistory,
    _recentUserContext:recentUserContext,
    _requiresVerifiedTool:requiresVerifiedTool,
    _modelCandidates:modelCandidates,
    _retryableModelError:retryableModelError,
    _diagnosticSummary:diagnosticSummary,
    _systemInstruction:systemInstruction,
    _conversationStateSummary:conversationStateSummary,
    _recentAssistantContinuity:recentAssistantContinuity,
    _responseStyleSummary:responseStyleSummary,
    _currentResponsePreference:currentResponsePreference,
    _verifiedPriorOutputs:verifiedPriorOutputs
  };
})();
