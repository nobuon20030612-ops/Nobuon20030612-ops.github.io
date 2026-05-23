/**
 * =====================================================
 * 英傑陣法シミュレーション - メインスクリプト
 * =====================================================
 *
 * 【アプリケーション概要】
 * 「信長の野望 Online」の英傑陣法システムをシミュレートし、
 * 6体の英傑配置による因縁発動効果を最適化するツール。
 *
 * 【主要機能】
 * 1. 英傑データ管理 - CSVから読み込んだ英傑/因縁データの処理
 * 2. フィルタリング - 職業/因子/キーワードによる絞り込み
 * 3. 陣形配置 - 6スロットへのドラッグ&ドロップ配置
 * 4. 因縁計算 - 隣接パターンに基づく因縁発動判定
 * 5. 最適化 - 配置順序の全探索による最適解算出
 *
 * 【依存関係】
 * - CSVLoader (csv-loader.js)
 * - DOMRenderer (dom-renderer.js)
 * - CollectionManager (ai-support/collection-manager.js)
 *
 * @version 5.3.0
 * @last_updated 2025/12/17
 * @refactored 2025/12/20 - デバッグコード削除、重複コード統合
 */
const VERSION = "5.3.0";
let EIKETSU_DATA = [];
let INEN_DATA = [];
let PRIORITY_EIKETSU_NAMES = new Set();
let sortState = { column: "addedOrder", ascending: false };
window.sortState = sortState;
let bondFactorFilter = [];
let lastUpdatedDate = "2025/12/17";
let inenCache = new Map();
// [最適化] optimalCalculationInProgress, optimalCalculationCache → optimization.js に分離済み (2026-03-21)
let inenStatusFilter = "all";
let inenTypeFilter = "";
let isLoadingFromURL = false;
let currentFormation = "hoen";
window.currentFormation = currentFormation;
// [推奨エンジン] recommendationSortState → recommendation-engine.js に分離済み (2026-03-21)
// [最適化] globalOptimizationWorker, globalOptimizationInProgress, globalOptimizationCancelled, globalOptimizationResults → optimization.js に分離済み (2026-03-21)
let currentStatFilter = "";
window.selectedEiketsu = Array(6).fill(null);

// 方円・魚鱗の表示用スロット番号を返す（1つずれ補正）
// 内部index: 5→表示1, 0→表示2, 1→表示3, 2→表示4, 3→表示5, 4→表示6
function getSlotDisplayNumber(index) {
  if (currentFormation === 'hoen' || currentFormation === 'gyorin') {
    return ((index + 1) % 6) + 1;
  }
  return index + 1;
}
window.getSlotDisplayNumber = getSlotDisplayNumber;

// 方円・魚鱗の表示番号順で最初の空きスロットindexを返す
// 表示1(idx5)→2(idx0)→3(idx1)→4(idx2)→5(idx3)→6(idx4)
const CIRCULAR_FILL_ORDER = [5, 0, 1, 2, 3, 4];
function findEmptySlotIndex() {
  if (currentFormation === 'hoen' || currentFormation === 'gyorin') {
    for (const idx of CIRCULAR_FILL_ORDER) {
      if (selectedEiketsu[idx] === null) return idx;
    }
    return -1;
  }
  return selectedEiketsu.findIndex((slot) => slot === null);
}

// =====================================================
// [Section 0.1] 外部config.js統合
// =====================================================
// config.jsがES Moduleとして読み込まれた場合、
// window.EiketsuJinpoConfigから設定を取得できる
(function checkConfigIntegration() {
  if (window.EiketsuJinpoConfig) {
    if (window.DEBUG) console.log(
      "[eiketsu-jinpo] config.js loaded:",
      Object.keys(window.EiketsuJinpoConfig).join(", "),
    );
  } else {
    if (window.DEBUG) console.log("[eiketsu-jinpo] Using inline config (config.js not loaded)");
  }
})();

// =====================================================
// [Section 0.2] 高速検索エンジン初期化
// =====================================================
// 32万行データでも瞬時検索可能な高性能エンジン
// factor-engine.js, worker-pool.js, high-perf-search.js

/**
 * 高速検索エンジンの初期化
 * データ読み込み後に呼び出す
 */
async function initHighPerfSearch() {
  if (!window.highPerfSearch || !window.factorEngine) {
    if (window.DEBUG) console.log(
      "[eiketsu-jinpo] High-perf search not loaded (ES Module required)",
    );
    return false;
  }

  try {
    if (window.DEBUG) console.time("[eiketsu-jinpo] High-perf engine init");

    // 英傑データをFactorEngineに読み込み
    const eiketsuData = window.EIKETSU_DATA || window.loadedData;
    if (eiketsuData && eiketsuData.length > 0) {
      window.factorEngine.loadEiketsuData(eiketsuData);
    }

    // 因縁データを読み込み（factors_inen.csvから）
    const inenData = window.INEN_DATA || window.inenData;
    if (inenData && inenData.length > 0) {
      window.factorEngine.loadInenData(inenData);
    }

    // HighPerfSearch初期化
    await window.highPerfSearch.init({
      eiketsuData: eiketsuData,
      inenData: inenData,
      useWorkers: false, // 初期は無効、安定したら有効化
    });

    if (window.DEBUG) console.timeEnd("[eiketsu-jinpo] High-perf engine init");
    if (window.DEBUG) console.log(
      "[eiketsu-jinpo] High-perf engine ready:",
      window.factorEngine.getStats(),
    );

    return true;
  } catch (e) {
    console.error("[eiketsu-jinpo] High-perf engine init failed:", e);
    return false;
  }
}

// グローバル公開
window.initHighPerfSearch = initHighPerfSearch;

// =====================================================
// [Section 0.5] 選択状態の差分検出システム
// =====================================================
// パフォーマンス改善: 選択状態が変わっていない場合は再計算をスキップ
let lastSelectionHash = "";
let lastFormation = "";

/**
 * 現在の選択状態のハッシュを生成
 * 英傑名 + 凸状態 + 信頼度 + 分国Statusを連結
 */
function getSelectionHash() {
  return (
    selectedEiketsu
      .map((s) =>
        s
          ? `${s.eiketsu.name}:${s.limitBreak}:${s.trust20}:${s.bunkoku}`
          : "null",
      )
      .join("|") +
    ":" +
    currentFormation
  );
}

/**
 * 選択状態が変更されたかどうかをチェック
 * @returns {boolean} true = 変更あり / false = 変更なし
 */
function hasSelectionChanged() {
  const currentHash = getSelectionHash();
  if (currentHash === lastSelectionHash) {
    return false;
  }
  lastSelectionHash = currentHash;
  return true;
}

/**
 * スマートキャッシュクリア
 * 選択状態が実際に変わった場合のみキャッシュをクリア
 */
function smartClearCaches() {
  if (!hasSelectionChanged()) {
    return false; // 変更なし、スキップ
  }
  clearCaches();
  return true;
}

// =====================================================
// [Section 1] パフォーマンス最適化キャッシュ
// =====================================================
/**
 * ALSO_EXPORTED_AS_MODULE: This section is also available from './performance-index.js'
 * When migrating: import { performanceCache, getEiketsuByFactor, ... } from './performance-index.js';
 * Or use window.EiketsuJinpoPerformanceIndex
 */
const performanceCache = {
  // 因子→英傑のインデックス（高速検索用）
  factorToEiketsuMap: new Map(),
  // 英傑名→英傑データのマップ
  eiketsuNameMap: new Map(),
  // 因縁名→因縁データのマップ
  inenNameMap: new Map(),
  // 代替英傑キャッシュ（SlotIndex + 因子 → 結果）
  alternativeCache: new Map(),
  // 最終更新タイムスタンプ
  lastBuildTime: 0,
  // キャッシュビルド済みフラグ
  isBuilt: false,
};

// パフォーマンスインデックスをビルド
function buildPerformanceIndex() {
  if (performanceCache.isBuilt) return;

  const startTime = performance.now();

  // 英傑名マップをビルド
  if (EIKETSU_DATA && EIKETSU_DATA.length > 0) {
    performanceCache.eiketsuNameMap.clear();
    performanceCache.factorToEiketsuMap.clear();

    EIKETSU_DATA.forEach((eiketsu) => {
      // 名前マップ
      performanceCache.eiketsuNameMap.set(eiketsu.name, eiketsu);

      // 因子→英傑マップ
      const factors = eiketsu.factors || [];
      factors.forEach((factor) => {
        if (factor) {
          if (!performanceCache.factorToEiketsuMap.has(factor)) {
            performanceCache.factorToEiketsuMap.set(factor, []);
          }
          performanceCache.factorToEiketsuMap.get(factor).push(eiketsu);
        }
      });
    });
  }

  // 因縁名マップをビルド
  if (INEN_DATA && INEN_DATA.length > 0) {
    performanceCache.inenNameMap.clear();
    INEN_DATA.forEach((inen) => {
      performanceCache.inenNameMap.set(inen.name, inen);
    });
  }

  performanceCache.isBuilt = true;
  performanceCache.lastBuildTime = Date.now();

  const endTime = performance.now();
}

// 因子から英傑を高速検索
function getEiketsuByFactor(factor) {
  if (!performanceCache.isBuilt) buildPerformanceIndex();
  return performanceCache.factorToEiketsuMap.get(factor) || [];
}

// 英傑名から英傑データを高速取得
function getEiketsuByName(name) {
  if (!performanceCache.isBuilt) buildPerformanceIndex();
  return performanceCache.eiketsuNameMap.get(name);
}

// 因縁名から因縁データを高速取得
function getInenByName(name) {
  if (!performanceCache.isBuilt) buildPerformanceIndex();
  return performanceCache.inenNameMap.get(name);
}

// 代替英傑キャッシュをクリア
function clearAlternativeCache() {
  performanceCache.alternativeCache.clear();
}

// パフォーマンスキャッシュをリセット
function resetPerformanceCache() {
  performanceCache.factorToEiketsuMap.clear();
  performanceCache.eiketsuNameMap.clear();
  performanceCache.inenNameMap.clear();
  performanceCache.alternativeCache.clear();
  performanceCache.isBuilt = false;
}

// グローバル公開
window.buildPerformanceIndex = buildPerformanceIndex;
window.getEiketsuByFactor = getEiketsuByFactor;
window.getEiketsuByName = getEiketsuByName;
window.getInenByName = getInenByName;
window.clearAlternativeCache = clearAlternativeCache;
window.performanceCache = performanceCache;

// =====================================================
// [Section 2] イベントハンドラ - 英傑選択・クリック処理
// =====================================================

function handleEiketsuRowClick(event, eiketsu) {
  if (!eiketsu || !eiketsu.name) {
    return;
  }
  if (typeof window.handleUnifiedEiketsuClick === "function") {
    return window.handleUnifiedEiketsuClick(event, eiketsu);
  } else {
    return handleStandardEiketsuSelection(event, eiketsu);
  }
}
function handleStandardEiketsuSelection(event, eiketsu) {
  if (event.shiftKey) {
    const scm = window.simpleCollectionManager || window.scm;
    if (scm && typeof scm.hasEiketsu === "function") {
      if (scm.hasEiketsu(eiketsu.name)) {
        scm.removeEiketsu(eiketsu.name);
        showMessage(
          i18n.t("msg_removed_from_owned", { name: eiketsu.name }),
          "info",
        );
      } else {
        scm.addEiketsu(eiketsu.name);
        showMessage(
          i18n.t("msg_added_to_owned", { name: eiketsu.name }),
          "success",
        );
      }
      scm.saveCollection();
      updateOwnedCountDisplay();
    }
    return;
  }
  const selectedNames = selectedEiketsu
    .filter((e) => e)
    .map((e) => e.eiketsu.name);
  const isSelected = selectedNames.includes(eiketsu.name);
  if (isSelected) {
    const selectedIndex = selectedEiketsu.findIndex(
      (slot) => slot && slot.eiketsu.name === eiketsu.name,
    );
    if (selectedIndex !== -1) {
      selectedEiketsu[selectedIndex] = null;
      showMessage(i18n.t("msg_deselected", { name: eiketsu.name }), "info");
    }
  } else {
    if (!canPlaceEiketsu(eiketsu)) {
      const formation = FORMATIONS[currentFormation];
      showMessage(
        `${formation.name}陣形のコスト制限(${formation.costLimit})を超えるため配置できません`,
        "error",
      );
      return;
    }
    const emptyIndex = findEmptySlotIndex();
    if (emptyIndex === -1) {
      showMessage(i18n.t("msg_slots_full"), "warning");
      return;
    }
    selectedEiketsu[emptyIndex] = {
      eiketsu: eiketsu,
      limitBreak: 4,
      trust20: true,
      bunkoku: !!(eiketsu.factors && eiketsu.factors[3]),
    };
    showMessage(i18n.t("msg_selected", { name: eiketsu.name }), "success");
    // 英傑選択をログ
    if (typeof logEiketsuSelection === "function")
      logEiketsuSelection(eiketsu.name);
  }
  // パフォーマンス改善: 同じ選択状態ならキャッシュクリアをスキップ
  smartClearCaches();
  updateAll();
}
function getAddedYear(eiketsu) {
  if (eiketsu.addedDate) {
    return eiketsu.addedDate;
  }
  const addedOrder = eiketsu.addedOrder || 0;
  if (addedOrder < 50) return "2020以前";
  if (addedOrder < 100) return "2021";
  if (addedOrder < 150) return "2022";
  if (addedOrder < 200) return "2023";
  if (addedOrder < 250) return "2024";
  return "2025";
}
function getAvailableFactors(slot) {
  if (!slot || !slot.eiketsu) return [];
  const factors = [];
  const eiketsuFactors = slot.eiketsu.factors || [];
  if (eiketsuFactors[0]) factors.push(eiketsuFactors[0]);
  if (slot.limitBreak >= 2 && eiketsuFactors[1])
    factors.push(eiketsuFactors[1]);
  if (slot.trust20 && eiketsuFactors[2]) factors.push(eiketsuFactors[2]);
  if (slot.bunkoku && eiketsuFactors[3]) factors.push(eiketsuFactors[3]);
  return factors.filter(Boolean);
}
window.getAvailableFactors = getAvailableFactors;

// [最適化] startGlobalOptimization, startOwnedOptimization, selectTopCandidates,
// showGlobalOptimizationResult, closeGlobalOptimizationResult, applyGlobalOptimizationResult
// → optimization.js に分離済み (2026-03-21)

/**
 * ALSO_EXPORTED_AS_MODULE: This object is also available from './cache-utils.js'
 * When migrating: import { cacheSystem } from './cache-utils.js';
 * Or use window.EiketsuJinpoCacheSystem
 */
const cacheSystem = {
  inenResults: new Map(),
  filterResults: new Map(),
  recommendationResults: new Map(),
  // パフォーマンス改善: キャッシュサイズを拡大
  maxSize: 500,
  getKey(type, ...args) {
    return `${type}:${JSON.stringify(args)}`;
  },
  get(type, ...args) {
    return this[type + "Results"].get(this.getKey(type, ...args));
  },
  set(type, value, ...args) {
    const key = this.getKey(type, ...args);
    const cache = this[type + "Results"];
    if (cache.size >= this.maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, value);
  },
  clear(type) {
    if (type) {
      this[type + "Results"].clear();
    } else {
      this.inenResults.clear();
      this.filterResults.clear();
      this.recommendationResults.clear();
    }
  },
  // パフォーマンス改善: フィルター変更時は推奨キャッシュを保持
  clearFilterOnly() {
    this.filterResults.clear();
  },
};
window.cacheSystem = cacheSystem;
let updateDebounceTimer = null;
let rafId = null;

/**
 * 最適化されたデバウンス更新
 * - requestAnimationFrameを使用してスムーズな描画
 * - 連続呼び出しを効率的に処理
 *
 * NOTE: Similar to SharedUtils.debounce but includes rAF optimization
 * Consider using SharedUtils.debounce for simpler use cases
 */
function debounceUpdate(func, delay = 100) {
  clearTimeout(updateDebounceTimer);
  if (rafId) cancelAnimationFrame(rafId);

  updateDebounceTimer = setTimeout(() => {
    rafId = requestAnimationFrame(() => {
      func();
      rafId = null;
    });
  }, delay);
}

/**
 * 即時更新（デバウンスなし）- 緊急用
 */
function immediateUpdate(func) {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    func();
    rafId = null;
  });
}
/**
 * =====================================
 * [Section 4] 陣形定義（config.jsから読み込み）
 * =====================================
 *
 * 定数はconfig.jsモジュールで定義され、
 * window.EiketsuJinpoConfigから参照します。
 * これにより重複を排除し、一元管理を実現。
 */

// config.jsからの定数参照（ES Module経由でグローバル公開済み）
const _config = window.EiketsuJinpoConfig || {};
const FORMATIONS = _config.FORMATIONS || {};
window.FORMATIONS = FORMATIONS;
const BOND_BOOST_PERCENTAGES = _config.BOND_BOOST_PERCENTAGES || {};
const NEW_CALCULATION_COEFFICIENTS = _config.NEW_CALCULATION_COEFFICIENTS || {};
const FORMATION_STAT_BONUSES = _config.FORMATION_STAT_BONUSES || {};

// フォールバック：config.jsが読み込まれていない場合の警告
if (!window.EiketsuJinpoConfig) {
  console.warn("[eiketsu-jinpo] config.js not loaded - using empty fallback");
}
function calculateAndDisplayTotalStatBoosts() {
  try {
    let formationArea = document.querySelector(
      ".selected-eiketsu-container",
    )?.parentElement;
    if (!formationArea) return;
    const existingDisplay = document.getElementById("total-boosts-display");
    if (existingDisplay) existingDisplay.remove();

    const leftStats = [
      "生命",
      "気合",
      "腕力",
      "耐久力",
      "器用さ",
      "知力",
      "魅力",
    ];
    const rightStats = ["土", "水", "火", "風"];
    const allStatKeys = [...leftStats, ...rightStats];

    // CSV由来のステータスを優先チェック（applyFormationFromLibrary経由）
    let appliedStats = window._appliedFormationStats;
    if (appliedStats) {
      window._appliedFormationStats = null; // 一度使ったらクリア
    }

    // CSV値ルックアップを試みる（search_formations.json の事前計算値）
    let csvLookup = null;
    const filledSlots = selectedEiketsu.filter(s => s && s.eiketsu);
    if (!appliedStats && filledSlots.length === 6 && typeof window.lookupFormationStats === "function") {
      const memberNames = selectedEiketsu.map(s => s && s.eiketsu ? s.eiketsu.name : "");
      csvLookup = window.lookupFormationStats(memberNames);
      // 未ロードなら次回以降のためにバックグラウンドでロード開始
      if (!csvLookup && typeof window.loadSearchFormations === "function") {
        window.loadSearchFormations();
      }
    }

    let boostValues; // { stat: number }
    let isFromCSV = false;

    if (appliedStats) {
      // 適用ボタンから直接渡されたCSV値を使用
      isFromCSV = true;
      boostValues = {};
      const statOrder = ["生命","気合","腕力","耐久力","器用さ","知力","魅力","土","水","火","風"];
      statOrder.forEach((stat, i) => {
        boostValues[stat] = appliedStats[i] || 0;
      });
    } else if (csvLookup) {
      // search_formations.json のルックアップ値を使用
      isFromCSV = true;
      boostValues = {};
      const statOrder = ["生命","気合","腕力","耐久力","器用さ","知力","魅力","土","水","火","風"];
      statOrder.forEach((stat, i) => {
        boostValues[stat] = csvLookup.stats[i] || 0;
      });
    } else {
      // CSV値が見つからない → 従来の計算式でフォールバック
      const { inenBoosts, formationBoosts } = calculateAllBoosts();
      boostValues = {};
      allStatKeys.forEach(stat => {
        boostValues[stat] = Math.floor((inenBoosts[stat] || 0) + (formationBoosts[stat] || 0));
      });
    }

    const displayDiv = document.createElement("div");
    displayDiv.id = "total-boosts-display";
    displayDiv.className =
      "bg-sky-50 border border-sky-200 p-3 sm:p-4 rounded-lg shadow mt-4";

    // 現在の陣形で陣形ボーナスが乗るステータスを判定
    const formationBonusRules =
      (typeof FORMATION_STAT_BONUSES !== "undefined" && typeof currentFormation !== "undefined")
        ? (FORMATION_STAT_BONUSES[currentFormation] || {})
        : {};

    let leftContent = "", rightContent = "";
    const createStatHTML = (stat) => {
      const value = boostValues[stat] || 0;
      const statName = rightStats.includes(stat) ? `${stat}属性` : stat;
      // 陣形ボーナスが該当するステのみ青文字(has-bonus)
      const hasFormationBonus = (formationBonusRules[stat] || 0) > 0;
      const valueClass = hasFormationBonus ? "value has-bonus" : "value";
      return `<div class="boost-item"><strong>${statName}</strong><span class="${valueClass}">+${value}</span></div>`;
    };
    let hasAnyBoosts = false;
    leftStats.forEach((stat) => {
      if (boostValues[stat] > 0) {
        hasAnyBoosts = true;
        leftContent += createStatHTML(stat);
      }
    });
    rightStats.forEach((stat) => {
      if (boostValues[stat] > 0) {
        hasAnyBoosts = true;
        rightContent += createStatHTML(stat);
      }
    });
    if (hasAnyBoosts) {
      const sourceLabel = isFromCSV ? "" : "<span class=\"title-note\">※参考値</span>";
      displayDiv.innerHTML = `
                <h4 class="total-boosts-title">
                    ☑ 合計上昇値 <span class="title-supplement">因縁 + 陣形</span>${sourceLabel}
                </h4>
                <div class="boosts-2col">
                    <div class="boosts-col">${leftContent}</div>
                    <div class="boosts-col">${rightContent}</div>
                </div>`;
    } else {
      displayDiv.innerHTML = `<div class="no-boosts-message">上昇するステータスはありません。</div>`;
    }
    if (formationArea.nextSibling) {
      formationArea.parentNode.insertBefore(
        displayDiv,
        formationArea.nextSibling,
      );
    } else {
      formationArea.parentNode.appendChild(displayDiv);
    }
  } catch (error) {
    console.error("ステータス表示エラー:", error);
  }
}
function getCurrentAdjacentPatterns() {
  const formation = FORMATIONS[currentFormation];
  if (!formation) {
    return [
      [0, 1, 2],
      [3, 4, 5],
    ];
  }
  return formation.adjacentPatterns;
}
window.getCurrentAdjacentPatterns = getCurrentAdjacentPatterns;
function checkCostLimit() {
  const formation = FORMATIONS[currentFormation];
  if (!formation) return { totalCost: 0, costLimit: 36, isOverLimit: false };
  let totalCost = 0;
  selectedEiketsu.forEach((slot) => {
    if (slot) {
      const cost = (slot.eiketsu.cost || 10) - slot.limitBreak;
      totalCost += Math.max(cost, 1);
    }
  });
  return {
    totalCost,
    costLimit: formation.costLimit,
    isOverLimit: totalCost > formation.costLimit,
  };
}
function canPlaceEiketsu(eiketsu) {
  const formation = FORMATIONS[currentFormation];
  if (!formation) return true;
  if (selectedEiketsu.filter((slot) => slot === null).length === 0)
    return false;
  let totalCost = 0;
  selectedEiketsu.forEach((slot) => {
    if (slot) {
      const cost = (slot.eiketsu.cost || 10) - slot.limitBreak;
      totalCost += Math.max(cost, 1);
    }
  });
  const newCost = Math.max((eiketsu.cost || 10) - 4, 1);
  return totalCost + newCost <= formation.costLimit;
}
window.canPlaceEiketsu = canPlaceEiketsu;

