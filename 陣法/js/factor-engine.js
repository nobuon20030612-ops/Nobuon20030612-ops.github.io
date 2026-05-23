/**
 * =====================================================
 * 高速因子エンジン (Factor Engine)
 * =====================================================
 * 
 * 【概要】
 * 因子をビットマップで表現し、O(1)で因縁判定を行う高速エンジン。
 * 32万行 (100MB) のデータでも瞬時に検索可能な設計。
 * 
 * 【設計思想】
 * - 因子を64ビット整数の各ビットにマッピング
 * - ビット演算で因縁判定 (AND演算のみ)
 * - メモリ効率: 1英傑あたり8バイトで全因子を表現
 * 
 * 【使用方法】
 * import { FactorEngine } from './factor-engine.js';
 * const engine = new FactorEngine();
 * engine.loadEiketsuData(eiketsuArray);
 * const matches = engine.findInenMatches(heroIds, inenName);
 */

// =====================================================
// 因子ビットマップ定義
// =====================================================

/**
 * 全因子のビットマップ定義
 * 64ビット整数の各ビットに因子を割り当て
 * BigIntを使用して64ビット以上をサポート
 */
const FACTOR_BITS = {
  // ===== 職業因子 (0-7) =====
  武士道: 1n << 0n,
  武芸: 1n << 1n,
  軍学: 1n << 2n,
  僧兵: 1n << 3n,
  仏門: 1n << 4n,
  密教: 1n << 5n,
  神道: 1n << 6n,
  古神道: 1n << 7n,
  
  // ===== 職業因子続き (8-15) =====
  雅楽: 1n << 8n,
  陰陽道: 1n << 9n,
  仙道: 1n << 10n,
  召喚術: 1n << 11n,
  忍法: 1n << 12n,
  暗殺術: 1n << 13n,
  忍術: 1n << 14n,
  刀鍛冶: 1n << 15n,
  
  // ===== 職業因子続き (16-23) =====
  鎧鍛冶: 1n << 16n,
  鉄砲鍛冶: 1n << 17n,
  医学: 1n << 18n,
  神通力: 1n << 19n,
  修験道: 1n << 20n,
  四象: 1n << 21n,
  地勢: 1n << 22n,
  殺陣: 1n << 23n,
  
  // ===== 固有因子 (24-47) =====
  知将: 1n << 24n,
  忍び: 1n << 25n,
  剣豪: 1n << 26n,
  名臣: 1n << 27n,
  野心家: 1n << 28n,
  勇将: 1n << 29n,
  女傑: 1n << 30n,
  内助の功: 1n << 31n,
  長寿: 1n << 32n,
  文化人: 1n << 33n,
  猛将: 1n << 34n,
  外交官: 1n << 35n,
  洒落者: 1n << 36n,
  鬼: 1n << 37n,
  神仏の徒: 1n << 38n,
  世渡り上手: 1n << 39n,
  飛道具使い: 1n << 40n,
  明敏: 1n << 41n,
  宿将: 1n << 42n,
  根性: 1n << 43n,
  才腕: 1n << 44n,
  気鋭: 1n << 45n,
  信義: 1n << 46n,
  博識: 1n << 47n,
  多才: 1n << 48n,
  
  // ===== 追加因子 (49-55) =====
  修験: 1n << 49n,
  神通: 1n << 50n,
  医術: 1n << 51n,
};

// 因子名から値への逆引きマップ
const FACTOR_NAME_TO_BIT = new Map(Object.entries(FACTOR_BITS));

// =====================================================
// 因縁定義
// =====================================================

/**
 * 因縁に必要な因子のビットマスク
 * 各因縁が発動するために必要な因子の組み合わせ
 */
const INEN_MASKS = new Map();

/**
 * 因縁データから因縁マスクを初期化
 * @param {Array} inenData - factors_inen.csvから読み込んだデータ
 */
function initInenMasks(inenData) {
  INEN_MASKS.clear();

  for (const inen of inenData) {
    // csv-loader形式(factors配列, name, type)と旧形式(因子1〜3, 因縁名, 因縁種類)の両対応
    const factors = inen.factors
      ? [...inen.factors].filter(f => f)
      : [inen.因子1, inen.因子2, inen.因子3].filter(f => f);
    const inenName = inen.name || inen.因縁名;
    const inenType = inen.type || inen.因縁種類;

    if (!inenName || factors.length === 0) continue;

    let mask = 0n;
    for (const factor of factors) {
      const bit = FACTOR_NAME_TO_BIT.get(factor.trim());
      if (bit) mask |= bit;
    }

    if (mask > 0n) {
      // effects: csv-loader形式(配列)と旧形式(文字列)の両対応
      const effects = inen.effects || {
        特大: inen.特大 || '',
        大: inen.大 || '',
        中: inen.中 || '',
        小: inen.小 || ''
      };

      // isKoyuu: 3因子が全て同一 → AND判定（特化因縁）, 異なる → OR判定（職業因縁）
      const isKoyuu = factors.length === 3 &&
        factors[0] === factors[1] &&
        factors[1] === factors[2];

      INEN_MASKS.set(inenName, {
        mask,
        type: inenType,
        factors,
        effects,
        isKoyuu,
      });
    }
  }
}

