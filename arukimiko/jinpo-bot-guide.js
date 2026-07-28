/*
 * たいらの野望 / 陣法Bot クリック案内 UI v2.1.0
 * 既存チャットを変更せず、会話欄の下に「かんたん操作」パネルを後付けする。
 * 手入力は常時そのまま利用できる。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_GUIDE) return;

  var VERSION='2.3.1';
  var panel=null, body=null, title=null, summary=null, observer=null;
  var flow={mode:'main',step:'',draft:{}};
  var STATS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性'];
  var FORMS=['鶴翼','方円','魚鱗','衡軛'];

  function guideAllowed(){
    if(window.JINPO_BOT_DISABLE_JINPO_GUIDE)return false;
    if(window.JINPO_BOT_PAGE_MODE&&String(window.JINPO_BOT_PAGE_MODE)!=='jinpo')return false;
    var p='';try{p=decodeURIComponent(location.pathname||'');}catch(e){p=String(location.pathname||'');}
    return /\/陣法\/jinpo\.html$/i.test(p)||(!window.JINPO_BOT_PAGE_MODE&&/jinpo\.html$/i.test(p));
  }
  function S(v){return String(v==null?'':v);}
  function btn(label,onClick,kind){
    var b=document.createElement('button');
    b.type='button';b.className='jinpoBotGuideBtn'+(kind?' '+kind:'');b.textContent=label;
    b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();onClick();});
    return b;
  }
  function guideTone(text){
    text=S(text);
    var exact={
      '何をしますか？ 文字入力でもそのまま操作できます。':'気軽に選んでくださいね。細かい指定は手入力でもできるのですよ。',
      '何因縁で探しますか？':'何因縁で探してみますか？',
      '陣形はどれにしますか？':'陣形はどれにしますか？ 選んでほしいのですよ。',
      '第1優先はどれにしますか？':'第1優先はどれにしますか？',
      '第2優先も指定しますか？':'第2優先も指定しますか？ なしでも大丈夫なのですよ。',
      'この条件で検索しますか？':'この条件で検索してみますか？',
      '検索結果をどうしますか？':'検索結果をどうしますか？ 次の操作を選べるのですよ。',
      '英傑・配置をどうしますか？':'英傑・配置はどうしますか？',
      'どんな差替候補を見ますか？':'どんな差替候補を見てみますか？',
      '強化設定をどうしますか？':'強化設定はどうしますか？',
      'どの説明を見ますか？':'どの説明を見てみますか？',
      'その他の操作です。':'その他の操作も選べるのですよ。',
      '次はどうしますか？':'次はどうしますか？ そのまま選べるのですよ。',
      'この解釈で進めますか？':'この解釈で合っていますか？ 合っていれば進めるのですよ。'
    };
    if(exact[text])return exact[text];
    return text
      .replace(/^候補がかなり多めです。/,'候補がかなり多めなのですよ。')
      .replace(/^候補が多めです。/,'候補が少し多めなのですよ。')
      .replace(/^今回は候補が見つかりませんでした。/,'今回は候補が見つからなかったのですよ。');
  }
  function clear(){if(body)body.textContent='';if(summary){summary.textContent='';summary.hidden=true;}}
  function chosen(text){var d=document.createElement('div');d.className='jinpoBotGuideChosen';d.textContent='✓ '+text;body.appendChild(d);return d;}
  function line(text){var d=document.createElement('div');d.className='jinpoBotGuideQuestion';d.textContent=guideTone(text);body.appendChild(d);return d;}
  function executeHint(){var d=document.createElement('div');d.className='jinpoBotGuideExecuteHint';d.textContent='緑色のボタンを押すと検索を実行します';body.appendChild(d);return d;}
  function row(items){var d=document.createElement('div');d.className='jinpoBotGuideChoices';items.forEach(function(x){d.appendChild(btn(x.label,x.onClick,x.kind));});body.appendChild(d);return d;}
  function setSummary(text){if(!summary)return;summary.textContent=text||'';summary.hidden=!text;}
  function siteState(){try{var st=window.JINPO_BOT&&typeof window.JINPO_BOT.readSiteState==='function'?window.JINPO_BOT.readSiteState()||{}:{};if(FORMS.indexOf(S(st.formation))<0)st.formation='';return st;}catch(e){return{};}}
  function suggester(){return window.JINPO_BOT_SUGGEST||null;}
  function send(text){
    text=S(text).trim();if(!text)return;
    try{if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.send==='function'){window.JINPO_AI_CHAT.send(text);return;}}catch(e){}
    var input=document.getElementById('jinpoAiInput'),sendBtn=document.getElementById('jinpoAiSend');
    if(input&&sendBtn){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));sendBtn.click();}
  }

  function addChat(role,text){
    try{if(window.JINPO_AI_CHAT&&typeof window.JINPO_AI_CHAT.addMessage==='function'){window.JINPO_AI_CHAT.addMessage(role,S(text),{silentGuide:true});return true;}}catch(e){}
    return false;
  }
  function searchLabel(st){
    st=st||{};var p=[];if(st.formation)p.push(st.formation);if(st.count)p.push(st.count+'因縁');if(st.priority1)p.push('第1 '+st.priority1);if(st.priority2)p.push('第2 '+st.priority2);if(st.grade3)p.push('等級3以下');return p.join(' / ');
  }
  function setGuideBusy(on){
    if(!panel)return;panel.classList.toggle('isBusy',!!on);Array.prototype.forEach.call(panel.querySelectorAll('button'),function(b){b.disabled=!!on;});
  }
  async function directSearch(patch,userLabel){
    var a=window.JINPO_BOT_ACTIONS;if(!a||typeof a.execute!=='function'){line('検索機能の準備を確認できませんでした。ページを再読み込みしてください。');return;}
    setGuideBusy(true);clear();line('探しているのですよ…');
    if(userLabel)addChat('user',userLabel);
    try{
      var res=await a.execute('apply_search',patch||{});
      if(!res||!res.ok){var msg=res&&res.message?res.message:'検索を実行できませんでした。';addChat('assistant',msg);clear();line(msg);row([{label:'戻る',kind:'subtle',onClick:renderMain}]);return;}
      var st=(res.data&&res.data.state)||siteState();var ans=(searchLabel(st)||'現在の条件')+'で検索しました。';
      if(st.hit&&st.hit!=='—'&&st.hit!=='検索中')ans+=' 検索結果 '+st.hit+'件。';
      ans+='\n気になる候補を見ていくのですよ。';
      addChat('assistant',ans);
      renderMain();
    }catch(e){var msg2='検索中にエラーが発生しました。';addChat('assistant',msg2);clear();line(msg2);row([{label:'戻る',kind:'subtle',onClick:renderMain}]);}
    finally{setGuideBusy(false);}
  }
  async function directRecommended(stat){
    var a=window.JINPO_BOT_ACTIONS;if(!a||typeof a.execute!=='function'){clear();line('まだ準備中なのですよ。少し待ってから、もう一度押してみてくださいね。');row([backItem(renderMain)]);return;}
    setGuideBusy(true);clear();line('おすすめを探しているのですよ…');addChat('user','おすすめ：'+stat);
    try{var res=await a.execute('run_recommended',{stat:stat});if(!res||!res.ok){var m=res&&res.message?res.message:'条件をもう一度選べば続けられるのですよ。';addChat('assistant',m);clear();line('もう一度選び直してみましょう。');row([backItem(renderMain)]);return;}var st=(res.data&&res.data.state)||siteState(),ans=stat+'優先でおすすめを検索しました。';if(st.hit&&st.hit!=='—'&&st.hit!=='検索中')ans+=' 検索結果 '+st.hit+'件。';addChat('assistant',ans);renderMain();}catch(e){var m2='少しうまくつながらなかったのですよ。もう一度選べば続けられます。';addChat('assistant',m2);clear();line('もう一度選んでみましょう。');row([backItem(renderMain)]);}finally{setGuideBusy(false);}
  }
  function resetFlow(){flow={mode:'main',step:'',draft:{}};renderMain();}
  function draftLabel(){
    var d=flow.draft,p=[];
    if(d.count)p.push(d.count+'因縁');
    if(d.formation)p.push(d.formation);
    if(d.priority1===null)p.push('第1なし');else if(d.priority1)p.push('第1 '+d.priority1);
    if(d.priority2===null)p.push('第2なし');else if(d.priority2)p.push('第2 '+d.priority2);
    if(d.grade3===true)p.push('等級3以下');
    return p.join(' / ');
  }
  function buildSearchText(){
    var d=flow.draft,p=[];
    if(d.formation)p.push(d.formation);
    if(d.count)p.push(d.count+'因縁');
    if(d.priority1===null)p.push('第1優先解除');else if(d.priority1)p.push('第1 '+d.priority1);
    if(d.priority2===null)p.push('第2優先解除');else if(d.priority2)p.push('第2 '+d.priority2);
    if(d.grade3===true)p.push('等級3以下');
    p.push('検索して');return p.join(' ');
  }

  function thresholdValues(stat){
    try{
      if(typeof window.dbThresholdValuesForStat==='function'){
        var raw=window.dbThresholdValuesForStat(stat);
        if(Array.isArray(raw)&&raw.length)return raw.map(Number).filter(Number.isFinite);
      }
    }catch(e){}
    return (stat==='生命'||stat==='気合')?[20000,18000,16000,14000,12000,10000,8000,6000]:[1600,1400,1200,1000,800,600,400,200];
  }
  function backItem(fn){return {label:'← 戻る',kind:'back',onClick:fn};}
  async function directSpecified(formation,stat,min){
    var a=window.JINPO_BOT_ACTIONS;
    if(!a||typeof a.execute!=='function'){clear();line('準備中なのですよ。少し待ってからもう一度お試しください。');row([backItem(renderMain)]);return;}
    setGuideBusy(true);clear();line('条件に合うものを探しているのですよ…');
    var userLabel=formation+' / '+stat+(min!=null?' '+Number(min).toLocaleString()+'以上':'');addChat('user',userLabel);
    try{
      var res=await a.execute('run_specified_simple',{formation:formation,stat:stat,min:min});
      if(!res||!res.ok){
        var msg=res&&res.message?res.message:'条件をもう一度確認してみましょう。';
        addChat('assistant',msg);clear();line('うまく検索につながらなかったので、条件を選び直してみましょう。');row([backItem(renderMain)]);return;
      }
      var st=(res.data&&res.data.state)||siteState();
      var ans=formation+'で'+stat+(min!=null?' '+Number(min).toLocaleString()+'以上':'')+'を条件に探したのですよ。';
      if(st.hit&&st.hit!=='—'&&st.hit!=='検索中')ans+=' 検索結果 '+st.hit+'件。';
      addChat('assistant',ans);renderMain();
    }catch(e){addChat('assistant','条件を選び直せば続けられるのですよ。');clear();line('条件を選び直してみましょう。');row([backItem(renderMain)]);}
    finally{setGuideBusy(false);}
  }

  function renderMain(){
    if(!body)return;clear();flow={mode:'main',step:'',draft:{}};
    row([
      {label:'おすすめ',kind:'primary',onClick:renderRecommendQuick},
      {label:'指定して探す',kind:'primary',onClick:startSearch}
    ]);
  }

  function startSearch(){
    flow={mode:'specified',step:'formation',draft:{formation:'',priority1:''}};
    renderSearchFormationFirst();
  }
  function renderSearchFormationFirst(){
    clear();flow.mode='specified';flow.step='formation';line('陣形を選んでくださいね。');
    var items=FORMS.map(function(f){return {label:f,onClick:function(){flow.draft.formation=f;renderSearchPrioritySimple();}};});
    items.push(backItem(renderMain));row(items);
  }
  function renderSearchPrioritySimple(){
    clear();flow.mode='specified';flow.step='stat';setSummary(flow.draft.formation||'');line('どのステータスを重視しますか？');
    var items=STATS.map(function(s){return {label:s,onClick:function(){flow.draft.priority1=s;renderSpecifiedThreshold();}};});
    items.push(backItem(renderSearchFormationFirst));row(items);
  }
  function renderSpecifiedThreshold(){
    clear();flow.mode='specified';flow.step='threshold';
    var d=flow.draft||{},stat=d.priority1||'',formation=d.formation||'';
    setSummary([formation,stat].filter(Boolean).join(' / '));line('能力値も指定しますか？ 指定しなければ、そのまま高い順で探すのですよ。');
    var items=[{label:'▶ 指定しないで検索',kind:'execute',onClick:function(){directSpecified(formation,stat,null);}}];
    thresholdValues(stat).forEach(function(v){items.push({label:Number(v).toLocaleString()+'以上で検索',kind:'execute',onClick:function(){directSpecified(formation,stat,Number(v));}});});
    items.push(backItem(renderSearchPrioritySimple));row(items);
  }
  function renderRecommendQuick(){
    clear();flow={mode:'recommend',step:'stat',draft:{}};line('何を重視しておすすめを探しますか？');
    var items=STATS.map(function(s){return {label:s,kind:'execute',onClick:function(){directRecommended(s);}};});
    items.push(backItem(renderMain));row(items);
  }

  /* 詳しい機能は最初から並べず、必要な時だけ開く */
  function renderAdvancedMenu(){
    clear();flow.mode='advanced';line('もう少し細かく使う時はこちらなのですよ。');
    row([
      {label:'英傑を指定',onClick:renderHeroMenu},
      {label:'差替',onClick:renderSwapMenu},
      {label:'強化/MAX',onClick:renderEnhanceMenu},
      {label:'その他',onClick:renderOtherMenu},
      {label:'戻る',kind:'subtle',onClick:renderMain}
    ]);
  }


  function renderRefineStat(index){
    clear();flow.mode='refine';line('第'+index+'優先はどれにしますか？');executeHint();
    var items=STATS.map(function(s){return {label:s+'で再検索',kind:'execute',onClick:function(){var sg=suggester();if(sg)sg.recordAccepted();send('第'+index+' '+s+' 検索して');}};});
    items.push({label:'戻る',kind:'subtle',onClick:renderResultsMenu});row(items);
  }
  function renderRefineFormation(){
    clear();flow.mode='refine';line('どの陣形に絞りますか？');executeHint();
    var items=FORMS.map(function(f){return {label:f+'で再検索',kind:'execute',onClick:function(){var sg=suggester();if(sg)sg.recordAccepted();send(f+' 検索して');}};});
    items.push({label:'戻る',kind:'subtle',onClick:renderResultsMenu});row(items);
  }
  function rangeChoices(index){
    var root=document.getElementById('dbPriorityValueButtons'+index),out=[],seen={};
    if(root){Array.prototype.forEach.call(root.querySelectorAll('.dbPriorityValueChoice'),function(b){var t=S(b.textContent).trim();if(!/以上/.test(t))return;var m=t.match(/[0-9][0-9,]*/);if(!m)return;var n=Number(m[0].replace(/,/g,''));if(!Number.isFinite(n)||seen[n])return;seen[n]=1;out.push(n);});}
    return out.sort(function(a,b){return a-b;}).slice(0,12);
  }
  function renderRefineRange(index){
    clear();flow.mode='refine';var st=siteState(),stat=index===1?st.priority1:st.priority2;line('第'+index+' '+(stat||'優先')+'の下限をどこにしますか？');executeHint();
    var values=rangeChoices(index),items=[];
    values.forEach(function(n){items.push({label:n.toLocaleString()+'以上で再検索',kind:'execute',onClick:function(){var sg=suggester();if(sg)sg.recordAccepted();send('第'+index+' '+n+'以上 検索して');}});});
    if(!items.length)items.push({label:'条件を選び直す',kind:'primary',onClick:startSearch});
    items.push({label:'戻る',kind:'subtle',onClick:renderResultsMenu});row(items);
  }
  function handleSuggestionAction(action,sig){
    var sg=suggester();action=action||{};
    if(action.id==='dismiss'){if(sg)sg.recordDismiss(sig);renderResultsMenu();return;}
    if(action.id==='add_p1'){renderRefineStat(1);return;}
    if(action.id==='add_p2'){renderRefineStat(2);return;}
    if(action.id==='add_formation'){renderRefineFormation();return;}
    if(action.id==='add_p1_min'){renderRefineRange(1);return;}
    if(action.id==='add_p2_min'){renderRefineRange(2);return;}
    if(action.id==='top5'){if(sg)sg.recordAccepted();send('上位5件見せて');return;}
    if(action.id==='remove_p2'){if(sg)sg.recordAccepted();send('第2優先解除 検索して');return;}
    if(action.id==='remove_p1'){if(sg)sg.recordAccepted();send('第1優先解除 検索して');return;}
    if(action.id==='remove_factor4'){if(sg)sg.recordAccepted();send('文曲除外解除 検索して');return;}
    if(action.id==='relax_p1_range'){if(sg)sg.recordAccepted();var s1=siteState().priority1;if(s1)send('第1 '+s1+' 検索して');else startSearch();return;}
    if(action.id==='relax_p2_range'){if(sg)sg.recordAccepted();var s2=siteState().priority2;if(s2)send('第2 '+s2+' 検索して');else startSearch();return;}
    if(action.id==='review'){if(sg)sg.recordAccepted();startSearch();return;}
    renderResultsMenu();
  }
  function suggestionKind(a){
    if(!a)return '';
    if(['remove_p2','remove_p1','remove_factor4','relax_p1_range','relax_p2_range'].indexOf(a.id)>=0)return 'execute';
    return a.primary?'primary':a.subtle?'subtle':'';
  }
  function renderSuggestion(s){
    clear();flow.mode='suggest';line(s.message||'必要なら条件を少し調整できます。');setSummary('検索結果 '+S(s.hit)+'件');
    var actions=(s.actions||[]).slice(),picked=[];
    actions.filter(function(a){return a.id!=='dismiss';}).slice(0,2).forEach(function(a){picked.push(a);});
    var dismiss=actions.filter(function(a){return a.id==='dismiss';})[0];if(dismiss)picked.push(dismiss);
    var items=picked.map(function(a){return {label:a.label,kind:suggestionKind(a),onClick:function(){handleSuggestionAction(a,s.signature);}};});row(items);
  }
  function renderSuggestSettings(){
    clear();flow.mode='suggest-settings';var sg=suggester(),p=sg&&sg.getPreferences?sg.getPreferences():{level:'standard'};
    line('絞り込み提案の出し方を選べます。');setSummary('現在：'+(p.level==='low'?'少なめ':p.level==='high'?'多め':'標準'));
    row([
      {label:'少なめ',kind:p.level==='low'?'primary':'',onClick:function(){if(sg)sg.setLevel('low');renderSuggestSettings();}},
      {label:'標準',kind:p.level==='standard'?'primary':'',onClick:function(){if(sg)sg.setLevel('standard');renderSuggestSettings();}},
      {label:'多め',kind:p.level==='high'?'primary':'',onClick:function(){if(sg)sg.setLevel('high');renderSuggestSettings();}},
      {label:'戻る',kind:'subtle',onClick:renderOtherMenu}
    ]);
  }


  function renderRecommendMenu(){
    clear();flow.mode='recommend';line('おすすめでは何を優先しますか？');executeHint();
    var items=STATS.map(function(s){return {label:s+'で検索',kind:'execute',onClick:function(){send('おすすめ '+s);}};});
    items.push({label:'おすすめ解除',kind:'subtle',onClick:function(){send('おすすめを解除');}});
    items.push({label:'戻る',kind:'subtle',onClick:renderMain});row(items);
  }
  function renderHeroMenu(){
    clear();flow.mode='hero';line('英傑を指定しますか？');
    row([
      {label:'配置英傑を選ぶ',kind:'primary',onClick:renderPlacementSlotMenu},
      {label:'除外英傑を選ぶ',onClick:function(){send('除外英傑を選びたい');}},
      {label:'今の編成を見る',onClick:function(){send('今の編成を教えて');}},
      {label:'戻る',kind:'subtle',onClick:renderAdvancedMenu}
    ]);
  }
  function renderPlacementSlotMenu(){
    clear();line('どの配置枠にしますか？');
    row([
      {label:'配置1',onClick:function(){send('配置英傑1を選びたい');}},
      {label:'配置2',onClick:function(){send('配置英傑2を選びたい');}},
      {label:'配置3',onClick:function(){send('配置英傑3を選びたい');}},
      {label:'戻る',kind:'subtle',onClick:renderHeroMenu}
    ]);
  }
  function renderOtherMenu(){
    clear();flow.mode='other';line('その他の操作です。');
    row([
      {label:'現在条件',kind:'primary',onClick:function(){send('今の条件を教えて');}},
      {label:'発動因縁',onClick:function(){send('発動因縁を教えて');}},
      {label:'保存編成一覧',onClick:function(){send('保存編成一覧を見せて');}},
      {label:'今の編成を保存',onClick:function(){send('今の編成を保存して');}},
      {label:'共有URL',onClick:function(){send('共有URLを作って');}},
      {label:'因縁一覧',onClick:function(){send('因縁一覧を開いて');}},
      {label:'一つ前に戻す',onClick:function(){send('一つ前に戻して');}},
      {label:'提案の頻度',onClick:renderSuggestSettings},
      {label:'戻る',kind:'subtle',onClick:renderMain}
    ]);
  }

  function renderResultsMenu(){
    clear();flow.mode='results';line('次はどうしますか？');
    row([
      {label:'1位を適用',kind:'primary',onClick:function(){send('検索結果の1位を適用');}},
      {label:'上位5件を見る',onClick:function(){send('上位5件見せて');}},
      {label:'探し直す',onClick:renderQuickRefine},
      backItem(renderMain)
    ]);
  }
  function renderQuickRefine(){
    clear();flow.mode='refine-simple';line('どちらで探し直しますか？');
    row([
      {label:'おすすめ',kind:'primary',onClick:renderRecommendQuick},
      {label:'指定して探す',kind:'primary',onClick:startSearch},
      backItem(renderResultsMenu)
    ]);
  }
  function renderRankApplyMenu(type,max){
    clear();line(type==='swap'?'どの差替候補を適用しますか？':'どの検索結果を適用しますか？');
    var items=[];for(var i=1;i<=max;i++)(function(n){items.push({label:n+(type==='swap'?'番':'位'),kind:n===1?'primary':'',onClick:function(){send((type==='swap'?'差替候補の':'検索結果の')+n+(type==='swap'?'番目':'位')+'を適用');}});})(i);
    items.push({label:'戻る',kind:'subtle',onClick:type==='swap'?renderSwapMenu:renderResultsMenu});row(items);
  }
  function renderSwapMenu(){
    clear();flow.mode='swap';line('差替はどんな感じで探しますか？');
    row([
      {label:'因縁を減らさない',kind:'primary',onClick:function(){send('因縁が減らない差替候補を見せて');}},
      {label:'UPだけ',onClick:function(){send('UPだけの差替候補を見せて');}},
      {label:'候補を適用',onClick:function(){renderRankApplyMenu('swap',5);}},
      {label:'もっと細かく',kind:'subtle',onClick:renderSwapDetailed},
      {label:'戻る',kind:'subtle',onClick:renderAdvancedMenu}
    ]);
  }
  function renderSwapDetailed(){
    clear();line('細かい差替条件はこちらです。');
    row([
      {label:'FLATだけ',onClick:function(){send('FLATだけの差替候補を見せて');}},
      {label:'DOWNだけ',onClick:function(){send('DOWNだけの差替候補を見せて');}},
      {label:'戻る',kind:'subtle',onClick:renderSwapMenu}
    ]);
  }
  function renderEnhanceMenu(){
    clear();flow.mode='enhance';line('強化はよく使うものだけ出しているのですよ。');
    row([
      {label:'全MAX',kind:'primary',onClick:function(){send('全MAX');}},
      {label:'全MAX解除',onClick:function(){send('全MAX解除');}},
      {label:'込み合計を見る',onClick:function(){send('今の込み合計を教えて');}},
      {label:'もっと細かく',kind:'subtle',onClick:renderEnhanceDetailed},
      {label:'戻る',kind:'subtle',onClick:renderAdvancedMenu}
    ]);
  }
  function renderEnhanceDetailed(){
    clear();line('個別の強化はこちらです。');
    row([
      {label:'見聞録MAX',onClick:function(){send('見聞録だけMAX');}},
      {label:'鬼神石MAX',onClick:function(){send('鬼神石だけMAX');}},
      {label:'転生MAX',onClick:function(){send('転生だけMAX');}},
      {label:'強化画面を開く',onClick:function(){send('強化画面を開いて');}},
      {label:'戻る',kind:'subtle',onClick:renderEnhanceMenu}
    ]);
  }
  function renderHelpMenu(){
    clear();flow.mode='help';line('どの説明を見ますか？');
    row([
      {label:'できること',kind:'primary',onClick:function(){send('何ができる？');}},
      {label:'第1優先',onClick:function(){send('第1優先とは？');}},
      {label:'第2優先',onClick:function(){send('第2優先とは？');}},
      {label:'込み合計',onClick:function(){send('込み合計とは？');}},
      {label:'全MAX',onClick:function(){send('全MAXとは？');}},
      {label:'差替の色',onClick:function(){send('差替の赤緑青の意味は？');}},
      {label:'文曲除外',onClick:function(){send('文曲除外人数とは？');}},
      {label:'戻る',kind:'subtle',onClick:renderMain}
    ]);
  }
  function renderAfterAssistant(text){
    text=S(text);var pending=null;try{pending=window.JINPO_BOT_INTERPRETER&&window.JINPO_BOT_INTERPRETER.getPending&&window.JINPO_BOT_INTERPRETER.getPending();}catch(e){}
    if(pending){clear();flow.mode='confirm';line('この解釈で進めますか？');row([{label:'はい',kind:'primary',onClick:function(){send('はい');}},{label:'いいえ',onClick:function(){send('いいえ');}},{label:'手入力で言い直す',kind:'subtle',onClick:function(){var i=document.getElementById('jinpoAiInput');if(i)i.focus();}},backItem(renderMain)]);return;}
    if(/\d+番：配置/.test(text)){clear();line('候補を適用するなら番号を選べます。');var its=[];for(var n=1;n<=5;n++)(function(k){its.push({label:k+'番を適用',kind:k===1?'primary':'',onClick:function(){send('差替候補の'+k+'番目を適用');}});})(n);its.push({label:'条件を変える',onClick:renderSwapMenu});its.push({label:'メニュー',kind:'subtle',onClick:renderMain});row(its);return;}
    if(/\d+位：/.test(text)){renderRankApplyMenu('result',5);return;}
    if(/で検索しました|検索結果\s*\d+件/.test(text)){renderMain();return;}
    if(/適用しました|差替.*適用/.test(text)){clear();line('次はどうしますか？');row([{label:'差替候補',kind:'primary',onClick:renderSwapMenu},{label:'全MAX',onClick:function(){send('全MAX');}},{label:'込み合計',onClick:function(){send('今の込み合計を教えて');}},{label:'メニュー',kind:'subtle',onClick:renderMain}]);return;}
    if(flow.mode==='main'||flow.mode==='confirm')renderMain();
  }

  function attach(){
    if(!guideAllowed()){
      try{var old=document.getElementById('jinpoBotGuide');if(old&&old.parentNode)old.parentNode.removeChild(old);var w=document.getElementById('jinpoAiWindow');if(w)w.classList.remove('hasJinpoBotGuide');}catch(e){}
      return false;
    }
    if(panel&&panel.isConnected)return true;
    var win=document.getElementById('jinpoAiWindow'),composer=win&&win.querySelector('.jinpoAiComposer');if(!win||!composer)return false;
    panel=document.createElement('section');panel.id='jinpoBotGuide';panel.setAttribute('aria-label','歩き巫女 かんたん操作');
    var head=document.createElement('div');head.className='jinpoBotGuideHead';
    title=document.createElement('strong');title.textContent='どちらで探しますか？';
    head.appendChild(title);
    summary=document.createElement('div');summary.className='jinpoBotGuideSummary';summary.hidden=true;
    body=document.createElement('div');body.className='jinpoBotGuideBody';
    panel.appendChild(head);panel.appendChild(summary);panel.appendChild(body);win.classList.add('hasJinpoBotGuide');win.insertBefore(panel,composer);
    renderMain();

    var messages=document.getElementById('jinpoAiMessages');
    if(messages&&typeof MutationObserver!=='undefined'){
      observer=new MutationObserver(function(records){
        var last='';records.forEach(function(rec){Array.prototype.forEach.call(rec.addedNodes||[],function(node){if(!node||node.nodeType!==1||!node.classList||node.hasAttribute('data-jinpo-guide-silent'))return;var b=node.querySelector('.jinpoAiBubble');if(!b)return;if(node.classList.contains('user')){var sg=suggester();if(sg&&sg.noteUserText)sg.noteUserText(b.textContent||'');}else if(node.classList.contains('assistant')&&!node.hasAttribute('data-jinpo-ai-typing'))last=b.textContent||'';});});
        if(last)setTimeout(function(){renderAfterAssistant(last);},0);
      });observer.observe(messages,{childList:true});
    }
    return true;
  }
  function install(){
    if(!guideAllowed())return false;if(attach())return;var tries=0,t=setInterval(function(){tries++;if(attach()||tries>80)clearInterval(t);},100);}

  window.JINPO_BOT_GUIDE={version:VERSION,install:install,openMenu:renderMain,startSearch:startSearch,renderRecommendMenu:renderRecommendMenu,renderResultsMenu:renderResultsMenu,renderHeroMenu:renderHeroMenu,renderSwapMenu:renderSwapMenu,renderEnhanceMenu:renderEnhanceMenu,renderOtherMenu:renderOtherMenu,renderAdvancedMenu:renderAdvancedMenu,renderHelpMenu:renderHelpMenu,renderSuggestSettings:renderSuggestSettings,send:send,getDraft:function(){return JSON.parse(JSON.stringify(flow));},buildSearchText:buildSearchText};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