// =====================================================
// [Section 5] ドラッグ＆ドロップ - スロット間の英傑移動
// ※ D&D関連関数・状態は drag-drop.js に分離済み
// =====================================================

function swapEiketsu(sourceIndex, targetIndex) {
  const sourceSlot = selectedEiketsu[sourceIndex];
  const targetSlot = selectedEiketsu[targetIndex];
  selectedEiketsu[sourceIndex] = targetSlot;
  selectedEiketsu[targetIndex] = sourceSlot;
  const sourceName = sourceSlot ? sourceSlot.eiketsu.name : "空きスロット";
  const targetName = targetSlot ? targetSlot.eiketsu.name : "空きスロット";
  if (sourceSlot && targetSlot) {
    showMessage(
      i18n.t("msg_swapped", { source: sourceName, target: targetName }),
      "success",
    );
  } else if (sourceSlot && !targetSlot) {
    showMessage(
      `${sourceName} をスロット${getSlotDisplayNumber(targetIndex)}に移動しました`,
      "success",
    );
  } else if (!sourceSlot && targetSlot) {
    showMessage(
      `${targetName} をスロット${getSlotDisplayNumber(sourceIndex)}に移動しました`,
      "success",
    );
  }
  clearCaches();
  updateAll();
}
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (window.dragState && window.dragState.isDragging) {
        if (window.dragState.draggedElement) {
          window.dragState.draggedElement.style.opacity = "1";
          window.dragState.draggedElement.classList.remove("dragging");
        }
        if (typeof removeDropTargetHighlights === "function") removeDropTargetHighlights();
        if (typeof resetDragState === "function") resetDragState();
        showMessage(i18n.t("msg_move_cancelled"), "info");
      }
      if (window.mobileSwapState && window.mobileSwapState.selectedSlotIndex !== null) {
        if (typeof cancelMobileSwap === "function") cancelMobileSwap();
      }
    }
  });
  document.addEventListener("click", (e) => {
    if (
      window.mobileSwapState && window.mobileSwapState.selectedSlotIndex !== null &&
      !e.target.closest(".selected-slot")
    ) {
      if (typeof cancelMobileSwap === "function") cancelMobileSwap();
    }
  });
}

// =====================================================
// [Section 6] 初期化・データ読み込み
// =====================================================

let isInitialized = false;
let isDataLoaded = false;
async function loadData(maxRetries = 3) {
  if (isDataLoaded) return true;
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const loadingElement = document.getElementById("loading");
      if (attempt > 1 && loadingElement) {
        loadingElement.innerHTML = `<div class="spinner"></div><p style="color: #6b7280;">データ読み込み中... (リトライ ${attempt}/${maxRetries})</p>`;
      }
      if (!window.csvLoader) window.csvLoader = new CSVLoader();
      await window.csvLoader.loadAllData();
      EIKETSU_DATA = window.csvLoader.getEiketsuData();
      window.EIKETSU_DATA = EIKETSU_DATA;
      PRIORITY_EIKETSU_NAMES = window.csvLoader.getPriorityEiketsuNames();
      if (!EIKETSU_DATA || EIKETSU_DATA.length === 0)
        throw new Error("英傑データの取得に失敗しました");
      // カスタム英傑マージ用イベント発火
      window.dispatchEvent(new CustomEvent('eiketsu-data-loaded'));
      const statKeys = [
        "生命",
        "気合",
        "腕力",
        "耐久力",
        "器用さ",
        "知力",
        "魅力",
        "土",
        "火",
        "水",
        "風",
      ];
      EIKETSU_DATA.forEach((eiketsu, index) => {
        if (typeof eiketsu.addedOrder === "undefined")
          eiketsu.addedOrder = index;
        let totalStats = 0;
        if (eiketsu.stats) {
          statKeys.forEach((key) => {
            totalStats += eiketsu.stats[key] || 0;
          });
        }
        eiketsu.totalStats = totalStats;
      });
      INEN_DATA = window.csvLoader.getInenData();
      window.INEN_DATA = INEN_DATA;
      if (!INEN_DATA || INEN_DATA.length === 0)
        throw new Error("因縁データの取得に失敗しました");
      INEN_DATA.forEach((inen, index) => {
        inen.csvOrder = index;
      });

      // パフォーマンス改善: データ読み込み直後にインデックスを構築
      // これにより初回の英傑検索・因縁判定が高速化される
      buildPerformanceIndex();

      // 最終更新日をCSVデータのaddedDate最大値から動的取得
      const maxAddedDate = EIKETSU_DATA.reduce((max, hero) => {
        if (hero.addedDate && hero.addedDate > max) return hero.addedDate;
        return max;
      }, "");
      if (maxAddedDate) lastUpdatedDate = maxAddedDate;

      isDataLoaded = true;
      return true;
    } catch (error) {
      lastError = error;
      console.warn(
        `[loadData] attempt ${attempt}/${maxRetries} failed:`,
        error.message,
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  // 全リトライ失敗
  const loadingElement = document.getElementById("loading");
  if (loadingElement) {
    loadingElement.innerHTML = `<div class="spinner"></div><p style="color: #ef4444;">データの読み込みに失敗しました</p><p style="font-size: 12px; color: #6b7280;">エラー: ${lastError.message}</p><button onclick="location.reload()" style="margin-top: 12px; padding: 8px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">ページを再読み込み</button>`;
  }
  return false;
}
function initializePage() {
  if (isInitialized) return;
  setTimeout(() => {
    if (typeof redesignFormationArea === "function") {
      redesignFormationArea();
    }
  }, 50);
  setupEventListeners();
  populateAllDropdowns();
  setupKeyboardShortcuts();
  if (!window.filteredEiketsu && window.EIKETSU_DATA) {
    window.filteredEiketsu = window.EIKETSU_DATA.slice();
    if (typeof initializeSortSystem === "function") initializeSortSystem();
    setTimeout(() => {
      if (typeof renderEiketsuList === "function") renderEiketsuList();
    }, 100);
  }
  isInitialized = true;
  setTimeout(() => {
    setupSortableHeaders();
  }, 500);
  if (window.collectionManager) window.collectionManager.render();
}
function initializeFormationSelector() {
  const formationArea = document.querySelector(
    ".selected-eiketsu-container",
  )?.parentElement;
  if (!formationArea) return;
  const header = formationArea.querySelector(
    ".flex.justify-between.items-center",
  );
  if (!header) return;
  header.innerHTML = "";
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "formation-controls";
  const selectorHTML = `
        <div class="formation-selector">
            <label class="formation-label" for="formation-select">陣形:</label>
            <select id="formation-select" class="formation-select">
                ${Object.entries(FORMATIONS)
                  .map(
                    ([key, f]) =>
                      `<option value="${key}" ${
                        key === currentFormation ? "selected" : ""
                      }>${f.name}</option>`,
                  )
                  .join("")}
            </select>
        </div>`;
  controlsContainer.innerHTML = selectorHTML;
  header.appendChild(controlsContainer);
  const newHeaderHTML = `
        <div class="formation-selector-section">
            <div class="formation-selector">
                <label class="formation-label" for="formation-select">陣形:</label>
                <select id="formation-select" class="formation-select-redesigned">
                    ${Object.entries(FORMATIONS || {})
                      .map(
                        ([key, f]) =>
                          `<option value="${key}" ${
                            key === (window.currentFormation || "hoen")
                              ? "selected"
                              : ""
                          }>${f.name}</option>`,
                      )
                      .join("")}
                </select>
            </div>
        </div>
        <div class="formation-buttons-section" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="display: flex; gap: 0.5rem;">
                <button id="copy-team-button" class="formation-btn formation-btn-secondary" style="flex: 1; padding: 0.5rem 0.75rem; background: #374151; color: white; border: none; border-radius: 0.375rem; cursor: pointer;" title="現在の編成情報をクリップボードにコピーします">
                    <span class="btn-text">編成コピー</span>
                </button>
                <button id="exploration-settings-btn" class="formation-btn formation-btn-accent" style="flex: 1; padding: 0.5rem 0.75rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 0.375rem; cursor: pointer;" title="英傑探訪の設定を開きます">
                    <span class="btn-text">探訪設定</span>
                </button>
            </div>
        </div>`;
  header.innerHTML = newHeaderHTML;
  setupHeaderButtonListeners();
  applyFormationAreaStyles();
  const formationSelect = document.getElementById("formation-select");
  if (formationSelect) {
    formationSelect.addEventListener("change", function (e) {
      window.currentFormation = e.target.value;
      // キャッシュをクリアして因縁を再計算
      if (typeof clearCaches === "function") clearCaches();
      if (typeof updateAll === "function") {
        updateAll();
      }
    });
  }
  return true;
}
/* =====================================
 * restoreTeamFromURL / setupAutoRestore の重複削除
 * より完全な実装が後方（L7635付近）に存在するため、
 * こちらの古いバージョンは削除しました。
 * ===================================== */

function setupHeaderButtonListeners() {
  const shareBtn = document.getElementById("share-url-btn");
  if (shareBtn) {
    shareBtn.addEventListener("click", generateShareURL);
  } else {
  }
  const resetBtn = document.getElementById("reset-selection-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetSelectedEiketsu);
  } else {
  }
  const copyBtn = document.getElementById("copy-team-button");
  if (copyBtn) {
    copyBtn.addEventListener("click", generateAndCopyTeamData);
  } else {
  }
  const explorationBtn = document.getElementById("exploration-settings-btn");
  if (explorationBtn) {
    explorationBtn.addEventListener("click", openExplorationModal);
  } else {
  }
}
function showDetailModalForEiketsu(eiketsuName) {
  const eiketsu = EIKETSU_DATA.find((e) => e.name === eiketsuName);
  if (!eiketsu) return;
  let statsHTML = '<div class="stats-grid-modal">';
  const statOrder = [
    "生命",
    "気合",
    "腕力",
    "耐久力",
    "器用さ",
    "知力",
    "魅力",
    "土",
    "水",
    "火",
    "風",
  ];
  statOrder.forEach((stat) => {
    if (eiketsu.stats[stat]) {
      statsHTML += `<div><strong>${stat}:</strong> ${eiketsu.stats[stat]}</div>`;
    }
  });
  statsHTML += "</div>";
  const content = `
        <div class="eiketsu-detail-modal-body">
            <p><strong>職業:</strong> ${eiketsu.job || "不明"}</p>
            <p><strong>コスト:</strong> ${eiketsu.cost || "不明"}</p>
            <p><strong>因子:</strong> ${eiketsu.factors
              .filter((f) => f)
              .join(" / ")}</p>
            <hr class="my-2">
            <h4>基礎ステータス</h4>
            ${statsHTML}
        </div>
    `;
  showModal(eiketsu.name, content);
}
function setupEventListeners() {
  // 検索入力にデバウンスを追加（タイピング中の過剰なレンダリング防止）
  let searchDebounceTimer = null;
  document.getElementById("keyword-search").addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      bondFactorFilter = [];
      cacheSystem.clear("filter");
      renderEiketsuList();
    }, 200); // 200ms遅延
  });
  [
    "display-filter",
    "job-filter",
    "factor1-filter",
    "factor2-filter",
    "factor3-filter",
    "factor4-filter",
    "inen-name-filter",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => {
      bondFactorFilter = [];
      cacheSystem.clear("filter");
      renderEiketsuList();
    });
  });
  const statFilterEl = document.getElementById("stat-filter");
  if (statFilterEl) {
    statFilterEl.addEventListener("change", () => {
      currentStatFilter = statFilterEl.value;
      const minInput = document.getElementById("stat-min-value");
      if (minInput) {
        minInput.disabled = !currentStatFilter;
        if (!currentStatFilter) minInput.value = "";
      }
      if (currentStatFilter) {
        sortState = { column: "stat", ascending: false };
        window.sortState = sortState;
      }
      renderEiketsuList();
      if (window.VirtualScrollAdapter && window.VirtualScrollAdapter.setStatColumn) {
        window.VirtualScrollAdapter.setStatColumn(currentStatFilter);
      }
    });
  }
  const statMinEl = document.getElementById("stat-min-value");
  if (statMinEl) {
    let statMinDebounce = null;
    statMinEl.addEventListener("input", () => {
      clearTimeout(statMinDebounce);
      statMinDebounce = setTimeout(() => renderEiketsuList(), 300);
    });
  }
  document.body.addEventListener("click", (e) => {
    const targetId = e.target.id;
    if (targetId === "share-url-btn" || targetId === "share-url-btn-desktop") generateShareURL();
    if (targetId === "copy-team-button") generateAndCopyTeamData();
    if (targetId === "clear-all") clearAllSelections();
    if (targetId === "stats-btn" || targetId === "stats-btn-desktop") showStatsModal();
    if (targetId === "guide-btn" || targetId === "guide-btn-desktop") showGuideModal();
    if (targetId === "reset-filters") resetFilters();
  });
  const formationSelect = document.getElementById("formation-select");
  if (formationSelect) {
    formationSelect.addEventListener("change", (e) => {
      currentFormation = e.target.value;
      window.currentFormation = currentFormation;
      updateAll();
      showMessage(
        `陣形を${FORMATIONS[currentFormation].name}に変更しました`,
        "success",
      );
    });
  }
  const resetSelectionBtn = document.getElementById("reset-selection");
  if (resetSelectionBtn) {
    resetSelectionBtn.addEventListener("click", resetSelection);
  }
  const resetOwnedBtn = document.getElementById("reset-owned-button");
  if (resetOwnedBtn) {
    resetOwnedBtn.addEventListener("click", () => {
      if (
        confirm(i18n.t('confirm_reset_owned'))
      ) {
        window.collectionManager.clearAll();
        document.querySelectorAll(".owned-checkbox").forEach((checkbox) => {
          checkbox.checked = false;
        });
        document.querySelectorAll("tr.owned-eiketsu").forEach((row) => {
          row.classList.remove("owned-eiketsu");
        });
        const selectAllCheckbox = document.getElementById("select-all-owned");
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = false;
        }
        updateOwnedCountDisplay();
        if (document.getElementById("display-filter").value === "owned") {
          renderEiketsuList();
        }
        showMessage(i18n.t("msg_owned_reset"), "success");
      }
    });
  }
  document.addEventListener("click", (e) => {
    const modal = document.getElementById("detail-modal");
    if (
      modal &&
      modal.style.display === "flex" &&
      (e.target === modal || e.target.classList.contains("modal-close"))
    ) {
      modal.style.display = "none";
    }
  });
  const globalOptimizationBtn = document.getElementById(
    "global-optimization-btn",
  );
  if (globalOptimizationBtn) {
    globalOptimizationBtn.addEventListener("click", startGlobalOptimization);
  }
  const ownedOptimizationBtn = document.getElementById(
    "owned-optimization-btn",
  );
  if (ownedOptimizationBtn) {
    ownedOptimizationBtn.addEventListener("click", startOwnedOptimization);
  }
}
function checkFormationCostLimit(formationKey) {
  const formation = FORMATIONS[formationKey];
  if (!formation) return { totalCost: 0, costLimit: 0, isOverLimit: false };
  let totalCost = 0;
  selectedEiketsu.forEach((slot) => {
    if (slot) {
      const cost = (slot.eiketsu.cost || 10) - slot.limitBreak;
      totalCost += Math.max(cost, 1);
    }
  });
  return {
    totalCost: totalCost,
    costLimit: formation.costLimit,
    isOverLimit: totalCost > formation.costLimit,
  };
}
function getFilterValues() {
  return {
    keyword: document.getElementById("keyword-search").value.toLowerCase(),
    display: document.getElementById("display-filter").value,
    job: document.getElementById("job-filter").value,
    inenName: document.getElementById("inen-name-filter").value,
    factor1: document.getElementById("factor1-filter").value,
    factor2: document.getElementById("factor2-filter").value,
    factor3: document.getElementById("factor3-filter").value,
    factor4: document.getElementById("factor4-filter").value,
    statName: document.getElementById("stat-filter")?.value || "",
    statMin: parseInt(document.getElementById("stat-min-value")?.value) || 0,
  };
}
function populateAllDropdowns() {
  const filters = getFilterValues();
  let tempData = EIKETSU_DATA;
  if (filters.job && filters.job !== "すべて") {
    tempData = tempData.filter((e) => e.job === filters.job);
  }
  const predefinedJobs = [
    "すべて",
    "侍",
    "僧",
    "神主・巫女",
    "陰陽師",
    "忍者",
    "鍛冶屋",
    "薬師",
    "傾奇者",
  ];
  const allJobs = [...new Set([...predefinedJobs])];
  populateSelect("job-filter", allJobs, filters.job);
  const factor1Options = [
    "すべて",
    "武士道",
    "武芸",
    "軍学",
    "僧兵",
    "仏門",
    "密教",
    "神道",
    "古神道",
    "雅楽",
    "陰陽道",
    "仙道",
    "召喚術",
    "忍法",
    "暗殺術",
    "忍術",
    "刀鍛冶",
    "鎧鍛冶",
    "鉄砲鍛冶",
    "医学",
    "神通力",
    "修験道",
    "四象",
    "地勢",
    "殺陣",
    "才腕",
    "神通",
    "世渡り上手",
    "猛将",
  ];
  populateSelect("factor1-filter", factor1Options, filters.factor1);
  if (filters.factor1 && filters.factor1 !== "すべて") {
    tempData = tempData.filter((e) => e.factors[0] === filters.factor1);
  }
  const factor2Options = [
    "すべて",
    "知将",
    "忍び",
    "剣豪",
    "名臣",
    "野心家",
    "勇将",
    "女傑",
    "内助の功",
    "長寿",
    "文化人",
    "猛将",
    "外交官",
    "洒落者",
    "鬼",
    "神仏の徒",
    "世渡り上手",
    "飛道具使い",
    "明敏",
    "宿将",
    "根性",
    "才腕",
  ];
  populateSelect("factor2-filter", factor2Options, filters.factor2);
  if (filters.factor2 && filters.factor2 !== "すべて") {
    tempData = tempData.filter(
      (e) =>
        e.factors[1] === filters.factor2 || e.factors[2] === filters.factor2,
    );
  }
  const factor3Options = [
    "すべて",
    "知将",
    "忍び",
    "剣豪",
    "名臣",
    "野心家",
    "勇将",
    "女傑",
    "内助の功",
    "長寿",
    "文化人",
    "猛将",
    "外交官",
    "洒落者",
    "鬼",
    "神仏の徒",
    "世渡り上手",
    "飛道具使い",
    "明敏",
    "宿将",
    "根性",
    "才腕",
  ];
  populateSelect("factor3-filter", factor3Options, filters.factor3);
  if (filters.factor3 && filters.factor3 !== "すべて") {
    tempData = tempData.filter(
      (e) =>
        e.factors[1] === filters.factor3 || e.factors[2] === filters.factor3,
    );
  }
  const factor4Options = [
    "すべて",
    "知将",
    "忍び",
    "剣豪",
    "名臣",
    "野心家",
    "勇将",
    "女傑",
    "内助の功",
    "長寿",
    "文化人",
    "猛将",
    "外交官",
    "洒落者",
    "鬼",
    "神仏の徒",
    "世渡り上手",
    "飛道具使い",
    "明敏",
    "宿将",
    "根性",
    "才腕",
  ];
  populateSelect("factor4-filter", factor4Options, filters.factor4);
  const customInenOrder = [
    "侍",
    "僧",
    "神主・巫女",
    "陰陽師",
    "忍者",
    "鍛冶屋",
    "薬師",
    "傾奇者",
    "武士道の絆",
    "武芸の絆",
    "軍学の絆",
    "僧兵の絆",
    "仏門の絆",
    "密教の絆",
    "神道の絆",
    "古神道の絆",
    "雅楽の絆",
    "陰陽道の絆",
    "仙道の絆",
    "召喚術の絆",
    "忍法の絆",
    "暗殺術の絆",
    "忍術の絆",
    "刀鍛冶の絆",
    "鎧鍛冶の絆",
    "鉄砲鍛冶の絆",
    "医学の絆",
    "神通力の絆",
    "修験道の絆",
    "四象の絆",
    "地勢の絆",
    "殺陣の絆",
    "知将の絆",
    "忍びの絆",
    "剣豪の絆",
    "名臣の絆",
    "野心家の絆",
    "勇将の絆",
    "女傑の絆",
    "内助の功の絆",
    "長寿の絆",
    "文化人の絆",
    "猛将の絆",
    "外交官の絆",
    "洒落者の絆",
    "鬼の絆",
    "神仏の徒の絆",
    "世渡り上手の絆",
    "飛道具使いの絆",
    "明敏の絆",
    "宿将の絆",
    "根性の絆",
    "才腕の絆",
    "もののふ",
    "立役者",
    "謀略家",
    "戦場の華",
    "影の者",
    "文明開化",
    "豪傑",
    "奇襲",
    "健康第一",
    "籠城名手",
    "老練闊達",
    "一気呵成",
    "泰然自若",
    "技巧伝承",
    "才気煥発",
    "王佐之才",
    "流行創出",
    "知勇兼備",
    "山紫水明",
    "硝煙弾雨",
    "生殺与奪",
    "勇猛果敢",
    "臥薪嘗胆",
    "花鳥風月",
    "柔能制剛",
    "能鷹隠爪",
    "天神地祇",
    "竜飛鳳舞",
    "衣鉢相伝",
    "鎧袖一触",
  ];
  const inenNames = INEN_DATA.map((i) => i.name);
  inenNames.sort((a, b) => {
    const indexA = customInenOrder.indexOf(a);
    const indexB = customInenOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA !== -1) {
      return -1;
    }
    if (indexB !== -1) {
      return 1;
    }
    return a.localeCompare(b, "ja");
  });
  populateSelect("inen-name-filter", inenNames, filters.inenName);
}
function populateSelect(elementId, options, selectedValue) {
  const select = document.getElementById(elementId);
  if (!select) return;
  const currentValue = selectedValue || select.value;
  while (select.options.length > 0) {
    select.remove(0);
  }
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    select.appendChild(option);
  });
  select.value = currentValue;
}
// [URL共有] loadFromURL / generateShareURL → state-persistence.js に分離済み (2026-03-21)
function getFilteredEiketsu() {
  const filters = getFilterValues();
  // パフォーマンス改善: Array → Set変換でO(n)のincludesをO(1)のhasに
  const selectedNames = new Set(
    selectedEiketsu.filter((e) => e).map((e) => e.eiketsu.name),
  );
  const ownedSet = new Set(
    window.collectionManager ? window.collectionManager.getOwnedList() : [],
  );
  return EIKETSU_DATA.filter((eiketsu) => {
    if (filters.display === "owned" && !ownedSet.has(eiketsu.name)) {
      return false;
    }
    if (filters.display === "selected" && !selectedNames.has(eiketsu.name)) {
      return false;
    }
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      const isMatch =
        eiketsu.name.toLowerCase().includes(keyword) ||
        (eiketsu.factors &&
          eiketsu.factors.some((f) => f && f.toLowerCase().includes(keyword)));
      if (!isMatch) return false;
    }
    if (filters.job && filters.job !== "すべて" && eiketsu.job !== filters.job)
      return false;
    if (
      filters.factor1 &&
      filters.factor1 !== "すべて" &&
      eiketsu.factors[0] !== filters.factor1
    )
      return false;
    const generalFactors = [
      eiketsu.factors[1],
      eiketsu.factors[2],
      eiketsu.factors[3],
    ].filter(Boolean);
    if (
      filters.factor2 &&
      filters.factor2 !== "すべて" &&
      !generalFactors.includes(filters.factor2)
    )
      return false;
    if (
      filters.factor3 &&
      filters.factor3 !== "すべて" &&
      !generalFactors.includes(filters.factor3)
    )
      return false;
    if (
      filters.factor4 &&
      filters.factor4 !== "すべて" &&
      !generalFactors.includes(filters.factor4)
    )
      return false;
    if (bondFactorFilter.length > 0) {
      if (!bondFactorFilter.some((f) => eiketsu.factors.includes(f))) {
        return false;
      }
    } else if (filters.inenName) {
      const inen = INEN_DATA.find((i) => i.name === filters.inenName);
      if (inen && !inen.factors.some((f) => eiketsu.factors.includes(f))) {
        return false;
      }
    }
    if (filters.statName && filters.statMin > 0) {
      const statVal = (eiketsu.stats && eiketsu.stats[filters.statName]) || 0;
      if (statVal < filters.statMin) return false;
    }
    return true;
  });
}
// ── ピン止めボタン更新 ──────────────────────────────────────
function updatePinButtons() {
  document.querySelectorAll('.pin-btn').forEach(btn => {
    const name = btn.dataset.pinName;
    if (!name) return;
    const isPinned = window.userSession && window.userSession.pinned && window.userSession.pinned.has(name);
    btn.classList.toggle('is-pinned', isPinned);
    btn.title = isPinned ? 'ピン止め中（クリックで解除）' : 'ピン止め';
  });
}
window.updatePinButtons = updatePinButtons;

