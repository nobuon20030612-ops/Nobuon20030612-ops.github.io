/**
 * =====================================================
 * Web Worker プール (Worker Pool)
 * =====================================================
 * 
 * 【概要】
 * 大規模データ処理のための並列計算基盤。
 * 32万行データでも瞬時に検索可能にするマルチスレッド実行環境。
 * 
 * 【設計思想】
 * - navigator.hardwareConcurrency でCPUコア数を検出
 * - タスクキューで効率的なワーク分散
 * - Promise ベースの非同期API
 * 
 * 【使用方法】
 * import { WorkerPool } from './worker-pool.js';
 * const pool = new WorkerPool('./search-worker.js', 4);
 * const results = await pool.execute({ task: 'search', data: heroes });
 */

// =====================================================
// Worker Pool
// =====================================================

/**
 * Web Worker プール
 * 複数のワーカーを管理し、タスクを効率的に分散
 */
class WorkerPool {
  /**
   * @param {string} workerScript - ワーカースクリプトのパス
   * @param {number} [size] - プールサイズ (デフォルト: CPUコア数)
   */
  constructor(workerScript, size = null) {
    this.workerScript = workerScript;
    this.size = size || navigator.hardwareConcurrency || 4;
    
    /** @type {Worker[]} */
    this.workers = [];
    
    /** @type {Map<number, {resolve: Function, reject: Function}>} */
    this.pendingTasks = new Map();
    
    /** @type {number[]} 利用可能なワーカーのインデックス */
    this.availableWorkers = [];
    
    /** @type {{task: any, resolve: Function, reject: Function}[]} */
    this.taskQueue = [];
    
    /** @type {number} タスクID生成用カウンター */
    this.taskIdCounter = 0;
    
    /** @type {boolean} */
    this.initialized = false;
  }
  
  /**
   * ワーカープールを初期化
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;
    
    if (typeof self !== 'undefined' && self.DEBUG) console.log(`[WorkerPool] Initializing ${this.size} workers...`);
    
    for (let i = 0; i < this.size; i++) {
      const worker = new Worker(this.workerScript, { type: 'module' });
      
      worker.onmessage = (e) => this._handleMessage(i, e);
      worker.onerror = (e) => this._handleError(i, e);
      
      this.workers.push(worker);
      this.availableWorkers.push(i);
    }
    
    this.initialized = true;
    if (typeof self !== 'undefined' && self.DEBUG) console.log(`[WorkerPool] Ready with ${this.size} workers`);
  }
  
  /**
   * タスクを実行
   * @param {any} task - ワーカーに送信するタスク
   * @returns {Promise<any>}
   */
  execute(task) {
    return new Promise((resolve, reject) => {
      if (this.availableWorkers.length > 0) {
        this._dispatchTask(task, resolve, reject);
      } else {
        // キューに追加
        this.taskQueue.push({ task, resolve, reject });
      }
    });
  }
  
  /**
   * 複数タスクを並列実行
   * @param {any[]} tasks - タスク配列
   * @returns {Promise<any[]>}
   */
  async executeAll(tasks) {
    return Promise.all(tasks.map(task => this.execute(task)));
  }
  
  /**
   * データを分割して並列処理
   * @param {any[]} data - 処理するデータ
   * @param {string} taskType - タスクタイプ
   * @param {any} options - 追加オプション
   * @returns {Promise<any[]>}
   */
  async parallelProcess(data, taskType, options = {}) {
    const chunkSize = Math.ceil(data.length / this.size);
    const chunks = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    
    const tasks = chunks.map((chunk, index) => ({
      type: taskType,
      data: chunk,
      chunkIndex: index,
      ...options
    }));
    
    const results = await this.executeAll(tasks);
    
    // 結果をフラット化
    return results.flat();
  }
  
  /**
   * @private
   */
  _dispatchTask(task, resolve, reject) {
    const workerIndex = this.availableWorkers.pop();
    const taskId = ++this.taskIdCounter;
    
    this.pendingTasks.set(taskId, { resolve, reject, workerIndex });
    
    this.workers[workerIndex].postMessage({
      taskId,
      ...task
    });
  }
  
