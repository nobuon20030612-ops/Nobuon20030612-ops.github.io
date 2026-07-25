(function(){
  'use strict';
  if(window.__jinpoUnifiedSearchInstalled)return;window.__jinpoUnifiedSearchInstalled=true;

  var LIMIT=500,worker=null,seq=0,activeToken=0,activeWorkerToken=0,pending=new Map(),activeRows=[],displayRows=[],queryCache=new Map(),selectedExclude=0;
  var listSort={key:'',dir:'desc'},appliedListRowKey='',resultsStaleBySwap=false;
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
  function norm(v){return String(v==null?'':v).trim().replace(/山中鹿之助/g,'山中鹿之介').replace(/・/g,'').replace(/[\s　]+/g,'');}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});}
  function selectedCount(){try{return Number(selectedDbListBondCount)||0;}catch(e){return Number(window.selectedDbListBondCount)||0;}}
  function setCount(c){try{selectedDbListBondCount=Number(c)||null;}catch(e){}window.selectedDbListBondCount=Number(c)||null;}
  function gradeOn(){try{return !!grade3Cost6OnlyEnabled;}catch(e){return !!window.grade3Cost6OnlyEnabled;}}
  function form(){var s=q('formationSelect'),t=String((s&&(s.value||(s.selectedOptions&&s.selectedOptions[0]&&s.selectedOptions[0].textContent)))||'');if(t.indexOf('衡軛')>=0)return'衡軛';if(t.indexOf('鶴翼')>=0)return'鶴翼';if(t.indexOf('魚鱗')>=0)return'魚鱗';if(t.indexOf('方円')>=0)return'方円';return'';}
  function owned(){try{return (typeof ownedHeroNames==='function'?ownedHeroNames():[]).map(norm).filter(Boolean);}catch(e){return[];}}
  function ownedInternalIds(){
    try{
      var a=(typeof ownedHeroFilterIds!=='undefined'&&Array.isArray(ownedHeroFilterIds))?ownedHeroFilterIds:(Array.isArray(window.ownedHeroFilterIds)?window.ownedHeroFilterIds:[]);
      return a.map(function(x){return String(x==null?'':x).trim();}).filter(Boolean);
    }catch(e){return[];}
  }
  function excluded(){try{return (typeof window.__jinpoGetExcludedHeroes==='function'?window.__jinpoGetExcludedHeroes():[]).map(norm).filter(Boolean);}catch(e){return[];}}
  function rules(){try{return ((typeof getDbPriorityRules==='function'?getDbPriorityRules():[])||[]).filter(function(r){return r&&r.stat;});}catch(e){return[];}}
  function hasThreshold(rs){return (rs||rules()).some(function(r){var n=Number(r&&r.threshold);return r&&r.threshold!==null&&r.threshold!==''&&Number.isFinite(n);});}
  function factor4Max(){return selectedExclude>0?6-selectedExclude:null;}

  function ensureUiStyle(){
    if(q('jinpoResultUiEnhanceStyle'))return;
    var st=document.createElement('style');st.id='jinpoResultUiEnhanceStyle';st.textContent=`
      .dbPriorityControls.dbPriorityButtonMode{grid-template-columns:repeat(2,minmax(0,1fr)) !important;align-items:stretch !important}
      .jinpoPriorityTitleRow{display:flex !important;align-items:center !important;justify-content:flex-start !important;gap:10px !important;min-width:0 !important;margin:0 0 8px 0 !important;white-space:nowrap !important}
      .jinpoPriorityTitleRow > label{display:block !important;flex:0 0 auto !important;margin:0 !important}
      .jinpoPrioritySortNotice{display:inline-flex;align-items:center;justify-content:center;flex:0 1 auto;min-width:0;box-sizing:border-box;margin:0;padding:4px 10px;border:2px solid #e7bd5c;border-radius:9px;background:linear-gradient(135deg,rgba(122,33,24,.92),rgba(45,27,10,.96));color:#fff1bd;font-size:16px;font-weight:950;line-height:1.25;letter-spacing:.02em;box-shadow:0 0 10px rgba(231,189,92,.30),inset 0 0 8px rgba(255,231,167,.08);white-space:nowrap}
      #jinpoResultSummary{display:grid;grid-template-columns:minmax(220px,1fr) minmax(220px,1fr);gap:10px;margin:10px 0 6px 0}
      .jinpoResultSummaryItem{display:flex;align-items:baseline;justify-content:center;gap:8px;min-height:50px;padding:7px 12px;box-sizing:border-box;border:1px solid rgba(231,189,92,.55);border-radius:11px;background:linear-gradient(180deg,rgba(48,30,14,.92),rgba(16,11,7,.95));box-shadow:0 0 13px rgba(231,189,92,.13)}
      .jinpoResultSummaryLabel{font-size:13px;font-weight:900;color:#d7c08d;white-space:nowrap}
      .jinpoResultSummaryValue{font-size:25px;font-weight:950;color:#fff0b8;line-height:1}
      .jinpoResultSummarySuffix{font-size:14px;font-weight:900;color:#f4ead2;white-space:nowrap}
      #jinpoResultSortHint{margin:6px 0 7px 0;padding:7px 10px;text-align:center;border:1px solid rgba(113,228,154,.45);border-radius:9px;background:rgba(35,74,46,.22);color:#dfffe7;font-size:15px;font-weight:900;letter-spacing:.01em}
      #jinpoSwapStaleNotice{margin:6px 0 7px 0;padding:7px 10px;text-align:center;border:1px solid rgba(231,189,92,.62);border-radius:9px;background:rgba(103,55,15,.28);color:#ffe1a1;font-size:15px;font-weight:900;letter-spacing:.01em}
      #dbFormationList .dbStatSortHeaderRow th{position:sticky !important;top:31px !important;z-index:3 !important;padding:3px 5px !important;background:#120d08 !important}
      #dbFormationList .jinpoStatGrid{display:grid !important;grid-template-columns:repeat(11,minmax(0,1fr)) !important;gap:3px !important;min-width:0 !important;width:100% !important;box-sizing:border-box !important}
      #dbFormationList .jinpoStatSortButton{appearance:none !important;width:100% !important;min-width:0 !important;height:30px !important;padding:3px 2px !important;margin:0 !important;border:1px solid rgba(255,255,255,.18) !important;border-radius:7px !important;background:#17110b !important;font-size:12px !important;font-weight:950 !important;line-height:1 !important;cursor:pointer !important;box-sizing:border-box !important;box-shadow:none !important;white-space:nowrap !important}
      #dbFormationList .jinpoStatSortButton:hover{filter:brightness(1.28) !important;transform:none !important}
      #dbFormationList .dbStatRow>td{padding:3px 5px !important;background:rgba(0,0,0,.15)}
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
      #dbFormationList .jinpoStatSortButton.jinpoSortActive,#dbFormationList .jinpoStatCell.jinpoSortActive{background:var(--jinpo-bg) !important;border-color:var(--jinpo-glow) !important;box-shadow:0 0 8px var(--jinpo-glow),inset 0 0 8px var(--jinpo-bg) !important}
      #dbFormationList .jinpoStatSortButton.jinpoSortActive{outline:1px solid var(--jinpo-glow) !important;outline-offset:1px !important}
      #dbFormationList .dbMainRow.jinpoAppliedRow>td,#dbFormationList .dbStatRow.jinpoAppliedRow>td{background:linear-gradient(90deg,rgba(41,98,58,.32),rgba(15,52,30,.26)) !important;border-top-color:rgba(113,228,154,.88) !important;border-bottom-color:rgba(113,228,154,.88) !important;box-shadow:inset 0 0 14px rgba(113,228,154,.16) !important}
      #dbFormationList .dbMainRow.jinpoAppliedRow>td:first-child,#dbFormationList .dbStatRow.jinpoAppliedRow>td:first-child{border-left-color:#71e49a !important}
      #dbFormationList .dbMainRow.jinpoAppliedRow>td:last-child,#dbFormationList .dbStatRow.jinpoAppliedRow>td:last-child{border-right-color:#71e49a !important}
      #dbFormationList .dbMainRow.jinpoAppliedRow .applyBtn{background:linear-gradient(#31521f,#17351f) !important;border-color:#71e49a !important;color:#ecffe1 !important;box-shadow:0 0 14px rgba(113,228,154,.50) !important}
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

  function ensureEnhancementUi(){
    ensureUiStyle();
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
      var summary=document.createElement('div');summary.id='jinpoResultSummary';summary.setAttribute('aria-live','polite');summary.innerHTML='<div class="jinpoResultSummaryItem"><span class="jinpoResultSummaryLabel">検索結果</span><strong id="jinpoResultHitValue" class="jinpoResultSummaryValue">—</strong><span class="jinpoResultSummarySuffix">件 HIT</span></div><div class="jinpoResultSummaryItem"><span class="jinpoResultSummaryLabel">一覧表示</span><strong id="jinpoResultShownValue" class="jinpoResultSummaryValue">—</strong><span id="jinpoResultShownSuffix" class="jinpoResultSummarySuffix">件</span></div>';
      var hint=document.createElement('div');hint.id='jinpoResultSortHint';hint.textContent='検索結果は各ステータスで並べ替えできます';
      box.parentNode.insertBefore(summary,box);box.parentNode.insertBefore(hint,box);
    }
    if(box&&!q('jinpoSwapStaleNotice')){
      var stale=document.createElement('div');stale.id='jinpoSwapStaleNotice';stale.setAttribute('aria-live','polite');stale.textContent='※差替後も検索結果一覧は差替前の検索結果です';stale.hidden=true;stale.style.display='none';
      box.parentNode.insertBefore(stale,box);
    }
    syncSwapStaleNotice();
  }

  function setSummary(hit,shown){
    ensureEnhancementUi();hit=Math.max(0,Number(hit)||0);shown=Math.max(0,Number(shown)||0);
    var h=q('jinpoResultHitValue'),s=q('jinpoResultShownValue'),x=q('jinpoResultShownSuffix');
    if(h)h.textContent=hit.toLocaleString();if(s)s.textContent=shown.toLocaleString();
    if(x){if(hit>shown)x.textContent='件（上位最大500件）';else x.textContent='件（すべて表示）';}
  }
  function setSummarySearching(){ensureEnhancementUi();var h=q('jinpoResultHitValue'),s=q('jinpoResultShownValue'),x=q('jinpoResultShownSuffix');if(h)h.textContent='検索中';if(s)s.textContent='—';if(x)x.textContent='件';}

  function workerObj(){
    if(worker)return worker;
    worker=new Worker('jinpo-fast-search-worker.js');
    worker.onmessage=function(ev){
      var m=ev.data||{},p=pending.get(m.token);if(!p)return;
      if(m.type==='progress'){if(p.showProgress&&m.token===activeWorkerToken&&!window.__jinpoSearchCancelRequested)showProgress(m.message||'検索DB読込中',m.bytes||0);return;}
      pending.delete(m.token);
      if(m.type==='error')p.reject(new Error(m.message||'統一検索エラー'));else p.resolve(m.result||{});
    };
    return worker;
  }
  function requestWorker(type,query,show){
    var t=++seq;if(show)activeWorkerToken=t;
    return new Promise(function(resolve,reject){pending.set(t,{resolve:resolve,reject:reject,showProgress:!!show});workerObj().postMessage({type:type,token:t,query:query});});
  }
  function cancelWorkerRequests(){
    try{if(worker){worker.terminate();worker=null;}}catch(e){}
    var err=new Error('検索を中止しました。');err.jinpoCancelled=true;
    pending.forEach(function(p){try{p.reject(err);}catch(e){}});pending.clear();activeWorkerToken=0;
  }
  function sourceFor(mode,rs,own,ex){var th=hasThreshold(rs),f4=selectedExclude>0;if(own.length||ex.length||th||f4)return{type:'full',sortStat:''};if(mode==='normal'&&rs.length===1)return{type:'sort',sortStat:String(rs[0].stat||'')};if(rs.length)return{type:'full',sortStat:''};return{type:'top',sortStat:''};}
  function keyFor(x){return JSON.stringify([x.mode,x.count,x.formation,x.sourceType,x.sortStat,x.ownedInternalIds,x.ownedNames,x.excludedNames,x.rules.map(function(r){return[r.stat,r.threshold];}),x.factor4Max,x.limit]);}
  function search(query){
    var k=keyFor(query);if(queryCache.has(k))return Promise.resolve(Object.assign({queryCached:true},queryCache.get(k)));
    return requestWorker('search',query,true).then(function(r){queryCache.set(k,r);if(queryCache.size>20)queryCache.delete(queryCache.keys().next().value);return r;});
  }
  function lookupExactState(opts){
    opts=opts||{};var c=Number(opts.count||0),f=String(opts.formation||form()||''),mode=opts.mode||(gradeOn()?'grade3':'normal');
    var heroInternalIds=Array.isArray(opts.heroInternalIds)?opts.heroInternalIds:[],bondNames=Array.isArray(opts.bondNames)?opts.bondNames:[];
    if(c<5||c>9||!f||heroInternalIds.length!==6||bondNames.length!==c)return Promise.resolve({row:null,matched:0,reason:'invalid_lookup_state'});
    return requestWorker('lookupExact',{mode:mode,count:c,formation:f,heroInternalIds:heroInternalIds,bondNames:bondNames},false);
  }

  function members(row){return String(row&&row.eiketsu_names||row&&row.eiketsu_ids||'').split('|').filter(Boolean);}
  function bonds(row){return String(row&&row.bond_names||row&&row.bond_ids||'').split('|').filter(Boolean);}
  function stableRowKey(row){
    var internal=String(row&&row.eiketsu_internal_ids||'').split('|').map(function(x){return x.trim();}).filter(Boolean).sort();
    var mem=internal.length===6?internal:members(row).map(norm).sort(),bd=bonds(row).map(norm).sort();
    return [String(row&&row.formation||''),String(row&&row.bond_count||''),mem.join('|'),bd.join('|')].join('\u001f');
  }
  function sortValue(row,key){if(key==='総合値')return Number(row&&((row.total_score!=null)?row.total_score:row['総合値']))||0;return Number(row&&row[key])||0;}
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
    return '<table class="dbListTable dbListTwoRow"><thead><tr><th>適用</th><th>因縁数</th><th>陣形</th><th>英傑</th><th>因縁</th></tr><tr class="dbStatSortHeaderRow"><th colspan="5"><div class="jinpoStatGrid">'+sortFieldHtml()+'</div></th></tr></thead><tbody>'+rows.map(function(row,idx){var mem=members(row),bd=bonds(row),internalIds=String(row&&row.eiketsu_internal_ids||'').split('|'),isApplied=!!appliedListRowKey&&stableRowKey(row)===appliedListRowKey,appliedClass=isApplied?' jinpoAppliedRow':'';return '<tr class="dbMainRow'+appliedClass+'"><td><button class="applyBtn" data-unified-db-idx="'+idx+'" type="button">'+(isApplied?'適用中':'適用')+'</button></td><td>'+esc(row.bond_count||count)+'</td><td>'+esc(row.formation||'')+'</td><td><div class="dbPlacementMini">'+mem.map(function(m,i){return '<span data-hero-internal-id="'+esc(internalIds[i]||'')+'">'+esc(i+1)+'. '+esc(m)+'</span>';}).join('')+'</div></td><td class="dbListBondsCell"><div class="dbListBonds">'+bd.map(function(b){return '<span class="badge">'+esc(b)+'</span>';}).join('')+'</div></td></tr><tr class="dbStatRow'+appliedClass+'"><td colspan="5"><span class="dbListStat jinpoStatGrid">'+statGridHtml(row)+'</span></td></tr>';}).join('')+'</tbody></table>';
  }
  function rerenderList(count){var box=q('dbFormationList');if(!box)return;displayRows=sortedRows(activeRows);box.innerHTML=displayRows.length?table(displayRows,count||selectedCount()):'<div class="dbListNote">該当DBなし。陣形・配置英傑・除外英傑・優先条件・文曲除外人数を確認してください。</div>';try{if(typeof window.applyFactor4BunkyokuGlow==='function')setTimeout(window.applyFactor4BunkyokuGlow,0);}catch(e){}}

  function ensureCancelButton(){var panel=q('dbSearchProgress');if(!panel)return null;var btn=q('dbSearchProgressCancel');if(!btn){btn=document.createElement('button');btn.id='dbSearchProgressCancel';btn.type='button';btn.textContent='検索を中止する';panel.appendChild(btn);}return btn;}
  function showProgress(msg,bytes){var cb=ensureCancelButton();if(cb)cb.style.display='block';var p=q('dbSearchProgress');if(p){p.style.display='block';p.classList.add('active');}var t=q('dbSearchProgressTitle');if(t)t.innerHTML='<span class="dbSearchSpinner"></span>'+esc(msg||'検索中');var c=q('dbSearchProgressCount');if(c)c.textContent=bytes?((bytes/1024/1024).toFixed(1)+'MB'):'検索DB';var r=q('dbSearchProgressRemain');if(r)r.textContent='高速検索中';var b=q('dbSearchProgressBar');if(b){b.style.width='42%';if(b.parentElement)b.parentElement.classList.add('indeterminate');}}
  function hideProgress(){var cb=q('dbSearchProgressCancel');if(cb)cb.style.display='none';var p=q('dbSearchProgress');if(p){p.style.display='none';p.classList.remove('active');}var b=q('dbSearchProgressBar');if(b){b.style.width='0%';if(b.parentElement)b.parentElement.classList.remove('indeterminate');}}
  function updateGlobals(rows){try{window.resultDbRows=rows;resultDbRows=rows;if(typeof rebuildResultDbIndex==='function')rebuildResultDbIndex();}catch(e){try{window.resultDbRows=rows;}catch(_){}}}

  async function renderCurrent(opts){
    ensureEnhancementUi();setSwapStale(false);opts=opts||{};var myToken=++activeToken,c=Number(opts.count||selectedCount()),f=form(),box=q('dbFormationList'),status=q('dbListStatus');if(!box||!status)return true;
    listSort={key:'',dir:'desc'};
    if(c<5||c>9){hideProgress();activeRows=[];displayRows=[];updateGlobals([]);setSummary(0,0);return true;}setCount(c);
    if(!f){hideProgress();setCount(null);renderUnifiedCountButtons();activeRows=[];displayRows=[];updateGlobals([]);status.textContent='陣形を選択してください。';setSummary(0,0);box.innerHTML='<div class="dbListNote">陣形選択後、5〜9因縁ボタンで一覧を表示します。</div>';return true;}
    if((c===5||c===6)&&!gradeOn()){hideProgress();setCount(null);renderUnifiedCountButtons();activeRows=[];displayRows=[];updateGlobals([]);status.textContent='5・6因縁は「等級3以下 ON」の時だけ検索できます。';setSummary(0,0);box.innerHTML='<div class="dbListNote">5・6因縁を検索する場合は「等級3以下」をONにしてください。</div>';return true;}
    var mode=gradeOn()?'grade3':'normal',rs=rules(),ownIds=ownedInternalIds(),own=owned(),ex=excluded(),src=sourceFor(mode,rs,ownIds.length?ownIds:own,ex),query={mode:mode,count:c,formation:f,sourceType:src.type,sortStat:src.sortStat,ownedInternalIds:ownIds,ownedNames:own,excludedNames:ex,rules:rs,factor4Max:factor4Max(),limit:LIMIT};
    window.__jinpoSearchCancelRequested=false;showProgress('検索DBで検索中');setSummarySearching();box.innerHTML='';
    function acceptResult(r){
      if(myToken!==activeToken||window.__jinpoSearchCancelRequested)return;
      activeRows=Array.isArray(r.rows)?r.rows:[];updateGlobals(activeRows);displayRows=sortedRows(activeRows);
      var gradeText=mode==='grade3'?' / 等級3以下のみ':'',f4Text=selectedExclude>0?' / 文曲除外人数 '+selectedExclude:'';
      status.textContent=f+' / '+c+'因縁: 高速検索DB / 条件一致 '+Number(r.matched||0).toLocaleString()+'件 / 表示 '+activeRows.length.toLocaleString()+'件（最大'+LIMIT+'件）'+gradeText+f4Text;
      setSummary(r.matched||0,activeRows.length);
      rerenderList(c);
    }
    try{
      var r=await search(query);
      if(myToken!==activeToken||window.__jinpoSearchCancelRequested)return true;acceptResult(r);return true;
    }catch(err){if(myToken!==activeToken)return true;console.error('統一コンパクト検索エラー',err);status.textContent='検索中にエラーが発生しました。';setSummary(0,0);box.innerHTML='<div class="dbListNote">検索処理でエラーが発生しました。コンソールを確認してください。</div>';return true;}finally{if(myToken===activeToken)hideProgress();}
  }

  function renderUnifiedCountButtons(){
    var box=q('dbCountButtons');if(!box)return;var c=selectedCount(),g=gradeOn();
    box.classList.add('dbCountButtonBar');
    box.innerHTML='<button class="dbGradeToggleBtn '+(g?'active':'')+'" data-grade3-toggle="1" type="button">等級3以下 '+(g?'ON':'OFF')+'</button>'+[5,6,7,8,9].map(function(n){return '<button class="dbCountBtn '+(c===n?'active':'')+'" data-count="'+n+'" type="button">'+n+'因縁</button>';}).join('');
    box.style.setProperty('display','grid','important');box.style.setProperty('grid-template-columns','repeat(3, minmax(0, 1fr))','important');box.style.setProperty('grid-auto-rows','52px','important');box.style.setProperty('gap','10px','important');box.style.setProperty('width','420px','important');box.style.setProperty('min-width','420px','important');box.style.setProperty('max-width','420px','important');
    Array.prototype.forEach.call(box.children,function(btn){btn.style.setProperty('width','100%','important');btn.style.setProperty('min-width','0','important');btn.style.setProperty('height','52px','important');btn.style.setProperty('display','flex','important');btn.style.setProperty('align-items','center','important');btn.style.setProperty('justify-content','center','important');btn.style.setProperty('box-sizing','border-box','important');btn.style.setProperty('font-size','15px','important');btn.style.setProperty('white-space','nowrap','important');});
  }
  function ensureFactor4Style(){if(q('jinpoFactor4FilterStyle'))return;var st=document.createElement('style');st.id='jinpoFactor4FilterStyle';st.textContent='.jinpoFactor4FilterRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 8px 0;max-width:100%;}.jinpoFactor4FilterRow .factor4BunkyokuLegend{margin:0 !important;flex:0 1 auto !important;}.jinpoFactor4FilterControl{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0;}.jinpoFactor4FilterLabel{font-size:12px;font-weight:900;color:#f0d7b0;white-space:nowrap;}.jinpoFactor4FilterBtn{min-width:34px;height:30px;padding:3px 8px;border:1px solid rgba(231,189,92,.65);border-radius:9px;background:linear-gradient(#3d2817,#181008);color:#f6e7c4;font-weight:900;cursor:pointer;}.jinpoFactor4FilterBtn:hover{filter:brightness(1.15);}.jinpoFactor4FilterBtn.active{border-color:#ff6868;background:linear-gradient(#6a1717,#2c0909);color:#fff0f0;box-shadow:0 0 8px rgba(255,68,68,.95),0 0 18px rgba(255,68,68,.6),inset 0 0 8px rgba(255,80,80,.25);}@media(max-width:760px){.jinpoFactor4FilterRow{gap:7px}.jinpoFactor4FilterControl{width:100%;}.jinpoFactor4FilterBtn{flex:1 1 34px;min-width:30px;padding:3px 5px}.jinpoFactor4FilterLabel{width:100%;}}';document.head.appendChild(st);}
  function syncFactor4(){document.querySelectorAll('.jinpoFactor4FilterBtn').forEach(function(btn){var on=Number(btn.getAttribute('data-factor4-exclude'))===selectedExclude;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');});}
  function ensureFactor4Controls(){ensureFactor4Style();var legend=q('factor4BunkyokuLegend');if(!legend)return false;if(q('jinpoFactor4FilterControl')){syncFactor4();return true;}var parent=legend.parentNode;if(!parent)return false;var row=document.createElement('div');row.className='jinpoFactor4FilterRow';row.id='jinpoFactor4FilterRow';parent.insertBefore(row,legend);row.appendChild(legend);var ctl=document.createElement('div');ctl.id='jinpoFactor4FilterControl';ctl.className='jinpoFactor4FilterControl';ctl.innerHTML='<span class="jinpoFactor4FilterLabel">文曲除外人数</span>'+[6,5,4,3,2,1,0].map(function(v){return '<button type="button" class="jinpoFactor4FilterBtn'+(v===selectedExclude?' active':'')+'" data-factor4-exclude="'+v+'" aria-pressed="'+(v===selectedExclude?'true':'false')+'">'+v+'</button>';}).join('');row.appendChild(ctl);return true;}

  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#dbCountButtons .dbCountBtn'):null;if(!b)return;var c=Number(b.getAttribute('data-count')||String(b.textContent||'').match(/[5-9]/)?.[0]||0);if(c<5||c>9)return;ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();setCount(c);renderUnifiedCountButtons();renderCurrent({count:c});},true);
  document.addEventListener('click',function(ev){
    var sortBtn=ev.target&&ev.target.closest?ev.target.closest('button[data-list-sort]'):null;
    if(sortBtn){ev.preventDefault();var key=sortBtn.getAttribute('data-list-sort')||'';if(!key)return;if(listSort.key===key)listSort.dir=listSort.dir==='desc'?'asc':'desc';else listSort={key:key,dir:'desc'};rerenderList(selectedCount());return;}
    var fb=ev.target&&ev.target.closest?ev.target.closest('button[data-factor4-exclude]'):null;if(fb){ev.preventDefault();selectedExclude=Number(fb.getAttribute('data-factor4-exclude'))||0;syncFactor4();renderCurrent({count:selectedCount()});return;}
    var b=ev.target&&ev.target.closest?ev.target.closest('button[data-unified-db-idx]'):null;if(!b)return;var row=displayRows[Number(b.getAttribute('data-unified-db-idx'))];if(!row)return;ev.preventDefault();appliedListRowKey=stableRowKey(row);rerenderList(selectedCount());try{if(typeof applyDbFormationRow==='function')applyDbFormationRow(row);}catch(e){console.error(e);}
  },true);
  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#dbFilterResetBtn'):null;if(!b)return;selectedExclude=0;syncFactor4();},true);
  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#clearBtn'):null;if(!b)return;appliedListRowKey='';},true);
  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#dbSearchProgressCancel'):null;if(!b)return;ev.preventDefault();activeToken++;window.__jinpoSearchCancelRequested=true;cancelWorkerRequests();hideProgress();var st=q('dbListStatus'),box=q('dbFormationList');if(st)st.textContent='検索を中止しました。';setSummary(0,0);if(box)box.innerHTML='<div class="dbListNote">検索を中止しました。条件を選び直すと再検索できます。</div>';},true);

  function install(){ensureEnhancementUi();ensureFactor4Controls();ensureCancelButton();window.__jinpoUnifiedRenderCountButtons=renderUnifiedCountButtons;window.renderDbCountButtons=renderUnifiedCountButtons;try{renderDbCountButtons=renderUnifiedCountButtons;}catch(e){}renderUnifiedCountButtons();window.renderDbFormationList=function(){return renderCurrent({count:selectedCount()});};window.handleDbCountButtonClick=function(c){setCount(c);renderUnifiedCountButtons();return renderCurrent({count:c});};try{renderDbFormationList=window.renderDbFormationList;handleDbCountButtonClick=window.handleDbCountButtonClick;}catch(e){}
    if(typeof window.applyReachSwapCandidate==='function'&&!window.applyReachSwapCandidate.__jinpoListAppliedStateClearWrapped){var prevReachApply=window.applyReachSwapCandidate;window.applyReachSwapCandidate=function(){
      appliedListRowKey='';
      var beforeKey=currentPlacementKey(),ret=prevReachApply.apply(this,arguments),afterKey=currentPlacementKey();
      if(afterKey&&afterKey!==beforeKey)setSwapStale(true);
      if(ret&&typeof ret.then==='function')ret.then(function(){var settledKey=currentPlacementKey();if(settledKey&&settledKey!==beforeKey)setSwapStale(true);},function(){});
      return ret;
    };window.applyReachSwapCandidate.__jinpoListAppliedStateClearWrapped=true;}
    window.JINPO_FACTOR4_FILTER={getSelected:function(){return selectedExclude;},getAllowedFactor4Users:function(){return 6-selectedExclude;},reset:function(){selectedExclude=0;syncFactor4();},render:function(){return renderCurrent({count:selectedCount()});},reloadIndex:function(){return Promise.resolve(true);}};
    window.JINPO_FAST_SEARCH={search:search,renderCurrent:renderCurrent,lookupExactState:lookupExactState,clear:function(){queryCache.clear();cancelWorkerRequests();},resetAll:function(){
      activeToken++;window.__jinpoSearchCancelRequested=true;queryCache.clear();cancelWorkerRequests();hideProgress();
      selectedExclude=0;listSort={key:'',dir:'desc'};appliedListRowKey='';setSwapStale(false);activeRows=[];displayRows=[];setCount(null);updateGlobals([]);syncFactor4();renderUnifiedCountButtons();setSummary(0,0);
      var status=q('dbListStatus'),box=q('dbFormationList');if(status)status.textContent='陣形を選択してください。';if(box)box.innerHTML='<div class="dbListNote">陣形選択後、5〜9因縁ボタンで一覧を表示します。</div>';
      window.__jinpoSearchCancelRequested=false;return true;
    }};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){install();setTimeout(ensureFactor4Controls,0);},{once:true});else{install();setTimeout(ensureFactor4Controls,0);}
})();
