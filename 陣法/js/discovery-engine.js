/**
 * 因縁ディスカバリーエンジン v4
 * 保有英傑で8,004件の編成DBをフィルタし、組める編成/あと1〜3体/入手優先度を表示
 * v4: 「あと2体」「あと3体」分析、インパクト分析、ペア優先度を追加
 */

// 状態管理
let discoveryCurrentView = "achievable";
let discoveryCache = null;
let discoveryPriorityFilter = null;
let discoveryPriorityFilter2 = null; // あと2体用フィルタ（ペアキー "A|B"）
let discoveryPerPage = 25;
let discoveryPage = { achievable: 1, almost: 1, almost2: 1, almost3: 1 };

// ソート状態（ビュー別）
let discoverySortKey = "ic";
let discoverySortDir = "desc";

// ステータス定義
const DISC_STAT_SHORT = ["生命", "気合", "腕力", "耐久", "器用", "知力", "魅力", "土", "水", "火", "風"];

// =====================================================
// コアアルゴリズム
// =====================================================

/**
 * 発見分析コアアルゴリズム（純粋関数・テスト可能）
 * @param {Array} formations - nobol_formations.json の編成配列
 * @param {Set<string>} ownedSet - 保有英傑名のSet
 * @param {Array} eiketsuData - 英傑マスターデータ（priority表示用）
 * @returns {{ achievable, almost, almost2, almost3, priority, pairPriority, impactIndex, summary }}
 */
function analyzeFormationsData(formations, ownedSet, eiketsuData = []) {
  const achievable = [];
  const almost = [];
  const almost2 = [];
  const almost3 = [];
  const missingHeroCount = new Map();
  const missingPairCount = new Map();
  // インパクト分析用逆引きインデックス: heroName → { direct: 編成数, promote: 編成数 }
  const impactIndex = new Map();

  for (const f of formations) {
    const members = f.m;
    if (!members || members.length !== 6) continue;
    const missing = members.filter(name => !ownedSet.has(name));
    const base = { members, inenCount: f.ic || 0, stats: f.s || [], formation: f.f || "" };

    if (missing.length === 0) {
      achievable.push(base);
    } else if (missing.length === 1) {
      almost.push({ ...base, missingHero: missing[0] });
      missingHeroCount.set(missing[0], (missingHeroCount.get(missing[0]) || 0) + 1);
      // インパクト: この英傑入手で「組める」に昇格
      const hero = missing[0];
      if (!impactIndex.has(hero)) impactIndex.set(hero, { direct: 0, promote: 0 });
      impactIndex.get(hero).direct++;
    } else if (missing.length === 2) {
      const sorted = [...missing].sort();
      almost2.push({ ...base, missingHeroes: sorted });
      const pairKey = sorted.join("|");
      missingPairCount.set(pairKey, (missingPairCount.get(pairKey) || 0) + 1);
      // インパクト: この英傑入手で「あと1体」に昇格
      for (const hero of missing) {
        if (!impactIndex.has(hero)) impactIndex.set(hero, { direct: 0, promote: 0 });
        impactIndex.get(hero).promote++;
      }
    } else if (missing.length === 3) {
      almost3.push({ ...base, missingHeroes: [...missing].sort() });
    }
  }

  // あと1体の優先度（unlockCount降順、同点はmaxInen降順）
  const priority = [...missingHeroCount.entries()]
    .map(([name, count]) => {
      const hero = eiketsuData.find(e => e.name === name);
      const maxInen = almost
        .filter(a => a.missingHero === name)
        .reduce((max, a) => Math.max(max, a.inenCount), 0);
      const impact = impactIndex.get(name) || { direct: 0, promote: 0 };
      return { name, unlockCount: count, maxInen, hero, impact };
    })
    .sort((a, b) => {
      if (b.unlockCount !== a.unlockCount) return b.unlockCount - a.unlockCount;
      return b.maxInen - a.maxInen;
    });

  // あと2体のペア優先度（2体同時入手で最多編成解放されるペア）
  const pairPriority = [...missingPairCount.entries()]
    .map(([key, count]) => {
      const pair = key.split("|");
      const maxInen = almost2
        .filter(a => a.missingHeroes.join("|") === key)
        .reduce((max, a) => Math.max(max, a.inenCount), 0);
      return { pair, pairKey: key, unlockCount: count, maxInen };
    })
    .sort((a, b) => {
      if (b.unlockCount !== a.unlockCount) return b.unlockCount - a.unlockCount;
      return b.maxInen - a.maxInen;
    });

  return {
    achievable, almost, almost2, almost3,
    priority, pairPriority, impactIndex,
    summary: {
      ownedCount: ownedSet.size,
      totalFormations: formations.length,
      achievableCount: achievable.length,
      almostCount: almost.length,
      almost2Count: almost2.length,
      almost3Count: almost3.length,
    }
  };
}

function analyzeOwnedFormations() {
  const ownedSet = new Set(window.collectionManager?.getOwnedList?.() || []);
  const formations = window.nobolLibraryData?.formations || [];
  const eiketsuData = window.EIKETSU_DATA || [];
  return analyzeFormationsData(formations, ownedSet, eiketsuData);
}