  /**
   * @private
   */
  _handleMessage(workerIndex, event) {
    const { taskId, result, error } = event.data;
    
    const pending = this.pendingTasks.get(taskId);
    if (!pending) return;
    
    this.pendingTasks.delete(taskId);
    this.availableWorkers.push(workerIndex);
    
    if (error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
    
    // キューから次のタスクを処理
    if (this.taskQueue.length > 0) {
      const next = this.taskQueue.shift();
      this._dispatchTask(next.task, next.resolve, next.reject);
    }
  }
  
  /**
   * @private
   */
  _handleError(workerIndex, error) {
    console.error(`[WorkerPool] Worker ${workerIndex} error:`, error);
    
    // ワーカーを再作成
    this.workers[workerIndex].terminate();
    const newWorker = new Worker(this.workerScript, { type: 'module' });
    newWorker.onmessage = (e) => this._handleMessage(workerIndex, e);
    newWorker.onerror = (e) => this._handleError(workerIndex, e);
    this.workers[workerIndex] = newWorker;
    this.availableWorkers.push(workerIndex);
  }
  
  /**
   * プールを終了
   */
  terminate() {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
    this.initialized = false;
    if (typeof self !== 'undefined' && self.DEBUG) console.log('[WorkerPool] Terminated');
  }
  
  /**
   * 統計情報
   */
  getStats() {
    return {
      size: this.size,
      available: this.availableWorkers.length,
      pending: this.pendingTasks.size,
      queued: this.taskQueue.length
    };
  }
}

// =====================================================
// IndexedDB データストア
// =====================================================

/**
 * 高速データストア (IndexedDB + メモリキャッシュ)
 * 32万行でも瞬時にアクセス可能
 */
class DataStore {
  constructor(dbName = 'eiketsu-jinpo-db') {
    this.dbName = dbName;
    this.dbVersion = 1;
    
    /** @type {IDBDatabase|null} */
    this.db = null;
    
    /** @type {Map<string, any>} メモリキャッシュ */
    this.memCache = new Map();
    this.memCacheMaxSize = 50000; // 5万件
    
    /** @type {boolean} */
    this.initialized = false;
  }
  
  /**
   * データベースを初期化
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        if (typeof self !== 'undefined' && self.DEBUG) console.log('[DataStore] Initialized');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 英傑データ
        if (!db.objectStoreNames.contains('eiketsu')) {
          const store = db.createObjectStore('eiketsu', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('cost', 'cost', { unique: false });
        }
        
        // 因縁データ
        if (!db.objectStoreNames.contains('inen')) {
          db.createObjectStore('inen', { keyPath: 'name' });
        }
        
        // 検索結果キャッシュ
        if (!db.objectStoreNames.contains('searchCache')) {
          const cacheStore = db.createObjectStore('searchCache', { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // 陣形データ
        if (!db.objectStoreNames.contains('formations')) {
          db.createObjectStore('formations', { keyPath: 'id' });
        }
      };
    });
  }
  
  /**
   * データを保存
   * @param {string} storeName 
   * @param {any} data 
   * @returns {Promise<void>}
   */
  async put(storeName, data) {
    if (!this.db) throw new Error('DataStore not initialized');
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => {
        // メモリキャッシュにも保存
        const cacheKey = `${storeName}:${data.id || data.key || data.name}`;
        this._setMemCache(cacheKey, data);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * データを取得
   * @param {string} storeName 
   * @param {any} key 
   * @returns {Promise<any>}
   */
  async get(storeName, key) {
    // メモリキャッシュチェック
    const cacheKey = `${storeName}:${key}`;
    if (this.memCache.has(cacheKey)) {
      return this.memCache.get(cacheKey);
    }
    
    if (!this.db) throw new Error('DataStore not initialized');
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        if (request.result) {
          this._setMemCache(cacheKey, request.result);
        }
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 全データを取得
   * @param {string} storeName 
   * @returns {Promise<any[]>}
   */
  async getAll(storeName) {
    if (!this.db) throw new Error('DataStore not initialized');
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * バルク保存 (大量データ高速保存)
   * @param {string} storeName 
   * @param {any[]} dataArray 
   * @returns {Promise<void>}
   */
  async bulkPut(storeName, dataArray) {
    if (!this.db) throw new Error('DataStore not initialized');
    
    if (typeof self !== 'undefined' && self.DEBUG) console.time(`[DataStore] bulkPut ${storeName}`);
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      for (const data of dataArray) {
        store.put(data);
      }
      
      tx.oncomplete = () => {
        if (typeof self !== 'undefined' && self.DEBUG) console.timeEnd(`[DataStore] bulkPut ${storeName}`);
        if (typeof self !== 'undefined' && self.DEBUG) console.log(`[DataStore] Saved ${dataArray.length} records to ${storeName}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
  
  /**
   * @private
   */
  _setMemCache(key, value) {
    if (this.memCache.size >= this.memCacheMaxSize) {
      // LRU: 最初のエントリを削除
      const firstKey = this.memCache.keys().next().value;
      this.memCache.delete(firstKey);
    }
    this.memCache.set(key, value);
  }
  
  /**
   * キャッシュクリア
   */
  clearCache() {
    this.memCache.clear();
  }
  
  /**
   * 統計情報
   */
  getStats() {
    return {
      initialized: this.initialized,
      memCacheSize: this.memCache.size
    };
  }
}

// =====================================================
// Export
// =====================================================

// シングルトン
const workerPool = new WorkerPool('./search-worker.js');
const dataStore = new DataStore();

export { WorkerPool, DataStore, workerPool, dataStore };

// グローバル公開
if (typeof window !== 'undefined') {
  window.WorkerPool = WorkerPool;
  window.DataStore = DataStore;
  window.workerPool = workerPool;
  window.dataStore = dataStore;
}