window.handlePinClick = function(btn, name) {
  if (!window.userSession || !window.userSession.loggedIn) {
    return;
  }
  window.toggleUserPinned && window.toggleUserPinned(name);
  updatePinButtons();
};

/**
 * 英傑一覧のテーブル描画
 *
 * @performance_bottleneck
 * - 問題: フィルター変更のたびに全行を再生成（innerHTML = ''）
 * - 行数: 最大500+ 英傑
 * - 改善案:
 *   1. Virtual Scrolling（表示範囲のみ描画）✅ v3.0実装
 *   2. DocumentFragment活用（バッチDOM挿入）
 *   3. IntersectionObserver遅延読込
 */
function renderEiketsuList() {
  if (window.sortState) sortState = window.sortState;
  const container = document.getElementById("collection-manager");
  // カスタム英傑管理から呼び出せるようにグローバル公開
  window.renderEiketsuList = renderEiketsuList;
  if (!container) {
    return;
  }
  const currentOwnedStates = new Map();
  document.querySelectorAll(".owned-checkbox").forEach((checkbox) => {
    const eiketsuName = checkbox.dataset.eiketsuName;
    if (eiketsuName) {
      currentOwnedStates.set(eiketsuName, checkbox.checked);
    }
  });
  const filters = getFilterValues();
  const statFilter = filters.statName;
  // パフォーマンス改善: Set化でO(1)ルックアップ
  const selectedNames = new Set(
    selectedEiketsu.filter((e) => e).map((e) => e.eiketsu.name),
  );
  let filteredData = getFilteredEiketsu();

  // === 仮想スクロール対応（v3）===
  if (window.VirtualScrollAdapter && window.VirtualScrollAdapter.isEnabled()) {
    if (window.DEBUG) console.log(
      "[main.js] Delegating render to VirtualScrollAdapter with",
      filteredData.length,
      "items",
    );
    if (window.VirtualScrollAdapter.render(filteredData, sortState)) {
      // updateSortIndicators(); // Adapter内で処理されるため不要
      return;
    }
  }

  const cacheKey = [filters, selectedNames, bondFactorFilter, sortState];
  const cached = cacheSystem.get && cacheSystem.get("filter", ...cacheKey);
  if (cached) {
    container.innerHTML = cached;
    currentOwnedStates.forEach((isChecked, eiketsuName) => {
      const checkbox = container.querySelector(
        `.owned-checkbox[data-eiketsu-name="${eiketsuName}"]`,
      );
      if (checkbox) {
        checkbox.checked = isChecked;
        const row = checkbox.closest("tr");
        if (isChecked && row) {
          row.classList.add("owned-eiketsu");
        }
      }
    });
    updateSortIndicators();
    const rowCount = container.querySelectorAll("tbody tr").length;
    document.getElementById("resultsCount").textContent = `${rowCount}件`;
    setupEiketsuTableEvents();
    setTimeout(() => {
      setupOwnedCheckboxEvents();
    }, 100);
    updatePinButtons();
    return;
  }
  if (sortState.column) {
    filteredData.sort((a, b) => {
      let valA, valB;
      if (sortState.column === "addedOrder") {
        valA = a.addedDate
          ? new Date(a.addedDate.replace(/\//g, "-"))
          : new Date(0);
        valB = b.addedDate
          ? new Date(b.addedDate.replace(/\//g, "-"))
          : new Date(0);
      } else if (sortState.column === "stat") {
        valA = (a.stats && a.stats[currentStatFilter]) || 0;
        valB = (b.stats && b.stats[currentStatFilter]) || 0;
      } else if (sortState.column.startsWith("factor")) {
        const index = parseInt(sortState.column.replace("factor", "")) - 1;
        valA = a.factors[index] || "";
        valB = b.factors[index] || "";
      } else {
        valA = a[sortState.column] || "";
        valB = b[sortState.column] || "";
      }
      if (sortState.column === "addedOrder" || sortState.column === "stat") {
        return sortState.ascending ? valA - valB : valB - valA;
      } else {
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return sortState.ascending ? -1 : 1;
        if (valA > valB) return sortState.ascending ? 1 : -1;
        return 0;
      }
    });
  }
  const displayData = filteredData;
  const fragment = document.createDocumentFragment();
  const table = document.createElement("table");
  table.className = "eiketsu-table w-full";
  const thead = document.createElement("thead");
  thead.innerHTML = `
        <tr>
            <th width="30" class="check-column">
                <input type="checkbox" id="select-all-owned" title="全選択/解除">
            </th>
            <th width="30" class="owned-column">保有</th>
            <th class="sortable-header name-column" data-column="name">
                英傑名 <span class="sort-indicator"></span>
            </th>
            <th class="sortable-header job-column" data-column="job" width="80">
                職業 <span class="sort-indicator"></span>
            </th>
            <th class="sortable-header factor-column" data-column="factor1">
                特化因子 <span class="sort-indicator"></span>
            </th>
            <th class="sortable-header factor-column" data-column="factor2">
                因子2 <span class="sort-indicator"></span>
            </th>
            <th class="sortable-header factor-column" data-column="factor3">
                因子3 <span class="sort-indicator"></span>
            </th>
            <th class="sortable-header factor-column" data-column="factor4">
                因子4 <span class="sort-indicator"></span>
            </th>
            ${statFilter ? `<th class="sortable-header stat-column" data-column="stat" style="min-width:70px;text-align:right;">
                ${statFilter} <span class="sort-indicator"></span>
            </th>` : ""}
            <th class="sortable-header added-order-column" data-column="addedOrder" width="100">
                追加・更新 <span class="sort-indicator"></span>
            </th>
        </tr>
    `;
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  displayData.forEach((eiketsu) => {
    const isOwned = currentOwnedStates.has(eiketsu.name)
      ? currentOwnedStates.get(eiketsu.name)
      : window.collectionManager &&
        window.collectionManager.hasEiketsu(eiketsu.name);
    const isSelected = selectedNames.has(eiketsu.name);
    const tr = document.createElement("tr");
    tr.className = "clickable eiketsu-row cursor-pointer hover:bg-gray-50";
    if (isSelected) tr.classList.add("selected", "selected-eiketsu");
    if (isOwned) tr.classList.add("owned-eiketsu");
    tr.setAttribute("data-eiketsu-name", eiketsu.name);
    tr.setAttribute("data-eiketsu-job", eiketsu.job || "");
    tr.setAttribute("data-click-ready", "false");
    tr.innerHTML = `
    <td class="check-column">${
      isSelected ? '<span class="check-mark">✓</span>' : ""
    }</td>
    <td class="owned-column">
        <input type="checkbox"
            class="owned-checkbox"
            data-eiketsu-name="${eiketsu.name}"
            ${isOwned ? "checked" : ""}
            onclick="event.stopPropagation()">
    </td>
    <td class="name-column relative" title="${eiketsu.name}">
        ${eiketsu.name}
        <button class="pin-btn${window.userSession && window.userSession.pinned && window.userSession.pinned.has(eiketsu.name) ? ' is-pinned' : ''}"
                data-pin-name="${eiketsu.name}"
                onclick="event.stopPropagation(); window.handlePinClick && window.handlePinClick(this, '${eiketsu.name.replace(/'/g, "\\'")}')"
                title="${window.userSession && window.userSession.pinned && window.userSession.pinned.has(eiketsu.name) ? 'ピン止め中（クリックで解除）' : 'ピン止め'}"
                aria-label="ピン止め">📌</button>
    </td>
    <td class="job-column">${eiketsu.job || ""}</td>
    <td class="factor-column">${eiketsu.factors[0] || "-"}</td>
    <td class="factor-column">${eiketsu.factors[1] || "-"}</td>
    <td class="factor-column">${eiketsu.factors[2] || "-"}</td>
    <td class="factor-column">${eiketsu.factors[3] || "-"}</td>
    ${statFilter ? `<td class="stat-column" style="text-align:right;">${eiketsu.stats ? (eiketsu.stats[statFilter] || 0).toLocaleString() : 0}</td>` : ""}
    <td class="added-date-column">${eiketsu.addedDate || "-"}</td>
`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  fragment.appendChild(table);
  container.innerHTML = "";
  container.appendChild(fragment);
  if (cacheSystem.set) {
    cacheSystem.set("filter", container.innerHTML, ...cacheKey);
  }
  setupEiketsuTableEvents();
  setTimeout(() => {
    setupSortableHeaders();
  }, 100);
  setTimeout(() => {
    setupOwnedCheckboxEvents();
  }, 200);
  updateSortIndicators();
  updatePinButtons();
  const resultText = `${displayData.length}件`;
  const resultsCount = document.getElementById("resultsCount");
  if (resultsCount) {
    resultsCount.textContent = resultText;
  }
  setTimeout(() => {
    if (typeof setupSortableHeaders === "function") {
      setupSortableHeaders();
    }
  }, 50);
}
function setupOwnedCheckboxEvents() {
  document.querySelectorAll(".owned-checkbox").forEach((checkbox) => {
    const newCheckbox = checkbox.cloneNode(true);
    checkbox.parentNode.replaceChild(newCheckbox, checkbox);
    newCheckbox.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      },
      true,
    );
    newCheckbox.addEventListener("change", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      const eiketsuName = e.target.dataset.eiketsuName;
      window.collectionManager.toggleEiketsu(eiketsuName);
      const row = e.target.closest("tr");
      if (e.target.checked) {
        row.classList.add("owned-eiketsu");
      } else {
        row.classList.remove("owned-eiketsu");
      }
      updateOwnedCountDisplay();
      const displayFilter = document.getElementById("display-filter");
      if (displayFilter && displayFilter.value === "owned") {
        setTimeout(() => {
          renderEiketsuList();
        }, 100);
      }
    });
  });
  const selectAllCheckbox = document.getElementById("select-all-owned");
  if (selectAllCheckbox) {
    const newSelectAll = selectAllCheckbox.cloneNode(true);
    selectAllCheckbox.parentNode.replaceChild(newSelectAll, selectAllCheckbox);
    newSelectAll.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      },
      true,
    );
    newSelectAll.addEventListener("change", (e) => {
      const checkboxes = document.querySelectorAll(".owned-checkbox");
      checkboxes.forEach((checkbox) => {
        checkbox.checked = e.target.checked;
        const eiketsuName = checkbox.dataset.eiketsuName;
        if (e.target.checked) {
          window.collectionManager.ownedEiketsu.add(eiketsuName);
          checkbox.closest("tr").classList.add("owned-eiketsu");
        } else {
          window.collectionManager.ownedEiketsu.delete(eiketsuName);
          checkbox.closest("tr").classList.remove("owned-eiketsu");
        }
      });
      window.collectionManager.saveToStorage();
      updateOwnedCountDisplay();
      const displayFilter = document.getElementById("display-filter");
      if (displayFilter && displayFilter.value === "owned") {
        setTimeout(() => {
          renderEiketsuList();
        }, 100);
      }
    });
  }
}
function updateTableRowsOnly() {
  if (!window.filteredEiketsu || !Array.isArray(window.filteredEiketsu)) {
    console.warn("filteredEiketsuが存在しません");
    return;
  }
  const tbody = document.querySelector(".eiketsu-table tbody");
  if (!tbody) {
    console.warn("tbodyが見つかりません");
    return;
  }
  // パフォーマンス改善: Set化でO(1)ルックアップ
  const selectedNames = new Set(
    selectedEiketsu.filter((e) => e).map((e) => e.eiketsu.name),
  );
  const ownedSet = new Set(
    window.collectionManager ? window.collectionManager.getOwnedList() : [],
  );
  tbody.innerHTML = "";
  window.filteredEiketsu.forEach((eiketsu) => {
    const isOwned = ownedSet.has(eiketsu.name);
    const isSelected = selectedNames.has(eiketsu.name);
    const tr = document.createElement("tr");
    tr.className = "clickable eiketsu-row cursor-pointer hover:bg-gray-50";
    if (isSelected) tr.classList.add("selected", "selected-eiketsu");
    if (isOwned) tr.classList.add("owned-eiketsu");
    tr.setAttribute("data-eiketsu-name", eiketsu.name);
    tr.setAttribute("data-eiketsu-job", eiketsu.job || "");
    tr.setAttribute("data-click-ready", "false");
    tr.innerHTML = `
            <td class="check-column">${
              isSelected ? '<span class="check-mark">✓</span>' : ""
            }</td>
            <td class="name-column relative" title="${eiketsu.name}">
                ${eiketsu.name}
            </td>
            <td class="job-column">${eiketsu.job || ""}</td>
            <td class="factor-column">${eiketsu.factors[0] || "-"}</td>
            <td class="factor-column">${eiketsu.factors[1] || "-"}</td>
            <td class="factor-column">${eiketsu.factors[2] || "-"}</td>
            <td class="factor-column">${eiketsu.factors[3] || "-"}</td>
            <td class="added-date-column">${eiketsu.addedDate || "-"}</td>
        `;
    if (isOwned) tr.classList.add("owned-eiketsu");
    tbody.appendChild(tr);
  });
  setTimeout(() => {
    setupEiketsuTableEventsOnly();
  }, 50);
  const resultsCount = document.getElementById("resultsCount");
  if (resultsCount && !document.getElementById("owned-count-display")) {
    const ownedCountSpan = document.createElement("span");
    ownedCountSpan.id = "owned-count-display";
    ownedCountSpan.className = "owned-count-display";
    ownedCountSpan.textContent = "保有: 0体";
    resultsCount.parentElement.insertBefore(ownedCountSpan, resultsCount);
    const separator = document.createElement("span");
    separator.className = "count-separator";
    separator.textContent = " | ";
    resultsCount.parentElement.insertBefore(separator, resultsCount);
  }
}
function setupEiketsuTableEventsOnly() {
  const rows = document.querySelectorAll("tbody tr[data-eiketsu-name]");
  rows.forEach((row) => {
    const eiketsuName = row.getAttribute("data-eiketsu-name");
    const eiketsu = EIKETSU_DATA.find((e) => e.name === eiketsuName);
    if (eiketsu) {
      const clickHandler = function (event) {
        if (event.target.closest("thead")) {
          return;
        }
        if (typeof window.handleUnifiedEiketsuClick === "function") {
          window.handleUnifiedEiketsuClick(event, eiketsu);
        } else if (typeof window.toggleEiketsuSelection === "function") {
          window.toggleEiketsuSelection(eiketsu);
        } else {
          emergencyEiketsuSelection(eiketsu);
        }
      };
      row.addEventListener("click", clickHandler);
      row.setAttribute("data-click-ready", "true");
      if (typeof setupTouchEvents === "function") {
        setupTouchEvents(row, eiketsu.name);
      }
    }
  });
}
let currentSort = {
  get column() {
    return sortState.column;
  },
  get direction() {
    return sortState.ascending ? "asc" : "desc";
  },
  set column(value) {
    sortState.column = value;
  },
  set direction(value) {
    sortState.ascending = value === "asc";
  },
};
function handleSort(event) {
  event.preventDefault();
  event.stopPropagation();
  const header = event.currentTarget;
  const column = header.getAttribute("data-column") || header.dataset.column;
  if (!column) {
    console.warn("ソート列が指定されていません");
    return;
  }
  if (sortState.column === column) {
    sortState.ascending = !sortState.ascending;
  } else {
    sortState.column = column;
    if (column === "addedOrder") {
      sortState.ascending = false;
    } else {
      sortState.ascending = true;
    }
  }
  if (typeof cacheSystem !== "undefined" && cacheSystem.clear) {
    cacheSystem.clear("filter");
  }
  window.filteredEiketsu = getFilteredEiketsu();
  sortFilteredEiketsu(column, sortState.ascending ? "asc" : "desc");
  updateSortIndicators();
  if (typeof renderEiketsuList === "function") {
    renderEiketsuList();
  }
}
function updateSortIndicators() {
  document.querySelectorAll(".sortable-header").forEach((header) => {
    const indicator = header.querySelector(".sort-indicator");
    if (!indicator) return;
    if (header.dataset.column === sortState.column) {
      indicator.textContent = sortState.ascending ? "▲" : "▼";
      header.style.backgroundColor = "#f3f4f6";
      header.classList.add("sort-active");
    } else {
      indicator.textContent = "";
      header.style.backgroundColor = "";
      header.classList.remove("sort-active");
    }
  });
}
function sortFilteredEiketsu(column, direction) {
  if (!window.filteredEiketsu || !Array.isArray(window.filteredEiketsu)) {
    return;
  }
  const sortFunction = getSortFunction(column, direction);
  window.filteredEiketsu.sort(sortFunction);
}
function getSortFunction(column, direction) {
  const modifier = direction === "asc" ? 1 : -1;
  switch (column) {
    case "name":
      return (a, b) => {
        const nameA = (a.name || "").toString();
        const nameB = (b.name || "").toString();
        return nameA.localeCompare(nameB, "ja") * modifier;
      };
    case "job":
      return (a, b) => {
        const jobA = (a.job || "").toString();
        const jobB = (b.job || "").toString();
        const jobCompare = jobA.localeCompare(jobB, "ja");
        if (jobCompare !== 0) return jobCompare * modifier;
        return (a.name || "").localeCompare(b.name || "", "ja") * modifier;
      };
    case "factor1":
      return (a, b) => {
        const factorA = (a.factors && a.factors[0]) || "";
        const factorB = (b.factors && b.factors[0]) || "";
        const factorCompare = factorA.localeCompare(factorB, "ja");
        if (factorCompare !== 0) return factorCompare * modifier;
        return (a.name || "").localeCompare(b.name || "", "ja") * modifier;
      };
    case "factor2":
      return (a, b) => {
        const factorA = (a.factors && a.factors[1]) || "";
        const factorB = (b.factors && b.factors[1]) || "";
        const factorCompare = factorA.localeCompare(factorB, "ja");
        if (factorCompare !== 0) return factorCompare * modifier;
        return (a.name || "").localeCompare(b.name || "", "ja") * modifier;
      };
    case "factor3":
      return (a, b) => {
        const factorA = (a.factors && a.factors[2]) || "";
        const factorB = (b.factors && b.factors[2]) || "";
        const factorCompare = factorA.localeCompare(factorB, "ja");
        if (factorCompare !== 0) return factorCompare * modifier;
        return (a.name || "").localeCompare(b.name || "", "ja") * modifier;
      };
    case "factor4":
      return (a, b) => {
        const factorA = (a.factors && a.factors[3]) || "";
        const factorB = (b.factors && b.factors[3]) || "";
        const factorCompare = factorA.localeCompare(factorB, "ja");
        if (factorCompare !== 0) return factorCompare * modifier;
        return (a.name || "").localeCompare(b.name || "", "ja") * modifier;
      };
    case "stat":
      return (a, b) => {
        const valA = (a.stats && a.stats[currentStatFilter]) || 0;
        const valB = (b.stats && b.stats[currentStatFilter]) || 0;
        return (valA - valB) * modifier;
      };
    case "addedOrder":
    default:
      return (a, b) => {
        if (a.addedDate && b.addedDate) {
          const dateA = new Date(a.addedDate.replace(/\//g, "-"));
          const dateB = new Date(b.addedDate.replace(/\//g, "-"));
          const dateCompare = dateA - dateB;
          if (dateCompare !== 0) {
            return dateCompare * modifier;
          }
        }
        const orderA = a.addedOrder || 0;
        const orderB = b.addedOrder || 0;
        return (orderA - orderB) * modifier;
      };
  }
}
function initializeSortSystem() {
  if (window.filteredEiketsu && Array.isArray(window.filteredEiketsu)) {
    sortFilteredEiketsu("addedOrder", "desc");
  }
}
if (!document.querySelector("#sort-styles")) {
  const sortStyles = document.createElement("style");
  sortStyles.id = "sort-styles";
  sortStyles.textContent = `
        .sortable-header {
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s ease;
        }
        
        .sortable-header:hover {
            background-color: #f3f4f6;
        }
        
        .sortable-header.sort-active {
            background-color: #e5e7eb;
            font-weight: 600;
        }
        
        .sort-indicator {
            font-size: 12px;
            color: #6b7280;
            margin-left: 4px;
        }
        
        .sortable-header.sort-active .sort-indicator {
            color: #374151;
            font-weight: bold;
        }
    `;
  document.head.appendChild(sortStyles);
}
function setupEiketsuTableEvents() {
  const rows = document.querySelectorAll("tbody tr[data-eiketsu-name]");
  let setupCount = 0;
  rows.forEach((row) => {
    const eiketsuName = row.getAttribute("data-eiketsu-name");
    const eiketsu = EIKETSU_DATA.find((e) => e.name === eiketsuName);
    if (eiketsu) {
      const newRow = row.cloneNode(true);
      row.parentNode.replaceChild(newRow, row);
      const clickHandler = function (event) {
        if (
          event.target.classList.contains("owned-checkbox") ||
          event.target.closest(".owned-column")
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return;
        }
        if (typeof window.handleUnifiedEiketsuClick === "function") {
          window.handleUnifiedEiketsuClick(event, eiketsu);
        } else if (typeof window.toggleEiketsuSelection === "function") {
          window.toggleEiketsuSelection(eiketsu);
        } else if (typeof handleEiketsuRowClick === "function") {
          handleEiketsuRowClick(event, eiketsu);
        } else {
          emergencyEiketsuSelection(eiketsu);
        }
      };
      newRow.addEventListener("click", clickHandler);
      newRow.setAttribute("data-click-ready", "true");
      if (typeof setupTouchEvents === "function") {
        setupTouchEvents(newRow, eiketsu.name);
      }
      setupCount++;
    }
  });
}
function emergencyEiketsuSelection(eiketsu) {
  const selectedIndex = selectedEiketsu.findIndex(
    (slot) => slot && slot.eiketsu.name === eiketsu.name,
  );
  if (selectedIndex !== -1) {
    selectedEiketsu[selectedIndex] = null;
  } else {
    const emptyIndex = findEmptySlotIndex();
    if (emptyIndex !== -1) {
      selectedEiketsu[emptyIndex] = {
        eiketsu: eiketsu,
        limitBreak: 4,
        trust20: true,
        bunkoku: !!(eiketsu.factors && eiketsu.factors[3]),
      };
    } else {
      if (typeof clearCaches === "function") {
        clearCaches();
      }
      if (typeof updateAll === "function") {
        updateAll();
      } else if (typeof renderEiketsuList === "function") {
        renderEiketsuList();
      }
      return;
    }
  }
  if (typeof clearCaches === "function") {
    clearCaches();
  }
  if (typeof updateAll === "function") {
    updateAll();
  } else if (typeof renderEiketsuList === "function") {
    renderEiketsuList();
  }
}
function setupSortableHeaders() {
  const headers = document.querySelectorAll("thead .sortable-header");
  if (headers.length === 0) {
    return;
  }
  headers.forEach((header) => {
    const column = header.getAttribute("data-column");
    if (!column) {
      return;
    }
    // 仮想スクロールのヘッダーは無視（VirtualScrollAdapterが管理）
    if (header.classList.contains("vs-th")) {
      return;
    }
    if (header.getAttribute("data-sort-enabled") === "true") {
      return;
    }
    header.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (sortState.column === column) {
        sortState.ascending = !sortState.ascending;
      } else {
        sortState.column = column;
        sortState.ascending = column === "addedOrder" ? false : true;
      }
      if (typeof cacheSystem !== "undefined" && cacheSystem.clear) {
        cacheSystem.clear("filter");
      }
      window.filteredEiketsu = getFilteredEiketsu();
      sortFilteredEiketsu(column, sortState.ascending ? "asc" : "desc");
      updateSortIndicators();
      renderEiketsuList();
    };
    header.style.cursor = "pointer";
    header.style.userSelect = "none";
    header.setAttribute("data-sort-enabled", "true");
    header.addEventListener(
      "touchend",
      function (e) {
        e.preventDefault();
        header.onclick(e);
      },
      { passive: false },
    );
  });
  updateSortIndicators();
}
/* POTENTIAL_DEAD_CODE: ソートヘッダーのデバッグ診断用。本番環境での呼び出し元なし。
window.diagnoseSortHeaders = function () {
  const headers = document.querySelectorAll(".sortable-header");
  headers.forEach((header, index) => {
    const column = header.getAttribute("data-column");
    const hasListener = header.getAttribute("data-sort-enabled") === "true";
    const text = header.textContent.trim();
    if (!hasListener) {
    }
  });
};
*/
function updateResultsCount() {
  const countElement = document.getElementById("resultsCount");
  if (countElement) {
    const total = filteredEiketsu.length;
    const displayed = Math.min(total, 150);
    countElement.textContent = `${displayed}/${total}件表示`;
  }
}
function selectEiketsu(eiketsu, { limitBreak = 4, trust20 = true } = {}) {
  if (!canPlaceEiketsu(eiketsu)) {
    const formation = FORMATIONS[currentFormation];
    showMessage(
      `${formation.name}陣形のコスト制限(${formation.costLimit})を超えるため配置できません`,
      "error",
    );
    return false;
  }
  const emptyIndex = findEmptySlotIndex();
  if (emptyIndex === -1) {
    showMessage(i18n.t("msg_slots_full"), "warning");
    return false;
  }

  // 即時：データ更新
  selectedEiketsu[emptyIndex] = {
    eiketsu,
    limitBreak,
    trust20,
    bunkoku: !!eiketsu.factors[3],
  };

  // 即時：UI更新
  updateAll();

  // 英傑選択をログ
  if (typeof logEiketsuSelection === "function")
    logEiketsuSelection(eiketsu.name);

  // 遅延：重い処理（LocalStorage、キャッシュクリア）
  setTimeout(() => {
    try {
      localStorage.setItem(
        "selectedEiketsu",
        JSON.stringify(
          selectedEiketsu.map((slot) => (slot ? slot.eiketsu.name : null)),
        ),
      );
    } catch (e) {}
    // パフォーマンス改善: 重複クリアを防止
    smartClearCaches();
  }, 0);

  return true;
}
// パフォーマンス改善: ソートヘッダーの初回設定フラグ
let sortHeadersInitialized = false;

function updateAll() {
  // 即時：視覚的フィードバック（最優先）
  requestAnimationFrame(() => {
    updateSelectedDisplay(); // 選択スロット表示
    updateTotalCost(); // コスト表示
  });

  // 遅延：重い処理
  debounceUpdate(() => {
    renderEiketsuList();
    calculateInen();
    // 因縁計算完了後にトラッキング実行（タイミング問題の修正）
    if (typeof window.trackFormationIfQualified === "function") {
      window.trackFormationIfQualified();
    }
    // パフォーマンス改善: ヘッダー構造は変わらないため初回のみ設定
    if (!sortHeadersInitialized) {
      setTimeout(() => {
        setupSortableHeaders();
        sortHeadersInitialized = true;
      }, 100);
    }
    // モンキーパッチ廃止: CustomEventで後続処理を通知（2026/02/11）
    document.dispatchEvent(new CustomEvent("updateAllComplete"));
  }, 50);
}
function updateTotalCost() {
  const formation = FORMATIONS[currentFormation];
  if (!formation) {
    return;
  }
  let totalCost = 0;
  let eiketsuCount = 0;
  selectedEiketsu.forEach((slot) => {
    if (slot && slot.eiketsu) {
      eiketsuCount++;
      const baseCost = slot.eiketsu.cost || 10;
      const actualCost = Math.max(baseCost - slot.limitBreak, 1);
      totalCost += actualCost;
    }
  });
  const summaryBox = document.querySelector(".summary-box");
  if (summaryBox) {
    let costItem = summaryBox.querySelector(".cost-item");
    if (!costItem) {
      costItem = document.createElement("div");
      costItem.className = "summary-item cost-item";
      summaryBox.insertBefore(costItem, summaryBox.firstChild);
    }
    const isOverLimit = totalCost > formation.costLimit;
    costItem.innerHTML = `
            <div class="summary-label">総コスト</div>
            <div class="summary-value${isOverLimit ? " over-limit" : ""}" 
                 title="配置英傑${eiketsuCount}体の総コスト / ${
                   formation.name
                 }陣形の上限">
                ${totalCost}/${formation.costLimit}
            </div>
        `;
    costItem.style.color = isOverLimit ? "#ef4444" : "";
  }
}
function updateOwnedCountDisplay() {
  if (window.collectionManager) {
    const ownedCount = window.collectionManager.getOwnedCount();
    const badge = document.getElementById("owned-count-badge");
    if (badge) {
      badge.textContent = `保有: ${ownedCount}体`;
      badge.style.transform = "scale(1.1)";
      setTimeout(() => {
        badge.style.transform = "scale(1)";
      }, 200);
    }
    const displayElement = document.getElementById(
      "collection-badge-formation-area",
    );
    if (displayElement) {
      displayElement.textContent = `${ownedCount}体保有`;
    }
    const selectAllCheckbox = document.getElementById("select-all-owned");
    if (selectAllCheckbox) {
      const totalCheckboxes =
        document.querySelectorAll(".owned-checkbox").length;
      const checkedCheckboxes = document.querySelectorAll(
        ".owned-checkbox:checked",
      ).length;
      if (checkedCheckboxes === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (checkedCheckboxes === totalCheckboxes) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }
  }
}
function updateSelectedDisplay() {
  const container = document.querySelector(".selected-eiketsu-container");
  if (!container) return;
  for (const className of Array.from(container.classList)) {
    if (className.startsWith("formation-")) {
      container.classList.remove(className);
    }
  }
  container.classList.add(`formation-${currentFormation}`);
  const styleId = "slot-status-fix";
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = `
        .slot-content { display: flex; flex-direction: column; height: 100%; padding: 13px 5px; text-align: center; }
        .slot-eiketsu-name { font-weight: 600; font-size: 10px; line-height: 1.3; flex-shrink: 0; white-space: nowrap; }
        .slot-factors { font-size: 9px; line-height: 1.3; color: #4b5563; overflow: hidden; text-overflow: ellipsis; }
        .slot-status { margin-top: auto; padding-top: 5px; display: flex; flex-wrap: wrap; white-space: nowrap; gap: 3px; justify-content: center; flex-shrink: 0; }
        .status-tag.bunkoku { background-color: #eef2ff; color: var(--brand-primary-hover, #1e40af); border: 1px solid var(--c-primary-border, #93c5fd); }
        .formation-shoyaku .selected-slot, .formation-kakuyoku .selected-slot { transition: top 0.3s ease; }
    `;
  container.innerHTML = "";
  const formation = FORMATIONS[currentFormation];
  if (!formation) {
    return;
  }
  const helpDiv = document.createElement("div");
  helpDiv.className = "placement-help";
  helpDiv.innerHTML = `
        <span class="help-icon">?</span>
        <div class="help-tooltip">
            ${formation.name}陣形<br>
            ${formation.description}<br>
            コスト制限: ${formation.costLimit}<br>
            因縁は隣接する3スロットで発動<br>
            <strong>ドラッグ＆ドロップで入れ替え可能</strong>
        </div>
    `;
  container.appendChild(helpDiv);
  const activeSlotsInPatterns = new Set();
  formation.adjacentPatterns.forEach((pattern) => {
    const slots = pattern.map((i) => selectedEiketsu[i]).filter(Boolean);
    if (slots.length === 3) {
      const eiketsuWithFactors = slots.map((slot) => ({
        ...slot.eiketsu,
        factors: getAvailableFactors(slot),
      }));
      INEN_DATA.forEach((inen) => {
        const result = analyzeInen(inen, eiketsuWithFactors);
        if (result && result.canActivate) {
          pattern.forEach((slotIndex) => activeSlotsInPatterns.add(slotIndex));
        }
      });
    }
  });
  selectedEiketsu.forEach((slot, index) => {
    const slotDiv = document.createElement("div");
    slotDiv.className = "selected-slot";
    slotDiv.dataset.slot = index;
    const position = formation.positions[index];
    slotDiv.style.cssText = `position: absolute; left: ${position.x}%; top: ${position.y}%; transform: translate(-50%, -50%);`;
    if (slot) {
      slotDiv.classList.add("filled");
      if (activeSlotsInPatterns.has(index)) {
        slotDiv.classList.add("active-slot");
      }
      const availableFactors = getAvailableFactors(slot);
      slotDiv.innerHTML = `
            <div class="slot-number">${getSlotDisplayNumber(index)}</div>
                <div class="slot-content">
                <div class="slot-eiketsu-name">${slot.eiketsu.name}</div>
                <button class="mobile-delete-btn slot-remove-btn" data-slot-index="${index}">×</button>
                <div class="slot-factors">${availableFactors
                  .filter(Boolean)
                  .join("・")}</div>
                <div class="slot-status">
                <span class="status-tag lb">凸${slot.limitBreak}</span>
                ${
                  slot.trust20
                    ? '<span class="status-tag trust">信20</span>'
                    : ""
                }
                ${
                  slot.bunkoku
                    ? '<span class="status-tag bunkoku" title="星：文曲 有効">文曲</span>'
                    : ""
                }
                </div>
            </div>`;
    } else {
      slotDiv.classList.add("empty");
      slotDiv.innerHTML = `<div class="slot-number">${
        getSlotDisplayNumber(index)
      }</div><div class="slot-content"><span class="empty-icon">＋</span></div>`;
    }
    setupDragAndDropEvents(slotDiv, index);
    container.appendChild(slotDiv);
  });
  drawAdjacentLines();
  addMobileAdjacentBadges();
  updateDragHandleVisibility();
}
function addMobileAdjacentBadges() {
  // モバイルでもPC版と同じabsolute+SVG線表示のため、グループドットは不要
  return;
  const container = document.querySelector(".selected-eiketsu-container");
  if (!container) return;
  const formation = FORMATIONS[currentFormation];
  if (!formation || !formation.adjacentPatterns) return;
  const groupColors = ["#3b82f6", "#10b981", "#f59e0b"];
  const adjacentPatterns = formation.adjacentPatterns;
  container.querySelectorAll(".selected-slot").forEach((slot) => {
    const slotIndex = parseInt(slot.dataset.slot);
    const dotsDiv = document.createElement("div");
    dotsDiv.className = "mobile-group-dots";
    adjacentPatterns.forEach((pattern, groupIndex) => {
      if (pattern.includes(slotIndex)) {
        const dot = document.createElement("span");
        dot.className = "group-dot";
        dot.style.backgroundColor =
          groupColors[groupIndex % groupColors.length];
        dotsDiv.appendChild(dot);
      }
    });
    if (dotsDiv.children.length > 0) {
      slot.appendChild(dotsDiv);
    }
  });
  const legend = document.createElement("div");
  legend.className = "mobile-adjacent-legend";
  adjacentPatterns.forEach((pattern, groupIndex) => {
    const label = document.createElement("span");
    label.className = "adj-group-label";
    const color = groupColors[groupIndex % groupColors.length];
    label.innerHTML = `<span class="adj-group-dot" style="background:${color}"></span>隣接${groupIndex + 1}: ${pattern.map((i) => getSlotDisplayNumber(i)).join("-")}`;
    legend.appendChild(label);
  });
  container.appendChild(legend);
}
function drawAdjacentLines() {
  const container = document.querySelector(".selected-eiketsu-container");
  if (!container) return;
  const existingSvg = container.querySelector("svg");
  if (existingSvg) existingSvg.remove();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.cssText = `position: absolute; width: 100%; height: 100%; pointer-events: none; top: 0; left: 0;`;
  const formation = FORMATIONS[currentFormation];
  if (!formation) return;
  const adjacentPatterns = formation.adjacentPatterns;
  const activePatterns = new Set();
  adjacentPatterns.forEach((pattern, patternIndex) => {
    const slots = pattern
      .map((i) => selectedEiketsu[i])
      .filter((s) => s !== null);
    if (slots.length === 3) {
      const eiketsuWithFactors = slots.map((slot) => {
        return { ...slot.eiketsu, factors: getAvailableFactors(slot) };
      });
      INEN_DATA.forEach((inen) => {
        const result = analyzeInen(inen, eiketsuWithFactors);
        if (result && result.canActivate) {
          activePatterns.add(patternIndex);
        }
      });
    }
  });

  // 描画用接続定義を使用（存在しない場合はadjacentPatternsからフォールバック）
  const lineConnections = formation.lineConnections || [];
  const drawnLines = new Set();

  // アクティブなパターンに含まれるスロットペアを特定
  const activeSlotPairs = new Set();
  activePatterns.forEach((patternIndex) => {
    const pattern = adjacentPatterns[patternIndex];
    for (let i = 0; i < pattern.length; i++) {
      for (let j = i + 1; j < pattern.length; j++) {
        const pairId = `${Math.min(pattern[i], pattern[j])}-${Math.max(
          pattern[i],
          pattern[j],
        )}`;
        activeSlotPairs.add(pairId);
      }
    }
  });

  // lineConnectionsに基づいて線を描画
  lineConnections.forEach((connection) => {
    const [currentIndex, nextIndex] = connection;
    const lineId = `${Math.min(currentIndex, nextIndex)}-${Math.max(
      currentIndex,
      nextIndex,
    )}`;
    if (drawnLines.has(lineId)) return;
    drawnLines.add(lineId);

    const pos1 = formation.positions[currentIndex];
    const pos2 = formation.positions[nextIndex];

    // この線がアクティブな因縁パターンに含まれるかチェック
    const lineIsActive = activeSlotPairs.has(lineId);

    // グループ別ライン色（初期）、発動時は緑
    const GROUP_COLORS = ["#050308", "#783839", "#3f7c7f"];
    const ACTIVE_COLOR = "#7fdc09";

    let strokeColor;
    if (lineIsActive) {
      strokeColor = ACTIVE_COLOR;
    } else if (formation.lineColorGroups) {
      const groupIdx = formation.lineColorGroups.findIndex(group =>
        group.includes(currentIndex) && group.includes(nextIndex)
      );
      strokeColor = groupIdx >= 0
        ? GROUP_COLORS[groupIdx % GROUP_COLORS.length]
        : "#e5e7eb";
    } else {
      strokeColor = "#e5e7eb";
    }
    const strokeWidth = lineIsActive ? "4" : "3";
    const opacity = lineIsActive ? "1" : "0.6";
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", `${pos1.x}%`);
    line.setAttribute("y1", `${pos1.y}%`);
    line.setAttribute("x2", `${pos2.x}%`);
    line.setAttribute("y2", `${pos2.y}%`);
    line.setAttribute("stroke", strokeColor);
    line.setAttribute("stroke-width", strokeWidth);
    line.setAttribute("opacity", opacity);
    if (lineIsActive) {
      line.classList.add("active-line");
    } else {
      // 実線（dasharray なし）
    }
    svg.appendChild(line);
  });
  container.insertBefore(svg, container.firstChild);
}
function calculateActualCost(eiketsu, limitBreak) {
  const baseCost = eiketsu.cost || 10;
  return Math.max(baseCost - limitBreak, 1);
}
function closeModal() {
  if (window.ModalManager) {
    window.ModalManager.close("detail-modal");
    return;
  }
  const modal = document.getElementById("detail-modal");
  if (modal) {
    modal.style.display = "none";
  }
}
function handleSlotDelete(slotIndex) {
  const slot = selectedEiketsu[slotIndex];
  if (!slot) return;
  const eiketsuName = slot.eiketsu.name;
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    if (confirm(i18n.t('confirm_delete_eiketsu', {name: eiketsuName}))) {
      executeSlotDelete(slotIndex, eiketsuName);
    }
  } else {
    showDeleteConfirmModal(slotIndex, eiketsuName);
  }
}
function executeSlotDelete(slotIndex, eiketsuName) {
  selectedEiketsu[slotIndex] = null;
  updateSelectedDisplay();
  clearCaches();
  updateAll();
  showMessage(i18n.t("msg_deleted", { name: eiketsuName }), "success");
}
function showDeleteConfirmModal(slotIndex, eiketsuName) {
  const content = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 18px; margin-bottom: 15px; color: #ef4444;">
                ⚠️ 英傑削除
            </div>
            <div style="margin-bottom: 20px; color: #374151;">
                <strong>${eiketsuName}</strong> をスロット${
                  getSlotDisplayNumber(slotIndex)
                }から削除しますか？
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="closeModal()" 
                        style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    キャンセル
                </button>
                <button onclick="executeSlotDelete(${slotIndex}, '${eiketsuName}'); closeModal();" 
                        style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    削除
                </button>
            </div>
        </div>
    `;
  showModal("確認", content);
}
/**
 * 因縁発動判定（信長の野望Online ゲーム仕様）
 *
 * 【判定ロジック】
 * 1. currentFormation の adjacentPatterns で定義された3スロットグループを取得
 * 2. 各スロットの有効因子を getAvailableFactors() で収集
 *    - 凸2以上: 因子2解放
 *    - 信頼20: 因子3解放
 *    - 分国の恩恵: 特化因子解放
 * 3. INEN_DATA から因縁を検索し、必要因子が全て揃っているかチェック
 * 4. 発動可能な因縁を results 配列に追加
 * 5. 未発動因縁について、あと何が足りないかを候補として表示
 *
 * @returns {void} 結果は updateInenDisplay() でUIに反映
 */
function calculateInen() {
  const cacheKey = [selectedEiketsu, currentFormation];
  const cached = cacheSystem.get("inen", ...cacheKey);
  if (cached) {
    updateInenDisplay(cached);
    handleOptimalPlacementIntegration();
    return;
  }
  const results = [];
  const adjacentPatterns = getCurrentAdjacentPatterns();
  const activatedInenNames = new Set();
  adjacentPatterns.forEach((pattern) => {
    const slots = pattern
      .map((i) => selectedEiketsu[i])
      .filter((s) => s !== null);
    if (slots.length === 3) {
      const eiketsuWithFactors = slots.map((slot) => {
        return {
          ...slot.eiketsu,
          factors: getAvailableFactors(slot),
          slotData: slot,
        };
      });
      INEN_DATA.forEach((inen) => {
        const result = analyzeInen(inen, eiketsuWithFactors);
        if (
          result &&
          result.canActivate &&
          !activatedInenNames.has(inen.name)
        ) {
          activatedInenNames.add(inen.name);
          result.pattern = pattern;
          result.slotNumbers = pattern.map((i) => getSlotDisplayNumber(i));
          results.push(result);
        }
      });
    }
  });
  const placedEiketsu = selectedEiketsu.filter((s) => s !== null);
  if (placedEiketsu.length > 0) {
    const placedEiketsuInfo = [];
    selectedEiketsu.forEach((slot, index) => {
      if (slot) {
        placedEiketsuInfo.push({
          slotIndex: index,
          slotNumber: getSlotDisplayNumber(index),
          eiketsu: slot.eiketsu,
          limitBreak: slot.limitBreak,
          trust20: slot.trust20,
          bunkoku: slot.bunkoku,
          availableFactors: getAvailableFactors(slot).map((factor) => ({
            factor,
            available: true,
          })),
        });
      }
    });
    INEN_DATA.forEach((inen) => {
      if (activatedInenNames.has(inen.name)) return;
      const factorAnalysis = analyzeFactorProvision(inen, placedEiketsuInfo);
      if (factorAnalysis.providedFactors.length > 0) {
        // 配置変更で発動可能かチェック
        let canActivateByRearrange = false;
        let activationPattern = null;

        // 全因子が揃っている場合、隣接パターンをチェック
        if (factorAnalysis.missingFactors.length === 0) {
          adjacentPatterns.forEach((pattern) => {
            if (canActivateByRearrange) return; // 既に見つかった場合はスキップ
            const slots = pattern
              .map((i) => selectedEiketsu[i])
              .filter((s) => s !== null);
            if (slots.length === 3) {
              // このパターンで発動可能か確認
              const eiketsuWithFactors = slots.map((slot) => ({
                ...slot.eiketsu,
                factors: getAvailableFactors(slot),
                slotData: slot,
              }));
              const result = analyzeInen(inen, eiketsuWithFactors);
              if (result && result.canActivate) {
                canActivateByRearrange = true;
                activationPattern = pattern;
              }
            }
          });
        }

        results.push({
          inen: inen,
          canActivate: false,
          matchCount: factorAnalysis.providedFactors.length,
          bestPattern: factorAnalysis,
          canActivateByRearrange, // 配置変更で発動可能か
          activationPattern, // 発動可能な隣接パターン
        });
      }
    });
  }
  cacheSystem.set("inen", results, ...cacheKey);
  updateInenDisplay(results);
  handleOptimalPlacementIntegration();
  applyInenStatusFilter();
  calculateAndDisplayTotalStatBoosts();

  // 因縁マップを更新
  if (typeof updateInenMap === "function") {
    updateInenMap();
  }
}
(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      loadExplorationSettings();
    });
  } else {
    loadExplorationSettings();
  }
})();
// [最適化] handleOptimalPlacementIntegration → optimization.js に分離済み (2026-03-21)
// [最適化] updateOptimalDisplay → optimization.js に分離済み (2026-03-21)
window.initializeMainApp = async function () {
  if (isInitialized) return;
  const loadSuccess = await loadData();
  if (loadSuccess) {
    initializePage();
    loadFromURL();
    setTimeout(() => {
      if (typeof window.toggleEiketsuSelection === "function") {
      } else {
      }
    }, 1000);
    updateAll();
    document.getElementById("loading").classList.add("hidden");
    const lastUpdatedFooter = document.getElementById("lastUpdatedFooter");
    if (lastUpdatedFooter) {
      lastUpdatedFooter.textContent = `最終更新日: ${lastUpdatedDate}`;
    }
  } else {
  }
};
// [最適化] calculateOptimalPlacementForCurrentTeam, generateAllPlacementPermutations,
// calculatePlacementInensCount, isWithinCostLimit, calculateTotalPatterns
// → optimization.js に分離済み (2026-03-21)

// [推奨エンジン] getCurrentActivatedInens, analyzeFactorProvision, analyzeInen → recommendation-engine.js に分離済み (2026-03-21)
function updateInenDisplay(results) {
  const container = document.getElementById("inen-list");
  if (!container) return;
  addCandidateSectionStyles();
  const activeCount = results.filter((r) => r.canActivate).length;
  const submissionBtn = document.getElementById("show-submission-modal-btn");
  if (submissionBtn) {
    if (activeCount >= 7) {
      submissionBtn.disabled = false;
    } else {
      submissionBtn.disabled = true;
    }
  }

  const totalCount = results.length;
  const activeCountElement = document.getElementById("active-count");
  const totalCountElement = document.getElementById("total-count");
  if (activeCountElement) activeCountElement.textContent = activeCount;
  if (totalCountElement) totalCountElement.textContent = totalCount;
  // サマリー統計（折り畳みヘッダー用）
  const activeSummary = document.getElementById("active-count-summary");
  const totalSummary = document.getElementById("total-count-summary");
  if (activeSummary) activeSummary.textContent = activeCount;
  if (totalSummary) totalSummary.textContent = totalCount;

  // パフォーマンス改善: ちらつき防止のため、先にフラグメントを構築してから一括置換
  const fragment = document.createDocumentFragment();
  const activeInens = results.filter((r) => r.canActivate);
  const uniqueActiveInens = [];
  const seenInenNames = new Set();
  activeInens.forEach((result) => {
    if (!seenInenNames.has(result.inen.name)) {
      uniqueActiveInens.push(result);
      seenInenNames.add(result.inen.name);
    }
  });
  uniqueActiveInens.sort((a, b) => {
    const orderA = a.inen.csvOrder !== undefined ? a.inen.csvOrder : -1;
    const orderB = b.inen.csvOrder !== undefined ? b.inen.csvOrder : -1;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.inen.name.localeCompare(b.inen.name, "ja");
  });
  let activeInenSection = null;
  if (uniqueActiveInens.length > 0) {
    activeInenSection = document.createElement("div");
    activeInenSection.className = "inen-section active-section-compact";
    activeInenSection.id = "active-inen-section";

    activeInenSection.innerHTML = `
            <h4 class="section-title-compact">✅ 発動中の因縁 (${
              uniqueActiveInens.length
            }個)</h4>
            <div class="active-inen-tags">
                ${uniqueActiveInens
                  .map(
                    (result) =>
                      `<span class="active-inen-tag" onclick="showActiveInenDetail('${result.inen.name}')" title="クリックで詳細表示">${result.inen.name}</span>`,
                  )
                  .join("")}
            </div>
        `;
  }
  const currentSelected = selectedEiketsu.filter((e) => e !== null);
  const candidateInens = results.filter((r) => !r.canActivate);
  if (currentSelected.length > 0 && currentSelected.length < 6) {
    const activatable = activeCount;
    const nextCandidates = calculateNextCandidates(
      currentSelected,
      activatable,
      candidateInens,
    );
    if (nextCandidates.length > 0) {
      const enhancedSuggestionSection = createEnhancedOptimalSuggestion(
        currentSelected,
        activatable,
        nextCandidates,
      );
      if (enhancedSuggestionSection) {
        fragment.appendChild(enhancedSuggestionSection);
      }
    }
  }
  if (candidateInens.length > 0) {
    candidateInens.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      const missingA = a.bestPattern
        ? a.bestPattern.missingFactors.length
        : 3 - a.matchCount;
      const missingB = b.bestPattern
        ? b.bestPattern.missingFactors.length
        : 3 - b.matchCount;
      return missingA - missingB;
    });
    const candidateSection = document.createElement("div");
    candidateSection.className = "inen-section candidate-section";
    // スマートフォン時は候補因縁を折りたたんだ状態で表示
    const isMobile = window.innerWidth < 768;
    candidateSection.innerHTML = `
            <details${isMobile ? '' : ' open'}>
              <summary class="section-title cursor-pointer" style="list-style: none; display: flex; justify-content: space-between; align-items: center;">
                <span>💡 候補因縁 (${candidateInens.length}個)</span>
                <span style="font-size: 12px; color: #94a3b8;">▼</span>
              </summary>
              <div class="candidate-filter-info">マッチ度が高い順に表示 | クリックで詳細・推奨英傑を確認</div>
              <div class="inen-cards">${candidateInens
                .map((result) => createInenCardHTML(result))
                .join("")}</div>
            </details>
        `;
    fragment.appendChild(candidateSection);
  }
  // ちらつき防止: フラグメント構築完了後に一括置換
  container.innerHTML = "";
  container.appendChild(fragment);
  if (activeInenSection) {
    const existingActiveSection = document.getElementById(
      "active-inen-section",
    );
    if (existingActiveSection) {
      existingActiveSection.remove();
    }
    let insertTarget = null;
    const formationArea = document.querySelector(".formation-area");
    if (formationArea) {
      insertTarget = formationArea;
    } else {
      const selectedContainer = document.querySelector(
        ".selected-eiketsu-container",
      );
      if (selectedContainer && selectedContainer.parentElement) {
        insertTarget = selectedContainer.parentElement;
      }
    }
    if (insertTarget) {
      const summaryBox = insertTarget.querySelector(".summary-box");
      if (summaryBox && summaryBox.nextSibling) {
        summaryBox.parentNode.insertBefore(
          activeInenSection,
          summaryBox.nextSibling,
        );
      } else if (summaryBox) {
        summaryBox.insertAdjacentElement("afterend", activeInenSection);
      } else {
        insertTarget.appendChild(activeInenSection);
      }
    }
  }
  applyInenStatusFilter();
  calculateAndDisplayTotalStatBoosts();
}
window.updateInenDisplay = updateInenDisplay;
function clearCaches() {
  if (typeof inenCache !== "undefined" && inenCache.clear) inenCache.clear();
  if (window.optimalCalculationCache && window.optimalCalculationCache.clear)
    window.optimalCalculationCache.clear();
  cacheSystem.clear();
  // 代替英傑キャッシュもクリア
  if (typeof clearAlternativeCache === "function") clearAlternativeCache();
  const existingActiveSection = document.getElementById("active-inen-section");
  if (existingActiveSection) existingActiveSection.remove();
}
window.clearCaches = clearCaches;
function calculateBondsForTeam(team) {
  const tempSelectedEiketsu = [...team];
  while (tempSelectedEiketsu.length < 6) tempSelectedEiketsu.push(null);
  const adjacentPatterns = getCurrentAdjacentPatterns();
  const activatedInenNames = new Set();
  adjacentPatterns.forEach((pattern) => {
    const slotsInPattern = pattern
      .map((i) => tempSelectedEiketsu[i])
      .filter(Boolean);
    if (slotsInPattern.length === 3) {
      const eiketsuWithFactors = slotsInPattern.map((slot) => ({
        ...slot.eiketsu,
        factors: getAvailableFactors(slot),
      }));
      INEN_DATA.forEach((inen) => {
        if (!inen || !Array.isArray(inen.factors)) return;
        if (!activatedInenNames.has(inen.name)) {
          const result = analyzeInen(inen, eiketsuWithFactors);
          if (result && result.canActivate) activatedInenNames.add(inen.name);
        }
      });
    }
  });
  return activatedInenNames.size;
}
// [推奨エンジン] calculateNextCandidates, createEnhancedOptimalSuggestion, sortRecommendations,
// createCompactCandidateCard, previewCandidateActivation, clearActivationPreview
// → recommendation-engine.js に分離済み (2026-03-21)
function createInenCardHTML(result) {
  if (!result || !result.inen) {
    return '<div class="inen-card error">データエラー</div>';
  }
  const statusIcon = result.canActivate ? "✅" : "💡";
  const effectSummary = getEffectSummary(result.inen.effects);
  let providedCount = 0;
  if (result.bestPattern && result.bestPattern.providedFactors) {
    providedCount = result.bestPattern.providedFactors.length;
  } else if (result.matchCount !== undefined) {
    providedCount = result.matchCount;
  }
  const totalRequired = result.inen.factors ? result.inen.factors.length : 3;
  let resultJson = "{}";
  try {
    resultJson = JSON.stringify(result).replace(/"/g, "&quot;");
  } catch (e) {
    resultJson = JSON.stringify({
      inen: result.inen,
      canActivate: result.canActivate,
    }).replace(/"/g, "&quot;");
  }
  // 不足因子数を計算
  const missingCount = result.bestPattern
    ? result.bestPattern.missingFactors?.length || totalRequired - providedCount
    : totalRequired - providedCount;

  return `
        <div class="inen-card ${result.canActivate ? "activatable" : ""}" 
             data-status="${result.canActivate ? "active" : "candidate"}" 
             data-type="${result.inen.type || "unknown"}"
             data-inen-name="${result.inen.name}"
             data-missing="${result.canActivate ? 0 : missingCount}"
             onclick="showInenDetail(${resultJson})">
            <div class="inen-header">
                <div class="inen-title">
                    <span class="inen-status-icon">${statusIcon}</span>
                    <div class="inen-name">${result.inen.name}</div>
                    <div class="inen-type">${result.inen.type}</div>
                </div>
                ${
                  result.canActivate
                    ? `<div class="inen-slots">発動中:スロット${
                        result.slotNumbers
                          ? result.slotNumbers.join("-")
                          : "不明"
                      }</div>`
                    : result.canActivateByRearrange
                      ? `<div class="inen-match activatable-hint" title="配置変更で発動可能">
                         <span class="match-indicator">${providedCount}/${totalRequired}</span>
                         <span class="match-label rearrange">🔄 配置変更で発動</span>
                       </div>`
                      : providedCount === totalRequired
                        ? `<div class="inen-match not-adjacent-hint" title="全因子揃っているが隣接していない">
                         <span class="match-indicator">${providedCount}/${totalRequired}</span>
                         <span class="match-label warning">⚠️ 隣接未達</span>
                       </div>`
                        : totalRequired - providedCount === 1
                          ? `<div class="inen-match one-more-hint" title="あと1因子で発動可能！" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-color: #f59e0b;">
                         <span class="match-indicator" style="color: #b45309; font-weight: 700;">${providedCount}/${totalRequired}</span>
                         <span class="match-label" style="color: #b45309;">⭐ あと1因子で発動</span>
                       </div>`
                          : `<div class="inen-match" title="現在提供可能な因子数/必要な因子数">
                         <span class="match-indicator">${providedCount}/${totalRequired}</span>
                         <span class="match-label">➕ ${
                           totalRequired - providedCount
                         }因子追加で発動</span>
                       </div>`
                }
            </div>
            <div class="inen-factors">
                ${result.inen.factors
                  .map((factor, index) => {
                    let isProvided = false;

                    if (
                      result.bestPattern &&
                      result.bestPattern.contributors &&
                      index < result.bestPattern.contributors.length &&
                      result.bestPattern.contributors[index]
                    ) {
                      isProvided = true;
                    }

                    return `<span class="inen-factor ${
                      isProvided ? "provided" : "missing"
                    }"
title="${
                      isProvided
                        ? "✅ 提供可能"
                        : "❌ この因子を持つ英傑が必要です"
                    }">${factor}</span>`;
                  })
                  .join("")}
            </div>
            <div class="inen-effect-summary">
                <span class="effect-label">効果:</span>
                <span class="effect-content">${effectSummary}</span>
            </div>
            ${
              result.canActivate
                ? `<div class="inen-effects">${formatEffects(
                    result.inen.effects,
                  )}</div>`
                : ""
            }
        </div>
    `;
}
// [推奨エンジン] addCandidateSectionStyles → recommendation-engine.js に分離済み (2026-03-21)
// [推奨エンジン] getEffectSummary, formatEffects → recommendation-engine.js に分離済み (2026-03-21)
function applyInenStatusFilter() {
  document.querySelectorAll(".inen-card").forEach((item) => {
    let show = true;
    if (inenStatusFilter === "active" && item.dataset.status !== "active")
      show = false;
    if (inenTypeFilter && item.dataset.type !== inenTypeFilter) show = false;
    item.classList.toggle("hidden", !show);
  });
}
calculateAndDisplayTotalStatBoosts();
function showModal(title, content) {
  document.getElementById("modal-title").textContent = title;
  const body = document.getElementById("modal-body");
  body.innerHTML = "";
  if (typeof content === "string") {
    body.innerHTML = content;
  } else {
    body.appendChild(content);
  }
  if (window.ModalManager) {
    window.ModalManager.open("detail-modal");
  } else {
    document.getElementById("detail-modal").style.display = "flex";
  }
}
function showShareModal(url) {
  const teamSummary = selectedEiketsu
    .map((s, i) =>
      s
        ? `${getSlotDisplayNumber(i)}.${s.eiketsu.name}(凸${s.limitBreak}${
            s.trust20 ? "/信20" : ""
          })`
        : `${getSlotDisplayNumber(i)}.未選択`,
    )
    .join("\n");
  const costCheck = checkCostLimit();
  const content = `
        <div style="margin-bottom: 15px;"><strong>陣形:</strong> ${
          FORMATIONS[currentFormation].name
        } (コスト制限: ${FORMATIONS[currentFormation].costLimit})</div>
        <div style="margin-bottom: 15px;"><strong>総コスト:</strong> ${
          costCheck.totalCost
        }/${costCheck.costLimit}${
          costCheck.isOverLimit
            ? '<span style="color: #ef4444;">(制限超過)</span>'
            : ""
        }</div>
        <div style="margin-bottom: 15px;"><strong>現在の編成:</strong><pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">${teamSummary}</pre></div>
        <div style="margin-bottom: 15px;"><strong>共有URL:</strong><div style="display: flex; gap: 10px; margin-top: 5px;">
            <input type="text" id="share-url-input" value="${url}" readonly style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
            <button onclick="copyToClipboard(document.getElementById('share-url-input').value)" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">コピー</button>
        </div></div>`;
  showModal("編成を共有", content);
}
function showInenDetail(resultData) {
  if (resultData.canActivate) {
    showActiveInenDetail(resultData.inen.name);
  } else {
    showCandidateInenDetail(resultData);
  }
}
function showActiveInenDetail(inenName) {
  // 戻るボタン用に因縁名を保存
  window._lastOpenedInenName = inenName;
  window._lastCandidateInenResult = null; // 発動中因縁の場合はこちらをクリア

  const inen = INEN_DATA.find((i) => i.name === inenName);
  if (!inen) return;
  const currentResult = getCurrentActivatedInens().find(
    (r) => r.inen.name === inenName,
  );

  // 各因子を提供している英傑を特定
  const factorProviders = {};
  inen.factors.forEach((factor) => {
    factorProviders[factor] = [];
  });

  if (currentResult && currentResult.pattern) {
    currentResult.pattern.forEach((slotIndex) => {
      const slot = selectedEiketsu[slotIndex];
      if (!slot) return;
      const availableFactors = getAvailableFactors(slot);
      availableFactors.forEach((factor) => {
        if (inen.factors.includes(factor) && factorProviders[factor]) {
          factorProviders[factor].push({
            name: slot.eiketsu.name,
            slotNumber: getSlotDisplayNumber(slotIndex),
          });
        }
      });
    });
  }

  // 貢献英傑のサマリーを生成
  const contributorsSummary =
    currentResult && currentResult.pattern
      ? currentResult.pattern
          .map((i) => selectedEiketsu[i]?.eiketsu?.name)
          .filter(Boolean)
          .join(" → ")
      : "不明";

  const content = `
        <div style="margin-bottom: 15px; padding: 12px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-radius: 8px;">
            <div style="font-size: 14px; color: #065f46; font-weight: 600;">✅ 発動中</div>
            <div style="font-size: 12px; color: #047857; margin-top: 4px;">スロット ${
              currentResult
                ? currentResult.pattern.map((i) => getSlotDisplayNumber(i)).join(" → ")
                : "不明"
            } で発動</div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <strong style="font-size: 14px;">🎯 貢献英傑:</strong>
            <div style="margin-top: 8px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                ${contributorsSummary
                  .split(" → ")
                  .map(
                    (name, i) => `
                    <span style="display: inline-block; background: #3b82f6; color: white; padding: 4px 10px; border-radius: 16px; margin: 2px; font-size: 13px;">
                        <span style="opacity: 0.7;">スロット${
                          currentResult?.pattern?.[i] != null ? getSlotDisplayNumber(currentResult.pattern[i]) : "?"
                        }</span> ${name}
                    </span>
                `,
                  )
                  .join("")}
            </div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <strong style="font-size: 14px;">📋 必要因子と提供者:</strong>
            ${inen.factors
              .map((factor) => {
                const providers = factorProviders[factor] || [];
                const providerText =
                  providers.length > 0
                    ? providers
                        .map(
                          (p) =>
                            `<span style="color: #3b82f6; font-weight: 600;">${p.name}</span>`,
                        )
                        .join(", ")
                    : '<span style="color: #9ca3af;">不明</span>';
                return `<div style="margin: 8px 0; padding: 10px; background: #f0fdf4; border-radius: 6px; border-left: 4px solid #10b981; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500;">${factor}</span>
                <span style="font-size: 12px;">← ${providerText}</span>
              </div>`;
              })
              .join("")}
        </div>
        
        <div style="margin-bottom: 15px;">
            <strong style="font-size: 14px;">⚡ 効果:</strong><br>
            <div style="margin-top: 8px; padding: 10px; background: #fffbeb; border-radius: 6px; border-left: 4px solid #f59e0b;">
                ${formatEffectsDetail(inen.effects)}
            </div>
        </div>
    `;
  showModal(`${inen.name} - 詳細分析`, content);
}
function showCandidateInenDetail(result) {
  // 削除時のモーダル更新用に保存
  window._lastCandidateInenResult = result;
  window._lastOpenedInenName = null; // 候補因縁の場合はこちらをクリア

  const inen = result.inen;
  const bestPattern = result.bestPattern;
  const currentEiketsuInfo = generateCurrentEiketsuInfo();
  const factorAnalysis = analyzeFactorProvision(inen, currentEiketsuInfo);
  const candidateEiketsu = findCandidateEiketsuForInen(inen, factorAnalysis);
  const content = buildEnhancedCandidateModal(
    inen,
    factorAnalysis,
    candidateEiketsu,
    currentEiketsuInfo,
  );
  showModal(`${inen.name} - 詳細分析`, content);
  const modal = document.getElementById("detail-modal");
  if (modal) {
    modal.classList.add("candidate-detail-modal");
    const originalCloseHandler = () => {
      modal.classList.remove("candidate-detail-modal");
      modal.removeEventListener("click", originalCloseHandler);
    };
    modal.addEventListener(
      "click",
      (e) => {
        if (e.target === modal || e.target.classList.contains("modal-close")) {
          originalCloseHandler();
        }
      },
      { once: false },
    );
    const escHandler = (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") {
        originalCloseHandler();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  }
}
// [推奨エンジン] generateCurrentEiketsuInfo, findCandidateEiketsuForInen,
// buildEnhancedCandidateModal, analyzeCandidateEiketsu, buildCandidateSection, formatEffectsDetail
// → recommendation-engine.js に分離済み (2026-03-21)
function showSlotEditModal(index) {
  const slot = selectedEiketsu[index];
  if (!slot) return;
  const content = document.createElement("div");
  content.innerHTML = `
<div style="margin-bottom: 15px;"><strong>限界突破:</strong><br><div class="lb-buttons" style="display: flex; gap: 10px; margin-top: 5px;">
${[0, 1, 2, 3, 4]
  .map(
    (n) =>
      `<button data-lb="${n}" class="lb-select-btn ${
        slot.limitBreak === n ? "active" : ""
      }" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">凸${n}</button>`,
  )
  .join("")}
</div></div>
<div style="margin-bottom: 15px;"><label style="display: flex; align-items: center; gap: 10px;"><input type="checkbox" id="trust-check" ${
    slot.trust20 ? "checked" : ""
  } style="width: 20px; height: 20px;"><strong>信頼度Lv20</strong></label></div>

${
  slot.eiketsu.factors[3]
    ? `<div style="margin-bottom: 15px;"><label style="display: flex; align-items: center; gap: 10px;"><input type="checkbox" id="bunkoku-check" ${
        slot.bunkoku ? "checked" : ""
      } style="width: 20px; height: 20px;"><strong>星：文曲(因子4解放)</strong></label></div>`
    : ""
}

<div style="display: flex; gap: 10px;"><button id="save-slot" style="flex: 1; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button><button id="find-replacement-btn" style="flex: 1; padding: 10px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">🔄 入替候補</button></div>`;
  content.querySelectorAll(".lb-select-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      content.querySelectorAll(".lb-select-btn").forEach((b) => {
        b.classList.remove("active");
        b.style.background = "white";
        b.style.color = "black";
      });
      e.target.classList.add("active");
      e.target.style.background = "#3b82f6";
      e.target.style.color = "white";
    }),
  );
  content.querySelector("#find-replacement-btn").addEventListener("click", () => {
    closeModal();
    if (typeof window.showSwapCandidates === "function") {
      window.showSwapCandidates(index);
    }
  });
  content.querySelector("#save-slot").addEventListener("click", () => {
    const activeBtn = content.querySelector(".lb-select-btn.active");
    const newLimitBreak = activeBtn
      ? parseInt(activeBtn.dataset.lb)
      : slot.limitBreak;
    const newTrust20 = content.querySelector("#trust-check").checked;
    const bunkokuCheck = content.querySelector("#bunkoku-check");
    const newBunkoku = bunkokuCheck ? bunkokuCheck.checked : false;
    const testSlot = {
      ...slot,
      limitBreak: newLimitBreak,
      trust20: newTrust20,
      bunkoku: newBunkoku,
    };
    const testSelected = [...selectedEiketsu];
    testSelected[index] = testSlot;
    let totalCost = 0;
    testSelected.forEach((s) => {
      if (s) {
        const cost = (s.eiketsu.cost || 10) - s.limitBreak;
        totalCost += Math.max(cost, 1);
      }
    });
    const formation = FORMATIONS[currentFormation];
    if (totalCost > formation.costLimit) {
      showMessage(
        `${formation.name}陣形のコスト制限(${formation.costLimit})を超えるため変更できません`,
        "error",
      );
      return;
    }
    slot.limitBreak = newLimitBreak;
    slot.trust20 = newTrust20;
    slot.bunkoku = newBunkoku;
    clearCaches();
    updateAll();
    closeModal();
  });
  showModal(slot.eiketsu.name, content);
  content.querySelectorAll(".lb-select-btn.active").forEach((b) => {
    b.style.background = "#3b82f6";
    b.style.color = "white";
  });
}
// [最適化] handleOptimalPlacementClick, showOptimalDetailModal,
// closeOptimalDetailModal, applyOptimalPlacement → optimization.js に分離済み (2026-03-21)

