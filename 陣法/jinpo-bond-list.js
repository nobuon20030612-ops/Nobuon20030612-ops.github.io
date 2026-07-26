/*
 * jinpo-bond-list.js
 * 因縁一覧 / 現在発動中因縁 モーダル。
 * 既存DB・検索・因縁判定処理は変更せず、既存の jinpo_inen_master.csv と適用中表示を参照する。
 * 現在発動中因縁では、現在の陣形図と成立位置を同一モーダル内に表示し、因縁ホバー/フォーカス/タップで対応ラインを強調する。
 */
(function(){
  'use strict';
  if(window.__jinpoBondListInstalled) return;
  window.__jinpoBondListInstalled = true;

  var bondMasterCache = null;
  var modalMode = 'all';
  var activeBondNames = [];
  var activeCalculatedResult = null;
  var lockedActiveCard = null;

  var ACTIVE_FORMATION_VIEW = {
    '衡軛': {
      slots:{1:{x:32,y:18},4:{x:68,y:18},2:{x:32,y:50},5:{x:68,y:50},3:{x:32,y:82},6:{x:68,y:82}},
      lines:[[1,2,3],[4,5,6]]
    },
    '鶴翼': {
      slots:{1:{x:18,y:18},4:{x:82,y:18},2:{x:30,y:50},5:{x:70,y:50},3:{x:24,y:82},6:{x:76,y:82}},
      lines:[[1,2,3],[4,5,6]]
    },
    '魚鱗': {
      slots:{1:{x:50,y:8},2:{x:30,y:48},6:{x:70,y:48},3:{x:16,y:86},4:{x:50,y:86},5:{x:84,y:86}},
      lines:[[1,2,3],[3,4,5],[5,6,1]]
    },
    '方円': {
      slots:{1:{x:50,y:10},2:{x:30,y:36},6:{x:70,y:36},3:{x:30,y:66},5:{x:70,y:66},4:{x:50,y:90}},
      lines:[[2,3,4],[4,5,6],[2,1,6]]
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
    if(/衡軛|kogaku|kougaku/i.test(s)) return '衡軛';
    if(/鶴翼|kakuyoku/i.test(s)) return '鶴翼';
    if(/魚鱗|gyorin/i.test(s)) return '魚鱗';
    if(/方円|hoen/i.test(s)) return '方円';
    return '';
  }
  function currentFormationName(){
    var sel = document.getElementById('formationSelect');
    if(!sel) return '';
    var opt = sel.selectedOptions && sel.selectedOptions[0] ? text(sel.selectedOptions[0].textContent) : '';
    return canonicalFormation(sel.value) || canonicalFormation(opt);
  }
  function lineId(slots){
    return (Array.isArray(slots) ? slots : []).map(Number).filter(Boolean).sort(function(a,b){return a-b;}).join('-');
  }
  function lineDisplay(slots){
    var marks = {1:'①',2:'②',3:'③',4:'④',5:'⑤',6:'⑥'};
    return (Array.isArray(slots) ? slots : []).map(function(n){ return marks[Number(n)] || String(n); }).join('－');
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
  function currentHeroFactors(slot){
    var h = currentHero(slot);
    if(!h) return '';
    try{
      if(typeof heroFactors === 'function'){
        var fs = heroFactors(h);
        if(Array.isArray(fs)) return fs.map(text).filter(Boolean).join('・');
      }
    }catch(e){}
    return [h['因子1'],h['因子2'],h['因子3'],h['因子4']].map(text).filter(Boolean).join('・');
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
    var fallback = ACTIVE_FORMATION_VIEW[formation];
    if(!fallback) return null;
    var liveSlots = liveFormationSlotPositions();
    return {slots:liveSlots || fallback.slots,lines:fallback.lines};
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
      '#jinpoBondModalBackdrop[data-mode="active"] #jinpoBondModal{width:min(1240px,97vw);max-height:92vh;}',
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
      '.jinpoBondActiveLayout{display:grid;grid-template-columns:minmax(540px,1.45fr) minmax(350px,.85fr);gap:14px;padding-top:14px;align-items:start;}',
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
      '.jinpoBondDiagramSlot{position:absolute;transform:translate(-50%,-50%);width:138px;min-height:66px;box-sizing:border-box;padding:7px 6px;border:1px solid #80602b;border-radius:11px;background:#18110b;color:#f4ead2;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.34);transition:border-color .14s ease,box-shadow .14s ease,filter .14s ease,opacity .14s ease;z-index:2;}',
      '.jinpoBondDiagramSlot strong{color:#ffe1a1;font-size:14px;}',
      '.jinpoBondDiagramSlot .jinpoBondSlotHero{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.jinpoBondDiagramSlot .jinpoBondSlotFactors{font-size:9px;color:#cdbb96;line-height:1.2;max-height:22px;overflow:hidden;}',
      '.jinpoBondFormationDiagram.is-highlighting .jinpoBondDiagramSlot{opacity:.42;filter:grayscale(.35);}',
      '.jinpoBondFormationDiagram.is-highlighting .jinpoBondDiagramSlot.is-hover{opacity:1;filter:none;border-color:#ffd75c;box-shadow:0 0 0 2px rgba(255,215,92,.22),0 0 24px rgba(255,194,61,.82),inset 0 0 14px rgba(255,204,70,.14);}',
      '.jinpoBondActiveCards{display:grid;gap:8px;padding:10px;max-height:470px;overflow:auto;}',
      '.jinpoBondActiveCard{border:1px solid rgba(231,189,92,.26);border-radius:11px;background:rgba(48,31,17,.74);padding:10px;cursor:default;outline:none;transition:border-color .14s ease,box-shadow .14s ease,background .14s ease,transform .14s ease;}',
      '.jinpoBondActiveCard:hover,.jinpoBondActiveCard:focus-visible,.jinpoBondActiveCard.is-locked{border-color:#ffd75c;background:rgba(91,51,19,.74);box-shadow:0 0 18px rgba(255,203,70,.38);transform:translateY(-1px);}',
      '.jinpoBondActiveCardHead{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;}',
      '.jinpoBondActiveCardName{font-weight:1000;color:#fff0bd;font-size:16px;}',
      '.jinpoBondActiveCardKind{font-size:11px;color:#cdbb96;white-space:nowrap;}',
      '.jinpoBondActiveLine{margin:4px 0 7px;color:#ffd75c;font-size:14px;font-weight:900;letter-spacing:.02em;}',
      '.jinpoBondActiveNoLine{color:#bba985;font-weight:700;}',
      '.jinpoBondActiveCard .jinpoBondFactors{margin-top:4px;}',
      '.jinpoBondActiveCardHelp{padding:0 10px 10px;color:#bfae89;font-size:11px;line-height:1.45;}',
      '@media(max-width:980px){#jinpoBondModalBackdrop[data-mode="active"] #jinpoBondModal{width:min(920px,97vw)}.jinpoBondActiveLayout{grid-template-columns:1fr}.jinpoBondFormationDiagram{height:410px;min-height:410px}.jinpoBondActiveCards{max-height:none}}',
      '@media(max-width:760px){#jinpoBondNavActions{justify-content:flex-end;gap:6px}.jinpoBondNavBtn{font-size:13px;padding:7px 10px;min-height:36px}#jinpoBondNavActions #jinpoBackBtn.jinpoBackBtn{min-width:104px !important;width:104px !important;font-size:14px !important}.jinpoBondModalHeader h3{font-size:18px}.jinpoBondTable{font-size:13px}.jinpoBondTable th:nth-child(2),.jinpoBondTable td:nth-child(2){display:none}.jinpoBondTable th,.jinpoBondTable td{padding:8px 6px}.jinpoBondModalBody{padding-left:10px;padding-right:10px}.jinpoBondActiveLayout{gap:10px;padding-top:10px}.jinpoBondFormationDiagram{height:340px;min-height:340px;margin:6px}.jinpoBondDiagramSlot{width:105px;min-height:56px;padding:5px 4px}.jinpoBondDiagramSlot strong{font-size:12px}.jinpoBondDiagramSlot .jinpoBondSlotHero{font-size:10px}.jinpoBondDiagramSlot .jinpoBondSlotFactors{font-size:8px;max-height:18px}.jinpoBondFormationHint{font-size:10px}.jinpoBondActiveCardName{font-size:15px}}'
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

  function currentCalculatedResult(){
    try{
      if(typeof placement === 'undefined' || !placement || typeof inenMaster === 'undefined' || !Array.isArray(inenMaster)) return null;
      var formation = currentFormationName();
      if(!formation || !window.JinpoActivationEngine || typeof window.JinpoActivationEngine.calculateFormation !== 'function') return null;
      return window.JinpoActivationEngine.calculateFormation(placement, formation, inenMaster, window.JINPO_FORMATION_CONFIG);
    }catch(e){
      console.error('現在発動中因縁の陣形再計算失敗',e);
      return null;
    }
  }

  function calculatedCurrentBondNames(){
    try{
      var appliedId = '';
      try{ if(typeof selectedDbResultId !== 'undefined') appliedId = text(selectedDbResultId); }catch(e){}
      if(!appliedId) return [];
      var result = currentCalculatedResult();
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

  function resultLineDetails(){
    var map = new Map();
    var activated = activeCalculatedResult && Array.isArray(activeCalculatedResult.activated) ? activeCalculatedResult.activated : [];
    activated.forEach(function(act){
      var name = normalize(act && act.name);
      if(!name) return;
      var occ = Array.isArray(act.occurrences) && act.occurrences.length ? act.occurrences : [act];
      var lines = uniqueBy(occ.map(function(o){
        return Array.isArray(o && o.lineSlots) ? o.lineSlots.map(Number).filter(Boolean) : [];
      }).filter(function(x){return x.length;}), lineId);
      if(lines.length) map.set(name, lines);
    });
    return map;
  }

  function allActiveLineIds(){
    var out = [];
    resultLineDetails().forEach(function(lines){ lines.forEach(function(line){ out.push(lineId(line)); }); });
    return new Set(unique(out));
  }

  function activeLineDataForRow(row, detailMap){
    return detailMap.get(normalize(row && row['因縁名'])) || [];
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
    for(var s=1;s<=6;s++){
      var p = cfg.slots[s];
      if(!p) continue;
      slotHtml += '<div class="jinpoBondDiagramSlot" data-slot="'+s+'" style="left:'+p.x+'%;top:'+p.y+'%;">'+
        '<strong>'+s+'</strong><div class="jinpoBondSlotHero">'+esc(currentHeroName(s))+'</div>'+
        '<div class="jinpoBondSlotFactors">'+esc(currentHeroFactors(s))+'</div></div>';
    }
    return '<div id="jinpoBondFormationDiagram" class="jinpoBondFormationDiagram" data-formation="'+esc(formation)+'">'+
      '<svg class="jinpoBondFormationSvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+svgLines.join('')+'</svg>'+slotHtml+'</div>';
  }

  function setDiagramHighlight(lineIds,slots){
    var diagram = document.getElementById('jinpoBondFormationDiagram');
    if(!diagram) return;
    var wantedLines = new Set((lineIds || []).map(text).filter(Boolean));
    var wantedSlots = new Set((slots || []).map(Number).filter(Boolean));
    var on = wantedLines.size > 0 || wantedSlots.size > 0;
    diagram.classList.toggle('is-highlighting', on);
    Array.prototype.forEach.call(diagram.querySelectorAll('.jinpoBondDiagramLine'),function(el){
      el.classList.toggle('is-hover', on && wantedLines.has(text(el.getAttribute('data-line-id'))));
    });
    Array.prototype.forEach.call(diagram.querySelectorAll('.jinpoBondDiagramSlot'),function(el){
      el.classList.toggle('is-hover', on && wantedSlots.has(Number(el.getAttribute('data-slot'))));
    });
  }

  function clearDiagramHighlight(){
    setDiagramHighlight([],[]);
  }

  function cardHighlightData(card){
    var ids = text(card && card.getAttribute('data-line-ids')).split('|').map(text).filter(Boolean);
    var slots = text(card && card.getAttribute('data-slots')).split(',').map(Number).filter(Boolean);
    return {ids:ids,slots:slots};
  }

  function applyCardHighlight(card){
    var d = cardHighlightData(card);
    setDiagramHighlight(d.ids,d.slots);
  }

  function bindActiveCardHighlight(){
    lockedActiveCard = null;
    var body = document.getElementById('jinpoBondModalBody');
    if(!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('.jinpoBondActiveCard'),function(card){
      card.addEventListener('mouseenter',function(){ if(!lockedActiveCard) applyCardHighlight(card); });
      card.addEventListener('mouseleave',function(){ if(!lockedActiveCard) clearDiagramHighlight(); });
      card.addEventListener('focus',function(){ if(!lockedActiveCard) applyCardHighlight(card); });
      card.addEventListener('blur',function(){ if(!lockedActiveCard) clearDiagramHighlight(); });
      card.addEventListener('click',function(){
        if(lockedActiveCard === card){
          card.classList.remove('is-locked');
          lockedActiveCard = null;
          clearDiagramHighlight();
          return;
        }
        if(lockedActiveCard) lockedActiveCard.classList.remove('is-locked');
        lockedActiveCard = card;
        card.classList.add('is-locked');
        applyCardHighlight(card);
      });
    });
  }

  function renderActiveModal(rows){
    var formation = currentFormationName();
    var detailMap = resultLineDetails();
    var cards = rows.map(function(row){
      var factors = [row['因子1'],row['因子2'],row['因子3']].map(text).filter(Boolean);
      var lines = activeLineDataForRow(row, detailMap);
      var lineIds = unique(lines.map(lineId));
      var slots = unique([].concat.apply([],lines).map(function(n){return String(Number(n));})).map(Number);
      var lineText = lines.length ? lines.map(lineDisplay).join(' / ') : '成立位置を再計算できませんでした';
      return '<article class="jinpoBondActiveCard" tabindex="0" data-line-ids="'+esc(lineIds.join('|'))+'" data-slots="'+esc(slots.join(','))+'">'+
        '<div class="jinpoBondActiveCardHead"><div class="jinpoBondActiveCardName">'+esc(row['因縁名'] || '')+'</div><div class="jinpoBondActiveCardKind">'+esc(row['因縁種類'] || '')+'</div></div>'+
        '<div class="jinpoBondActiveLine '+(lines.length?'':'jinpoBondActiveNoLine')+'">成立ライン '+esc(lineText)+'</div>'+
        '<div class="jinpoBondFactors">'+factors.map(function(f){ return '<span class="jinpoBondFactor">'+esc(f)+'</span>'; }).join('')+'</div>'+
      '</article>';
    }).join('');
    return '<div class="jinpoBondActiveLayout">'+
      '<section class="jinpoBondFormationPanel">'+
        '<div class="jinpoBondFormationHead"><strong>現在の陣形図'+(formation?'：'+esc(formation):'')+'</strong><span class="jinpoBondFormationHint">右の因縁にカーソルを合わせると対応ラインが光ります</span></div>'+
        renderFormationDiagram()+
      '</section>'+
      '<section class="jinpoBondActiveListPanel">'+
        '<div class="jinpoBondActiveListHead"><strong>発動中因縁</strong><span class="jinpoBondModalCount">'+rows.length+'件</span></div>'+
        '<div class="jinpoBondActiveCards">'+cards+'</div>'+
        '<div class="jinpoBondActiveCardHelp">PCはカーソル、タッチ操作では因縁をタップすると対応ラインを固定表示できます。もう一度タップすると解除します。</div>'+
      '</section>'+
    '</div>';
  }

  function renderAllTable(rows){
    return '<table class="jinpoBondTable">'+
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

    if(modalMode === 'active'){
      body.innerHTML = renderActiveModal(rows);
      bindActiveCardHighlight();
    }else{
      body.innerHTML = renderAllTable(rows);
    }
  }

  async function openModal(mode){
    ensureModal();
    modalMode = mode === 'active' ? 'active' : 'all';
    activeBondNames = modalMode === 'active' ? currentActiveBondNames() : [];
    activeCalculatedResult = modalMode === 'active' && activeBondNames.length ? currentCalculatedResult() : null;
    lockedActiveCard = null;
    var title = document.getElementById('jinpoBondModalTitle');
    var input = document.getElementById('jinpoBondSearch');
    var body = document.getElementById('jinpoBondModalBody');
    var backdrop = document.getElementById('jinpoBondModalBackdrop');
    title.textContent = modalMode === 'active' ? '現在発動中因縁' : '因縁一覧';
    input.placeholder = modalMode === 'active' ? '発動中因縁を検索' : '因縁名・因子で検索';
    input.value = '';
    body.innerHTML = '<div class="jinpoBondEmpty">読み込み中...</div>';
    backdrop.setAttribute('data-mode',modalMode);
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
    lockedActiveCard = null;
    clearDiagramHighlight();
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
