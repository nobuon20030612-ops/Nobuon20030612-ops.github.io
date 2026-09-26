/**
 * jinpo-formation-config.js
 * 陣形ごとの表示位置・有効ライン・陣形ボーナス。
 * activeLines / slots は data/jinpo_formation_spec.json を正本として同期する。
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
      2: {x: 1, y: 0},
      1: {x: 0, y: 1}, 3: {x: 2, y: 1},
      6: {x: 0, y: 2}, 4: {x: 2, y: 2},
      5: {x: 1, y: 3}
    },
    activeLines: [
      [1,2,3],
      [3,4,5],
      [5,6,1]
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
 * 「最終更新 / 追加英傑」はこの1経路だけで描画する。
 * 陣形ライン枠内ではなく、dbFormationSelectTop の右列上部にある空きスペースへ配置する。
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
    style.textContent = [
      '.dbFormationSelectTop.jinpoUpdateInfoHost{position:relative !important;}',
      '#'+INFO_ID+'{position:absolute;z-index:auto;pointer-events:none;box-sizing:border-box;left:clamp(500px,48%,680px);right:24px;top:10px;height:184px;overflow:visible;}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech{position:absolute;z-index:120;right:68px;top:2px;width:min(360px,calc(100% - 72px));padding:14px 18px 15px;box-sizing:border-box;border:3px solid #f59ab0;border-radius:32px;background:linear-gradient(180deg,#fffdf8 0%,#fff4e3 100%);box-shadow:0 8px 16px rgba(0,0,0,.18), inset 0 0 0 2px rgba(255,255,255,.85);text-align:center;}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech:before{content:"";position:absolute;right:40px;bottom:-18px;width:22px;height:22px;border:3px solid #f59ab0;border-radius:50%;background:linear-gradient(180deg,#fffdf8 0%,#fff4e3 100%);box-shadow:0 4px 8px rgba(0,0,0,.12);}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech:after{content:"";position:absolute;right:18px;bottom:-33px;width:12px;height:12px;border:3px solid #f59ab0;border-radius:50%;background:linear-gradient(180deg,#fffdf8 0%,#fff4e3 100%);box-shadow:0 3px 6px rgba(0,0,0,.12);}',
      '#'+INFO_ID+' .jinpoUpdateInfoLine{display:block;white-space:nowrap;font-weight:1000;letter-spacing:.04em;line-height:1.08;}',
      '#'+INFO_ID+' .jinpoUpdateInfoDate{font-size:20px;color:#f67093;text-shadow:0 1px 0 #fff;}',
      '#'+INFO_ID+' .jinpoUpdateInfoHero{margin-top:7px;font-size:19px;color:#f08b2d;text-shadow:0 1px 0 #fff;}',
      '#'+INFO_ID+' .jinpoUpdateInfoMascot{position:absolute;z-index:400;right:-24px;top:82px;display:block;width:auto;height:142px;max-width:130px;object-fit:contain;object-position:right bottom;transform:scaleX(-1);transform-origin:center center;filter:drop-shadow(0 6px 12px rgba(0,0,0,.44));}',
      '@media(max-width:1500px) and (min-width:901px){',
      '#'+INFO_ID+'{left:clamp(480px,47%,620px);right:20px;top:8px;height:170px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech{right:64px;top:0;width:min(330px,calc(100% - 68px));padding:12px 15px 13px;border-radius:28px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech:before{right:38px;bottom:-16px;width:20px;height:20px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech:after{right:17px;bottom:-29px;width:10px;height:10px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoDate{font-size:18px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoHero{font-size:17px;margin-top:6px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoMascot{right:-20px;top:78px;height:130px;max-width:115px;}',
      '}',
      '@media(max-width:900px){',
      '#'+INFO_ID+'{position:relative;left:auto;right:auto;top:auto;width:100%;height:138px;margin:4px 0 8px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech{right:94px;top:6px;width:min(290px,calc(100% - 100px));padding:10px 12px 11px;border-radius:24px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech:before{right:46px;bottom:-15px;width:16px;height:16px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoSpeech:after{right:24px;bottom:-26px;width:8px;height:8px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoDate{font-size:16px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoHero{font-size:15px;margin-top:5px;}',
      '#'+INFO_ID+' .jinpoUpdateInfoMascot{right:0;top:74px;height:110px;max-width:98px;}',
      '}'
    ].join('');
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
    return String(summary.last_added_hero == null ? '' : summary.last_added_hero).trim();
  }

  function ensureUi(host){
    var el = document.getElementById(INFO_ID);
    if(el){
      if(el.parentNode !== host) host.appendChild(el);
      return el;
    }
    el = document.createElement('div');
    el.id = INFO_ID;
    el.setAttribute('aria-live','polite');

    var speech = document.createElement('div');
    speech.className = 'jinpoUpdateInfoSpeech';
    var date = document.createElement('span');
    date.className = 'jinpoUpdateInfoLine jinpoUpdateInfoDate';
    var hero = document.createElement('span');
    hero.className = 'jinpoUpdateInfoLine jinpoUpdateInfoHero';
    speech.appendChild(date);
    speech.appendChild(hero);

    var img = document.createElement('img');
    img.className = 'jinpoUpdateInfoMascot';
    img.src = 'assets/jinpo-update-mascot.png';
    img.alt = '';
    img.setAttribute('aria-hidden','true');

    el.appendChild(speech);
    el.appendChild(img);
    host.appendChild(el);
    return el;
  }

  function render(summary){
    var host = document.querySelector('#dbCountBrowserCard .dbFormationSelectTop');
    if(!host) return false;
    ensureStyle();
    host.classList.add('jinpoUpdateInfoHost');

    var el = ensureUi(host);
    var dateText = formatDate(summary && summary.updated_at);
    var heroText = latestHeroText(summary);
    if(!dateText && !heroText){
      el.style.display = 'none';
      return true;
    }

    var dateEl = el.querySelector('.jinpoUpdateInfoDate');
    var heroEl = el.querySelector('.jinpoUpdateInfoHero');
    if(dateEl) dateEl.textContent = dateText ? ('最終更新 ' + dateText) : '';
    if(heroEl) heroEl.textContent = heroText ? ('追加英傑　' + heroText) : '';
    el.title = [dateText ? ('最終更新 ' + dateText) : '', heroText ? ('追加英傑 ' + heroText) : ''].filter(Boolean).join(' / ');
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
