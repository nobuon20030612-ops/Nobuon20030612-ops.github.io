param(
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    Write-Host "ファイルは変更していません。" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Enterで閉じる"
    exit 1
}

function Find-RepoRoot {
    param([string]$Start)
    $p = [System.IO.Path]::GetFullPath($Start)
    for ($i = 0; $i -lt 6; $i++) {
        $candidate = Join-Path $p "陣法\jinpo-bond-list.js"
        if (Test-Path -LiteralPath $candidate) { return $p }
        $parent = Split-Path -Parent $p
        if (-not $parent -or $parent -eq $p) { break }
        $p = $parent
    }
    return $null
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Find-RepoRoot -Start $PSScriptRoot
    if (-not $RepoRoot) { $RepoRoot = Find-RepoRoot -Start (Get-Location).Path }
}
if (-not $RepoRoot) {
    Fail "リポジトリ直下を見つけられません。ZIPをリポジトリ直下に展開してから「適用.cmd」を実行してください。"
}

$target = Join-Path $RepoRoot "陣法\jinpo-bond-list.js"
if (-not (Test-Path -LiteralPath $target)) { Fail "陣法\jinpo-bond-list.js が見つかりません。" }

$raw = [System.IO.File]::ReadAllText($target)
$newLine = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
$text = $raw.Replace("`r`n", "`n")

if ($text.Contains("SAFE_ACTIVE_FORMATION_V1")) {
    Write-Host ""
    Write-Host "すでに「現在の陣形図＋ライン発光」差分は適用済みです。" -ForegroundColor Green
    Write-Host "変更は行っていません。"
    Write-Host ""
    Read-Host "Enterで閉じる"
    exit 0
}

# 現行版の重要機能が残っていることを先に確認。
$guards = @(
    "#jinpoRecommendNav",
    "jinpoRecommendModeBadge",
    "function syncRecommendDecorFromSearch()",
    "function calculatedCurrentBondNames()",
    "function renderModal()",
    "現在発動中因縁"
)
foreach ($g in $guards) {
    if (-not $text.Contains($g)) {
        Fail "現行ファイルの安全確認に失敗しました（欠落: $g）。古い版や別版には適用しません。"
    }
}

function Replace-Once([string]$Old, [string]$New, [string]$Label) {
    $first = $script:text.IndexOf($Old, [System.StringComparison]::Ordinal)
    if ($first -lt 0) { Fail "差分位置を確認できませんでした: $Label" }
    $second = $script:text.IndexOf($Old, $first + $Old.Length, [System.StringComparison]::Ordinal)
    if ($second -ge 0) { Fail "差分位置が複数見つかりました: $Label" }
    $script:text = $script:text.Substring(0, $first) + $New + $script:text.Substring($first + $Old.Length)
}

function Insert-Before-Once([string]$Anchor, [string]$Insert, [string]$Label) {
    $first = $script:text.IndexOf($Anchor, [System.StringComparison]::Ordinal)
    if ($first -lt 0) { Fail "差分位置を確認できませんでした: $Label" }
    $second = $script:text.IndexOf($Anchor, $first + $Anchor.Length, [System.StringComparison]::Ordinal)
    if ($second -ge 0) { Fail "差分位置が複数見つかりました: $Label" }
    $script:text = $script:text.Substring(0, $first) + $Insert + $script:text.Substring($first)
}

$stateInsert = @'
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

'@
Replace-Once "  var activeBondNames = [];`n" ("  var activeBondNames = [];`n" + $stateInsert) "状態・陣形定義"

$helpers = @'
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

'@
Insert-Before-Once "  function injectStyle(){`n" $helpers "陣形ヘルパー"

$css = @'
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
      '@media(max-width:980px){.jinpoBondActiveLayout{grid-template-columns:1fr}.jinpoBondFormationDiagram{height:410px;min-height:410px}.jinpoBondActiveCards{max-height:none}}',
      '@media(max-width:760px){.jinpoBondActiveLayout{gap:10px;padding-top:10px}.jinpoBondFormationDiagram{height:340px;min-height:340px;margin:6px}.jinpoBondDiagramSlot{width:105px;min-height:56px;padding:5px 4px}.jinpoBondDiagramSlot strong{font-size:12px}.jinpoBondDiagramSlot .jinpoBondSlotHero{font-size:10px}.jinpoBondDiagramSlot .jinpoBondSlotFactors{font-size:8px;max-height:18px}.jinpoBondFormationHint{font-size:10px}.jinpoBondActiveCardName{font-size:15px}}',
'@
Insert-Before-Once "      '.jinpoBondTable{width:100%;border-collapse:separate;border-spacing:0 7px;font-size:14px;}',`n" $css "陣形図スタイル"

$currentCalc = @'
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