// [探索UI] → exploration.js に分離済み (2026-03-21)
window.explorationSettings = window.explorationSettings || {};
function calculateExplorationEnhancedStats(baseStats, heroName) {
  try {
    const settings = getExplorationSettings()[heroName] || {};
    const enhanced = { ...baseStats };
    Object.entries(EXPLORATION_BONUS_PER_POINT).forEach(
      ([stat, bonusPerPoint]) => {
        const points = settings[stat] || 0;
        enhanced[stat] = (enhanced[stat] || 0) + bonusPerPoint * points;
      },
    );
    return enhanced;
  } catch (error) {
    console.error("英傑探訪ステータス計算エラー:", error);
    return baseStats;
  }
}
// 因縁種類×サイズ×ステータスカテゴリから係数を取得
// BOND_BOOST_PERCENTAGES (config.js) のゲーム検証済みデータを使用
function lookupBondCoefficient(inenType, size, stat) {
  const typeCoeffs = BOND_BOOST_PERCENTAGES[inenType]
    || BOND_BOOST_PERCENTAGES["特殊因縁"]; // フォールバック
  if (!typeCoeffs) return 0;
  let cat;
  if (stat === "生命") cat = "生命";
  else if (stat === "気合") cat = "気合";
  else cat = "ステータス";
  return typeCoeffs[`${size}_${cat}`] || 0;
}