function sortFormations(formations) {
  const sorted = [...formations];
  const mul = discoverySortDir === "desc" ? -1 : 1;
  sorted.sort((a, b) => {
    if (discoverySortKey === "ic") return mul * (a.inenCount - b.inenCount);
    const si = discoverySortKey;
    return mul * ((a.stats?.[si] || 0) - (b.stats?.[si] || 0));
  });
  return sorted;
}

// =====================================================
// レンダリング
// =====================================================

const dt = (key, fallback) => (typeof i18n !== "undefined" ? i18n.t(key) : fallback) || fallback;

function escapeHtmlD(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 初期画面の保有数ヒントを更新
 */
function updateDiscoveryHint() {
  const hint = document.getElementById("discovery-owned-hint");
  if (!hint) return;
  const count = window.collectionManager?.getOwnedList?.()?.length || 0;
  if (count === 0) {
    hint.innerHTML = `<span style="color:#ef4444; font-size:12px;">保有英傑: <strong>0</strong>体 — Shift+クリックで登録</span>`;
  } else {
    const color = count < 6 ? "#d97706" : "#10b981";
    hint.innerHTML = `<span style="color:${color}; font-size:12px;">保有英傑: <strong>${count}</strong>体 登録済み</span>`;
  }
}

/**
 * 「探す」ボタンからの検索開始
 */
async function startDiscoverySearch() {
  // nobol_formations.json がまだ読み込まれていなければ遅延ロード
  if (!window.nobolLibraryData) {
    const initialEl = document.getElementById("discovery-initial");
    if (initialEl) initialEl.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto 16px;"></div><p style="color:#64748b;font-size:0.875rem;">データを読み込み中...</p></div>';
    if (typeof window.loadNobolLibraryData === "function") {
      await window.loadNobolLibraryData();
    }
  }

  renderDiscoveryResults();
}

// スピナーを即時表示してブラウザに描画の機会を与えるヘルパー
// rAF + setTimeout(0) の二段構えで「次フレームで描画 → その後に重処理」を保証
function yieldToBrowserPaint() {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

async function renderDiscoveryResults() {
  const summaryEl = document.getElementById("discovery-summary");
  const subtabsEl = document.getElementById("discovery-subtabs");
  const resultsEl = document.getElementById("discovery-results");
  const initialEl = document.getElementById("discovery-initial");
  if (!summaryEl || !resultsEl) return;

  if (!window.nobolLibraryData || !window.nobolLibraryData.formations) {
    resultsEl.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto 16px;"></div><p style="color:#64748b;font-size:0.875rem;">データを読み込み中...</p></div>';
    resultsEl.style.display = "";
    if (initialEl) initialEl.style.display = "none";
    return;
  }

  // 初期画面を非表示、結果エリアにスピナーを出してから重処理を走らせる
  if (initialEl) initialEl.style.display = "none";
  resultsEl.style.display = "";
  resultsEl.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto 16px;"></div><p style="color:#64748b;font-size:0.875rem;">保有英傑で組める因縁を集計中...</p></div>';
  summaryEl.innerHTML = "";

  // スピナーを描画してから集計処理を実行
  await yieldToBrowserPaint();

  discoveryCache = analyzeOwnedFormations();
  const { summary } = discoveryCache;

  // サマリーバー（ステータスランキングと同じテイスト）
  summaryEl.innerHTML = `
    <div class="flex items-start gap-3 mb-4 p-3 rounded-lg border" style="background:var(--brand-primary-light);border-color:var(--c-primary-border);">
      <div class="text-2xl flex-shrink-0 mt-0.5">&#x1F5FA;</div>
      <div class="min-w-0">
        <h3 class="text-sm font-bold" style="color:var(--c-primary-text);">保有英傑で組める因縁を探そう</h3>
        <p class="text-xs mt-0.5" style="color:var(--brand-neutral);">
          保有 <strong>${summary.ownedCount}</strong>体 ／
          <span style="color:#10b981;font-weight:600;">組める ${summary.achievableCount}件</span> ／
          <span style="color:#d97706;font-weight:600;">あと1体 ${summary.almostCount}件</span> ／
          <span style="color:#7c3aed;font-weight:600;">あと2体 ${summary.almost2Count}件</span> ／
          <span style="color:#0284c7;font-weight:600;">あと3体 ${summary.almost3Count}件</span>
        </p>
      </div>
    </div>`;

  subtabsEl.style.display = "";

  // タブ内バッジ更新
  const badge = document.getElementById("discovery-count-badge");
  if (badge) {
    badge.textContent = `${summary.achievableCount}件`;
    badge.style.display = summary.achievableCount > 0 ? "inline" : "none";
  }
  const badgeA = document.getElementById("disc-badge-achievable");
  if (badgeA) badgeA.textContent = `${summary.achievableCount}`;
  const badgeB = document.getElementById("disc-badge-almost");
  if (badgeB) badgeB.textContent = `${summary.almostCount}`;
  const badgeC = document.getElementById("disc-badge-almost2");
  if (badgeC) badgeC.textContent = `${summary.almost2Count}`;
  const badgeD = document.getElementById("disc-badge-almost3");
  if (badgeD) badgeD.textContent = `${summary.almost3Count}`;

  discoveryPage = { achievable: 1, almost: 1, almost2: 1, almost3: 1 };
  renderDiscoveryView();
}

function renderDiscoveryView() {
  const resultsEl = document.getElementById("discovery-results");
  if (!resultsEl || !discoveryCache) return;

  switch (discoveryCurrentView) {
    case "achievable": renderTableView(resultsEl, discoveryCache.achievable, "achievable"); break;
    case "almost": renderTableView(resultsEl, discoveryCache.almost, "almost"); break;
    case "almost2": renderTableView2(resultsEl, discoveryCache.almost2, "almost2"); break;
    case "almost3": renderTableView3(resultsEl, discoveryCache.almost3, "almost3"); break;
    case "priority": renderPriorityView(resultsEl); break;
  }
}

// =====================================================
// テーブルビュー（組める編成 / あと1体 共通）
// =====================================================

function renderTableView(container, rawData, viewKey) {
  // あと1体のフィルタ適用
  let data = rawData;
  if (viewKey === "almost" && discoveryPriorityFilter) {
    data = data.filter(a => a.missingHero === discoveryPriorityFilter);
  }

  const sorted = sortFormations(data);
  const page = discoveryPage[viewKey] || 1;
  const totalPages = Math.ceil(sorted.length / discoveryPerPage);
  const start = (page - 1) * discoveryPerPage;
  const visible = sorted.slice(start, start + discoveryPerPage);

  if (sorted.length === 0) {
    const msg = viewKey === "achievable"
      ? dt("discovery_no_achievable", "組める編成がありません。英傑を追加登録してください")
      : "あと1体の編成がありません";
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b;"><p>${msg}</p></div>`;
    return;
  }

  // フィルタバー（あと1体）
  let filterBar = "";
  if (viewKey === "almost" && discoveryPriorityFilter) {
    filterBar = `
      <div class="flex items-center gap-2 mb-3 p-2.5 rounded-lg border" style="background:#fef3c7;border-color:#fde68a;">
        <span class="text-xs">「<strong>${escapeHtmlD(discoveryPriorityFilter)}</strong>」が不足している編成</span>
        <button onclick="clearDiscoveryFilter()" class="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">✕ 解除</button>
      </div>`;
  }

  // ソートヘッダーの矢印
  const arrow = (key) => {
    if (discoverySortKey !== key) return "";
    return discoverySortDir === "desc" ? " ▼" : " ▲";
  };
  const thCls = (key) => discoverySortKey === key ? "color:var(--brand-primary);font-weight:700;" : "";

  // ステータスヘッダー（陣法検索と同じ形式）
  const statHeaders = DISC_STAT_SHORT.map((name, si) =>
    `<th class="col-stat py-2 px-1.5 font-medium text-right cursor-pointer select-none hover:text-blue-600 whitespace-nowrap" style="${thCls(si)}" onclick="sortDiscovery(${si})">${name}${arrow(si)}</th>`
  ).join("");

  // 行生成（陣法検索と同じ構造: メンバー / 陣形 / 因縁 / (不足) / ステータス / 操作）
  const rows = visible.map(f => {
    // 実発動因縁数を再計算（メイン UI と同じ Spec B 判定）
    const actual = window.computeActualFormationInen
      ? window.computeActualFormationInen(f.members || [])
      : null;
    const displayInenCount = actual && actual.count > 0 ? actual.count : f.inenCount;

    const members = f.members.map(name => {
      if (viewKey === "almost" && name === f.missingHero) {
        return `<span style="color:#ef4444;font-weight:700;background:#fef2f2;padding:0 3px;border-radius:2px;">${escapeHtmlD(name)}</span>`;
      }
      return escapeHtmlD(name);
    }).join(", ");

    const inenColor = displayInenCount >= 9 ? "bg-purple-100 text-purple-800" :
                      displayInenCount >= 8 ? "bg-emerald-100 text-emerald-800" :
                      displayInenCount >= 7 ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-600";

    // 陣形名（nobol_formations.json の f キーから取得）
    const formationName = f.formation || "-";

    const statCells = DISC_STAT_SHORT.map((_, si) => {
      const val = f.stats?.[si] || 0;
      return `<td class="py-2 px-1.5 text-right text-xs font-mono tabular-nums">${val ? val.toLocaleString() : "-"}</td>`;
    }).join("");

    const missingCell = viewKey === "almost"
      ? `<td class="py-2 px-2 text-xs"><span style="color:#d97706;font-weight:600;">${escapeHtmlD(f.missingHero)}</span></td>`
      : "";

    const actionBtn = viewKey === "achievable"
      ? `<td class="col-action py-2 px-1 text-center">
          <button onclick="applyFormationFromDiscovery(${JSON.stringify(f.members).replace(/"/g, '&quot;')})"
                  class="px-2 py-1 text-xs btn-brand-primary text-white rounded hover:opacity-90 transition-opacity">配置</button>
        </td>`
      : `<td class="col-action py-2 px-1"></td>`;

    return `<tr class="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
      <td class="col-members py-2 px-2 text-xs text-gray-700">${members}</td>
      <td class="col-formation py-2 px-2 text-center text-xs text-gray-500">${escapeHtmlD(formationName)}</td>
      <td class="col-inen py-2 px-2 text-center"><span class="inline-block px-2 py-0.5 rounded text-xs font-bold ${inenColor}">${displayInenCount}</span></td>
      ${missingCell}
      ${statCells}
      ${actionBtn}
    </tr>`;
  }).join("");

  // 不足英傑ヘッダー（あと1体のみ）
  const missingHeader = viewKey === "almost"
    ? `<th class="col-missing py-2 px-2 font-medium whitespace-nowrap">不足英傑</th>`
    : "";

  // ページャーHTML
  const pagerHtml = renderDiscoveryPager(viewKey, page, totalPages, sorted.length);

  const html = `
    ${filterBar}
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="text-xs text-gray-500">${sorted.length}件中 ${start + 1}〜${Math.min(start + discoveryPerPage, sorted.length)}件目</div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">表示件数:</span>
        ${[25, 50, 100].map(n =>
          `<button onclick="changeDiscoveryPerPage(${n},'${viewKey}')" class="px-2.5 py-1 text-xs rounded-md ${discoveryPerPage === n ? 'bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'} cursor-pointer transition-colors">${n}件</button>`
        ).join("")}
      </div>
    </div>
    <div class="overflow-x-auto" style="max-height:70vh; overflow-y:auto;">
      <table class="discovery-table w-full text-left">
        <thead><tr class="bg-gray-50 text-xs text-gray-600 sticky top-0 z-10">
          <th class="col-members py-2 px-2 font-medium text-left">メンバー</th>
          <th class="col-formation py-2 px-2 font-medium text-center">陣形</th>
          <th class="col-inen py-2 px-2 font-medium text-center cursor-pointer select-none hover:text-blue-600 whitespace-nowrap" style="${thCls("ic")}" onclick="sortDiscovery('ic')">因縁${arrow("ic")}</th>
          ${missingHeader}
          ${statHeaders}
          <th class="col-action py-2 px-1 font-medium text-center">操作</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pagerHtml}`;

  container.innerHTML = html;
}

// =====================================================
// 「あと2体」テーブルビュー
// =====================================================

function renderTableView2(container, rawData, viewKey) {
  // ペアフィルタ適用
  let data = rawData;
  if (discoveryPriorityFilter2) {
    data = data.filter(a => a.missingHeroes.join("|") === discoveryPriorityFilter2);
  }

  const sorted = sortFormations(data);
  const page = discoveryPage[viewKey] || 1;
  const totalPages = Math.ceil(sorted.length / discoveryPerPage);
  const start = (page - 1) * discoveryPerPage;
  const visible = sorted.slice(start, start + discoveryPerPage);

  if (sorted.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;"><p>あと2体の編成がありません</p></div>';
    return;
  }

  // ペアフィルタバー
  let filterBar = "";
  if (discoveryPriorityFilter2) {
    const names = discoveryPriorityFilter2.split("|");
    filterBar = `
      <div class="flex items-center gap-2 mb-3 p-2.5 rounded-lg border" style="background:#f5f3ff;border-color:#ddd6fe;">
        <span class="text-xs">「<strong>${escapeHtmlD(names[0])}</strong>」+「<strong>${escapeHtmlD(names[1])}</strong>」が不足している編成</span>
        <button onclick="clearDiscoveryFilter2()" class="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">✕ 解除</button>
      </div>`;
  }

  const arrow = (key) => {
    if (discoverySortKey !== key) return "";
    return discoverySortDir === "desc" ? " ▼" : " ▲";
  };
  const thCls = (key) => discoverySortKey === key ? "color:var(--brand-primary);font-weight:700;" : "";

  const statHeaders = DISC_STAT_SHORT.map((name, si) =>
    `<th class="col-stat py-2 px-1.5 font-medium text-right cursor-pointer select-none hover:text-blue-600 whitespace-nowrap" style="${thCls(si)}" onclick="sortDiscovery(${si})">${name}${arrow(si)}</th>`
  ).join("");

  const rows = visible.map(f => {
    // 実発動因縁数を再計算（メイン UI と同じ Spec B 判定）
    const actual = window.computeActualFormationInen
      ? window.computeActualFormationInen(f.members || [])
      : null;
    const displayInenCount = actual && actual.count > 0 ? actual.count : f.inenCount;

    const members = f.members.map(name => {
      if (f.missingHeroes.includes(name)) {
        return `<span style="color:#7c3aed;font-weight:700;background:#f5f3ff;padding:0 3px;border-radius:2px;">${escapeHtmlD(name)}</span>`;
      }
      return escapeHtmlD(name);
    }).join(", ");

    const inenColor = displayInenCount >= 9 ? "bg-purple-100 text-purple-800" :
                      displayInenCount >= 8 ? "bg-emerald-100 text-emerald-800" :
                      displayInenCount >= 7 ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-600";

    const statCells = DISC_STAT_SHORT.map((_, si) => {
      const val = f.stats?.[si] || 0;
      return `<td class="py-2 px-1.5 text-right text-xs font-mono tabular-nums">${val ? val.toLocaleString() : "-"}</td>`;
    }).join("");

    const missingCell = `<td class="py-2 px-2 text-xs"><span style="color:#7c3aed;font-weight:600;">${f.missingHeroes.map(n => escapeHtmlD(n)).join(", ")}</span></td>`;

    return `<tr class="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
      <td class="col-members py-2 px-2 text-xs text-gray-700">${members}</td>
      <td class="col-formation py-2 px-2 text-center text-xs text-gray-500">${escapeHtmlD(f.formation || "-")}</td>
      <td class="col-inen py-2 px-2 text-center"><span class="inline-block px-2 py-0.5 rounded text-xs font-bold ${inenColor}">${displayInenCount}</span></td>
      ${missingCell}
      ${statCells}
      <td class="col-action py-2 px-1"></td>
    </tr>`;
  }).join("");

  const pagerHtml = renderDiscoveryPager(viewKey, page, totalPages, sorted.length);

  container.innerHTML = `
    ${filterBar}
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="text-xs text-gray-500">${sorted.length}件中 ${start + 1}〜${Math.min(start + discoveryPerPage, sorted.length)}件目</div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">表示件数:</span>
        ${[25, 50, 100].map(n =>
          `<button onclick="changeDiscoveryPerPage(${n},'${viewKey}')" class="px-2.5 py-1 text-xs rounded-md ${discoveryPerPage === n ? 'bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'} cursor-pointer transition-colors">${n}件</button>`
        ).join("")}
      </div>
    </div>
    <div class="overflow-x-auto" style="max-height:70vh; overflow-y:auto;">
      <table class="discovery-table w-full text-left">
        <thead><tr class="bg-gray-50 text-xs text-gray-600 sticky top-0 z-10">
          <th class="col-members py-2 px-2 font-medium text-left">メンバー</th>
          <th class="col-formation py-2 px-2 font-medium text-center">陣形</th>
          <th class="col-inen py-2 px-2 font-medium text-center cursor-pointer select-none hover:text-blue-600 whitespace-nowrap" style="${thCls("ic")}" onclick="sortDiscovery('ic')">因縁${arrow("ic")}</th>
          <th class="col-missing py-2 px-2 font-medium whitespace-nowrap">不足英傑(2)</th>
          ${statHeaders}
          <th class="col-action py-2 px-1 font-medium text-center">操作</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pagerHtml}`;
}

// =====================================================
// 「あと3体」テーブルビュー（上位100件のみ表示）
// =====================================================

function renderTableView3(container, rawData, viewKey) {
  const sorted = sortFormations(rawData);
  // あと3体は候補が多いため上位のみ表示
  const capped = sorted.slice(0, 300);
  const page = discoveryPage[viewKey] || 1;
  const totalPages = Math.ceil(capped.length / discoveryPerPage);
  const start = (page - 1) * discoveryPerPage;
  const visible = capped.slice(start, start + discoveryPerPage);

  if (sorted.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;"><p>あと3体の編成がありません</p></div>';
    return;
  }

  const arrow = (key) => {
    if (discoverySortKey !== key) return "";
    return discoverySortDir === "desc" ? " ▼" : " ▲";
  };
  const thCls = (key) => discoverySortKey === key ? "color:var(--brand-primary);font-weight:700;" : "";

  const statHeaders = DISC_STAT_SHORT.map((name, si) =>
    `<th class="col-stat py-2 px-1.5 font-medium text-right cursor-pointer select-none hover:text-blue-600 whitespace-nowrap" style="${thCls(si)}" onclick="sortDiscovery(${si})">${name}${arrow(si)}</th>`
  ).join("");

  const rows = visible.map(f => {
    // 実発動因縁数を再計算（メイン UI と同じ Spec B 判定）
    const actual = window.computeActualFormationInen
      ? window.computeActualFormationInen(f.members || [])
      : null;
    const displayInenCount = actual && actual.count > 0 ? actual.count : f.inenCount;

    const members = f.members.map(name => {
      if (f.missingHeroes.includes(name)) {
        return `<span style="color:#6b7280;font-weight:700;background:#f3f4f6;padding:0 3px;border-radius:2px;">${escapeHtmlD(name)}</span>`;
      }
      return escapeHtmlD(name);
    }).join(", ");

    const inenColor = displayInenCount >= 9 ? "bg-purple-100 text-purple-800" :
                      displayInenCount >= 8 ? "bg-emerald-100 text-emerald-800" :
                      displayInenCount >= 7 ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-600";

    const statCells = DISC_STAT_SHORT.map((_, si) => {
      const val = f.stats?.[si] || 0;
      return `<td class="py-2 px-1.5 text-right text-xs font-mono tabular-nums">${val ? val.toLocaleString() : "-"}</td>`;
    }).join("");

    const missingCell = `<td class="py-2 px-2 text-xs"><span style="color:#6b7280;font-weight:600;">${f.missingHeroes.map(n => escapeHtmlD(n)).join(", ")}</span></td>`;

    return `<tr class="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td class="col-members py-2 px-2 text-xs text-gray-700">${members}</td>
      <td class="col-formation py-2 px-2 text-center text-xs text-gray-500">${escapeHtmlD(f.formation || "-")}</td>
      <td class="col-inen py-2 px-2 text-center"><span class="inline-block px-2 py-0.5 rounded text-xs font-bold ${inenColor}">${displayInenCount}</span></td>
      ${missingCell}
      ${statCells}
      <td class="col-action py-2 px-1"></td>
    </tr>`;
  }).join("");

  const pagerHtml = renderDiscoveryPager(viewKey, page, totalPages, capped.length);

  const capNote = sorted.length > 300
    ? `<div class="text-xs text-gray-400 mb-2">※ 全${sorted.length.toLocaleString()}件中、因縁数上位300件を表示</div>`
    : "";

  container.innerHTML = `
    ${capNote}
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="text-xs text-gray-500">${capped.length}件中 ${start + 1}〜${Math.min(start + discoveryPerPage, capped.length)}件目</div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">表示件数:</span>
        ${[25, 50, 100].map(n =>
          `<button onclick="changeDiscoveryPerPage(${n},'${viewKey}')" class="px-2.5 py-1 text-xs rounded-md ${discoveryPerPage === n ? 'bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'} cursor-pointer transition-colors">${n}件</button>`
        ).join("")}
      </div>
    </div>
    <div class="overflow-x-auto" style="max-height:70vh; overflow-y:auto;">
      <table class="discovery-table w-full text-left">
        <thead><tr class="bg-gray-50 text-xs text-gray-600 sticky top-0 z-10">
          <th class="col-members py-2 px-2 font-medium text-left">メンバー</th>
          <th class="col-formation py-2 px-2 font-medium text-center">陣形</th>
          <th class="col-inen py-2 px-2 font-medium text-center cursor-pointer select-none hover:text-blue-600 whitespace-nowrap" style="${thCls("ic")}" onclick="sortDiscovery('ic')">因縁${arrow("ic")}</th>
          <th class="col-missing py-2 px-2 font-medium whitespace-nowrap">不足英傑(3)</th>
          ${statHeaders}
          <th class="col-action py-2 px-1 font-medium text-center">操作</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pagerHtml}`;
}

// =====================================================
// 入手優先度ビュー（インパクト分析統合）
// =====================================================

function renderPriorityView(container) {
  const { priority, pairPriority } = discoveryCache;

  if (priority.length === 0 && pairPriority.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">データがありません</div>';
    return;
  }

  // === 1体入手優先度テーブル（インパクト列追加） ===
  const rows = priority.slice(0, 30).map((p, i) => {
    const rank = i + 1;
    const rankCls = rank <= 3 ? "text-amber-500 font-black" : "text-gray-400 font-bold";
    const job = p.hero?.job || "";
    // インパクト分析: 入手で組める + あと1体に昇格
    const directCount = p.impact?.direct || 0;
    const promoteCount = p.impact?.promote || 0;

    return `<tr class="border-b border-gray-100 hover:bg-amber-50/30 transition-colors cursor-pointer" onclick="filterAlmostByHero('${escapeHtmlD(p.name)}')">
      <td class="py-2.5 px-3 text-center text-lg ${rankCls}">${rank}</td>
      <td class="py-2.5 px-2">
        <div class="text-sm font-semibold text-gray-800">${escapeHtmlD(p.name)}</div>
        <div class="text-xs text-gray-500">${escapeHtmlD(job)}</div>
      </td>
      <td class="py-2.5 px-2 text-center"><span class="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">${p.unlockCount}件</span></td>
      <td class="py-2.5 px-2 text-center"><span class="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">${p.maxInen}</span></td>
      <td class="py-2.5 px-2 text-center">
        <span class="inline-block px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs font-semibold" title="入手で即座に組める編成数">+${directCount}</span>
        ${promoteCount > 0 ? `<span class="inline-block ml-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs" title="あと1体に昇格する編成数">↑${promoteCount}</span>` : ""}
      </td>
      <td class="py-2.5 px-2 text-center text-gray-400 text-lg">›</td>
    </tr>`;
  }).join("");

  // === 2体同時入手優先度テーブル ===
  const pairRows = pairPriority.slice(0, 20).map((pp, i) => {
    const rank = i + 1;
    const rankCls = rank <= 3 ? "text-purple-500 font-black" : "text-gray-400 font-bold";
    return `<tr class="border-b border-gray-100 hover:bg-purple-50/30 transition-colors cursor-pointer" onclick="filterAlmost2ByPair('${escapeHtmlD(pp.pairKey)}')">
      <td class="py-2.5 px-3 text-center text-lg ${rankCls}">${rank}</td>
      <td class="py-2.5 px-2">
        <div class="text-sm font-semibold text-gray-800">${pp.pair.map(n => escapeHtmlD(n)).join(" + ")}</div>
      </td>
      <td class="py-2.5 px-2 text-center"><span class="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">${pp.unlockCount}件</span></td>
      <td class="py-2.5 px-2 text-center"><span class="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">${pp.maxInen}</span></td>
      <td class="py-2.5 px-2 text-center text-gray-400 text-lg">›</td>
    </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="flex items-start gap-3 mb-3 p-2.5 rounded-lg border" style="background:#fffbeb;border-color:#fde68a;">
      <div class="text-lg flex-shrink-0">&#x1F4A1;</div>
      <p class="text-xs" style="color:#92400e;">英傑をクリック → 「あと1体」ビューにフィルタ遷移 ／ ペアをクリック → 「あと2体」ビューにフィルタ遷移</p>
    </div>

    <h4 class="text-sm font-bold text-gray-700 mb-2 mt-1">1体入手 優先度</h4>
    <div class="overflow-x-auto mb-6">
      <table class="w-full text-left">
        <thead><tr class="bg-gray-50 text-xs text-gray-600">
          <th class="py-2 px-3 font-medium text-center">#</th>
          <th class="py-2 px-2 font-medium">英傑名</th>
          <th class="py-2 px-2 font-medium text-center">解放編成</th>
          <th class="py-2 px-2 font-medium text-center">最大因縁</th>
          <th class="py-2 px-2 font-medium text-center">インパクト</th>
          <th class="py-2 px-2"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    ${pairRows.length > 0 ? `
    <h4 class="text-sm font-bold text-gray-700 mb-2">2体同時入手 優先度</h4>
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead><tr class="bg-gray-50 text-xs text-gray-600">
          <th class="py-2 px-3 font-medium text-center">#</th>
          <th class="py-2 px-2 font-medium">英傑ペア</th>
          <th class="py-2 px-2 font-medium text-center">解放編成</th>
          <th class="py-2 px-2 font-medium text-center">最大因縁</th>
          <th class="py-2 px-2"></th>
        </tr></thead>
        <tbody>${pairRows}</tbody>
      </table>
    </div>` : ""}`;
}

// =====================================================
// インタラクション
// =====================================================

/**
 * ページャーHTML生成
 */
function renderDiscoveryPager(viewKey, currentPage, totalPages, totalItems) {
  if (totalPages <= 1) return "";

  // ページ番号リスト（最大7個表示、省略あり）
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return `
    <div class="flex flex-wrap items-center justify-center gap-1.5 mt-4 pt-3 border-t border-gray-200">
      <button onclick="goDiscoveryPage('${viewKey}',${currentPage - 1})"
              class="px-3 py-2 text-sm rounded-md border ${prevDisabled ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50' : 'border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer'} transition-colors font-medium"
              ${prevDisabled ? "disabled" : ""}>‹ 前へ</button>
      ${pages.map(p => {
        if (p === "...") return '<span class="px-2 text-sm text-gray-400">…</span>';
        const isCurrent = p === currentPage;
        return `<button onclick="goDiscoveryPage('${viewKey}',${p})"
                  class="w-9 h-9 text-sm rounded-md ${isCurrent ? 'bg-blue-600 text-white font-bold shadow-sm' : 'border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer'} transition-colors">${p}</button>`;
      }).join("")}
      <button onclick="goDiscoveryPage('${viewKey}',${currentPage + 1})"
              class="px-3 py-2 text-sm rounded-md border ${nextDisabled ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50' : 'border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer'} transition-colors font-medium"
              ${nextDisabled ? "disabled" : ""}>次へ ›</button>
      <span class="ml-2 text-xs text-gray-400">${currentPage} / ${totalPages}ページ</span>
    </div>`;
}

/**
 * ページ遷移
 */
function goDiscoveryPage(viewKey, page) {
  let data;
  if (viewKey === "achievable") {
    data = discoveryCache.achievable;
  } else if (viewKey === "almost") {
    data = discoveryPriorityFilter
      ? discoveryCache.almost.filter(a => a.missingHero === discoveryPriorityFilter)
      : discoveryCache.almost;
  } else if (viewKey === "almost2") {
    data = discoveryPriorityFilter2
      ? discoveryCache.almost2.filter(a => a.missingHeroes.join("|") === discoveryPriorityFilter2)
      : discoveryCache.almost2;
  } else if (viewKey === "almost3") {
    // あと3体は上位300件制限
    data = discoveryCache.almost3.slice(0, 300);
  } else {
    return;
  }
  const totalPages = Math.ceil(data.length / discoveryPerPage);
  if (page < 1 || page > totalPages) return;
  discoveryPage[viewKey] = page;
  renderDiscoveryView();
  document.getElementById("discovery-results")?.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 表示件数変更
 */
function changeDiscoveryPerPage(count, viewKey) {
  discoveryPerPage = count;
  discoveryPage[viewKey] = 1;
  renderDiscoveryView();
}

function switchDiscoveryView(view) {
  discoveryCurrentView = view;
  discoveryPriorityFilter = null;
  discoveryPriorityFilter2 = null;
  discoveryPage = { achievable: 1, almost: 1, almost2: 1, almost3: 1 };
  discoverySortKey = "ic";
  discoverySortDir = "desc";

  document.querySelectorAll(".discovery-subtab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  renderDiscoveryView();
}

function sortDiscovery(key) {
  if (discoverySortKey === key) {
    discoverySortDir = discoverySortDir === "desc" ? "asc" : "desc";
  } else {
    discoverySortKey = key;
    discoverySortDir = "desc";
  }
  renderDiscoveryView();
}

function filterAlmostByHero(heroName) {
  discoveryPriorityFilter = heroName;
  discoveryCurrentView = "almost";
  discoveryPage.almost = 1;

  document.querySelectorAll(".discovery-subtab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === "almost");
  });

  renderDiscoveryView();
}

function clearDiscoveryFilter() {
  discoveryPriorityFilter = null;
  renderDiscoveryView();
}

/**
 * ペア優先度からあと2体ビューにフィルタ遷移
 */
function filterAlmost2ByPair(pairKey) {
  discoveryPriorityFilter2 = pairKey;
  discoveryCurrentView = "almost2";
  discoveryPage.almost2 = 1;

  document.querySelectorAll(".discovery-subtab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === "almost2");
  });

  renderDiscoveryView();
}

function clearDiscoveryFilter2() {
  discoveryPriorityFilter2 = null;
  renderDiscoveryView();
}

function applyFormationFromDiscovery(members) {
  if (!members || members.length !== 6) return;

  members.forEach((name, i) => {
    const eiketsu = (window.EIKETSU_DATA || []).find(e => e.name === name);
    if (eiketsu) {
      window.selectedEiketsu[i] = {
        eiketsu, limitBreak: 4, trust20: true,
        bunkoku: !!(eiketsu.factors?.[3]),
      };
    }
  });

  if (typeof window.clearCaches === "function") window.clearCaches();
  if (typeof window.updateAll === "function") window.updateAll();
  document.querySelector(".selected-eiketsu-container")?.scrollIntoView({ behavior: "smooth" });
  if (typeof window.showMessage === "function") {
    window.showMessage("編成を配置しました", "success");
  }
}

function isDiscoveryTabActive() {
  const el = document.getElementById("tab-content-discovery");
  return el && !el.classList.contains("hidden");
}

// =====================================================
// イベント統合
// =====================================================

// 因縁マップの「登録・編集」ボタン → 共通モーダルを開く
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("discovery-open-collection")?.addEventListener("click", () => {
    if (typeof window.openCollectionModal === "function") window.openCollectionModal();
  });
  // 初期件数表示
  updateDiscoveryOwnedCount();
});

function updateDiscoveryOwnedCount() {
  const count = window.collectionManager?.getOwnedList?.()?.length || 0;
  const el = document.getElementById("discovery-owned-count");
  if (el) el.textContent = count;
}

// 保有英傑変更時のリアルタイム更新（window に dispatch されるイベント）
window.addEventListener("eiketsu-collection-changed", onCollectionChanged);
// フォールバック: document に dispatch される場合も対応
document.addEventListener("eiketsu-collection-changed", onCollectionChanged);

function onCollectionChanged() {
  discoveryCache = null;
  // 保有件数バーの更新
  updateDiscoveryOwnedCount();
  // 初期画面のヒント更新（タブが非アクティブでもDOM更新）
  updateDiscoveryHint();
  // 結果が表示中なら再計算
  const resultsEl = document.getElementById("discovery-results");
  if (isDiscoveryTabActive() && resultsEl && resultsEl.style.display !== "none") {
    renderDiscoveryResults();
  }
}

// =====================================================
// グローバル公開
// =====================================================
window.renderDiscoveryResults = renderDiscoveryResults;
window.startDiscoverySearch = startDiscoverySearch;
window.updateDiscoveryHint = updateDiscoveryHint;
window.updateDiscoveryOwnedCount = updateDiscoveryOwnedCount;
window.switchDiscoveryView = switchDiscoveryView;
window.sortDiscovery = sortDiscovery;
window.goDiscoveryPage = goDiscoveryPage;
window.changeDiscoveryPerPage = changeDiscoveryPerPage;
window.filterAlmostByHero = filterAlmostByHero;
window.clearDiscoveryFilter = clearDiscoveryFilter;
window.filterAlmost2ByPair = filterAlmost2ByPair;
window.clearDiscoveryFilter2 = clearDiscoveryFilter2;
window.applyFormationFromDiscovery = applyFormationFromDiscovery;
window.isDiscoveryTabActive = isDiscoveryTabActive;
