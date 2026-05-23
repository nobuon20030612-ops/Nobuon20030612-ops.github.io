/**
 * =====================================================
 * 高速検索API (High Performance Search API)
 * =====================================================
 * 
 * 【概要】
 * factor-engine と worker-pool を統合した高レベルAPI。
 * メインスレッドから簡単に高速検索を実行可能。
 * 
 * 【使用方法】
 * import { HighPerfSearch } from './high-perf-search.js';
 * const search = new HighPerfSearch();
 * await search.init();
 * const results = await search.findOptimalHeroes(selectedIds, slot, formation);
 */

import { factorEngine } from './factor-engine.js';
import { workerPool, dataStore } from './worker-pool.js';

// =====================================================
// High Performance Search API
// =====================================================

class HighPerfSearch {
  constructor() {
    this.initialized = false;
    this.useWorkers = true; // Web Workers 使用フラグ
  }
  
  /**
   * 初期化
   * @param {Object} options
   * @param {Array} options.eiketsuData - 英傑データ
   * @param {Array} options.inenData - 因縁データ
   * @param {boolean} options.useWorkers - Web Workers使用 (default: true)
   */
  async init(options = {}) {
    if (window.DEBUG) console.time('[HighPerfSearch] init');

    const { eiketsuData, inenData, useWorkers = true } = options;
    this.useWorkers = useWorkers;
    
    // FactorEngine 初期化
    if (eiketsuData) {
      factorEngine.loadEiketsuData(eiketsuData);
    }
    if (inenData) {
      factorEngine.loadInenData(inenData);
    }
    
    // IndexedDB 初期化
    try {
      await dataStore.init();
    } catch (e) {
      console.warn('[HighPerfSearch] IndexedDB init failed:', e);
    }
    
    // Worker Pool 初期化 (オプション)
    if (this.useWorkers && typeof Worker !== 'undefined') {
      try {
        await workerPool.init();
        // Note: BigIntはpostMessageで送れないため、実際の計算はメインスレッドのfactorEngineを使用
      } catch (e) {
        console.warn('[HighPerfSearch] Worker pool init failed:', e);
        this.useWorkers = false;
      }
    }
    
    this.initialized = true;
    if (window.DEBUG) console.timeEnd('[HighPerfSearch] init');

    return this;
  }
  
  /**
   * 最適な英傑を検索
   * @param {number[]} currentIds - 現在選択中の英傑ID
   * @param {number} targetSlot - 配置先スロット
   * @param {Object} formation - 陣形情報
   * @param {Object} options - オプション
   * @returns {Promise<Array>} 推奨英傑リスト
   */
  async findOptimalHeroes(currentIds, targetSlot, formation, options = {}) {
    const { topN = 20, costLimit = 36 } = options;
    
    if (window.DEBUG) console.time('[HighPerfSearch] findOptimalHeroes');

    const patterns = formation.adjacentPatterns || [];
    const candidates = [];
    
    // 現在のコスト計算
    const currentCost = currentIds.reduce((sum, id) => {
      if (id == null) return sum;
      const hero = factorEngine.getHero(id);
      return sum + (hero?.cost || 0);
    }, 0);
    
    // 全英傑を評価
    for (const [id, hero] of factorEngine.eiketsuMap) {
      // 既に配置済みはスキップ
      if (currentIds.includes(id)) continue;
      
      // コスト制限チェック
      const targetHero = factorEngine.getHero(currentIds[targetSlot]);
      const oldCost = targetHero?.cost || 0;
      const newCost = currentCost - oldCost + hero.cost;
      
      if (newCost > costLimit) continue;
      
      // 仮配置してスコア計算
      const testIds = [...currentIds];
      testIds[targetSlot] = id;
      
      const { score, inenCount, inenDetails } = this._calculateScore(testIds, patterns);
      
      candidates.push({
        id,
        name: hero.name,
        cost: hero.cost,
        score,
        inenCount,
        inenDetails,
        factors: hero.factors
      });
    }
    
    // スコア降順でソート
    candidates.sort((a, b) => b.score - a.score);
    
    if (window.DEBUG) console.timeEnd('[HighPerfSearch] findOptimalHeroes');

    return candidates.slice(0, topN);
  }
  
  /**
   * 陣形のスコアを計算
   * @param {number[]} ids - 6英傑のID
   * @param {number[][]} patterns - 隣接パターン
   * @returns {{score: number, inenCount: number, inenDetails: Array}}
   */
  _calculateScore(ids, patterns) {
    let score = 0;
    let inenCount = 0;
    const inenDetails = [];

    // 隣接パターンごとに因縁判定
    for (const pattern of patterns) {
      const [i1, i2, i3] = pattern;
      if (ids[i1] == null || ids[i2] == null || ids[i3] == null) continue;
      const activeInens = factorEngine.getActiveInen(ids[i1], ids[i2], ids[i3]);

      for (const inen of activeInens) {
        inenCount++;

        // 因縁種類によるスコア加重
        let weight;
        switch (inen.type) {
          case '固有因縁': weight = 10; break;
          case '特殊因縁': weight = 8; break;
          case '特定特殊': weight = 6; break;
          case '職業因縁': weight = 4; break;
          case '特化因縁': weight = 3; break;
          default: weight = 1;
        }

        score += weight;
        inenDetails.push({
          pattern,
          ...inen,
          weight
        });
      }
    }

    return { score, inenCount, inenDetails };
  }
  
  /**
   * 陣形の因縁を取得
   * @param {number[]} ids - 6英傑のID
   * @param {Object} formation - 陣形情報
   * @returns {Array}
   */
  getFormationInen(ids, formation) {
    return factorEngine.getFormationInen(ids, formation.adjacentPatterns || []);
  }
  
  /**
   * 英傑を名前で検索
   * @param {string} query 
   * @returns {Array}
   */
  searchByName(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [id, hero] of factorEngine.eiketsuMap) {
      if (hero.name.toLowerCase().includes(lowerQuery)) {
        results.push({ id, ...hero });
      }
    }
    
    return results;
  }
  
  /**
   * 因子で検索
   * @param {string[]} factors - 必要な因子
   * @returns {Array}
   */
  searchByFactors(factors) {
    const results = [];
    
    for (const [id, hero] of factorEngine.eiketsuMap) {
      const hasAll = factors.every(f => hero.factors.includes(f));
      if (hasAll) {
        results.push({ id, ...hero });
      }
    }
    
    return results;
  }
  
  /**
   * 統計情報
   */
  getStats() {
    return {
      engine: factorEngine.getStats(),
      dataStore: dataStore.getStats(),
      workerPool: this.useWorkers ? workerPool.getStats() : null,
      initialized: this.initialized
    };
  }
  
  /**
   * キャッシュクリア
   */
  clearCache() {
    factorEngine.clearCache();
    dataStore.clearCache();
  }
}

// =====================================================
// Export
// =====================================================

const highPerfSearch = new HighPerfSearch();

export { HighPerfSearch, highPerfSearch };

// グローバル公開
if (typeof window !== 'undefined') {
  window.HighPerfSearch = HighPerfSearch;
  window.highPerfSearch = highPerfSearch;
}