function calculateAllBoosts() {
  try {
    const allStatKeys = [
      "生命",
      "気合",
      "腕力",
      "耐久力",
      "器用さ",
      "知力",
      "魅力",
      "土",
      "水",
      "火",
      "風",
    ];
    const inenBonusSum = Object.fromEntries(allStatKeys.map((key) => [key, 0]));
    if (typeof getCurrentActivatedInens !== "function") {
      console.warn("getCurrentActivatedInens 関数が見つかりません");
      return {
        inenBoosts: inenBonusSum,
        formationBoosts: Object.fromEntries(allStatKeys.map((key) => [key, 0])),
      };
    }
    const activeInens = getCurrentActivatedInens();
    if (activeInens && activeInens.length > 0) {
      activeInens.forEach((result) => {
        const inenName = result.inen.name;
        const inenEffects = result.inen.effects;
        const contributingHeroes = result.pattern.map(
          (slotIndex) => selectedEiketsu[slotIndex],
        );
        const inenType = result.inen.type;
        const enhancedStatsSums = {};
        allStatKeys.forEach((stat) => {
          enhancedStatsSums[stat] = 0;
          contributingHeroes.forEach((heroSlot) => {
            if (heroSlot && heroSlot.eiketsu && heroSlot.eiketsu.stats) {
              const baseStats = heroSlot.eiketsu.stats;
              const heroName = heroSlot.eiketsu.name;
              const enhancedStats = calculateExplorationEnhancedStats(
                baseStats,
                heroName,
              );
              enhancedStatsSums[stat] += enhancedStats[stat] || 0;
            }
          });
        });
        Object.entries(inenEffects).forEach(([size, effectValue]) => {
          let statsString = "";
          if (Array.isArray(effectValue)) {
            if (effectValue.length > 0) {
              statsString = effectValue.join("・");
            } else {
              return;
            }
          } else if (typeof effectValue === "string") {
            statsString = effectValue;
          } else {
            return;
          }
          if (!statsString) return;
          const statNames = statsString.split("・");
          statNames.forEach((statName) => {
            let targetStats = [];
            if (statName === "四象") {
              targetStats = ["土", "水", "火", "風"];
            } else if (statName === "九光") {
              targetStats = allStatKeys;
            } else if (statName === "生命力") {
              targetStats = ["生命"];
            } else {
              const cleanStatName = statName.replace("属性", "");
              targetStats = [cleanStatName];
            }
            targetStats.forEach((stat) => {
              if (
                enhancedStatsSums[stat] !== undefined &&
                enhancedStatsSums[stat] > 0
              ) {
                // config.js の検証済み係数テーブルを使用
                const coefficient = lookupBondCoefficient(inenType, size, stat);
                const bondMultiplier = (NEW_CALCULATION_COEFFICIENTS && NEW_CALCULATION_COEFFICIENTS.BOND_MULTIPLIER) || 2.24;
                const bonus =
                  enhancedStatsSums[stat] * coefficient * bondMultiplier;
                inenBonusSum[stat] += bonus;
              }
            });
          });
        });
      });
    }
    const formationBoosts = Object.fromEntries(
      allStatKeys.map((key) => [key, 0]),
    );
    if (
      typeof FORMATION_STAT_BONUSES !== "undefined" &&
      typeof currentFormation !== "undefined" &&
      FORMATION_STAT_BONUSES[currentFormation]
    ) {
      const formationBonusRules = FORMATION_STAT_BONUSES[currentFormation];
      for (const stat of allStatKeys) {
        const formationRate = formationBonusRules[stat] || 0;
        if (formationRate > 0) {
          formationBoosts[stat] = inenBonusSum[stat] * formationRate;
        }
      }
    } else {
      console.warn(
        "陣形ボーナス設定が見つかりません:",
        typeof currentFormation !== "undefined"
          ? currentFormation
          : "currentFormation未定義",
      );
    }
    return { inenBoosts: inenBonusSum, formationBoosts: formationBoosts };
  } catch (error) {
    console.error("calculateAllBoosts() エラー:", error);
    const allStatKeys = [
      "生命",
      "気合",
      "腕力",
      "耐久力",
      "器用さ",
      "知力",
      "魅力",
      "土",
      "水",
      "火",
      "風",
    ];
    const emptyBoosts = Object.fromEntries(allStatKeys.map((key) => [key, 0]));
    return { inenBoosts: emptyBoosts, formationBoosts: emptyBoosts };
  }
}
function resetFilters() {
  resetFilterInputs();
  sortState = { column: "addedOrder", ascending: false };
  window.sortState = sortState;
  document.querySelectorAll(".sortable-header").forEach((header) => {
    const indicator = header.querySelector(".sort-indicator");
    if (indicator) {
      indicator.textContent = "";
    }
    header.style.backgroundColor = "";
  });
  resetFilterState();
  updateAfterFilterReset();
  showMessage(i18n.t("msg_search_reset"), "info");
}
function resetFilterInputs() {
  ["keyword-search", "display-filter", "inen-name-filter"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = id === "display-filter" ? "all" : "";
  });
  const jobFilter = document.getElementById("job-filter");
  if (jobFilter) jobFilter.value = "すべて";
  const factor1Filter = document.getElementById("factor1-filter");
  if (factor1Filter) factor1Filter.value = "すべて";
  const factor2Filter = document.getElementById("factor2-filter");
  if (factor2Filter) factor2Filter.value = "すべて";
  const factor3Filter = document.getElementById("factor3-filter");
  if (factor3Filter) factor3Filter.value = "すべて";
  const factor4Filter = document.getElementById("factor4-filter");
  if (factor4Filter) factor4Filter.value = "すべて";
  const statFilter = document.getElementById("stat-filter");
  if (statFilter) { statFilter.value = ""; currentStatFilter = ""; }
  const statMinValue = document.getElementById("stat-min-value");
  if (statMinValue) { statMinValue.value = ""; statMinValue.disabled = true; }
  if (window.VirtualScrollAdapter && window.VirtualScrollAdapter.setStatColumn) {
    window.VirtualScrollAdapter.setStatColumn("生命");
  }
}
function resetFilterState() {
  bondFactorFilter = [];
  clearCaches();
}
function updateAfterFilterReset() {
  populateAllDropdowns();
  renderEiketsuList();
  updateOwnedCountDisplay();
}
function resetSelection() {
  clearSelectedEiketsu();
  clearCaches();
  updateAll();
  updateOwnedCountDisplay();
  showMessage(
    "選択中の英傑をリセットしました（保有英傑は保持されます）",
    "success",
  );
}
function clearSelectedEiketsu() {
  if (Array.isArray(selectedEiketsu)) {
    selectedEiketsu.fill(null);
  }
}
function clearAllSelections() {
  clearSelectedEiketsu();
  clearCaches();
  updateAll();
  updateOwnedCountDisplay();
  showMessage(i18n.t("msg_selection_cleared"), "success");
}
function showStatsModal() {
  const stats = {
    eiketsuCount: EIKETSU_DATA.length,
    inenCount: INEN_DATA.length,
    factorCount: window.csvLoader.getFactors().length,
  };
  let ownedList = window.collectionManager
    ? window.collectionManager.getOwnedList()
    : [];
  let ownedCount = ownedList.length;
  let ownedInenSet = new Set();
  let ownedFactorSet = new Set();
  ownedList.forEach((name) => {
    const e = EIKETSU_DATA.find((e) => e.name === name);
    if (e) {
      (e.factors || []).forEach((f) => f && ownedFactorSet.add(f));
      (e.inens || []).forEach((i) => ownedInenSet.add(i));
    }
  });
  let ownedPatternCount = 0;
  if (ownedCount >= 6) {
    function factorial(n) {
      return n <= 1 ? 1 : n * factorial(n - 1);
    }
    const n = ownedCount;
    const nPk = factorial(n) / factorial(n - 6);
    ownedPatternCount = nPk * Object.keys(FORMATIONS).length;
  }
  let maxCost = 0;
  ownedList.forEach((name) => {
    const e = EIKETSU_DATA.find((e) => e.name === name);
    if (e && e.cost) maxCost = Math.max(maxCost, e.cost);
  });
  const content = `
        <div class="stats-section"><h4><span class="icon">📊</span> 基本統計</h4><div class="stats-grid">
            <div class="stats-item"><div class="stats-label">登録英傑数</div><div class="stats-value">${
              stats.eiketsuCount
            }</div></div>
            <div class="stats-item"><div class="stats-label">登録因縁数</div><div class="stats-value">${
              stats.inenCount
            }</div></div>
            <div class="stats-item"><div class="stats-label">登録因子数</div><div class="stats-value">${
              stats.factorCount
            }</div></div>
        </div></div>
        <div class="stats-section"><h4><span class="icon">🗂️</span> 保有英傑統計</h4><div class="stats-grid">
            <div class="stats-item"><div class="stats-label">保有英傑数</div><div class="stats-value">${ownedCount}</div></div>
            <div class="stats-item"><div class="stats-label">保有因縁数</div><div class="stats-value">${
              ownedInenSet.size
            }</div></div>
            <div class="stats-item"><div class="stats-label">保有因子数</div><div class="stats-value">${
              ownedFactorSet.size
            }</div></div>
            <div class="stats-item"><div class="stats-label">最大コスト</div><div class="stats-value">${maxCost}</div></div>
        </div></div>
        <div class="stats-section"><h4><span class="icon">🔢</span> 組み合わせパターン</h4><div class="stats-grid">
            <div class="stats-item"><div class="stats-label">保有英傑の組み合わせパターン数（6体×全陣形）</div><div class="stats-value">${
              ownedPatternCount ? ownedPatternCount.toLocaleString() : "―"
            }</div></div>
        </div></div>
        <div class="stats-section"><h4><span class="icon">⚔️</span> 陣形システム</h4><p>現在の陣形: <strong>${
          FORMATIONS[currentFormation].name
        }</strong> (${
          FORMATIONS[currentFormation].description
        })<br>コスト制限: ${
          FORMATIONS[currentFormation].costLimit
        }</p><p>利用可能な陣形:</p><ul>${Object.values(FORMATIONS)
          .map(
            (f) =>
              `<li>${f.name}-${f.description}(コスト制限:${f.costLimit})</li>`,
          )
          .join("")}</ul></div>
        <div class="stats-section"><h4><span class="icon">📐</span> 配置ルール</h4><p>因縁は隣接する3つのスロットで発動します。陣形によって隣接パターンが異なります。</p></div>`;
  showModal("統計・分析情報", content);
}
function showGuideModal() {
  // help-guide.js の統合モーダルに委譲
  if (window.HelpGuide && typeof window.HelpGuide.showModal === 'function') {
    window.HelpGuide.showModal();
  }
}
function showMessage(text, type = "info") {
  const el = document.createElement("div");
  el.className = `message-toast ${type}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
// [クリップボード・共有] copyToClipboard / shareTo → state-persistence.js に分離済み (2026-03-21)
// removeEiketsuFromModal はL9712に統合版あり（bounds check + scroll-reset防止対応）
function toggleCategoryExpansion(button, category) {
  const container = button.closest(".candidate-category-compact");
  const grid = container.querySelector(".candidate-grid-compact");
  const allCards = grid.querySelectorAll(".compact-candidate-card");
  const initialDisplay = parseInt(grid.dataset.initial) || 5;
  const increment = parseInt(grid.dataset.increment) || 10;
  let currentDisplay = parseInt(grid.dataset.current) || initialDisplay;
  const totalCards = allCards.length;
  const isFullyExpanded = currentDisplay >= totalCards;
  if (isFullyExpanded) {
    allCards.forEach((card, index) => {
      if (index < initialDisplay) {
        card.classList.remove("hidden-card");
        card.style.display = "";
      } else {
        card.classList.add("hidden-card");
        card.style.display = "none";
      }
    });
    currentDisplay = initialDisplay;
    container.classList.remove("fully-expanded");
    const remainingCount = totalCards - currentDisplay;
    button.innerHTML = `
            <span class="expand-text">さらに${Math.min(
              increment,
              remainingCount,
            )}体を表示</span>
            <span class="expand-arrow">▼</span>
        `;
  } else {
    const nextDisplay = Math.min(currentDisplay + increment, totalCards);
    allCards.forEach((card, index) => {
      if (index < nextDisplay) {
        card.classList.remove("hidden-card");
        card.style.display = "";
      } else {
        card.classList.add("hidden-card");
        card.style.display = "none";
      }
    });
    currentDisplay = nextDisplay;
    if (currentDisplay >= totalCards) {
      container.classList.add("fully-expanded");
      button.innerHTML = `
                <span class="expand-text">折りたたむ</span>
                <span class="expand-arrow">▲</span>
            `;
    } else {
      const remainingCount = totalCards - currentDisplay;
      button.innerHTML = `
                <span class="expand-text">さらに${Math.min(
                  increment,
                  remainingCount,
                )}体を表示</span>
                <span class="expand-arrow">▼</span>
            `;
    }
  }
  grid.dataset.current = currentDisplay;
  setTimeout(() => {
    container.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, 300);
}
function toggleModalCandidates(button) {
  const section = button.closest(".modal-candidate-section");
  const grid = section.querySelector(".candidate-grid");
  const hiddenCandidates = section.querySelector(".hidden-candidates");
  const isExpanded = button.dataset.expanded === "true";
  if (isExpanded) {
    if (hiddenCandidates) {
      hiddenCandidates.style.display = "none";
    }
    const allCards = grid.querySelectorAll(".candidate-card");
    allCards.forEach((card, index) => {
      if (index >= 8) {
        card.style.display = "none";
      }
    });
    button.dataset.expanded = "false";
    button.innerHTML = `
            <span class="expand-text">さらに表示</span>
            <span class="expand-arrow">▼</span>
        `;
  } else {
    if (hiddenCandidates) {
      hiddenCandidates.style.display = "grid";
      hiddenCandidates.style.gridTemplateColumns =
        "repeat(auto-fit, minmax(250px, 1fr))";
      hiddenCandidates.style.gap = "10px";
      hiddenCandidates.style.marginTop = "10px";
    } else {
      const allCards = grid.querySelectorAll(".candidate-card");
      allCards.forEach((card) => {
        card.style.display = "flex";
      });
    }
    button.dataset.expanded = "true";
    button.innerHTML = `
            <span class="expand-text">折りたたむ</span>
            <span class="expand-arrow">▲</span>
        `;
  }
}
function toggleRecommendationCandidates(button) {
  const section = button.closest(".enhanced-optimal-suggestion");
  if (!section) return;
  const hiddenCandidates = section.querySelector(".hidden-recommendations");
  if (!hiddenCandidates) return;
  const isExpanded = button.dataset.expanded === "true";
  if (isExpanded) {
    hiddenCandidates.style.display = "none";
    button.dataset.expanded = "false";
    const remainingCount = hiddenCandidates.children.length;
    button.innerHTML = `
            <span class="expand-text">さらに${remainingCount}体を表示</span>
            <span class="expand-arrow">▼</span>
        `;
  } else {
    hiddenCandidates.style.display = "grid";
    button.dataset.expanded = "true";
    button.innerHTML = `
            <span class="expand-text">折りたたむ</span>
            <span class="expand-arrow">▲</span>
        `;
  }
}
window.selectEiketsuByName = (name) => {
  const eiketsu = EIKETSU_DATA.find((e) => e.name === name);
  if (eiketsu) {
    selectEiketsu(eiketsu);
    closeModal();
  }
};
window.closeModal = closeModal;
window.handleSlotDelete = handleSlotDelete;
window.executeSlotDelete = executeSlotDelete;
window.showDeleteConfirmModal = showDeleteConfirmModal;
window.removeEiketsuFromModal = removeEiketsuFromModal;
window.toggleCategoryExpansion = toggleCategoryExpansion;
window.toggleModalCandidates = toggleModalCandidates;
window.showActiveInenDetail = showActiveInenDetail;
window.showCandidateInenDetail = showCandidateInenDetail;
window.showInenDetail = showInenDetail;
window.closeGlobalOptimizationResult = closeGlobalOptimizationResult;
window.applyGlobalOptimizationResult = applyGlobalOptimizationResult;
window.addEventListener("resize", () => {
  updateDragHandleVisibility();
  // モバイル⇔デスクトップ切替時に隣接グループバッジを更新
  const container = document.querySelector(".selected-eiketsu-container");
  if (container) {
    const existingLegend = container.querySelector(".mobile-adjacent-legend");
    container
      .querySelectorAll(".mobile-group-dots")
      .forEach((el) => el.remove());
    if (existingLegend) existingLegend.remove();
    addMobileAdjacentBadges();
  }
});
document.addEventListener("DOMContentLoaded", async () => {
  // モバイルではフィルターアコーディオンを初期状態で閉じる
  if (window.innerWidth <= 768) {
    const filtersAccordion = document.getElementById("filtersAccordion");
    if (filtersAccordion) filtersAccordion.removeAttribute("open");
  }
  if (isInitialized && isDataLoaded) {
    return;
  }
  const loadSuccess = await loadData();
  if (loadSuccess) {
    initializePage();
    loadFromURL();
    updateAll();
    if (window.collectionManager) {
      updateOwnedCountDisplay();
    }
    document.getElementById("loading").classList.add("hidden");
    const lastUpdatedFooter = document.getElementById("lastUpdatedFooter");
    if (lastUpdatedFooter) {
      lastUpdatedFooter.textContent = `最終更新日: ${lastUpdatedDate}`;
    }
    setTimeout(() => {
      setupSortableHeaders();
    }, 1000);
  }
});
class SimpleCollectionManager {
  constructor() {
    const saved = localStorage.getItem("ownedEiketsu");
    if (saved) {
      try {
        this.owned = new Set(JSON.parse(saved));
      } catch (e) {
        this.owned = new Set();
      }
    } else {
      this.owned = new Set();
    }
  }
  addEiketsu(eiketsuName) {
    if (!eiketsuName) return;
    this.owned.add(eiketsuName);
    this.updateDisplay();
    this.saveCollection();
  }
  removeEiketsu(eiketsuName) {
    if (!eiketsuName) return;
    this.owned.delete(eiketsuName);
    this.updateDisplay();
    this.saveCollection();
  }
  resetOwned() {
    this.owned.clear();
    localStorage.removeItem("ownedEiketsu");
    this.updateDisplay();
    this.saveCollection();
  }
  saveCollection() {
    localStorage.setItem(
      "ownedEiketsu",
      JSON.stringify(Array.from(this.owned)),
    );
  }
  hasEiketsu(eiketsuName) {
    return this.owned.has(eiketsuName);
  }
  updateDisplay() {
    const count = this.owned.size;
    const badge = document.getElementById("collection-badge");
    if (badge) {
      badge.textContent = `${count}体所有`;
    }
    const counter = document.getElementById("owned-count");
    if (counter) {
      counter.textContent = count;
    }
    const possibleCount = document.getElementById("possible-inen-count");
    if (possibleCount) {
      let estimatedCount = 0;
      if (count >= 6) {
        estimatedCount = Math.floor(count * 1.8);
      } else if (count >= 3) {
        estimatedCount = Math.floor(count * 1.5);
      } else if (count >= 1) {
        estimatedCount = count;
      }
      possibleCount.textContent = Math.min(estimatedCount, 50);
    }
  }
  updateUIWithCollection() {
    const rows = document.querySelectorAll(".eiketsu-table tbody tr");
    rows.forEach((row) => {
      const name = row.getAttribute("data-eiketsu-name");
      if (name) {
        if (this.hasEiketsu(name)) {
          row.classList.add("owned-eiketsu");
        } else {
          row.classList.remove("owned-eiketsu");
        }
      }
    });
    this.updateDisplay();
  }
}
window.simpleCollectionManager = new SimpleCollectionManager();
// 重複インスタンス化を削除（2025/12/20）
if (
  window.csvLoader &&
  window.simpleCollectionManager &&
  window.CompatibilityAnalyzer
) {
  window.compatibilityAnalyzer = new window.CompatibilityAnalyzer();
  if (window.aiMain && typeof window.aiMain.initialize === "function") {
    window.aiMain.initialize();
  }
}
function calculateTotalActivatedInens(placement) {
  const adjacentPatterns = getCurrentAdjacentPatterns();
  const activatedInenNames = new Set();
  adjacentPatterns.forEach((pattern) => {
    const slots = pattern.map((i) => placement[i]).filter(Boolean);
    if (slots.length === 3) {
      const availableFactors = new Set(
        slots.flatMap((slot) => {
          const factors = [slot.eiketsu.factors[0]];
          if (slot.limitBreak >= 2) factors.push(slot.eiketsu.factors[1]);
          if (slot.trust20) factors.push(slot.eiketsu.factors[2]);
          return factors.filter(Boolean);
        }),
      );
      INEN_DATA.forEach((inen) => {
        if (inen.factors.every((f) => availableFactors.has(f))) {
          activatedInenNames.add(inen.name);
        }
      });
    }
  });
  return activatedInenNames.size;
}
window.calculateTotalActivatedInens = calculateTotalActivatedInens;
// [推奨エンジン] renderImprovementSuggestionSection → recommendation-engine.js に分離済み (2026-03-21)
// [最適化] performGlobalOptimization → optimization.js に分離済み (2026-03-21)

function toggleEiketsuSelection(eiketsu) {
  if (!eiketsu || !eiketsu.name) {
    return false;
  }
  if (typeof selectedEiketsu === "undefined") {
    window.selectedEiketsu = [null, null, null, null, null, null];
    selectedEiketsu = window.selectedEiketsu;
  }
  if (typeof currentFormation === "undefined") {
    window.currentFormation = "hoen";
    currentFormation = window.currentFormation;
  }
  if (typeof FORMATIONS === "undefined") {
    return false;
  }
  const selectedNames = selectedEiketsu
    .filter((e) => e)
    .map((e) => e.eiketsu.name);
  const isSelected = selectedNames.includes(eiketsu.name);
  if (isSelected) {
    const selectedIndex = selectedEiketsu.findIndex(
      (slot) => slot && slot.eiketsu.name === eiketsu.name,
    );
    if (selectedIndex !== -1) {
      selectedEiketsu[selectedIndex] = null;
      if (typeof showMessage === "function") {
        showMessage(i18n.t("msg_deselected", { name: eiketsu.name }), "info");
      }
    }
  } else {
    if (typeof canPlaceEiketsu === "function" && !canPlaceEiketsu(eiketsu)) {
      const formation = FORMATIONS[currentFormation];
      if (typeof showMessage === "function") {
        showMessage(
          `${formation.name}陣形のコスト制限(${formation.costLimit})を超えるため配置できません`,
          "error",
        );
      }
      return false;
    }
    const emptyIndex = findEmptySlotIndex();
    if (emptyIndex === -1) {
      if (typeof showMessage === "function") {
        showMessage(i18n.t("msg_slots_full"), "warning");
      }
      return false;
    }
    selectedEiketsu[emptyIndex] = {
      eiketsu: eiketsu,
      limitBreak: 4,
      trust20: true,
      bunkoku: !!(eiketsu.factors && eiketsu.factors[3]),
    };
    if (typeof showMessage === "function") {
      showMessage(i18n.t("msg_selected", { name: eiketsu.name }), "success");
    }
  }
  try {
    if (typeof saveToURL === "function") {
      saveToURL();
    } else if (typeof saveStateToURL === "function") {
      saveStateToURL();
    }
  } catch (error) {}
  if (typeof clearCaches === "function") {
    clearCaches();
  }
  if (typeof updateAll === "function") {
    updateAll();
  }
  if (typeof updateSelectedDisplay === "function") {
    updateSelectedDisplay();
  }
  setTimeout(() => {
    const currentSelectedCount = selectedEiketsu.filter(
      (e) => e && e.eiketsu,
    ).length;
    if (currentSelectedCount > 0) {
      try {
        if (typeof calculateInen === "function") {
          calculateInen();
        }
        if (typeof updateInenDisplay === "function") {
          const results = getCurrentActivatedInens();
          updateInenDisplay(results);
        }
        if (typeof updateAll === "function") {
          updateAll();
        }
      } catch (error) {}
    }
  }, 200);
  return true;
}
window.toggleEiketsuSelection = toggleEiketsuSelection;
// NOTE: 重複した window.toggleEiketsuSelection 代入を1つに統合
/* POTENTIAL_DEAD_CODE: 自動表示テスト用デバッグ関数。本番環境での呼び出し元なし。
window.testAutoDisplay = function () {
  selectedEiketsu.fill(null);
  updateAll();
  setTimeout(() => {
    const eiketsu = EIKETSU_DATA.find((e) => e.name === "織田信長");
    if (eiketsu) {
      toggleEiketsuSelection(eiketsu);
    }
  }, 500);
};
*/
window.initializeGlobalVariables = function () {
  if (typeof selectedEiketsu === "undefined") {
    window.selectedEiketsu = [null, null, null, null, null, null];
  }
  if (typeof currentFormation === "undefined") {
    window.currentFormation = "fishScale";
  }
  if (typeof FORMATIONS === "undefined") {
    window.FORMATIONS = {
      shouyaku: {
        name: "衝軛",
        costLimit: 36,
        positions: [
          [0, 1, 2],
          [3, 4, 5],
        ],
      },
      kakuyoku: {
        name: "鶴翼",
        costLimit: 30,
        positions: [
          [0, 1, 2],
          [3, 4, 5],
        ],
      },
      fishScale: {
        name: "魚鱗",
        costLimit: 24,
        positions: [
          [0, 1, 2],
          [2, 3, 4],
          [4, 5, 0],
        ],
      },
      squareCircle: {
        name: "方円",
        costLimit: 24,
        positions: [
          [0, 1, 2],
          [1, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
          [4, 5, 0],
          [5, 0, 1],
        ],
      },
    };
  }
  if (typeof showMessage !== "function") {
    window.showMessage = function (message, type = "info") {
      const toast = document.createElement("div");
      toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${
                  type === "error"
                    ? "#ef4444"
                    : type === "success"
                      ? "#10b981"
                      : "#3b82f6"
                };
                color: white;
                border-radius: 6px;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = "slideOut 0.3s ease";
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
    };
  }
  if (!document.getElementById("toast-animations")) {
    const style = document.createElement("style");
    style.id = "toast-animations";
    style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
    document.head.appendChild(style);
  }
};
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    window.initializeGlobalVariables,
  );
} else {
  window.initializeGlobalVariables();
}
async function main() {
  if (isInitialized) return;
  const loadSuccess = await loadData();
  if (loadSuccess) {
    initializePage();
    loadFromURL();
    updateAll();
    document.getElementById("loading").classList.add("hidden");
    const lastUpdatedFooter = document.getElementById("lastUpdatedFooter");
    if (lastUpdatedFooter) {
      lastUpdatedFooter.textContent = `最終更新日: ${lastUpdatedDate}`;
    }
  }
}
document.addEventListener("DOMContentLoaded", main);
/* =====================================
 * 開発デバッグ関数（削除済み）
 *
 * 以下の関数は2025/12/20のリファクタリングで削除:
 * - debugEiketsuSelection
 * - testEiketsuSelection
 * - forceShowRecommendations
 * - finalEventDiagnosis
 * - emergencyFix
 * - diagnoseClickProblem
 * - fixClickIssueNow
 * - diagnoseDetailedClick
 * - autoTestClick
 * - completeReboot
 * ===================================== */

class CollectionManager {
  constructor() {
    this.ownedEiketsu = new Set();
    this.storageKey = "eiketsu_collection";
    this.loadFromStorage();
  }
  initialize() {}
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) this.ownedEiketsu = new Set(JSON.parse(saved).owned || []);
    } catch (e) {}
  }
  saveToStorage() {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({ owned: Array.from(this.ownedEiketsu) }),
      );
    } catch (e) {}
  }
  toggleEiketsu(name) {
    if (this.ownedEiketsu.has(name)) this.ownedEiketsu.delete(name);
    else this.ownedEiketsu.add(name);
    this.saveToStorage();
  }
  hasEiketsu(name) {
    return this.ownedEiketsu.has(name);
  }
  getOwnedCount() {
    return this.ownedEiketsu.size;
  }
  getOwnedList() {
    return Array.from(this.ownedEiketsu);
  }
  clearAll() {
    this.ownedEiketsu.clear();
    this.saveToStorage();
  }
  exportToFile() {
    // localStorageから最新データを再読込して確実に同期
    this.loadFromStorage();
    const data = {
      owned: Array.from(this.ownedEiketsu),
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eiketsu-collection-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof window.showMessage === "function") {
      window.showMessage(`${this.ownedEiketsu.size}体の保有データを書き出しました`, "success");
    }
  }
  importFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.owned && Array.isArray(data.owned)) {
            this.ownedEiketsu = new Set(data.owned);
            this.saveToStorage();
            this.render();
            if (typeof window.renderEiketsuList === "function") {
              window.renderEiketsuList();
            }
            if (typeof window.showMessage === "function") {
              window.showMessage(`${this.ownedEiketsu.size}体の保有データを読み込みました`, "success");
            }
          }
        } catch (err) {
          if (typeof window.showMessage === "function") {
            window.showMessage("ファイルの読み込みに失敗しました", "error");
          }
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }
  render() {
    document.querySelectorAll("tr[data-eiketsu-name]").forEach((row) => {
      const name = row.dataset.eiketsuName;
      const checkbox = row.querySelector(".owned-checkbox");
      const isOwned = this.hasEiketsu(name);
      row.classList.toggle("owned-eiketsu", isOwned);
      if (checkbox) checkbox.checked = isOwned;
    });
    if (typeof updateOwnedCountDisplay === "function")
      updateOwnedCountDisplay();
  }
}
window.collectionManager = new CollectionManager();
window.unifiedCollectionManager = window.collectionManager;
// 保有書出・読込ボタンのハンドラ登録（実データを管理するインスタンスにバインド）
const exportOwnedBtn = document.getElementById("export-owned-button");
if (exportOwnedBtn) exportOwnedBtn.addEventListener("click", () => window.collectionManager.exportToFile());
const importOwnedBtn = document.getElementById("import-owned-button");
if (importOwnedBtn) importOwnedBtn.addEventListener("click", () => window.collectionManager.importFromFile());
// 重複インスタンス化を削除（2025/12/20）
const collectionStyles = document.createElement("style");
collectionStyles.textContent = `
    /* 保有英傑管理システム */
    .owned-column {
        width: 40px;
        text-align: center;
        position: relative;
        pointer-events: none;
    }
    
    .owned-checkbox {
        cursor: pointer;
        width: 16px;
        height: 16px;
        position: relative;
        z-index: 10;
        pointer-events: auto;
    }
    
    tr.owned-eiketsu {
        background-color: #f0f9ff !important;
    }
    
    tr.owned-eiketsu:hover {
        background-color: #e0f2fe !important;
    }
    
    /* 保有数表示（resultsCountと同じスタイル） */
    .owned-count-display {
        color: #666;
        font-size: 14px;
        margin-right: 0;
    }
    
    .count-separator {
        color: #999;
        margin: 0 8px;
        font-size: 14px;
    }
    
    /* 保有リセットボタン（小さめ） */
    .reset-owned-btn-small {
        background-color: #f87171;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s ease, color 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 32px;
    }
    
    .reset-owned-btn-small:hover {
        background-color: #ef4444;
        transform: translateY(-1px);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .reset-owned-btn-small:active {
        transform: translateY(0);
        box-shadow: none;
    }
    
    .reset-owned-btn-small i {
        font-size: 12px;
    }
    
    /* 全選択チェックボックス */
    #select-all-owned {
        cursor: pointer;
    }
    
    /* ボタングループのスタイル統一 */
    .filter-button-group {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    
    .filter-button-group button {
        height: 32px;
        font-size: 12px;
        padding: 6px 12px;
    }
    
    /* 既存のリセットボタンのサイズ調整 */
    #reset-filters, #reset-selection {
        height: 32px !important;
        font-size: 12px !important;
        padding: 6px 12px !important;
    }
    
    /* 古いバッジスタイル（削除予定） */
    .owned-status {
        display: none;
    }
    
    #owned-count-badge {
        display: none;
    }
