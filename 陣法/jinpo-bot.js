(function(){
  'use strict';
  if(window.__JINPO_LOCAL_BOT_INSTALLED__) return;
  window.__JINPO_LOCAL_BOT_INSTALLED__=true;
  var VERSION='2.5.0';
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
  function smalltalk(kind){if(kind==='greeting')return'こんにちは。歩き巫女なのですよ。おすすめ探しから細かな陣法相談までお手伝いできます。';if(kind==='thanks')return'どういたしましてなのですよ。続けてそのまま話しかけてくださいね。';if(kind==='weather')return'そうですね。無理せず快適に過ごしてくださいね。陣法の相談もそのまま続けられるのですよ。';if(kind==='identity')return'歩き巫女なのですよ。陣法探しや編成、差替、強化まわりを気軽な言葉からお手伝いする役なのです。';return'';}

  function isRestorableAction(name){return ['apply_result','apply_swap','clear_placement','set_owned_hero','set_owned_hero_auto','clear_owned_hero','clear_owned_heroes','set_excluded_hero','clear_excluded_heroes','load_saved','import_json'].indexOf(name)>=0;}
  function isNonRestorableMutation(name){return ['exit_recommended','all_max','clear_all_max','panel_max','panel_clear','set_kenbun','set_kishin','set_tensei','save_current','delete_saved','apply_override_bond_master','reset_bond_master','clear_formation_master','reset_all'].indexOf(name)>=0;}

  async function handle(payload){
    if(!actions()||!parser()||!state()||!help()||!interpreter())return R('歩き巫女の構成ファイルが不足しています。Bot基盤のJSファイルを読み込み順どおり確認してください。');
    var message=typeof payload==='string'?payload:String(payload&&payload.message||'');
    var originalMessage=message;
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
        var cap=capabilities().resolve(originalMessage)||capabilities().resolve(message);
        if(cap&&cap.kind==='clarify')return R(cap.question,{needsClarification:true,capability:cap});
        if(cap&&cap.kind==='execute'){plan.actions.push({name:cap.action,args:cap.args||{}});plan.recognized=true;}
      }catch(capErr2){}
    }
    if(plan.helpKey)return R(help().get(plan.helpKey));
    if(plan.smalltalk&&!plan.recognized)return R(smalltalk(plan.smalltalk));
    if(!plan.recognized&&window.JINPO_BOT_SMALLTALK&&typeof window.JINPO_BOT_SMALLTALK.respond==='function'){
      try{
        var chat=await window.JINPO_BOT_SMALLTALK.respond(originalMessage);
        if(chat&&chat.handled){
          return {answer:String(chat.answer||''),sources:Array.isArray(chat.sources)?chat.sources:[],mode:String(chat.mode||'日常会話'),data:{smalltalk:true}};
        }
      }catch(chatErr){}
    }

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
    return R(lines.join('\n'),{state:after});
  }

  function install(){window.JINPO_AI_TRANSPORT=handle;if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setTransport==='function')window.JINPO_AI_CHAT.setTransport(handle);}
  window.JINPO_BOT={version:VERSION,handle:handle,parse:function(t){return parser()&&parser().parse(t);},getState:function(){return state()&&state().getConditions();},readSiteState:function(){return actions()&&actions().readSiteState();},listActions:function(){return actions()?actions().registry.slice():[];},installTransport:install};
  install();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});window.addEventListener('load',install,{once:true});
})();
