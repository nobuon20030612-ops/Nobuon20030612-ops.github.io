/*
 * jinpo-bond-list.js
 * 因縁一覧 / 現在発動中因縁。
 * 現在発動中因縁は専用モーダル1経路のみ。
 * 正規画面は「左: 現在の陣形図 / 右: 発動中因縁一覧」で、右カードのホバー中は対応ラインを左図で強調する。
 */
(function(){
  'use strict';
  if(window.__jinpoBondListInstalled) return;
  window.__jinpoBondListInstalled = true;

  var bondMasterCache = null;
  var bondMasterLoadingPromise = null;
  var modalOpenToken = 0;
  var activeModalOpenToken = 0;
  var activeCalculatedResult = null;

  /* 現在発動中因縁モーダルの表示座標。
     判定ラインは JINPO_FORMATION_CONFIG の activeLines を正本とし、ここでは表示座標だけを保持する。 */
  var ACTIVE_FORMATION_VIEW = {
    '衡軛': {
      slots:{1:{x:32,y:18},4:{x:68,y:18},2:{x:32,y:50},5:{x:68,y:50},3:{x:32,y:82},6:{x:68,y:82}}
    },
    '鶴翼': {
      slots:{1:{x:18,y:18},4:{x:82,y:18},2:{x:30,y:50},5:{x:70,y:50},3:{x:24,y:82},6:{x:76,y:82}}
    },
    '魚鱗': {
      slots:{1:{x:50,y:8},6:{x:30,y:48},2:{x:70,y:48},5:{x:16,y:86},4:{x:50,y:86},3:{x:84,y:86}}
    },
    '方円': {
      slots:{2:{x:50,y:10},1:{x:30,y:36},3:{x:70,y:36},6:{x:30,y:66},4:{x:70,y:66},5:{x:50,y:90}}
    }
  };


  function text(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];
    });
  }
  function normalize(v){
    return text(v).toLowerCase().replace(/[\s　]+/g,'');
  }
  function unique(list){
    var seen = new Set();
    return list.filter(function(v){
      var k = text(v);
      if(!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  function uniqueBy(list,keyFn){
    var seen = new Set();
    return list.filter(function(v){
      var k = keyFn(v);
      if(!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  function canonicalFormation(v){
    var s = text(v);
    if(/衡軛/i.test(s)) return '衡軛';
    if(/鶴翼/i.test(s)) return '鶴翼';
    if(/魚鱗/i.test(s)) return '魚鱗';
    if(/方円/i.test(s)) return '方円';
    return '';
  }
  function currentFormationName(){
    var sel = document.getElementById('formationSelect');
    if(!sel) return '';
    var opt = sel.selectedOptions && sel.selectedOptions[0] ? text(sel.selectedOptions[0].textContent) : '';
    return canonicalFormation(sel.value) || canonicalFormation(opt);
  }
  function currentHero(slot){
    try{ if(typeof placement !== 'undefined' && placement) return placement[slot] || null; }catch(e){}
    return null;
  }
  function currentHeroName(slot){
    var h = currentHero(slot);
    if(!h) return '未選択';
    try{ if(typeof heroName === 'function') return text(heroName(h)) || '未選択'; }catch(e){}
    return text(h['英傑名'] || h.name || h['名前']) || '未選択';
  }
  function currentHeroFactorList(slot){
    var h = currentHero(slot);
    if(!h) return [];
    try{
      if(typeof heroFactors === 'function'){
        var fs = heroFactors(h);
        if(Array.isArray(fs)) return fs.map(text).filter(Boolean);
      }
    }catch(e){}
    return [h['因子1'],h['因子2'],h['因子3'],h['因子4']].map(text).filter(Boolean);
  }
  function renderCurrentHeroFactors(slot){
    return currentHeroFactorList(slot).map(function(factor,index){
      return (index ? '<span class="jinpoBondSlotFactorSep" aria-hidden="true">・</span>' : '')+
        '<span class="jinpoBondSlotFactor" data-factor="'+esc(normalize(factor))+'">'+esc(factor)+'</span>';
    }).join('');
  }

  function renderActiveFactorUseBadgeContents(useSet){
    if(!useSet || !useSet.size) return '';
    var html='';
    if(useSet.has(1)) html+='<span class="jinpoBondUseBadge factor1">特化</span>';
    if(useSet.has(2)) html+='<span class="jinpoBondUseBadge factor2">凸2</span>';
    if(useSet.has(3)) html+='<span class="jinpoBondUseBadge factor3">LV20</span>';
    if(useSet.has(4)) html+='<span class="jinpoBondUseBadge factor4">文曲</span>';
    return html;
  }
  function renderActiveFactorUseBadges(useSet){
    var html=renderActiveFactorUseBadgeContents(useSet);
    return '<div class="jinpoBondUseBadges" aria-label="使用因子"'+(html?'':' hidden')+'>'+html+'</div>';
  }
  function cssPositionPercent(raw,total){
    var v = text(raw);
    if(!v) return null;
    if(/%$/.test(v)){
      var pct = parseFloat(v);
      return Number.isFinite(pct) ? pct : null;
    }
    var px = parseFloat(v);
    if(!Number.isFinite(px) || !Number.isFinite(total) || total <= 0) return null;
    return px / total * 100;
  }
  function liveFormationSlotPositions(){
    var root = document.getElementById('formationView');
    if(!root) return null;
    var rect = root.getBoundingClientRect ? root.getBoundingClientRect() : null;
    var width = Number((rect && rect.width) || root.clientWidth || 0);
    var height = Number((rect && rect.height) || root.clientHeight || 0);
    if(width <= 0 || height <= 0) return null;
    var slots = {};
    Array.prototype.forEach.call(root.querySelectorAll('.fslot'),function(el){
      var strong = el.querySelector('strong');
      var slot = Number(text(strong && strong.textContent));
      if(!slot || slot < 1 || slot > 6) return;
      var x = cssPositionPercent(el.style.left,width);
      var y = cssPositionPercent(el.style.top,height);
      if(x == null || y == null) return;
      slots[slot] = {x:x,y:y};
    });
    for(var i=1;i<=6;i++) if(!slots[i]) return null;
    return slots;
  }
  function activeFormationConfig(){
    var formation = currentFormationName();
    var view = ACTIVE_FORMATION_VIEW[formation];
    if(!view) return null;
    var liveSlots = liveFormationSlotPositions();
    var config = window.JINPO_FORMATION_CONFIG && window.JINPO_FORMATION_CONFIG[formation];
    var lines = config && Array.isArray(config.activeLines) ? config.activeLines : [];
    return {slots:liveSlots || view.slots,lines:lines};
  }

  function syncFormationUiState(){
    try{
      if(!document.body || !document.body.classList) return;
      document.body.classList.toggle('jinpoFormationSelected', !!currentFormationName());
    }catch(e){}
  }
  function clearAppliedDbVisualState(){
    try{ if(typeof clearAppliedDbRowDisplay === 'function') clearAppliedDbRowDisplay(); }catch(e){}
    try{
      document.querySelectorAll('#dbFormationList tr.jinpoCurrentAppliedMainRow').forEach(function(row){ row.classList.remove('jinpoCurrentAppliedMainRow'); });
      document.querySelectorAll('#dbFormationList tr.jinpoCurrentAppliedStatRow').forEach(function(row){ row.classList.remove('jinpoCurrentAppliedStatRow'); });
    }catch(e){}
  }
  function clearTransientAppliedDbState(){
    /* 編成そのもの・マスター・保存読込など基準状態が変わった時だけDB適用状態を破棄する。
       陣形変更は6英傑を維持するため、ここでは扱わない。 */
    try{ selectedDbResultId = ''; }catch(e){}
    try{ window.selectedDbResultId = ''; }catch(e){}
    /* 状態変更前に開始した差替後の非同期DB完全照合を必ず失効させる。 */
    try{ window.__jinpoReachExactLookupSeq = Number(window.__jinpoReachExactLookupSeq || 0) + 1; }catch(e){}
    /* 適用候補と能力加算が共有するDB行参照を同時に破棄し、古い編成情報を残さない。 */
    try{ currentAppliedDbRow = null; }catch(e){}
    try{ window.currentAppliedDbRow = null; }catch(e){}
    try{
      window.__currentAppliedDbRow = null;
      window.__lastReachAppliedDbRow = null;
      window.__jinpoExactAppliedDbRow = null;
      window.__jinpoBonusBaseDbRow = null;
    }catch(e){}
    clearAppliedDbVisualState();
  }
  function currentPlacementObject(){
    try{ if(typeof placement!=='undefined' && placement) return placement; }catch(e){}
    try{ return window.placement||null; }catch(e){ return null; }
  }
  function currentPlacementIds(source){
    var p=source||currentPlacementObject(),out=[];
    if(!p) return out;
    for(var i=1;i<=6;i++) out.push(text(p[i]&&p[i].internal_id));
    return out;
  }
  function dbRowMatchesCurrentRuntimeState(row){
    if(!row || currentRuntimeOverrideActive()) return false;
    var p=currentPlacementObject(),formation=currentFormationName();
    if(!p||!formation) return false;
    var ids=currentPlacementIds(p);
    if(ids.length!==6||ids.some(function(v){return !v;})||new Set(ids).size!==6) return false;
    var result=currentCalculatedResult();
    if(!result || typeof dbRowMatchesReachState!=='function') return false;
    try{
      var sel=document.getElementById('formationSelect');
      var rawFormation=text(sel&&sel.value)||formation;
      return !!dbRowMatchesReachState(row,p,result,rawFormation);
    }catch(e){ console.error('DB行の現在状態照合失敗',e); return false; }
  }
  function installDbRowRenderStateGuard(){
    var current=window.renderRealtimeTotalStatsFromReachDbRow;
    if(typeof current!=='function'||current.__jinpoCurrentStateGuardWrapped) return;
    function guardedRenderRealtimeTotalStatsFromReachDbRow(row){
      /* 状態変更前のDB行を現在の総合値へ再描画させない。 */
      if(!dbRowMatchesCurrentRuntimeState(row)) return false;
      return current.apply(this,arguments);
    }
    guardedRenderRealtimeTotalStatsFromReachDbRow.__jinpoCurrentStateGuardWrapped=true;
    guardedRenderRealtimeTotalStatsFromReachDbRow.__jinpoCurrentStateGuardOriginal=current;
    window.renderRealtimeTotalStatsFromReachDbRow=guardedRenderRealtimeTotalStatsFromReachDbRow;
    try{ renderRealtimeTotalStatsFromReachDbRow=guardedRenderRealtimeTotalStatsFromReachDbRow; }catch(e){}
  }
  var reachCandidateCacheInvalidationSeq=0;
  function invalidateReachCandidateCacheAfterMasterChange(){
    /* step66のprivate cache keyは因縁マスター内容を含まない。
       マスター差替え時だけ一時的な存在しない除外IDをkeyへ混ぜ、
       直後に通常keyへ戻して2回再計算させることでprivate cacheを確実に更新する。 */
    var seq=++reachCandidateCacheInvalidationSeq;
    try{
      var modal=document.getElementById('step66ReachModal');
      if(modal) modal.classList.remove('step66Open');
    }catch(e){}
    var currentGetter=null;
    try{ currentGetter=window.__jinpoGetExcludedHeroInternalIds; }catch(e){}
    var baseGetter=currentGetter;
    while(baseGetter && baseGetter.__jinpoReachCacheTempOriginal!==undefined){
      baseGetter=baseGetter.__jinpoReachCacheTempOriginal;
    }
    var sentinel='__JINPO_MASTER_CACHE_REV_'+seq+'__';
    function tempGetter(){
      var list=[];
      try{ if(typeof baseGetter==='function'){ var raw=baseGetter(); if(Array.isArray(raw)) list=raw.slice(); } }catch(e){}
      if(list.indexOf(sentinel)<0) list.push(sentinel);
      return list;
    }
    tempGetter.__jinpoReachCacheTempOriginal=baseGetter;
    try{ window.__jinpoGetExcludedHeroInternalIds=tempGetter; }catch(e){}
    try{ window.__step66ReachCandidateMap={}; }catch(e){}
    try{ if(typeof window.renderReachSlotOnlyUi==='function') window.renderReachSlotOnlyUi(); }catch(e){}
    setTimeout(function(){
      if(seq!==reachCandidateCacheInvalidationSeq) return;
      try{
        if(window.__jinpoGetExcludedHeroInternalIds===tempGetter){
          if(typeof baseGetter==='function') window.__jinpoGetExcludedHeroInternalIds=baseGetter;
          else delete window.__jinpoGetExcludedHeroInternalIds;
        }
      }catch(e){}
      try{ window.__step66ReachCandidateMap={}; }catch(e){}
      try{ if(typeof window.renderReachSlotOnlyUi==='function') window.renderReachSlotOnlyUi(); }catch(e){}
    },60);
  }
  function searchModelRowSignature(rows, kind){
    if(!Array.isArray(rows)) return '';
    var fields = kind === 'inen'
      /* 因子だけでなく効果対象/段階もcompactステータスへ影響する。 */
      ? ['No','因縁名','因子1','因子2','因子3','特大','大','中','小']
      : ['internal_id','英傑名','コスト','生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性','因子1','因子2','因子3','因子4'];
    var normalized = rows.map(function(row){
      return fields.map(function(k){ return text(row && row[k]); });
    });
    normalized.sort(function(a,b){
      var aa=a.join('\u0001'),bb=b.join('\u0001');
      return aa<bb?-1:(aa>bb?1:0);
    });
    return JSON.stringify(normalized);
  }
  function currentRuntimeOverrideActive(){
    try{
      var curE = (typeof eiketsuMaster !== 'undefined' && Array.isArray(eiketsuMaster)) ? eiketsuMaster : [];
      var curI = (typeof inenMaster !== 'undefined' && Array.isArray(inenMaster)) ? inenMaster : [];
      var stdE = (typeof standardEiketsuMaster !== 'undefined' && Array.isArray(standardEiketsuMaster)) ? standardEiketsuMaster : [];
      var stdI = (typeof standardInenMaster !== 'undefined' && Array.isArray(standardInenMaster)) ? standardInenMaster : [];
      if(!stdE.length || !stdI.length) return false;
      return searchModelRowSignature(curE,'eiketsu') !== searchModelRowSignature(stdE,'eiketsu') ||
             searchModelRowSignature(curI,'inen') !== searchModelRowSignature(stdI,'inen');
    }catch(e){ return !!window.__jinpoRuntimeMasterOverrideActive; }
  }
  function setPrecomputedSearchDisabled(disabled){
    window.__jinpoRuntimeMasterOverrideActive = !!disabled;
    try{ if(document.body && document.body.classList) document.body.classList.toggle('jinpo-runtime-master-override',!!disabled); }catch(e){}
    try{
      document.querySelectorAll('#dbCountButtons .dbCountBtn,[data-jinpo-recommend-stat]').forEach(function(btn){
        btn.disabled = !!disabled;
        btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        if(disabled) btn.setAttribute('data-jinpo-master-override-disabled','1');
        else btn.removeAttribute('data-jinpo-master-override-disabled');
      });
    }catch(e){}
    if(!disabled) return;
    try{ selectedDbListBondCount = null; }catch(e){}
    try{ window.selectedDbListBondCount = null; }catch(e){}
    try{
      if(window.JINPO_FAST_SEARCH){
        if(typeof window.JINPO_FAST_SEARCH.exitRecommendMode === 'function') window.JINPO_FAST_SEARCH.exitRecommendMode();
        if(typeof window.JINPO_FAST_SEARCH.clear === 'function') window.JINPO_FAST_SEARCH.clear();
      }
    }catch(e){}
    var msg='マスター差替え中は事前生成検索DBと条件が一致しないため、5〜9因縁検索・おすすめ陣法を停止しています。標準マスターへ戻すと再開します。';
    try{ var st=document.getElementById('dbListStatus'); if(st) st.textContent=msg; }catch(e){}
    try{ var box=document.getElementById('dbFormationList'); if(box) box.innerHTML='<div class="dbListNote">'+esc(msg)+'</div>'; }catch(e){}
    try{ var hit=document.getElementById('jinpoResultHitValue'); if(hit) hit.textContent='—'; }catch(e){}
    try{ var shown=document.getElementById('jinpoResultShownValue'); if(shown) shown.textContent='—'; }catch(e){}
  }
  function syncRuntimeOverrideSearchState(){
    var disabled = currentRuntimeOverrideActive();
    setPrecomputedSearchDisabled(disabled);
    if(!disabled){
      try{ if(typeof renderDbCountButtons === 'function') renderDbCountButtons(); }catch(e){}
    }
    return disabled;
  }
  function observePrecomputedSearchOverrideTargets(){
    var observer=window.__jinpoPrecomputedSearchOverrideObserver;
    if(!observer) return;
    ['dbCountButtons','jinpoRecommendNav'].forEach(function(id){
      var target=document.getElementById(id);
      if(!target || target.__jinpoPrecomputedSearchObserved) return;
      try{
        observer.observe(target,{childList:true,subtree:true});
        target.__jinpoPrecomputedSearchObserved=true;
      }catch(e){}
    });
  }
  function installPrecomputedSearchOverrideGuard(){
    if(window.__jinpoPrecomputedSearchOverrideGuardInstalled){ observePrecomputedSearchOverrideTargets(); return; }
    window.__jinpoPrecomputedSearchOverrideGuardInstalled=true;
    /* window capture は document capture より先に通るため、fast-search 側の既存click handlerより確実に先に停止できる。 */
    window.addEventListener('click',function(ev){
      if(!window.__jinpoRuntimeMasterOverrideActive) return;
      var target=ev.target&&ev.target.closest?ev.target.closest('#dbCountButtons .dbCountBtn,[data-jinpo-recommend-stat]'):null;
      if(!target) return;
      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      setPrecomputedSearchDisabled(true);
    },true);
    /* fast-search がボタンをinnerHTMLで再生成しても即座に再無効化する。
       jinpo.html は body/html 全体のMutationObserverを抑止するため、監視対象は必要な2領域だけに限定する。 */
    if(typeof MutationObserver==='function'){
      try{
        window.__jinpoPrecomputedSearchOverrideObserver=new MutationObserver(function(){
          if(window.__jinpoRuntimeMasterOverrideActive) setPrecomputedSearchDisabled(true);
        });
        observePrecomputedSearchOverrideTargets();
      }catch(e){}
    }
  }
  function refreshFormationDependentSearchUi(){
    syncFormationUiState();
    if(syncRuntimeOverrideSearchState()) return true;
    try{
      if(window.JINPO_FAST_SEARCH && typeof window.JINPO_FAST_SEARCH.isRecommendMode === 'function' && window.JINPO_FAST_SEARCH.isRecommendMode()){
        if(typeof window.JINPO_FAST_SEARCH.exitRecommendMode === 'function') window.JINPO_FAST_SEARCH.exitRecommendMode();
      }
    }catch(e){}
    var count = 0;
    try{ count = Number(typeof selectedDbListBondCount !== 'undefined' ? selectedDbListBondCount : window.selectedDbListBondCount) || 0; }catch(e){}
    try{ if(typeof renderDbCountButtons === 'function') renderDbCountButtons(); }catch(e){}
    if(count >= 5 && count <= 9){
      try{
        if(window.JINPO_FAST_SEARCH && typeof window.JINPO_FAST_SEARCH.renderCurrent === 'function'){
          var run = window.JINPO_FAST_SEARCH.renderCurrent({count:count,forceNormal:true});
          Promise.resolve(run).catch(function(err){ console.error('陣形復元後の検索一覧更新失敗',err); });
          return run;
        }
        if(typeof window.handleDbCountButtonClick === 'function') return window.handleDbCountButtonClick(count);
        if(typeof renderDbFormationList === 'function') return renderDbFormationList();
      }catch(e){ console.error('陣形復元後の検索一覧更新失敗',e); }
    }
    return true;
  }
  function lineId(slots){
    return (Array.isArray(slots) ? slots : []).map(Number).filter(Boolean).sort(function(a,b){return a-b;}).join('-');
  }
  function lineDisplay(slots){
    var marks = {1:'①',2:'②',3:'③',4:'④',5:'⑤',6:'⑥'};
    return (Array.isArray(slots) ? slots : []).map(function(n){ return marks[Number(n)] || String(n); }).join('－');
  }
  function injectStyle(){
    if(document.getElementById('jinpoBondListStyle')) return;
    var style = document.createElement('style');
    style.id = 'jinpoBondListStyle';
    style.textContent = [
      '#jinpoBondNavActions{width:100%;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:-4px 0 10px 0;box-sizing:border-box;}',
      '#jinpoRecommendSearchOrderRow{display:grid;grid-template-columns:132px minmax(0,1fr) 132px;align-items:center;gap:8px;width:100%;max-width:100%;box-sizing:border-box;margin:0 0 8px 0;}',
      '#jinpoRecommendSearchOrderNote{display:block;grid-column:2;min-width:0;width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:8px 14px 6px;color:#ffe27a;font-size:clamp(24px,2vw,34px);font-weight:1000;line-height:1.25;letter-spacing:.035em;text-align:center;white-space:nowrap;pointer-events:none;text-shadow:0 0 6px rgba(255,255,220,.88),0 0 14px rgba(255,215,74,.82),0 0 24px rgba(255,181,32,.50),0 2px 0 rgba(0,0,0,.75);}',
      '#jinpoRecommendSearchOrderRow #jinpoBackBtn.jinpoBackBtn{grid-column:3;justify-self:end;margin:0 !important;}',
      '#jinpoRecommendNav{--jinpo-group-accent:#ffd463;--jinpo-group-glow:rgba(255,202,58,.52);--jinpo-group-soft:rgba(255,232,155,.14);position:relative;display:flex;align-items:center;gap:5px;flex:1 1 720px;min-width:0;flex-wrap:nowrap;padding:6px 7px;border:2px solid var(--jinpo-group-accent);border-radius:14px;background:linear-gradient(180deg,rgba(84,48,8,.38),rgba(24,13,4,.58));box-shadow:0 0 12px var(--jinpo-group-glow),0 0 24px rgba(255,184,39,.18),inset 0 0 0 1px rgba(255,239,183,.10),inset 0 0 12px var(--jinpo-group-soft);box-sizing:border-box;isolation:isolate;animation:jinpoRecommendGroupGlow 1.65s ease-in-out infinite alternate;}',
      'body.jinpo-recommend-active{--jinpo-rec-accent:#ffd463;--jinpo-rec-accent2:#e7bd5c;--jinpo-rec-bg1:#6f2419;--jinpo-rec-bg2:#26100a;--jinpo-rec-text:#fff5d4;--jinpo-rec-soft:rgba(231,189,92,.18);--jinpo-rec-glow:rgba(231,189,92,.46);}',
      'body.jinpo-recommend-active #jinpoRecommendNav{--jinpo-group-accent:var(--jinpo-rec-accent);--jinpo-group-glow:var(--jinpo-rec-glow);--jinpo-group-soft:var(--jinpo-rec-soft);background:linear-gradient(180deg,var(--jinpo-rec-soft),rgba(18,11,6,.68));}',
      'body.jinpo-runtime-master-override #dbCountButtons .dbCountBtn,body.jinpo-runtime-master-override [data-jinpo-recommend-stat]{pointer-events:none!important;cursor:not-allowed!important;opacity:.42!important;filter:grayscale(.55)!important;}',
      '.jinpoRecommendLabel{flex:0 0 auto;margin-right:5px;padding:6px 9px;border:2px solid rgba(255,224,118,.92);border-radius:10px;background:linear-gradient(180deg,rgba(132,78,8,.62),rgba(54,29,4,.48));color:#ffe27a;font-size:19px;font-weight:1000;letter-spacing:.025em;white-space:nowrap;text-shadow:0 0 5px rgba(255,255,220,.90),0 0 13px rgba(255,215,74,.92),0 0 24px rgba(255,181,32,.58),0 1px 0 rgba(0,0,0,.72);box-shadow:0 0 13px rgba(255,211,69,.58),0 0 25px rgba(255,177,31,.28),inset 0 0 10px rgba(255,239,178,.14);transform-origin:center;will-change:transform,filter;animation:jinpoRecommendLabelFloat 1.65s ease-in-out infinite;}',
      'body.jinpo-recommend-active .jinpoRecommendLabel{color:var(--jinpo-rec-accent);border-color:var(--jinpo-rec-accent);text-shadow:0 0 6px rgba(255,255,255,.86),0 0 14px var(--jinpo-rec-glow),0 0 25px var(--jinpo-rec-glow),0 1px 0 rgba(0,0,0,.68);box-shadow:0 0 16px var(--jinpo-rec-glow),0 0 28px var(--jinpo-rec-glow),inset 0 0 10px var(--jinpo-rec-soft);}',
      '@keyframes jinpoRecommendGroupGlow{from{border-color:var(--jinpo-group-accent);box-shadow:0 0 10px var(--jinpo-group-glow),0 0 18px rgba(255,184,39,.12),inset 0 0 0 1px rgba(255,239,183,.08),inset 0 0 9px var(--jinpo-group-soft)}to{border-color:var(--jinpo-group-accent);box-shadow:0 0 18px var(--jinpo-group-glow),0 0 34px var(--jinpo-group-glow),inset 0 0 0 1px rgba(255,246,205,.18),inset 0 0 15px var(--jinpo-group-soft)}}',
      '@keyframes jinpoRecommendLabelFloat{0%,100%{transform:translateY(0) scale(1);filter:brightness(1)}50%{transform:translateY(-2px) scale(1.035);filter:brightness(1.10)}}',
      '.jinpoRecommendExitBtn{flex:0 0 auto;min-width:104px;min-height:38px;padding:6px 11px;border-radius:10px;border:2px solid #d6aa50;background:linear-gradient(#3d2a18,#1a1009);color:#a88f68;font-size:13px;font-weight:950;line-height:1;cursor:not-allowed;white-space:nowrap;box-sizing:border-box;opacity:.52;transition:filter .16s ease,box-shadow .16s ease,transform .16s ease,opacity .16s ease;}',
      '.jinpoRecommendExitBtn.is-active{background:linear-gradient(var(--jinpo-rec-bg1,#9e2d22),var(--jinpo-rec-bg2,#57110c));color:var(--jinpo-rec-text,#fff2d0);border-color:var(--jinpo-rec-accent,#ffd463);cursor:pointer;opacity:1;box-shadow:0 0 13px var(--jinpo-rec-glow,rgba(255,76,48,.38)),inset 0 0 8px var(--jinpo-rec-soft,rgba(255,220,120,.12));}',
      '.jinpoRecommendExitBtn.is-active:hover,.jinpoRecommendExitBtn.is-active:focus-visible{filter:brightness(1.17);box-shadow:0 0 18px var(--jinpo-rec-glow,rgba(255,83,52,.64)),0 0 10px var(--jinpo-rec-soft,rgba(231,189,92,.40));transform:translateY(-1px);outline:none;}',
      '.jinpoRecommendModeNotice{display:none;flex:1 1 100%;width:100%;box-sizing:border-box;align-items:center;justify-content:center;gap:8px;padding:7px 12px;margin:0 0 2px 0;border:1px solid var(--jinpo-rec-accent,#ffcd57);border-radius:10px;background:linear-gradient(90deg,var(--jinpo-rec-bg1,#701810),var(--jinpo-rec-bg2,#32140a),var(--jinpo-rec-bg1,#701810));color:var(--jinpo-rec-text,#fff0bd);font-size:14px;font-weight:950;letter-spacing:.02em;text-align:center;box-shadow:0 0 12px var(--jinpo-rec-glow,rgba(255,81,45,.22));}',
      '.jinpoRecommendModeNotice.is-active{display:flex;}',
      '#jinpoRecommendModeBadge{position:fixed;right:4px;top:52%;z-index:9500;display:none;min-width:62px;max-width:72px;min-height:250px;padding:14px 9px;border:2px solid var(--jinpo-rec-accent,#ffd45e);border-radius:16px 0 0 16px;background:linear-gradient(180deg,var(--jinpo-rec-bg1,#9f2c20),var(--jinpo-rec-bg2,#571009) 68%,#090706);color:var(--jinpo-rec-text,#fff5d4);box-shadow:0 0 22px var(--jinpo-rec-glow,rgba(255,72,42,.52)),inset 0 0 14px var(--jinpo-rec-soft,rgba(255,220,110,.14));box-sizing:border-box;pointer-events:none;writing-mode:vertical-rl;text-orientation:upright;font-size:21px;font-weight:1000;letter-spacing:.08em;text-shadow:0 2px 0 rgba(0,0,0,.62);transform:translateY(-50%);}',
      '#jinpoRecommendModeBadge.is-active{display:flex;align-items:center;justify-content:center;gap:10px;animation:jinpoRecommendModeFloat 1.8s ease-in-out infinite,jinpoRecommendModePulse 1.2s ease-in-out infinite alternate;}',
      '#jinpoRecommendModeBadge .jinpoRecommendModeBadgeStat{margin-top:8px;padding-top:8px;border-top:1px solid var(--jinpo-rec-accent,#ffebaa);font-size:15px;color:var(--jinpo-rec-accent,#ffe598);letter-spacing:.03em;}',
      '@keyframes jinpoRecommendModeFloat{0%,100%{transform:translateY(-50%) translateX(0)}50%{transform:translateY(calc(-50% - 5px)) translateX(-2px)}}',
      '@keyframes jinpoRecommendModePulse{from{opacity:.86}to{opacity:1}}',
      '@media(prefers-reduced-motion:reduce){#jinpoRecommendModeBadge.is-active,#jinpoRecommendNav,.jinpoRecommendLabel{animation:none!important;}}',
      '.jinpoRecommendBtn{flex:1 1 0;min-width:46px;min-height:38px;padding:6px 7px;border-radius:10px;border:1px solid #9a7538;background:linear-gradient(#382718,#17100a);color:#f7e9c9;font-size:13px;font-weight:950;line-height:1;cursor:pointer;white-space:nowrap;box-sizing:border-box;}',
      '.jinpoRecommendBtn:hover{filter:brightness(1.15);box-shadow:0 0 12px rgba(231,189,92,.30);}',
      '.jinpoRecommendBtn.active{outline:2px solid #fff4b8;outline-offset:1px;box-shadow:0 0 13px rgba(255,239,170,.72),inset 0 0 8px rgba(255,255,255,.12);}',
      '.jinpoRecommendBtn[data-stat="生命"]{background:#fff;color:#111;border-color:#cfcfcf}.jinpoRecommendBtn[data-stat="気合"]{background:#cfefff;color:#102633;border-color:#78b8da}.jinpoRecommendBtn[data-stat="腕力"]{background:#c93333;color:#fff;border-color:#ff7777}.jinpoRecommendBtn[data-stat="耐久力"]{background:#245fc7;color:#fff;border-color:#70a0ff}.jinpoRecommendBtn[data-stat="器用さ"]{background:#3a9b55;color:#fff;border-color:#75d28d}.jinpoRecommendBtn[data-stat="知力"]{background:#f2d93b;color:#241f00;border-color:#fff083}.jinpoRecommendBtn[data-stat="魅力"]{background:#8b4bb4;color:#fff;border-color:#c88fe8}.jinpoRecommendBtn[data-stat="土属性"]{background:#fff1a8;color:#332800;border-color:#d9c35d}.jinpoRecommendBtn[data-stat="水属性"]{background:#73d7f3;color:#073340;border-color:#b5efff}.jinpoRecommendBtn[data-stat="火属性"]{background:#f3a0a0;color:#4b1111;border-color:#ffd0d0}.jinpoRecommendBtn[data-stat="風属性"]{background:#a8e2a6;color:#173a16;border-color:#d2f4d0}',
      '#jinpoBondNavRight{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto;margin-left:auto;}',
      '@media(min-width:761px){body.jinpo-recommend-active #jinpoBondNavRight{padding-right:80px;box-sizing:border-box;}}',
      '#jinpoSumPrioritySort[data-recommend-mode="1"] .jinpoSumPriorityControls{opacity:.42;pointer-events:none;filter:grayscale(.3);}',
      'body.jinpo-recommend-active #jinpoSumPrioritySort[data-recommend-mode="1"]{border-color:var(--jinpo-rec-accent) !important;box-shadow:0 0 13px var(--jinpo-rec-soft),inset 0 0 0 1px var(--jinpo-rec-soft);}',
      '#jinpoSumPrioritySort[data-recommend-mode="1"] .jinpoSumPriorityHeader::after{content:none!important;display:none!important;}',
      '#jinpoRecommendSumGuide{display:none;grid-column:1 / -1;flex:1 1 100%;width:100%;box-sizing:border-box;margin:2px 0 10px 0;padding:14px 20px;border:2px solid var(--jinpo-rec-accent,#ffd463);border-radius:15px;background:linear-gradient(90deg,var(--jinpo-rec-bg2,#26100a),var(--jinpo-rec-bg1,#6f2419),var(--jinpo-rec-bg2,#26100a));color:var(--jinpo-rec-text,#fff5d4);font-size:clamp(18px,1.35vw,25px);font-weight:1000;line-height:1.35;letter-spacing:.025em;text-align:center;box-shadow:0 0 18px var(--jinpo-rec-glow,rgba(231,189,92,.46)),inset 0 0 0 1px var(--jinpo-rec-soft,rgba(231,189,92,.18));text-shadow:0 1px 0 rgba(0,0,0,.55);flex-direction:column;gap:5px;}',
      '#jinpoRecommendSumGuide .jinpoRecommendSumGuideSub{font-size:clamp(14px,1.0vw,18px);font-weight:900;line-height:1.35;opacity:.96;}',
      'body.jinpo-recommend-active #jinpoRecommendSumGuide{display:flex;align-items:center;justify-content:center;}',
      '#jinpoScrollTopBtn{position:fixed;right:4px;top:calc(52% + 142px);z-index:9490;display:flex;align-items:center;justify-content:center;gap:7px;min-width:62px;max-width:72px;min-height:136px;padding:10px 8px;border:2px solid #ffd08a;border-radius:15px 0 0 15px;background:linear-gradient(180deg,#ff9b21,#b54c00 64%,#542000);color:#fffdf6;box-shadow:0 0 18px rgba(255,143,28,.58),inset 0 0 10px rgba(255,237,202,.18);box-sizing:border-box;cursor:pointer;writing-mode:vertical-rl;text-orientation:upright;font-size:17px;font-weight:1000;letter-spacing:.07em;text-shadow:0 2px 0 rgba(75,24,0,.72);transition:filter .16s ease,box-shadow .16s ease,transform .16s ease;}',
      '#jinpoScrollTopBtn:hover,#jinpoScrollTopBtn:focus-visible{filter:brightness(1.15);box-shadow:0 0 24px rgba(255,153,40,.82),inset 0 0 12px rgba(255,246,222,.28);transform:translateX(-2px);outline:none;}',
      '#jinpoScrollTopBtn .jinpoScrollTopArrow{font-size:23px;line-height:1;writing-mode:horizontal-tb;text-orientation:mixed;}',
      'body.jinpo-recommend-active #dbListStatus{color:var(--jinpo-rec-accent) !important;text-shadow:0 0 10px var(--jinpo-rec-glow);font-weight:900 !important;}',
      'body.jinpo-recommend-active #jinpoResultSummary .jinpoResultSummaryItem{border-color:var(--jinpo-rec-accent) !important;background:linear-gradient(180deg,var(--jinpo-rec-soft),rgba(16,11,7,.96)) !important;box-shadow:0 0 13px var(--jinpo-rec-soft) !important;}',
      'body.jinpo-recommend-active #jinpoResultSummary .jinpoResultSummaryValue{color:var(--jinpo-rec-accent) !important;text-shadow:0 0 8px var(--jinpo-rec-glow);}',
      'body.jinpo-recommend-active #jinpoResultSummary .jinpoResultSummaryLabel{color:var(--jinpo-rec-accent) !important;}',
      'body.jinpo-recommend-active #jinpoResultSortHint{border-color:var(--jinpo-rec-accent) !important;background:var(--jinpo-rec-soft) !important;color:var(--jinpo-rec-text) !important;box-shadow:0 0 10px var(--jinpo-rec-soft);}',
      '.jinpoRecommendLoading{min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;box-sizing:border-box;margin:8px 0 14px;padding:28px 18px;border:2px solid var(--jinpo-rec-accent,#ffd463);border-radius:16px;background:linear-gradient(180deg,var(--jinpo-rec-soft,rgba(231,189,92,.16)),rgba(12,8,5,.97));color:var(--jinpo-rec-text,#fff5d4);box-shadow:0 0 20px var(--jinpo-rec-soft,rgba(231,189,92,.20)),inset 0 0 0 1px var(--jinpo-rec-soft,rgba(231,189,92,.12));text-align:center;}',
      '.jinpoRecommendLoadingTitle{font-size:clamp(24px,2vw,34px);font-weight:1000;line-height:1.25;color:var(--jinpo-rec-accent,#ffe19a);text-shadow:0 0 11px var(--jinpo-rec-glow,rgba(231,189,92,.40));}',
      '.jinpoRecommendLoadingSub{font-size:clamp(15px,1.15vw,20px);font-weight:900;line-height:1.45;color:var(--jinpo-rec-text,#fff5d4);opacity:.96;}',
      '.jinpoRecommendLoading .dbSearchSpinner{width:38px;height:38px;border-width:5px;margin:0;vertical-align:middle;}',
      '.jinpoBondNavBtn{min-height:38px;padding:7px 14px;border-radius:12px;border:2px solid #b99043;background:linear-gradient(#5e4020,#35230f);color:#fff1c9;font-size:15px;font-weight:900;line-height:1;box-shadow:0 0 12px rgba(231,189,92,.20);cursor:pointer;white-space:nowrap;}',
      '.jinpoBondNavBtn:hover{filter:brightness(1.12);box-shadow:0 0 16px rgba(231,189,92,.36);}',
      '#jinpoBondModalBackdrop{position:fixed;inset:0;z-index:10050;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.74);box-sizing:border-box;}',
      '#jinpoBondModalBackdrop.is-open{display:flex;}',
      '#jinpoBondModal{width:min(920px,96vw);max-height:88vh;display:flex;flex-direction:column;border:2px solid #c69a49;border-radius:16px;background:linear-gradient(180deg,#22170d,#100b07);color:#f4ead2;box-shadow:0 0 32px rgba(0,0,0,.75),0 0 22px rgba(231,189,92,.18);overflow:hidden;}',
      '.jinpoBondModalHeader{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(231,189,92,.34);background:rgba(95,59,20,.30);}',
      '.jinpoBondModalHeader h3{margin:0;font-size:20px;color:#ffe0a0;}',
      '.jinpoBondModalCount{font-size:12px;color:#d8c59b;}',
      '#jinpoBondModalClose{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:104px;height:42px;padding:0 13px;border:2px solid #d4a442;border-radius:12px;background:linear-gradient(180deg,#5a3919,#2e1c0d);color:#fff3d0;font-family:inherit;font-size:14px;font-weight:900;line-height:1;letter-spacing:.02em;box-shadow:0 2px 0 rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08),0 0 10px rgba(231,189,92,.16);cursor:pointer;transition:transform .12s ease,filter .12s ease,border-color .12s ease,box-shadow .12s ease;}',
      '#jinpoBondModalClose .jinpoBondCloseIcon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid rgba(255,236,185,.72);border-radius:50%;font-size:20px;font-weight:700;line-height:20px;color:#fff0c9;}',
      '#jinpoBondModalClose .jinpoBondCloseText{white-space:nowrap;}',
      '#jinpoBondModalClose:hover{filter:brightness(1.16);border-color:#f1c45c;box-shadow:0 2px 0 rgba(0,0,0,.42),0 0 16px rgba(241,196,92,.34);}',
      '#jinpoBondModalClose:active{transform:translateY(1px);box-shadow:0 1px 0 rgba(0,0,0,.38),0 0 9px rgba(241,196,92,.24);}',
      '#jinpoBondModalClose:focus-visible{outline:3px solid rgba(255,218,112,.50);outline-offset:3px;}',
      '.jinpoBondSearchWrap{padding:12px 16px;border-bottom:1px solid rgba(231,189,92,.20);}',
      '#jinpoBondSearch{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #87662f;border-radius:10px;background:#0d0906;color:#f6ecd8;font-size:16px;outline:none;}',
      '#jinpoBondSearch:focus{border-color:#e7bd5c;box-shadow:0 0 0 2px rgba(231,189,92,.16);}',
      '.jinpoBondModalBody{padding:0 16px 16px;overflow:auto;}',
      '#jinpoActiveBondModalBackdrop{position:fixed;inset:0;z-index:10060;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.74);box-sizing:border-box;}',
      '#jinpoActiveBondModalBackdrop.is-open{display:flex;}',
      '#jinpoActiveBondModal{width:min(1180px,98vw);max-height:96vh;display:flex;flex-direction:column;border:2px solid #c69a49;border-radius:16px;background:linear-gradient(180deg,#22170d,#100b07);color:#f4ead2;box-shadow:0 0 32px rgba(0,0,0,.75),0 0 22px rgba(231,189,92,.18);overflow:hidden;}',
      '.jinpoActiveBondModalHeader{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(231,189,92,.34);background:rgba(95,59,20,.30);}',
      '.jinpoActiveBondModalHeader h3{margin:0;font-size:20px;color:#ffe0a0;}',
      '.jinpoActiveBondModalCount{font-size:12px;color:#d8c59b;}',
      '#jinpoActiveBondModalClose{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:104px;height:42px;padding:0 13px;border:2px solid #d4a442;border-radius:12px;background:linear-gradient(180deg,#5a3919,#2e1c0d);color:#fff3d0;font-family:inherit;font-size:14px;font-weight:900;line-height:1;letter-spacing:.02em;box-shadow:0 2px 0 rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08),0 0 10px rgba(231,189,92,.16);cursor:pointer;transition:transform .12s ease,filter .12s ease,border-color .12s ease,box-shadow .12s ease;}',
      '#jinpoActiveBondModalClose .jinpoBondCloseIcon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid rgba(255,236,185,.72);border-radius:50%;font-size:20px;font-weight:700;line-height:20px;color:#fff0c9;}',
      '#jinpoActiveBondModalClose:hover{filter:brightness(1.16);border-color:#f1c45c;box-shadow:0 2px 0 rgba(0,0,0,.42),0 0 16px rgba(241,196,92,.34);}',
      '#jinpoActiveBondModalClose:active{transform:translateY(1px);box-shadow:0 1px 0 rgba(0,0,0,.38),0 0 9px rgba(241,196,92,.24);}',
      '#jinpoActiveBondModalClose:focus-visible{outline:3px solid rgba(255,218,112,.50);outline-offset:3px;}',
      '.jinpoActiveBondModalBody{padding:12px 14px 14px;overflow:hidden;flex:1;min-height:0;}',
      '.jinpoBondActiveLayout{display:grid;grid-template-columns:minmax(540px,1.45fr) minmax(350px,.85fr);gap:14px;align-items:start;min-height:0;}',
      '.jinpoBondFormationPanel,.jinpoBondActiveListPanel{border:1px solid rgba(231,189,92,.30);border-radius:14px;background:rgba(10,7,4,.58);overflow:hidden;}',
      '.jinpoBondFormationHead,.jinpoBondActiveListHead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(231,189,92,.24);background:rgba(90,55,19,.20);}',
      '.jinpoBondFormationHead strong,.jinpoBondActiveListHead strong{color:#ffe1a1;font-size:16px;}',
      '.jinpoBondFormationHint{font-size:11px;color:#cdbb96;text-align:right;}',
      '.jinpoBondFormationDiagram{position:relative;height:470px;min-height:470px;margin:8px;background:radial-gradient(circle at center,rgba(74,45,18,.24),rgba(0,0,0,.20) 68%);border:1px solid rgba(231,189,92,.18);border-radius:12px;overflow:hidden;}',
      '.jinpoBondFormationSvg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;}',
      '.jinpoBondDiagramLine{stroke:#9f7b38;stroke-width:3;opacity:.36;vector-effect:non-scaling-stroke;filter:none;transition:opacity .14s ease,stroke .14s ease,stroke-width .14s ease,filter .14s ease;}',
      '.jinpoBondDiagramLine.is-active{stroke:#e7bd5c;opacity:.72;filter:drop-shadow(0 0 4px rgba(231,189,92,.56));}',
      '.jinpoBondFormationDiagram.is-highlighting .jinpoBondDiagramLine{opacity:.10;filter:none;}',
      '.jinpoBondFormationDiagram.is-highlighting .jinpoBondDiagramLine.is-hover{stroke:#ffd75c;stroke-width:6;opacity:1;filter:drop-shadow(0 0 7px #ffcf45) drop-shadow(0 0 13px rgba(255,102,56,.70));}',
      '.jinpoBondDiagramSlot{position:absolute;transform:translate(-50%,-50%);width:144px;min-height:80px;box-sizing:border-box;padding:7px 6px;border:1px solid #80602b;border-radius:11px;background:#18110b;color:#f4ead2;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.34);transition:border-color .14s ease,box-shadow .14s ease,filter .14s ease,opacity .14s ease;z-index:2;}',
      '.jinpoBondDiagramSlot strong{color:#ffe1a1;font-size:14px;}',
      '.jinpoBondDiagramSlot .jinpoBondSlotHero{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.jinpoBondDiagramSlot .jinpoBondSlotFactors{font-size:9px;color:#cdbb96;line-height:1.2;max-height:22px;overflow:hidden;}',
      '.jinpoBondDiagramSlot .jinpoBondUseBadges{display:flex;align-items:center;justify-content:center;gap:2px;min-height:14px;margin:2px 0 1px;white-space:nowrap;}',
      '.jinpoBondDiagramSlot .jinpoBondUseBadges[hidden]{display:none!important;}',
      '.jinpoBondDiagramSlot .jinpoBondUseBadge{display:inline-flex;align-items:center;justify-content:center;min-height:13px;padding:1px 4px;border-radius:999px;border:1px solid rgba(231,189,92,.75);font-size:8px;line-height:1;font-weight:1000;box-sizing:border-box;}',
      '.jinpoBondDiagramSlot .jinpoBondUseBadge.factor1{color:#baf7b7;border-color:#70d878;background:#12351a;}',
      '.jinpoBondDiagramSlot .jinpoBondUseBadge.factor2{color:#ffe47a;border-color:#e7bd5c;background:#35250d;}',
      '.jinpoBondDiagramSlot .jinpoBondUseBadge.factor3{color:#9deaff;border-color:#63d8ff;background:#0c2630;}',
      '.jinpoBondDiagramSlot .jinpoBondUseBadge.factor4{color:#ffd6d6;border-color:#ff7272;background:#5a0000;box-shadow:0 0 7px rgba(255,60,60,.42);}',
      '.jinpoBondDiagramSlot .jinpoBondSlotFactor.is-hover-factor{color:#ff5a5a;font-weight:900;text-shadow:0 0 5px rgba(255,0,0,.95),0 0 11px rgba(255,58,58,.72);}',
      '.jinpoBondFormationDiagram.is-highlighting .jinpoBondDiagramSlot{opacity:.42;filter:grayscale(.35);}',
      '.jinpoBondFormationDiagram.is-highlighting .jinpoBondDiagramSlot.is-hover{opacity:1;filter:none;border-color:#ffd75c;box-shadow:0 0 0 2px rgba(255,215,92,.22),0 0 24px rgba(255,194,61,.82),inset 0 0 14px rgba(255,204,70,.14);}',
      '.jinpoBondActiveListPanel{display:flex;flex-direction:column;min-height:0;}',
      '.jinpoBondActiveCards{display:grid;gap:8px;padding:10px;max-height:470px;overflow:auto;}',
      '.jinpoBondActiveCard{border:1px solid rgba(231,189,92,.26);border-radius:11px;background:rgba(48,31,17,.74);padding:10px;cursor:default;outline:none;transition:border-color .14s ease,box-shadow .14s ease,background .14s ease,transform .14s ease;}',
      '.jinpoBondActiveCard:hover{border-color:#ffd75c;background:rgba(91,51,19,.74);box-shadow:0 0 18px rgba(255,203,70,.38);transform:translateY(-1px);}',
      '.jinpoBondActiveCardHead{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;}',
      '.jinpoBondActiveCardTitle{display:flex;align-items:center;gap:10px;min-width:0;}',
      '.jinpoBondActiveCardNo{display:inline-flex;align-items:center;justify-content:center;flex:0 0 34px;width:34px;height:34px;box-sizing:border-box;border:2px solid #fff0a8;border-radius:50%;background:#ffd75c;color:#211507;font-size:19px;font-weight:1000;line-height:1;box-shadow:0 0 12px rgba(255,215,92,.58);}',
      '.jinpoBondActiveCardName{font-weight:1000;color:#fff0bd;font-size:16px;}',
      '.jinpoBondActiveCardKind{font-size:11px;color:#cdbb96;white-space:nowrap;}',
      '.jinpoBondActiveLine{margin:4px 0 7px;color:#ffd75c;font-size:14px;font-weight:900;letter-spacing:.02em;}',
      '.jinpoBondActiveNoLine{color:#bba985;font-weight:700;}',
      '.jinpoBondActiveCard .jinpoBondFactors{margin-top:4px;}',
      '@media(max-width:980px){#jinpoActiveBondModal{height:96vh}#jinpoActiveBondModal .jinpoActiveBondModalBody{flex:1;min-height:0;overflow:hidden}.jinpoBondActiveLayout{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);height:100%;min-height:0;box-sizing:border-box}.jinpoBondFormationDiagram{height:min(410px,40vh);min-height:min(410px,40vh)}.jinpoBondActiveListPanel{display:flex;flex-direction:column;min-height:0;align-self:stretch}.jinpoBondActiveCards{flex:1;min-height:0;max-height:none;overflow:auto}}',
      '@media(max-width:760px){.jinpoBondActiveLayout{gap:10px}.jinpoBondFormationDiagram{height:min(340px,38vh);min-height:min(340px,38vh);margin:6px}.jinpoBondDiagramSlot{width:112px;min-height:70px;padding:5px 4px}.jinpoBondDiagramSlot strong{font-size:12px}.jinpoBondDiagramSlot .jinpoBondSlotHero{font-size:10px}.jinpoBondDiagramSlot .jinpoBondSlotFactors{font-size:8px;max-height:18px}.jinpoBondFormationHint{font-size:10px}.jinpoBondActiveCardNo{flex-basis:32px;width:32px;height:32px;font-size:18px}.jinpoBondActiveCardName{font-size:15px}}',
      '@media(max-width:560px){.jinpoBondModalHeader{padding:11px 10px}.jinpoBondModalHeader h3{font-size:18px}#jinpoBondModalClose{min-width:92px;height:40px;padding:0 10px;gap:6px;font-size:13px}#jinpoBondModalClose .jinpoBondCloseIcon{width:20px;height:20px;font-size:18px}}',
      '.jinpoBondTable{width:100%;border-collapse:separate;border-spacing:0 7px;font-size:14px;}',
      '.jinpoBondTable th{position:sticky;top:0;z-index:2;padding:10px 8px;text-align:left;background:#171008;color:#d9bd82;border-bottom:1px solid #80602b;}',
      '.jinpoBondTable td{padding:10px 8px;background:rgba(47,31,17,.76);border-top:1px solid rgba(231,189,92,.17);border-bottom:1px solid rgba(231,189,92,.17);vertical-align:middle;}',
      '.jinpoBondTable td:first-child{border-left:1px solid rgba(231,189,92,.17);border-radius:9px 0 0 9px;}',
      '.jinpoBondTable td:last-child{border-right:1px solid rgba(231,189,92,.17);border-radius:0 9px 9px 0;}',
      '.jinpoBondName{font-weight:900;color:#fff0bd;white-space:nowrap;}',
      '.jinpoBondKind{color:#cdbb96;white-space:nowrap;}',
      '.jinpoBondFactors{display:flex;flex-wrap:wrap;gap:5px;}',
      '.jinpoBondFactor{display:inline-block;padding:3px 7px;border:1px solid rgba(231,189,92,.38);border-radius:7px;background:rgba(0,0,0,.28);color:#f2e4c5;white-space:nowrap;}',
      '.jinpoBondEmpty{padding:32px 10px;text-align:center;color:#cdbb96;}',
      '@media(max-width:1250px){#jinpoRecommendNav{flex-basis:100%;order:1}.jinpoBondNavRight{order:2;width:100%}}',
      '@media(max-width:760px){#jinpoBondNavActions{gap:6px}#jinpoRecommendSearchOrderRow{grid-template-columns:112px minmax(0,1fr) 112px;gap:5px}#jinpoRecommendSearchOrderNote{font-size:18px;padding:7px 4px}#jinpoRecommendSearchOrderRow #jinpoBackBtn.jinpoBackBtn{min-width:104px !important;width:104px !important;font-size:14px !important}#jinpoRecommendNav{overflow-x:auto;padding:5px 5px 6px;border-radius:12px}.jinpoRecommendLabel{font-size:15px;padding:5px 7px;margin-right:2px}.jinpoRecommendExitBtn{min-width:94px;min-height:36px;font-size:12px;padding:6px 8px}.jinpoRecommendModeNotice{font-size:12px;padding:6px 8px}#jinpoRecommendSumGuide{font-size:15px;padding:10px 12px;margin-bottom:8px}.jinpoRecommendBtn{flex:0 0 52px;font-size:12px;padding:6px 5px;min-height:36px}.jinpoBondNavBtn{font-size:13px;padding:7px 10px;min-height:36px}#jinpoRecommendModeBadge{right:6px;top:auto;bottom:66px;min-width:0;max-width:calc(100vw - 12px);min-height:0;padding:9px 13px;border-radius:12px;writing-mode:horizontal-tb;text-orientation:mixed;font-size:16px;letter-spacing:.03em;transform:none}#jinpoRecommendModeBadge.is-active{display:flex;flex-direction:row;gap:8px;animation:jinpoRecommendModePulse 1.2s ease-in-out infinite alternate}#jinpoRecommendModeBadge .jinpoRecommendModeBadgeStat{margin:0 0 0 6px;padding:0 0 0 8px;border-top:0;border-left:1px solid var(--jinpo-rec-accent,rgba(255,235,170,.55));font-size:13px}#jinpoScrollTopBtn{display:none!important}#jinpoScrollTopBtn .jinpoScrollTopArrow{font-size:20px}.jinpoBondModalHeader h3{font-size:18px}#jinpoActiveBondModal{width:calc(100vw - 8px);max-height:98vh}.jinpoBondTable{font-size:13px}.jinpoBondTable th:nth-child(2),.jinpoBondTable td:nth-child(2){display:none}.jinpoBondTable th,.jinpoBondTable td{padding:8px 6px}}',
      '@media(max-width:620px){#jinpoRecommendSearchOrderRow{grid-template-columns:1fr auto;grid-template-rows:auto auto;align-items:center}#jinpoRecommendSearchOrderNote{grid-column:1 / -1;grid-row:1;font-size:16px;white-space:normal;line-height:1.25;padding:5px 4px}#jinpoRecommendSearchOrderRow #jinpoBackBtn.jinpoBackBtn{grid-column:2;grid-row:2;justify-self:end;margin-top:2px !important}}'
    ].join('\n');
    document.head.appendChild(style);
  }
  var recommendDecorState = {active:false,targetStat:'',secondaryStat:''};
  var recommendStatLabels = {'生命':'生命','気合':'気合','腕力':'腕力','耐久力':'耐久','器用さ':'器用','知力':'知力','魅力':'魅力','土属性':'土','水属性':'水','火属性':'火','風属性':'風'};
  var recommendThemes = {
    '生命': {accent:'#ffffff',accent2:'#d6d6d6',bg1:'#5a5a5a',bg2:'#171717',text:'#ffffff',soft:'rgba(255,255,255,.16)',glow:'rgba(255,255,255,.48)'},
    '気合': {accent:'#bfeaff',accent2:'#78b8da',bg1:'#2d6683',bg2:'#0b2330',text:'#effbff',soft:'rgba(115,215,243,.16)',glow:'rgba(115,215,243,.50)'},
    '腕力': {accent:'#ff7777',accent2:'#c93333',bg1:'#8d2525',bg2:'#290a0a',text:'#fff2f2',soft:'rgba(201,51,51,.18)',glow:'rgba(255,90,90,.50)'},
    '耐久力': {accent:'#70a0ff',accent2:'#245fc7',bg1:'#214f9f',bg2:'#091936',text:'#f1f6ff',soft:'rgba(36,95,199,.20)',glow:'rgba(80,139,255,.55)'},
    '器用さ': {accent:'#75d28d',accent2:'#3a9b55',bg1:'#2b7440',bg2:'#0b2713',text:'#effff3',soft:'rgba(58,155,85,.18)',glow:'rgba(80,205,112,.48)'},
    '知力': {accent:'#fff083',accent2:'#f2d93b',bg1:'#7c6b12',bg2:'#2a2305',text:'#fffbea',soft:'rgba(242,217,59,.17)',glow:'rgba(255,232,77,.50)'},
    '魅力': {accent:'#c88fe8',accent2:'#8b4bb4',bg1:'#673887',bg2:'#24102f',text:'#fbf2ff',soft:'rgba(139,75,180,.19)',glow:'rgba(190,112,232,.52)'},
    '土属性': {accent:'#fff1a8',accent2:'#d9c35d',bg1:'#766628',bg2:'#281f08',text:'#fffbea',soft:'rgba(217,195,93,.18)',glow:'rgba(255,232,135,.48)'},
    '水属性': {accent:'#b5efff',accent2:'#73d7f3',bg1:'#28758b',bg2:'#082833',text:'#effcff',soft:'rgba(115,215,243,.18)',glow:'rgba(107,220,250,.52)'},
    '火属性': {accent:'#ffd0d0',accent2:'#f3a0a0',bg1:'#8f4c4c',bg2:'#351414',text:'#fff5f5',soft:'rgba(243,160,160,.18)',glow:'rgba(255,150,150,.50)'},
    '風属性': {accent:'#d2f4d0',accent2:'#a8e2a6',bg1:'#4f8150',bg2:'#142c15',text:'#f4fff3',soft:'rgba(168,226,166,.18)',glow:'rgba(155,230,155,.50)'}
  };
  function recommendStatLabel(v){ return recommendStatLabels[text(v)] || text(v); }
  function applyRecommendTheme(active,targetStat){
    var body=document.body;if(!body)return;
    body.classList.toggle('jinpo-recommend-active',!!active);
    var props=['--jinpo-rec-accent','--jinpo-rec-accent2','--jinpo-rec-bg1','--jinpo-rec-bg2','--jinpo-rec-text','--jinpo-rec-soft','--jinpo-rec-glow'];
    if(!active){props.forEach(function(k){body.style.removeProperty(k);});return;}
    var t=recommendThemes[text(targetStat)]||recommendThemes['生命'];
    body.style.setProperty('--jinpo-rec-accent',t.accent);
    body.style.setProperty('--jinpo-rec-accent2',t.accent2);
    body.style.setProperty('--jinpo-rec-bg1',t.bg1);
    body.style.setProperty('--jinpo-rec-bg2',t.bg2);
    body.style.setProperty('--jinpo-rec-text',t.text);
    body.style.setProperty('--jinpo-rec-soft',t.soft);
    body.style.setProperty('--jinpo-rec-glow',t.glow);
  }
  function ensureRecommendModeBadge(){
    var badge=document.getElementById('jinpoRecommendModeBadge');
    if(badge) return badge;
    badge=document.createElement('div');
    badge.id='jinpoRecommendModeBadge';
    badge.setAttribute('role','status');
    badge.setAttribute('aria-live','polite');
    badge.setAttribute('aria-hidden','true');
    badge.innerHTML='<span>おすすめモード中</span><span class="jinpoRecommendModeBadgeStat" id="jinpoRecommendModeBadgeStat"></span>';
    document.body.appendChild(badge);
    return badge;
  }
  function updateRecommendDecor(detail){
    detail=detail||{};
    recommendDecorState.active=!!detail.active;
    recommendDecorState.targetStat=recommendDecorState.active?text(detail.targetStat):'';
    recommendDecorState.secondaryStat=recommendDecorState.active?text(detail.secondaryStat):'';
    var active=recommendDecorState.active;
    applyRecommendTheme(active,recommendDecorState.targetStat);
    var exitBtn=document.getElementById('jinpoRecommendExitBtn');
    if(exitBtn){
      exitBtn.disabled=!active;
      exitBtn.setAttribute('aria-disabled',active?'false':'true');
      exitBtn.classList.toggle('is-active',active);
      exitBtn.title=active?'おすすめ陣法を終了して初期状態へ戻します':'おすすめ陣法を使用中に解除できます';
    }
    var notice=document.getElementById('jinpoRecommendModeNotice');
    if(notice){
      notice.classList.toggle('is-active',active);
      notice.setAttribute('aria-hidden',active?'false':'true');
    }
    var badge=ensureRecommendModeBadge();
    if(badge){
      badge.classList.toggle('is-active',active);
      badge.setAttribute('aria-hidden',active?'false':'true');
      var stat=document.getElementById('jinpoRecommendModeBadgeStat');
      if(stat){
        var first=recommendStatLabel(recommendDecorState.targetStat),second=recommendStatLabel(recommendDecorState.secondaryStat);
        stat.textContent=active?(second?(first+'＋'+second):first):'';
      }
    }
  }
  function syncRecommendDecorFromSearch(){
    try{
      if(window.JINPO_FAST_SEARCH&&typeof window.JINPO_FAST_SEARCH.getRecommendState==='function'){
        updateRecommendDecor(window.JINPO_FAST_SEARCH.getRecommendState());
        return;
      }
    }catch(e){}
    updateRecommendDecor({active:false});
  }
  function bindRecommendDecorListener(){
    if(window.__jinpoRecommendDecorListenerBound) return;
    window.__jinpoRecommendDecorListenerBound=true;
    window.addEventListener('jinpo:recommend-state',function(ev){ updateRecommendDecor(ev&&ev.detail||{}); });
  }
  function askRecommendExit(){
    if(!recommendDecorState.active) return;
    var ask=window.__jinpoAskYesNo;
    if(typeof ask!=='function') return;
    ask({
      title:'おすすめ解除',
      message:'おすすめ陣法を終了し、現在の選択・検索条件・ソート・除外・適用中・差替状態・転生／見聞録／鬼神石を初期状態に戻します。\n\nおすすめを解除しますか？'
    }).then(function(ok){
      if(!ok) return;
      if(typeof window.__jinpoPerformGlobalReset==='function') window.__jinpoPerformGlobalReset();
    });
  }
  function ensureRecommendSumGuide(){
    var guide=document.getElementById('jinpoRecommendSumGuide');
    if(guide) return guide;
    var sum=document.getElementById('jinpoSumPrioritySort');
    if(!sum||!sum.parentNode) return null;
    guide=document.createElement('div');
    guide.id='jinpoRecommendSumGuide';
    guide.setAttribute('role','status');
    guide.setAttribute('aria-live','polite');
    guide.innerHTML='<span>おすすめ中は第2優先を選ぶと、第1＋第2の合計値が高い順へ自動で切り替わります</span><span class="jinpoRecommendSumGuideSub">※第1・第2優先の数値条件を指定すると、その条件に応じて検索結果も変わります</span>';
    sum.parentNode.insertBefore(guide,sum);
    return guide;
  }
  function ensureScrollTopButton(){
    var btn=document.getElementById('jinpoScrollTopBtn');
    if(btn) return btn;
    btn=document.createElement('button');
    btn.type='button';
    btn.id='jinpoScrollTopBtn';
    btn.setAttribute('aria-label','ページの一番上へ戻る');
    btn.title='ページの一番上へ戻る';
    btn.innerHTML='<span class="jinpoScrollTopArrow" aria-hidden="true">↑</span><span>上へ戻る</span>';
    btn.addEventListener('click',function(){
      try{window.scrollTo({top:0,left:0,behavior:'smooth'});}catch(e){window.scrollTo(0,0);}
    });
    document.body.appendChild(btn);
    return btn;
  }
  function scrollToRecommendResults(stat){
    try{
      if(window.JINPO_FAST_SEARCH&&typeof window.JINPO_FAST_SEARCH.getRecommendState==='function'){
        var state=window.JINPO_FAST_SEARCH.getRecommendState();
        if(!state||!state.active||text(state.targetStat)!==text(stat)) return;
      }
    }catch(e){}
    var target=document.getElementById('dbFormationList')||document.getElementById('jinpoResultSummary')||document.getElementById('dbListStatus');
    if(!target) return;
    var fixed=document.getElementById('totalStatPanel')||document.querySelector('.totalStatPanel');
    var offset=18;
    try{if(fixed){var h=fixed.getBoundingClientRect().height;if(Number.isFinite(h)&&h>0)offset=h+14;}}catch(e){}
    var top=target.getBoundingClientRect().top+(window.pageYOffset||document.documentElement.scrollTop||0)-offset;
    try{window.scrollTo({top:Math.max(0,top),left:0,behavior:'smooth'});}catch(e){window.scrollTo(0,Math.max(0,top));}
  }
  function ensureActions(){
    ensureScrollTopButton();
    ensureRecommendSumGuide();
    var back = document.getElementById('jinpoBackBtn');
    if(!back) return;
    var wrap = document.getElementById('jinpoBondNavActions');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'jinpoBondNavActions';
      back.parentNode.insertBefore(wrap, back);
    }
    var recommend = document.getElementById('jinpoRecommendNav');
    if(!recommend){
      recommend = document.createElement('div');
      recommend.id = 'jinpoRecommendNav';
      recommend.setAttribute('aria-label','おすすめ陣法');
      var stats = [
        ['生命','生命'],['気合','気合'],['腕力','腕力'],['耐久力','耐久'],['器用さ','器用'],['知力','知力'],
        ['魅力','魅力'],['土属性','土'],['水属性','水'],['火属性','火'],['風属性','風']
      ];
      recommend.innerHTML = '<span class="jinpoRecommendLabel">おすすめ陣法</span><button type="button" id="jinpoRecommendExitBtn" class="jinpoRecommendExitBtn" disabled aria-disabled="true">おすすめ解除</button>' + stats.map(function(x){
        return '<button type="button" class="jinpoRecommendBtn" data-jinpo-recommend-stat="'+esc(x[0])+'" data-stat="'+esc(x[0])+'" aria-pressed="false">'+esc(x[1])+'</button>';
      }).join('');
      recommend.addEventListener('click',function(ev){
        var btn=ev.target&&ev.target.closest&&ev.target.closest('[data-jinpo-recommend-stat]');if(!btn)return;
        var stat=text(btn.getAttribute('data-jinpo-recommend-stat'));if(!stat)return;
        if(syncRuntimeOverrideSearchState()) return;
        if(window.JINPO_FAST_SEARCH&&typeof window.JINPO_FAST_SEARCH.runRecommended==='function'){
          var run=window.JINPO_FAST_SEARCH.runRecommended(stat);
          requestAnimationFrame(function(){
            requestAnimationFrame(function(){ scrollToRecommendResults(stat); });
          });
          Promise.resolve(run).catch(function(err){ console.error('おすすめ陣法検索エラー',err); });
        }else{
          console.error('おすすめ陣法検索機能がまだ準備できていません');
        }
      });
      wrap.insertBefore(recommend,wrap.firstChild);
    }
    var searchOrderNote=document.getElementById('jinpoRecommendSearchOrderNote');
    if(!searchOrderNote){
      searchOrderNote=document.createElement('div');
      searchOrderNote.id='jinpoRecommendSearchOrderNote';
      searchOrderNote.textContent='おすすめ検索は全因縁数で高い順検索になります';
    }
    var searchOrderRow=document.getElementById('jinpoRecommendSearchOrderRow');
    if(!searchOrderRow){
      searchOrderRow=document.createElement('div');
      searchOrderRow.id='jinpoRecommendSearchOrderRow';
    }
    if(wrap.parentNode && searchOrderRow.parentNode!==wrap.parentNode) wrap.parentNode.insertBefore(searchOrderRow,wrap);
    if(searchOrderNote.parentNode!==searchOrderRow) searchOrderRow.appendChild(searchOrderNote);
    if(back.parentNode!==searchOrderRow) searchOrderRow.appendChild(back);
    var exitBtn=document.getElementById('jinpoRecommendExitBtn');
    if(!exitBtn&&recommend){
      exitBtn=document.createElement('button');
      exitBtn.type='button';exitBtn.id='jinpoRecommendExitBtn';exitBtn.className='jinpoRecommendExitBtn';exitBtn.textContent='おすすめ解除';exitBtn.disabled=true;exitBtn.setAttribute('aria-disabled','true');
      var label=recommend.querySelector('.jinpoRecommendLabel');
      if(label&&label.nextSibling)recommend.insertBefore(exitBtn,label.nextSibling);else recommend.appendChild(exitBtn);
    }
    if(exitBtn&&!exitBtn.__jinpoRecommendExitBound){exitBtn.__jinpoRecommendExitBound=true;exitBtn.addEventListener('click',function(ev){ev.preventDefault();askRecommendExit();});}
    var notice=document.getElementById('jinpoRecommendModeNotice');
    if(!notice){
      notice=document.createElement('div');
      notice.id='jinpoRecommendModeNotice';notice.className='jinpoRecommendModeNotice';notice.setAttribute('aria-hidden','true');
      notice.textContent='おすすめモード中は5〜9因縁の通常検索は使用できません（等級3以下 ON / OFF は使用できます）';
      wrap.insertBefore(notice,recommend||wrap.firstChild);
    }
    ensureRecommendModeBadge();
    bindRecommendDecorListener();
    var right = document.getElementById('jinpoBondNavRight');
    if(!right){right=document.createElement('div');right.id='jinpoBondNavRight';wrap.appendChild(right);}
    var allBtn = document.getElementById('jinpoBondAllBtn');
    if(!allBtn){
      allBtn = document.createElement('button');allBtn.type='button';allBtn.id='jinpoBondAllBtn';allBtn.className='jinpoBondNavBtn';allBtn.textContent='因縁一覧';
      allBtn.addEventListener('click', openModal);
    }
    if(allBtn.parentNode!==right)right.appendChild(allBtn);
    var activeBtn = document.getElementById('jinpoBondActiveBtn');
    if(!activeBtn){
      activeBtn = document.createElement('button');activeBtn.type='button';activeBtn.id='jinpoBondActiveBtn';activeBtn.className='jinpoBondNavBtn';activeBtn.textContent='現在発動中因縁';
      activeBtn.addEventListener('click', openActiveModal);
    }
    if(activeBtn.parentNode!==right)right.appendChild(activeBtn);
  }

  function ensureModal(){
    if(document.getElementById('jinpoBondModalBackdrop')) return;
    var backdrop = document.createElement('div');
    backdrop.id = 'jinpoBondModalBackdrop';
    backdrop.setAttribute('aria-hidden','true');
    backdrop.innerHTML = ''+
      '<div id="jinpoBondModal" role="dialog" aria-modal="true" aria-labelledby="jinpoBondModalTitle">'+
        '<div class="jinpoBondModalHeader">'+
          '<h3 id="jinpoBondModalTitle">因縁一覧</h3>'+
          '<span id="jinpoBondModalCount" class="jinpoBondModalCount"></span>'+
          '<button id="jinpoBondModalClose" type="button" aria-label="閉じる" title="閉じる"><span class="jinpoBondCloseIcon" aria-hidden="true">×</span><span class="jinpoBondCloseText">閉じる</span></button>'+
        '</div>'+
        '<div class="jinpoBondSearchWrap"><input id="jinpoBondSearch" type="search" autocomplete="off" placeholder="因縁名・因子で検索"></div>'+
        '<div id="jinpoBondModalBody" class="jinpoBondModalBody"></div>'+
      '</div>';
    document.body.appendChild(backdrop);
    document.getElementById('jinpoBondModalClose').addEventListener('click', closeModal);
    document.getElementById('jinpoBondSearch').addEventListener('input', renderModal);
    backdrop.addEventListener('click', function(ev){ if(ev.target === backdrop) closeModal(); });
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape' && backdrop.classList.contains('is-open')) closeModal(); });
  }

  function ensureActiveModal(){
    if(document.getElementById('jinpoActiveBondModalBackdrop')) return;
    var backdrop = document.createElement('div');
    backdrop.id = 'jinpoActiveBondModalBackdrop';
    backdrop.setAttribute('aria-hidden','true');
    backdrop.innerHTML = ''+
      '<div id="jinpoActiveBondModal" role="dialog" aria-modal="true" aria-labelledby="jinpoActiveBondModalTitle">'+
        '<div class="jinpoActiveBondModalHeader">'+
          '<h3 id="jinpoActiveBondModalTitle">現在発動中因縁</h3>'+
          '<span id="jinpoActiveBondModalCount" class="jinpoActiveBondModalCount"></span>'+
          '<button id="jinpoActiveBondModalClose" type="button" aria-label="閉じる" title="閉じる"><span class="jinpoBondCloseIcon" aria-hidden="true">×</span><span class="jinpoBondCloseText">閉じる</span></button>'+
        '</div>'+
        '<div id="jinpoActiveBondModalBody" class="jinpoActiveBondModalBody"></div>'+
      '</div>';
    document.body.appendChild(backdrop);
    document.getElementById('jinpoActiveBondModalClose').addEventListener('click', closeActiveModal);
    backdrop.addEventListener('click', function(ev){ if(ev.target === backdrop) closeActiveModal(); });
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape' && backdrop.classList.contains('is-open')) closeActiveModal(); });
  }

  async function loadBondMaster(){
    /* 画面上で因縁マスターを差し替えた場合は、過去キャッシュより現在のinenMasterを必ず優先する。 */
    try{
      if(typeof inenMaster !== 'undefined' && Array.isArray(inenMaster) && inenMaster.length){
        bondMasterCache = inenMaster.slice();
        return bondMasterCache;
      }
    }catch(e){}
    if(Array.isArray(bondMasterCache) && bondMasterCache.length) return bondMasterCache;
    if(bondMasterLoadingPromise) return bondMasterLoadingPromise;
    if(!window.JinpoActivationEngine || typeof window.JinpoActivationEngine.loadCSV !== 'function'){
      throw new Error('因縁マスター読込機能が見つかりません');
    }
    /* 初期読込と同時に開かれても、1本のPromiseだけで読込を完了させる。 */
    bondMasterLoadingPromise = window.JinpoActivationEngine.loadCSV('data/jinpo_inen_master.csv')
      .then(function(rows){
        if(!Array.isArray(rows) || !rows.length) throw new Error('因縁マスターが空です');
        /* fetch待ちの途中でランタイム差替えが行われた場合も、解決時点のlive masterを優先する。 */
        try{
          if(typeof inenMaster !== 'undefined' && Array.isArray(inenMaster) && inenMaster.length){
            bondMasterCache = inenMaster.slice();
            return bondMasterCache;
          }
        }catch(e){}
        bondMasterCache = rows.slice();
        return bondMasterCache;
      })
      .finally(function(){ bondMasterLoadingPromise = null; });
    return bondMasterLoadingPromise;
  }
  function currentCalculatedResult(master){
    try{
      if(typeof placement === 'undefined' || !placement) return null;
      var calcMaster = Array.isArray(master) && master.length ? master : null;
      /* 明示masterが無い時も、ランタイム差替え後の現在inenMasterをキャッシュより優先する。 */
      if(!calcMaster){
        try{ if(typeof inenMaster !== 'undefined' && Array.isArray(inenMaster) && inenMaster.length) calcMaster = inenMaster; }catch(e){}
      }
      if(!calcMaster && Array.isArray(bondMasterCache) && bondMasterCache.length) calcMaster = bondMasterCache;
      if(!calcMaster) return null;
      var formation = currentFormationName();
      if(!formation || !window.JinpoActivationEngine || typeof window.JinpoActivationEngine.calculateFormation !== 'function') return null;
      return window.JinpoActivationEngine.calculateFormation(
        sanitizedUniquePlacement(placement),
        formation,
        calcMaster,
        window.JINPO_FORMATION_CONFIG
      );
    }catch(e){
      console.error('現在発動中因縁の陣形再計算失敗',e);
      return null;
    }
  }

  function calculatedBondNamesFromResult(result){
    return unique((result && Array.isArray(result.activated) ? result.activated : []).map(function(a){ return text(a && a.name); }));
  }

  function masterRowByBondName(master,name){
    var wanted = normalize(name);
    if(!wanted) return null;
    var rows = Array.isArray(master) ? master : [];
    for(var i=0;i<rows.length;i++){
      if(normalize(rows[i] && rows[i]['因縁名']) === wanted) return rows[i];
    }
    return null;
  }

  function resultOccurrences(act){
    if(!act) return [];
    if(Array.isArray(act.occurrences) && act.occurrences.length) return act.occurrences;
    return [act];
  }

  function resultLinesForActivation(act){
    /* 同一因縁が複数ラインで成立しても、表示・発光は有効な1ラインだけ。
       ActivationEngine が全体の文曲使用人数を最小化して選んだ lineSlots を優先する。 */
    var selected = Array.isArray(act && act.lineSlots) ? act.lineSlots.map(Number).filter(Boolean) : [];
    if(selected.length) return [selected];
    var selectedOcc = act && act.selectedOccurrence;
    var selectedOccLine = Array.isArray(selectedOcc && selectedOcc.lineSlots) ? selectedOcc.lineSlots.map(Number).filter(Boolean) : [];
    if(selectedOccLine.length) return [selectedOccLine];
    var occurrences=resultOccurrences(act);
    for(var i=0;i<occurrences.length;i++){
      var line=Array.isArray(occurrences[i] && occurrences[i].lineSlots) ? occurrences[i].lineSlots.map(Number).filter(Boolean) : [];
      if(line.length) return [line];
    }
    return [];
  }

  function occurrenceForLine(act,line){
    if(!act || !Array.isArray(line)) return null;
    var wanted = lineId(line);
    var occurrences = resultOccurrences(act);
    for(var i=0;i<occurrences.length;i++){
      if(lineId(occurrences[i] && occurrences[i].lineSlots) === wanted) return occurrences[i];
    }
    return null;
  }

  function assignmentsForOccurrence(act,occ){
    if(!occ) return [];
    if(act && act.selectedOccurrence === occ && Array.isArray(act.assignments) && act.assignments.length) return act.assignments;
    return Array.isArray(occ.assignments) ? occ.assignments : [];
  }

  function orderedFactorsForActivation(act,row,lines){
    var line = Array.isArray(lines) && lines.length ? lines[0] : null;
    var occ = occurrenceForLine(act,line);
    var assignments = assignmentsForOccurrence(act,occ);
    if(line && assignments.length){
      var byHero = new Map();
      assignments.forEach(function(a){
        var rel = Number(a && a.heroIndex);
        var factor = text(a && a.requiredFactor);
        if(Number.isInteger(rel) && factor && !byHero.has(rel)) byHero.set(rel,factor);
      });
      var ordered = line.map(function(slot,rel){ return byHero.get(rel) || ''; }).filter(Boolean);
      if(ordered.length) return ordered;
    }
    var fromRow = [row && row['因子1'],row && row['因子2'],row && row['因子3']].map(text).filter(Boolean);
    if(fromRow.length) return fromRow;
    var fromAct = [];
    resultOccurrences(act).some(function(o){
      var values = assignmentsForOccurrence(act,o).map(function(a){ return text(a && a.requiredFactor); }).filter(Boolean);
      if(values.length){ fromAct = values; return true; }
      return false;
    });
    return fromAct;
  }

  function allActiveLineIds(){
    var out = [];
    var activated = activeCalculatedResult && Array.isArray(activeCalculatedResult.activated) ? activeCalculatedResult.activated : [];
    activated.forEach(function(act){
      resultLinesForActivation(act).forEach(function(line){ out.push(lineId(line)); });
    });
    return new Set(unique(out));
  }

  function renderFormationDiagram(){
    var formation = currentFormationName();
    var cfg = activeFormationConfig();
    if(!cfg){
      return '<div class="jinpoBondEmpty">陣形を選択してください。</div>';
    }
    var activeIds = allActiveLineIds();
    var svgLines = [];
    cfg.lines.forEach(function(path){
      var id = lineId(path);
      for(var i=0;i<path.length-1;i++){
        var a = cfg.slots[path[i]], b = cfg.slots[path[i+1]];
        if(!a || !b) continue;
        svgLines.push('<line class="jinpoBondDiagramLine'+(activeIds.has(id)?' is-active':'')+'" data-line-id="'+esc(id)+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"></line>');
      }
    });
    var slotHtml = '';
    for(var slot=1;slot<=6;slot++){
      var pos = cfg.slots[slot];
      if(!pos) continue;
      slotHtml += '<div class="jinpoBondDiagramSlot" data-slot="'+slot+'" style="left:'+pos.x+'%;top:'+pos.y+'%;">'+
        '<strong>'+slot+'</strong><div class="jinpoBondSlotHero">'+esc(currentHeroName(slot))+'</div>'+
        renderActiveFactorUseBadges(null)+
        '<div class="jinpoBondSlotFactors">'+renderCurrentHeroFactors(slot)+'</div></div>';
    }
    return '<div id="jinpoBondFormationDiagram" class="jinpoBondFormationDiagram" data-formation="'+esc(formation)+'">'+
      '<svg class="jinpoBondFormationSvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+svgLines.join('')+'</svg>'+slotHtml+'</div>';
  }

  function setDiagramHighlight(lineIds,slots,factorMatches,factorUse){
    var diagram = document.getElementById('jinpoBondFormationDiagram');
    if(!diagram) return;
    var wantedLines = new Set((lineIds || []).map(text).filter(Boolean));
    var wantedSlots = new Set((slots || []).map(Number).filter(Boolean));
    var wantedFactors = new Set((factorMatches || []).map(function(item){
      return Number(item && item.slot)+'|'+normalize(item && item.factor);
    }).filter(function(key){ return !/^0\|$/.test(key) && !/\|$/.test(key); }));
    var useBySlot = new Map();
    (factorUse || []).forEach(function(item){
      var slot=Number(item && item.slot),values=Array.isArray(item && item.factors)?item.factors.map(Number).filter(function(n){return n>=1&&n<=4;}):[];
      if(slot>=1&&slot<=6&&values.length) useBySlot.set(slot,new Set(values));
    });
    var on = wantedLines.size > 0 || wantedSlots.size > 0;
    diagram.classList.toggle('is-highlighting',on);
    Array.prototype.forEach.call(diagram.querySelectorAll('.jinpoBondDiagramLine'),function(el){
      el.classList.toggle('is-hover',on && wantedLines.has(text(el.getAttribute('data-line-id'))));
    });
    Array.prototype.forEach.call(diagram.querySelectorAll('.jinpoBondDiagramSlot'),function(el){
      var slot=Number(el.getAttribute('data-slot'));
      el.classList.toggle('is-hover',on && wantedSlots.has(slot));
      var holder=el.querySelector('.jinpoBondUseBadges');
      if(holder){
        var set=on?useBySlot.get(slot):null;
        var html=renderActiveFactorUseBadgeContents(set);
        holder.innerHTML=html;
        holder.hidden=!html;
      }
    });
    Array.prototype.forEach.call(diagram.querySelectorAll('.jinpoBondSlotFactor'),function(el){
      var slotEl = el.closest ? el.closest('.jinpoBondDiagramSlot') : null;
      var key = Number(slotEl && slotEl.getAttribute('data-slot'))+'|'+text(el.getAttribute('data-factor'));
      el.classList.toggle('is-hover-factor',on && wantedFactors.has(key));
    });
  }

  function clearDiagramHighlight(){ setDiagramHighlight([],[],[],[]); }

  function cardHighlightData(card){
    var ids = text(card && card.getAttribute('data-line-ids')).split('|').map(text).filter(Boolean);
    var slots = text(card && card.getAttribute('data-slots')).split(',').map(Number).filter(Boolean);
    var factors = [],factorUse=[];
    try{
      var raw = card && card.getAttribute('data-factor-matches');
      var parsed = raw ? JSON.parse(raw) : [];
      if(Array.isArray(parsed)) factors = parsed;
    }catch(e){}
    try{
      var rawUse = card && card.getAttribute('data-factor-use');
      var parsedUse = rawUse ? JSON.parse(rawUse) : [];
      if(Array.isArray(parsedUse)) factorUse = parsedUse;
    }catch(e){}
    return {ids:ids,slots:slots,factors:factors,factorUse:factorUse};
  }

  function applyCardHighlight(card){
    var d = cardHighlightData(card);
    setDiagramHighlight(d.ids,d.slots,d.factors,d.factorUse);
  }

  function factorMatchesForActivation(act,lines){
    var allowed = new Set((lines || []).map(lineId));
    var out = [];
    var seen = new Set();
    resultOccurrences(act).forEach(function(occ){
      var line = Array.isArray(occ && occ.lineSlots) ? occ.lineSlots.map(Number).filter(Boolean) : [];
      if(!line.length || (allowed.size && !allowed.has(lineId(line)))) return;
      assignmentsForOccurrence(act,occ).forEach(function(a){
        var rel = Number(a && a.heroIndex);
        var slot = Number.isInteger(rel) ? Number(line[rel]) : 0;
        var factor = text(a && a.requiredFactor);
        var key = slot+'|'+normalize(factor);
        if(slot && factor && !seen.has(key)){
          seen.add(key);
          out.push({slot:slot,factor:factor});
        }
      });
    });
    return out;
  }

  /* 特化/凸2/LV20/文曲は、その因縁の選択ラインで実際に採用された因子slotだけを返す。
     編成全体の使用因子を合算して常時表示すると、どのラインで何を使ったか判別できなくなるため禁止。 */
  function factorUseForActivation(act,lines){
    var line = Array.isArray(lines) && lines.length ? lines[0] : null;
    if(!Array.isArray(line) || !line.length) return [];
    var occ = occurrenceForLine(act,line);
    var assigns = assignmentsForOccurrence(act,occ);
    var bySlot = new Map();
    assigns.forEach(function(a){
      var rel=Number(a && a.heroIndex),slot=(Number.isInteger(rel)&&rel>=0&&rel<line.length)?Number(line[rel]):0;
      if(slot<1||slot>6) return;
      var fi=Number(a && a.providedFactorIndex);
      var use=0;
      if(Number.isInteger(fi)&&fi>=0&&fi<=3) use=fi+1;
      else if(a && a.usesFactor4) use=4;
      if(!use) return;
      if(!bySlot.has(slot)) bySlot.set(slot,new Set());
      bySlot.get(slot).add(use);
    });
    var out=[];
    bySlot.forEach(function(set,slot){out.push({slot:Number(slot),factors:Array.from(set).sort(function(a,b){return a-b;})});});
    return out.sort(function(a,b){return a.slot-b.slot;});
  }

  function bindActiveCardHighlight(){
    var body = document.getElementById('jinpoActiveBondModalBody');
    if(!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('.jinpoBondActiveCard'),function(card){
      card.addEventListener('mouseenter',function(){ applyCardHighlight(card); });
      card.addEventListener('mouseleave',clearDiagramHighlight);
    });
  }

  function renderActiveModal(master,result){
    var formation = currentFormationName();
    var activated = result && Array.isArray(result.activated) ? result.activated : [];
    var cards = activated.map(function(act,index){
      var name = text(act && act.name);
      var row = masterRowByBondName(master,name);
      var lines = resultLinesForActivation(act);
      var factors = orderedFactorsForActivation(act,row,lines);
      var factorMatches = factorMatchesForActivation(act,lines);
      var factorUse = factorUseForActivation(act,lines);
      var lineIds = unique(lines.map(lineId));
      var slots = unique([].concat.apply([],lines).map(function(n){ return String(Number(n)); })).map(Number);
      var lineText = lines.length ? lines.map(lineDisplay).join(' / ') : '成立位置を再計算できませんでした';
      return '<article class="jinpoBondActiveCard" data-active-bond-name="'+esc(name)+'" data-line-ids="'+esc(lineIds.join('|'))+'" data-slots="'+esc(slots.join(','))+'" data-factor-matches="'+esc(JSON.stringify(factorMatches))+'" data-factor-use="'+esc(JSON.stringify(factorUse))+'">'+
        '<div class="jinpoBondActiveCardHead"><div class="jinpoBondActiveCardTitle"><span class="jinpoBondActiveCardNo" aria-label="'+(index+1)+'番目">'+(index+1)+'</span><div class="jinpoBondActiveCardName">'+esc(name)+'</div></div><div class="jinpoBondActiveCardKind">'+esc(row && row['因縁種類'] || '')+'</div></div>'+
        '<div class="jinpoBondActiveLine '+(lines.length?'':'jinpoBondActiveNoLine')+'">成立ライン '+esc(lineText)+'</div>'+
        '<div class="jinpoBondFactors">'+factors.map(function(f){ return '<span class="jinpoBondFactor">'+esc(f)+'</span>'; }).join('')+'</div>'+
      '</article>';
    }).join('');
    return '<div class="jinpoBondActiveLayout">'+
      '<section class="jinpoBondFormationPanel">'+
        '<div class="jinpoBondFormationHead"><strong>現在の陣形図'+(formation?'：'+esc(formation):'')+'</strong><span class="jinpoBondFormationHint">右の因縁にカーソルを合わせている間、対応ラインが光ります</span></div>'+
        renderFormationDiagram()+
      '</section>'+
      '<section class="jinpoBondActiveListPanel">'+
        '<div class="jinpoBondActiveListHead"><strong>発動中因縁</strong><span class="jinpoBondModalCount">'+activated.length+'件</span></div>'+
        '<div class="jinpoBondActiveCards">'+cards+'</div>'+
      '</section>'+
    '</div>';
  }

  function renderModal(){
    var body = document.getElementById('jinpoBondModalBody');
    var count = document.getElementById('jinpoBondModalCount');
    var input = document.getElementById('jinpoBondSearch');
    if(!body || !count || !input || !Array.isArray(bondMasterCache)) return;
    var base = bondMasterCache.slice();
    var terms = text(input.value).split(/[\s　]+/).filter(Boolean).map(normalize);
    var rows = base.filter(function(row){
      if(!terms.length) return true;
      var hay = normalize([row['因縁名'],row['因縁種類'],row['因子1'],row['因子2'],row['因子3']].join(' '));
      return terms.every(function(term){ return hay.indexOf(term) !== -1; });
    });
    count.textContent = rows.length + ' / ' + base.length + '件';
    if(!rows.length){
      body.innerHTML = '<div class="jinpoBondEmpty">該当する因縁がありません。</div>';
      return;
    }
    body.innerHTML = '<table class="jinpoBondTable">'+
      '<thead><tr><th>No.</th><th>種類</th><th>因縁</th><th>構成因子</th></tr></thead><tbody>'+
      rows.map(function(row){
        var factors = [row['因子1'],row['因子2'],row['因子3']].map(text).filter(Boolean);
        return '<tr>'+
          '<td>'+esc(row['No'] || '')+'</td>'+
          '<td class="jinpoBondKind">'+esc(row['因縁種類'] || '')+'</td>'+
          '<td class="jinpoBondName">'+esc(row['因縁名'] || '')+'</td>'+
          '<td><div class="jinpoBondFactors">'+factors.map(function(f){ return '<span class="jinpoBondFactor">'+esc(f)+'</span>'; }).join('')+'</div></td>'+
        '</tr>';
      }).join('')+
      '</tbody></table>';
  }

  async function openModal(){
    ensureModal();
    var requestToken = ++modalOpenToken;
    var input = document.getElementById('jinpoBondSearch');
    var body = document.getElementById('jinpoBondModalBody');
    var backdrop = document.getElementById('jinpoBondModalBackdrop');
    input.value = '';
    body.innerHTML = '<div class="jinpoBondEmpty">読み込み中...</div>';
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden','false');
    try{
      await loadBondMaster();
      if(requestToken !== modalOpenToken || !backdrop.classList.contains('is-open')) return;
      renderModal();
      setTimeout(function(){ if(requestToken === modalOpenToken) try{ input.focus(); }catch(e){} },0);
    }catch(err){
      if(requestToken !== modalOpenToken) return;
      console.error('因縁一覧読込エラー',err);
      body.innerHTML = '<div class="jinpoBondEmpty">因縁一覧を読み込めませんでした。</div>';
      var count = document.getElementById('jinpoBondModalCount');
      if(count) count.textContent = '';
    }
  }

  function closeModal(){
    ++modalOpenToken;
    var backdrop = document.getElementById('jinpoBondModalBackdrop');
    if(!backdrop) return;
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden','true');
  }

  function renderActiveModalFromCurrentState(master){
    var body = document.getElementById('jinpoActiveBondModalBody');
    var count = document.getElementById('jinpoActiveBondModalCount');
    if(!body || !count) return;
    activeCalculatedResult = currentCalculatedResult(master);
    var activated = activeCalculatedResult && Array.isArray(activeCalculatedResult.activated) ? activeCalculatedResult.activated : [];
    count.textContent = activated.length + ' / ' + activated.length + '件';
    if(!activated.length){
      body.innerHTML = '<div class="jinpoBondEmpty">現在発動中の因縁はありません。</div>';
      return;
    }
    body.innerHTML = renderActiveModal(master,activeCalculatedResult);
    bindActiveCardHighlight();
  }

  async function openActiveModal(){
    ensureActiveModal();
    var requestToken = ++activeModalOpenToken;
    var body = document.getElementById('jinpoActiveBondModalBody');
    var backdrop = document.getElementById('jinpoActiveBondModalBackdrop');
    body.innerHTML = '<div class="jinpoBondEmpty">読み込み中...</div>';
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden','false');
    try{
      var master = await loadBondMaster();
      if(requestToken !== activeModalOpenToken || !backdrop.classList.contains('is-open')) return;
      renderActiveModalFromCurrentState(master);
    }catch(err){
      if(requestToken !== activeModalOpenToken) return;
      console.error('現在発動中因縁読込エラー',err);
      body.innerHTML = '<div class="jinpoBondEmpty">現在発動中因縁を読み込めませんでした。</div>';
      var count = document.getElementById('jinpoActiveBondModalCount');
      if(count) count.textContent = '';
    }
  }

  function closeActiveModal(){
    ++activeModalOpenToken;
    var backdrop = document.getElementById('jinpoActiveBondModalBackdrop');
    if(!backdrop) return;
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden','true');
  }

  function refreshActiveModalFromCurrentState(){
    var backdrop = document.getElementById('jinpoActiveBondModalBackdrop');
    if(!backdrop || !backdrop.classList.contains('is-open')) return;
    var token = ++activeModalOpenToken;
    loadBondMaster().then(function(master){
      if(token !== activeModalOpenToken || !backdrop.classList.contains('is-open')) return;
      renderActiveModalFromCurrentState(master);
    }).catch(function(e){ console.error('現在発動中因縁の再描画失敗',e); });
  }
  document.addEventListener('change',function(ev){
    if(ev.target && ev.target.id === 'formationSelect') setTimeout(refreshActiveModalFromCurrentState,0);
  },false);

  /* 職業表示は英傑マスタ「職業」列を正とする。特化(因子1)とは混同しない。
     既存ロジックを変更せず、配置英傑モーダルの表示文字だけを補正する。 */
  function correctOwnedHeroJobMeta(){
    var grid = document.getElementById('ownedHeroReliableGrid');
    if(!grid) return;
    var master = [];
    try{ if(typeof eiketsuMaster !== 'undefined' && Array.isArray(eiketsuMaster)) master = eiketsuMaster; }catch(e){}
    if(!master.length) return;
    Array.prototype.forEach.call(grid.querySelectorAll('[data-owned-reliable-key]'),function(card){
      var key = text(card.getAttribute('data-owned-reliable-key'));
      if(!key) return;
      var hero = master.find(function(h){
        return text(h && h.internal_id) === key || normalize(h && h['英傑名']) === normalize(key);
      });
      if(!hero) return;
      var job = text(hero['職業']);
      if(!job) return;
      var meta = card.querySelector('.ownedHeroMeta');
      if(!meta) return;
      var cost = text(hero['コスト']) || '未確認';
      meta.textContent = job + ' / コスト ' + cost;
    });
  }
  function scheduleOwnedHeroJobMetaFix(){
    setTimeout(correctOwnedHeroJobMeta,0);
    setTimeout(correctOwnedHeroJobMeta,80);
  }
  document.addEventListener('click',function(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('#ownedHeroSlotBtn1,#ownedHeroSlotBtn2,#ownedHeroSlotBtn3,#ownedHeroSlotBtn4,#ownedHeroSlotBtn5,#ownedHeroSlotBtn6,#ownedHeroReliableGrid,[data-owned-reliable-key]') : null;
    if(t) scheduleOwnedHeroJobMetaFix();
  },true);
  document.addEventListener('input',function(ev){
    if(ev.target && ev.target.id === 'ownedHeroReliableSearch') scheduleOwnedHeroJobMetaFix();
  },true);
  document.addEventListener('change',function(ev){
    if(ev.target && (ev.target.id === 'ownedHeroReliableJob' || ev.target.id === 'ownedHeroReliableFactor')) scheduleOwnedHeroJobMetaFix();
  },true);

  function currentMasterRowsSafe(){
    try{ if(typeof eiketsuMaster !== 'undefined' && Array.isArray(eiketsuMaster)) return eiketsuMaster; }catch(e){}
    return [];
  }
  function currentPlacementSafe(){
    try{ if(typeof placement !== 'undefined' && placement) return placement; }catch(e){}
    return {};
  }
  function safeCurrentFormationState(){
    var p = currentPlacementSafe();
    var seen = new Set();
    var duplicateFound = false;
    var slots = [1,2,3,4,5,6].map(function(slot){
      var h = p[slot] || null;
      if(!h) return null;
      var id = text(h.internal_id || h.id || h['番号'] || '');
      if(id === 'EIK_0125') id = 'EIK_0246';
      if(!id) return null;
      if(seen.has(id)){
        duplicateFound = true;
        return null;
      }
      seen.add(id);
      return id;
    });
    if(duplicateFound) console.error('共有編成生成時に同一英傑の重複配置を検出したため、重複枠を空欄化しました');
    return { formation: currentFormationName() || '', slots: slots };
  }
  function safeApplyShareState(state){
    if(!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('共有編成データが不正です');
    if(Object.prototype.hasOwnProperty.call(state,'slots') && !Array.isArray(state.slots)) throw new Error('共有編成の枠データが不正です');
    var requested = text(state.formation);
    var formation = requested ? canonicalFormation(requested) : currentFormationName();
    if(requested && !formation) throw new Error('未対応の陣形です: ' + requested);
    var sel = document.getElementById('formationSelect');
    if(formation && sel){
      var has = Array.prototype.some.call(sel.options || [],function(opt){ return text(opt.value) === formation; });
      if(!has) throw new Error('陣形選択肢が未準備です: ' + formation);
    }

    var next = null;
    if(Array.isArray(state.slots)){
      if(state.slots.length > 6) throw new Error('共有編成の枠数が不正です');
      var master = currentMasterRowsSafe();
      if(!master.length) throw new Error('英傑マスタ読込前です');
      var byId = new Map();
      master.forEach(function(hero){
        var id = text(hero && (hero.internal_id || hero.id || hero['番号']));
        if(id && !byId.has(id)) byId.set(id,hero);
      });
      next = {};
      var seen = new Set();
      state.slots.forEach(function(rawId,index){
        if(!rawId) return;
        var id = text(rawId) === 'EIK_0125' ? 'EIK_0246' : text(rawId);
        if(!id) return;
        if(seen.has(id)) throw new Error('共有編成に同一英傑が重複しています: ' + id);
        var hero = byId.get(id);
        if(!hero) throw new Error('共有編成の英傑が現在のマスタに存在しません: ' + id);
        next[index+1] = hero;
        seen.add(id);
      });
    }

    /* 全検証が通ってから画面状態を一括更新し、途中状態を残さない。 */
    if(formation && sel) sel.value = formation;
    if(next !== null){
      try{ placement = next; }catch(e){ throw new Error('配置復元に失敗しました'); }
    }
    clearTransientAppliedDbState();
    try{ if(typeof renderSlots === 'function') renderSlots(); }catch(e){}
    try{ if(typeof renderFormation === 'function') renderFormation(null); }catch(e){}
    try{ if(typeof calculate === 'function') calculate(); }catch(e){ console.error('共有編成の再計算失敗',e); }
    syncFormationUiState();
    refreshFormationDependentSearchUi();
    return true;
  }
  function installShareStateGuard(){
    window.currentFormationState = safeCurrentFormationState;
    window.applyShareState = safeApplyShareState;
  }
  function decodeShareStateSafe(code){
    try{
      if(typeof window.decodeShareState === 'function') return window.decodeShareState(code);
    }catch(e){}
    return JSON.parse(decodeURIComponent(escape(atob(code))));
  }
  function sharePrerequisitesReady(){
    var sel = document.getElementById('formationSelect');
    var master = currentMasterRowsSafe();
    var bonds = [];
    try{ if(typeof inenMaster !== 'undefined' && Array.isArray(inenMaster)) bonds = inenMaster; }catch(e){}
    return !!(sel && sel.options && sel.options.length >= 5 && master.length && bonds.length);
  }
  function cancelPendingShareUrlRecovery(){
    if(window.__jinpoShareUrlRecoveryScheduled && !window.__jinpoShareUrlRecovered){
      window.__jinpoShareUrlRecoveryCancelled = true;
    }
  }
  function installShareRecoveryCancelGuard(){
    if(window.__jinpoShareRecoveryCancelGuardInstalled) return;
    window.__jinpoShareRecoveryCancelGuardInstalled = true;
    document.addEventListener('pointerdown',cancelPendingShareUrlRecovery,true);
    document.addEventListener('keydown',cancelPendingShareUrlRecovery,true);
  }
  function recoverShareUrlAfterInit(){
    if(window.__jinpoShareUrlRecoveryScheduled) return;
    var code = '';
    try{ code = new URLSearchParams(location.search).get('f') || ''; }catch(e){}
    if(!code) return;
    window.__jinpoShareUrlRecoveryScheduled = true;
    window.__jinpoShareUrlRecoveryCancelled = false;
    var attempts = 0;
    var startedAt = Date.now();
    function tryRestore(){
      if(window.__jinpoShareUrlRecoveryCancelled) return;
      attempts += 1;
      if(!sharePrerequisitesReady()){
        /* 共有URLを開いた時だけ待機。低速回線でも10秒で永久失敗しないよう最大120秒待つ。 */
        if(Date.now() - startedAt < 120000){
          setTimeout(tryRestore, attempts < 100 ? 100 : 500);
        }else{
          window.__jinpoShareUrlRecoveryScheduled = false;
          window.__jinpoShareUrlRecoveryTimedOut = true;
          console.error('共有URL復元: 120秒以内にマスタ読込完了を確認できませんでした。再試行可能状態へ戻しました');
        }
        return;
      }
      if(window.__jinpoShareUrlRecoveryCancelled) return;
      try{
        safeApplyShareState(decodeShareStateSafe(code));
        window.__jinpoShareUrlRecovered = true;
        var box = document.getElementById('shareStatus');
        if(box) box.textContent = '共有URLから編成を復元しました';
      }catch(e){
        console.error('共有URL復元失敗',e);
        var status = document.getElementById('shareStatus');
        if(status) status.textContent = '共有URLの復元に失敗しました';
      }
    }
    setTimeout(tryRestore,0);
  }

  function placementHeroIdentity(hero){
    if(!hero) return '';
    return text(hero.internal_id || hero.id || hero['番号'] || '');
  }
  function sanitizedUniquePlacement(source){
    if(!source || typeof source !== 'object') return source;
    var seen = new Set(), changed = false, next = {};
    for(var slot=1;slot<=6;slot++){
      var hero = source[slot] || null;
      var key = placementHeroIdentity(hero);
      if(key && seen.has(key)){
        next[slot] = null;
        changed = true;
      }else{
        next[slot] = hero;
        if(key) seen.add(key);
      }
    }
    if(!changed) return source;
    console.error('同一英傑の重複配置を検出したため、重複枠を因縁計算から除外しました');
    return next;
  }
  function installActivationDuplicateGuard(){
    var engine = window.JinpoActivationEngine;
    if(!engine || typeof engine.calculateFormation !== 'function') return;
    var current = engine.calculateFormation;
    if(current.__jinpoDuplicatePlacementGuardWrapped) return;
    function guardedCalculateFormation(sourcePlacement, formationName){
      var args = Array.prototype.slice.call(arguments);
      args[0] = sanitizedUniquePlacement(sourcePlacement);
      var canonical = canonicalFormation(formationName);
      if(canonical) args[1] = canonical;
      return current.apply(this,args);
    }
    guardedCalculateFormation.__jinpoDuplicatePlacementGuardWrapped = true;
    guardedCalculateFormation.__jinpoDuplicatePlacementGuardOriginal = current;
    engine.calculateFormation = guardedCalculateFormation;
  }


  function dbRowDuplicateHeroKeys(row){
    try{
      var ids = [];
      if(typeof dbRowInternalIds === 'function') ids = dbRowInternalIds(row).map(text).filter(Boolean);
      var keys = ids.length === 6 ? ids : [];
      if(keys.length !== 6 && typeof dbRowMembers === 'function'){
        keys = dbRowMembers(row).map(function(name){
          try{ return typeof canonicalHeroName === 'function' ? text(canonicalHeroName(name)) : normalize(name); }
          catch(e){ return normalize(name); }
        }).filter(Boolean);
      }
      if(keys.length !== 6) return [];
      var seen = new Set(), dup = [];
      keys.forEach(function(k){ if(seen.has(k)) dup.push(k); else seen.add(k); });
      return unique(dup);
    }catch(e){
      console.error('DB行の重複英傑確認失敗',e);
      return [];
    }
  }
  function validateInenOverrideStrict(rows){
    var errors=[];
    if(!Array.isArray(rows) || !rows.length) return ['因縁マスターが空です'];
    var seenNames=new Set();
    rows.forEach(function(row,index){
      var line=index+2,name=text(row && row['因縁名']);
      if(!name) errors.push(line+'行目 因縁名なし');
      var key=normalize(name);
      if(key && seenNames.has(key)) errors.push(line+'行目 因縁名重複: '+name);
      if(key) seenNames.add(key);
      ['因子1','因子2','因子3'].forEach(function(field){
        if(!row || !(field in row)) errors.push(line+'行目 '+field+'列なし');
        else if(!text(row[field])) errors.push(line+'行目 '+field+'が空です');
      });
    });
    return unique(errors);
  }
  function installRuntimeMasterOverrideGuards(){
    var applyInen=window.applyInenMasterRows;
    if(typeof applyInen==='function' && !applyInen.__jinpoStrictOverrideWrapped){
      function guardedApplyInenMasterRows(rows,label){
        var errors=validateInenOverrideStrict(rows);
        if(errors.length){
          var box=document.getElementById('overrideInenStatus');
          if(box) box.innerHTML='<span style="color:#ff8a8a">適用不可</span><br>'+errors.slice(0,20).map(esc).join('<br>');
          return false;
        }
        var ok=applyInen.apply(this,arguments);
        if(ok!==false){
          try{ if(typeof inenMaster!=='undefined' && Array.isArray(inenMaster)){ bondMasterCache=inenMaster.slice(); } }catch(e){ bondMasterCache=null; }
          activeCalculatedResult=null;
          clearTransientAppliedDbState();
          invalidateReachCandidateCacheAfterMasterChange();
          syncRuntimeOverrideSearchState();
          try{
            var modal=document.getElementById('jinpoActiveBondModalBackdrop');
            if(modal && modal.classList.contains('is-open')) setTimeout(openActiveModal,0);
          }catch(e){}
        }
        return ok;
      }
      guardedApplyInenMasterRows.__jinpoStrictOverrideWrapped=true;
      guardedApplyInenMasterRows.__jinpoStrictOverrideOriginal=applyInen;
      window.applyInenMasterRows=guardedApplyInenMasterRows;
      try{ applyInenMasterRows=guardedApplyInenMasterRows; }catch(e){}
    }
    var applyHero=window.applyEiketsuMasterRows;
    if(typeof applyHero==='function' && !applyHero.__jinpoSearchSafetyWrapped){
      function guardedApplyEiketsuMasterRows(){
        var ok=applyHero.apply(this,arguments);
        if(ok!==false){
          clearTransientAppliedDbState();
          invalidateReachCandidateCacheAfterMasterChange();
          syncRuntimeOverrideSearchState();
          scheduleOwnedHeroJobMetaFix();
        }
        return ok;
      }
      guardedApplyEiketsuMasterRows.__jinpoSearchSafetyWrapped=true;
      guardedApplyEiketsuMasterRows.__jinpoSearchSafetyOriginal=applyHero;
      window.applyEiketsuMasterRows=guardedApplyEiketsuMasterRows;
      try{ applyEiketsuMasterRows=guardedApplyEiketsuMasterRows; }catch(e){}
    }
  }
  function installSavedFormationRefreshGuard(){
    if(window.__jinpoSavedFormationRefreshGuardInstalled) return;
    window.__jinpoSavedFormationRefreshGuardInstalled=true;
    /* 保存読込handlerはその場でcalculate()まで実行するため、
       読込前のDB適用状態をcapture段階で先に破棄する。 */
    document.addEventListener('click',function(ev){
      var btn=ev.target&&ev.target.closest?ev.target.closest('#savedFormations [data-load]'):null;
      if(btn) clearTransientAppliedDbState();
    },true);
    document.addEventListener('click',function(ev){
      var btn=ev.target&&ev.target.closest?ev.target.closest('#savedFormations [data-load]'):null;
      if(!btn) return;
      /* 既存handlerがplacement/formationを更新した直後に検索/UIを新状態へ揃える。 */
      setTimeout(function(){
        syncFormationUiState();
        refreshFormationDependentSearchUi();
      },0);
    },false);
  }

  function installDirectStateResetGuards(){
    if(window.__jinpoDirectStateResetGuardsInstalled) return;
    window.__jinpoDirectStateResetGuardsInstalled=true;
    /* 陣形変更は編成変更ではないため、適用中候補を消さない。全解除だけ状態を破棄する。 */
    document.addEventListener('click',function(ev){
      var t=ev && ev.target && ev.target.closest ? ev.target.closest('#clearBtn') : null;
      if(t) clearTransientAppliedDbState();
    },true);
  }

  function installDbApplyDuplicateGuard(){
    var current = window.applyDbFormationRow;
    if(typeof current !== 'function' || current.__jinpoDuplicateHeroGuardWrapped) return;
    function guardedApplyDbFormationRow(row){
      var dup = dbRowDuplicateHeroKeys(row);
      if(dup.length){
        console.error('DB行に同一英傑の重複配置があるため適用を中止しました',dup,row);
        try{
          if(typeof window.__jinpoAskYesNo === 'function'){
            /* Yes/No確認にはせず、既存UIを勝手に進めない。コンソールで確実に停止する。 */
          }
        }catch(e){}
        return;
      }
      return current.apply(this,arguments);
    }
    guardedApplyDbFormationRow.__jinpoDuplicateHeroGuardWrapped = true;
    guardedApplyDbFormationRow.__jinpoDuplicateHeroGuardOriginal = current;
    window.applyDbFormationRow = guardedApplyDbFormationRow;
  }

  function boot(){
    injectStyle();
    ensureActions();
    ensureModal();
    ensureActiveModal();
    installActivationDuplicateGuard();
    installDbApplyDuplicateGuard();
    installDbRowRenderStateGuard();
    installRuntimeMasterOverrideGuards();
    installPrecomputedSearchOverrideGuard();
    installSavedFormationRefreshGuard();
    installDirectStateResetGuards();
    installShareStateGuard();
    installShareRecoveryCancelGuard();
    syncFormationUiState();
    syncRuntimeOverrideSearchState();
    recoverShareUrlAfterInit();
    syncRecommendDecorFromSearch();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
  setTimeout(boot,0);
  setTimeout(boot,300);
})();
