/*
 * jinpo-bond-list.js
 * 因縁一覧 / 現在発動中因縁 モーダル。
 * 既存DB・検索・因縁判定処理は変更せず、既存の jinpo_inen_master.csv と適用中表示を参照する。
 */
(function(){
  'use strict';
  if(window.__jinpoBondListInstalled) return;
  window.__jinpoBondListInstalled = true;

  var bondMasterCache = null;
  var modalMode = 'all';
  var activeBondNames = [];

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

  function injectStyle(){
    if(document.getElementById('jinpoBondListStyle')) return;
    var style = document.createElement('style');
    style.id = 'jinpoBondListStyle';
    style.textContent = [
      '#jinpoBondNavActions{width:100%;display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin:-4px 0 10px 0;box-sizing:border-box;}',
      '#jinpoBondNavActions #jinpoBackBtn.jinpoBackBtn{margin:0 !important;}',
      '.jinpoBondNavBtn{min-height:38px;padding:7px 14px;border-radius:12px;border:2px solid #b99043;background:linear-gradient(#5e4020,#35230f);color:#fff1c9;font-size:15px;font-weight:900;line-height:1;box-shadow:0 0 12px rgba(231,189,92,.20);cursor:pointer;white-space:nowrap;}',
      '.jinpoBondNavBtn:hover{filter:brightness(1.12);box-shadow:0 0 16px rgba(231,189,92,.36);}',
      '#jinpoBondModalBackdrop{position:fixed;inset:0;z-index:10050;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.74);box-sizing:border-box;}',
      '#jinpoBondModalBackdrop.is-open{display:flex;}',
      '#jinpoBondModal{width:min(920px,96vw);max-height:88vh;display:flex;flex-direction:column;border:2px solid #c69a49;border-radius:16px;background:linear-gradient(180deg,#22170d,#100b07);color:#f4ead2;box-shadow:0 0 32px rgba(0,0,0,.75),0 0 22px rgba(231,189,92,.18);overflow:hidden;}',
      '.jinpoBondModalHeader{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(231,189,92,.34);background:rgba(95,59,20,.30);}',
      '.jinpoBondModalHeader h3{margin:0;font-size:20px;color:#ffe0a0;}',
      '.jinpoBondModalCount{font-size:12px;color:#d8c59b;}',
      '#jinpoBondModalClose{margin-left:auto;width:38px;height:34px;border:1px solid #a77d38;border-radius:9px;background:#3b2815;color:#fff0c9;font-size:20px;font-weight:900;cursor:pointer;}',
      '.jinpoBondSearchWrap{padding:12px 16px;border-bottom:1px solid rgba(231,189,92,.20);}',
      '#jinpoBondSearch{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #87662f;border-radius:10px;background:#0d0906;color:#f6ecd8;font-size:16px;outline:none;}',
      '#jinpoBondSearch:focus{border-color:#e7bd5c;box-shadow:0 0 0 2px rgba(231,189,92,.16);}',
      '.jinpoBondModalBody{padding:0 16px 16px;overflow:auto;}',
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
      '@media(max-width:760px){#jinpoBondNavActions{justify-content:flex-end;gap:6px}.jinpoBondNavBtn{font-size:13px;padding:7px 10px;min-height:36px}#jinpoBondNavActions #jinpoBackBtn.jinpoBackBtn{min-width:104px !important;width:104px !important;font-size:14px !important}.jinpoBondModalHeader h3{font-size:18px}.jinpoBondTable{font-size:13px}.jinpoBondTable th:nth-child(2),.jinpoBondTable td:nth-child(2){display:none}.jinpoBondTable th,.jinpoBondTable td{padding:8px 6px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureActions(){
    var back = document.getElementById('jinpoBackBtn');
    if(!back) return;
    var wrap = document.getElementById('jinpoBondNavActions');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'jinpoBondNavActions';
      back.parentNode.insertBefore(wrap, back);

      var allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.id = 'jinpoBondAllBtn';
      allBtn.className = 'jinpoBondNavBtn';
      allBtn.textContent = '因縁一覧';
      allBtn.addEventListener('click', function(){ openModal('all'); });
      wrap.appendChild(allBtn);

      var activeBtn = document.createElement('button');
      activeBtn.type = 'button';
      activeBtn.id = 'jinpoBondActiveBtn';
      activeBtn.className = 'jinpoBondNavBtn';
      activeBtn.textContent = '現在発動中因縁';
      activeBtn.addEventListener('click', function(){ openModal('active'); });
      wrap.appendChild(activeBtn);

      wrap.appendChild(back);
    }
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
          '<button id="jinpoBondModalClose" type="button" aria-label="閉じる">×</button>'+
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

  async function loadBondMaster(){
    if(Array.isArray(bondMasterCache) && bondMasterCache.length) return bondMasterCache;
    try{
      if(typeof inenMaster !== 'undefined' && Array.isArray(inenMaster) && inenMaster.length){
        bondMasterCache = inenMaster.slice();
        return bondMasterCache;
      }
    }catch(e){}
    if(!window.JinpoActivationEngine || typeof window.JinpoActivationEngine.loadCSV !== 'function'){
      throw new Error('因縁マスター読込機能が見つかりません');
    }
    bondMasterCache = await window.JinpoActivationEngine.loadCSV('data/jinpo_inen_master.csv');
    return bondMasterCache;
  }

  function appliedPreviewBondNames(){
    var box = document.getElementById('appliedRowPreviewUnderFormation');
    if(!box || !text(box.textContent)) return [];
    var groups = Array.prototype.slice.call(box.querySelectorAll('.appliedPreviewBox'));
    for(var i=0;i<groups.length;i++){
      var label = groups[i].querySelector('.appliedPreviewLabel');
      if(text(label && label.textContent) !== '因縁') continue;
      return unique(Array.prototype.slice.call(groups[i].querySelectorAll('.appliedPreviewList span,.badge')).map(function(el){ return text(el.textContent); }));
    }
    return [];
  }

  function lowerAppliedBondNames(){
    var box = document.getElementById('appliedDbRowDisplay');
    if(!box || box.style.display === 'none') return [];
    return unique(Array.prototype.slice.call(box.querySelectorAll('.badge')).map(function(el){ return text(el.textContent); }));
  }

  function highlightedRowBondNames(){
    var row = document.querySelector('#dbFormationList tr.jinpoCurrentAppliedMainRow');
    if(!row) return [];
    var badges = Array.prototype.slice.call(row.querySelectorAll('.dbListBonds .badge,.badge'));
    if(badges.length) return unique(badges.map(function(el){ return text(el.textContent); }));
    var cells = row.querySelectorAll('td');
    if(cells.length >= 5){
      return unique(text(cells[4].textContent).split(/[|/、,]+/).map(text));
    }
    return [];
  }

  function calculatedCurrentBondNames(){
    try{
      var appliedId = '';
      try{ if(typeof selectedDbResultId !== 'undefined') appliedId = text(selectedDbResultId); }catch(e){}
      if(!appliedId) return [];
      if(typeof placement === 'undefined' || !placement || typeof inenMaster === 'undefined' || !Array.isArray(inenMaster)) return [];
      var sel = document.getElementById('formationSelect');
      var formation = text(sel && sel.value);
      if(!formation) return [];
      var result = window.JinpoActivationEngine.calculateFormation(placement, formation, inenMaster, window.JINPO_FORMATION_CONFIG);
      return unique((result && Array.isArray(result.activated) ? result.activated : []).map(function(a){ return text(a && a.name); }));
    }catch(e){ return []; }
  }

  function currentActiveBondNames(){
    var names = appliedPreviewBondNames();
    if(!names.length) names = lowerAppliedBondNames();
    if(!names.length) names = highlightedRowBondNames();
    if(!names.length) names = calculatedCurrentBondNames();
    return unique(names);
  }

  function rowsForMode(master){
    if(modalMode !== 'active') return master.slice();
    var wanted = new Set(activeBondNames.map(normalize));
    return master.filter(function(row){ return wanted.has(normalize(row['因縁名'])); });
  }

  function renderModal(){
    var body = document.getElementById('jinpoBondModalBody');
    var count = document.getElementById('jinpoBondModalCount');
    var input = document.getElementById('jinpoBondSearch');
    if(!body || !count || !input || !Array.isArray(bondMasterCache)) return;

    var base = rowsForMode(bondMasterCache);
    var terms = text(input.value).split(/[\s　]+/).filter(Boolean).map(normalize);
    var rows = base.filter(function(row){
      if(!terms.length) return true;
      var hay = normalize([row['因縁名'],row['因縁種類'],row['因子1'],row['因子2'],row['因子3']].join(' '));
      return terms.every(function(term){ return hay.indexOf(term) !== -1; });
    });

    count.textContent = rows.length + ' / ' + base.length + '件';
    if(modalMode === 'active' && !activeBondNames.length){
      body.innerHTML = '<div class="jinpoBondEmpty">現在適用中の組み合わせはありません。</div>';
      return;
    }
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

  async function openModal(mode){
    ensureModal();
    modalMode = mode === 'active' ? 'active' : 'all';
    activeBondNames = modalMode === 'active' ? currentActiveBondNames() : [];
    var title = document.getElementById('jinpoBondModalTitle');
    var input = document.getElementById('jinpoBondSearch');
    var body = document.getElementById('jinpoBondModalBody');
    var backdrop = document.getElementById('jinpoBondModalBackdrop');
    title.textContent = modalMode === 'active' ? '現在発動中因縁' : '因縁一覧';
    input.value = '';
    body.innerHTML = '<div class="jinpoBondEmpty">読み込み中...</div>';
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden','false');
    try{
      await loadBondMaster();
      renderModal();
      setTimeout(function(){ try{ input.focus(); }catch(e){} },0);
    }catch(err){
      console.error('因縁一覧読込エラー',err);
      body.innerHTML = '<div class="jinpoBondEmpty">因縁一覧を読み込めませんでした。</div>';
      var count = document.getElementById('jinpoBondModalCount');
      if(count) count.textContent = '';
    }
  }

  function closeModal(){
    var backdrop = document.getElementById('jinpoBondModalBackdrop');
    if(!backdrop) return;
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden','true');
  }

  function boot(){
    injectStyle();
    ensureActions();
    ensureModal();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
  setTimeout(boot,0);
  setTimeout(boot,300);
})();
