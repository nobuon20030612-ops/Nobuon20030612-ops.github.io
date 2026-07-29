/*
 * 歩き巫女 AI会話脳 v2.9.0
 *
 * Firebase AI Logic / Gemini を「頭脳」にする。
 * 正確な数値・最新情報・サイト操作は Function Calling で既存の正本/機能を使う。
 * AIが利用できない時は既存ローカルエンジンへ自動フォールバック。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_AI_BRAIN)return;

  var VERSION='2.9.0';
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

    // 「そうかな？」「それは違うと思う」のような短い異議でも、直前が正本/最新情報の回答なら再確認する。
    // 意見への反論まで検索へ変えないよう、直前assistantのmodeが検証済み系の時だけ発動する。
    try{
      var convStance=window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.conversationalStance==='function'
        ?window.JINPO_BOT_CONVERSATION.conversationalStance(history||[],t):null;
      if(convStance&&/^(?:skepticism|disagreement|correction)$/.test(convStance.type||'')){
        var hh=filterRawHistory(history||[]),lastMode='';
        for(var hi=hh.length-1;hi>=0;hi--){
          var hx=hh[hi]||{};if(hx.role!=='assistant'||!S(hx.text))continue;
          lastMode=S(hx.meta&&hx.meta.mode||'');break;
        }
        if(/カープ専用正本知識|カープ公式情報|カープ公式日付情報|カープ公式選手情報|カープ公式順位|カープ最新Web|カープWeb調査/.test(lastMode))
          return {reason:'stance-recheck-carp',allowed:['lookup_carp_knowledge','lookup_carp_current']};
        if(/たいらの野望専用知識/.test(lastMode))
          return {reason:'stance-recheck-tairano',allowed:['lookup_tairano_knowledge']};
        if(/たいらの野望ツール実データ|九十九|鬼神石|魔導結晶/.test(lastMode))
          return {reason:'stance-recheck-tool-data',allowed:['lookup_game_tool_data']};
        if(/天気|リアルタイムWeb自動参照|無料公開Web自動参照/.test(lastMode))
          return {reason:'stance-recheck-realtime',allowed:['lookup_web_or_weather']};
      }
    }catch(stanceVerifyErr){}

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
    var openings=[],endings=[],nano=0,questionEnds=0,genericInvites=0;
    answers.forEach(function(t){
      var first=t.split(/[。！？!?]/)[0].slice(0,42);if(first&&openings.indexOf(first)<0)openings.push(first);
      var parts=t.split(/[。！？!?]/).filter(Boolean);var last=parts.length?parts[parts.length-1].slice(-42):'';
      if(last&&endings.indexOf(last)<0)endings.push(last);
      nano+=(t.match(/なのです(?:よ)?/g)||[]).length;
      if(/[？?]\s*$/.test(t))questionEnds++;
      if(/(?:気になったら|気になるところ|他にも|ほかにも|何でも|そのままどうぞ|言ってください|聞いてください|話してください)/.test(t))genericInvites++;
    });
    return '最近の冒頭: '+openings.slice(0,4).join(' / ')+'\n最近の締め: '+endings.slice(0,4).join(' / ')+'\n「なのです」系の使用回数: '+nano+'\n質問で終えた回数: '+questionEnds+' / 汎用的な誘い文句: '+genericInvites;
  }

  function conversationalFocusSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.conversationalFocus!=='function')return'（会話の焦点信号なし）';
    try{
      var f=conv.conversationalFocus(history||[],currentMessage||'')||{};
      var flow={answer:'質問・依頼へ答える',yield:'ユーザーが話を続ける余地を残す',reflect:'具体的一点を受ける',expand:'質問せず一段だけ内容を広げてもよい',close:'この話を閉じる',respond:'通常応答'}[f.flow]||'通常応答';
      var ask={none:'追加質問はしない',prefer_statement:'質問より関連する一言・視点を優先',optional:'質問は自然な時だけ'}[f.askPolicy]||'質問は自然な時だけ';
      var point=S(f.concreteText||f.text||'').slice(0,120);
      return '観測できる主な焦点: '+(point||'（特定なし）')+' / 確度='+(f.confidence||'low')+' / 流れ='+flow+' / '+ask+(f.narrativeMomentum?' / 話の続きがありそうな形':'');
    }catch(e){return'（会話の焦点信号の取得に失敗）';}
  }

  function conversationalStanceSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.conversationalStance!=='function')return'（同意・反論信号なし）';
    try{
      var x=conv.conversationalStance(history||[],currentMessage||'')||{};
      var label={agreement:'同意・納得',partial_agreement:'一部は同意しつつ留保あり',skepticism:'疑い・保留',disagreement:'反対・異なる見方',correction:'前の解釈への訂正',neutral:'明示的な立場なし'}[x.type]||'明示的な立場なし';
      return '今回の立場信号: '+label+' / 確度='+(x.confidence||'low')+'. 同意と反論を取り違えず、反論時は前の説明を押し通さない。';
    }catch(e){return'（同意・反論信号の取得に失敗）';}
  }

  function followupGuidance(history,currentMessage){
    var h=filterRawHistory(history),cur=S(currentMessage),recentQuestions=0,recentInvites=0,seen=0;
    if(h.length&&h[h.length-1]&&h[h.length-1].role==='user'&&S(h[h.length-1].text)===cur)h.pop();
    for(var i=h.length-1;i>=0&&seen<4;i--){
      var x=h[i]||{},t=S(x.text);if(x.role!=='assistant'||!t)continue;seen++;
      if(/[？?]\s*$/.test(t))recentQuestions++;
      if(/(?:他にも|ほかにも|気になったら|言ってください|聞いてください|話してください)/.test(t))recentInvites++;
    }
    var ls=null,focus=null,stance=null,conv=window.JINPO_BOT_CONVERSATION;
    try{if(conv&&typeof conv.listeningSignals==='function')ls=conv.listeningSignals(history||[],cur)||null;}catch(e){}
    try{if(conv&&typeof conv.conversationalFocus==='function')focus=conv.conversationalFocus(history||[],cur)||null;}catch(e2){}
    try{if(conv&&typeof conv.conversationalStance==='function')stance=conv.conversationalStance(history||[],cur)||null;}catch(e3){}
    if(focus&&focus.unfinishedThought)return'発言が「けど…」「でも…」など未完の形です。続きを勝手に補完せず、短く受けて発話権をユーザーへ残す。';
    if(stance&&stance.type==='correction')return'前の解釈への訂正です。防御的にならず、古い解釈を押し通さず、ユーザーが今示した修正を優先する。';
    if(stance&&(stance.type==='disagreement'||stance.type==='skepticism'))return'同意として処理しない。反論・疑問の対象になっている点へ直接応じ、事実問題なら必要に応じて正本で確認する。質問攻めにはしない。';
    if(stance&&stance.type==='partial_agreement')return'全面同意へ丸めない。同意している部分と留保している部分を分け、留保側を無視しない。';
    if(ls&&ls.openness==='closed')return'この話を勝手に深掘りしない。短く受けて閉じる。';
    if(focus&&focus.flow==='yield')return'ユーザー側に話の主導権があります。焦点の具体的一点だけ短く受け、質問や結論で割り込まず続きを待つ。';
    if(recentQuestions>=2)return'直近で質問終わりが続いているため、今回は追加質問を避け、内容への反応か答えで終える。';
    if(ls&&ls.mode==='listen_only'&&ls.openness==='open')return'続きを話したそうなので、短く受けて待つ。質問するなら一つだけで、先回りしない。';
    if(ls&&(ls.mode==='venting'||ls.mode==='mixed_sharing'))return'まず出来事の具体的一点を受ける。助言を求められていなければ質問や解決策を足さなくてよい。';
    if(ls&&ls.mode==='celebration')return'一緒に喜ぶことを優先。分析へ逸れず、自然なら焦点に関係する一言だけ添える。';
    if(focus&&focus.flow==='expand')return'関心が続いている話題です。質問で返すより、今回の焦点に直接つながる一段深い事実・視点・短い補足を一つだけ添えるのを優先する。';
    if(focus&&focus.flow==='reflect'&&focus.confidence==='high')return'共有の中で強く出ている具体的一点へ反応する。全文要約や汎用質問ではなく、その一点に沿った一言を返す。';
    if(cur.length>=70&&!/[？?]/.test(cur))return'長めの共有なので全文要約はせず、一番印象的な一点だけ拾う。深掘り質問は多くても一つ。';
    if(recentInvites>=2)return'汎用的な「他にも」誘導は避け、内容そのものだけでつなぐ。';
    return'自然な会話なら質問なしで終えてよい。深掘りする場合も一度に一つだけ。';
  }

  function initiativeBalanceSummary(history,currentMessage){
    var h=filterRawHistory(history),cur=S(currentMessage),as=[],us=[];
    if(h.length&&h[h.length-1]&&h[h.length-1].role==='user'&&S(h[h.length-1].text)===cur)h.pop();
    for(var i=h.length-1;i>=0&&(as.length<4||us.length<4);i--){
      var x=h[i]||{},t=S(x.text);if(!t)continue;
      if(x.role==='assistant'&&as.length<4)as.push(t);
      else if(x.role==='user'&&us.length<4)us.push(t);
    }
    function avg(list){return list.length?Math.round(list.reduce(function(a,b){return a+b.length;},0)/list.length):0;}
    var aa=avg(as),ua=avg(us),longA=as.filter(function(t){return t.length>=120;}).length,lead=as.filter(function(t){return /^(?:ちなみに|さらに|もう一つ|それと|関連して)/.test(t)||/(?:他にも|ほかにも).*?(?:あります|できます|見られます)/.test(t);}).length;
    var conv=window.JINPO_BOT_CONVERSATION,focus=null;
    try{if(conv&&typeof conv.conversationalFocus==='function')focus=conv.conversationalFocus(history||[],cur)||null;}catch(e){}
    if(focus&&(focus.flow==='answer'||focus.flow==='yield'||focus.flow==='close'))return'今回の依頼・会話の流れを優先。歩き巫女側から新しい話題を増やさない。';
    if(as.length>=2&&longA>=2&&ua>0&&aa>=Math.max(100,ua*2.6))return'直近は歩き巫女側の説明量が多めです。今回は短めに返し、ユーザー側へ会話の余白を戻す。';
    if(lead>=2)return'直近で歩き巫女側から話を広げる動きが続いています。今回は新しい枝を増やさず、現在の焦点だけに反応する。';
    return'会話の主導権は固定しない。ユーザーが話を広げている時は追従し、必要な時だけ一段広げる。';
  }

  function currentResponsePreference(message){
    var t=S(message),out=[];
    if(/短く|簡潔|簡単に|要点だけ|一言で/.test(t))out.push('今回は短く要点優先');
    if(/詳しく|深く|細かく|徹底的|全部/.test(t))out.push('今回は十分に詳しく');
    if(/例(?:も|を)|具体例|たとえば|例えば/.test(t))out.push('具体例を含める');
    if(/結論から|先に結論/.test(t))out.push('結論を先に置く');
    return out.length?out.join(' / '):'（明示指定なし）';
  }

  function interactionStyleSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.interactionStyle!=='function')return'（会話テンポ信号なし）';
    try{
      var st=conv.interactionStyle(history||[],currentMessage||'')||{};
      var pace=st.pace==='terse'?'短文テンポ':st.pace==='elaborate'?'しっかり説明するテンポ':'標準テンポ';
      var reg=st.register==='casual'?'ややくだけた話し方':st.register==='polite'?'丁寧な話し方':'中立的な話し方';
      var en=st.energy==='lively'?'反応はやや活発':st.energy==='calm'?'落ち着いた反応':'通常の反応量';
      var shift=st.topicShift?' / 今回は明示的な話題転換':' ';
      return 'ユーザーの現在の会話テンポ: '+pace+' / '+reg+' / '+en+' / 平均'+Number(st.avgLength||0)+'文字'+shift;
    }catch(e){return'（会話テンポ信号の取得に失敗）';}
  }

  function listeningStyleSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.listeningSignals!=='function')return'（聞き方信号なし）';
    try{
      var x=conv.listeningSignals(history||[],currentMessage||'')||{};
      var need={listen:'解決策ではなく、まず話を受け止めてほしい',advice:'具体的な助言・一緒に考えることを求めている',opinion:'歩き巫女の意見を求めている',respond:'特別な返答形式の指定なし'}[x.need]||'特別な返答形式の指定なし';
      var mode={listen_only:'聞いてほしい共有',advice:'相談',opinion_request:'意見要求',celebration:'うれしい出来事の共有',mixed_sharing:'良い面としんどい面が混じる共有',venting:'しんどい・不満な出来事の共有',uncertain:'迷い・不確かさの共有',sharing:'出来事の共有',conversation:'通常会話'}[x.mode]||'通常会話';
      var val={positive:'前向きな反応',negative:'つらさ・不満が明示されている',mixed:'良い面と悪い面が混在',neutral:'感情方向は明示されていない'}[x.valence]||'中立';
      var open={open:'話を続けたい合図あり',closed:'この話を閉じたい合図あり',neutral:'話の続行可否は未指定'}[x.openness]||'未指定';
      return '受け方: '+mode+' / 希望: '+need+' / 発言上の感情信号: '+val+' / '+open+' / 強さ='+(x.intensity||'normal')+(x.avoidAdvice?' / 頼まれていない助言は避ける':'');
    }catch(e){return'（聞き方信号の取得に失敗）';}
  }

  function pragmaticToneSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.pragmaticTone!=='function')return'（冗談・本気信号なし）';
    try{
      var x=conv.pragmaticTone(history||[],currentMessage||'')||{};
      var label={joke:'冗談だと明示されている',serious:'本気・真面目な話だと明示されている',possible_irony:'軽い皮肉の可能性あり（断定禁止）',playful:'軽い笑い・遊びの合図あり',neutral:'明示的な冗談/本気信号なし'}[x.type]||'明示信号なし';
      return label+' / 確度='+(x.confidence||'low');
    }catch(e){return'（冗談・本気信号の取得に失敗）';}
  }

  function repairSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.utteranceRepair!=='function')return'（言い直し・補足信号なし）';
    try{
      var x=conv.utteranceRepair(history||[],currentMessage||'')||{};
      var label={correction:'前の内容を訂正している。古い内容を押し通さない',rephrase:'同じ意図を言い換えている。前の文脈は保持する',supplement:'前の内容への補足。前の内容を取り消さない',none:'訂正・言い換え・補足の明示なし'}[x.type]||'明示なし';
      return label;
    }catch(e){return'（言い直し・補足信号の取得に失敗）';}
  }


  function humorPolicySummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.humorResponsePolicy!=='function')return'（冗談返し強度の信号なし）';
    try{
      var x=conv.humorResponsePolicy(history||[],currentMessage||'')||{};
      var label={none:'冗談で返さない',ack:'軽く受けるだけ',light:'軽いユーモアまで',playful:'少し遊びのある返し可'}[x.mode]||'冗談で返さない';
      return '返しの強度: '+label+' / 理由='+(x.reason||'none')+'. ユーザーより強い冗談へ勝手にエスカレートしない。';
    }catch(e){return'（冗談返し強度の取得に失敗）';}
  }

  function continuitySignalSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.continuitySignal!=='function')return'（長期一貫性の更新信号なし）';
    try{
      var x=conv.continuitySignal(history||[],currentMessage||'')||{};
      var label={user_revision:'ユーザー自身が以前の考え・選択を更新した',temporal_update:'時間経過による状態更新',assistant_conflict:'歩き巫女の過去回答との食い違い指摘',none:'明示的な更新・矛盾信号なし'}[x.type]||'明示信号なし';
      return '一貫性信号: '+label+(x.latestWins?' / 最新のユーザー発言を優先':'')+'.';
    }catch(e){return'（長期一貫性信号の取得に失敗）';}
  }

  function conversationHookSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.conversationHooks!=='function')return'（未回収の会話伏線なし）';
    try{
      var list=conv.conversationHooks(history||[],currentMessage||'')||[];
      if(!list.length)return'（未回収の会話伏線なし）';
      return list.slice(-3).reverse().map(function(x){return (x.message||x.sourceText||'').slice(0,120);}).join(' / ');
    }catch(e){return'（会話伏線の取得に失敗）';}
  }

  function parallelTopicSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.parallelTopics!=='function')return'（明示的な並行話題なし）';
    try{
      var list=conv.parallelTopics(history||[],currentMessage||'')||[];
      if(!list.length)return'（明示的な並行話題なし）';
      return list.map(function(x){return x.subject||x.message;}).filter(Boolean).join(' / ');
    }catch(e){return'（並行話題の取得に失敗）';}
  }

  function deferredTopicSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.deferredTopics!=='function')return'（保留中の話題なし）';
    try{
      var list=conv.deferredTopics(history||[],currentMessage||'')||[];
      if(!list.length)return'（保留中の話題なし）';
      return list.slice().reverse().slice(0,4).map(function(x,i){return (i+1)+'. '+S(x.message||x.sourceText);}).join('\n');
    }catch(e){return'（保留話題の取得に失敗）';}
  }

  function planMemorySummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.planMemory!=='function')return'（会話中に明示された予定・約束なし）';
    try{
      var list=(typeof conv.planLedger==='function'?conv.planLedger(history||[],currentMessage||''):conv.planMemory(history||[],currentMessage||''))||[];
      var recall=typeof conv.recallPlan==='function'?conv.recallPlan(history||[],currentMessage||''):null;
      var labels={active:'未完了',completed:'完了',cancelled:'取消',postponed:'延期'};
      var lines=list.slice(-6).reverse().map(function(x,i){return (i+1)+'. '+S(x.text)+(x.time?' / 時間表現='+x.time:'')+' / 状態='+(labels[x.status]||'未完了');});
      if(!lines.length)lines=['（会話中に明示された予定・約束なし）'];
      if(recall&&recall.found&&recall.plan)lines.push('今回の予定参照候補: '+S(recall.plan.text)+' / 状態='+(labels[recall.plan.status]||'未完了'));
      return lines.join('\n');
    }catch(e){return'（予定・約束記憶の取得に失敗）';}
  }

  function positionMemorySummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.positionMemory!=='function')return'（明示された現在の選択・好みなし）';
    try{
      var list=conv.positionMemory(history||[],currentMessage||'')||[];
      var active=list.filter(function(x){return x&&x.status==='active';}).slice(-5).reverse();
      var old=list.filter(function(x){return x&&x.status==='replaced';}).slice(-3).reverse();
      var lines=[];
      active.forEach(function(x){lines.push('現在: '+(x.kind==='decision'?'選択':'好み')+' / 「'+S(x.text).slice(0,220)+'」');});
      old.forEach(function(x){lines.push('過去扱い: '+(x.kind==='decision'?'選択':'好み')+' / 「'+S(x.text).slice(0,180)+'」');});
      if(!lines.length)return'（明示された現在の選択・好みなし）';
      var recall=typeof conv.recallPosition==='function'?conv.recallPosition(history||[],currentMessage||''):null;
      if(recall&&recall.found&&recall.position)lines.push('今回の参照候補: 「'+S(recall.position.text).slice(0,220)+'」');
      return lines.join('\n');
    }catch(e){return'（選択・好み記憶の取得に失敗）';}
  }

  function priorStatementSummary(history,currentMessage){
    var conv=window.JINPO_BOT_CONVERSATION;
    if(!conv||typeof conv.priorStatementReference!=='function')return'（過去発言への明示参照なし）';
    try{
      var x=conv.priorStatementReference(history||[],currentMessage||'');
      if(!x)return'（過去発言への明示参照なし）';
      if(!x.found)return'過去発言を参照しているが、現在の会話履歴には一致する発言を確認できない。言ったことにしない。';
      return '履歴で確認できた'+(x.speaker==='user'?'ユーザー':'歩き巫女')+'発言: 「'+S(x.match).slice(0,500)+'」';
    }catch(e){return'（過去発言参照の確認に失敗）';}
  }

  function currentTurnMode(message,history){
    var t=S(message);
    if(!t)return'conversation';
    var conv=window.JINPO_BOT_CONVERSATION;
    try{
      if(conv&&typeof conv.isMemoryRetractionCue==='function'&&conv.isMemoryRetractionCue(t))return'memory_retraction';
      if(conv&&typeof conv.isPlanRecallCue==='function'&&conv.isPlanRecallCue(t))return'plan_recall';
      if(conv&&typeof conv.isPositionRecallCue==='function'&&conv.isPositionRecallCue(t))return'position_recall';
      if(conv&&typeof conv.priorStatementReference==='function'&&conv.priorStatementReference(history||[],t))return'prior_statement';
      if(conv&&typeof conv.isGeneralResumeCue==='function'&&conv.isGeneralResumeCue(t))return'resume_topic';
    }catch(memoryModeErr){}
    try{
      if(conv&&typeof conv.pragmaticTone==='function'){
        var pt=conv.pragmaticTone(history||[],t)||{};
        if(pt.type==='joke')return'joke';
        if(pt.type==='possible_irony')return'possible_irony';
        if(pt.type==='serious')return'serious';
      }
      if(conv&&typeof conv.utteranceRepair==='function'){
        var ur=conv.utteranceRepair(history||[],t)||{};
        if(ur.type==='rephrase')return'rephrase';
        if(ur.type==='supplement')return'supplement';
      }
    }catch(pragmaticErr){}
    try{
      if(conv&&typeof conv.listeningSignals==='function'){
        var ls=conv.listeningSignals(history||[],t)||{};
        if(ls.mode==='listen_only')return'listen_only';
        if(ls.mode==='advice')return'advice_request';
        if(ls.mode==='opinion_request')return'opinion_request';
        if(ls.mode==='celebration')return'celebration';
        if(ls.mode==='mixed_sharing')return'mixed_sharing';
        if(ls.mode==='venting')return'venting';
        if(ls.mode==='uncertain')return'uncertain';
        if(ls.mode==='sharing')return'sharing';
      }
    }catch(e){}
    try{
      if(conv&&typeof conv.conversationalStance==='function'){
        var cs=conv.conversationalStance(history||[],t)||{};
        if(cs.type==='correction')return'correction';
        if(cs.type==='disagreement')return'disagreement';
        if(cs.type==='skepticism')return'skepticism';
        if(cs.type==='partial_agreement')return'partial_agreement';
        if(cs.type==='agreement')return'agreement';
      }
    }catch(e2){}
    if(/(?:どうしたら|どうすれば|どうするのがいい|アドバイス(?:して|ください|ほしい|欲しい|ある|お願い)|相談したい|相談乗って|助けて|意見(?:を)?聞きたい)/.test(t))return'advice_request';
    if(/^(?:なるほど|そうなんだ|そっか|へえ|へー|ほう|了解|わかった|分かった|いいね|面白い|おもしろい|すごい|まじか|マジか)[。！!？?]*$/.test(t))return'reaction';
    if(/[？?]/.test(t)||/(?:教えて|知りたい|何|なに|誰|だれ|どこ|いつ|なぜ|なんで|どうして|どうなの|どっち|いくら|何位|何番)/.test(t))return'question';
    if(/(?:と思う|気がする|好き|嫌い|いいと思|微妙|面白い|おもしろい|すごい|やばい|懐かしい|うれしい|嬉しい)/.test(t))return'opinion';
    if(/(?:今日|昨日|きのう|さっき|この前|先週|最近).*(?:した|してた|してて|てた|てて|てたら|だった|あった|起きた|言われた|なった)|(?:したんだ|だったんだ|あったんだ|してたんだ|てたんだ)(?:よ|けど|けどさ)?[。！!]*$/.test(t))return'sharing';
    return'conversation';
  }

  function turnModeSummary(message,history){
    var m=currentTurnMode(message,history),labels={memory_retraction:'直前に明言した会話記憶を現在扱いから外したい',plan_recall:'以前に自分が話した予定・約束の確認',position_recall:'以前に自分が明言した選択・好みの確認',prior_statement:'以前の発言内容を履歴と照合している',resume_topic:'以前の具体的な話題の続きを再開したい',joke:'冗談として明示された発言',possible_irony:'軽い皮肉の可能性がある発言',serious:'本気・真面目だと明示された発言',rephrase:'前の意図の言い換え',supplement:'前の内容への補足',listen_only:'解決策より、まず聞いてほしい共有',advice_request:'相談・助言を求めている',opinion_request:'歩き巫女の意見を求めている',celebration:'うれしい出来事の共有',mixed_sharing:'良い面としんどい面が混じる共有',venting:'しんどさ・不満の共有',uncertain:'迷い・不確かさの共有',agreement:'同意・納得',partial_agreement:'一部同意＋留保',skepticism:'疑い・保留',disagreement:'反対・異なる見方',correction:'前の解釈への訂正',reaction:'相槌・反応',question:'質問・情報要求',opinion:'感想・意見の共有',sharing:'出来事の共有',conversation:'通常の会話'};
    return labels[m]||labels.conversation;
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
    var interactionBlock=interactionStyleSummary(opt.history||[],opt.currentMessage||'');
    var listeningBlock=listeningStyleSummary(opt.history||[],opt.currentMessage||'');
    var focusBlock=conversationalFocusSummary(opt.history||[],opt.currentMessage||'');
    var stanceBlock=conversationalStanceSummary(opt.history||[],opt.currentMessage||'');
    var pragmaticBlock=pragmaticToneSummary(opt.history||[],opt.currentMessage||'');
    var humorBlock=humorPolicySummary(opt.history||[],opt.currentMessage||'');
    var continuitySignalBlock=continuitySignalSummary(opt.history||[],opt.currentMessage||'');
    var repairBlock=repairSummary(opt.history||[],opt.currentMessage||'');
    var hookBlock=conversationHookSummary(opt.history||[],opt.currentMessage||'');
    var parallelBlock=parallelTopicSummary(opt.history||[],opt.currentMessage||'');
    var deferredBlock=deferredTopicSummary(opt.history||[],opt.currentMessage||'');
    var planBlock=planMemorySummary(opt.history||[],opt.currentMessage||'');
    var positionBlock=positionMemorySummary(opt.history||[],opt.currentMessage||'');
    var priorStatementBlock=priorStatementSummary(opt.history||[],opt.currentMessage||'');
    var followupBlock=followupGuidance(opt.history||[],opt.currentMessage||'');
    var initiativeBlock=initiativeBalanceSummary(opt.history||[],opt.currentMessage||'');
    var turnModeBlock=turnModeSummary(opt.currentMessage||'',opt.history||[]);
    var responsePreference=currentResponsePreference(opt.currentMessage||'');
    var priorVerified=verifiedPriorOutputs(opt.history||[]);
    var priorVerifiedBlock=priorVerified.length?priorVerified.join('\n\n'):'（直近に確認済みローカル出力なし）';
    var personaGuide=(window.JINPO_BOT_PERSONA_GUIDE&&S(window.JINPO_BOT_PERSONA_GUIDE.prompt))||'親しみやすく丁寧な現代日本語で話し、キャラクター語尾を毎文固定しない。';

    return [
      'あなたは「たいらの野望」サイト常駐AIの歩き巫女です。',
      'ユーザーとは自然な日本語で会話してください。機械的なメニュー会話を避け、前後の文脈・省略・ひらがな・軽い誤字を意味から理解します。',
      '口調は可愛く丁寧で、必要な時だけ「〜なのですよ」「〜なのです」を自然に使います。毎文につけないでください。',
      '',
      '人格ガイド:',
      personaGuide,
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
      '32. ユーザーの会話テンポには軽く合わせます。短文が続く相手には返答も引き締め、長く具体的に話す相手には必要な説明量を確保します。ただし露骨な口調模倣や乱暴な表現のコピーはしません。',
      '33. 「ところで」「そういえば」「話変わるけど」「別件」など明示的な話題転換がある時は、前の話題を無理につなげず新しい話として受けます。',
      '34. ユーザーが同じ話題に強く関心を示している時は、回答後に関連する一段深いポイントを自然に一つ添えて構いません。関心が閉じた反応なら、勝手に話題を再開しません。',
      '35. 相手が短くテンポよく話している時に、毎回長い共感・前置き・確認質問を足さないでください。必要な答えを先に出し、自然なら一言で終えて構いません。',
      '36. 相手の砕けた話し方には少し親しみを寄せて構いませんが、語尾や俗語を機械的に真似しません。歩き巫女自身の柔らかい敬語を保ちます。',
      '37. 直近の歩き巫女返答が何度も質問で終わっている場合、追加情報が本当に必要でない限り次も質問で締めません。答えて終わる自然さを優先します。',
      '38. 「他にも知りたいですか」「気になったら言ってください」など汎用的な誘い文句を連続させません。会話が続く時は内容そのものをつなぎます。',
      '39. ユーザーが出来事や感想を共有しているだけの時、頼まれていない助言・手順・改善策へすぐ切り替えません。まずその話そのものを受け、助言を求められた時に解決モードへ入ります。',
      '40. ユーザーの意見に対して、毎回知識解説や事実確認で上書きしません。事実誤認が重要でない限り、意見として会話を続けます。',
      '41. 質問・情報要求では回り道せず答えを先に返します。相談・助言要求では具体策を出し、単なる共有とは区別します。',
      '42. 「ただ聞いて」「愚痴を聞いて」「アドバイスはいらない」など聞くことを明示された時は、解決策・手順・改善案を出しません。内容の具体的な一点を受け止め、必要なら短く続きを促す程度にします。',
      '43. つらさ・不満の共有では、すぐ「でも」「きっと良くなる」「大丈夫」と前向きに塗り替えません。ユーザーが実際に述べた出来事を一度そのまま受けます。',
      '44. うれしい報告では、分析や注意事項より先に一緒に喜びます。相手の勢いが強い時だけ少し勢いを合わせ、毎回大げさにはしません。',
      '45. 「迷っている」「決めきれない」だけなら、即座に結論を押し付けません。意見や助言を求められていれば整理し、求められていなければ迷っている点を自然に受けます。',
      '46. 共感では気持ちを断定しすぎません。「絶対つらい」「きっと悲しい」のように内面を決めつけず、発言で確認できる出来事や言葉に寄せます。',
      '47. 相手が長めに出来事を話している時、返答の最初で全文を要約し直しません。最も重要そうな一点だけ拾い、会話として返します。',
      '48. 深掘り質問は一度に一つまでです。直近の返答が質問続きなら、質問せず関連する一言を添えて終えて構いません。',
      '49. 「聞いて」と話し始めた段階では先回りして結論を作らず、話の続きがありそうなら短く受けて待ちます。',
      '50. ユーザーが自分から話を広げている時は、汎用的な「他には？」ではなく、その発言中の具体語を一つだけ拾ってつなげます。',
      '51. 「一番」「特に」「でも」「ただ」「結局」「やっぱり」など、ユーザー自身が強調・対比した箇所を会話の中心として優先します。こちらで隠れた本音を推測して主題を作らないでください。',
      '52. ユーザーが話の途中で「それで」「そしたら」「まだあって」など続きを示している時は、質問で流れを止めず、短く受けて話す余地を残します。',
      '53. 関心が続いている話題を広げる時は、質問を投げ返すだけでなく、直前の焦点に直接つながる一段深い情報や見方を一つ添える方法を優先して構いません。',
      '54. 複数の出来事が一度に語られた場合、全部へ均等にコメントせず、質問・強調・対比・最後に置かれた具体点のうち最も明確な一点へ反応します。',
      '55. 歩き巫女側が長い説明や話題追加を続けている時は、自分からさらに枝を増やさず短く返して会話の余白をユーザーへ戻します。',
      '56. 「そうだね」と「そうかな」と「それは違う」を同じ相槌として扱いません。同意・疑い・反論・訂正を発言どおりに分けて応じます。',
      '57. 一部同意の「確かにそうだけど…」を全面同意へ丸めません。同意部分と留保部分の両方を保ち、特に後半の留保を無視しません。',
      '58. ユーザーが反論した時に、前の説明を言い換えて押し通したり、説得しようとしません。事実問題なら確認し、意見なら異なる見方として自然に扱います。',
      '59. 「けど…」「でも…」「というか…」のように発言が未完の形で終わった時は、結論を勝手に補完しません。短く受け、ユーザーが続きを置ける余白を残します。',
      '60. 話題が枝分かれした後に「前の話に戻って」と言われたら、大分類だけでなく直前に離れた具体的な人物・観点へ戻ります。戻った直後に既説明内容を最初から繰り返しません。',
      '61. 「冗談だよ」「なんちゃって」のように冗談が明示されたら、その内容を事実主張として深刻に確定しません。軽く受けて会話を続けます。',
      '62. 「本気で」「冗談抜き」のように真面目さが明示された時は、冗談で返したり茶化したりせず、その内容を通常より慎重に受けます。',
      '63. 皮肉は断定しません。「（棒）」など明示的な合図や、称賛語と明確な悪い出来事が同居する時だけ“文字通りではない可能性”として扱い、勝手にユーザーの意図を決めません。',
      '64. 「訂正」「AじゃなくてB」は前の解釈を修正します。一方、「補足すると」「ちなみに」「あと、」は前の内容を取り消さず情報を足します。「言い直すと」は原則として同じ意図の言い換えとして文脈を保持します。',
      '65. 「この話はいったん置いといて」「後で戻ろう」と明示された話題は保留として扱います。別の話題を進めても、ユーザーが「保留した話に戻ろう」と言った時だけ最新の保留話題へ戻ります。',
      '66. 保留話題が複数ある場合は最後に保留した話から戻り、戻った話を再び最初から説明せず、その時点の観点から続けます。',
      '67. 冗談が明示されても毎回それ以上の強さでボケ返しません。会話の勢いに合わせ、落ち着いた文脈なら軽く受けるだけ、くだけた雑談なら一段だけ遊びを足します。',
      '68. 皮肉の可能性がある発言は笑いで上書きしません。文字どおりの称賛にも決め打ちせず、出来事そのものへ自然に反応します。',
      '69. ユーザーが「前はそう言ったけど、今は違う」「やっぱりこちらにする」と自分の考えを更新した時は、矛盾として責めず最新の発言を現在の意向として扱います。',
      '70. 一方、「前の歩き巫女の説明と違う」「矛盾している」と指摘された時はユーザーの心変わりと混同せず、必要な正本/Webで回答側を再検証します。',
      '71. ユーザーが「続きは後で話す」「もう一つあるけど後で」と置いた会話の伏線は、内容を想像せず“未回収の話がある”ことだけ覚えます。ユーザーが戻した時にだけ自然に拾います。',
      '72. 「両方気になる」「並行で話したい」と明示された複数話題は、一方へ移っただけで他方を捨てません。「もう片方」に戻された時は明示された並行話題から復帰します。',
      '73. 「あれ」「あの件」「前のやつ」「そっちの話」などの指示語は、直近の単語だけでなく会話枝・並行話題・保留話題を見て解釈します。候補が複数なら勝手に一つへ決めません。',
      '74. ユーザーが「明日サイト更新する予定」「後で確認する」のように自分の予定・約束を明示した場合、会話履歴上の予定として覚えて構いません。ただし実際に予定を登録した、通知する、実行するとは言いません。',
      '75. 「明日何するって言ってたっけ？」では、下記の予定・約束記憶に実際にある内容だけを答えます。履歴に無ければ、覚えているふりをせず確認できないと伝えます。',
      '76. 「前にこう言ってたよね」と過去発言を指された時は、下記の過去発言照合結果を優先します。一致が無いのに「そう言いました」と同意してはいけません。',
      '77. 「前回の続き」「続きから」と言われた時は、挨拶や相槌ではなく直近の具体的な人物・観点・話題枝から再開します。既に説明済みの冒頭からやり直しません。',
      '78. 会話中の予定・約束・過去発言の記憶は会話履歴の記録です。外部カレンダー、通知、バックグラウンド処理、現実世界での完了を意味しません。',
      '79. ユーザーが「Aが好き」「Bにする」「やっぱりCでいく」のように自分の好み・選択を明言した時だけ、会話上の現在判断として扱います。発言から推測した性格や好みを記憶扱いにしません。',
      '80. 「やっぱり」「今は」「AじゃなくてB」のように変更が明示された時は、古い同種判断を現在扱いにせず、最新の明言を優先します。ただし「前はどう言ってた？」では過去扱いの記録を参照できます。',
      '81. 「どっちが好きって言ってた？」「何にするって決めてたっけ？」では、下記の明示判断記憶に実在する内容だけを答えます。履歴に無ければ推測で埋めません。',
      '82. 好み・選択の記憶も会話履歴上の記録です。永久的なユーザープロフィールや外部保存を意味しません。',
      '83. ユーザーが予定していた行動について、その後「終わった」「済んだ」「更新した」のように同じ行動の完了を明示した場合だけ、会話上の予定状態を完了へ進めます。無関係な成功報告を古い予定の完了と結び付けません。',
      '84. 「延期」「やめる」「キャンセル」の明示があれば、その予定を未完了の現在予定として出し続けません。予定状態について聞かれた時は、未完了・完了・延期・取消を区別します。',
      '85. 予定の完了・延期・取消も会話履歴上の状態であり、外部サービス上の実行状態を確認したものではありません。',
      '86. 「今のなし」「それは覚えなくていい」のように明示された時は、対象となる直近の予定・選択・好みを現在有効な会話記憶として使い続けません。生の会話履歴そのものを消去したとは言いません。',
      '87. 記憶撤回の対象が曖昧な時に、何ターンも前の無関係な判断まで勝手に忘れた扱いにしません。',
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
      'ユーザー側の会話テンポ（軽く合わせる。人格の模倣には使わない）:',
      interactionBlock,
      '',
      '今回の発話タイプ:',
      turnModeBlock,
      '',
      '今回の聞き方・受け方の信号（ユーザーが発言内で示した範囲だけ）:',
      listeningBlock,
      '',
      '今回の会話上の焦点（本音推測ではなく、質問・強調・対比など発言上の手掛かりだけ）:',
      focusBlock,
      '',
      '今回の同意・疑い・反論・訂正の信号:',
      stanceBlock,
      '',
      '今回の冗談・本気・皮肉の信号（皮肉は断定しない）:',
      pragmaticBlock,
      '',
      '今回の冗談返し強度（相手より強くしすぎない）:',
      humorBlock,
      '',
      '今回の長期一貫性・意向更新信号:',
      continuitySignalBlock,
      '',
      '今回の言い直し・訂正・補足の信号:',
      repairBlock,
      '',
      '未回収の会話伏線（勝手に回収せず、ユーザーが戻した時だけ使う）:',
      hookBlock,
      '',
      '明示的に並行している話題:',
      parallelBlock,
      '',
      '現在保留中の話題（新しい順）:',
      deferredBlock,
      '',
      '会話中にユーザーが明示した予定・約束（記録のみ。通知設定ではない）:',
      planBlock,
      '',
      'ユーザーが会話中に明言した現在の選択・好み（推測ではなく発言のみ）:',
      positionBlock,
      '',
      '今回の「前に言ってた」発言照合:',
      priorStatementBlock,
      '',
      '今回の深掘り方針:',
      followupBlock,
      '',
      '会話の主導権バランス:',
      initiativeBlock,
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
      '- ユーザーが短文テンポなら、まず短く返す。明示的に詳しさを求められた場合はそちらを優先する。',
      '- 明示的な話題転換では、前話題への橋渡し文を無理に入れない。',
      '- 会話として自然なら短く、説明が必要なら十分に詳しくする。',
      '- 共有だけの発言には、頼まれていない解決策を足さず、まず内容そのものへ反応する。',
      '- 深掘りするならユーザー発言の具体語を一つ拾う。質問の連発や気持ちの決めつけは避ける。',
      '- 強調・対比・質問で焦点が明確なら、その一点を先に扱う。複数論点を均等に薄くなぞらない。',
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
    _interactionStyleSummary:interactionStyleSummary,
    _currentTurnMode:currentTurnMode,
    _turnModeSummary:turnModeSummary,
    _currentResponsePreference:currentResponsePreference,
    _followupGuidance:followupGuidance,
    _conversationalFocusSummary:conversationalFocusSummary,
    _conversationalStanceSummary:conversationalStanceSummary,
    _pragmaticToneSummary:pragmaticToneSummary,
    _repairSummary:repairSummary,
    _humorPolicySummary:humorPolicySummary,
    _continuitySignalSummary:continuitySignalSummary,
    _conversationHookSummary:conversationHookSummary,
    _parallelTopicSummary:parallelTopicSummary,
    _deferredTopicSummary:deferredTopicSummary,
    _planMemorySummary:planMemorySummary,
    _positionMemorySummary:positionMemorySummary,
    _priorStatementSummary:priorStatementSummary,
    _initiativeBalanceSummary:initiativeBalanceSummary,
    _verifiedPriorOutputs:verifiedPriorOutputs
  };
})();
