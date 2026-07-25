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

    // 「追加英傑」は専用項目だけを表示する。
    // 組み合わせ件数・修正対象など汎用の target は絶対に表示へ流用しない。
    var direct = String(summary.last_added_hero == null ? '' : summary.last_added_hero).trim();
    if(direct) return direct;

    // v1 summary互換: 新英傑配列がある場合は、その最後の1人だけを表示する。
    var heroes = Array.isArray(summary.new_heroes) ? summary.new_heroes : [];
    for(var i=heroes.length-1;i>=0;i--){
      var hero = heroes[i];
      if(!hero || typeof hero !== 'object') continue;
      var name = String(hero['英傑名'] || hero['名前'] || '').trim();
      if(name) return name;
    }
    return '';
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

    var parts = [];
    if(dateText) parts.push('最終更新 ' + dateText);
    if(heroText) parts.push('追加英傑 ' + heroText);
    var text = parts.join('　｜　');
    el.textContent = text;
    el.title = text;
    el.style.display = '';
    return true;
  }

  function loadLatestSummary(){
    return fetch('data/jinpo_latest_update_summary.json',{cache:'no-store'}).then(function(res){
      if(!res.ok) return false;
      return res.json();
    }).then(function(summary){
      if(!summary || summary === false) return false;
      return render(summary);
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

