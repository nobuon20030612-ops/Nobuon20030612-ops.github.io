(function(){
  'use strict';
  if(window.JINPO_BOT_ACTIONS) return;

  var STATS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性'];
  var STAT_ALIASES={
    '生命':'生命','生命力':'生命','気合':'気合','腕力':'腕力','耐久':'耐久力','耐久力':'耐久力',
    '器用':'器用さ','器用さ':'器用さ','知力':'知力','魅力':'魅力','土':'土属性','土属性':'土属性',
    '水':'水属性','水属性':'水属性','火':'火属性','火属性':'火属性','風':'風属性','風属性':'風属性'
  };
  var FORMATION_ALIASES={
    '衡軛':'衡軛','こうやく':'衡軛','コウヤク':'衡軛',
    '鶴翼':'鶴翼','かくよく':'鶴翼','カクヨク':'鶴翼',
    '方円':'方円','ほうえん':'方円','ホウエン':'方円',
    '魚鱗':'魚鱗','ぎょりん':'魚鱗','ギョリン':'魚鱗'
  };

  function q(id){return document.getElementById(id);}
  function qa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));}
  function text(v){return String(v==null?'':v).trim();}
  function norm(v){return text(v).replace(/・/g,'').replace(/[\s　]+/g,'');}
  function canonicalStat(v){return STAT_ALIASES[text(v)]||'';}
  function canonicalFormation(v){return FORMATION_ALIASES[text(v)]||'';}
  function emitChange(el){
    if(!el) return;
    try{el.dispatchEvent(new Event('change',{bubbles:true}));}
    catch(e){var ev=document.createEvent('Event');ev.initEvent('change',true,true);el.dispatchEvent(ev);}
  }
  function emitInput(el){
    if(!el) return;
    try{el.dispatchEvent(new Event('input',{bubbles:true}));}
    catch(e){var ev=document.createEvent('Event');ev.initEvent('input',true,true);el.dispatchEvent(ev);}
  }
  function click(el){if(!el)return false;try{el.click();return true;}catch(e){return false;}}
  function cssEscape(v){try{if(window.CSS&&typeof window.CSS.escape==='function')return window.CSS.escape(String(v));}catch(e){}return String(v).replace(/([\"'\[\]#.:>+~*=() ])/g,'\\$1');}
  function ok(message,data){return {ok:true,message:String(message||''),data:data||{}};}
  function fail(message,data){return {ok:false,message:String(message||''),data:data||{}};}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  async function waitUntil(fn,timeout){
    var end=Date.now()+(Number(timeout)||1800);
    while(Date.now()<end){try{if(fn())return true;}catch(e){}await sleep(25);}return false;
  }

  function getFormation(){
    var el=q('formationSelect');
    if(!el)return'';
    var raw=text(el.value||(el.selectedOptions&&el.selectedOptions[0]&&el.selectedOptions[0].textContent)||'');
    return canonicalFormation(raw);
  }
  function getCount(){
    try{var n=Number(selectedDbListBondCount)||0;if(n>=5&&n<=9)return n;}catch(e){}
    var w=Number(window.selectedDbListBondCount)||0;
    if(w>=5&&w<=9)return w;
    var b=document.querySelector('#dbCountButtons .dbCountBtn.active[data-count]');
    var d=Number(b&&b.getAttribute('data-count'))||0;
    return d>=5&&d<=9?d:0;
  }
  function getGrade3(){
    try{return !!grade3Cost6OnlyEnabled;}catch(e){}
    return !!window.grade3Cost6OnlyEnabled;
  }
  function getPriority(index){
    var s=q('dbPriorityStat'+index),v=q('dbPriorityValue'+index),m=q('dbPriorityMax'+index);
    return {stat:canonicalStat(s&&s.value||'')||text(s&&s.value||''),min:v&&v.value!==''?Number(v.value):null,max:m&&m.value!==''?Number(m.value):null};
  }
  function getFactor4Exclude(){
    try{if(window.JINPO_FACTOR4_FILTER&&typeof window.JINPO_FACTOR4_FILTER.getSelected==='function')return Number(window.JINPO_FACTOR4_FILTER.getSelected())||0;}catch(e){}
    var b=document.querySelector('.jinpoFactor4FilterBtn.active[data-factor4-exclude]');
    return Number(b&&b.getAttribute('data-factor4-exclude'))||0;
  }
  function getSumSort(){
    try{if(typeof window.__jinpoGetSumPrioritySort==='function')return window.__jinpoGetSumPrioritySort();}catch(e){}
    return {enabled:false,stat1:'',stat2:'',tiePrefer:'first'};
  }
  function getRecommendState(){
    try{if(window.JINPO_FAST_SEARCH&&typeof window.JINPO_FAST_SEARCH.getRecommendState==='function'){var r=window.JINPO_FAST_SEARCH.getRecommendState()||{};return {active:!!r.active,targetStat:canonicalStat(r.targetStat)||text(r.targetStat),secondaryStat:canonicalStat(r.secondaryStat)||text(r.secondaryStat),formation:canonicalFormation(r.formation)||text(r.formation)};}}catch(e){}
    return {active:false,targetStat:'',secondaryStat:'',formation:''};
  }
  function getSearchBasis(){
    try{if(window.JINPO_FAST_SEARCH&&typeof window.JINPO_FAST_SEARCH.getSearchStatMode==='function')return window.JINPO_FAST_SEARCH.getSearchStatMode()==='fullmax'?'fullmax':'base';}catch(e){}
    var root=q('jinpoSearchStatMode');return root&&root.dataset&&root.dataset.mode==='fullmax'?'fullmax':'base';
  }
  function setSearchBasis(mode){
    mode=String(mode||'').toLowerCase();mode=(mode==='fullmax'||mode==='max'||mode==='allmax')?'fullmax':'base';
    if(!window.JINPO_FAST_SEARCH||typeof window.JINPO_FAST_SEARCH.setSearchStatMode!=='function')return fail('検索基準の切替機能が準備できていません。');
    var got=window.JINPO_FAST_SEARCH.setSearchStatMode(mode);
    return ok('検索基準を'+(got==='fullmax'?'全MAX込み':'基礎値')+'にしました。',{searchBasis:got});
  }
  function getPlacementSlots(){
    var out=[];
    try{
      var pl=window.placement;
      if(pl){for(var i=1;i<=6;i++){var h=pl[i];out.push(h?{slot:i,internal_id:text(h.internal_id||h['internal_id']||h.id||''),name:text(h['英傑名']||h['名前']||h.name||'')}:null);}return out;}
    }catch(e){}
    var spans=qa('#appliedDbRowDisplay .dbPlacementMini span,#formationView .fslot');
    for(var s=1;s<=6;s++)out.push(null);
    spans.forEach(function(el,idx){
      var slot=idx+1;var iid=text(el.getAttribute&&el.getAttribute('data-hero-internal-id')||'');var nm=text(el.textContent||'').replace(/^\s*\d+\.\s*/,'').split('\n')[0].trim();
      if(slot>=1&&slot<=6)out[slot-1]={slot:slot,internal_id:iid,name:nm};
    });
    return out;
  }
  function getOwnedFilters(){
    var st=window.__ownedHeroReliableState;
    if(st&&Array.isArray(st.selected))return st.selected.slice(0,3).map(String);
    return [1,2,3].map(function(i){var b=q('ownedHeroSlotBtn'+i);var m=text(b&&b.textContent||'').match(/：(.+)$/);return m&&m[1]!=='未選択'?m[1]:'';});
  }
  function getExcluded(){
    try{return typeof window.__jinpoGetExcludedHeroInternalIds==='function'?(window.__jinpoGetExcludedHeroInternalIds()||[]).map(String):[];}catch(e){return[];}
  }
  function getTotalsFrom(rootId){
    var root=q(rootId),out={};
    if(!root)return out;
    qa('.totalStatItem',root).forEach(function(item){
      var name=text((item.querySelector('.statName')||{}).textContent||'').replace(/[：:]/g,'');
      var value=text((item.querySelector('.statVal')||{}).textContent||'');
      var st=canonicalStat(name)||name;if(st)out[st]=value;
    });
    if(!Object.keys(out).length){
      var raw=text(root.textContent||'');STATS.forEach(function(st){var label=st.replace('属性','');var m=raw.match(new RegExp(label+'\\s*[:：]?\\s*([0-9,]+)'));if(m)out[st]=m[1];});
    }
    return out;
  }
  function verifySearchBridge(){
    var form=q('formationSelect'), countBox=q('dbCountButtons');
    var forms=form?qa('option',form).map(function(o){return canonicalFormation(o.value||o.textContent);}).filter(Boolean):[];
    var missing=[];
    if(!form)missing.push('formationSelect');
    if(!countBox)missing.push('dbCountButtons');
    if(!q('dbPriorityStat1'))missing.push('dbPriorityStat1');
    if(!q('dbPriorityStat2'))missing.push('dbPriorityStat2');
    if(typeof window.handleDbCountButtonClick!=='function')missing.push('handleDbCountButtonClick');
    if(!window.JINPO_FAST_SEARCH||typeof window.JINPO_FAST_SEARCH.renderCurrent!=='function')missing.push('JINPO_FAST_SEARCH.renderCurrent');
    ['衡軛','鶴翼','魚鱗','方円'].forEach(function(f){if(forms.indexOf(f)<0)missing.push('formation:'+f);});
    return {ok:missing.length===0,missing:missing,formations:forms,countButtons:qa('#dbCountButtons [data-count]').map(function(b){return Number(b.getAttribute('data-count'))||0;}).filter(Boolean)};
  }
  function activeCountFromDom(){
    var b=document.querySelector('#dbCountButtons .dbCountBtn.active[data-count],#dbCountButtons button.active[data-count]');
    return Number(b&&b.getAttribute('data-count'))||0;
  }
  function readSiteState(){
    var p1=getPriority(1),p2=getPriority(2),sum=getSumSort(),rec=getRecommendState();
    return {
      formation:getFormation(),count:getCount(),grade3:getGrade3(),searchBasis:getSearchBasis(),
      recommendActive:rec.active,recommendTarget:rec.targetStat,recommendSecondary:rec.secondaryStat,recommendFormation:rec.formation,
      priority1:p1.stat,priority1Min:p1.min,priority1Max:p1.max,
      priority2:p2.stat,priority2Min:p2.min,priority2Max:p2.max,
      factor4Exclude:getFactor4Exclude(),sumSort:!!sum.enabled,sumTie:sum.tiePrefer==='second'?'second':'first',
      owned:getOwnedFilters(),excluded:getExcluded(),placement:getPlacementSlots(),
      totals:getTotalsFrom('totalStatResult'),combinedTotals:getTotalsFrom('eiketsuKishinsekiCombinedResult'),
      allMax:!!(q('eiketsuKishinsekiAllMaxIndicator')&&q('eiketsuKishinsekiAllMaxIndicator').classList.contains('show')),
      hit:text((q('jinpoResultHitValue')||{}).textContent||''),shown:text((q('jinpoResultShownValue')||{}).textContent||'')
    };
  }
  function captureSnapshot(){
    var s=readSiteState();
    return {
      formation:s.formation,count:s.count,grade3:s.grade3,searchBasis:s.searchBasis,
      priority1:s.priority1,priority1Min:s.priority1Min,priority1Max:s.priority1Max,
      priority2:s.priority2,priority2Min:s.priority2Min,priority2Max:s.priority2Max,
      factor4Exclude:s.factor4Exclude,sumSort:s.sumSort,sumTie:s.sumTie,
      placementSlots:(s.placement||[]).map(function(x){return x&&x.internal_id?x.internal_id:null;}),
      owned:(s.owned||[]).slice(0,3),excluded:(s.excluded||[]).slice(),
      allMax:s.allMax
    };
  }

  function setFormation(value){
    var form=canonicalFormation(value)||text(value);if(!form)return fail('陣形を判定できません。');
    var el=q('formationSelect');if(!el)return fail('陣形選択欄が見つかりません。');
    var option=qa('option',el).find(function(o){return canonicalFormation(o.value||o.textContent)===form;});
    if(!option)return fail('現在の画面に「'+form+'」がありません。');
    if(canonicalFormation(el.value)!==form){el.value=option.value;emitChange(el);}return ok(form+'を選択しました。',{formation:form});
  }
  function setCountNoSearch(count){
    var n=Number(count)||0;if(n<5||n>9)return fail('因縁数は5〜9で指定してください。');
    try{selectedDbListBondCount=n;}catch(e){}window.selectedDbListBondCount=n;
    try{if(typeof window.__jinpoUnifiedRenderCountButtons==='function')window.__jinpoUnifiedRenderCountButtons();else if(typeof window.renderDbCountButtons==='function')window.renderDbCountButtons();}catch(e){}
    return ok(n+'因縁を選択しました。',{count:n});
  }
  function setGrade3(value){
    var on=!!value;try{grade3Cost6OnlyEnabled=on;}catch(e){}window.grade3Cost6OnlyEnabled=on;
    try{if(typeof window.__jinpoUnifiedRenderCountButtons==='function')window.__jinpoUnifiedRenderCountButtons();else if(typeof window.renderDbCountButtons==='function')window.renderDbCountButtons();}catch(e){}
    return ok('等級3以下を'+(on?'ON':'OFF')+'にしました。',{grade3:on});
  }
  function syncPriorityRangeVisual(index,min,max){
    var box=q('dbPriorityValueButtons'+index);if(!box)return;
    qa('.dbPriorityValueChoice',box).forEach(function(b){
      var t=text(b.textContent);var n=Number((t.match(/[0-9]+/)||[])[0]);var active=(/以上/.test(t)&&min!=null&&n===Number(min))||(/以下/.test(t)&&max!=null&&n===Number(max));b.classList.toggle('active',!!active);
    });
  }
  function setPriority(index,spec,silent){
    index=Number(index);spec=spec||{};if(index!==1&&index!==2)return fail('優先番号が不正です。');
    var s=q('dbPriorityStat'+index),v=q('dbPriorityValue'+index),m=q('dbPriorityMax'+index);if(!s||!v)return fail('第'+index+'優先欄が見つかりません。');
    var cur=getPriority(index),rawStat=spec.stat||(spec.inheritStat?cur.stat:''),clearing=!!spec.clear||(!rawStat&&!spec.inheritStat),stat=clearing?'':canonicalStat(rawStat||'');
    if(!clearing&&rawStat&&!stat)return fail('ステータス「'+rawStat+'」を判定できません。');
    if(!clearing&&!stat)return fail('第'+index+'優先のステータスが未選択です。');
    var min=spec.min===undefined?(spec.inheritStat?cur.min:null):spec.min;
    var max=spec.max===undefined?(spec.inheritStat?cur.max:null):spec.max;
    var changedStat=s.value!==stat;s.value=stat;if(changedStat&&!silent)emitChange(s);
    if(v)v.value=min==null?'':String(Number(min));
    if(m)m.value=max==null?'':String(Number(max));
    syncPriorityRangeVisual(index,min,max);
    try{if(typeof window.__jinpoSyncPriorityStatColors==='function')window.__jinpoSyncPriorityStatColors();}catch(e){}
    return ok(clearing?'第'+index+'優先を解除しました。':'第'+index+'優先を'+stat+'にしました。',{index:index,stat:stat,min:min==null?null:Number(min),max:max==null?null:Number(max)});
  }

  async function mutateWithoutSearch(fn){
    var old=getCount();var active=qa('#dbCountButtons .dbCountBtn.active[data-count]');
    try{selectedDbListBondCount=null;}catch(e){}window.selectedDbListBondCount=null;active.forEach(function(b){b.classList.remove('active');});
    try{return await fn();}
    finally{await sleep(5);try{selectedDbListBondCount=old||null;}catch(e){}window.selectedDbListBondCount=old||null;try{if(typeof window.__jinpoUnifiedRenderCountButtons==='function')window.__jinpoUnifiedRenderCountButtons();}catch(e){}}
  }
  async function setFactor4Exclude(value,defer){
    var n=Number(value);if(!Number.isFinite(n)||n<0||n>6)return fail('文曲除外人数は0〜6で指定してください。');
    if(getFactor4Exclude()===n)return ok('文曲除外人数は'+n+'人です。',{factor4Exclude:n});
    var btn=document.querySelector('.jinpoFactor4FilterBtn[data-factor4-exclude="'+n+'"]');if(!btn)return fail('文曲除外人数の操作ボタンが見つかりません。');
    if(defer)await mutateWithoutSearch(async function(){click(btn);});else click(btn);
    return ok('文曲除外人数を'+n+'人にしました。',{factor4Exclude:n});
  }
  async function setSumSort(enabled,tie,defer){
    var root=q('jinpoSumPrioritySort');if(!root)return fail('第1・第2合計ソート機能が見つかりません。');
    var run=async function(){
      var b=root.querySelector('[data-sum-priority-enabled="'+(enabled?'1':'0')+'"]');if(b&&!b.disabled)click(b);
      if(enabled&&tie){var t=root.querySelector('[data-sum-tie="'+(tie==='second'?'second':'first')+'"]');if(t&&!t.disabled)click(t);}
    };
    if(defer)await mutateWithoutSearch(run);else await run();
    return ok('第1・第2合計ソートを'+(enabled?'ON':'OFF')+'にしました。',{enabled:!!enabled,tie:tie==='second'?'second':'first'});
  }

  async function applySearch(patch){
    patch=patch||{};var bridge=verifySearchBridge();
    if(!bridge.ok)return fail('陣法検索との接続を確認できませんでした。ページの読み込み完了後にもう一度お試しください。',{bridge:bridge});
    var before=readSiteState();
    var desired={
      formation:patch.formation!==undefined?(canonicalFormation(patch.formation)||''):before.formation,
      count:patch.count!==undefined?Number(patch.count)||0:before.count,
      grade3:patch.grade3!==undefined?!!patch.grade3:before.grade3,
      searchBasis:patch.searchBasis!==undefined?(String(patch.searchBasis).toLowerCase()==='fullmax'?'fullmax':'base'):before.searchBasis,
      priority1:patch.priority1!==undefined?patch.priority1:{stat:before.priority1,min:before.priority1Min,max:before.priority1Max},
      priority2:patch.priority2!==undefined?patch.priority2:{stat:before.priority2,min:before.priority2Min,max:before.priority2Max},
      factor4Exclude:patch.factor4Exclude!==undefined?Number(patch.factor4Exclude):before.factor4Exclude,
      sumSort:patch.sumSort!==undefined?!!patch.sumSort:before.sumSort,
      sumTie:patch.sumTie!==undefined?patch.sumTie:before.sumTie
    };
    if(!desired.formation)return fail('陣形が未選択です。衡軛・鶴翼・魚鱗・方円から指定してください。');
    if(!desired.count||desired.count<5||desired.count>9)return fail('因縁数が未選択です。5〜9因縁から指定してください。');
    var br=setSearchBasis(desired.searchBasis);if(!br.ok)return br;
    var r=setFormation(desired.formation);if(!r.ok)return r;
    setGrade3(desired.grade3);
    r=setPriority(1,desired.priority1||{clear:true});if(!r.ok)return r;
    r=setPriority(2,desired.priority2||{clear:true});if(!r.ok)return r;
    setCountNoSearch(desired.count);
    if(desired.factor4Exclude!==getFactor4Exclude()){r=await setFactor4Exclude(desired.factor4Exclude,true);if(!r.ok)return r;}
    var sum=getSumSort();if(!!sum.enabled!==!!desired.sumSort||(desired.sumSort&&sum.tiePrefer!==desired.sumTie)){r=await setSumSort(desired.sumSort,desired.sumTie,true);if(!r.ok)return r;}
    if(typeof window.handleDbCountButtonClick!=='function')return fail('既存の陣法検索機能が準備できていません。');
    var ret=window.handleDbCountButtonClick(desired.count);if(ret&&typeof ret.then==='function')await ret;
    await waitUntil(function(){return activeCountFromDom()===desired.count;},1200);
    var after=readSiteState(), p1After=getPriority(1), p2After=getPriority(2);
    var mismatches=[];
    if(activeCountFromDom()!==desired.count)mismatches.push('因縁数');
    if(canonicalFormation(after.formation)!==canonicalFormation(desired.formation))mismatches.push('陣形');
    if(getSearchBasis()!==desired.searchBasis)mismatches.push('検索基準');
    var p1Desired=desired.priority1&&desired.priority1.stat?canonicalStat(desired.priority1.stat)||text(desired.priority1.stat):'';
    var p2Desired=desired.priority2&&desired.priority2.stat?canonicalStat(desired.priority2.stat)||text(desired.priority2.stat):'';
    if((canonicalStat(p1After.stat)||text(p1After.stat))!==p1Desired)mismatches.push('第1優先');
    if((canonicalStat(p2After.stat)||text(p2After.stat))!==p2Desired)mismatches.push('第2優先');
    if(mismatches.length)return fail('検索条件の反映を確認できませんでした：'+mismatches.join('・')+'。検索成功とは判定せず停止しました。',{state:after,mismatches:mismatches,bridge:verifySearchBridge()});
    return ok('検索しました。',{state:after,verified:true,activeCount:activeCountFromDom()});
  }
  async function runRecommended(stat){
    stat=canonicalStat(stat);if(!stat)return fail('おすすめ陣法で優先するステータスを指定してください。');
    if(!window.JINPO_FAST_SEARCH||typeof window.JINPO_FAST_SEARCH.runRecommended!=='function')return fail('おすすめ陣法検索が準備できていません。');
    var ret=window.JINPO_FAST_SEARCH.runRecommended(stat);if(ret&&typeof ret.then==='function')await ret;
    return ok(stat+'優先でおすすめ陣法を検索しました。',{state:readSiteState()});
  }
  async function runSpecifiedSimple(a){
    a=a||{};var formation=canonicalFormation(a.formation),stat=canonicalStat(a.stat),min=(a.min===null||a.min===undefined||a.min==='')?null:Number(a.min);
    if(!formation)return fail('陣形を選び直してみましょう。');
    if(!stat)return fail('重視するステータスを選び直してみましょう。');
    if(min!==null&&!Number.isFinite(min))return fail('能力値を選び直してみましょう。');
    if(!window.JINPO_FAST_SEARCH||typeof window.JINPO_FAST_SEARCH.runSpecified!=='function')return fail('指定検索の準備がまだ整っていません。');
    var ret=window.JINPO_FAST_SEARCH.runSpecified(formation,stat,min);if(ret&&typeof ret.then==='function')await ret;
    var st=readSiteState(),rec=getRecommendState();
    if(canonicalFormation(st.formation)!==formation||canonicalFormation(rec.formation)!==formation)return fail('指定した陣形の反映を確認できませんでした。もう一度選び直してみましょう。',{state:st,recommend:rec});
    return ok(formation+'で'+stat+(min!==null?' '+min+'以上':'')+'を条件に検索しました。',{state:st,formation:formation,stat:stat,min:min});
  }
  async function runBest(a){
    a=a||{};var s1=canonicalStat(a.stat1||a.stat),s2=canonicalStat(a.stat2||'');
    if(!s1)return fail('一番高いものを探すステータスを教えてください。');
    if(s2===s1)s2='';
    var first=await runRecommended(s1);if(!first.ok||!s2)return first;
    var second=await updateRecommended({priority2:{stat:s2}});if(!second.ok)return second;
    return ok(s1+'と'+s2+'の合計が一番高い組み合わせを全陣形から検索しました。',{state:readSiteState(),stat1:s1,stat2:s2});
  }
  async function updateRecommended(patch){
    patch=patch||{};var rec=getRecommendState();if(!rec.active||!rec.targetStat)return fail('おすすめ陣法モードではありません。');
    var target=rec.targetStat,changedTarget=false;
    if(patch.priority1&&patch.priority1.stat){var nt=canonicalStat(patch.priority1.stat);if(nt&&nt!==target){target=nt;changedTarget=true;}}
    if(patch.grade3!==undefined)setGrade3(!!patch.grade3);
    if(changedTarget){var first=window.JINPO_FAST_SEARCH.runRecommended(target);if(first&&typeof first.then==='function')await first;}
    if(patch.priority2!==undefined){var pr=setPriority(2,patch.priority2||{clear:true},true);if(!pr.ok)return pr;}
    if(!changedTarget&&patch.priority1!==undefined){var p1=setPriority(1,patch.priority1||{clear:true},true);if(!p1.ok)return p1;target=(patch.priority1&&patch.priority1.stat)?canonicalStat(patch.priority1.stat)||target:target;}
    var factorChanged=patch.factor4Exclude!==undefined&&Number(patch.factor4Exclude)!==getFactor4Exclude();
    if(factorChanged){var fr=await setFactor4Exclude(patch.factor4Exclude,false);if(!fr.ok)return fr;await waitUntil(function(){var p=q('dbSearchProgress');return !p||!p.classList.contains('active');},12000);}
    else{var ret=window.JINPO_FAST_SEARCH.runRecommended(target);if(ret&&typeof ret.then==='function')await ret;}
    return ok('おすすめ陣法の条件を更新しました。',{state:readSiteState()});
  }
  function cancelSearch(){
    var b=q('dbSearchProgressCancel');if(b){click(b);return ok('検索を中止しました。');}
    try{window.__jinpoSearchCancelRequested=true;}catch(e){}return ok('検索中止を要求しました。');
  }

  function getResults(limit){
    var buttons=qa('#dbFormationList button[data-unified-db-idx]');var n=Math.max(1,Math.min(Number(limit)||10,50));var out=[];
    buttons.slice(0,n).forEach(function(btn,idx){
      var tr=btn.closest('tr.dbMainRow')||btn.closest('tr');var cells=tr?qa('td',tr):[];var names=tr?qa('.dbPlacementMini span',tr).map(function(x){return text(x.textContent).replace(/^\d+\.\s*/, '');}):[];var bonds=tr?qa('.dbListBonds .badge',tr).map(function(x){return text(x.textContent);}):[];var statRow=tr&&tr.nextElementSibling&&tr.nextElementSibling.classList.contains('dbStatRow')?tr.nextElementSibling:null;
      out.push({rank:idx+1,count:text(cells[1]&&cells[1].textContent||''),formation:text(cells[2]&&cells[2].textContent||''),members:names,bonds:bonds,stats:text(statRow&&statRow.textContent||'').replace(/[\s　]+/g,' ').trim()});
    });
    return out;
  }
  function applyResult(rank){
    var n=Number(rank)||0;var buttons=qa('#dbFormationList button[data-unified-db-idx]');if(n<1||n>buttons.length)return fail('検索結果の'+n+'番目が見つかりません。',{available:buttons.length});
    var snap=captureSnapshot();click(buttons[n-1]);return ok(n+'番目を適用しました。',{rank:n,snapshot:snap,state:readSiteState()});
  }
  function compareResults(ranks){
    var all=getResults(50);var out=[];(ranks||[]).forEach(function(r){var hit=all[Number(r)-1];if(hit)out.push(hit);});return out.length?ok('検索結果を比較しました。',{results:out}):fail('比較する検索結果が見つかりません。');
  }
  function sortResults(stat,dir){
    stat=canonicalStat(stat)||text(stat);if(!stat)return fail('並べ替えるステータスを判定できません。');dir=String(dir||'desc').toLowerCase()==='asc'?'asc':'desc';
    var btn=qa('#dbFormationList button[data-list-sort]').find(function(b){return canonicalStat(b.getAttribute('data-list-sort'))===stat||text(b.getAttribute('data-list-sort'))===stat;});
    if(!btn)return fail('検索結果の「'+stat+'」並べ替えボタンが見つかりません。検索結果を表示してから実行してください。');
    var current=function(b){var t=text(b&&b.textContent||'');return t.indexOf('▲')>=0?'asc':t.indexOf('▼')>=0?'desc':'';};
    if(current(btn)!==dir){click(btn);btn=qa('#dbFormationList button[data-list-sort]').find(function(b){return canonicalStat(b.getAttribute('data-list-sort'))===stat||text(b.getAttribute('data-list-sort'))===stat;});if(btn&&current(btn)!==dir)click(btn);}
    return ok('検索結果を'+stat+(dir==='asc'?'の低い順':'の高い順')+'に並べ替えました。',{stat:stat,dir:dir});
  }
  function runCalculation(){var b=q('calcBtn');if(!b)return fail('因縁判定機能が見つかりません。');click(b);return ok('現在の6人で因縁判定を実行しました。',{state:readSiteState()});}

  function exitRecommended(){
    try{if(window.JINPO_FAST_SEARCH&&typeof window.JINPO_FAST_SEARCH.exitRecommendMode==='function'){window.JINPO_FAST_SEARCH.exitRecommendMode();return ok('おすすめ陣法モードを解除しました。',{state:readSiteState()});}}catch(e){}
    return fail('おすすめ陣法の解除機能が見つかりません。');
  }
  function clearPlacement(){var b=q('clearBtn');if(!b)return fail('配置クリア機能が見つかりません。');click(b);return ok('現在の6人配置をクリアしました。',{state:readSiteState()});}
  async function showBondList(mode,query){
    mode=String(mode||'all')==='active'?'active':'all';var b=q(mode==='active'?'jinpoBondActiveBtn':'jinpoBondAllBtn');
    if(!b)return fail(mode==='active'?'現在発動中因縁の表示機能が見つかりません。':'因縁一覧機能が見つかりません。');
    click(b);await waitUntil(function(){var m=q('jinpoBondModalBackdrop');return !!(m&&(m.classList.contains('is-open')||m.getAttribute('aria-hidden')==='false'));},1200);
    var input=q('jinpoBondSearch');if(query&&input){input.value=String(query);emitInput(input);}
    return ok(mode==='active'?'現在発動中因縁を表示しました。':'因縁一覧を表示しました。',{mode:mode,query:text(query)});
  }
  function openEnhancement(){var b=q('eiketsuKishinsekiOpenBtn');if(!b)return fail('転生＆見聞録＆鬼神石画面が見つかりません。');click(b);return ok('転生＆見聞録＆鬼神石画面を開きました。');}
  function openOwnedPicker(slot){slot=Number(slot)||1;if(slot<1||slot>3)return fail('配置英傑の指定枠は1〜3です。');if(typeof window.__ownedHeroOpenReliable!=='function')return fail('配置英傑選択画面が準備できていません。');window.__ownedHeroOpenReliable(slot-1,null);return ok('配置英傑'+slot+'の選択画面を開きました。',{slot:slot});}
  function openExcludedPicker(){var b=q('jinpoExcludedHeroOpenBtn');if(!b)return fail('除外英傑選択画面が見つかりません。');click(b);return ok('除外英傑選択画面を開きました。');}
  function exportJson(){var b=q('exportJsonBtn');if(!b)return fail('JSON出力機能が見つかりません。');click(b);return ok('現在編成のJSON出力を実行しました。');}
  function openFilePicker(id,label){var input=q(id);if(!input)return fail(label+'のファイル選択欄が見つかりません。');try{click(input);return ok(label+'のファイル選択を開きました。');}catch(e){return fail(label+'のファイル選択を開けませんでした。');}}
  async function importSelectedJson(){var input=q('importJsonFile'),b=q('importJsonBtn');if(!input||!b)return fail('JSON読込機能が見つかりません。');if(!input.files||!input.files[0])return fail('JSONファイルが選択されていません。先にサイトのJSONファイル欄でファイルを選択してください。');var st=q('shareStatus'),before=text(st&&st.textContent||'');click(b);await waitUntil(function(){return text(st&&st.textContent||'')!==before;},1600);var msg=text(st&&st.textContent||'');return /失敗/.test(msg)?fail(msg||'JSON読込に失敗しました。'):ok(msg||'選択済みJSONを読み込みました。',{state:readSiteState()});}
  async function applySelectedBondMaster(){var input=q('overrideInenFile'),b=q('applyOverrideInenBtn');if(!input||!b)return fail('因縁マスター差替機能が見つかりません。');if(!input.files||!input.files[0])return fail('因縁マスターCSVが選択されていません。先にサイトのファイル欄でCSVを選択してください。');var st=q('overrideInenStatus'),before=text(st&&st.textContent||'');click(b);await waitUntil(function(){return text(st&&st.textContent||'')!==before;},1800);var msg=text(st&&st.textContent||'');return /失敗/.test(msg)?fail(msg||'因縁マスターの適用に失敗しました。'):ok(msg||'選択済み因縁マスターを適用しました。');}
  function resetBondMaster(){var b=q('resetOverrideInenBtn');if(!b)return fail('標準因縁へ戻す機能が見つかりません。');click(b);return ok('標準因縁マスターへ戻しました。');}
  function scrollTopAction(){try{window.scrollTo({top:0,behavior:'smooth'});return ok('ページ上部へ移動しました。');}catch(e){return fail('ページ上部へ移動できませんでした。');}}
  function scrollResultAction(){var el=q('summary')||q('dbFormationList');if(!el||typeof el.scrollIntoView!=='function')return fail('結果位置が見つかりません。');el.scrollIntoView({behavior:'smooth',block:'start'});return ok('結果位置へ移動しました。');}

  function readActivatedBonds(){
    var names=qa('#activatedList .activatedBondName,#summary .activatedBondName').map(function(x){return text(x.textContent);}).filter(Boolean);
    if(!names.length){var s=text((q('summary')||{}).textContent||'');var m=s.match(/発動[:：]\s*([^\n]+)/);if(m)names=m[1].split('/').map(text).filter(Boolean);}
    return names;
  }
  function readCurrentPlacement(){return getPlacementSlots().filter(Boolean);}

  async function setOwnedHero(slot,query){
    slot=Number(slot);if(slot<1||slot>3)return fail('配置英傑の指定枠は1〜3です。');if(!query)return fail('英傑名またはinternal_idを指定してください。');
    if(typeof window.__ownedHeroOpenReliable!=='function')return fail('配置英傑選択機能が準備できていません。');
    return mutateWithoutSearch(async function(){
      window.__ownedHeroOpenReliable(slot-1,null);var st=window.__ownedHeroReliableState;if(st)st.justOpenedAt=0;
      var search=q('ownedHeroReliableSearch');if(search){search.value=String(query);emitInput(search);}var cards=qa('#ownedHeroReliableGrid [data-owned-reliable-key]');
      var nq=norm(query);var exact=cards.filter(function(c){var id=text(c.getAttribute('data-owned-reliable-key'));var nm=norm((c.querySelector('.ownedHeroName')||c).textContent||'').replace(/選択中$/,'');return id===text(query)||nm===nq;});
      var matches=exact.length?exact:cards.filter(function(c){var nm=norm((c.querySelector('.ownedHeroName')||c).textContent||'').replace(/選択中$/,'');return nq&&nm.indexOf(nq)>=0;});
      if(matches.length!==1){var candidates=(matches.length?matches:cards).slice(0,8).map(function(c){return {id:text(c.getAttribute('data-owned-reliable-key')),name:text((c.querySelector('.ownedHeroName')||c).textContent||'').replace(/\s*選択中\s*$/,'')};});return fail(matches.length>1?'候補が複数あります。もう少し名前を詳しく指定してください。':'該当英傑が見つかりません。',{candidates:candidates});}
      var selectedName=text((matches[0].querySelector('.ownedHeroName')||matches[0]).textContent||'').replace(/\s*選択中\s*$/,'');click(matches[0]);return ok('配置英傑'+slot+'に'+selectedName+'を指定しました。',{slot:slot,id:text(matches[0].getAttribute('data-owned-reliable-key')),hero:selectedName});
    });
  }
  async function setOwnedHeroAuto(query){
    if(!query)return fail('使いたい英傑名を指定してください。');
    var owned=getOwnedFilters(),slot=0;
    for(var i=0;i<3;i++){if(!owned[i]){slot=i+1;break;}}
    if(!slot)return fail('配置英傑1〜3がすべて指定済みです。どの配置英傑を入れ替えるか教えてください。',{owned:owned});
    return setOwnedHero(slot,query);
  }
  async function rerunCurrentSearch(){
    var st=readSiteState();
    if(!st.formation||!st.count)return ok('条件を変更しました。検索条件がまだ揃っていないので、続けて陣形と因縁数を選んでください。',{skipped:true,state:st});
    return applySearch({formation:st.formation,count:st.count,grade3:!!st.grade3,priority1:st.priority1?{stat:st.priority1,min:st.priority1Min,max:st.priority1Max}:{clear:true},priority2:st.priority2?{stat:st.priority2,min:st.priority2Min,max:st.priority2Max}:{clear:true},factor4Exclude:Number(st.factor4Exclude)||0,sumSort:!!st.sumSort,sumTie:st.sumTie||'first'});
  }

  async function clearOwnedHeroes(){
    if(typeof window.__ownedHeroClearReliable!=='function')return fail('配置英傑解除機能が準備できていません。');
    return mutateWithoutSearch(async function(){window.__ownedHeroClearReliable();return ok('配置英傑指定を解除しました。');});
  }
  async function clearOwnedHero(slot){
    slot=Number(slot);if(slot<1||slot>3)return fail('配置英傑の解除枠は1〜3です。');
    var before=getOwnedFilters();if(!before[slot-1])return ok('配置英傑'+slot+'は未選択です。',{slot:slot});
    var keep=before.slice();keep[slot-1]='';var cr=await clearOwnedHeroes();if(!cr.ok)return cr;
    for(var i=0;i<keep.length;i++){if(keep[i]){var sr=await setOwnedHero(i+1,keep[i]);if(!sr.ok)return fail('配置英傑'+slot+'は解除しましたが、他枠の復元に失敗しました。',{slot:slot,failedSlot:i+1,detail:sr.message});}}
    return ok('配置英傑'+slot+'を解除しました。',{slot:slot,state:readSiteState()});
  }
  async function setExcludedHero(query,excluded){
    if(!query)return fail('除外する英傑を指定してください。');var open=q('jinpoExcludedHeroOpenBtn');if(!open)return fail('除外英傑機能が準備できていません。');
    return mutateWithoutSearch(async function(){
      click(open);var search=q('jinpoExcludedHeroSearch');if(search){search.value=String(query);emitInput(search);}var boxes=qa('#jinpoExcludedHeroList input[data-jinpo-exclude-id]');var nq=norm(query);var exact=boxes.filter(function(cb){var id=text(cb.getAttribute('data-jinpo-exclude-id'));var label=cb.closest('label');var nm=norm(label&&label.textContent||'').replace(norm(id),'').replace(/^\[[0-9]+\]/,'');return id===text(query)||nm.indexOf(nq)>=0;});
      if(exact.length!==1){return fail(exact.length>1?'同名候補が複数あります。internal_idで指定してください。':'該当英傑が見つかりません。',{candidates:exact.slice(0,8).map(function(cb){return {id:text(cb.getAttribute('data-jinpo-exclude-id')),label:text(cb.closest('label')&&cb.closest('label').textContent||'')};})});}
      var cb=exact[0];if(cb.checked!==!!excluded){cb.checked=!!excluded;emitChange(cb);}var close=q('jinpoExcludedHeroCloseBtn');if(close)click(close);var lab=cb.closest('label'),heroName=text(lab&&lab.textContent||query).replace(/^\s*\[[0-9]+\]\s*/,'').replace(text(cb.getAttribute('data-jinpo-exclude-id')),'').trim()||text(query);return ok(heroName+'を'+(excluded?'除外しました。':'除外から戻しました。'),{id:text(cb.getAttribute('data-jinpo-exclude-id')),hero:heroName,excluded:!!excluded});
    });
  }
  async function clearExcludedHeroes(){
    if(typeof window.__jinpoClearExcludedHeroes!=='function')return fail('除外英傑解除機能が準備できていません。');
    await mutateWithoutSearch(async function(){window.__jinpoClearExcludedHeroes({silent:true});});return ok('除外英傑をすべて解除しました。');
  }

  function getSwapCandidates(limit,levels){
    var n=Math.max(1,Math.min(Number(limit)||20,100)),out=[],map=window.__step66ReachCandidateMap;
    var allow=Array.isArray(levels)&&levels.length?levels.map(function(x){return String(x||'').toLowerCase();}):null;
    if(map&&typeof map==='object'){
      Object.keys(map).map(Number).sort(function(a,b){return a-b;}).forEach(function(slot){
        (map[slot]||[]).forEach(function(c){
          var level=String(c&&c.level||'').toLowerCase();if(allow&&allow.indexOf(level)<0)return;
          out.push({rank:out.length+1,slot:Number(c.slot)||slot,afterId:text(c.afterId),after:text(c.after),level:level,from:Number(c.from)||0,to:Number(c.to)||0,delta:Number(c.delta)||0,usesFactor4:!!c.usesFactor4,label:(level==='up'?'UP':level==='flat'?'FLAT':'DOWN')+' 因縁数 '+(Number(c.from)||0)+' → '+(Number(c.to)||0)+' / '+text(c.after),registered:true});
        });
      });
      return out.slice(0,n).map(function(x,i){x.rank=i+1;return x;});
    }
    var buttons=qa('#reachList button.reachApplyBtn[data-reach-slot][data-reach-after]');
    buttons.forEach(function(b){var row=b.closest('tr')||b.closest('article')||b.parentElement,lab=text(row&&row.textContent||'').replace(/[\s　]+/g,' ').trim();var level=/\bUP\b/i.test(lab)?'up':/\bFLAT\b/i.test(lab)?'flat':/\bDOWN\b/i.test(lab)?'down':'';if(allow&&allow.indexOf(level)<0)return;out.push({rank:out.length+1,slot:Number(b.getAttribute('data-reach-slot'))||0,afterId:text(b.getAttribute('data-reach-after')),after:'',level:level,label:lab,registered:!b.classList.contains('dbMissing')});});
    return out.slice(0,n).map(function(x,i){x.rank=i+1;return x;});
  }
  async function applySwap(args){
    args=args||{};var slot=Number(args.slot)||0,after=text(args.afterId||args.hero||'');
    if(args.rank){var list=getSwapCandidates(100),c=list[Number(args.rank)-1];if(!c)return fail('差替候補の'+args.rank+'番目が見つかりません。');slot=c.slot;after=c.afterId;}
    if(!slot||!after)return fail('差替候補を特定できません。');if(typeof window.applyReachSwapCandidate!=='function')return fail('差替機能が準備できていません。');
    var ret=window.applyReachSwapCandidate(slot,after);if(ret&&typeof ret.then==='function')await ret;return ok('差替を適用しました。',{slot:slot,afterId:after,state:readSiteState()});
  }

  function ensureEnhancementModal(){
    var open=q('eiketsuKishinsekiOpenBtn');if(open)click(open);var m=q('eiketsuKishinsekiModalBackdrop');return m||null;
  }
  async function applyEnhancementModal(modal){
    var btn=modal&&modal.querySelector('#eiketsuKishinsekiApplyBtn');if(!btn)return false;click(btn);await waitUntil(function(){var layer=modal.querySelector('#eiketsuKishinsekiApplyLoading');return !layer||!layer.classList.contains('show');},2200);return true;
  }
  async function setEnhancementValue(type,key,stat,value){
    type=type==='kishin'?'kishin':'kenbun';stat=canonicalStat(stat);if(!stat)return fail('ステータスを判定できません。');var modal=ensureEnhancementModal();if(!modal)return fail('転生＆見聞録＆鬼神石画面を開けません。');
    if(type==='kenbun'){modal.__eksSetPanel&&modal.__eksSetPanel('kenbun');modal.__eksSetKenbunJob&&modal.__eksSetKenbunJob(String(key||'侍'));}
    else{modal.__eksSetPanel&&modal.__eksSetPanel('kishin');modal.__eksSetKishinSlot&&modal.__eksSetKishinSlot(String(key||'1'));}
    var selector='input[type="radio"][data-type="'+type+'"][data-stat="'+stat+'"]';var radios=qa(selector,modal);if(!radios.length)return fail('指定項目の入力欄が見つかりません。');
    if(value==='clear'||value===0||value==='0'){
      var row=radios[0]&&radios[0].closest?radios[0].closest('.eiketsuKishinsekiRow'):null;var clearBtn=row&&row.querySelector?row.querySelector('.eiketsuKishinsekiClearBtn'):null;
      if(clearBtn)click(clearBtn);else radios.forEach(function(r){r.checked=false;});
    }else{
      var targetValue=value==='max'?Math.max.apply(null,radios.map(function(r){return Number(r.value)||0;})):Number(value);var target=radios.find(function(r){return Number(r.value)===targetValue;});if(!target)return fail('指定値'+value+'はこの項目で選択できません。',{allowed:radios.map(function(r){return Number(r.value)||0;})});if(!target.checked)click(target);
    }
    await applyEnhancementModal(modal);return ok((type==='kenbun'?'見聞録':'鬼神石')+'を反映しました。',{type:type,key:key,stat:stat,value:value,state:readSiteState()});
  }
  async function setTensei(slot,on){
    slot=Number(slot);if(slot<1||slot>6)return fail('転生の配置番号は1〜6です。');var modal=ensureEnhancementModal();if(!modal)return fail('転生画面を開けません。');modal.__eksSetPanel&&modal.__eksSetPanel('tensei');var b=modal.querySelector('[data-tensei-toggle="'+slot+'"]');if(!b)return fail('転生'+slot+'の操作欄が見つかりません。');if(b.disabled&&on)return fail('この配置は文曲のため転生Lv30をONにできません。');var current=b.classList.contains('active');if(current!==!!on)click(b);await applyEnhancementModal(modal);return ok('転生'+slot+'を'+(on?'ON':'OFF')+'にしました。',{slot:slot,on:!!on,state:readSiteState()});
  }
  async function setEnhancementPanelMax(panel){
    if(panel==='all'){
      if(typeof window.__jinpoApplyGlobalAllMax!=='function')return fail('全MAX機能が準備できていません。');window.__jinpoApplyGlobalAllMax();await waitUntil(function(){var b=q('eiketsuKishinsekiGlobalMaxBtn');return !b||!b.disabled;},2500);return ok('全MAXを反映しました。',{state:readSiteState()});
    }
    var modal=ensureEnhancementModal();if(!modal)return fail('能力付加画面を開けません。');modal.__eksSetPanel&&modal.__eksSetPanel(panel);var b=modal.querySelector('#eiketsuKishinsekiAllMaxBtn');if(!b)return fail('全MAXボタンが見つかりません。');click(b);await applyEnhancementModal(modal);return ok((panel==='kenbun'?'見聞録':panel==='kishin'?'鬼神石':'転生')+'をMAXにしました。',{state:readSiteState()});
  }
  async function clearEnhancementPanel(panel){
    if(panel==='all'){
      if(typeof window.__jinpoClearGlobalAllMax==='function'){window.__jinpoClearGlobalAllMax();return ok('全MAXを解除しました。',{state:readSiteState()});}
      return fail('全MAX解除機能が準備できていません。');
    }
    var modal=ensureEnhancementModal();if(!modal)return fail('能力付加画面を開けません。');modal.__eksSetPanel&&modal.__eksSetPanel(panel);
    if(panel==='tensei'){
      qa('[data-tensei-toggle]',modal).forEach(function(b){if(!b.disabled&&b.classList.contains('active'))click(b);});
    }else{
      qa('.eiketsuKishinsekiClearBtn[data-type="'+panel+'"]',modal).forEach(function(b){click(b);});
    }
    await applyEnhancementModal(modal);return ok((panel==='kenbun'?'見聞録':panel==='kishin'?'鬼神石':'転生')+'を解除しました。',{state:readSiteState()});
  }

  function listSaved(){
    if(!window.JinpoInternalSave||typeof window.JinpoInternalSave.getSaved!=='function')return [];
    return (window.JinpoInternalSave.getSaved()||[]).map(function(x,i){return {rank:i+1,id:String(x.id||''),name:String(x.name||'無題'),formation:String(x.formationName||x.formation||''),members:(x.members||[]).map(function(m){return m.name||m.internal_id||'';}).filter(Boolean)};});
  }
  function saveCurrent(name){
    var input=q('saveName'),btn=q('saveFormationBtn');if(!input||!btn)return fail('編成保存機能が見つかりません。');
    var nm=text(name);if(!nm){var d=new Date(),z=function(n){return String(n).padStart(2,'0');};nm='Bot保存_'+d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+'_'+z(d.getHours())+z(d.getMinutes())+z(d.getSeconds());}
    input.value=nm;click(btn);var saved=listSaved();return saved.length?ok('編成を「'+saved[0].name+'」で保存しました。',{saved:saved[0]}):fail('編成を保存できませんでした。');
  }
  function resolveSaved(ref){
    var list=listSaved();var n=Number(ref);if(Number.isInteger(n)&&n>=1&&n<=list.length)return list[n-1];var key=norm(ref);var exact=list.filter(function(x){return norm(x.name)===key;});return exact.length===1?exact[0]:null;
  }
  function loadSaved(ref){var item=resolveSaved(ref);if(!item)return fail('指定した保存編成が見つかりません。');var b=document.querySelector('#savedFormations [data-load="'+cssEscape(item.id)+'"]');if(!b)return fail('保存編成の読込ボタンが見つかりません。');click(b);return ok('保存編成「'+item.name+'」を読み込みました。',{saved:item,state:readSiteState()});}
  function deleteSaved(ref){var item=resolveSaved(ref);if(!item)return fail('指定した保存編成が見つかりません。');var b=document.querySelector('#savedFormations [data-del="'+cssEscape(item.id)+'"]');if(!b)return fail('保存編成の削除ボタンが見つかりません。');click(b);return ok('保存編成「'+item.name+'」を削除しました。',{saved:item});}
  function createShareUrl(){var b=q('shareUrlBtn'),out=q('shareOutput');if(!b||!out)return fail('共有URL機能が見つかりません。');click(b);var url=text(out.value||out.textContent||'');return url?ok('共有URLを生成しました。',{url:url}):fail('共有URLを生成できませんでした。');}

  async function restoreSnapshot(snap){
    if(!snap)return fail('戻せる状態がありません。');
    if(Array.isArray(snap.placementSlots)&&snap.placementSlots.some(Boolean)&&typeof window.applyShareState==='function'){
      try{window.applyShareState({formation:snap.formation,slots:snap.placementSlots});}catch(e){}
    }
    var patch={formation:snap.formation,count:snap.count,grade3:snap.grade3,searchBasis:snap.searchBasis||'base',priority1:{stat:snap.priority1,min:snap.priority1Min,max:snap.priority1Max},priority2:{stat:snap.priority2,min:snap.priority2Min,max:snap.priority2Max},factor4Exclude:snap.factor4Exclude,sumSort:snap.sumSort,sumTie:snap.sumTie};
    if(patch.formation&&patch.count)await applySearch(patch);else{if(patch.formation)setFormation(patch.formation);setGrade3(!!patch.grade3);setPriority(1,patch.priority1);setPriority(2,patch.priority2);}
    if(Array.isArray(snap.owned)){
      await clearOwnedHeroes();for(var oi=0;oi<Math.min(3,snap.owned.length);oi++){if(snap.owned[oi])await setOwnedHero(oi+1,snap.owned[oi]);}
    }
    if(Array.isArray(snap.excluded)){
      await clearExcludedHeroes();for(var ei=0;ei<snap.excluded.length;ei++)await setExcludedHero(snap.excluded[ei],true);
    }
    if(snap.allMax)await setEnhancementPanelMax('all');else if(readSiteState().allMax)await clearEnhancementPanel('all');
    return ok('一つ前の状態へ戻しました。',{state:readSiteState()});
  }
  function resetAll(){
    if(typeof window.__jinpoPerformGlobalReset==='function'){window.__jinpoPerformGlobalReset();return ok('全解除しました。',{state:readSiteState()});}
    if(window.JINPO_FAST_SEARCH&&typeof window.JINPO_FAST_SEARCH.resetAll==='function')window.JINPO_FAST_SEARCH.resetAll();return ok('検索条件を解除しました。',{state:readSiteState()});
  }

  function autoFill(){var b=q('autoFillBtn');if(!b)return fail('先頭6人の仮配置機能が見つかりません。');click(b);return ok('先頭6人を仮配置しました。',{state:readSiteState()});}
  function resetSearchOnly(){if(window.JINPO_FAST_SEARCH&&typeof window.JINPO_FAST_SEARCH.resetAll==='function'){window.JINPO_FAST_SEARCH.resetAll();return ok('検索条件だけをリセットしました。',{state:readSiteState()});}return fail('検索条件リセット機能が準備できていません。');}
  async function rerunSearchAction(){return rerunCurrentSearch();}
  function setFormationAction(a){return setFormation(a&&a.formation);}
  function setBondCountAction(a){return setCountNoSearch(a&&a.count);}
  function setGrade3Action(a){return setGrade3(!!(a&&a.on));}
  function setPriorityAction(index,a){a=a||{};return setPriority(index,a.clear?{clear:true}:{stat:a.stat,min:a.min,max:a.max});}
  function clearPriorities(){var r1=setPriority(1,{clear:true});if(!r1.ok)return r1;var r2=setPriority(2,{clear:true});if(!r2.ok)return r2;return ok('第1・第2優先を解除しました。',{state:readSiteState()});}
  function readSearchStatus(){var p=q('dbSearchProgress'),s=q('dbSearchStatus')||q('dbStatus')||q('dbSearchProgressText');return ok('検索状態を取得しました。',{active:!!(p&&p.classList.contains('active')),text:text(s&&s.textContent||''),state:readSiteState()});}
  function getOwnedOnly(){return ok('配置英傑条件を取得しました。',{owned:getOwnedFilters()});}
  function getExcludedOnly(){return ok('除外英傑条件を取得しました。',{excluded:getExcluded()});}
  function getRecommendOnly(){return ok('おすすめ陣法状態を取得しました。',{recommend:getRecommendState()});}

  async function clearSearchFilters(){
    setGrade3(false);setPriority(1,{clear:true});setPriority(2,{clear:true});
    if(getFactor4Exclude()!==0){var fr=await setFactor4Exclude(0,true);if(!fr.ok)return fr;}
    var ss=getSumSort();if(ss.enabled){var sr=await setSumSort(false,'first',true);if(!sr.ok)return sr;}
    return ok('検索の絞り込み条件を解除しました。',{state:readSiteState()});
  }
  function readCombinedTotalsOnly(){return ok('込み合計を取得しました。',{combined:getTotalsFrom('eiketsuKishinsekiCombinedResult')});}

  var registry={
    apply_search:applySearch,rerun_search:rerunSearchAction,run_current_search:rerunSearchAction,
    set_formation:setFormationAction,set_bond_count:setBondCountAction,set_grade3:setGrade3Action,set_factor4_exclude:function(a){return setFactor4Exclude(a&&a.count,false);},
    set_priority1:function(a){return setPriorityAction(1,a);},set_priority2:function(a){return setPriorityAction(2,a);},clear_priority1:function(){return setPriority(1,{clear:true});},clear_priority2:function(){return setPriority(2,{clear:true});},clear_priorities:clearPriorities,
    set_sum_sort:function(a){return setSumSort(!!(a&&a.enabled),a&&a.tie||'first',false);},set_search_basis:function(a){return setSearchBasis(a&&a.mode);},get_search_basis:function(){return ok('検索基準を取得しました。',{searchBasis:getSearchBasis()});},
    reset_search:resetSearchOnly,read_search_status:readSearchStatus,auto_fill:autoFill,
    run_recommended:function(a){return runRecommended(a&&a.stat);},run_specified_simple:runSpecifiedSimple,run_best:runBest,update_recommended:function(a){return updateRecommended(a||{});},get_recommend_state:getRecommendOnly,exit_recommended:exitRecommended,cancel_search:cancelSearch,
    get_results:function(a){return ok('検索結果を取得しました。',{results:getResults(a&&a.limit)});},apply_result:function(a){return applyResult(a&&a.rank);},compare_results:function(a){return compareResults(a&&a.ranks);},sort_results:function(a){return sortResults(a&&a.stat,a&&a.dir);},run_calculation:runCalculation,clear_placement:clearPlacement,
    read_state:function(){return ok('現在状態を取得しました。',{state:readSiteState()});},read_totals:function(){return ok('合計を取得しました。',{totals:getTotalsFrom('totalStatResult'),combined:getTotalsFrom('eiketsuKishinsekiCombinedResult')});},read_activated:function(){return ok('発動因縁を取得しました。',{bonds:readActivatedBonds()});},read_placement:function(){return ok('現在配置を取得しました。',{placement:readCurrentPlacement()});},show_bonds:function(a){return showBondList(a&&a.mode,a&&a.query);},
    set_owned_hero:function(a){return setOwnedHero(a&&a.slot,a&&a.hero);},set_owned_hero_auto:function(a){return setOwnedHeroAuto(a&&a.hero);},clear_owned_hero:function(a){return clearOwnedHero(a&&a.slot);},clear_owned_heroes:clearOwnedHeroes,open_owned_picker:function(a){return openOwnedPicker(a&&a.slot);},set_excluded_hero:function(a){return setExcludedHero(a&&a.hero,a&&a.excluded!==false);},clear_excluded_heroes:clearExcludedHeroes,open_excluded_picker:openExcludedPicker,get_owned_filters:getOwnedOnly,get_excluded_filters:getExcludedOnly,
    get_swap_candidates:function(a){return ok('差替候補を取得しました。',{candidates:getSwapCandidates(a&&a.limit,a&&a.levels)});},apply_swap:applySwap,
    all_max:function(){return setEnhancementPanelMax('all');},clear_all_max:function(){return clearEnhancementPanel('all');},panel_max:function(a){return setEnhancementPanelMax(a&&a.panel);},panel_clear:function(a){return clearEnhancementPanel(a&&a.panel);},set_kenbun:function(a){return setEnhancementValue('kenbun',a&&a.job,a&&a.stat,a&&a.value);},set_kishin:function(a){return setEnhancementValue('kishin',a&&a.slot,a&&a.stat,a&&a.value);},set_tensei:function(a){return setTensei(a&&a.slot,a&&a.on);},open_enhancement:openEnhancement,
    list_saved:function(){return ok('保存編成を取得しました。',{saved:listSaved()});},save_current:function(a){return saveCurrent(a&&a.name);},load_saved:function(a){return loadSaved(a&&a.ref);},delete_saved:function(a){return deleteSaved(a&&a.ref);},share_url:createShareUrl,export_json:exportJson,import_json:importSelectedJson,open_json_picker:function(){return openFilePicker('importJsonFile','JSON読込');},open_bond_master_picker:function(){return openFilePicker('overrideInenFile','因縁マスター');},
    apply_override_bond_master:applySelectedBondMaster,reset_bond_master:resetBondMaster,scroll_top:scrollTopAction,scroll_result:scrollResultAction,
    show_all_bonds:function(a){return showBondList('all',a&&a.query);},show_active_bonds:function(){return showBondList('active','');},
    read_combined_totals:readCombinedTotalsOnly,apply_top_result:function(){return applyResult(1);},show_top_results:function(a){return ok('上位結果を取得しました。',{results:getResults(a&&a.limit||5)});},
    show_swap_non_down:function(a){return ok('因縁が減らない差替候補を取得しました。',{candidates:getSwapCandidates(a&&a.limit||20,['up','flat'])});},show_swap_up:function(a){return ok('UP差替候補を取得しました。',{candidates:getSwapCandidates(a&&a.limit||20,['up'])});},show_swap_flat:function(a){return ok('FLAT差替候補を取得しました。',{candidates:getSwapCandidates(a&&a.limit||20,['flat'])});},show_swap_down:function(a){return ok('DOWN差替候補を取得しました。',{candidates:getSwapCandidates(a&&a.limit||20,['down'])});},
    max_kenbun:function(){return setEnhancementPanelMax('kenbun');},max_kishin:function(){return setEnhancementPanelMax('kishin');},max_tensei:function(){return setEnhancementPanelMax('tensei');},clear_kenbun:function(){return clearEnhancementPanel('kenbun');},clear_kishin:function(){return clearEnhancementPanel('kishin');},clear_tensei:function(){return clearEnhancementPanel('tensei');},
    set_fullmax_search:function(){return setSearchBasis('fullmax');},set_base_search:function(){return setSearchBasis('base');},enable_grade3:function(){return setGrade3(true);},disable_grade3:function(){return setGrade3(false);},clear_factor4_exclude:function(){return setFactor4Exclude(0,false);},enable_sum_sort:function(a){return setSumSort(true,a&&a.tie||'first',false);},disable_sum_sort:function(){return setSumSort(false,'first',false);},clear_search_filters:clearSearchFilters,
    clear_owned_filters:clearOwnedHeroes,clear_excluded_filters:clearExcludedHeroes,read_filters:function(){return ok('検索フィルターを取得しました。',{state:readSiteState()});},
    restore_snapshot:function(a){return restoreSnapshot(a&&a.snapshot);},reset_all:resetAll
  };

  async function execute(name,args){var fn=registry[name];if(!fn)return fail('未登録のBot操作です: '+name);try{return await fn(args||{});}catch(e){console.error('JINPO_BOT_ACTION error',name,e);return fail('操作中にエラーが発生しました。',{error:String(e&&e.message||e)});}}

  window.JINPO_BOT_ACTIONS={
    version:'2.1.0',STATS:STATS.slice(),canonicalStat:canonicalStat,canonicalFormation:canonicalFormation,
    readSiteState:readSiteState,verifySearchBridge:verifySearchBridge,captureSnapshot:captureSnapshot,getResults:getResults,getSwapCandidates:getSwapCandidates,
    execute:execute,registry:Object.keys(registry)
  };
})();
