(function(){
  'use strict';
  if(window.__JINPO_LOCAL_BOT_INSTALLED__) return;
  window.__JINPO_LOCAL_BOT_INSTALLED__=true;
  var VERSION='3.26.0';
  var MODE='歩き巫女';
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
    s=s||{};var p=[];
    if(s.formation)p.push('陣形 '+s.formation);
    if(s.count)p.push(s.count+'因縁');
    p.push(s.searchBasis==='fullmax'?'全MAX込み基準':'基礎値基準');
    if(s.priority1){var x='第1 '+s.priority1;if(s.priority1Min!=null)x+=' '+s.priority1Min+'以上';if(s.priority1Max!=null)x+=' '+s.priority1Max+'以下';p.push(x);}
    if(s.priority2){var y='第2 '+s.priority2;if(s.priority2Min!=null)y+=' '+s.priority2Min+'以上';if(s.priority2Max!=null)y+=' '+s.priority2Max+'以下';p.push(y);}
    if(s.grade3)p.push('等級3以下 ON');
    if(Number(s.factor4Exclude)>0)p.push('文曲除外 '+s.factor4Exclude+'人');
    if(s.sumSort)p.push('第1・第2合計ソート ON');
    if(Array.isArray(s.owned)){var ownedCount=s.owned.filter(function(x){return !!x;}).length;if(ownedCount)p.push('配置英傑指定 '+ownedCount+'枠');}
    if(Array.isArray(s.excluded)&&s.excluded.length)p.push('除外英傑 '+s.excluded.length+'人');
    if(s.recommendActive)p.push('おすすめモード中');
    return p.join(' / ');
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

  // 人物文脈が切れた後の「家族は？」を、昔の人物へ勝手に戻したり
  // 汎用エラーに落としたりせず、必要な主語だけ自然に聞き返す。
  function barePersonRelationClarification(text){
    var t=String(text||'').trim();
    if(/^(?:家族|親族)(?:は|って|について)?[？?。！!]*$/.test(t))return'誰の家族についてですか？ 人物名だけ教えてもらえれば、その人の話として続けます。';
    if(/^(?:奥さん|妻|嫁|配偶者|夫人|旦那|夫)(?:は|って|について)?[？?。！!]*$/.test(t))return'誰の配偶者についてですか？ 人物名を一つ教えてください。';
    if(/^(?:父親|お父さん|父|母親|お母さん|母|兄弟|姉妹)(?:は|って|について)?[？?。！!]*$/.test(t))return'誰についての家族関係ですか？ 人物名を一つ教えてください。';
    return'';
  }

  function isRestorableAction(name){
    return [
      'apply_result','apply_swap','clear_placement',
      'set_owned_hero','set_owned_hero_auto','clear_owned_hero','clear_owned_heroes',
      'set_excluded_hero','clear_excluded_heroes','load_saved','import_json',
      'set_formation','set_bond_count','set_grade3','set_factor4_exclude',
      'set_priority1','set_priority2','clear_priority1','clear_priority2','clear_priorities',
      'set_sum_sort','set_search_basis','set_fullmax_search','set_base_search','clear_search_filters'
    ].indexOf(name)>=0;
  }
  function isSearchExecutionName(name){
    return [
      'apply_search','run_recommended','update_recommended',
      'run_best','run_specified_simple','run_current_search','rerun_search'
    ].indexOf(name)>=0;
  }

  // 会話の「前の話に戻って」で、過去のサイト操作をもう一度実行しない。
  // 検索・適用・解除・配置・除外などは「話題として復帰」だけ行う。
  function isBackReplayRisk(control){
    if(!control||control.control!=='back')return false;
    var t=String(control.sourceText||control.restoreMessage||'').trim();
    if(!t)return false;
    return /(?:検索(?:して|したい|する|お願い|実行して)|探して|探したい|おすすめ(?:を)?(?:出して|探して|検索して|実行して)|(?:[0-9０-９]+(?:位|番目)?|検索結果[^、。！？\s]*)を?適用(?:して|する)?|適用(?:して|する|したい|お願い)|解除(?:して|する|したい|お願い)|全解除(?:して|する|お願い)|差替(?:して|する|したい)|差し替(?:えて|える|えたい)|配置(?:して|する|したい|お願い)|除外(?:して|する|したい|お願い)|固定(?:して|する|したい)|実行(?:して|する|お願い)|押して|変更(?:して|する|したい)|切替(?:して|する)|切り替(?:えて|える)|全MAX(?:にして|解除して|解除する|ONにして|オンにして)|保存(?:して|する)|削除(?:して|する)|読み込(?:んで|む)|読込(?:して|する)|インポート(?:して|する)|リセット(?:して|する))/.test(t);
  }

  function backResumeWithoutReplay(control){
    var source=String(control&&control.sourceText||control&&control.restoreMessage||'').trim();
    var shown=source?('前回の内容は「'+source+'」です。\n'):'';
    var topic=String(control&&control.domain||'')==='jinpo'?'前の陣法の話':'前の操作の話';
    return {
      answer:topic+'に戻りました。過去の操作は再実行していません。\n'+shown+'条件を変える場合は、そのまま続けてください。',
      sources:[],links:[],mode:'会話制御',
      data:{conversationControl:'back',domain:'jinpo',resumedWithoutReplay:true,sourceText:source}
    };
  }

  function lastSearchRecipe(plan,outputs){
    plan=plan||{};outputs=Array.isArray(outputs)?outputs:[];
    for(var i=outputs.length-1;i>=0;i--){
      var o=outputs[i]||{},r=o.res||{},d=r.data||{};
      if(!r.ok||d.skipped||!isSearchExecutionName(o.name))continue;

      if(o.name==='run_best'){
        var a=(plan.actions||[]).find(function(x){return x&&x.name==='run_best';});
        return {action:'run_best',args:a&&a.args||{}};
      }
      if(o.name==='run_recommended'){
        return {action:'run_recommended',args:{stat:plan.recommendStat||''}};
      }
      if(o.name==='update_recommended'){
        var ur=(plan.actions||[]).find(function(x){return x&&x.name==='update_recommended';});
        return {action:'update_recommended',args:ur&&ur.args||plan.searchPatch||{}};
      }
      if(o.name==='run_specified_simple'){
        var sr=(plan.actions||[]).find(function(x){return x&&x.name==='run_specified_simple';});
        return {action:'run_specified_simple',args:sr&&sr.args||{}};
      }
      return {action:'run_current_search',args:{}};
    }
    return null;
  }

  function boolLabel(v){return v?'ON':'OFF';}

  function priorityConditionLabel(s,index){
    s=s||{};
    var stat=index===1?s.priority1:s.priority2;
    var min=index===1?s.priority1Min:s.priority2Min;
    var max=index===1?s.priority1Max:s.priority2Max;
    if(!stat)return'なし';
    var x=String(stat);
    if(min!=null&&min!=='')x+=' '+min+'以上';
    if(max!=null&&max!=='')x+=' '+max+'以下';
    return x;
  }

  function ownedConditionLabel(list){
    list=Array.isArray(list)?list:[];
    var out=[];
    for(var i=0;i<3;i++){
      if(list[i])out.push((i+1)+':'+list[i]);
    }
    return out.length?out.join(' / '):'なし';
  }

  function excludedConditionLabel(list){
    list=Array.isArray(list)?list.slice():[];
    list=list.filter(function(x){return !!x;}).map(String).sort();
    return list.length?list.join(' / '):'なし';
  }

  function searchRecipeLabel(recipe){
    var a=recipe&&recipe.action||'';
    if(a==='run_best')return'全陣形おすすめ検索';
    if(a==='run_recommended')return'おすすめ陣法検索';
    if(a==='update_recommended')return'おすすめ条件更新';
    if(a==='run_specified_simple')return'指定検索';
    if(a==='run_current_search')return'指定条件検索';
    return a?String(a):'不明';
  }

  function conditionDiff(before,after,recipeBefore,recipeAfter){
    before=before||{};after=after||{};
    var diffs=[];

    function add(key,a,b){
      a=String(a);b=String(b);
      if(a!==b)diffs.push({key:key,before:a,after:b});
    }

    add('陣形',before.formation||'未指定',after.formation||'未指定');
    add('因縁数',before.count?before.count+'因縁':'未指定',after.count?after.count+'因縁':'未指定');
    add('検索基準',before.searchBasis==='fullmax'?'全MAX込み':'基礎値',after.searchBasis==='fullmax'?'全MAX込み':'基礎値');

    add('第1',priorityConditionLabel(before,1),priorityConditionLabel(after,1));
    add('第2',priorityConditionLabel(before,2),priorityConditionLabel(after,2));

    add('等級3以下',boolLabel(!!before.grade3),boolLabel(!!after.grade3));
    add('文曲除外',String(Number(before.factor4Exclude)||0)+'人',String(Number(after.factor4Exclude)||0)+'人');

    var bSum=before.sumSort?('ON'+(before.sumTie==='second'?'（第2優先）':'（第1優先）')):'OFF';
    var aSum=after.sumSort?('ON'+(after.sumTie==='second'?'（第2優先）':'（第1優先）')):'OFF';
    add('2項目合計ソート',bSum,aSum);

    add('配置英傑条件',ownedConditionLabel(before.owned),ownedConditionLabel(after.owned));
    add('除外英傑',excludedConditionLabel(before.excluded),excludedConditionLabel(after.excluded));

    // 「検索基準の全MAX込み」と強化画面の全MAXは別物。
    add('全MAX強化状態',boolLabel(!!before.allMax),boolLabel(!!after.allMax));

    if(recipeBefore||recipeAfter){
      add('検索方式',searchRecipeLabel(recipeBefore),searchRecipeLabel(recipeAfter));
    }

    return diffs;
  }

  function formatConditionDiff(before,after,labelBefore,labelAfter,recipeBefore,recipeAfter){
    var diffs=conditionDiff(before,after,recipeBefore,recipeAfter);
    var title=String(labelBefore||'変更前')+' → '+String(labelAfter||'変更後');
    if(!diffs.length)return title+'\n条件差分はありません。';

    return title+'\n'+diffs.map(function(d){
      return '・'+d.key+'：'+d.before+' → '+d.after;
    }).join('\n');
  }

  function historyIndexLabel(index){
    var n=Math.max(1,Number(index)||1);
    if(n===1)return'前回';
    return n+'つ前';
  }

  function searchHistorySummary(items){
    items=Array.isArray(items)?items:[];
    if(!items.length)return'検索履歴はまだありません。';

    var lines=['最近の検索履歴です。'];
    items.slice(0,5).forEach(function(item,i){
      var recipe=item&&item.recipe&&item.recipe.action||'';
      var kind=recipe==='run_best'?'全陣形おすすめ':
        recipe==='run_recommended'?'おすすめ陣法':
        recipe==='update_recommended'?'おすすめ条件更新':
        recipe==='run_specified_simple'?'指定検索':
        '条件検索';

      var state=item&&item.snapshot||{};
      var compact=[];
      if(state.formation)compact.push(state.formation);
      if(state.count)compact.push(state.count+'因縁');
      if(state.searchBasis==='fullmax')compact.push('全MAX込み');
      if(state.priority1)compact.push('第1 '+state.priority1);
      if(state.priority2)compact.push('第2 '+state.priority2);

      lines.push(
        (i+1)+'. '+kind+
        (compact.length?' / '+compact.join(' / '):'')+
        (item&&item.label?' / 「'+String(item.label).slice(0,30)+'」':'')
      );
    });
    return lines.join('\n');
  }

  function historyItemSummary(item,index){
    if(!item||!item.snapshot)return historyIndexLabel(index)+'の検索記録はありません。';
    return historyIndexLabel(index)+'の検索：\n'+lastSearchSummary(item);
  }

  function lastSearchSummary(item){
    if(!item||!item.snapshot)return'前回の検索記録はまだありません。';
    var when='';
    if(item.at){try{when=new Date(item.at).toLocaleString('ja-JP');}catch(e){}}
    var recipe=item.recipe&&item.recipe.action?item.recipe.action:'';
    var kind=recipe==='run_best'?'全陣形おすすめ検索':
      recipe==='run_recommended'?'おすすめ陣法検索':
      recipe==='update_recommended'?'おすすめ条件更新':
      recipe==='run_specified_simple'?'指定検索':
      '指定条件検索';

    return (when?'前回：'+when+'\n':'')+
      conditionLabel(item.snapshot)+'\n検索方式：'+kind;
  }

  function isNonRestorableMutation(name){return ['exit_recommended','all_max','clear_all_max','panel_max','panel_clear','set_kenbun','set_kishin','set_tensei','save_current','delete_saved','apply_override_bond_master','reset_bond_master','clear_formation_master','reset_all'].indexOf(name)>=0;}

  // 「両方／二人とも」で明示的に2人物を選んだ後の裸の観点質問は、
  // 片方へ勝手に寄せず既存の複合質問処理へ渡す。
  // 履歴上で別話題・前者/後者・人物名指定が入った時点で効かなくする。
  function expandRecentBothPersonFollowup(text,history){
    var raw=String(text||'').trim();
    if(!raw||!window.JINPO_BOT_CONVERSATION)return '';
    var C=window.JINPO_BOT_CONVERSATION;
    if(typeof C.parallelTopics!=='function')return '';

    var slots=C.parallelTopics(history||[],raw)||[];
    var subjects=[],ok=true;
    slots.forEach(function(slot){
      if(!slot||slot.type!=='person'||!slot.subject)ok=false;
      else if(subjects.indexOf(String(slot.subject))<0)subjects.push(String(slot.subject));
    });

    // 曖昧確認に対して「両方／二人とも」と明示された瞬間から、2人物を別々に回答する。
    if(/^(?:両方|両方とも|二人とも|2人とも|どっちも|どちらも)[？?！!。]*$/i.test(raw)){
      if(ok&&subjects.length===2)return subjects[0]+'について教えて、それと'+subjects[1]+'について教えて';
      return '';
    }

    var aspect='',overviewMore=false,moreCue=/^(?:もっと|もっと詳しく|詳しく|もう少し|続き|続きは|その続き)[？?！!。]*$/i.test(raw);
    if(/^家族(?:は|について)?[？?]?$/i.test(raw))aspect='家族を教えて';
    else if(/^(?:成績|記録|実績)(?:は|について)?[？?]?$/i.test(raw))aspect='成績を教えて';
    else if(/^(?:逸話|エピソード)(?:は|について)?[？?]?$/i.test(raw))aspect='逸話を教えて';
    else if(/^(?:経歴|現役時代)(?:は|について)?[？?]?$/i.test(raw))aspect='経歴を教えて';
    else if(/^(?:奥さん|妻|配偶者)(?:は|について)?[？?]?$/i.test(raw))aspect='妻・配偶者について教えて';
    else if(/^(?:何歳|年齢)(?:だったっけ|だっけ|なの|ですか|は)?[？?]?$/i.test(raw))aspect='何歳？';
    else if(/^(?:今|現在)(?:は)?何してる(?:の|ん|のですか)?[？?]?$/i.test(raw))aspect='今何してる？';
    else if(/^現役(?:だったっけ|なの|ですか|は)?[？?]?$/i.test(raw))aspect='現役だった？';
    else if(/^(?:いつ)?引退(?:した|したっけ|したの|ですか)?[？?]?$/i.test(raw))aspect='いつ引退した？';

    if(slots.length!==2||!ok||subjects.length!==2)return '';

    // 「もっと」系は、両方を選んだ後で最後に共有していた観点を2人とも維持する。
    if(moreCue){
      var mh=Array.isArray(history)?history:[],foundBothForMore=false,resumedBothForMore=false;
      for(var mi=mh.length-1;mi>=0;mi--){
        var mitem=mh[mi]||{};if(mitem.role!=='user')continue;
        var mu=String(mitem.text||'').trim();if(!mu)continue;
        if(/^(?:両方|両方とも|二人とも|2人とも|どっちも|どちらも)[？?！!。]*$/i.test(mu)){foundBothForMore=true;break;}
        if(/^(?:前の話|さっきの話)(?:に|へ)?戻(?:って|る|ろう|して)[？?！!。]*$/i.test(mu)){
          if(expandBackToBothPersonBranch(mu,mh.slice(0,mi+1))){resumedBothForMore=true;continue;}
          return '';
        }
        if(/^家族(?:は|について)?[？?]?$/i.test(mu)){aspect='家族についてもっと教えて';break;}
        if(/^(?:成績|記録|実績)(?:は|について)?[？?]?$/i.test(mu)){aspect='成績についてもっと教えて';break;}
        if(/^(?:逸話|エピソード)(?:は|について)?[？?]?$/i.test(mu)){aspect='逸話についてもっと教えて';break;}
        if(/^(?:経歴|現役時代)(?:は|について)?[？?]?$/i.test(mu)){aspect='経歴についてもっと教えて';break;}
        if(/^(?:奥さん|妻|配偶者)(?:は|について)?[？?]?$/i.test(mu)){aspect='妻・配偶者についてもっと教えて';break;}
        if(/^(?:もっと|もっと詳しく|詳しく|もう少し|続き|続きは|その続き)[？?！!。]*$/i.test(mu))continue;
        if(/^(?:うん|はい|そう|なるほど|ありがとう|ありがと|了解|わかった|分かった)[ねよ！!。？?]*$/i.test(mu))continue;
        if(resumedBothForMore)continue;
        return '';
      }
      if(!aspect){
        if(!foundBothForMore)return '';
        overviewMore=true;
      }
    }
    if(!aspect&&!overviewMore)return '';

    // 直近の「両方」以降に、裸の観点質問・軽い相槌以外があれば両人物状態を終了扱いにする。
    var h=Array.isArray(history)?history:[],foundBoth=false,resumedBoth=false;
    for(var i=h.length-1;i>=0;i--){
      var item=h[i]||{};if(item.role!=='user')continue;
      var u=String(item.text||'').trim();if(!u)continue;
      if(/^(?:両方|両方とも|二人とも|2人とも|どっちも|どちらも)[？?！!。]*$/i.test(u)){foundBoth=true;break;}
      if(/^(?:前の話|さっきの話)(?:に|へ)?戻(?:って|る|ろう|して)[？?！!。]*$/i.test(u)){
        if(expandBackToBothPersonBranch(u,h.slice(0,i+1))){resumedBoth=true;continue;}
        return '';
      }
      if(/^(?:前者|後者|最初の方|最初のほう|後の方|後のほう|もう片方|もう一方)(?:は|って|について)?[？?！!。]*$/i.test(u))return '';
      if(/^(?:家族|成績|記録|実績|逸話|エピソード|経歴|現役時代|奥さん|妻|配偶者)(?:は|について)?[？?]?$/i.test(u))continue;
      if(/^(?:何歳|年齢)(?:だったっけ|だっけ|なの|ですか|は)?[？?]?$/i.test(u))continue;
      if(/^(?:今|現在)(?:は)?何してる(?:の|ん|のですか)?[？?]?$/i.test(u))continue;
      if(/^現役(?:だったっけ|なの|ですか|は)?[？?]?$/i.test(u))continue;
      if(/^(?:いつ)?引退(?:した|したっけ|したの|ですか)?[？?]?$/i.test(u))continue;
      if(/^(?:もっと|もっと詳しく|詳しく|もう少し|続き|続きは|その続き)[？?！!。]*$/i.test(u))continue;
      if(/^(?:うん|はい|そう|なるほど|ありがとう|ありがと|了解|わかった|分かった)[ねよ！!。？?]*$/i.test(u))continue;
      if(resumedBoth)continue;
      return '';
    }
    if(!foundBoth)return '';

    var a=subjects[0],b=subjects[1];
    function clause(subject){
      if(overviewMore)return subject+'についてもっと教えて';
      if(/[？?]$/.test(aspect))return subject+'は'+aspect;
      return subject+'の'+aspect;
    }
    return clause(a)+'、それと'+clause(b);
  }

  // 2人物を「両方」で話していた枝から別話題へ移った後の「前の話に戻って」は、
  // 裸の「家族は？」等だけを復元せず、2人物＋その観点を複合質問として復元する。
  function expandBackToBothPersonBranch(text,history){
    var raw=String(text||'').trim();
    if(!/^(?:前の話|さっきの話)(?:に|へ)?戻(?:って|る|ろう|して)[？?！!。]*$/i.test(raw))return '';
    var C=window.JINPO_BOT_CONVERSATION;
    if(!C||typeof C.parallelTopics!=='function')return '';
    var slots=C.parallelTopics(history||[],raw)||[],subjects=[],ok=true;
    slots.forEach(function(slot){
      if(!slot||slot.type!=='person'||!slot.subject)ok=false;
      else if(subjects.indexOf(String(slot.subject))<0)subjects.push(String(slot.subject));
    });
    if(!ok||subjects.length!==2)return '';

    var h=Array.isArray(history)?history:[],bothAt=-1;
    for(var i=h.length-1;i>=0;i--){
      var it=h[i]||{};if(it.role!=='user')continue;
      if(/^(?:両方|両方とも|二人とも|2人とも|どっちも|どちらも)[？?！!。]*$/i.test(String(it.text||'').trim())){bothAt=i;break;}
    }
    if(bothAt<0)return '';

    var kind='overview',leftBoth=false,terminated=false;
    function aspectKind(u){
      if(/^家族(?:は|について)?[？?]?$/i.test(u))return 'family';
      if(/^(?:成績|記録|実績)(?:は|について)?[？?]?$/i.test(u))return 'stats';
      if(/^(?:逸話|エピソード)(?:は|について)?[？?]?$/i.test(u))return 'anecdote';
      if(/^(?:経歴|現役時代)(?:は|について)?[？?]?$/i.test(u))return 'career';
      if(/^(?:奥さん|妻|配偶者)(?:は|について)?[？?]?$/i.test(u))return 'spouse';
      if(/^(?:何歳|年齢)(?:だったっけ|だっけ|なの|ですか|は)?[？?]?$/i.test(u))return 'age';
      if(/^(?:今|現在)(?:は)?何してる(?:の|ん|のですか)?[？?]?$/i.test(u))return 'current';
      if(/^現役(?:だったっけ|なの|ですか|は)?[？?]?$/i.test(u))return 'active';
      if(/^(?:いつ)?引退(?:した|したっけ|したの|ですか)?[？?]?$/i.test(u))return 'retirement';
      return '';
    }
    for(var j=bothAt+1;j<h.length;j++){
      var x=h[j]||{};if(x.role!=='user')continue;
      var u=String(x.text||'').trim();if(!u||u===raw)continue;
      if(/^(?:前者|後者|最初の方|最初のほう|後の方|後のほう|もう片方|もう一方)(?:は|って|について)?[？?！!。]*$/i.test(u)){terminated=true;break;}
      var k=aspectKind(u);
      if(!leftBoth&&k){kind=k;continue;}
      if(!leftBoth&&/^(?:もっと|もっと詳しく|詳しく|もう少し|続き|続きは|その続き)[？?！!。]*$/i.test(u))continue;
      if(/^(?:うん|はい|そう|なるほど|ありがとう|ありがと|了解|わかった|分かった)[ねよ！!。？?]*$/i.test(u))continue;
      // 両方の枝から別の実質話題へ移ったと判断。
      leftBoth=true;
    }
    if(terminated||!leftBoth)return '';

    function clause(subject){
      if(kind==='family')return subject+'の家族を教えて';
      if(kind==='stats')return subject+'の成績を教えて';
      if(kind==='anecdote')return subject+'の逸話を教えて';
      if(kind==='career')return subject+'の経歴を教えて';
      if(kind==='spouse')return subject+'の妻・配偶者について教えて';
      if(kind==='age')return subject+'は何歳？';
      if(kind==='current')return subject+'は今何してる？';
      if(kind==='active')return subject+'は現役だった？';
      if(kind==='retirement')return subject+'はいつ引退した？';
      return subject+'について教えて';
    }
    return clause(subjects[0])+'、それと'+clause(subjects[1]);
  }

  function resetConversationState(opt){
    opt=opt||{};
    var epoch=0,errors=[];

    try{
      if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.resetContext==='function'){
        epoch=window.JINPO_BOT_CONVERSATION.resetContext();
      }
    }catch(e){errors.push('conversation');}

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
    var userMessage=message;
    var originalMessage=message;
    var history=Array.isArray(payloadObj.history)?payloadObj.history:[];
    var compoundChild=!!payloadObj.__compoundChild;

    // 先に会話リセット以前の履歴を除外。
    // その有効履歴を使って、候補追質問でも必要な正本をlazy選択する。
    try{
      if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.filterHistory==='function'){
        history=window.JINPO_BOT_CONVERSATION.filterHistory(history);
      }
    }catch(historyEpochErr){}

    // 直近で2人物を「両方」と確定している場合、裸の観点質問を複合質問へ展開してから
    // lazy選択・複合分割へ渡す。画面上のユーザー発話そのものは履歴側に残る。
    if(!compoundChild){
      try{
        var bothBackExpanded=expandBackToBothPersonBranch(originalMessage,history);
        var bothPersonExpanded=bothBackExpanded||expandRecentBothPersonFollowup(originalMessage,history);
        if(bothPersonExpanded){
          message=bothPersonExpanded;
          originalMessage=bothPersonExpanded;
        }
      }catch(bothPersonErr){
        console.warn('歩き巫女 both-person followup:',bothPersonErr);
      }
    }

    try{
      if(window.ARUKIMIKO_LAZY&&typeof window.ARUKIMIKO_LAZY.ensureForMessage==='function'){
        await window.ARUKIMIKO_LAZY.ensureForMessage(originalMessage,history);
      }
    }catch(lazyErr){
      console.error('歩き巫女 message lazy load:',lazyErr);
    }

    var pageContext={mode:window.JINPO_BOT_PAGE_MODE||'',path:'',title:''};
    try{
      if(window.JINPO_BOT_PAGE_CONTEXT&&typeof window.JINPO_BOT_PAGE_CONTEXT.snapshot==='function')pageContext=window.JINPO_BOT_PAGE_CONTEXT.snapshot()||pageContext;
    }catch(pageContextErr){}

    // ユーザーの訂正・否定・話題指定は、各専門ルーターより先に処理する。
    // 「英傑じゃない」「違う、カープの前田」「カープの話へ変えて」などで、
    // 古い人物・分野・pendingを押し通さず、現在の指示を最優先する。
    var repairInfo=null;
    try{
      if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.repairDirective==='function'){
        repairInfo=window.JINPO_BOT_CONVERSATION.repairDirective(userMessage,history);
      }
    }catch(repairDetectErr){repairInfo=null;}

    if(repairInfo&&repairInfo.handled){
      resetTransientConversationState();
      if(repairInfo.direct){
        return {
          answer:String(repairInfo.answer||'分かりました。今の解釈はいったん取り消します。'),
          sources:[],links:[],mode:'会話修正',
          data:{
            conversationRepair:true,
            contextBoundary:repairInfo.contextBoundary!==false,
            pendingRepair:!!repairInfo.pendingRepair,
            rejectedRoute:String(repairInfo.rejectedRoute||''),
            repairTargetDomain:String(repairInfo.targetRoute||''),
            preservedQuery:String(repairInfo.preservedQuery||''),
            subjectHint:String(repairInfo.subjectHint||''),
            topicSwitch:!!repairInfo.topicSwitch,
            lastMode:String(repairInfo.lastMode||'')
          }
        };
      }
      if(repairInfo.rewrite&&repairInfo.message){
        message=String(repairInfo.message);
        originalMessage=message;
        userMessage=message;
        // 訂正前の履歴から主語・分野を再注入しない。復帰命令ではないため、
        // このターンは訂正後の文だけを新しい会話として処理する。
        if(repairInfo.contextBoundary)history=[];
        try{
          if(window.ARUKIMIKO_LAZY&&typeof window.ARUKIMIKO_LAZY.ensureForMessage==='function'){
            await window.ARUKIMIKO_LAZY.ensureForMessage(message,history);
          }
        }catch(repairLazyErr){}
      }
    }

    // 1つの発言に複数の独立した質問・依頼がある場合は、順番を保ったまま個別処理する。
    // 子処理では再分割しないため、再帰ループにはならない。
    if(!compoundChild&&window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.splitCompoundIntents==='function'){
      try{
        var compoundParts=window.JINPO_BOT_CONVERSATION.splitCompoundIntents(originalMessage)||[];
        if(compoundParts.length>1){
          var baseHistory=history.slice();
          while(baseHistory.length&&baseHistory[baseHistory.length-1]&&baseHistory[baseHistory.length-1].role==='system')baseHistory.pop();
          if(baseHistory.length&&baseHistory[baseHistory.length-1]&&baseHistory[baseHistory.length-1].role==='user'){
            var lastBaseUser=String(baseHistory[baseHistory.length-1].text||'').trim();
            if(lastBaseUser===String(userMessage||'').trim()||lastBaseUser===originalMessage.trim())baseHistory.pop();
          }

          var compoundAnswers=[],compoundSources=[],compoundLinks=[],compoundModes=[],completed=0;
          var evolvingHistory=baseHistory.slice(),stopForFollowup=false,lastCompoundSiteItem='';
          var seenSource={},seenLink={};

          for(var ci=0;ci<compoundParts.length;ci++){
            var part=String(compoundParts[ci]||'').trim();if(!part)continue;
            var at=Date.now()+ci;
            var childHistory=evolvingHistory.concat([{role:'user',text:part,at:at}]);
            var child=await handle({message:part,history:childHistory,__compoundChild:true});
            child=child||{};
            var childAnswer=String(child.answer||'').trim();
            var childSiteItem=child&&child.data&&child.data.siteGuide?String(child.data.siteItem||''):'';
            if(childAnswer&&childSiteItem&&lastCompoundSiteItem===childSiteItem){
              // 同じページへの複数質問では「○○についてですね」を繰り返さず、自然に続ける。
              childAnswer=childAnswer.replace(/^「[^」]+」についてですね。[\s]*/,'また、');
            }
            if(childAnswer){
              compoundAnswers.push(childAnswer);
              evolvingHistory.push({role:'user',text:part,at:at});
              // 複合発話の次の節でも「何個まで？→九十九は？」の観点を引き継げるよう、
              // サイト案内の最小メタデータだけを内部履歴へ残す。回答本文や正本データは複製しない。
              var childMeta={mode:String(child.mode||'')};
              if(child.data&&child.data.siteGuide){
                childMeta.data={
                  siteGuide:true,
                  siteItem:String(child.data.siteItem||''),
                  siteFeature:String(child.data.siteFeature||''),
                  siteFeatures:Array.isArray(child.data.siteFeatures)?child.data.siteFeatures.slice(0,8):[],
                  siteFeatureSubjects:Array.isArray(child.data.siteFeatureSubjects)?child.data.siteFeatureSubjects.slice(0,8):[],
                  siteItems:Array.isArray(child.data.siteItems)?child.data.siteItems.slice(0,8):[],
                  siteComparison:Array.isArray(child.data.siteComparison)?child.data.siteComparison.slice(0,8):[],
                  candidates:Array.isArray(child.data.candidates)?child.data.candidates.slice(0,8):[],
                  siteCandidates:Array.isArray(child.data.siteCandidates)?child.data.siteCandidates.slice(0,8):[],
                  needsClarification:!!child.data.needsClarification
                };
                childMeta.links=Array.isArray(child.links)?child.links.slice(0,8):[];
              }
              evolvingHistory.push({role:'assistant',text:childAnswer,meta:childMeta,at:at+0.1});
            }
            (Array.isArray(child.sources)?child.sources:[]).forEach(function(src){
              var key=String(src&&src.url||src&&src.title||'');
              if(!key||seenSource[key])return;seenSource[key]=1;compoundSources.push(src);
            });
            (Array.isArray(child.links)?child.links:[]).forEach(function(link){
              var key=typeof link==='string'?link:String(link&&link.url||link&&link.href||link&&link.title||'');
              if(!key||seenLink[key])return;seenLink[key]=1;compoundLinks.push(link);
            });
            if(child.mode&&compoundModes.indexOf(String(child.mode))<0)compoundModes.push(String(child.mode));
            lastCompoundSiteItem=childSiteItem||'';
            completed++;

            var cd=child.data||{};
            stopForFollowup=!!(cd.needsClarification||cd.needsConfirmation||cd.needsLocation||cd.needsSpecifiedSearchCondition||cd.notFound||cd.temporaryError);
            if(stopForFollowup)break;
          }

          return {
            answer:compoundAnswers.join('\n\n'),
            sources:compoundSources,
            links:compoundLinks,
            mode:compoundModes.length>1?'複合会話':(compoundModes[0]||'複合会話'),
            data:{compound:true,parts:compoundParts.slice(),completed:completed,total:compoundParts.length,stoppedForFollowup:stopForFollowup}
          };
        }
      }catch(compoundErr){
        console.warn('歩き巫女 compound conversation:',compoundErr);
      }
    }


    function resetTransientConversationState(){
      try{
        if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.clearPending==='function'){
          window.JINPO_BOT_DIALOG.clearPending();
        }
      }catch(e){}
      try{
        if(interpreter()&&typeof interpreter().clearPending==='function'){
          interpreter().clearPending();
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

    // ローカル会話制御。
    // 「話を戻そう」は、天気の場所待ちや家臣名付けより先に処理する。
    var conversationControl=null;
    try{
      if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.control==='function'){
        conversationControl=window.JINPO_BOT_CONVERSATION.control(originalMessage,history);
      }
    }catch(controlErr){}

    // サイト案内で直前に複数候補を並べた直後だけ、
    // 「前者は保存？」「後者を開いて」を一般の話題復帰ではなく候補参照として扱う。
    // 古い候補や通常の「前の話に戻って」には適用しない。
    try{
      if(conversationControl&&conversationControl.control==='back'&&window.JINPO_BOT_SITE_GUIDE&&
         typeof window.JINPO_BOT_SITE_GUIDE.historyGuideContext==='function'&&typeof window.JINPO_BOT_SITE_GUIDE.preflight==='function'){
        var siteCandidateContext=window.JINPO_BOT_SITE_GUIDE.historyGuideContext(history)||{};
        var candidateIndex=Number(siteCandidateContext.candidateIndex);
        var candidateFresh=typeof window.JINPO_BOT_SITE_GUIDE.candidateContextFresh==='function'
          ?window.JINPO_BOT_SITE_GUIDE.candidateContextFresh(history,siteCandidateContext)
          :Array.isArray(siteCandidateContext.candidates)&&siteCandidateContext.candidates.length&&candidateIndex>=Math.max(0,(history||[]).length-3);
        if(candidateFresh&&window.JINPO_BOT_SITE_GUIDE.preflight(originalMessage,{history:history,pageContext:pageContext}))conversationControl=null;
      }
    }catch(siteCandidateControlErr){}

    if(conversationControl){
      try{
        if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.clearPending==='function'){
          window.JINPO_BOT_DIALOG.clearPending();
        }
      }catch(e){}
      try{
        if(interpreter()&&typeof interpreter().clearPending==='function'){
          interpreter().clearPending();
        }
      }catch(e){}
      try{
        if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.pause==='function'){
          window.JINPO_BOT_KASHIN_NAME.pause();
        }
      }catch(e){}

      if(conversationControl.control==='recall'){
        return {
          answer:String(conversationControl.answer||'直前の実質的な話題をこちらでは特定できませんでした。'),
          sources:[],links:[],mode:'会話記憶',
          data:{conversationControl:'recall',domain:conversationControl.domain||'',aspect:conversationControl.aspect||'',primary:conversationControl.primary||null}
        };
      }

      if(conversationControl.control==='change'){
        return {
          answer:'もちろんです。ここまでの途中入力はいったん止めました。別の話をそのままどうぞ。',
          sources:[],links:[],mode:'会話制御',
          data:{conversationControl:'change'}
        };
      }

      if(conversationControl.control==='fragment_cancel'){
        return {
          answer:'了解です。今の言いかけはここでやめておきます。',
          sources:[],links:[],mode:'会話制御',
          data:{conversationControl:'fragment_cancel',fragmentCancelled:true}
        };
      }

      if(conversationControl.control==='back'){
        if(conversationControl.restoreMessage){
          if(String(conversationControl.domain||'')==='kashin_name'&&window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.resume==='function'){
            try{
              var resumedNaming=window.JINPO_BOT_KASHIN_NAME.resume();
              if(resumedNaming&&resumedNaming.handled){
                return {answer:String(resumedNaming.answer||''),sources:[],links:[],mode:String(resumedNaming.mode||'家臣名付け'),data:{conversationControl:'back',domain:'kashin_name',resumedNaming:true}};
              }
            }catch(resumeNamingErr){}
          }
          if(isBackReplayRisk(conversationControl))return backResumeWithoutReplay(conversationControl);
          message=String(conversationControl.restoreMessage);
        }else{
          if(conversationControl.ambiguous&&Array.isArray(conversationControl.candidates)&&conversationControl.candidates.length){
            return {
              answer:'「もう片方」が複数候補に当てはまります。'+conversationControl.candidates.join('、')+'のどれに戻るか、名前で教えてください。',
              sources:[],links:[],mode:'会話制御',
              data:{conversationControl:'back',needsTopic:true,ambiguous:true,candidates:conversationControl.candidates.slice()}
            };
          }
          return {
            answer:'戻したい話題をこちらで特定できなかったのですよ。「カープの話に戻ろう」みたいに一言だけ足してもらえれば、そこへ戻します。',
            sources:[],links:[],mode:'会話制御',
            data:{conversationControl:'back',needsTopic:true}
          };
        }
      }
    }

    // 家臣名付けが進行中の時だけ、その継続入力を一般の文脈解決より先に受け取る。
    // 「もっと」「別の5個」などが以前の人物話題へ誤接続されるのを防ぐ。
    try{
      if(window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.state==='function'&&typeof window.JINPO_BOT_KASHIN_NAME.respond==='function'){
        var activeNamingState=window.JINPO_BOT_KASHIN_NAME.state();
        if(activeNamingState&&activeNamingState.active){
          // respond()自身に継続判定を任せる。別話題ならここでpauseされ、後続ルーターへ渡る。
          var activeNamingReply=window.JINPO_BOT_KASHIN_NAME.respond(originalMessage,{history:history,pageContext:pageContext});
          if(activeNamingReply&&activeNamingReply.handled){
            return {answer:String(activeNamingReply.answer||''),sources:[],links:[],mode:String(activeNamingReply.mode||'家臣名付け'),data:{kashinNaming:true,activeContinuation:true}};
          }
        }
      }
    }catch(activeNamingErr){}

    // 明確な日常会話は、陣法の意図推定より先に返す。
    // 「暑い」「疲れた」「何できる？」などを検索コマンドに誤分類しない。
    try{
      var blockEarlySmalltalk=false;
      try{
        var ip=interpreter()&&typeof interpreter().getPending==='function'?interpreter().getPending():null;
        var dp=window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.state==='function'?window.JINPO_BOT_DIALOG.state():null;
        var kp=window.JINPO_BOT_KASHIN_NAME&&typeof window.JINPO_BOT_KASHIN_NAME.state==='function'?window.JINPO_BOT_KASHIN_NAME.state():null;
        blockEarlySmalltalk=!!(ip||(dp&&dp.pending)||(kp&&kp.active));
        if(!blockEarlySmalltalk&&window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.activeRecentSubject==='function'){
          var rawContextual=String(originalMessage||'').trim();
          var contextualShort=/^(?:もっと|もう少し|詳しく|くわしく|続き(?:は|って)?|その続き(?:は|って)?|それで[？?]?|結局[？?]?|なんで[？?]?|なぜ[？?]?|どういう意味[？?]?)[。！!？?]*$/.test(rawContextual);
          var deicticContextual=/^(?:それ|これ|その件|この件|その話|この話|今の話|さっきの話)(?:の|は|って|について)?[、,\s]*(?:何ができる|なにができる|使い方(?:は|って)?|どう使う|どうやって使う|無料|タダ|料金(?:は|って)?|値段(?:は|って)?|安全|必要|難しい|簡単|何に使う|なにに使う|どこで使う|どこで使える|注意点(?:は|って)?|メリット(?:は|って)?|デメリット(?:は|って)?|もっと|もう少し|詳しく|くわしく)(?:なの|ですか|の|んですか)?[？?。！!]*$/.test(rawContextual);
          var discourseShort=/^(?:あれ|あの件|あの話|例のやつ|例の話|さっきのやつ|前のやつ|前のは|その前のやつ|その前のは|こっち|こっちの話|そっち|そっちの話|あっち|あっちの話)(?:は|って|について)?[？?。！!]*$/.test(rawContextual);
          if((contextualShort||deicticContextual||discourseShort)&&window.JINPO_BOT_CONVERSATION.activeRecentSubject(history))blockEarlySmalltalk=true;

          // 検索直後の「同じの／同じので／今ので」は、日常相槌ではなく
          // 直前の成功検索を指す短い再検索指示として扱う。
          // 別話題を挟んだ後の裸の「同じの」まで昔の検索へ飛ばさないよう、
          // 最後の成功検索ラベルと直前ユーザー発言が一致する時だけ優先する。
          if(!blockEarlySmalltalk&&pageContext.mode==='jinpo'&&/^(?:同じの|同じので|今ので)[。！!？?]*$/.test(rawContextual)){
            var recentSearch=state()&&typeof state().getLastSearch==='function'?state().getLastSearch():null;
            var previousUserText='';
            for(var hui=(history||[]).length-1;hui>=0;hui--){
              var hu=(history||[])[hui]||{};
              if(hu.role!=='user')continue;
              var hut=String(hu.text||hu.message||'').trim();
              if(!hut||hut===String(originalMessage||'').trim())continue;
              previousUserText=hut;break;
            }
            if(recentSearch&&String(recentSearch.label||'').trim()===previousUserText)blockEarlySmalltalk=true;
          }
        }
      }catch(pendingCheckErr){}

      // 用語案内直後の短い続きは、先に一般雑談へ取らせない。
      // 例: 「じんけい」→「魚鱗で」、「はいちえいけつ」→「前田慶次を入れて」。
      try{
        if(!blockEarlySmalltalk&&window.JINPO_BOT_SITE_GUIDE&&typeof window.JINPO_BOT_SITE_GUIDE.expandKnownTermFollowup==='function'){
          if(window.JINPO_BOT_SITE_GUIDE.expandKnownTermFollowup(originalMessage,history))blockEarlySmalltalk=true;
        }
      }catch(knownTermSmalltalkGuardErr){}

      // サイト案内として明確な入力は、一般雑談より先に受け取る。
      // 「陣法で何できんの」「桶狭間見たいんだけど」などが
      // 日常会話へ流れて案内文脈を失うのを防ぐ。
      try{
        if(!blockEarlySmalltalk&&window.JINPO_BOT_SITE_GUIDE&&typeof window.JINPO_BOT_SITE_GUIDE.preflight==='function'){
          if(window.JINPO_BOT_SITE_GUIDE.preflight(originalMessage,{history:history,pageContext:pageContext}))blockEarlySmalltalk=true;
        }
      }catch(siteGuidePreflightErr){}

      if(!blockEarlySmalltalk&&window.JINPO_BOT_SMALLTALK&&typeof window.JINPO_BOT_SMALLTALK.local==='function'){
        var quickTalk=window.JINPO_BOT_SMALLTALK.local(originalMessage,{history:history,pageContext:pageContext});
        // 日常会話はローカル会話エンジンで処理する。
        if(quickTalk){
          return {
            answer:String(quickTalk),
            sources:[],links:[],mode:'日常会話',
            data:{smalltalk:true,early:true,contextual:true}
          };
        }
      }
    }catch(quickTalkErr){}

    // 古いpendingより先に短い追質問の文脈を判定する。
    try{
      if(window.JINPO_BOT_CONVERSATION&&typeof window.JINPO_BOT_CONVERSATION.resolve==='function'){
        var earlyIntent=window.JINPO_BOT_CONVERSATION.resolve(message,history,{pageContext:pageContext});
        if(earlyIntent&&earlyIntent.message)message=String(earlyIntent.message);

        var earlyDomain=earlyIntent&&earlyIntent.domain?String(earlyIntent.domain):'';
        var jinpoStatOnly=
          pageContext.mode==='jinpo' &&
          /腕力|耐久|器用|知力|魅力|生命|気合|土|水|火|風/.test(originalMessage) &&
          !/天気|気温|予報|雨|雪/.test(originalMessage);

        if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.state==='function'){
          var eds=window.JINPO_BOT_DIALOG.state();
          if(eds&&eds.pending&&eds.pending.intent==='weather'&&
             ((earlyDomain&&earlyDomain!=='weather')||jinpoStatOnly)){
            window.JINPO_BOT_DIALOG.clearPending();
          }
        }
      }
    }catch(earlyContextErr){}

    // まず「今、何を聞いている途中か」を解決する。
    // 例: 天気 → (場所を質問) → 東京 を確実に「東京の天気」へつなぐ。
    var dialogInfo={handled:false,message:message};
    try{
      if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.preprocess==='function'){
        dialogInfo=window.JINPO_BOT_DIALOG.preprocess(message,{
          history:history,
          pageContext:pageContext,
          siteState:actions()&&typeof actions().readSiteState==='function'?actions().readSiteState():null
        })||dialogInfo;
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

    if(intentInfo&&intentInfo.referenceClarification){
      var siteReferenceHandled=false;
      try{
        siteReferenceHandled=!!(window.JINPO_BOT_SITE_GUIDE&&typeof window.JINPO_BOT_SITE_GUIDE.preflight==='function'&&
          window.JINPO_BOT_SITE_GUIDE.preflight(originalMessage,{history:history,pageContext:pageContext}));
      }catch(siteReferenceErr){}
      if(!siteReferenceHandled){
        return {answer:String(intentInfo.referenceClarification),sources:[],links:[],mode:'会話文脈',data:{needsReferenceClarification:true}};
      }
      // 直前のサイト候補だけで指示語を解決できる場合は、一般会話の曖昧確認よりサイト案内を優先する。
      message=originalMessage;
      intentInfo.message=originalMessage;
      intentInfo.referenceClarification='';
    }

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
            else if(dialogInfo.reason==='weather_follow_time')wp=(wr.requestTime==='day_after_tomorrow'?'明後日の天気ですね。':wr.requestTime==='tomorrow'?'明日の天気ですね。':'今日の天気ですね。');
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

    // 用語だけを受けた直後の短い続きは、直前のたいらの野望用語を補って専門正本へ渡す。
    // 例: 「英傑」→「腕力高いのは？」、「九十九」→「1番の能力」。
    try{
      if(window.JINPO_BOT_SITE_GUIDE&&typeof window.JINPO_BOT_SITE_GUIDE.expandKnownTermFollowup==='function'){
        var knownTermFollowup=window.JINPO_BOT_SITE_GUIDE.expandKnownTermFollowup(originalMessage,history);
        if(knownTermFollowup&&knownTermFollowup.message){
          message=String(knownTermFollowup.message);
          contextInfo=Object.assign({},contextInfo,{message:message,resolved:true,reason:String(knownTermFollowup.reason||'known_term_followup'),confidence:0.99,siteItem:String(knownTermFollowup.siteItem||'')});
        }
      }
    }catch(knownTermFollowupErr){}

    // ページ名・内部用語だけの発言は、人物名の部分一致よりサイト用語を優先する。
    // 例: 「家臣ステータス」を英傑名「家臣」の検索へ流さない。
    var bareSiteTermBeforeHero=null;
    try{
      if(window.JINPO_BOT_SITE_GUIDE&&typeof window.JINPO_BOT_SITE_GUIDE.bareKnownTerm==='function')bareSiteTermBeforeHero=window.JINPO_BOT_SITE_GUIDE.bareKnownTerm(originalMessage);
    }catch(bareSiteTermBeforeHeroErr){}

    // 英傑マスターの実データ質問は、英傑一覧ページ案内より先に処理する。
    // 例: 「腕力が高い英傑は誰？」「侍で知力トップ3」「豊臣秀長の因子は？」
    try{
      if(!bareSiteTermBeforeHero&&window.JINPO_BOT_HERO_KNOWLEDGE&&typeof window.JINPO_BOT_HERO_KNOWLEDGE.respond==='function'){
        var heroFact=window.JINPO_BOT_HERO_KNOWLEDGE.respond(message,{original:originalMessage,history:history,context:contextInfo,pageContext:pageContext});
        if(heroFact&&heroFact.handled){
          return {
            answer:String(heroFact.answer||''),
            sources:Array.isArray(heroFact.sources)?heroFact.sources:[],
            links:Array.isArray(heroFact.links)?heroFact.links:[],
            mode:String(heroFact.mode||'英傑マスター実データ'),
            data:Object.assign({heroKnowledge:true,context:contextInfo},heroFact.data||{})
          };
        }
      }
    }catch(heroKnowledgeErr){}

    // サイト実画面に関する質問は、カープの短い外国人名候補より先に処理する。
    // 「ルーレット」「トーナメント」「ダウンロード」などの一部分が
    // 選手名の別名へ誤一致しても、実画面案内を優先する。
    try{
      var proactiveGuideInput=(conversationControl&&conversationControl.control==='back'&&conversationControl.restoreMessage)||knownTermFollowup&&knownTermFollowup.message?String(message):String(userMessage);
      if(window.JINPO_BOT_SITE_GUIDE&&
         typeof window.JINPO_BOT_SITE_GUIDE.shouldHandleBeforeKnowledge==='function'&&
         typeof window.JINPO_BOT_SITE_GUIDE.respond==='function'&&
         !(knownTermFollowup&&knownTermFollowup.preferKnowledge)&&
         window.JINPO_BOT_SITE_GUIDE.shouldHandleBeforeKnowledge(proactiveGuideInput,{original:proactiveGuideInput,history:history,pageContext:pageContext,context:contextInfo,intentInfo:intentInfo})){
        var proactiveGuide=window.JINPO_BOT_SITE_GUIDE.respond(proactiveGuideInput,{original:proactiveGuideInput,history:history,context:contextInfo,intentInfo:intentInfo,pageContext:pageContext});
        if(proactiveGuide&&proactiveGuide.handled){
          return {
            answer:String(proactiveGuide.answer||''),
            sources:Array.isArray(proactiveGuide.sources)?proactiveGuide.sources:[],
            links:Array.isArray(proactiveGuide.links)?proactiveGuide.links:[],
            mode:String(proactiveGuide.mode||'サイト総合案内'),
            data:Object.assign({siteGuide:true,context:contextInfo,earlySiteGuide:true},proactiveGuide.data||{})
          };
        }
      }
    }catch(proactiveSiteGuideErr){}

    // カープ専用会話を直接使う。
    // これが無いと「カープ」を一般Webや別の途中タスクへ流してしまう。
    try{
      if(!(knownTermFollowup&&knownTermFollowup.jinpoOperation)&&window.JINPO_BOT_CARP&&typeof window.JINPO_BOT_CARP.respond==='function'){
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
        var naming=window.JINPO_BOT_KASHIN_NAME.respond(message,{history:history,context:contextInfo,pageContext:pageContext});
        if(naming&&naming.handled){
          return {answer:String(naming.answer||''),sources:[],links:[],mode:String(naming.mode||'家臣名付け'),data:{kashinNaming:true,context:contextInfo}};
        }
      }
    }catch(kashinNameErr){}

    // 話題復帰でサイト案内を復元した場合は、ユーザーが今送った「戻って」ではなく、
    // 会話制御が復元した元の案内質問をSITE_GUIDEへ渡す。
    var siteGuideInput=(conversationControl&&conversationControl.control==='back'&&conversationControl.restoreMessage)||knownTermFollowup&&knownTermFollowup.message?String(message):String(userMessage);

    // 明確なページ移動・使い方案内・候補選択は、専門データ回答より先に処理する。
    // ただし「鬼神石1番の入手」「足利義昭のカウンター」のような
    // 正本数値・個別対象の質問はSITE_GUIDE側の境界判定でここを通過しない。
    try{
      if(window.JINPO_BOT_SITE_GUIDE&&
         typeof window.JINPO_BOT_SITE_GUIDE.shouldHandleBeforeKnowledge==='function'&&
         typeof window.JINPO_BOT_SITE_GUIDE.respond==='function'&&
         !(knownTermFollowup&&knownTermFollowup.preferKnowledge)&&
         window.JINPO_BOT_SITE_GUIDE.shouldHandleBeforeKnowledge(siteGuideInput,{original:siteGuideInput,history:history,pageContext:pageContext,context:contextInfo,intentInfo:intentInfo})){
        var earlyGuide=window.JINPO_BOT_SITE_GUIDE.respond(siteGuideInput,{original:siteGuideInput,history:history,context:contextInfo,intentInfo:intentInfo,pageContext:pageContext});
        if(earlyGuide&&earlyGuide.handled){
          return {
            answer:String(earlyGuide.answer||''),
            sources:Array.isArray(earlyGuide.sources)?earlyGuide.sources:[],
            links:Array.isArray(earlyGuide.links)?earlyGuide.links:[],
            mode:String(earlyGuide.mode||'サイト総合案内'),
            data:Object.assign({siteGuide:true,context:contextInfo,earlySiteGuide:true},earlyGuide.data||{})
          };
        }
      }
    }catch(earlySiteGuideErr){}

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

    // 機能の意味・使い方は、その場で説明する。
    // 「全MAXって何？」などを勝手にページ移動へ変えない。
    try{
      if(window.JINPO_BOT_HELP&&typeof window.JINPO_BOT_HELP.respond==='function'){
        var featureHelp=window.JINPO_BOT_HELP.respond(message);
        if(featureHelp&&featureHelp.handled){
          return {
            answer:String(featureHelp.answer||''),
            sources:[],links:[],mode:'機能説明',
            data:{featureHelp:true,key:String(featureHelp.key||''),context:contextInfo}
          };
        }
      }
    }catch(featureHelpErr){}

    // サイト案内は陣法操作やWeb検索より先に判定する。
    // TOPではこの経路が主機能になり、陣法ページでは明示的な「ページ案内」の時だけ反応する。
    try{
      if(window.JINPO_BOT_SITE_GUIDE&&typeof window.JINPO_BOT_SITE_GUIDE.respond==='function'&&!(knownTermFollowup&&knownTermFollowup.jinpoOperation&&String(pageContext&&pageContext.mode||'')==='jinpo')){
        var guide=window.JINPO_BOT_SITE_GUIDE.respond(message,{original:siteGuideInput||message,history:history,context:contextInfo,intentInfo:intentInfo,pageContext:pageContext});
        if(guide&&guide.handled){
          return {answer:String(guide.answer||''),sources:Array.isArray(guide.sources)?guide.sources:[],links:Array.isArray(guide.links)?guide.links:[],mode:String(guide.mode||'サイト総合案内'),data:Object.assign({siteGuide:true,context:contextInfo},guide.data||{})};
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

    var relationClarification=barePersonRelationClarification(message);
    if(relationClarification){
      return {answer:relationClarification,sources:[],links:[],mode:'会話確認',data:{needsClarification:true,missingSubject:true,context:contextInfo}};
    }

    // HELPはv3.3.8から遅延読込。
    // 陣法検索の実行条件にHELPまで要求すると、起動直後の検索が一時的に
    // 「未準備」扱いになるため、検索コアだけで判定する。
    var coreReady=!!(actions()&&parser()&&state()&&interpreter());
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

    // 指定検索は、既に分かっている条件を捨てず「足りないものだけ」を聞く。
    if(plan.specifiedSearch&&plan.searchPatch){
      var desiredFormation=plan.searchPatch.formation!==undefined?String(plan.searchPatch.formation||''):String(before.formation||'');
      var desiredCount=plan.searchPatch.count!==undefined?Number(plan.searchPatch.count)||0:Number(before.count)||0;
      var missingFormation=!desiredFormation;
      var missingCount=!desiredCount;

      if(missingFormation||missingCount){
        var need=missingFormation&&missingCount?'formation_count':missingFormation?'formation':'count';
        try{
          if(window.JINPO_BOT_DIALOG&&typeof window.JINPO_BOT_DIALOG.setSpecifiedSearchPending==='function'){
            window.JINPO_BOT_DIALOG.setSpecifiedSearchPending(originalMessage,need);
          }
        }catch(pendingErr){}

        if(need==='count'){
          return R(
            (desiredFormation?desiredFormation+'は分かっています。':'')+
            '因縁数だけ教えてください。5〜9因縁から選べます。\n例：「7因縁」',
            {needsSpecifiedSearchCondition:true,need:'count',kept:{formation:desiredFormation}}
          );
        }
        if(need==='formation'){
          return R(
            '因縁数は'+desiredCount+'因縁で分かっています。陣形だけ教えてください。\n衡軛・鶴翼・魚鱗・方円から選べます。',
            {needsSpecifiedSearchCondition:true,need:'formation',kept:{count:desiredCount}}
          );
        }
        return R(
          '指定検索として条件は受け取っています。陣形と因縁数だけ追加してください。\n例：「方円 7因縁」',
          {needsSpecifiedSearchCondition:true,need:'formation_count'}
        );
      }
    }
    var recommendPatch=!!(before.recommendActive&&plan.searchPatch&&plan.searchPatch.formation===undefined&&plan.searchPatch.count===undefined&&plan.searchPatch.sumSort===undefined&&plan.searchPatch.sumTie===undefined);
    var allPlanActions=(plan.preActions||[]).concat(plan.actions||[]);
    var hasUndo=allPlanActions.some(function(a){return a.name==='undo';});
    var hasRestoreLast=allPlanActions.some(function(a){
      return [
        'restore_last_search','rerun_last_search',
        'restore_search_history_item','rerun_search_history_item'
      ].indexOf(a.name)>=0;
    });
    var nonRestorable=recommendPatch||allPlanActions.some(function(a){return isNonRestorableMutation(a.name);});
    var restorable=(!recommendPatch&&!!plan.searchPatch)||!!plan.recommendStat||allPlanActions.some(function(a){return isRestorableAction(a.name);});
    if(!hasUndo&&nonRestorable)state().clearUndo();
    else if(!hasUndo&&(restorable||hasRestoreLast))state().pushUndo(actions().captureSnapshot(),message);

    var outputs=[];

    // 英傑固定・除外・全MAX込み等は、本検索より前に反映する。
    for(var pi=0;pi<(plan.preActions||[]).length;pi++){
      var pre=plan.preActions[pi],preRes=await actions().execute(pre.name,pre.args||{});
      outputs.push({name:pre.name,res:preRes});
      if(!preRes.ok)return R(preRes.message,preRes.data);
    }

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
      }else if(item.name==='read_last_search'){
        var lastRead=state().getLastSearch&&state().getLastSearch();
        res=lastRead
          ?{ok:true,message:lastSearchSummary(lastRead),data:{lastSearch:lastRead}}
          :{ok:false,message:'前回の検索記録はまだありません。',data:{noLastSearch:true}};
      }else if(item.name==='compare_search_history'){
        var fromIndex=Math.max(1,Number(args.fromIndex)||2);
        var toIndex=Math.max(1,Number(args.toIndex)||1);
        var fromItem=state().getSearchHistoryItem&&state().getSearchHistoryItem(fromIndex);
        var toItem=state().getSearchHistoryItem&&state().getSearchHistoryItem(toIndex);

        if(!fromItem||!toItem){
          var missingIndex=!fromItem?fromIndex:toIndex;
          res={ok:false,message:historyIndexLabel(missingIndex)+'の検索記録はありません。',data:{noSearchHistoryItem:true,index:missingIndex}};
        }else{
          res={
            ok:true,
            message:formatConditionDiff(
              fromItem.snapshot,toItem.snapshot,
              historyIndexLabel(fromIndex),historyIndexLabel(toIndex),
              fromItem.recipe,toItem.recipe
            ),
            data:{conditionDiff:true,fromIndex:fromIndex,toIndex:toIndex}
          };
        }
      }else if(item.name==='compare_current_search_history'){
        var compareIndex=Math.max(1,Number(args.index)||1);
        var historyItem=state().getSearchHistoryItem&&state().getSearchHistoryItem(compareIndex);
        if(!historyItem){
          res={ok:false,message:historyIndexLabel(compareIndex)+'の検索記録はありません。',data:{noSearchHistoryItem:true,index:compareIndex}};
        }else{
          var currentSnapshot=actions().captureSnapshot();
          res={
            ok:true,
            message:formatConditionDiff(
              historyItem.snapshot,currentSnapshot,
              historyIndexLabel(compareIndex),'現在',
              null,null
            ),
            data:{conditionDiff:true,index:compareIndex,current:true}
          };
        }
      }else if(item.name==='read_search_history'){
        var histRead=state().getSearchHistory&&state().getSearchHistory();
        res=histRead&&histRead.length
          ?{ok:true,message:searchHistorySummary(histRead),data:{searchHistory:histRead}}
          :{ok:false,message:'検索履歴はまだありません。',data:{noSearchHistory:true}};
      }else if(item.name==='read_search_history_item'){
        var idxRead=Math.max(1,Number(args.index)||1);
        var histItem=state().getSearchHistoryItem&&state().getSearchHistoryItem(idxRead);
        res=histItem
          ?{ok:true,message:historyItemSummary(histItem,idxRead),data:{searchHistoryItem:histItem,index:idxRead}}
          :{ok:false,message:historyIndexLabel(idxRead)+'の検索記録はありません。',data:{noSearchHistoryItem:true,index:idxRead}};
      }else if(item.name==='restore_search_history_item'){
        var idxRestore=Math.max(1,Number(args.index)||1);
        var histRestore=state().getSearchHistoryItem&&state().getSearchHistoryItem(idxRestore);
        if(!histRestore){
          res={ok:false,message:historyIndexLabel(idxRestore)+'の検索記録はありません。',data:{noSearchHistoryItem:true,index:idxRestore}};
        }else{
          res=await actions().execute('restore_conditions_only',{snapshot:histRestore.snapshot});
          if(res.ok)res.message=historyIndexLabel(idxRestore)+'の検索条件へ戻しました。まだ検索は実行していません。';
        }
      }else if(item.name==='rerun_search_history_item'){
        var idxRun=Math.max(1,Number(args.index)||1);
        var histRun=state().getSearchHistoryItem&&state().getSearchHistoryItem(idxRun);
        if(!histRun){
          res={ok:false,message:historyIndexLabel(idxRun)+'の検索記録はありません。',data:{noSearchHistoryItem:true,index:idxRun}};
        }else{
          var histRestored=await actions().execute('restore_conditions_only',{snapshot:histRun.snapshot});
          if(!histRestored.ok){
            res=histRestored;
          }else{
            var histRecipe=histRun.recipe||{action:'run_current_search',args:{}};
            var histAllowed=['run_best','run_recommended','update_recommended','run_specified_simple','run_current_search'];
            var histAction=histAllowed.indexOf(histRecipe.action)>=0?histRecipe.action:'run_current_search';
            res=await actions().execute(histAction,histRecipe.args||{});
            executedName=histAction;
            if(res.ok)res.message=historyIndexLabel(idxRun)+'と同じ条件・検索方式でもう一度検索しました。';
          }
        }
      }else if(item.name==='restore_last_search'){
        var lastRestore=state().getLastSearch&&state().getLastSearch();
        if(!lastRestore){
          res={ok:false,message:'前回の検索記録はまだありません。',data:{noLastSearch:true}};
        }else{
          res=await actions().execute('restore_conditions_only',{snapshot:lastRestore.snapshot});
          if(res.ok)res.message='前回の検索条件へ戻しました。まだ検索は実行していません。';
        }
      }else if(item.name==='rerun_last_search'){
        var lastRun=state().getLastSearch&&state().getLastSearch();
        if(!lastRun){
          res={ok:false,message:'前回の検索記録はまだありません。',data:{noLastSearch:true}};
        }else{
          var restored=await actions().execute('restore_conditions_only',{snapshot:lastRun.snapshot});
          if(!restored.ok){
            res=restored;
          }else{
            var recipe=lastRun.recipe||{action:'run_current_search',args:{}};
            var allowed=['run_best','run_recommended','update_recommended','run_specified_simple','run_current_search'];
            var recipeAction=allowed.indexOf(recipe.action)>=0?recipe.action:'run_current_search';
            res=await actions().execute(recipeAction,recipe.args||{});
            executedName=recipeAction;
            if(res.ok)res.message='前回と同じ条件・検索方式でもう一度検索しました。';
          }
        }
      }else res=await actions().execute(executedName,args);
      outputs.push({name:executedName,res:res});
      if(!res.ok)return R(res.message,res.data);
      if(executedName==='get_swap_candidates')lastReference={type:'swap',items:(res.data&&res.data.candidates)||[]};
      else if(executedName==='get_results')lastReference={type:'result',items:(res.data&&res.data.results)||[]};
      else if(executedName==='apply_swap')lastReference={type:'',items:[]};
      else if(executedName==='apply_result')lastReference={type:'result',items:[]};
    }

    var after=actions().readSiteState();state().setConditions(after);

    try{
      var recipeToSave=lastSearchRecipe(plan,outputs);
      if(recipeToSave&&state().saveLastSearch){
        state().saveLastSearch(actions().captureSnapshot(),originalMessage,recipeToSave);
      }
    }catch(lastSearchErr){}

    try{if(window.JINPO_BOT_NLU&&typeof window.JINPO_BOT_NLU.remember==='function')window.JINPO_BOT_NLU.remember({original:originalMessage,corrected:message,plan:plan,state:after,lastReference:lastReference});}catch(e){}
    if(!plan.recognized){
      var cap=null;try{cap=window.JINPO_BOT_CAPABILITIES&&window.JINPO_BOT_CAPABILITIES.friendlyQuestion?window.JINPO_BOT_CAPABILITIES.friendlyQuestion(originalMessage):null;}catch(e){}
      var fallbackText=cap;
      if(!fallbackText){
        if(pageContext.mode==='jinpo'){
          fallbackText='ちょっと分からなかったです。陣法の話なら「腕力高いの」「耐久と知力高いの」「1位を適用」みたいに言ってみてください。';
        }else{
          fallbackText='ちょっと意味を取りきれなかったです。何の話か一言だけ足してもらえれば続けられます。';
        }
      }
      return R(fallbackText,{needsClarification:true});
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
      else if(o.name==='read_state')lines.push('現在の検索条件：\n'+conditionLabel(d.state));
      else if(
        o.name==='read_last_search'||
        o.name==='restore_last_search'||
        o.name==='read_search_history'||
        o.name==='read_search_history_item'||
        o.name==='restore_search_history_item'||
        o.name==='compare_search_history'||
        o.name==='compare_current_search_history'
      )lines.push(r.message);
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
      return handle(p);
    };

    if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setTransport==='function'){
      window.JINPO_AI_CHAT.setTransport(handle);
    }
    if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.setBrainStatus==='function'){
      window.JINPO_AI_CHAT.setBrainStatus('案内・検索OK','通常Bot正式版');
    }
  }

  window.JINPO_BOT={version:VERSION,handle:handle,parse:function(t){return parser()&&parser().parse(t);},isRestorableAction:isRestorableAction,conditionLabel:conditionLabel,lastSearchRecipe:lastSearchRecipe,lastSearchSummary:lastSearchSummary,searchHistorySummary:searchHistorySummary,historyItemSummary:historyItemSummary,conditionDiff:conditionDiff,formatConditionDiff:formatConditionDiff,getState:function(){return state()&&state().getConditions();},readSiteState:function(){return actions()&&actions().readSiteState();},listActions:function(){return actions()?actions().registry.slice():[];},resolveContext:function(t,h){return window.JINPO_BOT_CONTEXT&&window.JINPO_BOT_CONTEXT.resolve?window.JINPO_BOT_CONTEXT.resolve(t,h||[]):{original:t,message:t,resolved:false};},installTransport:install};
  install();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});window.addEventListener('load',install,{once:true});
})();