'@
Insert-Before-Once "  function calculatedCurrentBondNames(){`n" $currentCalc "陣形再計算"

$oldCalcBlock = @'
      if(typeof placement === 'undefined' || !placement || typeof inenMaster === 'undefined' || !Array.isArray(inenMaster)) return [];
      var sel = document.getElementById('formationSelect');
      var formation = text(sel && sel.value);
      if(!formation) return [];
      var result = window.JinpoActivationEngine.calculateFormation(placement, formation, inenMaster, window.JINPO_FORMATION_CONFIG);
'@
$newCalcBlock = @'
      var result = currentCalculatedResult();
'@
Replace-Once ($oldCalcBlock + "`n") ($newCalcBlock + "`n") "発動因縁再計算の共通化"

$activeFunctions = @'
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

'@
Insert-Before-Once "  function renderModal(){`n" $activeFunctions "発動中因縁モーダル描画"

$oldActive = @'
    if(modalMode === 'active'){
      body.innerHTML = '<div class="jinpoActiveBondGrid">'+rows.map(function(row){
        var factors = [row['因子1'],row['因子2'],row['因子3']].map(text).filter(Boolean);
        return '<div class="jinpoActiveBondCard">'+
          '<div class="jinpoActiveBondMeta"><span class="jinpoActiveBondNo">'+esc(row['No'] || '')+'</span><span>'+esc(row['因縁種類'] || '')+'</span></div>'+
          '<div class="jinpoActiveBondName" title="'+esc(row['因縁名'] || '')+'">'+esc(row['因縁名'] || '')+'</div>'+
          '<div class="jinpoActiveBondFactors">'+factors.map(function(f){ return '<span class="jinpoBondFactor" title="'+esc(f)+'">'+esc(f)+'</span>'; }).join('')+'</div>'+
        '</div>';
      }).join('')+'</div>';
      return;
    }
'@
$newActive = @'
    if(modalMode === 'active'){
      body.innerHTML = renderActiveModal(rows);
      bindActiveCardHighlight();
      return;
    }
'@
Replace-Once ($oldActive + "`n") ($newActive + "`n") "発動中因縁表示"

Replace-Once "    activeBondNames = modalMode === 'active' ? currentActiveBondNames() : [];`n" @'
    activeBondNames = modalMode === 'active' ? currentActiveBondNames() : [];
    activeCalculatedResult = modalMode === 'active' && activeBondNames.length ? currentCalculatedResult() : null;
    lockedActiveCard = null;
'@ "モーダル開始時の再計算"

Replace-Once "    backdrop.classList.add('is-open');`n" @'
    backdrop.setAttribute('data-mode',modalMode);
    backdrop.classList.add('is-open');
'@ "モーダル種別"

Replace-Once "    if(!backdrop) return;`n    backdrop.classList.remove('is-open');`n" @'
    if(!backdrop) return;
    lockedActiveCard = null;
    clearDiagramHighlight();
    backdrop.classList.remove('is-open');
'@ "モーダル終了処理"

# 最終ガード。おすすめ機能を消していないことと、今回の機能が揃ったことを確認。
$requiredAfter = @(
    "#jinpoRecommendNav",
    "function syncRecommendDecorFromSearch()",
    "SAFE_ACTIVE_FORMATION_V1",
    "ACTIVE_FORMATION_VIEW",
    "function liveFormationSlotPositions()",
    "function currentCalculatedResult()",
    "act.occurrences",
    "function renderFormationDiagram()",
    "jinpoBondActiveLayout",
    "jinpoBondFormationDiagram",
    "jinpoBondDiagramLine.is-hover",
    "data-line-ids",
    "成立ライン ",
    "function setDiagramHighlight",
    "function bindActiveCardHighlight()",
    "現在の陣形図"
)
foreach ($g in $requiredAfter) {
    if (-not $text.Contains($g)) { Fail "適用後検証に失敗しました（欠落: $g）。" }
}

# 変更直前にバックアップを作る。ここまで失敗した場合は一切書き込まない。
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$target.bak_$stamp"
[System.IO.File]::Copy($target, $backup, $false)

$outText = if ($newLine -eq "`r`n") { $text.Replace("`n", "`r`n") } else { $text }
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($target, $outText, $utf8NoBom)

Write-Host ""
Write-Host "完了: 現在発動中因縁モーダルへ「現在の陣形図＋成立ライン発光」を追加しました。" -ForegroundColor Green
Write-Host "変更ファイル: 陣法\jinpo-bond-list.js"
Write-Host "バックアップ: $([System.IO.Path]::GetFileName($backup))"
Write-Host "おすすめ陣法など既存コードは削除せず、現行ファイルへの差分追加だけです。"
Write-Host ""
Read-Host "Enterで閉じる"