// =====================================================
// 高速因子エンジン
// =====================================================

/**
 * 高速因子エンジン
 * ビットマップベースの高速因縁判定を提供
 */
class FactorEngine {
  constructor() {
    /** @type {Map<number, {id: number, name: string, factorBits: bigint, cost: number}>} */
    this.eiketsuMap = new Map();
    
    /** @type {bigint[]} 高速アクセス用の因子ビット配列 */
    this.factorBitsArray = [];
    
    /** @type {boolean} 初期化完了フラグ */
    this.initialized = false;
    
    /** @type {Map<string, any>} 計算結果キャッシュ */
    this.cache = new Map();
    this.cacheMaxSize = 10000;
  }
  
  /**
   * 英傑データを読み込み、ビットマップに変換
   * @param {Array} eiketsuData - eiketsu.csvから読み込んだデータ
   */
  loadEiketsuData(eiketsuData) {
    if (window.DEBUG) console.time('[FactorEngine] loadEiketsuData');

    this.eiketsuMap.clear();
    this.factorBitsArray = [];

    let id = 0;
    for (const hero of eiketsuData) {
      // csv-loader形式(name)と旧形式(名前)の両方に対応
      const heroName = hero.name || hero.名前;
      if (!heroName) continue;

      // 因子: csv-loader形式(factors配列)と旧形式(因子1〜4)の両対応
      const factors = hero.factors
        ? hero.factors.filter(f => f)
        : [hero.因子1, hero.因子2, hero.因子3, hero.因子4].filter(f => f);
      let factorBits = 0n;

      for (const factor of factors) {
        const bit = FACTOR_NAME_TO_BIT.get(factor.trim());
        if (bit) factorBits |= bit;
      }

      // ステータス: csv-loader形式(stats.生命)と旧形式(hero.生命)の両対応
      const stats = hero.stats || hero;

      const entry = {
        id,
        name: heroName,
        factorBits,
        cost: parseInt(hero.cost || hero.コスト) || 0,
        職業: hero.job || hero.職業,
        factors,
        stats: this._packStats(stats)
      };

      this.eiketsuMap.set(id, entry);
      this.factorBitsArray.push(factorBits);
      id++;
    }

    this.initialized = true;
    if (window.DEBUG) console.timeEnd('[FactorEngine] loadEiketsuData');
  }

  /**
   * 因縁データを読み込み
   * @param {Array} inenData - factors_inen.csvから読み込んだデータ
   */
  loadInenData(inenData) {
    initInenMasks(inenData);
  }
  
  /**
   * 統計データをUint16Arrayに圧縮
   * @private
   */
  _packStats(stats) {
    return new Uint16Array([
      parseInt(stats.生命 || stats["生命"]) || 0,
      parseInt(stats.気合 || stats["気合"]) || 0,
      parseInt(stats.腕力 || stats["腕力"]) || 0,
      parseInt(stats.耐久力 || stats["耐久力"]) || 0,
      parseInt(stats.器用さ || stats["器用さ"]) || 0,
      parseInt(stats.知力 || stats["知力"]) || 0,
      parseInt(stats.魅力 || stats["魅力"]) || 0,
      parseInt(stats.土属性 || stats["土属性"]) || 0,
      parseInt(stats.水属性 || stats["水属性"]) || 0,
      parseInt(stats.火属性 || stats["火属性"]) || 0,
      parseInt(stats.風属性 || stats["風属性"]) || 0,
    ]);
  }
  
  /**
   * 3英傑の因縁判定 (O(1)ビット演算)
   * @param {number} id1 - 英傑1のID
   * @param {number} id2 - 英傑2のID
   * @param {number} id3 - 英傑3のID
   * @param {bigint} inenMask - 因縁の必要因子マスク
   * @returns {boolean} 因縁が発動するかどうか
   */
  checkInen(id1, id2, id3, inenMask) {
    const combined =
      this.factorBitsArray[id1] &
      this.factorBitsArray[id2] &
      this.factorBitsArray[id3];
    return (combined & inenMask) === inenMask;
  }

