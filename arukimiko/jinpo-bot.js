(function(){
  'use strict';
  if(window.__JINPO_LOCAL_BOT_INSTALLED__) return;
  window.__JINPO_LOCAL_BOT_INSTALLED__=true;
  var VERSION='3.1.5';
  var MODE='ローカル歩き巫女';
  var lastReference={type:'',items:[]};

  function R(answer,data){return {answer:String(answer||''),sources:[],mode:MODE,data:data||{}};}
  function actions(){return window.JINPO_BOT_ACTIONS;}
  function parser(){return window.JINPO_BOT_PARSER;}
  function interpreter(){return window.JINPO_BOT_INTERPRETER;}
  function state(){return window.JINPO_BOT_STATE;}
  function help(){return window.JINPO_BOT_HELP;}
  function capabilities(){return window.JINPO_BOT_CAPABILITIES;}
  function fmtNum(v){return String(v==null?'':v);}
  function conditionLabel(s){
    s=s||{};var p=[];if(s.formation)p.push(s.formation);if(s.count)p.push(s.count+'因縁');if(s.searchBasis==='fullmax')p.push('全MAX込み基準');if(s.priority1){var x='第1 '+s.priority1;if(s.priority1Min!=null)x+=' '+s.priority1Min+'以上';if(s.priority1Max!=null)x+=' '+s.priority1Max+'以下';p.push(x);}if(s.priority2){var y='第2 '+s.priority2;if(s.priority2Min!=null)y+=' '+s.priority2Min+'以上';if(s.priority2Max!=null)y+=' '+s.priority2Max+'以下';p.push(y);}if(s.grade3)p.push('等級3以下');if(Number(s.factor4Exclude)>0)p.push('文曲除外'+s.factor4Exclude+'人');if(s.sumSort)p.push('第1・第2合計ソート');return p.join(' / ');
  }
  function formatMap(map){
    var order=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性'];var p=[];order.forEach(function(k){if(map&&map[k]!==undefined&&map[k]!=='')p.push(k+' '+map[k]);});return p.join(' / ');
  }
  function formatResults(list){
    if(!list||!list.length)return'現在、画面に検索結果がありません。';return list.map(function(x){return x.rank+'位：'+(x.formation||'')+' '+(x.count||'')+'因縁｜'+(x.members||[]).join(' / ')+(x.stats?'｜'+x.stats:'');}).join('\n');
  }
  function formatSwap(list){
    if(!list||!list.length)return'現在、画面に差替候補がありません。';return list.slice(0,10).map(function(x){return x.rank+'番：配置'+x.slot+' → '+(x.after||x.afterId)+(x.level?' ['+String(x.level).toUpperCase()+']':'')+(x.label?'｜'+x.label:'');}).join('\n');
  }
  function formatSaved(list){
    if(!list||!list.length)return'保存編成はありません。';return list.map(function(x){return x.rank+'番「'+x.name+'」 '+x.formation+'｜'+(x.members||[]).join(' / ');}).join('\n');
  }
  function smalltalk(kind){if(kind==='greeting')return'こんにちは。歩き巫女なのですよ。今日は何を話しましょう？';if(kind==='thanks')return'どういたしましてなのですよ。続けてそのまま話しかけてくださいね。';if(kind==='weather')return'そうですね。無理せず快適に過ごしてくださいね。';if(kind==='identity')return'歩き巫女なのですよ。雑談や調べものから、必要な時には陣法のお手伝いもするのです。';return'';}

  function isRestorableAction(name){return ['apply_result','apply_swap','clear_placement','set_owned_hero','set_owned_hero_auto','clear_owned_hero','clear_owned_heroes','set_excluded_hero','clear_excluded_heroes','load_saved','import_json'].indexOf(name)>=0;}
  function isNonRestorableMutation(name){return ['exit_recommended','all_max','clear_all_max','panel_max','panel_clear','set_kenbun','set_kishin','set_tensei','save_current','delete_saved','apply_override_bond_master','reset_bond_master','clear_formation_master','reset_all'].indexOf(name)>=0;}

  function resetConversationState(opt){
    opt=opt||{};
    var epoch=0,errors=[];

    try{
      if(window.JINPO_BOT_AI_BRAIN&&typeof window.JINPO_BOT_AI_BRAIN.resetConversationContext==='function'){
        epoch=window.JINPO_BOT_AI_BRAIN.resetConversationContext();
      }
    }catch(e){errors.push('ai');}

    try{
      if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.clearPending==='function'){
        window.JINPO_BOT_DIALOG.clearPending();
      }
    }catch(e){errors.push('dialog');}

    try{
      if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.clear==='function'){
        window.JINPO_BOT_KASHIN_NAME.clear();
      }else if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.pause==='function'){
        window.JINPO_BOT_KASHIN_NAME.pause();
      }
    }catch(e){errors.push('kashin');}

    try{
      if(window.JINPO_BOT_GUIDE&&typeof window.JINPO_BOT_GUIDE.resetFlow==='function'){
        window.JINPO_BOT_GUIDE.resetFlow();
      }
    }catch(e){errors.push('guide');}

    return {
      ok:errors.length===0,
      contextEpoch:epoch,
      errors:errors,
      source:String(opt.source||'')
    };
  }

  window.JINPO_BOT_RESET_CONVERSATION=resetConversationState;

  async function handle(payload){
    var payloadObj=typeof payload==='string'?{message:payload,history:[]}:((payload&&typeof payload==='object')?payload:{});
    var message=String(payloadObj.message||'');
    var originalMessage=message;
    var history=Array.isArray(payloadObj.history)?payloadObj.history:[];
    try{
      if(window.JINPO_BOT_AI_BRAIN&&typeof window.JINPO_BOT_AI_BRAIN.filterRawHistory==='function'){
        history=window.JINPO_BOT_AI_BRAIN.filterRawHistory(history);
      }
    }catch(historyEpochErr){}

    var pageContext={mode:window.JINPO_BOT_PAGE_MODE||'',path:'',title:''};
    try{
      if(window.JINPO_BOT_PAGE_CONTEXT&&typeof window.JINPO_BOT_PAGE_CONTEXT.snapshot==='function')pageContext=window.JINPO_BOT_PAGE_CONTEXT.snapshot()||pageContext;
    }catch(pageContextErr){}


    function resetTransientConversationState(){
      try{
        if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.clearPending==='function'){
          window.JINPO_BOT_DIALOG.clearPending();
        }
      }catch(e){}
      try{
        if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.pause==='function'){
          window.JINPO_BOT_KASHIN_NAME.pause();
        }
      }catch(e){}
    }

    // 「話題リセット」は画面の過去ログを消さず、AIが参照する会話文脈だけをここから新しくする。
    if(/^(?:話題|文脈|今の話)(?:を)?(?:リセット|クリア)(?:して)?[。！!？?]*$|^(?:新しい話(?:にしよう|をしよう)?|ここから別の話(?:にしよう)?|最初から話そう)[。！!？?]*$/.test(originalMessage.trim())){
      var resetResult=resetConversationState({source:'text'});
      return {
        answer:'ここまでの会話状態をリセットしました。画面の過去ログは残したまま、ここから新しい話として受け取ります。',
        sources:[],links:[],mode:'会話制御',
        data:{topicReset:true,contextEpoch:resetResult.contextEpoch||0,resetResult:resetResult}
      };
    }

    // AIへ渡す前にも古い質問待ちを整理する。
    // AIが正常でも、後で予備モードへ落ちた瞬間に昔の天気/名付けが復活するのを防ぐ。
    try{
      var currentDomain=window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.domainFromText==='function'
        ?window.JINPO_BOT_CONVERSATION.domainFromText(originalMessage):'';

      if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.state==='function'){
        var ks=window.JINPO_BOT_KASHIN_NAME.state();
        if(ks&&ks.active&&currentDomain&&currentDomain!=='kashin_name'){
          window.JINPO_BOT_KASHIN_NAME.pause();
        }
      }

      if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.state==='function'){
        var ds=window.JINPO_BOT_DIALOG.state();
        if(ds&&ds.pending&&currentDomain&&currentDomain!=='weather'){
          window.JINPO_BOT_DIALOG.clearPending();
        }
      }
    }catch(transientSanitizeErr){}

    // App CheckからFunction Callingまで段階別に確認する精密診断。
    if(/^(?:AI|ＡＩ)(?:詳細)?診断[！!？?。]*$|^(?:AI|ＡＩ)接続(?:詳細)?診断[！!？?。]*$/.test(originalMessage.trim())){
      try{
        if(!window.JINPO_BOT_AI_BRAIN||typeof window.JINPO_BOT_AI_BRAIN.diagnose!=='function'){
          return {
            answer:'AI精密診断モジュールがまだ読み込まれていません。',
            sources:[],links:[],mode:'AI精密診断',
            data:{aiDiagnosis:true,ok:false,stage:'module'}
          };
        }

        if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
          window.JINPO_AI_CHAT.setBrainStatus('AI診断中','App Check / Gemini / Function Calling');
        }

        var diagnosis=await window.JINPO_BOT_AI_BRAIN.diagnose({toolTest:true});
        var diagnosisText=window.JINPO_BOT_AI_BRAIN.formatDiagnosis(diagnosis);

        if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
          window.JINPO_AI_CHAT.setBrainStatus(
            diagnosis&&diagnosis.ok?'AI準備OK':'予備モード',
            diagnosis&&diagnosis.ok?'AI diagnostics OK':'AI diagnostics failed'
          );
        }

        return {
          answer:diagnosisText,
          sources:[],links:[],mode:'AI精密診断',
          data:{aiDiagnosis:true,ok:!!(diagnosis&&diagnosis.ok),diagnosis:diagnosis||{}}
        };
      }catch(diagErr){
        try{
          if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
            window.JINPO_AI_CHAT.setBrainStatus('予備モード','AI diagnosis exception');
          }
        }catch(ignore){}
        return {
          answer:'AI精密診断そのものが停止しました。\n'+String(diagErr&&diagErr.message||diagErr),
          sources:[],links:[],mode:'AI精密診断',
          data:{aiDiagnosis:true,ok:false,error:String(diagErr&&diagErr.message||diagErr)}
        };
      }
    }

    // 本番でFirebase AI Logic / App Checkの状態を簡単に確認する専用コマンド。
    if(/^(?:AI|ai|ＡＩ)\s*(?:接続)?(?:確認|テスト|状態)$/.test(originalMessage.replace(/\s+/g,''))){
      if(window.JINPO_BOT_AI_BRAIN&&typeof window.JINPO_BOT_AI_BRAIN.preflight==='function'){
        var pf=await window.JINPO_BOT_AI_BRAIN.preflight();
        if(pf&&pf.ok){
          try{
            if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
              window.JINPO_AI_CHAT.setBrainStatus(
                pf.functionCalling?'AI準備OK':'AI一部確認',
                pf.functionCalling?'Gemini + Function Calling OK':'Gemini text only'
              );
            }
          }catch(e){}
          return {
            answer:
              'AI会話脳の接続は正常なのですよ。\n' +
              '使用モデル：'+String(pf.model||'')+'\n' +
              'Firebase AI Logic / App Check：OK\n' +
              'Function Calling：'+(pf.functionCalling?'OK':'未確認') +
              ((pf.modelErrors&&pf.modelErrors.length)?'\n※上位モデルから自動退避して接続しました。':''),
            sources:[],links:[],mode:'AI接続確認',
            data:{aiPreflight:true,ok:true,preflight:pf}
          };
        }
        try{
          if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
            window.JINPO_AI_CHAT.setBrainStatus('予備モード',String((pf&&pf.message)||'AI接続失敗'));
          }
        }catch(e){}
        var diag=String((pf&&pf.diagnostic)||'').trim();
        var raw=String((pf&&pf.raw)||'').trim();
        var detail=diag||raw||'詳細コードなし';
        return {
          answer:
            'AI会話脳はまだ本番接続できていません。\n' +
            String((pf&&pf.message)||'Firebase側の設定を確認してください。') +
            '\n\n【実エラー】\n' + detail +
            '\n\n3.6 Flashで一時的な429/503が出た場合は、3.5 Flash → 3.5 Flash-Liteまで自動で試しています。' +
            '\nAIが使えない間もサイト機能自体は止まりません。',
          sources:[],links:[],mode:'AI接続確認',
          data:{aiPreflight:true,ok:false,preflight:pf||{}}
        };
      }
    }

    // v3.0: Geminiを会話の頭脳として最優先。
    // 数値・最新情報・サイト操作はFunction Callingで既存の正本/機能を使う。
    // API未設定、無料枠到達、通信失敗時は、この下の従来エンジンへ自動フォールバックする。
    if(!payloadObj.__skipAi){
      try{
        if(window.JINPO_BOT_AI_BRAIN&&typeof window.JINPO_BOT_AI_BRAIN.respond==='function'){
          var aiReply=await window.JINPO_BOT_AI_BRAIN.respond(originalMessage,{
            history:history,
            pageContext:pageContext,
            localHandle:function(q){
              return handle({message:String(q||''),history:history,__skipAi:true});
            }
          });
          if(aiReply&&aiReply.handled){
            try{
              if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
                window.JINPO_AI_CHAT.setBrainStatus('AI準備OK','Gemini response');
              }
            }catch(e){}
            return aiReply;
          }
          if(aiReply&&aiReply.error){
            window.ARUKIMIKO_AI_LAST_FALLBACK={
              at:Date.now(),
              error:String(aiReply.error||''),
              message:originalMessage
            };
            try{
              if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
                window.JINPO_AI_CHAT.setBrainStatus('予備モード',String(aiReply.error||'AI fallback'));
              }
            }catch(e){}
          }
        }
      }catch(aiBrainErr){}
    }

    // AIが利用できなかった時のローカル会話制御。
    // 「話を戻そう」は、天気の場所待ちや家臣名付けより先に処理する。
    var conversationControl=null;
    try{
      if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.control==='function'){
        conversationControl=window.JINPO_BOT_CONVERSATION.control(originalMessage,history);
      }
    }catch(controlErr){}

    if(conversationControl){
      try{
        if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.clearPending==='function'){
          window.JINPO_BOT_DIALOG.clearPending();
        }
      }catch(e){}
      try{
        if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.pause==='function'){
          window.JINPO_BOT_KASHIN_NAME.pause();
        }
      }catch(e){}

      if(conversationControl.control==='change'){
        return {
          answer:'もちろんです。ここまでの途中入力はいったん止めました。別の話をそのままどうぞ。',
          sources:[],links:[],mode:'会話制御',
          data:{conversationControl:'change'}
        };
      }

      if(conversationControl.control==='back'){
        if(conversationControl.restoreMessage){
          message=String(conversationControl.restoreMessage);
        }else{
          return {
            answer:'戻したい話題をこちらで特定できなかったのですよ。「カープの話に戻ろう」みたいに一言だけ足してもらえれば、そこへ戻します。',
            sources:[],links:[],mode:'会話制御',
            data:{conversationControl:'back',needsTopic:true}
          };
        }
      }
    }

    // まず「今、何を聞いている途中か」を解決する。
    // 例: 天気 → (場所を質問) → 東京 を確実に「東京の天気」へつなぐ。
    var dialogInfo={handled:false,message:message};
    try{
      if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.preprocess==='function'){
        dialogInfo=window.JINPO_BOT_DIALOG.preprocess(message,{history:history,pageContext:pageContext})||dialogInfo;
        if(dialogInfo.direct){
          return {answer:String(dialogInfo.answer||''),sources:[],links:[],mode:String(dialogInfo.mode||'会話文脈'),data:dialogInfo.data||{}};
        }
        if(dialogInfo.message)message=String(dialogInfo.message);
      }
    }catch(dialogErr){}

    // 全モジュール共通の会話意図を先に決める。
    // サイト案内や個別機能が同じ文を別々に解釈するのを防ぐ。
    var intentInfo={original:originalMessage,message:message,intent:'conversation',domain:'',navigation:false,fact:false};
    try{
      if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.resolve==='function'){
        intentInfo=window.JINPO_BOT_CONVERSATION.resolve(message,history,{pageContext:pageContext})||intentInfo;
        if(intentInfo.message)message=String(intentInfo.message);
      }
    }catch(conversationErr){}

    var contextInfo={original:originalMessage,message:message,resolved:message!==originalMessage,reason:dialogInfo.reason||'',confidence:dialogInfo.handled?0.99:0};
    try{
      if(window.JINPO_BOT_CONTEXT&&typeof window.JINPO_BOT_CONTEXT.resolve==='function'){
        var ctx=window.JINPO_BOT_CONTEXT.resolve(message,history,{pageMode:window.JINPO_BOT_PAGE_MODE||'',siteState:actions()&&typeof actions().readSiteState==='function'?actions().readSiteState():null});
        if(ctx&&ctx.message){
          contextInfo=ctx;
          if(dialogInfo.handled&&!ctx.resolved){
            contextInfo.original=originalMessage;
            contextInfo.resolved=message!==originalMessage;
            contextInfo.reason=dialogInfo.reason||contextInfo.reason;
            contextInfo.confidence=Math.max(Number(contextInfo.confidence)||0,0.99);
          }
          message=String(ctx.message);
        }
      }
    }catch(contextErr){}

    // 天気は一般知識/Wikipediaへ絶対に流さず、天気専用経路で完結させる。
    if((dialogInfo&&dialogInfo.intent==='weather')||/天気|てんき|気温|きおん|予報|よほう|降水|こうすい|雨|あめ|雪|ゆき|湿度|しつど|風速|ふうそく/.test(message)){
      try{
        var weatherWeb=window.JINPO_BOT_WEB;
        if(weatherWeb&&typeof weatherWeb.lookupRealtime==='function'){
          var wr=await weatherWeb.lookupRealtime(message);
          if(wr&&wr.ok&&wr.kind==='weather'){
            try{if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.rememberResult==='function')window.JINPO_BOT_DIALOG.rememberResult('weather',wr);}catch(e){}
            var wp='';
            if(dialogInfo.reason==='weather_pending_location')wp=(wr.location&&wr.location.name?wr.location.name:'その地域')+'ですね。';
            else if(dialogInfo.reason==='weather_follow_time')wp='明日の天気ですね。';
            else if(dialogInfo.reason==='weather_follow_location')wp=(wr.location&&wr.location.name?wr.location.name:'その地域')+'ですね。';
            else wp=wr.title+'ですね。';
            return {answer:wp+'\n'+wr.extract,sources:Array.isArray(wr.sources)?wr.sources:[],links:[],mode:'天気',data:{weather:true,context:contextInfo,location:wr.location||null}};
          }
          if(wr&&wr.needsLocation){
            return {answer:'どこの天気を見ますか？\n地名だけで大丈夫なのですよ。',sources:[],links:[],mode:'天気',data:{weather:true,needsLocation:true}};
          }
          if(wr&&wr.notFound){
            return {answer:'「'+String(wr.query||'その場所')+'」の天気として受け取ったのですが、地域を特定できなかったのですよ。\n市区町村名か都道府県名でもう一度教えてください。',sources:[],links:[],mode:'天気',data:{weather:true,notFound:true}};
          }
          return {answer:'天気の質問として受け取っています。今は天気データの取得先に一時的につながらなかったのですよ。\n別の話には切り替えず、このまま同じ地域名でもう一度送れば天気として続けます。',sources:[],links:[],mode:'天気',data:{weather:true,temporaryError:true}};
        }
      }catch(weatherErr){
        return {answer:'天気の質問として受け取っています。ただ、今は天気データを取得できなかったのですよ。\nWikipediaなど別の答えには切り替えないので、そのままもう一度試してください。',sources:[],links:[],mode:'天気',data:{weather:true,error:true}};
      }
    }

    // 会話するほど話題傾向を端末内で学習する。生チャット全文の二重保存はしない。
    try{
      if(window.JINPO_BOT_LEARNING&&typeof window.JINPO_BOT_LEARNING.observe==='function'){
        window.JINPO_BOT_LEARNING.observe(originalMessage);
      }
    }catch(learningObserveErr){}

    // 「覚えて」「訂正」など、明示的な学習指示。
    try{
      if(window.JINPO_BOT_LEARNING&&typeof window.JINPO_BOT_LEARNING.respond==='function'){
        var learnReply=window.JINPO_BOT_LEARNING.respond(originalMessage,{history:history,context:contextInfo});
        if(learnReply&&learnReply.handled){
          return {answer:String(learnReply.answer||''),sources:[],links:[],mode:'端末内会話学習',data:{learning:true,context:contextInfo}};
        }
      }
    }catch(learningReplyErr){}

    // AIフォールバック時でも、カープ専用会話を直接使う。
    // これが無いと「カープ」を一般Webや別の途中タスクへ流してしまう。
    try{
      if(window.JINPO_BOT_CARP&&typeof window.JINPO_BOT_CARP.respond==='function'){
        var carpReply=await window.JINPO_BOT_CARP.respond(message,{history:history,context:contextInfo,pageContext:pageContext});
        if(carpReply&&carpReply.handled){
          return {
            answer:String(carpReply.answer||''),
            sources:Array.isArray(carpReply.sources)?carpReply.sources:[],
            links:Array.isArray(carpReply.links)?carpReply.links:[],
            mode:String(carpReply.mode||'カープ専用会話'),
            data:{carp:true,context:contextInfo,restored:!!(conversationControl&&conversationControl.control==='back')}
          };
        }
      }
    }catch(carpErr){}

    // 家臣の名付けは全ページ共通の会話機能。
    // 「家臣計算」と混同しないよう、サイト案内より先に判定する。
    try{
      if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.respond==='function'){
        var naming=window.JINPO_BOT_KASHIN_NAME.respond(originalMessage,{history:history,context:contextInfo,pageContext:pageContext});
        if(naming&&naming.handled){
          return {answer:String(naming.answer||''),sources:[],links:[],mode:String(naming.mode||'家臣名付け'),data:{kashinNaming:true,context:contextInfo}};
        }
      }
    }catch(kashinNameErr){}

    // 九十九・鬼神石・魔導結晶のCSV正本を、一般的なツール案内より先に参照。
    // 例: 「九十九1番は？」「不壊金剛の耐久は？」「魔導で知力トップ3」
    try{
      if(window.JINPO_BOT_TOOL_KNOWLEDGE&&typeof window.JINPO_BOT_TOOL_KNOWLEDGE.respond==='function'){
        var toolFact=window.JINPO_BOT_TOOL_KNOWLEDGE.respond(message,{original:originalMessage,history:history,context:contextInfo,pageContext:pageContext});
        if(toolFact&&toolFact.handled){
          return {answer:String(toolFact.answer||''),sources:Array.isArray(toolFact.sources)?toolFact.sources:[],links:Array.isArray(toolFact.links)?toolFact.links:[],mode:String(toolFact.mode||'たいらの野望ツール実データ'),data:Object.assign({toolKnowledge:true,context:contextInfo},toolFact.data||{})};
        }
      }
    }catch(toolKnowledgeErr){}

    // たいらの野望の確定知識は、一般サイト案内やWeb検索より先に参照する。
    // 例: 「足利のカウンターは？」→ 天下統一奇譚・二条城編の足利義昭と意味寄せして即答。
    try{
      if(window.JINPO_TAIRANO_KNOWLEDGE&&typeof window.JINPO_TAIRANO_KNOWLEDGE.respond==='function'){
        var tk=window.JINPO_TAIRANO_KNOWLEDGE.respond(message,{original:originalMessage,history:history,context:contextInfo});
        if(tk&&tk.handled){
          return {answer:String(tk.answer||''),sources:Array.isArray(tk.sources)?tk.sources:[],links:Array.isArray(tk.links)?tk.links:[],mode:String(tk.mode||'たいらの野望専用知識'),data:Object.assign({tairanoKnowledge:true,context:contextInfo},tk.data||{})};
        }
      }
    }catch(tairanoKnowledgeErr){}

    // サイト案内は陣法操作やWeb検索より先に判定する。
    // TOPではこの経路が主機能になり、陣法ページでは明示的な「ページ案内」の時だけ反応する。
    try{
      if(window.JINPO_BOT_SITE_GUIDE&&typeof window.JINPO_BOT_SITE_GUIDE.respond==='function'){
        var guide=window.JINPO_BOT_SITE_GUIDE.respond(message,{original:originalMessage,history:history,context:contextInfo,intentInfo:intentInfo});
        if(guide&&guide.handled){
          return {answer:String(guide.answer||''),sources:Array.isArray(guide.sources)?guide.sources:[],links:Array.isArray(guide.links)?guide.links:[],mode:String(guide.mode||'サイト総合案内'),data:{siteGuide:true,context:contextInfo}};
        }
      }
    }catch(siteGuideErr){}

    // 正本知識・ページ案内に該当しない場合だけ、端末内で教えられた事実を参照する。
    try{
      if(window.JINPO_BOT_LEARNING&&typeof window.JINPO_BOT_LEARNING.find==='function'){
        var learnedHit=window.JINPO_BOT_LEARNING.find(message);
        if(learnedHit){
          return {answer:'前に教えてもらった内容では、「'+learnedHit.subject+'」は「'+learnedHit.answer+'」なのですよ。',sources:[],links:[],mode:'端末内会話学習',data:{learning:true,learnedFact:true,context:contextInfo}};
        }
      }
    }catch(learningFindErr){}

    var coreReady=!!(actions()&&parser()&&state()&&help()&&interpreter());
    if(!coreReady){
      if(window.JINPO_BOT_SMALLTALK&&typeof window.JINPO_BOT_SMALLTALK.respond==='function'){
        try{
          var siteChat=await window.JINPO_BOT_SMALLTALK.respond(message,{history:history,context:contextInfo,original:originalMessage,pageContext:pageContext});
          if(siteChat&&siteChat.handled)return {answer:String(siteChat.answer||''),sources:Array.isArray(siteChat.sources)?siteChat.sources:[],links:Array.isArray(siteChat.links)?siteChat.links:[],mode:String(siteChat.mode||'日常会話'),data:{smalltalk:true,context:contextInfo}};
        }catch(siteChatErr){}
      }
      var heard=String(originalMessage||message||'').trim();
      return {answer:'今の「'+heard+'」について、こちらの解釈をうまく絞り切れなかったのですよ。\nページ案内へ勝手に逃げず、前の話の続きならその続きとして扱います。もう一言だけ足してもらえれば、その内容に合わせて答えるのです。',sources:[],links:[],mode:'会話確認',data:{needsClarification:true,context:contextInfo,pageContext:pageContext,intentInfo:intentInfo}};
    }

    var interpretNote='',pending=interpreter().getPending(),capabilityPlan=null;
    if(pending){
      if(interpreter().isYes(message)){
        message=String(pending.correctedText||'');
        interpreter().clearPending();
      }else if(interpreter().isNo(message)){
        interpreter().clearPending();
        return R('承知しました。操作は実行していません。内容を言い直してください。',{confirmationCancelled:true});
      }else{
        interpreter().clearPending();
      }
    }
    if(!pending||!interpreter().isYes(typeof payload==='string'?payload:String(payload&&payload.message||''))){
      try{
        var exactCap=capabilities()&&typeof capabilities().resolve==='function'?capabilities().resolve(message,{exactOnly:true}):null;
        if(exactCap&&exactCap.kind==='clarify')return R(exactCap.question,{needsClarification:true,capability:exactCap});
        if(exactCap&&exactCap.kind==='execute')capabilityPlan={raw:message,actions:[{name:exactCap.action,args:exactCap.args||{}}],searchPatch:null,recommendStat:'',helpKey:'',smalltalk:'',recognized:true};
      }catch(capErr){}
      var interpreted=capabilityPlan?{decision:'execute',correctedText:message,note:'',corrections:[]}:interpreter().analyze(message,{siteState:actions().readSiteState(),lastReference:lastReference});
      if(interpreted.decision==='clarify')return R(interpreted.question,{needsClarification:true,interpretation:interpreted});
      if(interpreted.decision==='confirm'){
        interpreter().savePending({original:interpreted.original,correctedText:interpreted.correctedText,question:interpreted.question,confidence:interpreted.confidence,corrections:interpreted.corrections});
        return R(interpreted.question,{needsConfirmation:true,interpretation:interpreted});
      }
      message=interpreted.correctedText;interpretNote=interpreted.note||'';
    }
    var plan=capabilityPlan||parser().parse(message);
    if(!plan.recognized&&capabilities()&&typeof capabilities().resolve==='function'){
      try{
        var cap=capabilities().resolve(message)||capabilities().resolve(originalMessage);
        if(cap&&cap.kind==='clarify')return R(cap.question,{needsClarification:true,capability:cap});
        if(cap&&cap.kind==='execute'){plan.actions.push({name:cap.action,args:cap.args||{}});plan.recognized=true;}
      }catch(capErr2){}
    }
    if(plan.helpKey)return R(help().get(plan.helpKey));

    // 「検索して」だけで陣形選択へ追い込まない。
    // まず目的を聞き、おすすめ検索なら全陣形から探せることを案内する。
    if(plan.needsSearchPreference){
      return R(
        'もちろん探せるのですよ。まず何を重視したいですか？\n' +
        '「腕力高いの」「耐久と魅力が高いの」みたいに言ってくれれば、陣形を決めなくても全陣形から探します。\n' +
        '陣形を固定したい時だけ「鶴翼で」のように指定してください。',
        {needsSearchPreference:true}
      );
    }
    // 標準の挨拶も誤字の挨拶も、拡張Smalltalkへ集約する。
    // これにより同じ固定文だけでなく、複数レパートリーと自動Web判定を利用できる。
    if(!plan.recognized&&window.JINPO_BOT_SMALLTALK&&typeof window.JINPO_BOT_SMALLTALK.respond==='function'){
      try{
        var chat=await window.JINPO_BOT_SMALLTALK.respond(message,{history:history,context:contextInfo,original:originalMessage,pageContext:pageContext});
        if(chat&&chat.handled){
          return {answer:String(chat.answer||''),sources:Array.isArray(chat.sources)?chat.sources:[],links:Array.isArray(chat.links)?chat.links:[],mode:String(chat.mode||'日常会話'),data:{smalltalk:true,context:contextInfo}};
        }
      }catch(chatErr){}
    }
    // 拡張Smalltalkが読めない場合だけ、旧来の最低限の定型文へフォールバックする。
    if(plan.smalltalk&&!plan.recognized)return R(smalltalk(plan.smalltalk));

    var before=actions().readSiteState();
    state().setConditions(before);
    var recommendPatch=!!(before.recommendActive&&plan.searchPatch&&plan.searchPatch.formation===undefined&&plan.searchPatch.count===undefined&&plan.searchPatch.sumSort===undefined&&plan.searchPatch.sumTie===undefined);
    var hasUndo=plan.actions.some(function(a){return a.name==='undo';});
    var nonRestorable=recommendPatch||plan.actions.some(function(a){return isNonRestorableMutation(a.name);});
    var restorable=(!recommendPatch&&!!plan.searchPatch)||!!plan.recommendStat||plan.actions.some(function(a){return isRestorableAction(a.name);});
    if(!hasUndo&&nonRestorable)state().clearUndo();
    else if(!hasUndo&&restorable)state().pushUndo(actions().captureSnapshot(),message);

    var outputs=[];
    if(plan.searchPatch){
      var actionName=recommendPatch?'update_recommended':'apply_search';
      var sr=await actions().execute(actionName,plan.searchPatch);outputs.push({name:actionName,res:sr});if(!sr.ok)return R(sr.message,sr.data);lastReference={type:'result',items:[]};
    }
    if(plan.recommendStat){var rr=await actions().execute('run_recommended',{stat:plan.recommendStat});outputs.push({name:'run_recommended',res:rr});if(!rr.ok)return R(rr.message,rr.data);lastReference={type:'result',items:[]};}

    for(var i=0;i<plan.actions.length;i++){
      var item=plan.actions[i],res,executedName=item.name,args=item.args||{};
      if(item.name==='apply_result'&&args.scope!=='result'&&lastReference.type==='swap'&&lastReference.items&&lastReference.items[Number(args.rank)-1]){
        var ref=lastReference.items[Number(args.rank)-1];executedName='apply_swap';args={slot:ref.slot,afterId:ref.afterId};
      }
      if(item.name==='undo'){
        var u=state().popUndo();if(!u){outputs.push({name:'undo',res:{ok:false,message:'戻せる一つ前の状態がありません。',data:{}}});continue;}
        res=await actions().execute('restore_snapshot',{snapshot:u.snapshot});
      }else res=await actions().execute(executedName,args);
      outputs.push({name:executedName,res:res});
      if(!res.ok)return R(res.message,res.data);
      if(executedName==='get_swap_candidates')lastReference={type:'swap',items:(res.data&&res.data.candidates)||[]};
      else if(executedName==='get_results')lastReference={type:'result',items:(res.data&&res.data.results)||[]};
      else if(executedName==='apply_swap')lastReference={type:'',items:[]};
      else if(executedName==='apply_result')lastReference={type:'result',items:[]};
    }

    var after=actions().readSiteState();state().setConditions(after);
    try{if(window.JINPO_BOT_NLU&&typeof window.JINPO_BOT_NLU.remember==='function')window.JINPO_BOT_NLU.remember({original:originalMessage,corrected:message,plan:plan,state:after,lastReference:lastReference});}catch(e){}
    if(!plan.recognized){
      var cap=null;try{cap=window.JINPO_BOT_CAPABILITIES&&window.JINPO_BOT_CAPABILITIES.friendlyQuestion?window.JINPO_BOT_CAPABILITIES.friendlyQuestion(originalMessage):null;}catch(e){}
      return R(cap||'陣法の検索・英傑・差替・強化など、したいことをもう少しだけ教えてください。かなりラフな言い方で大丈夫なのですよ。',{needsClarification:true});
    }

    var lines=[];
    outputs.forEach(function(o){var r=o.res||{},d=r.data||{};
      if(o.name==='apply_search'){var s=d.state||after;lines.push(conditionLabel(s)+'で検索しました。'+(s.hit&&s.hit!=='—'&&s.hit!=='検索中'?' 検索結果 '+s.hit+'件。':''));}
      else if(o.name==='run_recommended'||o.name==='update_recommended'||o.name==='run_best'||o.name==='run_specified_simple'){var rs=d.state||after;lines.push(r.message+(rs.hit&&rs.hit!=='—'&&rs.hit!=='検索中'?' 検索結果 '+rs.hit+'件。':''));}
      else if(o.name==='get_results')lines.push(formatResults(d.results));
      else if(o.name==='compare_results')lines.push(formatResults(d.results));
      else if(o.name==='get_swap_candidates')lines.push(formatSwap(d.candidates));
      else if(o.name==='read_totals'){var normal=formatMap(d.totals),combined=formatMap(d.combined);lines.push('合計：'+(normal||'表示なし')+(combined?'\n込み合計：'+combined:''));}
      else if(o.name==='read_activated')lines.push((d.bonds&&d.bonds.length)?'発動因縁：'+d.bonds.join(' / '):'現在、発動因縁は表示されていません。');
      else if(o.name==='read_state')lines.push('現在：'+(conditionLabel(d.state)||'検索条件なし'));
      else if(o.name==='read_placement')lines.push((d.placement&&d.placement.length)?d.placement.map(function(x){return x.slot+'. '+x.name+(x.internal_id?' ('+x.internal_id+')':'');}).join('\n'):'まだ配置英傑が確認できないのですよ。配置がある状態なら、もう一度見てみましょう。');
      else if(o.name==='set_owned_hero_auto')lines.push((d.hero||'指定した英傑')+'を使う条件に入れたのですよ。');
      else if(o.name==='set_excluded_hero')lines.push((d.hero||'指定した英傑')+(d.excluded===false?'を除外から戻したのですよ。':'は候補から外したのですよ。'));
      else if(o.name==='rerun_search')lines.push(d.skipped?r.message:'同じ条件で探し直したのですよ。');
      else if(o.name==='list_saved')lines.push(formatSaved(d.saved));
      else if(o.name==='share_url')lines.push(d.url?'共有URL：'+d.url:r.message);
      else if(r.message)lines.push(r.message);
    });
    if(!lines.length&&plan.smalltalk)lines.push(smalltalk(plan.smalltalk));
    if(interpretNote)lines.unshift(interpretNote);
    return R(lines.join('\n'),{state:after,context:contextInfo});
  }

  function install(){
    window.JINPO_AI_TRANSPORT=handle;
    window.JINPO_BOT_LOCAL_HANDLE=function(payload){
      var p=typeof payload==='string'?{message:payload}:Object.assign({},payload||{});
      p.__skipAi=true;
      return handle(p);
    };

    if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setTransport==='function'){
      window.JINPO_AI_CHAT.setTransport(handle);
    }

    // 起動後に1回、Gemini本文 + Function Callingまで実動確認。
    setTimeout(async function(){
      try{
        if(!window.JINPO_BOT_AI_BRAIN||
           typeof window.JINPO_BOT_AI_BRAIN.startupPreflight!=='function')return;

        var pf=await window.JINPO_BOT_AI_BRAIN.startupPreflight();
        if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
          if(pf&&pf.ok&&pf.functionCalling){
            window.JINPO_AI_CHAT.setBrainStatus('AI準備OK','Gemini + Function Calling OK');
          }else{
            window.JINPO_AI_CHAT.setBrainStatus(
              '予備モード',
              String((pf&&pf.message)||'AI preflight failed')
            );
          }
        }
      }catch(e){
        try{
          if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
            window.JINPO_AI_CHAT.setBrainStatus('予備モード',String(e&&e.message||e));
          }
        }catch(ignore){}
      }
    },600);
  }
  window.JINPO_BOT={version:VERSION,handle:handle,parse:function(t){return parser()&&parser().parse(t);},getState:function(){return state()&&state().getConditions();},readSiteState:function(){return actions()&&actions().readSiteState();},listActions:function(){return actions()?actions().registry.slice():[];},resolveContext:function(t,h){return window.JINPO_BOT_CONTEXT&&window.JINPO_BOT_CONTEXT.resolve?window.JINPO_BOT_CONTEXT.resolve(t,h||[]):{original:t,message:t,resolved:false};},installTransport:install};
  install();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});window.addEventListener('load',install,{once:true});
})();
