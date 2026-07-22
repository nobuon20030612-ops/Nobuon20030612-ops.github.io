/*
 * jinpo-factor4-filter.js
 * 文曲除外人数（実際の因縁成立assignmentsで因子4を使用した英傑人数）の検索フィルター。
 * 既存検索は選択値0では完全に従来処理へ委譲し、1〜6選択時だけ本処理を使用する。
 */
(function(){
  'use strict';
  if(window.__jinpoFactor4FilterInstalled) return;
  window.__jinpoFactor4FilterInstalled = true;

  var INDEX_PATH = 'data/jinpo_factor4_usage_index.json';
  var selectedExclude = 0; // 初期値0 = 制限なし
  var renderToken = 0;
  var indexCache = null;
  var indexLoading = null;
  var shownRows = [];
  var LIMIT = Number(window.JINPO_RESULT_LIMIT || 300) || 300;
  var prevRender = null;
  var prevHandle = null;
  var prevStep55 = null;
  var prevStep38 = null;
  var prevStep124 = null;
  var prevStep151 = null;

  function q(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]; }); }
  function num(v){ var n=Number(String(v == null ? '' : v).replace(/,/g,'')); return Number.isFinite(n)?n:0; }
  function split(v){ return String(v == null ? '' : v).split(/[|,、]/).map(function(x){return x.trim();}).filter(Boolean); }
  function norm(v){ return String(v == null ? '' : v).trim().replace(/山中鹿之助/g,'山中鹿之介').replace(/・/g,'').replace(/[\s　]+/g,''); }
  function yieldUi(){ return new Promise(function(resolve){ setTimeout(resolve,0); }); }

  function selectedCount(){
    try{ return Number(selectedDbListBondCount) || 0; }catch(e){}
    return Number(window.selectedDbListBondCount) || 0;
  }
  function setSelectedCount(v){
    try{ selectedDbListBondCount = Number(v)||0; }catch(e){}
    try{ window.selectedDbListBondCount = Number(v)||0; }catch(e){}
  }
  function gradeOn(){
    try{ return !!grade3Cost6OnlyEnabled; }catch(e){}
    return !!window.grade3Cost6OnlyEnabled;
  }
  function currentFormation(){
    var sel=q('formationSelect');
    var s=String(sel && sel.value || '').trim();
    if(s.indexOf('衡軛')>=0) return '衡軛';
    if(s.indexOf('鶴翼')>=0) return '鶴翼';
    if(s.indexOf('魚鱗')>=0) return '魚鱗';
    if(s.indexOf('方円')>=0) return '方円';
    return s;
  }
  function rowFormation(row){ return String(row && (row.formation || row.form || row['陣形']) || '').trim(); }
  function formationOk(row, form){
    var rf=rowFormation(row);
    if(!rf || !form) return false;
    if(rf===form) return true;
    if(rf==='魚鱗と方円') return form==='魚鱗' || form==='方円';
    return rf.indexOf(form)!==-1;
  }
  function isGrade3Row(row){
    var g=String(row && (row.grade3_flag || row.grade || row['等級3以下']) || '');
    return g.indexOf('等級3')!==-1 || g.indexOf('ON')!==-1 || g==='1' || g.toLowerCase()==='true';
  }
  function members(row){ return split(row && (row.eiketsu_names || row.members || row.eiketsu_ids || row['英傑'])); }
  function bonds(row){ return split(row && (row.bond_names || row.bond_ids || row.inen || row['発動因縁'] || row['因縁'])); }
  function ownedNames(){
    try{ return (typeof ownedHeroNames==='function' ? ownedHeroNames() : []).map(norm).filter(Boolean); }catch(e){ return []; }
  }
  function excludedNames(){
    try{ return (typeof window.__jinpoGetExcludedHeroes==='function' ? window.__jinpoGetExcludedHeroes() : []).map(norm).filter(Boolean); }catch(e){ return []; }
  }
  function ownedOk(row){
    var o=ownedNames(); if(!o.length) return true;
    var m=members(row).map(norm);
    return o.every(function(n){ return m.indexOf(n)!==-1; });
  }
  function excludedOk(row){
    var ex=excludedNames(); if(!ex.length) return true;
    var m=members(row).map(norm);
    return !m.some(function(n){ return ex.indexOf(n)!==-1; });
  }
  function priorityRules(){
    try{ return (typeof getDbPriorityRules==='function' ? getDbPriorityRules() : []).filter(function(r){return r&&r.stat;}); }catch(e){ return []; }
  }
  function stat(row,k){ return num(row && (row[k] != null ? row[k] : row[String(k).replace('属性','')])); }
  function priorityOk(row,rules){
    for(var i=0;i<rules.length;i++){
      var r=rules[i];
      if(r.threshold !== null && r.threshold !== '' && Number.isFinite(Number(r.threshold)) && stat(row,r.stat) < Number(r.threshold)) return false;
    }
    return true;
  }
  function total(row){ return num(row && (row.total_score != null ? row.total_score : row['総合値'])); }
  function compareRows(a,b,rules){
    for(var i=0;i<rules.length;i++){ var d=stat(b,rules[i].stat)-stat(a,rules[i].stat); if(d) return d; }
    var td=total(b)-total(a); if(td) return td;
    return String(a && (a.result_id||a.id||'')).localeCompare(String(b && (b.result_id||b.id||'')),'ja');
  }

  function showProgress(msg,done,total){
    var p=q('dbSearchProgress'); if(p){ p.style.display='block'; p.classList.add('active'); }
    var t=q('dbSearchProgressTitle'); if(t) t.innerHTML='<span class="dbSearchSpinner"></span>'+esc(msg||'検索中。数分お待ちください。');
    var c=q('dbSearchProgressCount'); if(c) c.textContent=(total?Number(done||0).toLocaleString()+' / '+Number(total).toLocaleString():'読込中');
    var r=q('dbSearchProgressRemain'); if(r) r.textContent='数分お待ちください';
    var b=q('dbSearchProgressBar'); if(b){
      var pct=total?Math.max(1,Math.min(100,Math.round((Number(done||0)/Number(total))*100))):42;
      b.style.width=pct+'%';
      if(b.parentElement) b.parentElement.classList.toggle('indeterminate',!total);
    }
  }
  function hideProgress(){
    var p=q('dbSearchProgress'); if(p){p.classList.remove('active');p.style.display='none';}
    var b=q('dbSearchProgressBar'); if(b){b.style.width='0%';if(b.parentElement)b.parentElement.classList.remove('indeterminate');}
  }

  function ensureStyle(){
    if(q('jinpoFactor4FilterStyle')) return;
    var st=document.createElement('style');
    st.id='jinpoFactor4FilterStyle';
    st.textContent=
      '.jinpoFactor4FilterRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 8px 0;max-width:100%;}' +
      '.jinpoFactor4FilterRow .factor4BunkyokuLegend{margin:0 !important;flex:0 1 auto !important;}' +
      '.jinpoFactor4FilterControl{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0;}' +
      '.jinpoFactor4FilterLabel{font-size:12px;font-weight:900;color:#f0d7b0;white-space:nowrap;}' +
      '.jinpoFactor4FilterBtn{min-width:34px;height:30px;padding:3px 8px;border:1px solid rgba(231,189,92,.65);border-radius:9px;background:linear-gradient(#3d2817,#181008);color:#f6e7c4;font-weight:900;cursor:pointer;}' +
      '.jinpoFactor4FilterBtn:hover{filter:brightness(1.15);}' +
      '.jinpoFactor4FilterBtn.active{border-color:#ff6868;background:linear-gradient(#6a1717,#2c0909);color:#fff0f0;box-shadow:0 0 8px rgba(255,68,68,.95),0 0 18px rgba(255,68,68,.6),inset 0 0 8px rgba(255,80,80,.25);}' +
      '@media(max-width:760px){.jinpoFactor4FilterRow{gap:7px}.jinpoFactor4FilterControl{width:100%;}.jinpoFactor4FilterBtn{flex:1 1 34px;min-width:30px;padding:3px 5px}.jinpoFactor4FilterLabel{width:100%;}}';
    document.head.appendChild(st);
  }
  function syncButtons(){
    document.querySelectorAll('.jinpoFactor4FilterBtn').forEach(function(btn){
      var on=Number(btn.getAttribute('data-factor4-exclude'))===selectedExclude;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
    });
  }
  function ensureControls(){
    ensureStyle();
    var legend=q('factor4BunkyokuLegend');
    if(!legend) return false;
    if(q('jinpoFactor4FilterControl')){syncButtons();return true;}
    var parent=legend.parentNode;
    if(!parent) return false;
    var row=document.createElement('div'); row.className='jinpoFactor4FilterRow'; row.id='jinpoFactor4FilterRow';
    parent.insertBefore(row,legend); row.appendChild(legend);
    var ctl=document.createElement('div'); ctl.id='jinpoFactor4FilterControl'; ctl.className='jinpoFactor4FilterControl';
    ctl.innerHTML='<span class="jinpoFactor4FilterLabel">文曲除外人数</span>'+[6,5,4,3,2,1,0].map(function(v){return '<button type="button" class="jinpoFactor4FilterBtn'+(v===0?' active':'')+'" data-factor4-exclude="'+v+'" aria-pressed="'+(v===0?'true':'false')+'">'+v+'</button>';}).join('');
    row.appendChild(ctl);
    ctl.addEventListener('click',function(ev){
      var btn=ev.target&&ev.target.closest?ev.target.closest('button[data-factor4-exclude]'):null;
      if(!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      selectedExclude=Number(btn.getAttribute('data-factor4-exclude'))||0;
      syncButtons();
      ++renderToken;
      if(selectedCount()){
        if(selectedExclude===0){ if(typeof prevRender==='function') prevRender(); }
        else renderFiltered();
      }
    });
    return true;
  }

  function loadIndex(){
    if(indexCache) return Promise.resolve(indexCache);
    if(indexLoading) return indexLoading;
    indexLoading=fetch(INDEX_PATH,{cache:'no-store'}).then(function(res){if(!res.ok) throw new Error(INDEX_PATH+' HTTP '+res.status);return res.json();}).then(function(data){
      indexCache=(data&&data.entries)||{}; return indexCache;
    }).finally(function(){indexLoading=null;});
    return indexLoading;
  }
  function factor4Ok(row,index){
    var rid=String(row && (row.result_id||row.id)||'');
    if(!rid || index[rid] == null) return false;
    var allowed=6-selectedExclude;
    return Number(index[rid])<=allowed;
  }

  function parseCsv(text){
    if(window.JinpoActivationEngine && typeof window.JinpoActivationEngine.parseCSV==='function') return window.JinpoActivationEngine.parseCSV(text);
    var rows=[],row=[],field='',quoted=false,header=null;
    function push(){ row.push(field);field=''; if(!header) header=row.map(function(h){return String(h||'').replace(/^\ufeff/,'');}); else if(row.some(function(v){return String(v).trim()!=='';})){var o={};header.forEach(function(h,i){o[h]=row[i]||'';});rows.push(o);} row=[]; }
    for(var i=0;i<text.length;i++){var ch=text[i],nx=text[i+1];if(quoted){if(ch==='"'&&nx==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}else{if(ch==='"')quoted=true;else if(ch===','){row.push(field);field='';}else if(ch==='\n')push();else if(ch!=='\r')field+=ch;}}
    if(field.length||row.length)push(); return rows;
  }
  async function loadCsvRaw(path){ var res=await fetch(path,{cache:'no-store'}); if(!res.ok) throw new Error(path+' HTTP '+res.status); return parseCsv(await res.text()); }
  async function loadJson(path){ var res=await fetch(path,{cache:'no-store'}); if(!res.ok) throw new Error(path+' HTTP '+res.status); return res.json(); }
  function collectRows(obj,out){
    if(Array.isArray(obj)){ obj.forEach(function(x){ if(x&&typeof x==='object'&&(x.result_id||x.bond_count||x.ic)&&(x.eiketsu_names||x.members)) out.push(x); else collectRows(x,out); }); return; }
    if(obj&&typeof obj==='object'){ if((obj.result_id||obj.bond_count||obj.ic)&&(obj.eiketsu_names||obj.members)){out.push(obj);return;} Object.keys(obj).forEach(function(k){collectRows(obj[k],out);}); }
  }
  async function additionalRows(count,wantGrade3){
    try{
      if(!window.JINPO_ADDITIONAL_DB || typeof window.JINPO_ADDITIONAL_DB.getRows!=='function') return [];
      var rows=await window.JINPO_ADDITIONAL_DB.getRows({bondCount:count});
      return rows.filter(function(r){ return wantGrade3 ? isGrade3Row(r) : !isGrade3Row(r); });
    }catch(e){ console.warn('文曲フィルター: 追加DB読込失敗',e); return []; }
  }
  async function grade3Rows(count){
    var data=await loadJson('data/grade3_precomputed_5_6_7_8_9.json');
    var all=[]; collectRows(data&&data.formations?data.formations:data,all);
    var rows=all.filter(function(r){return Number(r.bond_count||r.ic||0)===count;});
    var add=await additionalRows(count,true);
    return rows.concat(add);
  }

  function rowKey(row){ return String(row && (row.duplicate_key||row['重複除外キー']||row.result_id||row.id)||''); }
  function candidateOk(row,count,form,rules,index){
    if(Number(row && (row.bond_count||row.ic||0))!==count) return false;
    if(!formationOk(row,form)) return false;
    if(!ownedOk(row) || !excludedOk(row) || !priorityOk(row,rules)) return false;
    if(!factor4Ok(row,index)) return false;
    return true;
  }
  async function normalRows(count,form,rules,index,token){
    var out=[],seen=Object.create(null),missingIndex=0,processed=0,totalEstimate=0;
    function take(rows){
      for(var i=0;i<rows.length;i++){
        var r=rows[i];
        if(isGrade3Row(r)) continue;
        var rid=String(r&&(r.result_id||r.id)||'');
        if(rid && index[rid]==null){missingIndex++;continue;}
        if(!candidateOk(r,count,form,rules,index)) continue;
        var k=rowKey(r); if(k && seen[k]) continue; if(k) seen[k]=1;
        out.push(r);
      }
    }
    if(count===7){
      var manifest=await loadJson('data/jinpo_result_db_7_parts_manifest.json');
      var parts=(manifest&&manifest.parts)||[];
      totalEstimate=parts.reduce(function(a,p){return a+Number(p.rows||0);},0);
      for(var p=0;p<parts.length;p++){
        if(token!==renderToken) return {cancelled:true,rows:[]};
        var rows=await loadCsvRaw(parts[p].file);
        take(rows); processed+=rows.length;
        showProgress('7因縁DB全体から文曲条件で検索中',processed,totalEstimate);
        await yieldUi();
      }
    }else{
      var path={5:'data/jinpo_result_db_5.csv',6:'data/jinpo_result_db_6.csv',8:'data/jinpo_result_db_8.csv',9:'data/jinpo_result_db_9.csv'}[count];
      if(!path) return {rows:[],missingIndex:0};
      var base=await loadCsvRaw(path); totalEstimate=base.length; take(base); processed=base.length;
      showProgress(count+'因縁DB全体から文曲条件で検索中',processed,totalEstimate);
      await yieldUi();
    }
    var add=await additionalRows(count,false);
    take(add);
    return {rows:out,missingIndex:missingIndex};
  }

  var STAT_KEYS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性'];
  function statText(row){ var a=STAT_KEYS.map(function(k){return k+':'+(row&&row[k]!=null?row[k]:'');});a.push('総合値:'+total(row));return a.join(' / '); }
  function table(rows,count){
    return '<table class="dbListTable dbListTwoRow"><thead><tr><th>適用</th><th>因縁数</th><th>陣形</th><th>英傑</th><th>因縁</th></tr></thead><tbody>'+rows.map(function(row,idx){
      var mem=members(row),bd=bonds(row);
      return '<tr class="dbMainRow"><td><button class="applyBtn" data-factor4-row-index="'+idx+'" type="button">適用</button></td><td>'+esc(row.bond_count||count)+'</td><td>'+esc(rowFormation(row))+'</td><td><div class="dbPlacementMini">'+mem.map(function(m,i){return '<span>'+esc(i+1)+'. '+esc(m)+'</span>';}).join('')+'</div></td><td class="dbListBondsCell"><div class="dbListBonds">'+bd.map(function(b){return '<span class="badge">'+esc(b)+'</span>';}).join('')+'</div></td></tr><tr class="dbStatRow"><td colspan="5"><span class="dbStatLabel">総合値 '+esc(total(row))+'</span><span class="dbListStat">'+esc(statText(row))+'</span></td></tr>';
    }).join('')+'</tbody></table>';
  }

  async function renderFiltered(){
    ensureControls();
    if(selectedExclude===0) return typeof prevRender==='function' ? prevRender.apply(this,arguments) : undefined;
    var token=++renderToken;
    var box=q('dbFormationList'),status=q('dbListStatus'); if(!box||!status) return;
    var count=selectedCount(),form=currentFormation();
    if(!count){hideProgress();status.textContent='';box.innerHTML='';return;}
    if(!form){hideProgress();status.textContent='陣形を選択してください。';box.innerHTML='<div class="dbListNote">陣形選択後、5〜9因縁ボタンで一覧を表示します。</div>';return;}
    box.innerHTML=''; shownRows=[];
    showProgress('文曲除外人数の条件を準備中');
    try{
      var index=await loadIndex(); if(token!==renderToken)return;
      var rules=priorityRules();
      var result,sourceCount=0,missingIndex=0;
      if(gradeOn()){
        var gRows=await grade3Rows(count); if(token!==renderToken)return;
        sourceCount=gRows.length;
        var filtered=[];
        for(var i=0;i<gRows.length;i++){
          var r=gRows[i],rid=String(r&&(r.result_id||r.id)||'');
          if(rid && index[rid]==null){missingIndex++;continue;}
          if(candidateOk(r,count,form,rules,index)) filtered.push(r);
        }
        result={rows:filtered,missingIndex:missingIndex};
      }else{
        result=await normalRows(count,form,rules,index,token); if(token!==renderToken||result.cancelled)return;
        missingIndex=result.missingIndex||0;
      }
      var rows=result.rows||[];
      rows.sort(function(a,b){return compareRows(a,b,rules);});
      shownRows=rows.slice(0,LIMIT);
      var allowed=6-selectedExclude;
      var gradeText=gradeOn()?' / 等級3以下のみ':'';
      var priText=rules.length?' / 優先条件ソート':'';
      var missingText=missingIndex?' / 文曲判定未登録 '+missingIndex.toLocaleString()+'件除外':'';
      status.textContent=form+' / '+count+'因縁: 絞り込み '+rows.length.toLocaleString()+'件 / 表示 '+shownRows.length.toLocaleString()+'件（最大'+LIMIT+'件） / 文曲除外人数 '+selectedExclude+'（因子4使用 '+allowed+'人以下）'+gradeText+priText+missingText;
      box.innerHTML=shownRows.length?table(shownRows,count):'<div class="dbListNote">該当DBなし。文曲除外人数・陣形・配置英傑・除外英傑・優先条件を確認してください。</div>';
      try{ if(typeof window.applyFactor4BunkyokuGlow==='function') setTimeout(function(){window.applyFactor4BunkyokuGlow();},0); }catch(e){}
    }catch(err){
      console.error('文曲除外人数検索エラー',err);
      status.textContent='文曲除外人数の検索中にエラーが発生しました。';
      box.innerHTML='<div class="dbListNote">検索処理でエラーが発生しました。コンソールを確認してください。</div>';
    }finally{ if(token===renderToken) hideProgress(); }
  }

  function installEntryWrapper(name, holder){
    var old=window[name];
    if(typeof old!=='function' || old.__jinpoFactor4FilterWrapped) return holder;
    var wrapped=function(c){
      if(selectedExclude<=0) return old.apply(this,arguments);
      c=Number(c)||selectedCount();
      if(c) setSelectedCount(c);
      try{ if(typeof renderDbCountButtons==='function') renderDbCountButtons(); }catch(e){}
      setTimeout(ensureControls,0);
      return renderFiltered();
    };
    wrapped.__jinpoFactor4FilterWrapped=true;
    window[name]=wrapped;
    return old;
  }
  function installWrappers(){
    if(window.renderDbFormationList && !window.renderDbFormationList.__jinpoFactor4FilterWrapped){
      prevRender=window.renderDbFormationList;
      var w=function(){ return selectedExclude>0 ? renderFiltered.apply(this,arguments) : prevRender.apply(this,arguments); };
      w.__jinpoFactor4FilterWrapped=true; window.renderDbFormationList=w;
      try{ renderDbFormationList=window.renderDbFormationList; }catch(e){}
    }
    if(window.handleDbCountButtonClick && !window.handleDbCountButtonClick.__jinpoFactor4FilterWrapped){
      prevHandle=window.handleDbCountButtonClick;
      var h=function(c){
        if(selectedExclude<=0) return prevHandle.apply(this,arguments);
        setSelectedCount(c);
        try{ if(typeof renderDbCountButtons==='function') renderDbCountButtons(); }catch(e){}
        setTimeout(ensureControls,0);
        return renderFiltered();
      };
      h.__jinpoFactor4FilterWrapped=true; window.handleDbCountButtonClick=h;
      try{ handleDbCountButtonClick=window.handleDbCountButtonClick; }catch(e){}
    }
    prevStep55=installEntryWrapper('__step55RunDbCount',prevStep55);
    prevStep38=installEntryWrapper('__step38RenderDbCount',prevStep38);
    prevStep124=installEntryWrapper('__step124RenderGrade356',prevStep124);
    prevStep151=installEntryWrapper('__step151RenderGrade378',prevStep151);
  }

  document.addEventListener('click',function(ev){
    var btn=ev.target&&ev.target.closest?ev.target.closest('button[data-factor4-row-index]'):null;
    if(!btn) return;
    ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
    var row=shownRows[Number(btn.getAttribute('data-factor4-row-index'))];
    if(row && typeof applyDbFormationRow==='function') applyDbFormationRow(row);
  },true);

  function boot(){
    installWrappers();
    var tries=0;
    (function ui(){ tries++; if(!ensureControls() && tries<40) setTimeout(ui,100); })();
  }
  window.JINPO_FACTOR4_FILTER={
    getSelected:function(){return selectedExclude;},
    getAllowedFactor4Users:function(){return 6-selectedExclude;},
    render:renderFiltered,
    reloadIndex:function(){indexCache=null;return loadIndex();}
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else setTimeout(boot,0);
})();
