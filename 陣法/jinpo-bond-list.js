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
  var activeCalculatedResult = null;
  var lockedActiveCard = null;

  // SAFE_ACTIVE_FORMATION_V1
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
      '#jinpoBondNavActions{width:100%;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:-4px 0 10px 0;box-sizing:border-box;}',
      '#jinpoRecommendNav{display:flex;align-items:center;gap:5px;flex:1 1 720px;min-width:0;flex-wrap:nowrap;}',
      'body.jinpo-recommend-active{--jinpo-rec-accent:#ffd463;--jinpo-rec-accent2:#e7bd5c;--jinpo-rec-bg1:#6f2419;--jinpo-rec-bg2:#26100a;--jinpo-rec-text:#fff5d4;--jinpo-rec-soft:rgba(231,189,92,.18);--jinpo-rec-glow:rgba(231,189,92,.46);}',
      '.jinpoRecommendLabel{flex:0 0 auto;margin-right:3px;color:#ffe1a1;font-size:15px;font-weight:950;white-space:nowrap;}',
      'body.jinpo-recommend-active .jinpoRecommendLabel{color:var(--jinpo-rec-accent);text-shadow:0 0 9px var(--jinpo-rec-glow);}',
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
      '@media(prefers-reduced-motion:reduce){#jinpoRecommendModeBadge.is-active{animation:none;}}',
      '.jinpoRecommendBtn{flex:1 1 0;min-width:46px;min-height:38px;padding:6px 7px;border-radius:10px;border:1px solid #9a7538;background:linear-gradient(#382718,#17100a);color:#f7e9c9;font-size:13px;font-weight:950;line-height:1;cursor:pointer;white-space:nowrap;box-sizing:border-box;}',
      '.jinpoRecommendBtn:hover{filter:brightness(1.15);box-shadow:0 0 12px rgba(231,189,92,.30);}',
      '.jinpoRecommendBtn.active{outline:2px solid #fff4b8;outline-offset:1px;box-shadow:0 0 13px rgba(255,239,170,.72),inset 0 0 8px rgba(255,255,255,.12);}',
      '.jinpoRecommendBtn[data-stat="生命"]{background:#fff;color:#111;border-color:#cfcfcf}.jinpoRecommendBtn[data-stat="気合"]{background:#cfefff;color:#102633;border-color:#78b8da}.jinpoRecommendBtn[data-stat="腕力"]{background:#c93333;color:#fff;border-color:#ff7777}.jinpoRecommendBtn[data-stat="耐久力"]{background:#245fc7;color:#fff;border-color:#70a0ff}.jinpoRecommendBtn[data-stat="器用さ"]{background:#3a9b55;color:#fff;border-color:#75d28d}.jinpoRecommendBtn[data-stat="知力"]{background:#f2d93b;color:#241f00;border-color:#fff083}.jinpoRecommendBtn[data-stat="魅力"]{background:#8b4bb4;color:#fff;border-color:#c88fe8}.jinpoRecommendBtn[data-stat="土属性"]{background:#fff1a8;color:#332800;border-color:#d9c35d}.jinpoRecommendBtn[data-stat="水属性"]{background:#73d7f3;color:#073340;border-color:#b5efff}.jinpoRecommendBtn[data-stat="火属性"]{background:#f3a0a0;color:#4b1111;border-color:#ffd0d0}.jinpoRecommendBtn[data-stat="風属性"]{background:#a8e2a6;color:#173a16;border-color:#d2f4d0}',
      '#jinpoBondNavRight{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto;margin-left:auto;}',
      '#jinpoBondNavActions #jinpoBackBtn.jinpoBackBtn{margin:0 !important;}',
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
      '#jinpoBondModal.jinpoBondModalActiveMode{width:min(1180px,98vw);max-height:96vh;}',
      '#jinpoBondModal.jinpoBondModalActiveMode .jinpoBondSearchWrap{display:none;}',
      '#jinpoBondModal.jinpoBondModalActiveMode .jinpoBondModalBody{padding:12px 14px 14px;overflow-y:auto;overflow-x:hidden;}',
      '.jinpoActiveBondGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px;width:100%;}',
      '.jinpoActiveBondCard{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"meta name" "factors factors";column-gap:9px;row-gap:5px;align-items:center;min-height:58px;padding:8px 10px;border:1px solid rgba(231,189,92,.24);border-radius:10px;background:linear-gradient(180deg,rgba(57,38,20,.86),rgba(31,21,12,.92));box-sizing:border-box;box-shadow:inset 0 0 0 1px rgba(255,255,255,.018);}',
      '.jinpoActiveBondMeta{grid-area:meta;display:flex;align-items:center;gap:5px;white-space:nowrap;color:#cdbb96;font-size:11px;}',
      '.jinpoActiveBondNo{display:inline-flex;align-items:center;justify-content:center;min-width:28px;padding:2px 5px;border:1px solid rgba(231,189,92,.28);border-radius:6px;background:rgba(0,0,0,.24);color:#e3cf9f;font-weight:800;}',
      '.jinpoActiveBondName{grid-area:name;min-width:0;color:#fff0bd;font-size:15px;font-weight:950;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.jinpoActiveBondFactors{grid-area:factors;display:flex;flex-wrap:nowrap;gap:4px;min-width:0;overflow:hidden;}',
      '.jinpoActiveBondFactors .jinpoBondFactor{padding:2px 6px;font-size:11px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;max-width:33%;}',
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
      '.jinpoBondActiveCardTitle{display:flex;align-items:center;gap:10px;min-width:0;}',
      '.jinpoBondActiveCardNo{display:inline-flex;align-items:center;justify-content:center;flex:0 0 34px;width:34px;height:34px;box-sizing:border-box;border:2px solid #fff0a8;border-radius:50%;background:#ffd75c;color:#211507;font-size:19px;font-weight:1000;line-height:1;box-shadow:0 0 12px rgba(255,215,92,.58);}',
      '.jinpoBondActiveCardName{font-weight:1000;color:#fff0bd;font-size:16px;}',
      '.jinpoBondActiveCardKind{font-size:11px;color:#cdbb96;white-space:nowrap;}',
      '.jinpoBondActiveLine{margin:4px 0 7px;color:#ffd75c;font-size:14px;font-weight:900;letter-spacing:.02em;}',
      '.jinpoBondActiveNoLine{color:#bba985;font-weight:700;}',
      '.jinpoBondActiveCard .jinpoBondFactors{margin-top:4px;}',
      '.jinpoBondActiveCardHelp{padding:0 10px 10px;color:#bfae89;font-size:11px;line-height:1.45;}',
      '@media(max-width:980px){.jinpoBondActiveLayout{grid-template-columns:1fr}.jinpoBondFormationDiagram{height:410px;min-height:410px}.jinpoBondActiveCards{max-height:none}}',
      '@media(max-width:560px){.jinpoBondModalHeader{padding:11px 10px}.jinpoBondModalHeader h3{font-size:18px}#jinpoBondModalClose{min-width:92px;height:40px;padding:0 10px;gap:6px;font-size:13px}#jinpoBondModalClose .jinpoBondCloseIcon{width:20px;height:20px;font-size:18px}}',
      '@media(max-width:760px){.jinpoBondActiveLayout{gap:10px;padding-top:10px}.jinpoBondFormationDiagram{height:340px;min-height:340px;margin:6px}.jinpoBondDiagramSlot{width:105px;min-height:56px;padding:5px 4px}.jinpoBondDiagramSlot strong{font-size:12px}.jinpoBondDiagramSlot .jinpoBondSlotHero{font-size:10px}.jinpoBondDiagramSlot .jinpoBondSlotFactors{font-size:8px;max-height:18px}.jinpoBondFormationHint{font-size:10px}.jinpoBondActiveCardNo{flex-basis:32px;width:32px;height:32px;font-size:18px}.jinpoBondActiveCardName{font-size:15px}}',
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
      '@media(max-width:760px){#jinpoBondNavActions{gap:6px}.jinpoRecommendNav{overflow-x:auto;padding-bottom:3px}.jinpoRecommendLabel{font-size:13px}.jinpoRecommendExitBtn{min-width:94px;min-height:36px;font-size:12px;padding:6px 8px}.jinpoRecommendModeNotice{font-size:12px;padding:6px 8px}#jinpoRecommendSumGuide{font-size:15px;padding:10px 12px;margin-bottom:8px}.jinpoRecommendBtn{flex:0 0 52px;font-size:12px;padding:6px 5px;min-height:36px}.jinpoBondNavBtn{font-size:13px;padding:7px 10px;min-height:36px}#jinpoBondNavActions #jinpoBackBtn.jinpoBackBtn{min-width:104px !important;width:104px !important;font-size:14px !important}#jinpoRecommendModeBadge{right:6px;top:auto;bottom:66px;min-width:0;max-width:calc(100vw - 12px);min-height:0;padding:9px 13px;border-radius:12px;writing-mode:horizontal-tb;text-orientation:mixed;font-size:16px;letter-spacing:.03em;transform:none}#jinpoRecommendModeBadge.is-active{display:flex;flex-direction:row;gap:8px;animation:jinpoRecommendModeGlow 1.2s ease-in-out infinite alternate}#jinpoRecommendModeBadge .jinpoRecommendModeBadgeStat{margin:0 0 0 6px;padding:0 0 0 8px;border-top:0;border-left:1px solid var(--jinpo-rec-accent,rgba(255,235,170,.55));font-size:13px}#jinpoScrollTopBtn{right:8px;top:auto;bottom:8px;min-width:126px;max-width:none;min-height:46px;padding:8px 14px;border-radius:12px;writing-mode:horizontal-tb;text-orientation:mixed;font-size:15px;letter-spacing:.02em;gap:8px}#jinpoScrollTopBtn .jinpoScrollTopArrow{font-size:20px}.jinpoBondModalHeader h3{font-size:18px}#jinpoBondModal.jinpoBondModalActiveMode{width:calc(100vw - 8px);max-height:98vh}.jinpoActiveBondGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.jinpoActiveBondCard{min-height:54px;padding:6px 7px;column-gap:5px;row-gap:4px}.jinpoActiveBondMeta{font-size:9px;gap:3px}.jinpoActiveBondNo{min-width:23px;padding:1px 3px}.jinpoActiveBondName{font-size:12px}.jinpoActiveBondFactors{gap:2px}.jinpoActiveBondFactors .jinpoBondFactor{padding:2px 3px;font-size:9px;max-width:33%}.jinpoBondTable{font-size:13px}.jinpoBondTable th:nth-child(2),.jinpoBondTable td:nth-child(2){display:none}.jinpoBondTable th,.jinpoBondTable td{padding:8px 6px}}'
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
      allBtn.addEventListener('click', function(){ openModal('all'); });
    }
    if(allBtn.parentNode!==right)right.appendChild(allBtn);
    var activeBtn = document.getElementById('jinpoBondActiveBtn');
    if(!activeBtn){
      activeBtn = document.createElement('button');activeBtn.type='button';activeBtn.id='jinpoBondActiveBtn';activeBtn.className='jinpoBondNavBtn';activeBtn.textContent='現在発動中因縁';
      activeBtn.addEventListener('click', function(){ openModal('active'); });
    }
    if(activeBtn.parentNode!==right)right.appendChild(activeBtn);
    if(back.parentNode!==right)right.appendChild(back);
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
    var cards = rows.map(function(row,index){
      var factors = [row['因子1'],row['因子2'],row['因子3']].map(text).filter(Boolean);
      var lines = activeLineDataForRow(row, detailMap);
      var lineIds = unique(lines.map(lineId));
      var slots = unique([].concat.apply([],lines).map(function(n){return String(Number(n));})).map(Number);
      var lineText = lines.length ? lines.map(lineDisplay).join(' / ') : '成立位置を再計算できませんでした';
      return '<article class="jinpoBondActiveCard" tabindex="0" data-line-ids="'+esc(lineIds.join('|'))+'" data-slots="'+esc(slots.join(','))+'">'+
        '<div class="jinpoBondActiveCardHead"><div class="jinpoBondActiveCardTitle"><span class="jinpoBondActiveCardNo" aria-label="'+(index+1)+'番目">'+(index+1)+'</span><div class="jinpoBondActiveCardName">'+esc(row['因縁名'] || '')+'</div></div><div class="jinpoBondActiveCardKind">'+esc(row['因縁種類'] || '')+'</div></div>'+
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
    activeCalculatedResult = modalMode === 'active' && activeBondNames.length ? currentCalculatedResult() : null;
    lockedActiveCard = null;
    var title = document.getElementById('jinpoBondModalTitle');
    var input = document.getElementById('jinpoBondSearch');
    var body = document.getElementById('jinpoBondModalBody');
    var backdrop = document.getElementById('jinpoBondModalBackdrop');
    var modal = document.getElementById('jinpoBondModal');
    if(modal) modal.classList.toggle('jinpoBondModalActiveMode', modalMode === 'active');
    title.textContent = modalMode === 'active' ? '現在発動中因縁' : '因縁一覧';
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
    syncRecommendDecorFromSearch();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
  setTimeout(boot,0);
  setTimeout(boot,300);
})();