  /**
   * 3英傑で発動する全因縁を取得
   * @param {number} id1
   * @param {number} id2
   * @param {number} id3
   * @returns {Array<{name: string, type: string, effects: object}>}
   */
  getActiveInen(id1, id2, id3) {
    const cacheKey = [id1, id2, id3].sort().join('-');

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const combined =
      this.factorBitsArray[id1] &
      this.factorBitsArray[id2] &
      this.factorBitsArray[id3];

    const active = [];

    for (const [name, inen] of INEN_MASKS) {
      if ((combined & inen.mask) === inen.mask) {
        active.push({
          name,
          type: inen.type,
          factors: inen.factors,
          effects: inen.effects
        });
      }
    }

    // LRUキャッシュ
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, active);

    return active;
  }
  
  /**
   * 6英傑配置で発動する因縁を全取得
   * @param {number[]} ids - 6英傑のID配列
   * @param {number[][]} patterns - 隣接パターン
   * @returns {Array<{pattern: number[], inens: Array}>}
   */
  getFormationInen(ids, patterns) {
    const results = [];

    for (const pattern of patterns) {
      const [i1, i2, i3] = pattern;
      if (ids[i1] != null && ids[i2] != null && ids[i3] != null) {
        const inens = this.getActiveInen(ids[i1], ids[i2], ids[i3]);
        if (inens.length > 0) {
          results.push({ pattern, inens });
        }
      }
    }

    return results;
  }
  
  /**
   * 因縁名を指定して3英傑の発動判定（AND/OR自動切替）
   * isKoyuu=true（特化因縁）: AND判定、isKoyuu=false（職業因縁）: OR判定
   * @param {number} id1
   * @param {number} id2
   * @param {number} id3
   * @param {string} inenName - 因縁名
   * @returns {boolean}
   */
  checkInenAuto(id1, id2, id3, inenName) {
    const inen = INEN_MASKS.get(inenName);
    if (!inen) return false;

    const b1 = this.factorBitsArray[id1] ?? 0n;
    const b2 = this.factorBitsArray[id2] ?? 0n;
    const b3 = this.factorBitsArray[id3] ?? 0n;

    if (inen.isKoyuu) {
      // AND判定: 全員が同因子を持つ
      return (b1 & b2 & b3 & inen.mask) === inen.mask;
    } else {
      // OR判定: 3体の和集合で全因子を揃える
      return ((b1 | b2 | b3) & inen.mask) === inen.mask;
    }
  }

  /**
   * 6英傑配置の全パターンで発動する因縁数を一括取得（重複なし）
   * checkInenAutoと同一ロジック（AND/OR自動切替）
   * @param {(number|null)[]} ids - 最大6英傑のID配列
   * @param {number[][]} patterns - 隣接パターン（各要素が3インデックスの配列）
   * @returns {{ count: number, inenSet: Set<string> }}
   */
  countFormationInen(ids, patterns) {
    const activatedInen = new Set();

    for (const pattern of patterns) {
      const [i1, i2, i3] = pattern;
      const id1 = ids[i1];
      const id2 = ids[i2];
      const id3 = ids[i3];
      if (id1 == null || id2 == null || id3 == null) continue;

      const b1 = this.factorBitsArray[id1] ?? 0n;
      const b2 = this.factorBitsArray[id2] ?? 0n;
      const b3 = this.factorBitsArray[id3] ?? 0n;

      for (const [name, inen] of INEN_MASKS) {
        if (activatedInen.has(name)) continue;
        const active = inen.isKoyuu
          ? (b1 & b2 & b3 & inen.mask) === inen.mask
          : ((b1 | b2 | b3) & inen.mask) === inen.mask;
        if (active) activatedInen.add(name);
      }
    }

    return { count: activatedInen.size, inenSet: activatedInen };
  }

  /**
   * 英傑IDから情報を取得
   * @param {number} id
   * @returns {object|null}
   */
  getHero(id) {
    return this.eiketsuMap.get(id) || null;
  }
  
  /**
   * 名前から英傑を検索
   * @param {string} name 
   * @returns {object|null}
   */
  findByName(name) {
    for (const hero of this.eiketsuMap.values()) {
      if (hero.name === name) return hero;
    }
    return null;
  }
  
  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * 統計情報を取得
   */
  getStats() {
    return {
      heroCount: this.eiketsuMap.size,
      inenCount: INEN_MASKS.size,
      cacheSize: this.cache.size,
      initialized: this.initialized
    };
  }
}

// =====================================================
// グローバル公開 & ES Module Export
// =====================================================

// シングルトンインスタンス
const factorEngine = new FactorEngine();

// ES Module export
export {
  FactorEngine,
  factorEngine,
  FACTOR_BITS,
  FACTOR_NAME_TO_BIT,
  INEN_MASKS,
  initInenMasks
};

// グローバル公開 (レガシー互換)
if (typeof window !== 'undefined') {
  window.FactorEngine = FactorEngine;
  window.factorEngine = factorEngine;
  window.FACTOR_BITS = FACTOR_BITS;
  window.INEN_MASKS = INEN_MASKS;
}
