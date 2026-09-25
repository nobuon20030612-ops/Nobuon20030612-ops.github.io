(function(){
  'use strict';
  if(window.__jinpoUnifiedSearchInstalled)return;window.__jinpoUnifiedSearchInstalled=true;

  var LIMIT=500,HIT_CAP=100000,QUERY_CACHE_GENERATION_RECHECK_MS=60000,worker=null,bond56Worker=null,hitCountWorker=null,bond56Mode=false,seq=0,activeToken=0,activeWorkerToken=0,hitCountSeq=0,pending=new Map(),activeRows=[],displayRows=[],queryCache=new Map(),inFlightSearches=new Map(),foregroundRunning=null,foregroundQueued=null,foregroundEpoch=0,selectedExclude=0,manifestProbePromise=null,knownManifestGeneration='',formationRerunSerial=0;
  var listSort={key:'',dir:'desc'},appliedListRowKey='',resultsStaleBySwap=false,searchStatMode='base';
  var recommendState={active:false,targetStat:'',secondaryStat:'',formation:'',applyingFormation:false,syncingPriority:false};
  window.JINPO_RESULT_LIMIT=LIMIT;

  var STATS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性'];
  var SORT_FIELDS=[
    {key:'総合値',label:'総合値',cls:'total'},
    {key:'生命',label:'生命',cls:'life'},
    {key:'気合',label:'気合',cls:'ki'},
    {key:'腕力',label:'腕力',cls:'str'},
    {key:'耐久力',label:'耐久',cls:'vit'},
    {key:'器用さ',label:'器用',cls:'dex'},
    {key:'知力',label:'知力',cls:'int'},
    {key:'魅力',label:'魅力',cls:'cha'},
    {key:'土属性',label:'土',cls:'earth'},
    {key:'水属性',label:'水',cls:'water'},
    {key:'火属性',label:'火',cls:'fire'},
    {key:'風属性',label:'風',cls:'wind'}
  ];
  // 検索結果一覧は総合値を表示せず、生命～風だけを左詰めで表示する。
  // 総合値データ自体は検索・順位判定等の内部処理用として保持する。
  var DISPLAY_FIELDS=SORT_FIELDS.filter(function(f){return f.key!=='総合値';});

  function q(id){return document.getElementById(id);}
  function norm(v){return String(v==null?'':v).trim().replace(/・/g,'').replace(/[\s　]+/g,'');}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});}
  function selectedCount(){try{return Number(selectedDbListBondCount)||0;}catch(e){return Number(window.selectedDbListBondCount)||0;}}
  function setCount(c){try{selectedDbListBondCount=Number(c)||null;}catch(e){}window.selectedDbListBondCount=Number(c)||null;}
  function gradeOn(){try{return !!grade3Cost6OnlyEnabled;}catch(e){return !!window.grade3Cost6OnlyEnabled;}}
  var grade3HeroIdSource=null,grade3HeroIdSet=new Set();
  function grade3HeroIds(){
    var src=[];try{if(typeof eiketsuMaster!=='undefined'&&Array.isArray(eiketsuMaster))src=eiketsuMaster;else if(Array.isArray(window.eiketsuMaster))src=window.eiketsuMaster;}catch(e){src=Array.isArray(window.eiketsuMaster)?window.eiketsuMaster:[];}
    if(src!==grade3HeroIdSource){grade3HeroIdSource=src;grade3HeroIdSet=new Set();(src||[]).forEach(function(h){var id=String(h&&(h.internal_id||h.id||h.ID||h['internal_id'])||'').trim(),cost=Number(h&&(h['コスト']!==undefined?h['コスト']:h.cost));if(id&&Number.isFinite(cost)&&cost<=6)grade3HeroIdSet.add(id);});}
    return grade3HeroIdSet;
  }
  function isGrade3InternalId(id){return grade3HeroIds().has(String(id||'').trim());}
  function bond56On(){return !!bond56Mode;}
  function syncBond56FormationGuide(){
    var active=!!(bond56On()&&!form());
    document.body.classList.toggle('jinpo-bond56-formation-unselected',active);
  }
  function setBond56Mode(on){bond56Mode=!!on;document.body.classList.toggle('jinpo-bond56-mode',bond56Mode);syncBond56Ui();renderUnifiedCountButtons();syncBond56FormationGuide();try{window.dispatchEvent(new CustomEvent('jinpo:bond56-mode',{detail:{active:bond56Mode}}));}catch(e){}return bond56Mode;}
  function selectBond56Mode(on){
    on=!!on;
    var keepRecommend=!!recommendState.active,recommendTarget=String(recommendState.targetStat||'');
    activeToken++;window.__jinpoSearchCancelRequested=true;cancelWorkerRequests();hideProgress();window.__jinpoSearchCancelRequested=false;
    setCount(null);activeRows=[];displayRows=[];updateGlobals([]);setSummary(0,0);
    setBond56Mode(on);
    if(on&&keepRecommend&&recommendTarget){renderRecommended({targetStat:recommendTarget});return true;}
    var st=q('dbListStatus'),box=q('dbFormationList');
    if(st)st.textContent=on?'5・6因縁モード ON：全等級から5因縁または6因縁を検索できます。おすすめ陣法も5・6因縁のみを対象に利用できます。':'5・6因縁モード OFF：通常検索へ戻りました。';
    if(box)box.innerHTML='<div class="dbListNote">'+(on?'5因縁または6因縁を選択してください。7〜9因縁はモード中は無効です。おすすめ陣法は5・6因縁のみを対象に検索します。':'通常の因縁数検索を選択してください。')+'</div>';
    return true;
  }
  function syncBond56Ui(){document.body.classList.toggle('jinpo-bond56-mode',!!bond56Mode);syncBond56FormationGuide();var nav=q('jinpoRecommendNav'),note=q('jinpoRecommendSearchOrderNote'),guide=q('jinpoRecommendSumGuide');[nav,note,guide].forEach(function(el){if(!el)return;el.setAttribute('aria-disabled','false');el.classList.remove('bond56ModeLocked');});if(note)note.textContent=bond56Mode?'おすすめ検索は【全陣形 】で高い順検索になります':'おすすめ検索は【全陣形 】で高い順検索になります';document.querySelectorAll('[data-jinpo-recommend-stat]').forEach(function(btn){if(btn.title==='5・6因縁モード中はおすすめ検索を利用できません')btn.removeAttribute('title');var runtimeLocked=!!window.__jinpoRuntimeMasterOverrideActive;if(!runtimeLocked)btn.disabled=false;btn.setAttribute('aria-disabled',runtimeLocked?'true':'false');btn.classList.remove('bond56ModeLocked');});}
  function form(){var s=q('formationSelect'),t=String((s&&(s.value||(s.selectedOptions&&s.selectedOptions[0]&&s.selectedOptions[0].textContent)))||'');if(t.indexOf('衡軛')>=0)return'衡軛';if(t.indexOf('鶴翼')>=0)return'鶴翼';if(t.indexOf('魚鱗')>=0)return'魚鱗';if(t.indexOf('方円')>=0)return'方円';return'';}
  function ownedInternalIds(){
    try{
      var a=(typeof ownedHeroFilterIds!=='undefined'&&Array.isArray(ownedHeroFilterIds))?ownedHeroFilterIds:(Array.isArray(window.ownedHeroFilterIds)?window.ownedHeroFilterIds:[]);
      return a.map(function(x){return String(x==null?'':x).trim();}).filter(Boolean);
    }catch(e){return[];}
  }
  function excludedInternalIds(){try{return (typeof window.__jinpoGetExcludedHeroInternalIds==='function'?window.__jinpoGetExcludedHeroInternalIds():[]).map(function(x){return String(x==null?'':x).trim();}).filter(Boolean);}catch(e){return[];}}
  function rules(){try{return ((typeof getDbPriorityRules==='function'?getDbPriorityRules():[])||[]).filter(function(r){return r&&r.stat;});}catch(e){return[];}}
  function sumSortConfig(){
    try{
      var raw=typeof window.__jinpoGetSumPrioritySort==='function'?window.__jinpoGetSumPrioritySort():null;
      var s1=String(raw&&raw.stat1||'').trim(),s2=String(raw&&raw.stat2||'').trim();
      return {enabled:!!(raw&&raw.enabled&&s1&&s2),stat1:s1,stat2:s2,tiePrefer:(raw&&raw.tiePrefer==='second')?'second':'first'};
    }catch(e){return{enabled:false,stat1:'',stat2:'',tiePrefer:'first'};}
  }
  var RECOMMEND_LABELS={'生命':'生命','気合':'気合','腕力':'腕力','耐久力':'耐久','器用さ':'器用','知力':'知力','魅力':'魅力','土属性':'土','水属性':'水','火属性':'火','風属性':'風'};
  function validRecommendStat(stat){return STATS.indexOf(String(stat||''))>=0;}
  function recommendLabel(stat){return RECOMMEND_LABELS[String(stat||'')]||String(stat||'');}
  function dispatchChange(el){if(!el)return;try{el.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){var ev=document.createEvent('Event');ev.initEvent('change',true,true);el.dispatchEvent(ev);}}
  function prepareRecommendPriority(target,clearSecond){
    target=String(target||'').trim();if(!validRecommendStat(target))return;
    var s1=q('dbPriorityStat1'),v1=q('dbPriorityValue1'),mx1=q('dbPriorityMax1'),s2=q('dbPriorityStat2'),v2=q('dbPriorityValue2'),mx2=q('dbPriorityMax2');
    var changedS1=false,changedV1=false,changedMx1=false,changedS2=false,changedV2=false,changedMx2=false;
    recommendState.syncingPriority=true;
    try{
      if(s1&&String(s1.value||'')!==target){s1.value=target;changedS1=true;}
      if(clearSecond&&v1&&String(v1.value||'')!==''){v1.value='';changedV1=true;}
      if(clearSecond&&mx1&&String(mx1.value||'')!==''){mx1.value='';changedMx1=true;}
      if(clearSecond&&s2&&String(s2.value||'')!==''){s2.value='';changedS2=true;}
      if(clearSecond&&v2&&String(v2.value||'')!==''){v2.value='';changedV2=true;}
      if(clearSecond&&mx2&&String(mx2.value||'')!==''){mx2.value='';changedMx2=true;}
      if(s2&&String(s2.value||'')===target){s2.value='';changedS2=true;if(v2&&String(v2.value||'')!==''){v2.value='';changedV2=true;}if(mx2&&String(mx2.value||'')!==''){mx2.value='';changedMx2=true;}}
      if(changedS1)dispatchChange(s1);
      if(changedV1)dispatchChange(v1);
      if(changedMx1)dispatchChange(mx1);
      if(changedS2)dispatchChange(s2);
      if(changedV2)dispatchChange(v2);
      if(changedMx2)dispatchChange(mx2);
    }finally{recommendState.syncingPriority=false;}
    try{window.dispatchEvent(new CustomEvent('jinpo:recommend-priority-sync',{detail:{targetStat:target,clearSecond:!!clearSecond}}));}catch(e){}
  }
  function currentRecommendSecondary(target){var s=q('dbPriorityStat2'),v=String(s&&s.value||'').trim();return validRecommendStat(v)&&v!==target?v:'';}
  function syncRecommendUi(){
    var active=!!recommendState.active,target=active?String(recommendState.targetStat||''):'',secondary=active?String(recommendState.secondaryStat||''):'';document.querySelectorAll('[data-jinpo-recommend-stat]').forEach(function(btn){var on=active&&String(btn.getAttribute('data-jinpo-recommend-stat')||'')===target;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');});var sum=q('jinpoSumPrioritySort');if(sum){sum.dataset.recommendMode=active?'1':'0';sum.dataset.recommendSecondary=secondary?'1':'0';}var formationSel=q('formationSelect');if(formationSel){formationSel.disabled=active;formationSel.setAttribute('aria-disabled',active?'true':'false');formationSel.classList.toggle('jinpoRecommendFormationLocked',active);var formationLabel=formationSel.closest?formationSel.closest('label'):null;if(formationLabel)formationLabel.classList.toggle('jinpoRecommendFormationLocked',active);}try{window.dispatchEvent(new CustomEvent('jinpo:recommend-state',{detail:{active:active,targetStat:target,secondaryStat:secondary,formation:String(recommendState.formation||'')}}));}catch(e){}
  }
  function exitRecommendMode(){recommendState.active=false;recommendState.targetStat='';recommendState.secondaryStat='';recommendState.formation='';recommendState.applyingFormation=false;recommendState.syncingPriority=false;syncRecommendUi();}
  function hasThreshold(rs){return (rs||rules()).some(function(r){if(!r)return false;var min=Number(r.threshold),max=Number(r.maxThreshold);return (r.threshold!==null&&r.threshold!==''&&Number.isFinite(min))||(r.maxThreshold!==null&&r.maxThreshold!==''&&Number.isFinite(max));});}
  function factor4Max(){return selectedExclude>0?6-selectedExclude:null;}

  function ensureUiStyle(){
    if(q('jinpoResultUiEnhanceStyle'))return;
    var st=document.createElement('style');st.id='jinpoResultUiEnhanceStyle';st.textContent=`
      .dbPriorityControls.dbPriorityButtonMode{grid-template-columns:repeat(2,minmax(0,1fr)) !important;align-items:stretch !important}
      .jinpoPriorityTitleRow{display:flex !important;align-items:center !important;justify-content:flex-start !important;gap:10px !important;min-width:0 !important;margin:0 0 8px 0 !important;white-space:nowrap !important}
      .jinpoPriorityTitleRow > label{display:block !important;flex:0 0 auto !important;margin:0 !important}
      .jinpoPrioritySortNotice{display:inline-flex;align-items:center;justify-content:center;flex:0 1 auto;min-width:0;box-sizing:border-box;margin:0;padding:4px 10px;border:2px solid #e7bd5c;border-radius:9px;background:linear-gradient(135deg,rgba(122,33,24,.92),rgba(45,27,10,.96));color:#fff1bd;font-size:16px;font-weight:950;line-height:1.25;letter-spacing:.02em;box-shadow:0 0 10px rgba(231,189,92,.30),inset 0 0 8px rgba(255,231,167,.08);white-space:nowrap}
      .jinpoSearchStatMode{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 12px;padding:9px 12px;border:1px solid rgba(231,189,92,.58);border-radius:12px;background:linear-gradient(180deg,rgba(50,31,13,.78),rgba(13,9,6,.92));box-shadow:0 0 14px rgba(231,189,92,.12)}
      .jinpoSearchStatModeLabel{font-size:14px;font-weight:950;color:#ffe1a1;white-space:nowrap}
      .jinpoSearchStatModeBtn{min-height:36px;padding:6px 14px;border:1px solid rgba(231,189,92,.68);border-radius:9px;background:linear-gradient(#3b2918,#171008);color:#f6e7c4;font-size:14px;font-weight:950;cursor:pointer;box-shadow:none}
      .jinpoSearchStatModeBtn.active[data-search-stat-mode="base"]{background:linear-gradient(#31521f,#14250f);border-color:#71e49a;color:#ecffe1;box-shadow:0 0 12px rgba(113,228,154,.38)}
      .jinpoSearchStatModeBtn.active[data-search-stat-mode="fullmax"]{background:linear-gradient(#8a341c,#3a120a);border-color:#ffd166;color:#fff3c4;box-shadow:0 0 12px rgba(255,209,102,.66),0 0 22px rgba(255,132,61,.30)}
      #formationSelect.jinpoRecommendFormationLocked{opacity:.38 !important;filter:grayscale(.92) brightness(.62) !important;cursor:not-allowed !important;pointer-events:none !important}
      label.jinpoRecommendFormationLocked:has(#formationSelect){opacity:.48 !important;filter:grayscale(.82) brightness(.70) !important;cursor:not-allowed !important;pointer-events:none !important}
      .jinpoSearchStatModeNote{flex:1 1 360px;min-width:220px;color:#d7c08d;font-size:12px;font-weight:800;line-height:1.35}
      @media(max-width:760px){.jinpoSearchStatMode{align-items:stretch}.jinpoSearchStatModeLabel{width:100%}.jinpoSearchStatModeBtn{flex:1 1 120px}.jinpoSearchStatModeNote{flex-basis:100%;min-width:0}}
      #jinpoResultSummary{display:grid;grid-template-columns:minmax(220px,1fr) minmax(220px,1fr);gap:10px;margin:10px 0 6px 0}
      .jinpoResultSummaryItem{display:flex;align-items:baseline;justify-content:center;gap:8px;min-height:50px;padding:7px 12px;box-sizing:border-box;border:1px solid rgba(231,189,92,.55);border-radius:11px;background:linear-gradient(180deg,rgba(48,30,14,.92),rgba(16,11,7,.95));box-shadow:0 0 13px rgba(231,189,92,.13)}
      .jinpoResultSummaryLabel{font-size:13px;font-weight:900;color:#d7c08d;white-space:nowrap}
      .jinpoResultSummaryValue{font-size:25px;font-weight:950;color:#fff0b8;line-height:1}
      .jinpoResultSummarySuffix{font-size:14px;font-weight:900;color:#f4ead2;white-space:nowrap}
      #jinpoResultSortHint{margin:6px 0 4px 0;padding:7px 10px;text-align:center;border:1px solid rgba(113,228,154,.45);border-radius:9px;background:rgba(35,74,46,.22);color:#dfffe7;font-size:15px;font-weight:900;letter-spacing:.01em}
      #jinpoResultSortHintSub{margin:0 0 7px 0;padding:6px 10px;text-align:center;border:1px solid rgba(231,189,92,.42);border-radius:9px;background:rgba(74,51,23,.22);color:#ffe7ba;font-size:14px;font-weight:900;letter-spacing:.01em}
      #jinpoResultSortHintSub .jinpoResultSortHintBlue{display:inline-block;vertical-align:middle;width:34px;height:14px;margin:0 4px 0 0;border:2px solid #3f9cff;border-radius:7px;background:linear-gradient(180deg,rgba(22,78,154,.34),rgba(9,32,62,.28));box-shadow:0 0 8px rgba(63,156,255,.36),inset 0 0 6px rgba(255,255,255,.08)}
      #jinpoResultSortHintSub .jinpoResultSortHintGrade3{color:#7dc2ff;text-shadow:0 0 8px rgba(63,156,255,.45)}
      #jinpoResultSortHintSub .jinpoResultSortHintRed{color:#ff5a5a;text-shadow:0 0 8px rgba(255,40,40,.6)}
      #jinpoSwapStaleNotice{margin:6px 0 7px 0;padding:7px 10px;text-align:center;border:1px solid rgba(231,189,92,.62);border-radius:9px;background:rgba(103,55,15,.28);color:#ffe1a1;font-size:15px;font-weight:900;letter-spacing:.01em}
      #dbFormationList .dbStatSortHeaderRow th{position:sticky !important;top:31px !important;z-index:3 !important;padding:3px 5px !important;background:#120d08 !important}
      #dbFormationList .jinpoStatGrid{display:grid !important;grid-template-columns:repeat(11,minmax(0,1fr)) !important;gap:3px !important;min-width:0 !important;width:100% !important;box-sizing:border-box !important}
      #dbFormationList .jinpoStatSortButton{appearance:none !important;width:100% !important;min-width:0 !important;height:30px !important;padding:3px 2px !important;margin:0 !important;border:1px solid rgba(255,255,255,.18) !important;border-radius:7px !important;background:#17110b !important;font-size:12px !important;font-weight:950 !important;line-height:1 !important;cursor:pointer !important;box-sizing:border-box !important;box-shadow:none !important;white-space:nowrap !important}
      #dbFormationList .jinpoStatSortButton:hover{filter:brightness(1.28) !important;transform:none !important}
      #dbFormationList .dbStatRow>td{padding:3px 5px !important;background:rgba(0,0,0,.15);border-bottom:5px solid #c58a2a !important}
      #dbFormationList .jinpoStatCell{display:flex;align-items:center;justify-content:center;min-width:0;min-height:26px;padding:2px 3px;border:1px solid transparent;border-radius:6px;box-sizing:border-box;font-size:15px;font-weight:950;line-height:1.05;white-space:nowrap;font-variant-numeric:tabular-nums}
      #dbFormationList .jinpoStatCell .jinpoStatCellName{display:none}
      #dbFormationList .jinpoCompatSep{display:none !important}
      #dbFormationList .jinpoStat-total{color:#ffe1a1 !important;--jinpo-glow:rgba(231,189,92,.34);--jinpo-bg:rgba(231,189,92,.13)}
      #dbFormationList .jinpoStat-life{color:#ffffff !important;--jinpo-glow:rgba(255,255,255,.34);--jinpo-bg:rgba(255,255,255,.11)}
      #dbFormationList .jinpoStat-ki{color:#cfefff !important;--jinpo-glow:rgba(207,239,255,.46);--jinpo-bg:rgba(207,239,255,.12)}
      #dbFormationList .jinpoStat-str{color:#ff7777 !important;--jinpo-glow:rgba(255,119,119,.55);--jinpo-bg:rgba(201,51,51,.16)}
      #dbFormationList .jinpoStat-vit{color:#70a0ff !important;--jinpo-glow:rgba(112,160,255,.55);--jinpo-bg:rgba(36,95,199,.18)}
      #dbFormationList .jinpoStat-dex{color:#75d28d !important;--jinpo-glow:rgba(117,210,141,.55);--jinpo-bg:rgba(58,155,85,.17)}
      #dbFormationList .jinpoStat-int{color:#fff083 !important;--jinpo-glow:rgba(255,240,131,.55);--jinpo-bg:rgba(242,217,59,.16)}
      #dbFormationList .jinpoStat-cha{color:#c88fe8 !important;--jinpo-glow:rgba(200,143,232,.55);--jinpo-bg:rgba(139,75,180,.18)}
      #dbFormationList .jinpoStat-earth{color:#fff1a8 !important;--jinpo-glow:rgba(255,241,168,.55);--jinpo-bg:rgba(255,241,168,.13)}
      #dbFormationList .jinpoStat-water{color:#73d7f3 !important;--jinpo-glow:rgba(115,215,243,.55);--jinpo-bg:rgba(115,215,243,.15)}
      #dbFormationList .jinpoStat-fire{color:#f3a0a0 !important;--jinpo-glow:rgba(243,160,160,.55);--jinpo-bg:rgba(243,160,160,.15)}
      #dbFormationList .jinpoStat-wind{color:#a8e2a6 !important;--jinpo-glow:rgba(168,226,166,.55);--jinpo-bg:rgba(168,226,166,.15)}
      #dbFormationList .jinpoStatSortButton.jinpoSortActive,#dbFormationList .jinpoStatCell.jinpoSortActive,#dbFormationList .jinpoStatSortButton.jinpoPriorityActive,#dbFormationList .jinpoStatCell.jinpoPriorityActive{background:var(--jinpo-bg) !important;border-color:var(--jinpo-glow) !important;box-shadow:0 0 8px var(--jinpo-glow),inset 0 0 8px var(--jinpo-bg) !important}
      #dbFormationList .jinpoStatSortButton.jinpoSortActive,#dbFormationList .jinpoStatSortButton.jinpoPriorityActive{outline:1px solid var(--jinpo-glow) !important;outline-offset:1px !important}
      #dbFormationList .dbPlacementMini>span.jinpoGrade3HeroName{display:inline-block !important;border:2px solid #3f9cff !important;border-radius:7px !important;background:linear-gradient(180deg,rgba(22,78,154,.34),rgba(9,32,62,.28)) !important;box-shadow:0 0 12px rgba(63,156,255,.42),inset 0 0 8px rgba(255,255,255,.08) !important;outline:1px solid rgba(63,156,255,.82) !important;outline-offset:0;color:#eef7ff !important;}
      #dbFormationList .dbPlacementMini>span.factor4BunkyokuGlow{color:#ff0000 !important;font-weight:1000 !important;text-shadow:0 0 1px rgba(255,255,255,.52),0 0 12px rgba(255,0,0,1),0 0 22px rgba(255,20,20,1),0 0 36px rgba(255,70,70,.95) !important;filter:brightness(1.12) saturate(1.2) !important;}
      #dbFormationList .dbPlacementMini>span.jinpoGrade3HeroName.factor4BunkyokuGlow{border-color:#5db0ff !important;box-shadow:0 0 14px rgba(63,156,255,.46),0 0 24px rgba(255,24,24,.35),inset 0 0 8px rgba(255,255,255,.10) !important;}
      #dbFormationList .dbMainRow.jinpoAppliedRow>td,#dbFormationList .dbStatRow.jinpoAppliedRow>td{background:linear-gradient(90deg,rgba(82,160,190,.26),rgba(32,88,118,.22)) !important;border-top-color:rgba(145,225,255,.92) !important;border-bottom-color:rgba(145,225,255,.92) !important;box-shadow:inset 0 0 16px rgba(145,225,255,.18) !important}
      #dbFormationList .dbMainRow.jinpoAppliedRow>td:first-child,#dbFormationList .dbStatRow.jinpoAppliedRow>td:first-child{border-left-color:#91e1ff !important}
      #dbFormationList .dbMainRow.jinpoAppliedRow>td:last-child,#dbFormationList .dbStatRow.jinpoAppliedRow>td:last-child{border-right-color:#91e1ff !important}
      #dbFormationList .dbMainRow.jinpoAppliedRow .applyBtn{background:linear-gradient(#66b9d7,#2f7795) !important;border-color:#a9e8ff !important;color:#f3fcff !important;box-shadow:0 0 16px rgba(145,225,255,.52) !important}
      @media(max-width:900px){.dbPriorityControls.dbPriorityButtonMode{grid-template-columns:460px 460px !important}.jinpoPrioritySortNotice{font-size:14px !important;padding:4px 7px !important}#jinpoResultSummary{grid-template-columns:1fr 1fr !important}.jinpoResultSummaryValue{font-size:23px !important}}
    `;document.head.appendChild(st);
  }

  function syncSwapStaleNotice(){
    var el=q('jinpoSwapStaleNotice');
    if(!el)return;
    el.hidden=!resultsStaleBySwap;
    el.style.display=resultsStaleBySwap?'block':'none';
  }
  function setSwapStale(flag){resultsStaleBySwap=!!flag;syncSwapStaleNotice();}
  function currentPlacementKey(){
    try{
      var p=(typeof placement!=='undefined'&&placement)?placement:window.placement;
      if(!p)return'';
      var ids=[];
      for(var i=1;i<=6;i++)ids.push(String((p[i]&&(p[i].internal_id||p[i].id||p[i]['番号']||p[i]['英傑名']||p[i].name))||'').trim());
      return ids.join('|');
    }catch(e){return'';}
  }

  function statModeLabel(){return searchStatMode==='fullmax'?'全MAX込み':'基礎値';}
  function syncSearchStatModeUi(){
    document.querySelectorAll('[data-search-stat-mode]').forEach(function(btn){var on=String(btn.getAttribute('data-search-stat-mode')||'base')===searchStatMode;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');});
    var box=q('jinpoSearchStatMode');if(box)box.dataset.mode=searchStatMode;
  }
  function ensureSearchStatModeUi(){
    if(q('jinpoSearchStatMode')){syncSearchStatModeUi();return;}
    var priorities=document.querySelector('.dbPriorityControls');if(!priorities||!priorities.parentNode)return;
    var wrap=document.createElement('div');wrap.id='jinpoSearchStatMode';wrap.className='jinpoSearchStatMode';wrap.dataset.mode=searchStatMode;
    wrap.innerHTML='<span class="jinpoSearchStatModeLabel">検索基準</span>'
      +'<button type="button" class="jinpoSearchStatModeBtn" data-search-stat-mode="base" aria-pressed="true">基礎値</button>'
      +'<button type="button" class="jinpoSearchStatModeBtn" data-search-stat-mode="fullmax" aria-pressed="false">全MAX込み</button>'
      +'<span class="jinpoSearchStatModeNote">全MAX込み＝転生MAX（文曲使用英傑を除く）＋見聞録MAX＋鬼神石MAXで検索順位・数値条件を判定</span>';
    priorities.parentNode.insertBefore(wrap,priorities);syncSearchStatModeUi();
  }
  function ensureEnhancementUi(){
    ensureUiStyle();ensureSearchStatModeUi();
    document.querySelectorAll('.dbPriorityButtonGroup[data-priority-index="1"],.dbPriorityButtonGroup[data-priority-index="2"]').forEach(function(group){
      var idx=group.getAttribute('data-priority-index')||'';
      var rowId='jinpoPriorityTitleRow'+idx,noteId='jinpoPrioritySortNotice'+idx;
      if(!q(rowId)){
        var label=group.querySelector(':scope > label');
        if(label){
          var titleRow=document.createElement('div');titleRow.id=rowId;titleRow.className='jinpoPriorityTitleRow';
          group.insertBefore(titleRow,label);titleRow.appendChild(label);
          var note=document.createElement('span');note.id=noteId;note.className='jinpoPrioritySortNotice';note.textContent='ステータスのみ選択時は高い順で表示します';titleRow.appendChild(note);
        }
      }
    });
    var box=q('dbFormationList');
    if(box&&!q('jinpoResultSummary')){
      var summary=document.createElement('div');summary.id='jinpoResultSummary';summary.setAttribute('aria-live','polite');summary.innerHTML='<div class="jinpoResultSummaryItem"><span class="jinpoResultSummaryLabel">検索結果</span><strong id="jinpoResultHitValue" class="jinpoResultSummaryValue">—</strong><span id="jinpoResultHitSuffix" class="jinpoResultSummarySuffix">件 HIT</span></div><div class="jinpoResultSummaryItem"><span class="jinpoResultSummaryLabel">一覧表示</span><strong id="jinpoResultShownValue" class="jinpoResultSummaryValue">—</strong><span id="jinpoResultShownSuffix" class="jinpoResultSummarySuffix">件</span></div>';
      var hint=document.createElement('div');hint.id='jinpoResultSortHint';hint.textContent='検索結果は各ステータスで並べ替えできます';
      var hintSub=document.createElement('div');hintSub.id='jinpoResultSortHintSub';hintSub.innerHTML='<span class="jinpoResultSortHintBlue" aria-hidden="true"></span><span class="jinpoResultSortHintGrade3">＝等級3以下</span>　/　<span class="jinpoResultSortHintRed">赤文字＝文曲</span>';
      box.parentNode.insertBefore(summary,box);box.parentNode.insertBefore(hint,box);box.parentNode.insertBefore(hintSub,box);
    }
    if(box&&!q('jinpoSwapStaleNotice')){
      var stale=document.createElement('div');stale.id='jinpoSwapStaleNotice';stale.setAttribute('aria-live','polite');stale.textContent='※差替後も検索結果一覧は差替前の検索結果です';stale.hidden=true;stale.style.display='none';
      box.parentNode.insertBefore(stale,box);
    }
    syncSwapStaleNotice();
  }

  function hitValueText(hit){hit=Math.max(0,Number(hit)||0);return hit>=HIT_CAP?'10万':hit.toLocaleString();}
  function hitStatusText(hit,complete){hit=Math.max(0,Number(hit)||0);if(hit>=HIT_CAP)return '10万件以上';return hit.toLocaleString()+(complete===false?'件以上':'件');}
  function setSummary(hit,shown,complete){
    ensureEnhancementUi();hit=Math.max(0,Number(hit)||0);shown=Math.max(0,Number(shown)||0);if(complete===undefined)complete=true;
    var h=q('jinpoResultHitValue'),hs=q('jinpoResultHitSuffix'),s=q('jinpoResultShownValue'),x=q('jinpoResultShownSuffix');
    if(h)h.textContent=hitValueText(hit);if(hs)hs.textContent=(hit>=HIT_CAP||complete===false)?'件以上 HIT':'件 HIT';if(s)s.textContent=shown.toLocaleString();
    if(x){if(complete===false||hit>=HIT_CAP||hit>shown)x.textContent='件（上位最大500件）';else x.textContent='件（すべて表示）';}
  }
  function setSummarySearching(){ensureEnhancementUi();var h=q('jinpoResultHitValue'),hs=q('jinpoResultHitSuffix'),s=q('jinpoResultShownValue'),x=q('jinpoResultShownSuffix');if(h)h.textContent='検索中';if(hs)hs.textContent='';if(s)s.textContent='—';if(x)x.textContent='件';}
  function cancelHitCountWorker(){try{if(hitCountWorker){hitCountWorker.terminate();hitCountWorker=null;}}catch(e){}hitCountSeq++;}
  function startBond56HitCount(query,myToken,shown,onResolved){
    cancelHitCountWorker();var localSeq=hitCountSeq,localWorker=new Worker('jinpo-bond56-worker.js');hitCountWorker=localWorker;
    localWorker.onmessage=function(ev){var m=ev.data||{};if(m.type==='progress')return;if(localWorker!==hitCountWorker||localSeq!==hitCountSeq){try{localWorker.terminate();}catch(e){}return;}if(m.type==='done'&&myToken===activeToken&&!window.__jinpoSearchCancelRequested){var r=m.result||{},hit=Math.max(0,Number(r.matched)||0),complete=r.matchedComplete!==false;setSummary(hit,shown,complete);if(typeof onResolved==='function')onResolved(hit,complete);}try{localWorker.terminate();}catch(e){}if(hitCountWorker===localWorker)hitCountWorker=null;};
    localWorker.onerror=function(){try{localWorker.terminate();}catch(e){}if(hitCountWorker===localWorker)hitCountWorker=null;};
    var cq=Object.assign({},query,{hitCap:HIT_CAP});localWorker.postMessage({type:'countHits',token:localSeq,query:cq});
  }

  function bindWorker(w){w.onmessage=function(ev){var m=ev.data||{},p=pending.get(m.token);if(!p)return;if(m.type==='progress'){if(p.showProgress&&m.token===activeWorkerToken&&!window.__jinpoSearchCancelRequested)showProgress(m.message||'検索DB読込中',m.bytes||0);return;}pending.delete(m.token);if(m.type==='error')p.reject(new Error(m.message||'統一検索エラー'));else p.resolve(m.result||{});};return w;}
  function workerObj(mode){if(mode==='bond56'){if(bond56Worker)return bond56Worker;bond56Worker=bindWorker(new Worker('jinpo-bond56-worker.js'));return bond56Worker;}if(worker)return worker;worker=bindWorker(new Worker('jinpo-fast-search-worker.js'));return worker;}
  function requestWorker(type,query,show){var t=++seq;if(show)activeWorkerToken=t;var mode=query&&query.mode==='bond56'?'bond56':'normal';return new Promise(function(resolve,reject){pending.set(t,{resolve:resolve,reject:reject,showProgress:!!show});workerObj(mode).postMessage({type:type,token:t,query:query});});}
  function cancelWorkerRequests(){
    try{if(worker){worker.terminate();worker=null;}if(bond56Worker){bond56Worker.terminate();bond56Worker=null;}}catch(e){}cancelHitCountWorker();
    var err=new Error('検索を中止しました。');err.jinpoCancelled=true;foregroundEpoch++;
    var queued=foregroundQueued;foregroundQueued=null;if(queued){if(inFlightSearches.get(queued.key)===queued.promise)inFlightSearches.delete(queued.key);try{queued.reject(err);}catch(e){}}
    foregroundRunning=null;pending.forEach(function(p){try{p.reject(err);}catch(e){}});pending.clear();inFlightSearches.clear();manifestProbePromise=null;activeWorkerToken=0;
  }
  function popularOn(){try{return !!(document.body&&document.body.classList.contains('jinpo-selected-grade3-mode'));}catch(e){return false;}}
  function unifiedDbMode(){return bond56On()?'bond56':(popularOn()?'popular':(gradeOn()?'grade3':'normal'));}
  function sourceFor(mode,rs,own,ex,sumCfg){
    if(mode==='popular')return{type:'full',sortStat:''};
    if(searchStatMode==='fullmax')return{type:'full',sortStat:''};
    var th=hasThreshold(rs),f4=selectedExclude>0;
    if(own.length||ex.length||th||f4)return{type:'full',sortStat:''};
    if(sumCfg&&sumCfg.enabled)return{type:'full',sortStat:''};
    if(mode==='normal'&&rs.length===1)return{type:'sort',sortStat:String(rs[0].stat||'')};
    if(rs.length)return{type:'full',sortStat:''};
    return{type:'top',sortStat:''};
  }
  function keyFor(x){var ss=x.sumSort||{};return JSON.stringify([x.mode,x.statMode||'base',x.count,x.formation,x.sourceType,x.sortStat,x.ownedInternalIds,x.ownedNames,x.excludedInternalIds,x.rules.map(function(r){return[r.stat,r.threshold,r.maxThreshold];}),x.factor4Max,!!ss.enabled,ss.stat1||'',ss.stat2||'',ss.tiePrefer||'first',x.limit]);}
  function rememberQueryResult(k,r){
    var generation=String(r&&r.manifestVersion||'');
    if(generation&&knownManifestGeneration&&generation!==knownManifestGeneration)queryCache.clear();
    if(generation)knownManifestGeneration=generation;
    var entry={result:r,generation:generation,validatedAt:Date.now()};
    if(queryCache.has(k))queryCache.delete(k);queryCache.set(k,entry);if(queryCache.size>20)queryCache.delete(queryCache.keys().next().value);return r;
  }
  function cachedResultCopy(entry){var r=entry&&entry.result?entry.result:{};return Object.assign({queryCached:true},r);}
  function probeManifestGeneration(){
    if(manifestProbePromise)return manifestProbePromise;
    manifestProbePromise=requestWorker('manifestVersion',{},false).then(function(r){
      var version=String(r&&r.version||'');
      if(version&&knownManifestGeneration&&version!==knownManifestGeneration)queryCache.clear();
      if(version)knownManifestGeneration=version;
      return version;
    }).finally(function(){manifestProbePromise=null;});
    return manifestProbePromise;
  }
  function getValidatedCachedResult(k){
    var entry=queryCache.get(k);if(!entry)return Promise.resolve(null);
    if(knownManifestGeneration&&entry.generation&&entry.generation!==knownManifestGeneration){queryCache.clear();return Promise.resolve(null);}
    var now=Date.now();if(now-Number(entry.validatedAt||0)<QUERY_CACHE_GENERATION_RECHECK_MS){queryCache.delete(k);queryCache.set(k,entry);return Promise.resolve(cachedResultCopy(entry));}
    // 実検索とmanifest強制再取得を同時に走らせない。DB世代切替中の結果ラベル競合を避ける。
    if(foregroundRunning)return Promise.resolve(null);
    return probeManifestGeneration().then(function(version){
      var current=queryCache.get(k);if(current!==entry)return null;
      if(version&&entry.generation&&version===entry.generation){entry.validatedAt=Date.now();queryCache.delete(k);queryCache.set(k,entry);return cachedResultCopy(entry);}
      queryCache.clear();return null;
    });
  }
  function supersededSearchError(){var err=new Error('新しい検索条件を優先しました。');err.jinpoSuperseded=true;return err;}
  function finishForeground(entry,epoch){
    if(inFlightSearches.get(entry.key)===entry.promise)inFlightSearches.delete(entry.key);if(foregroundRunning===entry)foregroundRunning=null;if(epoch!==foregroundEpoch)return;
    var next=foregroundQueued;foregroundQueued=null;if(next)startForeground(next);
  }
  function startForeground(entry){
    var epoch=foregroundEpoch;foregroundRunning=entry;
    requestWorker(entry.type,entry.query,true).then(function(r){try{entry.resolve(rememberQueryResult(entry.key,r));}catch(err){entry.reject(err);}},function(err){entry.reject(err);}).then(function(){finishForeground(entry,epoch);},function(){finishForeground(entry,epoch);});
  }
  function enqueueSharedSearch(k,type,query){
    var running=inFlightSearches.get(k);if(running)return running;
    var resolveEntry,rejectEntry,promise=new Promise(function(resolve,reject){resolveEntry=resolve;rejectEntry=reject;}),entry={key:k,type:type,query:query,promise:null,resolve:resolveEntry,reject:rejectEntry};entry.promise=promise;inFlightSearches.set(k,promise);
    if(!foregroundRunning)startForeground(entry);else{if(foregroundQueued){var old=foregroundQueued;foregroundQueued=null;if(inFlightSearches.get(old.key)===old.promise)inFlightSearches.delete(old.key);old.reject(supersededSearchError());}foregroundQueued=entry;}
    return promise;
  }
  function sharedSearchRequest(k,type,query){
    var running=inFlightSearches.get(k);if(running)return running;
    return getValidatedCachedResult(k).then(function(cached){if(cached)return cached;var current=inFlightSearches.get(k);if(current)return current;return enqueueSharedSearch(k,type,query);});
  }
  function search(query){
    if(query&&query.mode==='bond56')return requestWorker('search',query,true);
    return sharedSearchRequest(keyFor(query),'search',query);
  }
  function recommendKeyFor(x){
    return 'recommend|'+JSON.stringify([x.mode,x.statMode||'base',x.targetStat,x.secondaryStat||'',x.ownedInternalIds,x.ownedNames,x.excludedInternalIds,(x.rules||[]).map(function(r){return[r.stat,r.threshold,r.maxThreshold];}),x.factor4Max,x.limit]);
  }
  function searchRecommended(query){
    return sharedSearchRequest(recommendKeyFor(query),'recommend',query);
  }
  function lookupExactState(opts){
    opts=opts||{};var c=Number(opts.count||0),f=String(opts.formation||form()||''),mode=opts.mode||unifiedDbMode(),statMode=String(opts.statMode||searchStatMode||'base')==='fullmax'?'fullmax':'base';
    var heroInternalIds=Array.isArray(opts.heroInternalIds)?opts.heroInternalIds:[],bondNames=Array.isArray(opts.bondNames)?opts.bondNames:[];
    if(c<5||c>9||!f||heroInternalIds.length!==6||bondNames.length!==c)return Promise.resolve({row:null,matched:0,reason:'invalid_lookup_state'});
    return requestWorker('lookupExact',{mode:mode,count:c,formation:f,statMode:statMode,heroInternalIds:heroInternalIds,bondNames:bondNames},false);
  }

  function members(row){return String(row&&row.eiketsu_names||row&&row.eiketsu_ids||'').split('|').filter(Boolean);}
  function bonds(row){return String(row&&row.bond_names||row&&row.bond_ids||'').split('|').filter(Boolean);}
  function stableRowKey(row){
    /* 適用中は「選択した検索結果1行」だけを示す。
       同じ6英傑でもslot順が違えば別編成なので、6人をsortして同一視しない。 */
    var rid=String(row&&(row.result_id||row.id)||'').trim();
    if(rid) return 'rid:'+rid;
    var internal=String(row&&row.eiketsu_internal_ids||'').split('|').map(function(x){return x.trim();}).filter(Boolean);
    var mem=internal.length===6?internal:members(row).map(norm),bd=bonds(row).map(norm).sort();
    return [String(row&&row.formation||''),String(row&&row.bond_count||''),mem.join('|'),bd.join('|')].join('\u001f');
  }
  function sortValue(row,key){
    if(row&&row.search_stat_mode==='fullmax'){
      if(key==='総合値')return Number(row.fullmax_total)||0;
      if(row.fullmax_stats&&row.fullmax_stats[key]!=null)return Number(row.fullmax_stats[key])||0;
    }
    if(key==='総合値')return Number(row&&((row.total_score!=null)?row.total_score:row['総合値']))||0;
    return Number(row&&row[key])||0;
  }
  function selectedPriorityStats(){
    var out=[];
    [1,2].forEach(function(i){
      var el=q('dbPriorityStat'+i),stat=String(el&&el.value||'').trim();
      if(stat&&out.indexOf(stat)<0)out.push(stat);
    });
    return out;
  }
  function syncPriorityStatHighlights(){
    var box=q('dbFormationList');if(!box)return;
    var selected=selectedPriorityStats();
    Array.prototype.forEach.call(box.querySelectorAll('[data-list-sort]'),function(el){
      el.classList.toggle('jinpoPriorityActive',selected.indexOf(String(el.getAttribute('data-list-sort')||''))>=0);
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-stat-key]'),function(el){
      el.classList.toggle('jinpoPriorityActive',selected.indexOf(String(el.getAttribute('data-stat-key')||''))>=0);
    });
    try{window.dispatchEvent(new CustomEvent('jinpo:priority-highlight-sync',{detail:{stats:selected.slice()}}));}catch(e){}
  }
  function sortedRows(rows){
    var copy=(rows||[]).map(function(row,i){return {row:row,i:i};});if(!listSort.key)return copy.map(function(x){return x.row;});
    var dir=listSort.dir==='asc'?1:-1,key=listSort.key;
    copy.sort(function(a,b){var av=sortValue(a.row,key),bv=sortValue(b.row,key);if(av!==bv)return (av-bv)*dir;return a.i-b.i;});
    return copy.map(function(x){return x.row;});
  }
  function sortFieldHtml(){
    return DISPLAY_FIELDS.map(function(f){var active=listSort.key===f.key,arrow=active?(listSort.dir==='asc'?'▲':'▼'):'↕';return '<button type="button" class="jinpoStatSortButton jinpoStat-'+f.cls+(active?' jinpoSortActive':'')+'" data-list-sort="'+esc(f.key)+'" title="'+esc(f.label)+'で並べ替え">'+esc(f.label)+' '+arrow+'</button>';}).join('');
  }
  function statGridHtml(row){
    return DISPLAY_FIELDS.map(function(f){var active=listSort.key===f.key,v=sortValue(row,f.key);return '<span class="jinpoStatCell jinpoStat-'+f.cls+(active?' jinpoSortActive':'')+'" data-stat-key="'+esc(f.key)+'"><span class="jinpoStatCellName">'+esc(f.label)+(f.key==='総合値'?' ':':')+'</span><span class="jinpoStatCellValue">'+esc(v)+'</span><span class="jinpoCompatSep"> / </span></span>';}).join('');
  }
  function table(rows,count){
    return '<table class="dbListTable dbListTwoRow"><thead><tr><th>適用</th><th>因縁数</th><th>陣形</th><th>英傑</th><th>因縁</th></tr><tr class="dbStatSortHeaderRow"><th colspan="5"><div class="jinpoStatGrid">'+sortFieldHtml()+'</div></th></tr></thead><tbody>'+rows.map(function(row,idx){var mem=members(row),bd=bonds(row),internalIds=String(row&&row.eiketsu_internal_ids||'').split('|'),isApplied=!!appliedListRowKey&&stableRowKey(row)===appliedListRowKey,appliedClass=isApplied?' jinpoAppliedRow':'';return '<tr class="dbMainRow'+appliedClass+'"><td><button class="applyBtn" data-unified-db-idx="'+idx+'" type="button">'+(isApplied?'適用中':'適用')+'</button></td><td>'+esc(row.bond_count||count)+'</td><td>'+esc(row.formation||'')+'</td><td><div class="dbPlacementMini">'+mem.map(function(m,i){var iid=String(internalIds[i]||'').trim(),grade3Class=isGrade3InternalId(iid)?' class="jinpoGrade3HeroName"':'';return '<span'+grade3Class+' data-hero-internal-id="'+esc(iid)+'">'+esc(i+1)+'. '+esc(m)+'</span>';}).join('')+'</div></td><td class="dbListBondsCell"><div class="dbListBonds">'+bd.map(function(b){return '<span class="badge">'+esc(b)+'</span>';}).join('')+'</div></td></tr><tr class="dbStatRow'+appliedClass+'"><td colspan="5"><span class="dbListStat jinpoStatGrid">'+statGridHtml(row)+'</span></td></tr>';}).join('')+'</tbody></table>';
  }
  function rerenderList(count){var box=q('dbFormationList');if(!box)return;displayRows=sortedRows(activeRows);box.innerHTML=displayRows.length?table(displayRows,count||selectedCount()):'<div class="dbListNote">該当DBなし。陣形・配置英傑・除外英傑・優先条件・文曲除外人数を確認してください。</div>';syncPriorityStatHighlights();try{if(typeof window.__jinpoDecorateDbSearchRows==='function')window.__jinpoDecorateDbSearchRows(displayRows);}catch(e){console.error('検索結果文曲直接表示失敗',e);}try{if(typeof window.applyFactor4BunkyokuGlow==='function')setTimeout(window.applyFactor4BunkyokuGlow,0);}catch(e){}}
  function markAppliedRowVisual(btn){
    var box=q('dbFormationList');if(!box||!btn)return;
    var oldMain=box.querySelector('tr.dbMainRow.jinpoAppliedRow'),oldStat=box.querySelector('tr.dbStatRow.jinpoAppliedRow');
    if(oldMain){oldMain.classList.remove('jinpoAppliedRow');var oldBtn=oldMain.querySelector('.applyBtn');if(oldBtn)oldBtn.textContent='適用';}
    if(oldStat)oldStat.classList.remove('jinpoAppliedRow');
    var main=btn.closest&&btn.closest('tr.dbMainRow');if(!main)return;
    main.classList.add('jinpoAppliedRow');btn.textContent='適用中';
    var stat=main.nextElementSibling;if(stat&&stat.classList&&stat.classList.contains('dbStatRow'))stat.classList.add('jinpoAppliedRow');
  }
  function scrollSearchResults(){
    try{
      if(typeof window.__jinpoScrollToRecommendSearchTopOnce==='function'){
        window.__jinpoScrollToRecommendSearchTopOnce('auto');
        return;
      }
    }catch(e){}
    var el=q('jinpoRecommendNav');
    if(!el)return;
    var top=Math.max(0,el.getBoundingClientRect().top+(window.pageYOffset||document.documentElement.scrollTop||0));
    var current=window.pageYOffset||document.documentElement.scrollTop||0;
    if(Math.abs(current-top)<=1)return;
    try{window.scrollTo({top:top,left:0,behavior:'auto'});}catch(e){try{window.scrollTo(0,top);}catch(ignore){}}
  }
  window.__jinpoScrollSearchResults=scrollSearchResults;

  function ensureCancelButton(){var panel=q('dbSearchProgress');if(!panel)return null;var btn=q('dbSearchProgressCancel');if(!btn){btn=document.createElement('button');btn.id='dbSearchProgressCancel';btn.type='button';btn.textContent='検索を中止する';panel.appendChild(btn);}return btn;}
  function showProgress(msg,bytes){var cb=ensureCancelButton();if(cb)cb.style.display='block';var p=q('dbSearchProgress');if(p){p.style.display='block';p.classList.add('active');}var t=q('dbSearchProgressTitle');if(t)t.innerHTML='<span class="dbSearchSpinner"></span>'+esc(msg||'検索中');var c=q('dbSearchProgressCount');if(c)c.textContent=bytes?((bytes/1024/1024).toFixed(1)+'MB'):'検索DB';var r=q('dbSearchProgressRemain');if(r)r.textContent='高速検索中';var b=q('dbSearchProgressBar');if(b){b.style.width='42%';if(b.parentElement)b.parentElement.classList.add('indeterminate');}}
  function hideProgress(){var cb=q('dbSearchProgressCancel');if(cb)cb.style.display='none';var p=q('dbSearchProgress');if(p){p.style.display='none';p.classList.remove('active');}var b=q('dbSearchProgressBar');if(b){b.style.width='0%';if(b.parentElement)b.parentElement.classList.remove('indeterminate');}}
  function updateGlobals(rows){try{window.resultDbRows=rows;resultDbRows=rows;if(typeof rebuildResultDbIndex==='function')rebuildResultDbIndex();}catch(e){try{window.resultDbRows=rows;}catch(_){}}}

  function applyRecommendedFormation(formation){
    formation=String(formation||'').trim();if(!formation)return;var sel=q('formationSelect');if(!sel||String(sel.value||'')===formation)return;
    var has=Array.prototype.some.call(sel.options||[],function(o){return String(o.value||'')===formation;});if(!has)return;
    recommendState.applyingFormation=true;
    try{sel.value=formation;sel.dispatchEvent(new Event('change',{bubbles:true}));}finally{recommendState.applyingFormation=false;}
  }
  function recommendRowBetterLocal(a,b,target,secondary){
    var av=sortValue(a,target),bv=sortValue(b,target);
    if(secondary){
      var asv=sortValue(a,secondary),bsv=sortValue(b,secondary),as=av+asv,bs=bv+bsv;
      if(as!==bs)return as>bs;if(av!==bv)return av>bv;if(asv!==bsv)return asv>bsv;
      var at=sortValue(a,'総合値'),bt=sortValue(b,'総合値');if(at!==bt)return at>bt;
    }else if(av!==bv)return av>bv;
    return String(a&&a.result_id||'')<String(b&&b.result_id||'');
  }
  function sortRecommendedRowsLocal(rows,target,secondary,limit){
    var out=(rows||[]).slice();out.sort(function(a,b){return recommendRowBetterLocal(a,b,target,secondary)?-1:(recommendRowBetterLocal(b,a,target,secondary)?1:0);});if(out.length>limit)out.length=limit;return out;
  }
  async function searchRecommendedBond56(baseQuery,target,secondary,runToken){
    var forms=['衡軛','鶴翼','魚鱗','方円'],bestForm='',bestRow=null;
    function buildQuery(formation,count,limit){
      return {mode:'bond56',statMode:baseQuery.statMode,count:count,formation:formation,ownedInternalIds:baseQuery.ownedInternalIds,excludedInternalIds:baseQuery.excludedInternalIds,rules:baseQuery.rules,priorityStats:secondary?[]:[target],sumSort:secondary?{enabled:true,stat1:target,stat2:secondary,tiePrefer:'first'}:{enabled:false,stat1:'',stat2:'',tiePrefer:'first'},factor4Max:baseQuery.factor4Max,limit:limit};
    }
    /* まず各陣形×5/6因縁を1件だけ探索し、最高値を持つ陣形を確定する。 */
    for(var fi=0;fi<forms.length;fi++){
      var formation=forms[fi],formBest=null;
      for(var count=5;count<=6;count++){
        if(window.__jinpoSearchCancelRequested||runToken!==activeToken)throw supersededSearchError();
        var probe=await requestWorker('search',buildQuery(formation,count,1),false);if(runToken!==activeToken)throw supersededSearchError();var row=probe&&Array.isArray(probe.rows)&&probe.rows.length?probe.rows[0]:null;
        if(row&&(!formBest||recommendRowBetterLocal(row,formBest,target,secondary)))formBest=row;
      }
      if(formBest&&(!bestRow||recommendRowBetterLocal(formBest,bestRow,target,secondary))){bestRow=formBest;bestForm=formation;}
    }
    if(!bestForm)return {formation:'',rows:[],matched:0,matchedComplete:true,sourceType:'bond56-recommend-dynamic',secondaryStat:secondary};
    /* 選ばれた陣形だけ5/6因縁のTop500を取得し、両方を同じ基準で統合する。 */
    var combined=[],matched=0,complete=true;
    for(var c=5;c<=6;c++){
      if(window.__jinpoSearchCancelRequested||runToken!==activeToken)throw supersededSearchError();
      var full=await requestWorker('search',buildQuery(bestForm,c,LIMIT),false);if(runToken!==activeToken)throw supersededSearchError();combined=combined.concat(Array.isArray(full&&full.rows)?full.rows:[]);matched+=Number(full&&full.matched||0);if(full&&full.matchedComplete===false)complete=false;
    }
    return {formation:bestForm,rows:sortRecommendedRowsLocal(combined,target,secondary,LIMIT),matched:matched,matchedComplete:complete,sourceType:'bond56-recommend-dynamic',secondaryStat:secondary};
  }

  async function renderRecommended(opts){
    opts=opts||{};var target=String(opts.targetStat||recommendState.targetStat||'').trim();if(!validRecommendStat(target))return false;
    /* おすすめ検索は開始時点の検索モードを固定して使う。
       優先ステータスUIのchangeイベント後にモードを再判定し、選抜人気が通常検索へ誤フォールバックする経路を残さない。 */
    var mode=unifiedDbMode();
    var targetChanged=!recommendState.active||String(recommendState.targetStat||'')!==target;
    ensureEnhancementUi();setSwapStale(false);
    recommendState.active=true;recommendState.targetStat=target;
    if(targetChanged){recommendState.secondaryStat='';recommendState.formation='';}
    prepareRecommendPriority(target,targetChanged);recommendState.secondaryStat=currentRecommendSecondary(target);syncRecommendUi();
    var secondary=recommendState.secondaryStat,myToken=++activeToken,box=q('dbFormationList'),status=q('dbListStatus');if(!box||!status)return true;listSort=secondary?{key:'',dir:'desc'}:{key:target,dir:'desc'};setCount(null);renderUnifiedCountButtons();
    var rs=rules(),ownIds=ownedInternalIds(),exIds=excludedInternalIds();var query={mode:mode,statMode:searchStatMode,targetStat:target,secondaryStat:secondary,ownedInternalIds:ownIds,excludedInternalIds:exIds,rules:rs,factor4Max:factor4Max(),limit:LIMIT};
    if(mode==='bond56')cancelWorkerRequests();
    window.__jinpoSearchCancelRequested=false;showProgress('おすすめ陣法を検索中');setSummarySearching();
    var loadingTarget=secondary?(recommendLabel(target)+'＋'+recommendLabel(secondary)):(recommendLabel(target));
    var loadingSub=(secondary?(loadingTarget+'の合計値が高い組み合わせを検索しています'):(loadingTarget+'が高い組み合わせを検索しています'))+'（'+statModeLabel()+'基準）';
    box.innerHTML='<div class="jinpoRecommendLoading" role="status" aria-live="polite"><span class="dbSearchSpinner" aria-hidden="true"></span><div class="jinpoRecommendLoadingTitle">おすすめ陣法を検索中…</div><div class="jinpoRecommendLoadingSub">'+esc(loadingSub)+'</div></div>';
    try{var r=mode==='bond56'?await searchRecommendedBond56(query,target,secondary,myToken):await searchRecommended(query);if(myToken!==activeToken||window.__jinpoSearchCancelRequested)return true;var formation=String(r&&r.formation||'').trim();recommendState.formation=formation;recommendState.secondaryStat=String(r&&r.secondaryStat||secondary||'');syncRecommendUi();if(formation)applyRecommendedFormation(formation);if(myToken!==activeToken||window.__jinpoSearchCancelRequested)return true;activeRows=Array.isArray(r&&r.rows)?r.rows:[];updateGlobals(activeRows);displayRows=sortedRows(activeRows);var gradeText=mode==='grade3'?' / 等級3以下のみ':(mode==='popular'?' / 選抜人気対象のみ':(mode==='bond56'?' / 5・6因縁のみ':'')),f4Text=selectedExclude>0?' / 文曲除外人数 '+selectedExclude:'',basisText=' / 検索基準 '+statModeLabel(),rankText=secondary?(recommendLabel(target)+'＋'+recommendLabel(secondary)+'の合計が高い順'):(recommendLabel(target)+'が高い順'),countText=mode==='bond56'?'5・6因縁のみ':'因縁数混在',matchedComplete=mode==='bond56'?r.matchedComplete!==false:true;if(formation){status.textContent='おすすめ陣法：'+(secondary?(recommendLabel(target)+'＋'+recommendLabel(secondary)+' 合計値'):recommendLabel(target))+' / '+formation+' / '+countText+' / 条件一致 '+hitStatusText(r.matched||0,matchedComplete)+' / '+rankText+' / 表示 '+activeRows.length.toLocaleString()+'件（最大'+LIMIT+'件）'+gradeText+f4Text+basisText;}else{status.textContent='おすすめ陣法：'+(secondary?(recommendLabel(target)+'＋'+recommendLabel(secondary)+' 合計値'):recommendLabel(target))+' / 条件に一致する組み合わせがありません。'+gradeText+f4Text+basisText;}setSummary(r.matched||0,activeRows.length,matchedComplete);rerenderList(null);scrollSearchResults();return true;
    }catch(err){
      if(myToken!==activeToken)return true;console.error('おすすめ陣法検索エラー',err);status.textContent='おすすめ陣法の検索中にエラーが発生しました。';setSummary(0,0);box.innerHTML='<div class="dbListNote">おすすめ陣法の検索処理でエラーが発生しました。コンソールを確認してください。</div>';return true;
    }finally{if(myToken===activeToken)hideProgress();}
  }

  async function renderCurrent(opts){
    opts=opts||{};
    if(recommendState.active&&!recommendState.applyingFormation&&!opts.forceNormal)return renderRecommended({targetStat:recommendState.targetStat});
    if(recommendState.applyingFormation)return true;
    ensureEnhancementUi();setSwapStale(false);var myToken=++activeToken,c=Number(opts.count||selectedCount()),f=form(),box=q('dbFormationList'),status=q('dbListStatus');if(!box||!status)return true;
    if(!opts.preserveListSort)listSort={key:'',dir:'desc'};
    if(c<5||c>9){hideProgress();activeRows=[];displayRows=[];updateGlobals([]);setSummary(0,0);return true;}setCount(c);
    if(!f){hideProgress();setCount(null);renderUnifiedCountButtons();activeRows=[];displayRows=[];updateGlobals([]);status.textContent='陣形を選択してください。';setSummary(0,0);box.innerHTML='<div class="dbListNote">陣形選択後、5〜9因縁ボタンで一覧を表示します。</div>';return true;}
    if(bond56On()&&(c!==5&&c!==6)){hideProgress();setCount(null);renderUnifiedCountButtons();activeRows=[];displayRows=[];updateGlobals([]);status.textContent='5・6因縁モードでは5因縁または6因縁を選択してください。';setSummary(0,0);box.innerHTML='<div class="dbListNote">5・6因縁モード中は7〜9因縁検索を利用できません。</div>';return true;}
    if(popularOn()&&c===5){hideProgress();setCount(null);renderUnifiedCountButtons();activeRows=[];displayRows=[];updateGlobals([]);status.textContent='選抜人気モードは6〜9因縁が検索対象です。';setSummary(0,0);box.innerHTML='<div class="dbListNote">選抜人気モードでは6因縁・7因縁・8因縁・9因縁を検索できます。</div>';return true;}
    if(!bond56On()&&!popularOn()&&(c===5||c===6)&&!gradeOn()){hideProgress();setCount(null);renderUnifiedCountButtons();activeRows=[];displayRows=[];updateGlobals([]);status.textContent='5・6因縁は「等級3以下 ON」の時だけ検索できます。';setSummary(0,0);box.innerHTML='<div class="dbListNote">5・6因縁を検索する場合は「等級3以下」をONにするか、独立した「5・6因縁モード」をONにしてください。</div>';return true;}
    var mode=unifiedDbMode(),rs=rules(),sumCfg=sumSortConfig(),ownIds=ownedInternalIds(),exIds=excludedInternalIds(),src=mode==='bond56'?{type:'dynamic',sortStat:''}:sourceFor(mode,rs,ownIds,exIds,sumCfg),query={mode:mode,statMode:searchStatMode,count:c,formation:f,sourceType:src.type,sortStat:src.sortStat,ownedInternalIds:ownIds,excludedInternalIds:exIds,rules:rs,sumSort:sumCfg,factor4Max:factor4Max(),limit:LIMIT};
    cancelHitCountWorker();window.__jinpoSearchCancelRequested=false;showProgress('検索DBで検索中');setSummarySearching();box.innerHTML='';
    function acceptResult(r){
      if(myToken!==activeToken||window.__jinpoSearchCancelRequested)return;
      activeRows=Array.isArray(r.rows)?r.rows:[];updateGlobals(activeRows);displayRows=sortedRows(activeRows);
      var gradeText=mode==='grade3'?' / 等級3以下のみ':(mode==='popular'?' / 選抜人気対象のみ':(mode==='bond56'?' / 全等級 5・6因縁モード':'')),f4Text=selectedExclude>0?' / 文曲除外人数 '+selectedExclude:'',basisText=' / 検索基準 '+statModeLabel(),sumText=sumCfg.enabled?(' / 合計ソート '+sumCfg.stat1+'＋'+sumCfg.stat2+' / 同値時 '+(sumCfg.tiePrefer==='second'?'第2優先':'第1優先')):'';
      var hit=Number(r.matched||0),complete=mode!=='bond56'||r.matchedComplete!==false;
      function drawStatus(resolvedHit,resolvedComplete){status.textContent=f+' / '+c+'因縁: '+(mode==='bond56'?'専用軽量検索':'高速検索DB')+' / 条件一致 '+hitStatusText(resolvedHit,resolvedComplete)+' / 表示 '+activeRows.length.toLocaleString()+'件（最大'+LIMIT+'件）'+gradeText+f4Text+basisText+sumText;}
      drawStatus(hit,complete);setSummary(hit,activeRows.length,complete);
      rerenderList(c);
      scrollSearchResults();
      if(mode==='bond56'&&!complete&&hit<HIT_CAP){startBond56HitCount(query,myToken,activeRows.length,function(exactHit,exactComplete){if(myToken===activeToken)drawStatus(exactHit,exactComplete);});}
    }
    try{
      var r=await search(query);
      if(myToken!==activeToken||window.__jinpoSearchCancelRequested)return true;acceptResult(r);return true;
    }catch(err){if(myToken!==activeToken)return true;console.error('統一コンパクト検索エラー',err);status.textContent='検索中にエラーが発生しました。';setSummary(0,0);box.innerHTML='<div class="dbListNote">検索処理でエラーが発生しました。コンソールを確認してください。</div>';return true;}finally{if(myToken===activeToken)hideProgress();}
  }

  function rerunForFormationChange(count){
    if(recommendState.applyingFormation)return Promise.resolve(true);
    var serial=++formationRerunSerial,c=Number(count||selectedCount()||0);
    if(c<5||c>9||!form())return Promise.resolve(true);
    setCount(c);
    // 同じ change にぶら下がる全同期処理が完了した後、新しい陣形で検索を1回だけ実行する。
    return Promise.resolve().then(function(){
      if(serial!==formationRerunSerial)return true;
      return renderCurrent({count:c,preserveListSort:true,forceNormal:true});
    });
  }

  function renderUnifiedCountButtons(){
    var box=q('dbCountButtons');if(!box)return;var c=recommendState.active?0:selectedCount(),g=gradeOn(),b56=bond56On(),popular=popularOn();
    if(popular&&c===5){setCount(null);c=0;}
    box.classList.add('dbCountButtonBar');
    var recommendLocked=!!recommendState.active;
    box.innerHTML=      [5,6,7,8,9].map(function(n){var popularLocked=popular&&n===5,locked=recommendLocked||(b56&&n>=7)||popularLocked;var title=recommendLocked?'おすすめ陣法使用中は通常の因縁数検索を利用できません':((b56&&n>=7)?'5・6因縁モード中は7〜9因縁検索を利用できません':(popularLocked?'選抜人気モードは6〜9因縁が検索対象です':''));return '<button class="dbCountBtn '+(c===n?'active':'')+(locked?' recommendModeLocked':'')+'" data-count="'+n+'" type="button"'+(locked?' disabled aria-disabled="true" title="'+title+'"':'')+'>'+n+'因縁</button>';}).join('')+
      '<div class="jinpoTenBondVisual"><img class="jinpoTenBondGuideImage" src="assets/jinpo-ten-bond-guide.png" alt="" aria-hidden="true" draggable="false"><button class="dbCountBtn jinpoTenBondPlaceholder'+(recommendLocked||b56?' recommendModeLocked':'')+'" type="button" disabled aria-disabled="true" title="10因縁は現在利用できません">10因縁</button></div>';
    box.style.setProperty('display','grid','important');box.style.setProperty('grid-template-columns','repeat(3, minmax(0, 1fr))','important');box.style.setProperty('grid-auto-rows','auto','important');box.style.setProperty('gap','10px','important');box.style.setProperty('width','420px','important');box.style.setProperty('min-width','420px','important');box.style.setProperty('max-width','420px','important');
    syncBond56Ui();syncBond56FormationGuide();
    Array.prototype.forEach.call(box.querySelectorAll('button'),function(btn){btn.style.setProperty('width','100%','important');btn.style.setProperty('min-width','0','important');btn.style.setProperty('height','52px','important');btn.style.setProperty('display','flex','important');btn.style.setProperty('align-items','center','important');btn.style.setProperty('justify-content','center','important');btn.style.setProperty('box-sizing','border-box','important');btn.style.setProperty('font-size','15px','important');btn.style.setProperty('white-space','nowrap','important');});
    try{if(typeof window.__jinpoSyncModeSelector==='function')window.__jinpoSyncModeSelector();}catch(e){}
  }
  function ensureFactor4Style(){if(q('jinpoFactor4FilterStyle'))return;var st=document.createElement('style');st.id='jinpoFactor4FilterStyle';st.textContent='.jinpoFactor4FilterRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 8px 0;max-width:100%;}.jinpoFactor4FilterRow .factor4BunkyokuLegend{margin:0 !important;flex:0 1 auto !important;}.jinpoFactor4FilterControl{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0;}.jinpoFactor4FilterLabel{font-size:12px;font-weight:900;color:#f0d7b0;white-space:nowrap;}.jinpoFactor4FilterBtn{min-width:34px;height:30px;padding:3px 8px;border:1px solid rgba(231,189,92,.65);border-radius:9px;background:linear-gradient(#3d2817,#181008);color:#f6e7c4;font-weight:900;cursor:pointer;}.jinpoFactor4FilterBtn:hover{filter:brightness(1.15);}.jinpoFactor4FilterBtn.active{border-color:#ff6868;background:linear-gradient(#6a1717,#2c0909);color:#fff0f0;box-shadow:0 0 8px rgba(255,68,68,.95),0 0 18px rgba(255,68,68,.6),inset 0 0 8px rgba(255,80,80,.25);}@media(max-width:760px){.jinpoFactor4FilterRow{gap:7px}.jinpoFactor4FilterControl{width:100%;}.jinpoFactor4FilterBtn{flex:1 1 34px;min-width:30px;padding:3px 5px}.jinpoFactor4FilterLabel{width:100%;}}';document.head.appendChild(st);}
  function syncFactor4(){document.querySelectorAll('.jinpoFactor4FilterBtn').forEach(function(btn){var on=Number(btn.getAttribute('data-factor4-exclude'))===selectedExclude;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');});}
  function ensureFactor4Controls(){ensureFactor4Style();var legend=q('factor4BunkyokuLegend');if(!legend)return false;if(q('jinpoFactor4FilterControl')){syncFactor4();return true;}var parent=legend.parentNode;if(!parent)return false;var row=document.createElement('div');row.className='jinpoFactor4FilterRow';row.id='jinpoFactor4FilterRow';parent.insertBefore(row,legend);row.appendChild(legend);var ctl=document.createElement('div');ctl.id='jinpoFactor4FilterControl';ctl.className='jinpoFactor4FilterControl';ctl.innerHTML='<span class="jinpoFactor4FilterLabel">文曲除外人数</span>'+[6,5,4,3,2,1,0].map(function(v){return '<button type="button" class="jinpoFactor4FilterBtn'+(v===selectedExclude?' active':'')+'" data-factor4-exclude="'+v+'" aria-pressed="'+(v===selectedExclude?'true':'false')+'">'+v+'</button>';}).join('');row.appendChild(ctl);return true;}

  function ensureBond56Style(){if(q('jinpoBond56ModeStyle'))return;var st=document.createElement('style');st.id='jinpoBond56ModeStyle';st.textContent=`
    body.jinpo-bond56-mode{background:#11220a!important;background:url("assets/jinpo-bond56-mode-bg.png") center top / cover no-repeat fixed!important;color:#faffea!important}
    body.jinpo-bond56-mode main,body.jinpo-bond56-mode header{background:transparent!important}
    body.jinpo-bond56-mode .card,body.jinpo-bond56-mode .formationMiniPanel,body.jinpo-bond56-mode .dbPriorityGroup,body.jinpo-bond56-mode #jinpoSumPrioritySort,body.jinpo-bond56-mode .jinpoSearchStatMode{background:linear-gradient(180deg,rgba(7,13,24,.96),rgba(3,4,10,.97))!important;border-color:rgba(0,240,255,.58)!important;box-shadow:0 0 16px rgba(0,239,255,.10),inset 0 0 18px rgba(255,40,210,.025)!important}
    body.jinpo-bond56-mode .card h2,body.jinpo-bond56-mode .card strong,body.jinpo-bond56-mode label,body.jinpo-bond56-mode .small,body.jinpo-bond56-mode .dbListNote{color:#dffcff!important}
    body.jinpo-bond56-mode select,body.jinpo-bond56-mode input,body.jinpo-bond56-mode textarea{background:#050914!important;color:#eaffff!important;border-color:#21dce8!important;box-shadow:inset 0 0 8px rgba(0,238,255,.08)!important}
    body.jinpo-bond56-mode button:not(:disabled):not(.jinpoModeChoiceBtn){border-color:#27e8f2!important;box-shadow:0 0 7px rgba(0,235,255,.18)!important}
    body.jinpo-bond56-mode #dbCountButtons .dbCountBtn.active,body.jinpo-bond56-mode .jinpoSearchStatModeBtn.active{border-color:#ff43d7!important;color:#fff!important;text-shadow:0 0 6px #ff43d7!important;box-shadow:0 0 10px rgba(255,45,214,.82),0 0 18px rgba(0,237,255,.32)!important}
    body.jinpo-bond56-mode #dbFormationList,body.jinpo-bond56-mode #dbListStatus,body.jinpo-bond56-mode #jinpoResultSummary{filter:saturate(1.12)}
    body.jinpo-bond56-mode .jinpoResultSummaryItem{border-color:rgba(0,240,255,.62)!important;background:rgba(3,8,16,.9)!important;box-shadow:0 0 10px rgba(0,239,255,.1)!important}
    body.jinpo-bond56-mode .jinpoResultSummaryValue{color:#62fbff!important;text-shadow:0 0 8px rgba(0,245,255,.65)!important}

  `;document.head.appendChild(st);}

  document.addEventListener('change',function(ev){
    var t=ev.target;if(!t)return;
    if(t.id==='dbPriorityStat1'||t.id==='dbPriorityStat2')Promise.resolve().then(syncPriorityStatHighlights);
  },true);
  document.addEventListener('change',function(ev){var t=ev.target;if(!t||t.id!=='formationSelect')return;Promise.resolve().then(syncBond56FormationGuide);},true);
  document.addEventListener('change',function(ev){if(!recommendState.active||recommendState.applyingFormation||recommendState.syncingPriority)return;var t=ev.target;if(!t)return;if(t.id==='formationSelect'){exitRecommendMode();return;}if(t.id==='dbPriorityStat1'){if(String(t.value||'')!==String(recommendState.targetStat||''))prepareRecommendPriority(recommendState.targetStat,false);return;}if(t.id==='dbPriorityStat2'||t.id==='dbPriorityValue1'||t.id==='dbPriorityValue2'||t.id==='dbPriorityMax1'||t.id==='dbPriorityMax2'){Promise.resolve().then(function(){if(recommendState.active&&!recommendState.syncingPriority)renderRecommended({targetStat:recommendState.targetStat});});}},true);

  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#dbCountButtons .dbCountBtn'):null;if(!b)return;var c=Number(b.getAttribute('data-count')||String(b.textContent||'').match(/[5-9]/)?.[0]||0);if(c<5||c>9)return;ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();if(recommendState.active||b.disabled)return;if(bond56On()&&c>6)return;if(popularOn()&&c===5)return;if(!bond56On())exitRecommendMode();setCount(c);renderUnifiedCountButtons();renderCurrent({count:c,forceNormal:true});},true);
  document.addEventListener('click',function(ev){
    var btn=ev.target&&ev.target.closest?ev.target.closest('button[data-search-stat-mode]'):null;if(!btn)return;
    var next=String(btn.getAttribute('data-search-stat-mode')||'base');if(next!=='fullmax')next='base';
    ev.preventDefault();if(next===searchStatMode){syncSearchStatModeUi();return;}
    searchStatMode=next;syncSearchStatModeUi();listSort={key:'',dir:'desc'};activeToken++;window.__jinpoSearchCancelRequested=true;cancelWorkerRequests();hideProgress();window.__jinpoSearchCancelRequested=false;
    if(recommendState.active)renderRecommended({targetStat:recommendState.targetStat});else{var c=selectedCount();if(c>=5&&c<=9)renderCurrent({count:c});}
  },true);
  document.addEventListener('click',function(ev){
    var sortBtn=ev.target&&ev.target.closest?ev.target.closest('button[data-list-sort]'):null;
    if(sortBtn){ev.preventDefault();var key=sortBtn.getAttribute('data-list-sort')||'';if(!key)return;if(listSort.key===key)listSort.dir=listSort.dir==='desc'?'asc':'desc';else listSort={key:key,dir:'desc'};rerenderList(selectedCount());return;}
    var fb=ev.target&&ev.target.closest?ev.target.closest('button[data-factor4-exclude]'):null;if(fb){ev.preventDefault();selectedExclude=Number(fb.getAttribute('data-factor4-exclude'))||0;syncFactor4();renderCurrent({count:selectedCount()});return;}
    var b=ev.target&&ev.target.closest?ev.target.closest('button[data-unified-db-idx]'):null;if(!b)return;var row=displayRows[Number(b.getAttribute('data-unified-db-idx'))];if(!row)return;ev.preventDefault();cancelHitCountWorker();appliedListRowKey=stableRowKey(row);markAppliedRowVisual(b);
    /* 適用クリックでは一覧500件を再生成しない。先に即時で上部へ1回だけ移動し、重い再計算は次フレームへ譲る。 */
    try{if(typeof window.__jinpoScrollToRecommendSearchTopOnce==='function')window.__jinpoScrollToRecommendSearchTopOnce('auto');}catch(e){}
    var applyNow=function(){try{if(typeof applyDbFormationRow==='function')applyDbFormationRow(row);}catch(e){console.error(e);}};
    /* スクロール位置を確定させた次フレームで軽量適用。余分な setTimeout を挟まない。 */
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(applyNow);else setTimeout(applyNow,0);
  },true);
  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#dbFilterResetBtn'):null;if(!b)return;selectedExclude=0;syncFactor4();},true);
  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#clearBtn'):null;if(!b)return;appliedListRowKey='';},true);
  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#dbSearchProgressCancel'):null;if(!b)return;ev.preventDefault();activeToken++;window.__jinpoSearchCancelRequested=true;cancelWorkerRequests();hideProgress();var st=q('dbListStatus'),box=q('dbFormationList');if(st)st.textContent='検索を中止しました。';setSummary(0,0);if(box)box.innerHTML='<div class="dbListNote">検索を中止しました。条件を選び直すと再検索できます。</div>';},true);


  function install(){ensureEnhancementUi();ensureFactor4Controls();ensureBond56Style();ensureCancelButton();syncBond56Ui();window.__jinpoUnifiedRenderCountButtons=renderUnifiedCountButtons;window.renderDbCountButtons=renderUnifiedCountButtons;try{renderDbCountButtons=renderUnifiedCountButtons;}catch(e){}renderUnifiedCountButtons();window.renderDbFormationList=function(){return renderCurrent({count:selectedCount()});};window.handleDbCountButtonClick=function(c){c=Number(c)||0;if(bond56On()&&c>6)return Promise.resolve(true);if(popularOn()&&c===5)return Promise.resolve(true);if(!bond56On())exitRecommendMode();setCount(c);renderUnifiedCountButtons();return renderCurrent({count:c,forceNormal:true});};try{renderDbFormationList=window.renderDbFormationList;handleDbCountButtonClick=window.handleDbCountButtonClick;}catch(e){}
    if(typeof window.applyReachSwapCandidate==='function'&&!window.applyReachSwapCandidate.__jinpoListAppliedStateClearWrapped){var prevReachApply=window.applyReachSwapCandidate;window.applyReachSwapCandidate=function(){
      appliedListRowKey='';
      var beforeKey=currentPlacementKey(),ret=prevReachApply.apply(this,arguments),afterKey=currentPlacementKey();
      if(afterKey&&afterKey!==beforeKey)setSwapStale(true);
      if(ret&&typeof ret.then==='function')ret.then(function(){var settledKey=currentPlacementKey();if(settledKey&&settledKey!==beforeKey)setSwapStale(true);},function(){});
      return ret;
    };window.applyReachSwapCandidate.__jinpoListAppliedStateClearWrapped=true;}
    window.JINPO_FACTOR4_FILTER={getSelected:function(){return selectedExclude;},getAllowedFactor4Users:function(){return 6-selectedExclude;},reset:function(){selectedExclude=0;syncFactor4();},render:function(){return renderCurrent({count:selectedCount()});},reloadIndex:function(){return Promise.resolve(true);}};
    window.JINPO_FAST_SEARCH={search:search,searchRecommended:searchRecommended,renderCurrent:renderCurrent,rerunForFormationChange:rerunForFormationChange,runRecommended:function(stat){return renderRecommended({targetStat:stat});},isBond56Mode:function(){return bond56On();},setBond56Mode:function(on){return setBond56Mode(on);},selectBond56Mode:function(on){return selectBond56Mode(on);},getSearchStatMode:function(){return searchStatMode;},setSearchStatMode:function(mode){mode=String(mode||'base');searchStatMode=mode==='fullmax'?'fullmax':'base';syncSearchStatModeUi();return searchStatMode;},isRecommendMode:function(){return !!recommendState.active;},getRecommendState:function(){return {active:!!recommendState.active,targetStat:String(recommendState.targetStat||''),secondaryStat:String(recommendState.secondaryStat||''),formation:String(recommendState.formation||'')};},exitRecommendMode:function(){exitRecommendMode();renderUnifiedCountButtons();return true;},lookupExactState:lookupExactState,cancelHitCount:function(){cancelHitCountWorker();return true;},clear:function(){queryCache.clear();cancelWorkerRequests();},resetAll:function(){
      activeToken++;window.__jinpoSearchCancelRequested=true;queryCache.clear();cancelWorkerRequests();hideProgress();
      exitRecommendMode();bond56Mode=false;document.body.classList.remove('jinpo-bond56-mode','jinpo-bond56-formation-unselected');selectedExclude=0;searchStatMode='base';syncSearchStatModeUi();listSort={key:'',dir:'desc'};appliedListRowKey='';setSwapStale(false);activeRows=[];displayRows=[];setCount(null);updateGlobals([]);syncFactor4();try{if(typeof window.__jinpoResetSumPrioritySort==='function')window.__jinpoResetSumPrioritySort(false);}catch(e){}renderUnifiedCountButtons();setSummary(0,0);
      var status=q('dbListStatus'),box=q('dbFormationList');if(status)status.textContent='陣形を選択してください。';if(box)box.innerHTML='<div class="dbListNote">陣形選択後、5〜9因縁ボタンで一覧を表示します。</div>';
      window.__jinpoSearchCancelRequested=false;return true;
    }};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){install();setTimeout(ensureFactor4Controls,0);},{once:true});else{install();setTimeout(ensureFactor4Controls,0);}
})();