`;
document.head.appendChild(collectionStyles);
window.initializeMainApp = async function () {
  if (isInitialized && isDataLoaded) {
    return;
  }
  const loadSuccess = await loadData();
  if (loadSuccess) {
    initializePage();
    loadFromURL();
    updateAll();
    updateOwnedCountDisplay();
    document.getElementById("loading").classList.add("hidden");
  }
};
// [編成データコピー] generateAndCopyTeamData → state-persistence.js に分離済み (2026-03-21)
calculateAndDisplayTotalStatBoosts();
// [探索UI] saveExplorationSettings / loadExplorationSettings / resetExplorationSystem → exploration.js に分離済み (2026-03-21)
function fixFormationSwitching() {
  const formationSelect = document.getElementById("formation-select");
  if (!formationSelect) {
    console.error("陣形セレクターが見つかりません");
    return false;
  }
  const newFormationSelect = formationSelect.cloneNode(true);
  formationSelect.parentNode.replaceChild(newFormationSelect, formationSelect);
  newFormationSelect.addEventListener("change", function (e) {
    window.currentFormation = e.target.value;
    currentFormation = e.target.value;
    try {
      if (typeof updateSelectedDisplay === "function") {
        updateSelectedDisplay();
      }
      if (typeof updateAll === "function") {
        updateAll();
      }
      if (
        typeof showMessage === "function" &&
        typeof FORMATIONS !== "undefined"
      ) {
        showMessage(
          `陣形を${FORMATIONS[currentFormation].name}に変更しました`,
          "success",
        );
      }
    } catch (error) {
      console.error("陣形切り替えエラー:", error);
    }
  });
  return true;
}
function ensureUpdateSelectedDisplay() {
  if (
    typeof updateSelectedDisplay === "function" &&
    !window.originalUpdateSelectedDisplay
  ) {
    window.originalUpdateSelectedDisplay = updateSelectedDisplay;
  }
  window.updateSelectedDisplay = function () {
    try {
      const container = document.querySelector(".selected-eiketsu-container");
      if (!container) {
        console.warn("selected-eiketsu-container が見つかりません");
        return;
      }
      for (const className of Array.from(container.classList)) {
        if (className.startsWith("formation-")) {
          container.classList.remove(className);
        }
      }
      if (typeof currentFormation !== "undefined") {
        container.classList.add(`formation-${currentFormation}`);
      }
      if (
        window.originalUpdateSelectedDisplay &&
        window.originalUpdateSelectedDisplay !== window.updateSelectedDisplay
      ) {
        window.originalUpdateSelectedDisplay();
      }
    } catch (error) {
      console.error("updateSelectedDisplay実行エラー:", error);
    }
  };
}
// [探索UI] createExplorationModal / addExplorationButton / openExplorationModal / updateExplorationModalContent / setupExplorationEventListeners / resetAllExploration / setAllExplorationLevel / setBulkExplorationLevel → exploration.js に分離済み (2026-03-21)
function initializeFixAndExplorationModal() {
  const formationFixed = fixFormationSwitching();
  ensureUpdateSelectedDisplay();
  createExplorationModal();
  try {
    const saved = localStorage.getItem("exploration_settings");
    if (saved) {
      window.explorationSettings = JSON.parse(saved);
    }
  } catch (error) {}
  return { formationFixed, modalCreated: true, buttonAdded: true };
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initializeFixAndExplorationModal, 1000);
  });
} else {
  setTimeout(initializeFixAndExplorationModal, 1000);
}
window.initializeFixAndExplorationModal = initializeFixAndExplorationModal;
function redesignFormationArea() {
  const formationArea = document.querySelector(
    ".selected-eiketsu-container",
  )?.parentElement;
  if (!formationArea) {
    console.error("陣形エリアの親要素が見つかりません");
    return false;
  }
  const header = formationArea.querySelector(
    ".flex.justify-between.items-center",
  );
  if (!header) {
    console.error("陣形エリアのヘッダーが見つかりません");
    return false;
  }
  const newHeaderHTML = `
            <select id="formation-select" class="formation-select-redesigned">
                ${Object.entries(FORMATIONS || {})
                  .map(
                    ([key, f]) =>
                      `<option value="${key}" ${
                        key === (window.currentFormation || "hoen")
                          ? "selected"
                          : ""
                      }>${f.name}</option>`,
                  )
                  .join("")}
            </select>
            <button id="copy-team-button" class="formation-btn" title="現在の編成情報をクリップボードにコピーします"><span class="btn-text">編成コピー</span></button>
            <button id="exploration-settings-btn" class="formation-btn" title="英傑探訪の設定を開きます"><span class="btn-text">探訪設定</span></button>`;
  header.innerHTML = newHeaderHTML;
  const formationSelect = document.getElementById("formation-select");
  if (formationSelect) {
    formationSelect.addEventListener("change", function (e) {
      window.currentFormation = e.target.value;
      // キャッシュをクリアして因縁を再計算
      if (typeof clearCaches === "function") clearCaches();
      if (typeof updateAll === "function") updateAll();
    });
  }
  const copyBtn = document.getElementById("copy-team-button");
  if (copyBtn) {
    copyBtn.addEventListener("click", generateAndCopyTeamData);
  }
  const explorationBtn = document.getElementById("exploration-settings-btn");
  if (explorationBtn) {
    explorationBtn.addEventListener("click", openExplorationModal);
  }
  return true;
}
function applyFormationAreaStyles() {
  const styleId = "formation-area-redesign-styles";
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) existingStyle.remove();
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
        /* 陣形ヘッダー全体のレイアウト */
        .formation-header-redesigned {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 12px;
            padding: 12px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            align-items: center;
        }
        
        /* 陣形セレクター セクション */
        .formation-selector-section {
            display: flex;
            justify-content: flex-start;
            align-items: center;
        }
        
        .formation-selector {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .formation-label {
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            white-space: nowrap;
            margin: 0;
        }
        
        .formation-select-redesigned {
            padding: 4px 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            background: white;
            font-size: 13px;
            color: #374151;
            cursor: pointer;
            transition: color 0.2s ease, border-bottom-color 0.2s ease;
            min-width: 50px;
            font-weight: 500;
        }
        
        .formation-select-redesigned:hover {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
        
        .formation-select-redesigned:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        
        /* ボタンセクション */
        .formation-buttons-section {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }
        
        /* ボタングループ */
        .button-group {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 4px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.5);
        }
        
        
        /* 統一ボタンスタイル */
        .formation-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            border: none;
            border-radius: 5px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s ease, border-color 0.2s ease;
            min-height: 32px;
            white-space: nowrap;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .formation-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }
        
        .formation-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        /* ボタンバリエーション */
        .formation-btn-primary {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
        }
        
        .formation-btn-primary:hover {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        }
        
        .formation-btn-secondary {
            background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
            color: white;
        }
        
        .formation-btn-secondary:hover {
            background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
        }
        
        .formation-btn-accent {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
        }
        
        .formation-btn-accent:hover {
            background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        }
        
        /* ボタン内のアイコンとテキスト */
        .btn-icon {
            font-size: 14px;
            line-height: 1;
        }
        
        .btn-text {
            font-size: 12px;
            font-weight: 500;
        }
        
        /* レスポンシブ対応 - モバイル向け調整 */
        @media (max-width: 768px) {
            .formation-header-redesigned {
                padding: 8px;
                gap: 6px;
                flex-wrap: wrap;
            }
            
            .formation-select-redesigned {
                flex-shrink: 0;
                min-width: 55px;
                padding: 6px 8px;
                font-size: 12px;
            }
            
            .formation-btn {
                padding: 6px 10px;
                font-size: 11px;
                white-space: nowrap;
                flex-shrink: 0;
            }
            
            .btn-text {
                font-size: 11px;
            }
        }
        
        @media (max-width: 480px) {
            .formation-select-redesigned {
                min-width: 50px;
                padding: 5px 6px;
                font-size: 11px;
            }
            
            .formation-btn {
                padding: 5px 8px;
                font-size: 10px;
            }
            
            .btn-text {
                font-size: 10px;
            }
        }

         /* PC版：選択リセットボタンを非表示 */
        @media (min-width: 769px) {
            #reset-selection-btn {
                display: none !important;
            }
        }
        
        /* SP版：選択リセットボタンを表示 */
        @media (max-width: 768px) {
            #reset-selection-btn {
                display: flex !important;
                align-items: center;
                gap: 4px;
            }
            
            /* SP版での追加調整 */
            .formation-buttons-section {
                flex-direction: column;
                align-items: stretch;
                gap: 6px;
            }
            
            .button-group {
                justify-content: center;
                flex-wrap: wrap;
            }
            
            .formation-btn {
                flex: 1;
                min-width: 0;
                justify-content: center;
                font-size: 11px;
            }
        }
        
        @media (max-width: 480px) {
            /* 極小画面での調整 */
            .button-group {
                width: 100%;
            }
            
            .formation-btn {
                padding: 8px 6px;
                min-height: 36px;
            }
            
            #reset-selection-btn {
                background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
                border: 1px solid #4b5563;
            }
            
            #reset-selection-btn:hover {
                background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
            }
        }
        
        /* タッチデバイス対応（選択リセットボタン専用） */
        @media (pointer: coarse) {
            #reset-selection-btn {
                min-width: 80px;
                touch-action: manipulation;
            }
        }
    `;
  document.head.appendChild(style);
}
function initializeFormationAreaRedesign() {
  const executeRedesign = () => {
    try {
      redesignFormationArea();
    } catch (error) {
      console.error("陣形エリア整理エラー:", error);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(executeRedesign, 100);
    });
  } else {
    setTimeout(executeRedesign, 100);
  }
}
document.body.addEventListener("click", function (e) {
  const targetId = e.target.id;
  const targetButton = e.target.closest("button");
  const buttonId = targetButton ? targetButton.id : null;
  if (
    targetId === "exploration-settings-btn" ||
    buttonId === "exploration-settings-btn"
  ) {
    if (typeof openExplorationModal === "function") {
      openExplorationModal();
    } else {
      console.error("openExplorationModal関数が見つかりません");
    }
  }
  if (targetId === "share-url-btn" || buttonId === "share-url-btn" || targetId === "share-url-btn-desktop") {
    if (typeof generateShareURL === "function") {
      generateShareURL();
    }
  }
  if (targetId === "copy-team-button" || buttonId === "copy-team-button") {
    if (typeof generateAndCopyTeamData === "function") {
      generateAndCopyTeamData();
    }
  }
});
window.initializeFormationAreaRedesign = initializeFormationAreaRedesign;
window.redesignFormationArea = redesignFormationArea;
initializeFormationAreaRedesign();
window.initializeFormationAreaRedesign = initializeFormationAreaRedesign;
window.redesignFormationArea = redesignFormationArea;
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(() => {
    if (typeof initializeFormationSelector === "function") {
      initializeFormationSelector();
    }
  }, 200);
});
window.addEventListener("load", function () {
  setTimeout(() => {
    const shareBtn = document.getElementById("share-url-btn");
    if (!shareBtn) {
      if (typeof initializeFormationSelector === "function") {
        initializeFormationSelector();
      }
    }
  }, 500);
});
// [URL復元] restoreTeamFromURL / setupAutoRestore → state-persistence.js に分離済み (2026-03-21)
function resetSelectedEiketsu() {
  if (!confirm(i18n.t('confirm_reset_selection'))) {
    return;
  }
  try {
    if (typeof selectedEiketsu !== "undefined") {
      for (let i = 0; i < selectedEiketsu.length; i++) {
        selectedEiketsu[i] = null;
      }
    }
    if (typeof updateSelectedDisplay === "function") {
      updateSelectedDisplay();
    }
    if (typeof calculateInen === "function") {
      calculateInen();
    }
    if (typeof updateTotalCost === "function") {
      updateTotalCost();
    }
    if (typeof window.explorationSettings !== "undefined") {
      window.explorationSettings = {};
      if (typeof createExplorationUI === "function") {
        createExplorationUI();
      }
      if (typeof calculateAndDisplayTotalStatBoosts === "function") {
        calculateAndDisplayTotalStatBoosts();
      }
    }
    try {
      localStorage.removeItem("exploration_settings");
    } catch (error) {
      console.warn("探訪設定の削除に失敗:", error);
    }
  } catch (error) {
    alert(i18n.t('alert_reset_error'));
  }
}
window.resetSelectedEiketsu = resetSelectedEiketsu;
function setupExtraEventListeners() {
  const formationHeader = document.querySelector(
    ".some-formation-header-selector",
  );
  if (formationHeader) {
    const submissionButton = document.createElement("button");
    submissionButton.id = "show-submission-modal-btn";
    submissionButton.textContent = "この編成を投稿";
    submissionButton.className = "custom-btn";
    submissionButton.addEventListener("click", showSubmissionModal);
    formationHeader.appendChild(submissionButton);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(setupCommunityButtonListeners, 1000);
});

