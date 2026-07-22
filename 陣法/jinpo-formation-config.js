/**
 * jinpo-formation-config.js
 * 陣形ごとの表示位置・有効ライン・陣形ボーナス。
 *
 * 注意:
 * - slotPositions はZIP内 style.css の実配置を基準。
 * - activeLines は「因縁判定対象の3人ライン」。
 * - ライン定義だけは今後、実画面/画像資料と照合して差し替え可能に分離。
 */
window.JINPO_FORMATION_CONFIG = {
  "衡軛": {
    key: "koeyaku",
    label: "衡軛",
    slots: {
      1: {x: 0, y: 0}, 4: {x: 1, y: 0},
      2: {x: 0, y: 1}, 5: {x: 1, y: 1},
      3: {x: 0, y: 2}, 6: {x: 1, y: 2}
    },
    activeLines: [
      [1,2,3],
      [4,5,6]
    ],
    bonus: {
      "生命": 0.05, "気合": 0.05, "腕力": 0.05, "耐久力": 0.05,
      "器用さ": 0.05, "知力": 0.05, "魅力": 0.05,
      "土属性": 0.05, "水属性": 0.05, "火属性": 0.05, "風属性": 0.05
    }
  },

  "鶴翼": {
    key: "kakuyoku",
    label: "鶴翼",
    slots: {
      1: {x: 0, y: 0}, 4: {x: 1, y: 0},
      2: {x: 0, y: 1}, 5: {x: 1, y: 1},
      3: {x: 0, y: 2}, 6: {x: 1, y: 2}
    },
    activeLines: [
      [1,2,3],
      [4,5,6]
    ],
    bonus: {
      "生命": 0.10,
      "耐久力": 0.10,
      "魅力": 0.10,
      "土属性": 0.10,
      "水属性": 0.10,
      "火属性": 0.10,
      "風属性": 0.10
    }
  },

  "魚鱗": {
    key: "gyorin",
    label: "魚鱗",
    slots: {
      1: {x: 1, y: 0},
      6: {x: 0, y: 1}, 2: {x: 2, y: 1},
      5: {x: 0, y: 2}, 4: {x: 1, y: 2}, 3: {x: 2, y: 2}
    },
    activeLines: [
      [1,2,3],
      [3,4,5],
      [5,6,1]
    ],
    bonus: {
      "気合": 0.10,
      "腕力": 0.10,
      "耐久力": 0.10,
      "器用さ": 0.10
    }
  },

  "方円": {
    key: "hoen",
    label: "方円",
    slots: {
      1: {x: 1, y: 0},
      2: {x: 0, y: 1}, 6: {x: 2, y: 1},
      3: {x: 0, y: 2}, 5: {x: 2, y: 2},
      4: {x: 1, y: 3}
    },
    activeLines: [
      [2,3,4],
      [4,5,6],
      [2,1,6]
    ],
    bonus: {
      "気合": 0.10,
      "知力": 0.10,
      "魅力": 0.10,
      "土属性": 0.10,
      "水属性": 0.10,
      "火属性": 0.10,
      "風属性": 0.10
    }
  }
};

/* jinpo-update-info-from-summary-20260722
 * 陣形ライン右上に「最終更新日 / 最後に追加された英傑」を表示する。
 * 表示内容は追加DBの最新summaryから取得し、jinpo.htmlは変更しない。
 */
(function(){
  'use strict';
  if(window.__jinpoUpdateInfoFromSummaryInstalled) return;
  window.__jinpoUpdateInfoFromSummaryInstalled = true;

  var INFO_ID = 'jinpoUpdateInfoFromSummary';
  var STYLE_ID = 'jinpoUpdateInfoFromSummaryStyle';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.formationMiniPanel.jinpoUpdateInfoHost{position:relative !important;}' +
      '#'+INFO_ID+'{position:absolute;top:9px;right:12px;z-index:6;max-width:68%;' +
      'font-size:12px;line-height:1.35;color:#d9bf83;white-space:nowrap;overflow:hidden;' +
      'text-overflow:ellipsis;text-align:right;pointer-events:none;}' +
      '@media(max-width:760px){#'+INFO_ID+'{font-size:10px;max-width:62%;right:9px;top:10px;}}';
    document.head.appendChild(style);
  }

  function formatDate(value){
    var s = String(value == null ? '' : value).trim();
    var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if(!m) return s;
    return m[1] + '/' + String(m[2]).padStart(2,'0') + '/' + String(m[3]).padStart(2,'0');
  }

  function latestHeroText(summary){
    if(!summary || typeof summary !== 'object') return '';
    var target = String(summary.target == null ? '' : summary.target).trim();
    if(target) return target;
    var heroes = Array.isArray(summary.new_heroes) ? summary.new_heroes : [];
    var names = [];
    heroes.forEach(function(hero){
      if(!hero || typeof hero !== 'object') return;
      var name = String(hero['英傑名'] || hero['名前'] || '').trim();
      if(name && names.indexOf(name) < 0) names.push(name);
    });
    return names.join('、');
  }

  function render(summary){
    var panel = document.querySelector('.formationMiniPanel');
    if(!panel) return false;
    ensureStyle();
    panel.classList.add('jinpoUpdateInfoHost');

    var el = document.getElementById(INFO_ID);
    if(!el){
      el = document.createElement('div');
      el.id = INFO_ID;
      el.setAttribute('aria-live','polite');
      panel.appendChild(el);
    }

    var dateText = formatDate(summary && summary.updated_at);
    var heroText = latestHeroText(summary);
    if(!dateText && !heroText){
      el.style.display = 'none';
      return true;
    }

    var text = '最終更新 ' + (dateText || '未設定') + '　｜　追加英傑 ' + (heroText || '未設定');
    el.textContent = text;
    el.title = text;
    el.style.display = '';
    return true;
  }

  function loadLatestSummary(){
    var loader = window.JINPO_ADDITIONAL_DB;
    if(!loader || typeof loader.discover !== 'function') return Promise.resolve(false);
    return loader.discover().then(function(found){
      var parts = found && Array.isArray(found.parts) ? found.parts : [];
      var latest = null;
      for(var i=parts.length-1;i>=0;i--){
        if(parts[i] && parts[i].summary){ latest = parts[i].summary; break; }
      }
      if(!latest) return false;
      return render(latest);
    }).catch(function(){ return false; });
  }

  function boot(){
    var tries = 0;
    function attempt(){
      tries++;
      loadLatestSummary().then(function(ok){
        if(!ok && tries < 30) setTimeout(attempt, 200);
      });
    }
    attempt();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else setTimeout(boot, 0);
})();

