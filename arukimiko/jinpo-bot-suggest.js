/*
 * たいらの野望 / 陣法Bot やわらか提案エンジン v0.9.0
 * 検索結果が広すぎる/0件のときだけ、勝手に条件を変えず次の一手を提案する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SUGGEST) return;

  var VERSION='0.9.0';
  var PREF_KEY='jinpo_bot_suggest_pref_v1';
  var SESSION_KEY='jinpo_bot_suggest_dismissed_v1';
  var lastUserText='';
  var lastUserAt=0;

  function S(v){return String(v==null?'':v);}
  function readJson(storage,key,fallback){
    try{var raw=storage&&storage.getItem(key);if(!raw)return fallback;var v=JSON.parse(raw);return v==null?fallback:v;}catch(e){return fallback;}
  }
  function writeJson(storage,key,value){try{if(storage)storage.setItem(key,JSON.stringify(value));return true;}catch(e){return false;}}
  function prefs(){
    var p=readJson(window.localStorage,PREF_KEY,{});p=p&&typeof p==='object'?p:{};
    var level=/^(low|standard|high)$/.test(p.level)?p.level:'standard';
    var streak=Math.max(0,Math.min(6,Number(p.dismissStreak)||0));
    return {level:level,dismissStreak:streak};
  }
  function savePrefs(p){return writeJson(window.localStorage,PREF_KEY,{level:/^(low|standard|high)$/.test(p.level)?p.level:'standard',dismissStreak:Math.max(0,Math.min(6,Number(p.dismissStreak)||0))});}
  function sessionDismissed(){var v=readJson(window.sessionStorage,SESSION_KEY,{});return v&&typeof v==='object'?v:{};}
  function setSessionDismissed(v){writeJson(window.sessionStorage,SESSION_KEY,v||{});}
  function parseCount(v){var m=S(v).replace(/,/g,'').match(/\d+/);return m?Number(m[0]):NaN;}
  function signature(st){
    st=st||{};return [st.formation||'',Number(st.count)||0,st.priority1||'',st.priority1Min==null?'':st.priority1Min,st.priority1Max==null?'':st.priority1Max,st.priority2||'',st.priority2Min==null?'':st.priority2Min,st.priority2Max==null?'':st.priority2Max,st.grade3?'1':'0',Number(st.factor4Exclude)||0,st.sumSort?'1':'0',st.recommendActive?('r:'+S(st.recommendTarget)):''].join('|');
  }
  function specificity(st){
    st=st||{};var n=0;if(st.count)n+=1;if(st.formation)n+=1;if(st.priority1)n+=2;if(st.priority2)n+=2;
    if(st.priority1Min!=null||st.priority1Max!=null)n+=1;if(st.priority2Min!=null||st.priority2Max!=null)n+=1;
    if(st.grade3)n+=1;if(Number(st.factor4Exclude)>0)n+=1;if(st.sumSort)n+=1;if(st.recommendActive)n+=2;return n;
  }
  function isBroadIntent(text){
    text=S(text).replace(/\s+/g,'');return /全部見|全件|広く|広め|幅広|とりあえず|このまま(?:見|で|検索)|絞らない|絞らなく|たくさん|多めに(?:出|見)|いっぱい(?:出|見)|できるだけ多|候補全部|一覧(?:で)?見/.test(text);
  }
  function isNarrowIntent(text){
    text=S(text).replace(/\s+/g,'');return /絞|おすすめ|最適|一番|厳選|的確|候補を減|少なめ|強い|高い/.test(text);
  }
  function threshold(st){
    var p=prefs(),base=p.level==='low'?350:p.level==='high'?110:200;
    var score=specificity(st);var factor=score<=2?1:score<=4?1.45:score<=6?2:2.7;
    factor*=1+(p.dismissStreak*0.25);return Math.round(base*factor);
  }
  function veryHighThreshold(st){return Math.max(600,Math.round(threshold(st)*2.8));}
  function noteUserText(text){lastUserText=S(text).trim();lastUserAt=Date.now();}
  function recentUserText(){return Date.now()-lastUserAt<45000?lastUserText:'';}
  function dismissedAt(sig){var d=sessionDismissed();return Number(d[sig])||0;}
  function wasDismissed(sig){return dismissedAt(sig)>0;}
  function recordDismiss(sig){
    if(sig){var d=sessionDismissed();d[sig]=Date.now();var keys=Object.keys(d).sort(function(a,b){return Number(d[b])-Number(d[a]);});keys.slice(24).forEach(function(k){delete d[k];});setSessionDismissed(d);}
    var p=prefs();p.dismissStreak=Math.min(6,p.dismissStreak+1);savePrefs(p);
  }
  function recordAccepted(){var p=prefs();p.dismissStreak=Math.max(0,p.dismissStreak-1);savePrefs(p);}
  function setLevel(level){var p=prefs();if(!/^(low|standard|high)$/.test(level))level='standard';p.level=level;p.dismissStreak=0;savePrefs(p);return prefs();}
  function clearSessionDismissals(){setSessionDismissed({});}

  function manyActions(st){
    st=st||{};var a=[];
    if(!st.priority1)a.push({id:'add_p1',label:'第1優先を追加',primary:true});
    else if(!st.priority2)a.push({id:'add_p2',label:'第2優先を追加',primary:true});
    if(!st.formation)a.push({id:'add_formation',label:'陣形を指定',primary:!a.length});
    if(st.priority1&&st.priority1Min==null&&st.priority1Max==null)a.push({id:'add_p1_min',label:'第1の下限を追加'});
    else if(st.priority2&&st.priority2Min==null&&st.priority2Max==null)a.push({id:'add_p2_min',label:'第2の下限を追加'});
    a.push({id:'top5',label:'上位5件だけ見る'});
    a.push({id:'dismiss',label:'このまま見る',subtle:true});
    return a.slice(0,5);
  }
  function zeroActions(st){
    st=st||{};var a=[];
    if(st.priority2)a.push({id:'remove_p2',label:'第2優先を外して再検索',primary:true});
    if(st.priority2&&(st.priority2Min!=null||st.priority2Max!=null))a.push({id:'relax_p2_range',label:'第2の数値条件だけ外す',primary:!a.length});
    if(st.priority1&&(st.priority1Min!=null||st.priority1Max!=null))a.push({id:'relax_p1_range',label:'第1の数値条件だけ外す',primary:!a.length});
    if(Number(st.factor4Exclude)>0)a.push({id:'remove_factor4',label:'文曲除外を解除'});
    if(!a.length&&st.priority1)a.push({id:'remove_p1',label:'第1優先を外して再検索'});
    a.push({id:'review',label:'条件を選び直す'});
    a.push({id:'dismiss',label:'何もしない',subtle:true});
    return a.slice(0,5);
  }
  function evaluate(st,assistantText){
    st=st||{};var hit=parseCount(st.hit);if(!Number.isFinite(hit))return null;
    var sig=signature(st),u=recentUserText(),broad=isBroadIntent(u),narrow=isNarrowIntent(u);
    if(hit===0){
      if(wasDismissed(sig))return null;
      return {type:'zero',hit:0,signature:sig,message:'今回は候補が見つかりませんでした。必要なら条件を少しだけ緩められます。',actions:zeroActions(st)};
    }
    if(broad)return null;
    var dismissed=dismissedAt(sig);if(dismissed&&!(narrow&&lastUserAt>dismissed))return null;
    var th=threshold(st),vth=veryHighThreshold(st);
    if(narrow)th=Math.max(60,Math.round(th*0.72));
    if(hit<th&&hit<vth)return null;
    var msg=hit>=vth?'候補がかなり多めです。目的が決まっていれば、もう1条件だけ追加すると探しやすくなります。':'候補が多めです。必要なら、もう少しだけ絞ることもできます。';
    return {type:'many',hit:hit,signature:sig,message:msg,actions:manyActions(st)};
  }

  window.JINPO_BOT_SUGGEST={
    version:VERSION,noteUserText:noteUserText,evaluate:evaluate,recordDismiss:recordDismiss,recordAccepted:recordAccepted,
    getPreferences:prefs,setLevel:setLevel,clearSessionDismissals:clearSessionDismissals,signature:signature,
    _test:{parseCount:parseCount,specificity:specificity,isBroadIntent:isBroadIntent,isNarrowIntent:isNarrowIntent,threshold:threshold}
  };
})();