// グローバル公開（提案機能）
// window.previewCandidateActivation = previewCandidateActivation;  // → recommendation-engine.js に移動済み
// window.clearActivationPreview = clearActivationPreview;  // → recommendation-engine.js に移動済み

/**
 * =====================================
 * UX改善機能
 * =====================================
 */

// フローティング共有ボタン
document.addEventListener("DOMContentLoaded", () => {
  const floatingShareBtn = document.getElementById("floating-share-btn");
  if (floatingShareBtn) {
    floatingShareBtn.addEventListener("click", () => {
      if (typeof generateShareURL === "function") {
        generateShareURL();
      }
    });
  }
});

// ハンバーガーメニュー
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menu-toggle-btn");
  const dropdownMenu = document.getElementById("header-dropdown-menu");

  if (menuToggle && dropdownMenu) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("hidden");
    });

    // メニュー外クリックで閉じる
    document.addEventListener("click", () => {
      dropdownMenu.classList.add("hidden");
    });

    dropdownMenu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
});

// [推奨エンジン] targetInenState, initTargetInenSelector, toggleTargetInen,
// updateTargetInenUI, calculateTargetCandidates
// → recommendation-engine.js に分離済み (2026-03-21)
// [推奨エンジン] updateAlternativeSuggestion, findAlternativeEiketsu, replaceEiketsuInSlot
// → recommendation-engine.js に分離済み (2026-03-21)
// [推奨エンジン] handleModalDragStart, handleModalDragOver, handleModalDrop, handleModalDragEnd,
// showSwapCandidates, categorizeCandidatesByFactors, renderCategorizedCandidates, renderSwapButton,
// filterSwapCandidates, escapeHtml, executeSwap, goBackFromSwap, removeEiketsuFromModal,
// alternativeSuggestionTimer
// → recommendation-engine.js に分離済み (2026-03-21)

/**
 * =====================================
 * 因子フィルター動的生成
 * =====================================
 */

// INEN_DATAから因子を抽出してドロップダウンを生成
function populateFactorDropdowns() {
  if (!INEN_DATA || INEN_DATA.length === 0) {
    console.warn("因子フィルター: INEN_DATAが空です");
    return;
  }

  // すべての因子を収集（CSV登場順を維持）
  const allFactors = [];
  const seen = new Set();

  INEN_DATA.forEach((inen) => {
    if (inen.factors && Array.isArray(inen.factors)) {
      inen.factors.forEach((factor) => {
        if (factor && typeof factor === "string" && factor.trim()) {
          const trimmed = factor.trim();
          if (!seen.has(trimmed)) {
            seen.add(trimmed);
            allFactors.push(trimmed);
          }
        }
      });
    }
  });

  // 特化因子リスト（因子1のみに表示、因子2-4には表示しない）
  const specializedFactors = new Set([
    "武士道",
    "武芸",
    "軍学",
    "僧兵",
    "仏門",
    "密教",
    "神道",
    "古神道",
    "雅楽",
    "陰陽道",
    "仙道",
    "召喚術",
    "忍法",
    "暗殺術",
    "忍術",
    "刀鍛冶",
    "鎧鍛冶",
    "鉄砲鍛冶",
    "医学",
    "神通力",
    "修験道",
    "四象",
    "地勢",
    "殺陣",
  ]);

  // 各因子フィルタードロップダウンを更新
  const factorDropdowns = [
    document.getElementById("factor1-filter"),
    document.getElementById("factor2-filter"),
    document.getElementById("factor3-filter"),
    document.getElementById("factor4-filter"),
  ];

  factorDropdowns.forEach((dropdown, idx) => {
    if (!dropdown) return;

    // 既存のオプションをクリア（初期オプション以外）
    while (dropdown.options.length > 1) {
      dropdown.remove(1);
    }

    // 因子を追加
    // 因子1（idx=0）: 特化因子のみ
    // 因子2-4: 特化因子以外のみ
    allFactors.forEach((factor) => {
      const isSpecialized = specializedFactors.has(factor);

      if (idx === 0) {
        // 因子1: 特化因子のみ表示
        if (!isSpecialized) return;
      } else {
        // 因子2-4: 特化因子を除外
        if (isSpecialized) return;
      }

      const option = document.createElement("option");
      option.value = factor;
      option.textContent = factor;
      dropdown.appendChild(option);
    });
  });
}

// グローバル公開
window.populateFactorDropdowns = populateFactorDropdowns;

// データロード完了を監視して初期化
function waitForDataAndPopulate() {
  if (
    INEN_DATA &&
    INEN_DATA.length > 0 &&
    EIKETSU_DATA &&
    EIKETSU_DATA.length > 0
  ) {
    // パフォーマンスインデックスをビルド（高速検索用）
    buildPerformanceIndex();

    // 因子ドロップダウンを生成
    populateFactorDropdowns();
    setupResetButtonHandler();
  } else {
    setTimeout(waitForDataAndPopulate, 500);
  }
}

// 検索リセットボタンにイベントを追加
function setupResetButtonHandler() {
  const resetButtons = document.querySelectorAll(
    '[id*="reset"], .reset-btn, button',
  );
  resetButtons.forEach((btn) => {
    if (btn.textContent && btn.textContent.includes("リセット")) {
      btn.addEventListener("click", () => {
        // リセット後に因子ドロップダウンを再生成
        setTimeout(populateFactorDropdowns, 100);
      });
    }
  });
}

// ページロード後に実行
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  setTimeout(waitForDataAndPopulate, 1000);
} else {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(waitForDataAndPopulate, 1000);
  });
}

// =====================================================
// [Section 8] データ一覧表示機能
// =====================================================

// 英傑一覧を表示
function showEiketsuList() {
  if (!EIKETSU_DATA || EIKETSU_DATA.length === 0) {
    showMessage(i18n.t("msg_no_eiketsu_data"), "error");
    return;
  }

  // 職業でグループ化
  const byJob = {};
  EIKETSU_DATA.forEach((e) => {
    const job = e.job || "その他";
    if (!byJob[job]) byJob[job] = [];
    byJob[job].push(e);
  });

  let html = `<div class="data-list-container">`;
  html += `<p class="data-list-summary">登録済み英傑: <strong>${EIKETSU_DATA.length}</strong>件</p>`;

  Object.keys(byJob)
    .sort()
    .forEach((job) => {
      html += `<details class="data-list-group"><summary>${job} (${byJob[job].length})</summary>`;
      html += `<div class="data-list-items">`;
      byJob[job].forEach((e) => {
        html += `<span class="data-list-item">${e.name}</span>`;
      });
      html += `</div></details>`;
    });

  html += `</div>`;
  showModal("英傑一覧", html);
}

// 因子一覧を表示
function showFactorList() {
  if (!performanceCache.isBuilt) buildPerformanceIndex();

  const factors = Array.from(performanceCache.factorToEiketsuMap.keys()).sort();

  let html = `<div class="data-list-container">`;
  html += `<p class="data-list-summary">登録済み因子: <strong>${factors.length}</strong>種類</p>`;
  html += `<div class="factor-list-grid">`;

  factors.forEach((factor) => {
    const count = performanceCache.factorToEiketsuMap.get(factor)?.length || 0;
    html += `<div class="factor-list-item" title="${count}人が所持">
      <span class="factor-name">${factor}</span>
      <span class="factor-holder-count">${count}人</span>
    </div>`;
  });

  html += `</div></div>`;
  showModal("因子一覧", html);
}

// 因縁一覧を表示
function showInenList() {
  if (!INEN_DATA || INEN_DATA.length === 0) {
    showMessage(i18n.t("msg_no_inen_data"), "error");
    return;
  }

  // 種類でグループ化
  const byType = {};
  INEN_DATA.forEach((inen) => {
    const type = inen.type || "その他";
    if (!byType[type]) byType[type] = [];
    byType[type].push(inen);
  });

  let html = `<div class="data-list-container">`;
  html += `<p class="data-list-summary">登録済み因縁: <strong>${INEN_DATA.length}</strong>件</p>`;

  // 指定された順序で表示
  const typeOrder = ["職業因縁", "特化因縁", "固有因縁", "特殊因縁"];
  const orderedTypes = typeOrder.filter((t) => byType[t]);
  // 未知のタイプがあれば末尾に追加
  Object.keys(byType).forEach((t) => {
    if (!orderedTypes.includes(t)) orderedTypes.push(t);
  });

  orderedTypes.forEach((type) => {
    html += `<details class="data-list-group"><summary>${type} (${byType[type].length})</summary>`;
    html += `<div class="inen-list-items">`;
    byType[type].forEach((inen) => {
      html += `<div class="inen-list-item">
        <span class="inen-name">${inen.name}</span>
        <span class="inen-factors">${inen.factors.join(" / ")}</span>
      </div>`;
    });
    html += `</div></details>`;
  });

  html += `</div>`;
  showModal("因縁一覧", html);
}

// データ一覧ボタンのイベントリスナー設定
function setupDataListButtons() {
  const eiketsuBtn = document.getElementById("show-eiketsu-list-btn");
  const factorBtn = document.getElementById("show-factor-list-btn");
  const inenBtn = document.getElementById("show-inen-list-btn");

  if (eiketsuBtn) eiketsuBtn.addEventListener("click", showEiketsuList);
  if (factorBtn) factorBtn.addEventListener("click", showFactorList);
  if (inenBtn) inenBtn.addEventListener("click", showInenList);

  // デスクトップツールバーボタン
  const eiketsuBtnD = document.getElementById("show-eiketsu-list-btn-desktop");
  const factorBtnD = document.getElementById("show-factor-list-btn-desktop");
  const inenBtnD = document.getElementById("show-inen-list-btn-desktop");
  if (eiketsuBtnD) eiketsuBtnD.addEventListener("click", showEiketsuList);
  if (factorBtnD) factorBtnD.addEventListener("click", showFactorList);
  if (inenBtnD) inenBtnD.addEventListener("click", showInenList);

  // カウント表示を更新
  setTimeout(() => {
    const eiketsuCount = document.getElementById("eiketsu-count");
    const factorCount = document.getElementById("factor-count");
    const inenCount = document.getElementById("inen-count");

    if (eiketsuCount && EIKETSU_DATA)
      eiketsuCount.textContent = EIKETSU_DATA.length;
    if (inenCount && INEN_DATA) inenCount.textContent = INEN_DATA.length;
    if (factorCount && performanceCache.factorToEiketsuMap) {
      factorCount.textContent = performanceCache.factorToEiketsuMap.size;
    }
  }, 2000);
}

// DOMロード後にボタン設定
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(setupDataListButtons, 1500);
});

// =====================================================
// [Section 9] 使用履歴トラッキング
// =====================================================

// 陣形を正確に取得
function getCurrentFormationValue() {
  const formationSelect = document.getElementById("formation-select");
  return formationSelect?.value || window.currentFormation || "hoen";
}

// [使用ログ] → usage-logger.js に分離済み (2026-03-21)

// =====================================================
// [Section 10] → state-persistence.js に分離済み (2026-03-21)
// saveCurrentState / restoreState / showRestoreIndicator / hideRestoreIndicator
// beforeunload / DOMContentLoaded(logPageView, restoreState, loadCommunityNews)
// =====================================================

// グローバル公開（main.jsに残る関数）
window.updateAll = updateAll;
// window.getEffectSummary = getEffectSummary;  // → recommendation-engine.js に移動済み
// window.getCurrentActivatedInens = getCurrentActivatedInens;  // → recommendation-engine.js に移動済み
window.calculateAllBoosts = calculateAllBoosts;
window.getCurrentFormationValue = getCurrentFormationValue;

// [コミュニティ・フィードバック・おすすめ編成] → community-features.js に分離済み (2026-03-21)

// [陣法例ライブラリ] → formation-library.js に分離済み (2026-03-21)

// =====================================================
// [Section FINAL] 統合初期化コントローラー
// =====================================================
// 20箇所のDOMContentLoadedを効率的に管理
// パフォーマンス改善: 重複イベント登録を防止

/**
 * 初期化済みフラグ
 * @type {boolean}
 */
let _isGloballyInitialized = false;

/**
 * 統合初期化関数
 * 全てのDOMContentLoadedハンドラを順番に実行
 */
async function unifiedInitController() {
  if (_isGloballyInitialized) {
    console.warn("[eiketsu-jinpo] Already initialized, skipping");
    return;
  }
  _isGloballyInitialized = true;

  if (window.DEBUG) console.time("[eiketsu-jinpo] Total initialization");

  try {
    // 1. 高速検索エンジン初期化
    if (typeof initHighPerfSearch === "function") {
      await initHighPerfSearch();
    }

    // 2. search_formations.json は 6 名配置完了時にオンデマンドロードする（初期転送量削減のため）
    //    従来の早期バックグラウンドロードは削除。未ロード時は lookupFormationStats が null を返し従来計算式にフォールバック。

    // 3. パフォーマンス情報出力
    if (window.DEBUG) console.log("[eiketsu-jinpo] Init complete:", {
      eiketsu: typeof EIKETSU_DATA !== "undefined" ? EIKETSU_DATA.length : 0,
      formations: Object.keys(FORMATIONS || {}).length,
      highPerf: typeof window.factorEngine !== "undefined",
    });
  } catch (e) {
    console.error("[eiketsu-jinpo] Init error:", e);
  }

  if (window.DEBUG) console.timeEnd("[eiketsu-jinpo] Total initialization");
}

// 最終初期化フック（既存ハンドラが完了した後に実行）
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    // loadイベントで最終チェック
    setTimeout(unifiedInitController, 100);
  });
}

// =====================================================
// カスタム英傑（手動追加）管理
// =====================================================

(function() {
  'use strict';

  const CUSTOM_HEROES_KEY = 'eiketsu_custom_heroes';

  // localStorage からカスタム英傑を読み込み
  function loadCustomHeroes() {
    try {
      const data = JSON.parse(localStorage.getItem(CUSTOM_HEROES_KEY));
      return (data && data.heroes) ? data.heroes : [];
    } catch { return []; }
  }

  // localStorage にカスタム英傑を保存
  function saveCustomHeroes(heroes) {
    localStorage.setItem(CUSTOM_HEROES_KEY, JSON.stringify({ version: '1.0', heroes }));
  }

  // カスタム英傑をEIKETSU_DATAにマージ
  function mergeCustomHeroes() {
    const customs = loadCustomHeroes();
    customs.forEach(hero => {
      // 同名のCSV英傑が既にあればスキップ（CSV優先）
      if (window.EIKETSU_DATA && !window.EIKETSU_DATA.find(e => e.name === hero.name)) {
        window.EIKETSU_DATA.push(hero);
      }
    });
  }

  // 因子のselectプルダウンを生成
  function populateFactorDatalist() {
    // CSVLoaderが持つ因子セットから取得
    const factors = new Set();
    if (window.EIKETSU_DATA) {
      window.EIKETSU_DATA.forEach(e => {
        if (e.factors) e.factors.forEach(f => { if (f) factors.add(f); });
      });
    }
    const sortedFactors = Array.from(factors).sort();
    // 4つの因子selectを全て更新
    document.querySelectorAll('.manual-hero-factor-select').forEach(select => {
      const currentVal = select.value;
      select.innerHTML = '<option value="">▼ 選択...</option>';
      sortedFactors.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        select.appendChild(opt);
      });
      // 元の選択値を復元
      if (currentVal) select.value = currentVal;
    });
  }

  // カスタム英傑一覧を表示
  function renderCustomHeroesList() {
    const container = document.getElementById('custom-heroes-items');
    const section = document.getElementById('custom-heroes-list');
    if (!container || !section) return;

    const customs = loadCustomHeroes();
    if (customs.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    container.innerHTML = customs.map((h, i) =>
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:var(--c-bg-alt);border-radius:var(--radius-sm);margin-bottom:4px;font-size:0.8rem;">' +
        '<span><strong>' + h.name + '</strong> (' + h.job + ' / コスト' + h.cost + ') ' +
        h.factors.filter(f => f).map(f => '<span style="display:inline-block;padding:1px 6px;background:var(--c-primary-light);color:var(--c-primary-text);border-radius:9px;font-size:0.7rem;margin-left:2px;">' + f + '</span>').join('') +
        '</span>' +
        '<button type="button" data-idx="' + i + '" class="delete-custom-hero" style="background:none;border:none;color:var(--c-error);cursor:pointer;font-size:1rem;" title="削除">×</button>' +
      '</div>'
    ).join('');

    // 削除ボタンのイベント
    container.querySelectorAll('.delete-custom-hero').forEach(btn => {
      btn.addEventListener('click', function() {
        const idx = parseInt(this.dataset.idx);
        const customs = loadCustomHeroes();
        const removed = customs.splice(idx, 1)[0];
        saveCustomHeroes(customs);
        // EIKETSU_DATAからも削除
        if (window.EIKETSU_DATA && removed) {
          const dataIdx = window.EIKETSU_DATA.findIndex(e => e.name === removed.name && e.isCustom);
          if (dataIdx >= 0) window.EIKETSU_DATA.splice(dataIdx, 1);
        }
        renderCustomHeroesList();
        // 英傑リスト再描画
        if (typeof window.renderEiketsuList === 'function') window.renderEiketsuList();
        if (typeof window.showToast === 'function') window.showToast(removed.name + ' を削除しました', 'info');
      });
    });
  }

  // フォーム送信ハンドラ
  function handleManualHeroSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('manual-hero-name').value.trim();
    const job = document.getElementById('manual-hero-job').value;
    const cost = parseInt(document.getElementById('manual-hero-cost').value) || 8;
    const factors = [
      document.getElementById('manual-hero-factor1').value.trim(),
      document.getElementById('manual-hero-factor2').value.trim(),
      document.getElementById('manual-hero-factor3').value.trim(),
      document.getElementById('manual-hero-factor4').value.trim(),
    ];

    // バリデーション
    if (!name) { alert('名前を入力してください'); return; }
    if (!job) { alert('職業を選択してください'); return; }

    // 重複チェック
    if (window.EIKETSU_DATA && window.EIKETSU_DATA.find(e => e.name === name)) {
      alert('「' + name + '」は既に登録されています');
      return;
    }

    // 英傑オブジェクトを作成（csv-loader.jsの形式に合わせる）
    const hero = {
      name: name,
      job: job,
      cost: cost,
      factors: factors,
      stats: { 生命: 0, 気合: 0, 腕力: 0, 耐久力: 0, 器用さ: 0, 知力: 0, 魅力: 0, 土: 0, 水: 0, 火: 0, 風: 0 },
      trainingSkills: ['', '', ''],
      addedDate: new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }),
      addedOrder: 9999,
      skill: '',
      description: '',
      isCustom: true,
    };

    // localStorageに保存
    const customs = loadCustomHeroes();
    customs.push(hero);
    saveCustomHeroes(customs);

    // EIKETSU_DATAに追加
    if (window.EIKETSU_DATA) window.EIKETSU_DATA.push(hero);

    // 英傑リスト再描画
    if (typeof window.renderEiketsuList === 'function') window.renderEiketsuList();

    // 管理者に通知（バックグラウンド、失敗しても無視）
    fetch('/cp-r4v8q1w/api/hero_request.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, job, cost, factors: factors.filter(f => f) }),
    }).catch(() => {});

    // フォームリセット
    e.target.reset();
    document.getElementById('manual-hero-cost').value = '8';
    renderCustomHeroesList();

    // トースト通知
    if (typeof window.showToast === 'function') window.showToast('「' + name + '」を追加しました', 'success');

    // モーダルを閉じる
    if (window.ModalManager) window.ModalManager.close('manual-hero-modal');
    else document.getElementById('manual-hero-modal').style.display = 'none';
  }

  // モーダル開閉
  function openManualHeroModal() {
    const modal = document.getElementById('manual-hero-modal');
    if (!modal) return;
    if (window.ModalManager) window.ModalManager.open('manual-hero-modal');
    else modal.style.display = 'flex';
    populateFactorDatalist();
    renderCustomHeroesList();
    document.getElementById('manual-hero-name').focus();
  }

  // 初期化
  function initManualHero() {
    // ボタンイベント
    const btn = document.getElementById('manual-add-hero-btn');
    if (btn) btn.addEventListener('click', openManualHeroModal);

    // フォームイベント
    const form = document.getElementById('manual-hero-form');
    if (form) form.addEventListener('submit', handleManualHeroSubmit);

    // モーダル閉じるボタン
    const modal = document.getElementById('manual-hero-modal');
    if (modal) {
      const closeManual = () => {
        if (window.ModalManager) window.ModalManager.close('manual-hero-modal');
        else modal.style.display = 'none';
      };
      modal.querySelector('.modal-close')?.addEventListener('click', closeManual);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeManual(); });
    }

    // CSV読み込み完了後にカスタム英傑をマージ
    // EIKETSU_DATAが既に存在していれば即マージ、なければイベント待ち
    if (window.EIKETSU_DATA && window.EIKETSU_DATA.length > 0) {
      mergeCustomHeroes();
    } else {
      window.addEventListener('eiketsu-data-loaded', mergeCustomHeroes);
    }
  }

  // DOM読み込み完了後に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initManualHero);
  } else {
    initManualHero();
  }
})();

