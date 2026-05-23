/**
 * formation-search.js
 * 陣法検索機能
 *
 * 依存:
 *   - window.collectionManager (collection-manager.js)
 *   - window.statTopInenData (formation-library.js で読み込み)
 *   - window.calculateAllBoosts (main.js)
 *   - window.selectedEiketsu (main.js)
 *   - window.applyFormationFromLibrary (formation-library.js)
 *   - window.switchFormationDbTab (formation-library.js)
 *   - window.EIKETSU_DATA (main.js)
 */

// =====================================================
// 定数
// =====================================================

const SEARCH_STAT_NAMES = [
  "生命", "気合", "腕力", "耐久力", "器用さ",
  "知力", "魅力", "土属性", "水属性", "火属性", "風属性"
];

const SEARCH_STAT_SHORT = [
  "生命", "気合", "腕力", "耐久", "器用",
  "知力", "魅力", "土", "水", "火", "風"
];

// =====================================================
// 状態
// =====================================================

let searchFormationsData = null; // search_formations.json
let searchLoading = false;
let searchSortKey = "stat";     // "stat" | "inen" | "reach"
let searchSortDir = "desc";
let expandedRowIdx = -1;        // 現在展開中の行インデックス

// =====================================================
// データ読み込み
// =====================================================

async function loadSearchFormations() {
  if (searchFormationsData) return searchFormationsData;
  if (searchLoading) return null;

  searchLoading = true;
  try {
    // Phase C 統合: nobol_formations（因縁8以上）を軸とする。
    // 旧 search_formations.json 依存は廃止。複雑条件の全量検索が必要な場合は
    // DataSource.search() が api/query.php を呼び、サーバー側で絞り込む。
    if (window.DataSource) {
      const highInen = await window.DataSource.getHighInenFormations();
      searchFormationsData = {
        formations: (highInen && highInen.formations) ? highInen.formations : [],
      };
      if (window.DEBUG) {
        console.log(
          `[formation-search] DataSource loaded: ${searchFormationsData.formations.length} formations`
        );
      }
      return searchFormationsData;
    }

    // DataSource 不在時のフォールバック: stat_top_inen から検索用データを生成
    searchFormationsData = buildSearchDataFromStatTopInen();
    if (searchFormationsData && searchFormationsData.formations.length > 0) {
      return searchFormationsData;
    }

    // どちらもなければ空
    searchFormationsData = { formations: [] };
    return searchFormationsData;
  } catch (e) {
    console.error("[formation-search] データ読み込み失敗:", e);
    return null;
  } finally {
    searchLoading = false;
  }
}

/**
 * stat_top_inen.json のデータから陣法検索用データを生成
 * highInen + 各ステータスのpatternsから重複排除して構築
 */
function buildSearchDataFromStatTopInen() {
  const data = window.statTopInenData;
  if (!data) return { formations: [] };

  const seen = new Set();
  const formations = [];

  // highInenから
  if (data.highInen) {
    for (const entry of data.highInen) {
      if (!entry.m || entry.m.length !== 6) continue;
      const key = [...entry.m].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      formations.push({
        m: entry.m,
        s: entry.s || [],
        ic: entry.ic || 0,
        f: entry.f || "",
        i: entry.i || "",
      });
    }
  }

  // stats.{ステータス}.patterns の topM から
  if (data.stats) {
    for (const statData of Object.values(data.stats)) {
      if (!statData.patterns) continue;
      for (const p of statData.patterns) {
        if (!p.topM || p.topM.length !== 6) continue;
        const key = [...p.topM].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        formations.push({
          m: p.topM,
          s: p.s || [],
          ic: p.ic || 0,
          f: "",
          i: p.p || "",
        });
      }
    }
  }

  return { formations };
}

// =====================================================
// 到達度計算
// =====================================================

function calculateReachability(formation, ownedSet) {
  const members = formation.m;
  let ownedCount = 0;
  const missing = [];
  for (const name of members) {
    if (ownedSet.has(name)) {
      ownedCount++;
    } else {
      missing.push(name);
    }
  }
  return { ownedCount, missingCount: 6 - ownedCount, missing };
}

function getReachBadge(missingCount) {
  if (missingCount === 0) return { text: "組める！", cls: "bg-green-100 text-green-700" };
  if (missingCount === 1) return { text: "あと1体", cls: "bg-blue-100 text-blue-700" };
  if (missingCount === 2) return { text: "あと2体", cls: "bg-yellow-100 text-yellow-700" };
  return { text: `あと${missingCount}体`, cls: "bg-gray-100 text-gray-500" };
}

// =====================================================
// 現在の編成ブースト取得（差分計算用）
// =====================================================

function getCurrentBoosts() {
  const selected = window.selectedEiketsu || [];
  if (selected.filter(s => s && s.eiketsu).length < 3) return null;

  try {
    if (typeof window.calculateAllBoosts !== "function") return null;
    const { inenBoosts, formationBoosts } = window.calculateAllBoosts();
    const result = {};
    SEARCH_STAT_NAMES.forEach((stat, i) => {
      const key = stat.replace("属性", "");
      result[i] = Math.floor((inenBoosts[key] || 0) + (formationBoosts[key] || 0));
    });
    return result;
  } catch {
    return null;
  }
}

// =====================================================
// フィルタ・ソート
// =====================================================

function getSearchFilterValues() {
  const statFilter = document.getElementById("search-stat-filter");
  const reachFilter = document.getElementById("search-reach-filter");
  const ownedFilter = document.getElementById("search-owned-filter");
  const compareFilter = document.getElementById("search-compare-current");

  // ステ下限値の収集
  const minThresholds = [];
  for (let i = 0; i < 11; i++) {
    const input = document.getElementById(`search-min-${i}`);
    if (input && input.value !== "") {
      const val = parseInt(input.value);
      if (!isNaN(val)) minThresholds.push({ idx: i, min: val });
    }
  }

  return {
    statIdx: statFilter ? (statFilter.value !== "" ? parseInt(statFilter.value) : -1) : -1,
    maxMissing: reachFilter ? (reachFilter.value !== "" ? parseInt(reachFilter.value) : 99) : 99,
    ownedOnly: ownedFilter ? ownedFilter.checked : false,
    compareMode: compareFilter ? compareFilter.checked : false,
    minThresholds,
  };
}

function applySearchFilters() {
  if (!searchFormationsData) return [];

  const filters = getSearchFilterValues();
  const formations = searchFormationsData.formations;
  const ownedSet = new Set(
    window.collectionManager ? window.collectionManager.getOwnedList() : []
  );

  const results = [];
  for (let i = 0; i < formations.length; i++) {
    const f = formations[i];
    const reach = calculateReachability(f, ownedSet);

    // 到達度フィルタ
    if (reach.missingCount > filters.maxMissing) continue;

    // 保有フィルタ: ON時は保有英傑が少なくとも1体含まれる編成のみ
    if (filters.ownedOnly && reach.ownedCount === 0) continue;

    // ステータス下限フィルタ
    if (filters.minThresholds.length > 0) {
      let pass = true;
      for (const t of filters.minThresholds) {
        if (f.s[t.idx] < t.min) { pass = false; break; }
      }
      if (!pass) continue;
    }

    results.push({ idx: i, formation: f, reach });
  }

  // ソート
  const statIdx = filters.statIdx >= 0 ? filters.statIdx : 0; // デフォルト: 生命

  results.sort((a, b) => {
    let cmp = 0;
    if (searchSortKey === "stat") {
      cmp = b.formation.s[statIdx] - a.formation.s[statIdx];
    } else if (searchSortKey === "inen") {
      cmp = b.formation.ic - a.formation.ic;
    } else if (searchSortKey === "reach") {
      cmp = a.reach.missingCount - b.reach.missingCount;
    }
    if (cmp !== 0) return searchSortDir === "desc" ? cmp : -cmp;
    // タイブレーク: ステータス値
    return b.formation.s[statIdx] - a.formation.s[statIdx];
  });

  return results;
}

// =====================================================
// テーブル描画
// =====================================================

function renderSearchResults(results) {
  const container = document.getElementById("search-results");
  if (!container) return;

  const filters = getSearchFilterValues();
  const statIdx = filters.statIdx >= 0 ? filters.statIdx : 0;
  const currentBoosts = filters.compareMode ? getCurrentBoosts() : null;
  const currentStatVal = currentBoosts ? currentBoosts[statIdx] : null;

  // 件数表示
  const countEl = document.getElementById("search-result-count");
  if (countEl) {
    countEl.textContent = `${results.length}件`;
  }

  if (results.length === 0) {
    container.innerHTML = `<p class="text-sm p-4 text-center" style="color:var(--brand-neutral)">条件に合う陣法がありません</p>`;
    return;
  }

  // スマホではソート中のステータス1列のみ表示（列数を抑えて英傑名の幅を確保）
  const isMobile = window.innerWidth <= 640;
  const visibleStatList = isMobile ? [statIdx] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // テーブル構築
  const table = document.createElement("table");
  table.className = "w-full text-sm border-collapse";

  // ヘッダー
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.className = "bg-gray-50 text-xs text-gray-500 tracking-wider";

  // 固定列: 英傑, 陣形, 因縁, 到達度
  headerRow.innerHTML = `
    <th class="px-2 py-2 text-left font-medium">英傑</th>
    <th class="px-2 py-2 text-center font-medium">陣形</th>
    <th class="px-2 py-2 text-center font-medium cursor-pointer hover:text-blue-600" data-sort="inen" data-sort-type="inen">
      因縁${searchSortKey === "inen" ? (searchSortDir === "desc" ? " ▼" : " ▲") : ""}
    </th>
    <th class="px-2 py-2 text-center font-medium cursor-pointer hover:text-blue-600" data-sort="reach" data-sort-type="reach">
      到達度${searchSortKey === "reach" ? (searchSortDir === "desc" ? " ▼" : " ▲") : ""}
    </th>
  `;

  // 動的ステータス列
  visibleStatList.forEach(si => {
    const label = SEARCH_STAT_SHORT[si];
    const isActive = searchSortKey === "stat" && statIdx === si;
    const arrow = isActive ? (searchSortDir === "desc" ? " ▼" : " ▲") : "";
    const th = document.createElement("th");
    th.className = "px-2 py-2 text-right font-medium cursor-pointer hover:text-blue-600 whitespace-nowrap";
    th.dataset.sort = "stat";
    th.dataset.statIdx = si;
    th.textContent = label + arrow;
    if (isActive) th.style.color = "var(--brand-primary)";
    headerRow.appendChild(th);
  });

  // 操作列
  const opTh = document.createElement("th");
  opTh.className = "px-2 py-2 text-center font-medium w-14";
  opTh.textContent = "操作";
  headerRow.appendChild(opTh);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ヘッダーのソートクリック
  thead.querySelectorAll("[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const sortType = th.dataset.sort;
      if (sortType === "stat") {
        // ステータス列クリック: そのステでソート
        const clickedIdx = parseInt(th.dataset.statIdx);
        const statFilter = document.getElementById("search-stat-filter");
        if (statFilter) statFilter.value = String(clickedIdx);
        if (searchSortKey === "stat" && statIdx === clickedIdx) {
          searchSortDir = searchSortDir === "desc" ? "asc" : "desc";
        } else {
          searchSortKey = "stat";
          searchSortDir = "desc";
        }
      } else {
        if (searchSortKey === sortType) {
          searchSortDir = searchSortDir === "desc" ? "asc" : "desc";
        } else {
          searchSortKey = sortType;
          searchSortDir = "desc";
        }
      }
      triggerSearchUpdate();
    });
  });

  // ボディ（表示上限300件）
  const tbody = document.createElement("tbody");
  const displayLimit = 300;
  const displayResults = results.slice(0, displayLimit);

  displayResults.forEach((item, displayIdx) => {
    const f = item.formation;
    const reach = item.reach;
    const badge = getReachBadge(reach.missingCount);

    const tr = document.createElement("tr");
    tr.className = "border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors";
    if (displayIdx === expandedRowIdx) {
      tr.className += " bg-blue-50";
    }

    // 英傑名（短縮表示）— f.m（変換済み名）で保有判定
    const missingSet = new Set(reach.missing);
    const heroNames = f.m.map((name, mi) => {
      const display = (f.r && f.r[mi]) || name;
      const isMissing = missingSet.has(name);
      return isMissing
        ? `<span class="text-red-400">${escapeHtml(display)}</span>`
        : `<span class="text-gray-800">${escapeHtml(display)}</span>`;
    }).join(", ");

    // 実発動因縁数を再計算（メイン UI と同じ Spec B 判定）
    const actual = window.computeActualFormationInen
      ? window.computeActualFormationInen(f.m || [])
      : null;
    const displayIc = actual && actual.count > 0 ? actual.count : f.ic;

    // 固定列
    let html = `
      <td class="px-2 py-2 text-left text-xs leading-relaxed search-hero-cell">${heroNames}</td>
      <td class="px-2 py-2 text-center text-xs text-gray-500">${escapeHtml(f.f)}</td>
      <td class="px-2 py-2 text-center">
        <span class="inline-block px-1.5 py-0.5 text-xs font-semibold rounded ${displayIc >= 9 ? "bg-purple-100 text-purple-700" : displayIc >= 8 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}">${displayIc}</span>
      </td>
      <td class="px-2 py-2 text-center">
        <span class="inline-block px-1.5 py-0.5 text-xs font-medium rounded ${badge.cls}">${badge.text}</span>
      </td>`;

    // 動的ステータス列
    visibleStatList.forEach(si => {
      const val = f.s[si];
      const isSortCol = searchSortKey === "stat" && statIdx === si;
      html += `<td class="px-2 py-2 text-right font-mono text-xs ${isSortCol ? "font-bold" : ""}" style="${isSortCol ? "color:var(--brand-primary)" : ""}">${val.toLocaleString()}</td>`;
    });

    // 操作列
    html += `<td class="px-2 py-2 text-center">
        <button class="search-apply-btn text-xs px-2 py-1 rounded transition-colors" style="background:var(--brand-primary);color:#fff;" data-idx="${item.idx}">使う</button>
      </td>`;

    tr.innerHTML = html;

    // 行クリックで展開
    tr.addEventListener("click", (e) => {
      // 「使う」ボタンのクリックは除外
      if (e.target.closest(".search-apply-btn")) return;
      toggleRowDetail(displayIdx, item, statIdx, currentBoosts);
    });

    tbody.appendChild(tr);

    // 展開行（現在展開中なら表示）
    if (displayIdx === expandedRowIdx) {
      const detailTr = createDetailRow(item, statIdx, currentBoosts, currentStatVal !== null, visibleStatList);
      tbody.appendChild(detailTr);
    }
  });

  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);

  if (results.length > displayLimit) {
    const moreEl = document.createElement("p");
    moreEl.className = "text-xs text-gray-400 text-center py-2";
    moreEl.textContent = `他 ${results.length - displayLimit}件（フィルタで絞り込んでください）`;
    container.appendChild(moreEl);
  }

  // 「使う」ボタンイベント
  container.querySelectorAll(".search-apply-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      applyFormationFromSearch(idx);
    });
  });
}

// =====================================================
// 行展開
// =====================================================

function toggleRowDetail(displayIdx, item, statIdx, currentBoosts) {
  if (expandedRowIdx === displayIdx) {
    expandedRowIdx = -1;
  } else {
    expandedRowIdx = displayIdx;
  }
  // 再描画
  triggerSearchUpdate();
}

function createDetailRow(item, statIdx, currentBoosts, showDiff, visibleStatList) {
  const f = item.formation;
  const reach = item.reach;
  // 固定4列（英傑/陣形/因縁/到達度）+ ステータス列数 + 操作1列
  const colSpan = 4 + (visibleStatList ? visibleStatList.length : 11) + 1;

  const tr = document.createElement("tr");
  tr.className = "bg-blue-50";
  const td = document.createElement("td");
  td.colSpan = colSpan;
  td.className = "px-4 py-3";

  // 実発動因縁を再計算（メイン UI と同じ Spec B 判定）
  const actualDetail = window.computeActualFormationInen
    ? window.computeActualFormationInen(f.m || [])
    : null;
  const detailIc = actualDetail && actualDetail.count > 0 ? actualDetail.count : f.ic;
  const detailInenList = actualDetail && actualDetail.list && actualDetail.list.length > 0
    ? actualDetail.list
    : (f.i || []);

  // 因縁リスト
  const inenHtml = detailInenList.map(name =>
    `<span class="inline-block px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded mr-1 mb-1">${escapeHtml(name)}</span>`
  ).join("");

  // 全11ステータス
  const statsRows = SEARCH_STAT_SHORT.map((label, si) => {
    const val = f.s[si];
    let diffHtml = "";
    if (showDiff && currentBoosts) {
      const diff = val - (currentBoosts[si] || 0);
      const cls = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400";
      const sign = diff > 0 ? "+" : "";
      diffHtml = `<span class="${cls} text-xs ml-1">(${sign}${diff.toLocaleString()})</span>`;
    }
    const highlight = si === statIdx ? "font-bold text-blue-700" : "text-gray-700";
    return `
      <div class="flex items-center justify-between px-2 py-0.5 ${si % 2 === 0 ? "bg-white" : "bg-gray-50"} rounded">
        <span class="text-xs ${highlight}">${label}</span>
        <span class="text-xs font-mono ${highlight}">${val.toLocaleString()}${diffHtml}</span>
      </div>
    `;
  }).join("");

  // 不足英傑
  let missingHtml = "";
  if (reach.missing.length > 0) {
    const names = reach.missing.map(n =>
      `<span class="inline-block px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded mr-1 mb-1">${escapeHtml(n)}</span>`
    ).join("");
    missingHtml = `
      <div class="mt-2">
        <span class="text-xs font-medium text-gray-500">不足英傑 (あと${reach.missingCount}体):</span>
        <div class="mt-1">${names}</div>
      </div>
    `;
  }

  td.innerHTML = `
    <div class="space-y-2">
      <div>
        <span class="text-xs font-medium text-gray-500">発動因縁 (${detailIc}個):</span>
        <div class="mt-1">${inenHtml}</div>
      </div>
      <div>
        <span class="text-xs font-medium text-gray-500">ステータス上昇値:</span>
        <div class="mt-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">${statsRows}</div>
      </div>
      ${missingHtml}
    </div>
  `;

  tr.appendChild(td);
  return tr;
}

// =====================================================
// キーマン英傑パネル
// =====================================================

function renderKeymanPanel(statIdx) {
  const panel = document.getElementById("keyman-panel");
  if (!panel) return;

  // ステータス未選択時は非表示
  if (statIdx < 0) {
    panel.classList.add("hidden");
    return;
  }

  const statName = SEARCH_STAT_NAMES[statIdx];
  const data = window.statTopInenData;
  if (!data || !data.stats || !data.stats[statName]) {
    panel.classList.add("hidden");
    return;
  }

  const heroes = data.stats[statName].heroes; // [{n, c}]
  if (!heroes || heroes.length === 0) {
    panel.classList.add("hidden");
    return;
  }

  const topN = data.meta.topN || 3000;
  const ownedSet = new Set(
    window.collectionManager ? window.collectionManager.getOwnedList() : []
  );

  // 未保有のキーマンを先に、保有を後に
  const sorted = heroes.slice(0, 20).map(h => ({
    name: h.n,
    count: h.c,
    rate: Math.round((h.c / topN) * 100),
    isOwned: ownedSet.has(h.n),
  }));

  const notOwned = sorted.filter(h => !h.isOwned);
  const owned = sorted.filter(h => h.isOwned);

  let html = `
    <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-sm font-semibold text-amber-800">${SEARCH_STAT_SHORT[statIdx]}重視のキーマン英傑</span>
        <span class="text-xs text-amber-600">(上位${topN}陣法での出現率)</span>
      </div>
  `;

  if (notOwned.length > 0) {
    html += `<div class="mb-2"><span class="text-xs font-medium text-red-600">未保有:</span> `;
    html += notOwned.map(h =>
      `<span class="inline-block px-2 py-0.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded mr-1 mb-1">${escapeHtml(h.name)} <span class="text-red-400">${h.rate}%</span></span>`
    ).join("");
    html += `</div>`;
  }

  if (owned.length > 0) {
    html += `<div><span class="text-xs font-medium text-green-600">保有済:</span> `;
    html += owned.map(h =>
      `<span class="inline-block px-2 py-0.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded mr-1 mb-1">${escapeHtml(h.name)} <span class="text-green-400">${h.rate}%</span></span>`
    ).join("");
    html += `</div>`;
  }

  html += `</div>`;
  panel.innerHTML = html;
  panel.classList.remove("hidden");
}

// =====================================================
// 編成適用
// =====================================================

function applyFormationFromSearch(formationIdx) {
  if (!searchFormationsData) return;
  const f = searchFormationsData.formations[formationIdx];
  if (!f) return;

  // 既存の applyFormationFromLibrary を利用
  if (typeof window.applyFormationFromLibrary === "function") {
    window.applyFormationFromLibrary(f.m);
  } else {
    // フォールバック: selectedEiketsuに直接セット
    const eiketsuData = window.EIKETSU_DATA || [];
    f.m.forEach((name, i) => {
      if (i >= 6) return;
      const eiketsu = eiketsuData.find(e => e.名前 === name || e.name === name);
      if (eiketsu) {
        window.selectedEiketsu[i] = {
          eiketsu,
          limitBreak: f.b[i] || 4,
          trust20: true,
          bunkoku: !!eiketsu.因子4 || !!eiketsu.factors?.[3],
        };
      } else {
        window.selectedEiketsu[i] = null;
      }
    });
    if (typeof window.updateAll === "function") window.updateAll();
  }
}

// =====================================================
// CSV値ルックアップ（main.jsのtotal-boosts-display用）
// =====================================================

/**
 * 現在配置中の英傑6名でsearch_formations.jsonを検索し、
 * 一致する編成のCSV計算済みステータスを返す。
 * 見つからなければ null を返す。
 * @returns {{ stats: number[], inen: string[], ic: number, formation: string } | null}
 */
function lookupFormationStats(memberNames) {
  if (!searchFormationsData || !memberNames || memberNames.length < 6) return null;

  const sorted = memberNames.slice().sort().join("|");
  for (const f of searchFormationsData.formations) {
    if (f.m.slice().sort().join("|") === sorted) {
      return { stats: f.s, inen: f.i, ic: f.ic, formation: f.f };
    }
  }
  return null;
}

// =====================================================
// ユーティリティ
// =====================================================

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// =====================================================
// 更新トリガー
// =====================================================

let searchUpdateTimer = null;

function triggerSearchUpdate() {
  if (searchUpdateTimer) cancelAnimationFrame(searchUpdateTimer);

  // 件数が多い場合はフィルタ適用とテーブル描画が重い。スピナー未表示ならセット
  // （連続呼び出しでも innerHTML を書き換え直さないように冪等化）
  const container = document.getElementById("search-results");
  if (container && !container.querySelector(".spinner")) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">' +
      '<div class="spinner" style="margin:0 auto 16px;"></div>' +
      '<p style="color:#64748b;font-size:0.875rem;">陣法を検索中...</p></div>';
  }

  searchUpdateTimer = requestAnimationFrame(() => {
    setTimeout(() => {
      const results = applySearchFilters();
      renderSearchResults(results);
      const filters = getSearchFilterValues();
      renderKeymanPanel(filters.statIdx);
    }, 0);
  });
}

// =====================================================
// ステ下限パネル
// =====================================================

// 入力欄を横1行で動的生成
function buildMinInputs() {
  const row = document.getElementById("search-min-inputs-row");
  if (!row) return;
  row.innerHTML = "";
  SEARCH_STAT_SHORT.forEach((name, i) => {
    const div = document.createElement("div");
    div.className = "flex-shrink-0 flex flex-col items-center";
    div.style.minWidth = "52px";
    div.innerHTML = `
      <label class="text-[9px] leading-tight" style="color:var(--brand-neutral)">${name}</label>
      <input type="number" id="search-min-${i}" data-stat-idx="${i}"
             class="text-xs text-center border rounded px-1 py-1"
             style="border-color:var(--c-border-strong);width:52px"
             min="0" placeholder="&#x2014;">`;
    row.appendChild(div);
  });
}

// 現在の編成値を下限入力に一括設定
function autoFillMinThresholds() {
  const boosts = getCurrentBoosts();
  if (!boosts) {
    if (typeof window.showToast === "function") {
      window.showToast("編成に英傑が3体以上必要です", "warning");
    }
    return;
  }
  for (let i = 0; i < 11; i++) {
    const input = document.getElementById(`search-min-${i}`);
    if (input) input.value = boosts[i] || 0;
  }
  // 差分表示も自動ON
  const compareEl = document.getElementById("search-compare-current");
  if (compareEl && !compareEl.checked) compareEl.checked = true;
  expandedRowIdx = -1;
  triggerSearchUpdate();
}

// 全入力欄クリア
function resetMinThresholds() {
  for (let i = 0; i < 11; i++) {
    const input = document.getElementById(`search-min-${i}`);
    if (input) input.value = "";
  }
  expandedRowIdx = -1;
  triggerSearchUpdate();
}

// =====================================================
// 初期化
// =====================================================

let searchInitialized = false;

async function initFormationSearch() {
  if (searchInitialized) return;

  const data = await loadSearchFormations();
  if (!data) {
    const container = document.getElementById("search-results");
    if (container) {
      container.innerHTML = `<p class="text-sm text-red-400 p-4 text-center">陣法データの読み込みに失敗しました</p>`;
    }
    return;
  }

  searchInitialized = true;

  // ステ下限パネルの構築
  buildMinInputs();

  // 「今の編成より強い陣法を探す」ボタン
  const autoBtn = document.getElementById("search-min-auto");
  if (autoBtn) autoBtn.addEventListener("click", autoFillMinThresholds);

  // 条件クリアボタン
  const resetBtn = document.getElementById("search-min-reset");
  if (resetBtn) resetBtn.addEventListener("click", resetMinThresholds);

  // ステ下限入力の変更検知（debounce 300ms）
  let minTimer = null;
  const handleMinInput = () => {
    clearTimeout(minTimer);
    minTimer = setTimeout(() => {
      expandedRowIdx = -1;
      triggerSearchUpdate();
    }, 300);
  };
  document.getElementById("search-min-inputs-row")?.addEventListener("input", handleMinInput);

  // ステータス名マッピング（index → 日本語短縮名）
  const STAT_NAMES = ["生命", "気合", "腕力", "耐久", "器用", "知力", "魅力", "土", "水", "火", "風"];

  // フィルタイベント登録
  ["search-stat-filter", "search-reach-filter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        expandedRowIdx = -1; // 展開リセット
        triggerSearchUpdate();
        // ステータス重視の変更を他タブへ同期
        if (id === "search-stat-filter" && !window._statSyncInProgress) {
          const idx = parseInt(el.value);
          const stat = isNaN(idx) ? "" : (STAT_NAMES[idx] || "");
          window.dispatchEvent(new CustomEvent("stat-priority-changed", {
            detail: { stat, index: isNaN(idx) ? -1 : idx, source: "search" }
          }));
        }
      });
    }
  });

  // 「保有のみ」「差分」チェックボックス
  ["search-owned-filter", "search-compare-current"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        expandedRowIdx = -1;
        triggerSearchUpdate();
      });
    }
  });

  // 保有英傑件数の初期表示
  updateOwnedCountDisplay();

  // 初回描画（タブを開いた瞬間に全件テーブル表示）
  triggerSearchUpdate();
}

// タブ切替時に初期化
const origSwitchTab = window.switchFormationDbTab;
if (typeof origSwitchTab === "function") {
  window.switchFormationDbTab = function(tabName) {
    origSwitchTab(tabName);
    if (tabName === "search") {
      initFormationSearch();
    }
  };
} else {
  // switchFormationDbTabがまだ定義されていない場合は遅延登録
  document.addEventListener("DOMContentLoaded", () => {
    const origFn = window.switchFormationDbTab;
    if (typeof origFn === "function") {
      window.switchFormationDbTab = function(tabName) {
        origFn(tabName);
        if (tabName === "search") {
          initFormationSearch();
        }
      };
    }
  });
}

// 保有英傑の変更を検知して即座に再描画（タブ未初期化でも登録）
window.addEventListener("eiketsu-collection-changed", () => {
  if (searchInitialized) {
    triggerSearchUpdate();
  }
});

// =====================================================
// 保有英傑モーダル
// =====================================================

function updateOwnedCountDisplay() {
  // main.js の同名関数と共存するため、まず main.js 側の処理を実行
  if (window.collectionManager && typeof window.collectionManager.getOwnedCount === "function") {
    const ownedCount = window.collectionManager.getOwnedCount();
    const badge = document.getElementById("owned-count-badge");
    if (badge) {
      badge.textContent = `保有: ${ownedCount}体`;
      badge.style.transform = "scale(1.1)";
      setTimeout(() => { badge.style.transform = "scale(1)"; }, 200);
    }
    const displayElement = document.getElementById("collection-badge-formation-area");
    if (displayElement) displayElement.textContent = `${ownedCount}体保有`;
    const selectAllCheckbox = document.getElementById("select-all-owned");
    if (selectAllCheckbox) {
      const totalCheckboxes = document.querySelectorAll(".owned-checkbox").length;
      const checkedCheckboxes = document.querySelectorAll(".owned-checkbox:checked").length;
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
  // 陣法検索タブ・因縁マップタブの件数更新
  const count = window.collectionManager ? window.collectionManager.getOwnedList().length : 0;
  const el = document.getElementById("search-owned-count");
  if (el) el.textContent = count;
  const discEl = document.getElementById("discovery-owned-count");
  if (discEl) discEl.textContent = count;
  // 保有未登録案内の表示/非表示
  const guide = document.getElementById("search-owned-guide");
  if (guide) {
    if (count === 0) guide.classList.remove("hidden");
    else guide.classList.add("hidden");
  }
}

function updateCollectionModalCount() {
  const el = document.getElementById("collection-modal-count");
  if (el) {
    const count = window.collectionManager ? window.collectionManager.getOwnedList().length : 0;
    el.textContent = count;
  }
}

function openCollectionModal() {
  const modal = document.getElementById("collection-modal");
  const list = document.getElementById("collection-modal-list");
  if (!modal || !list) return;

  const eiketsuData = window.EIKETSU_DATA || [];
  const owned = new Set(window.collectionManager ? window.collectionManager.getOwnedList() : []);

  // フィルタードロップダウンの初期化
  _initCollectionFilters(eiketsuData);

  // リスト描画
  _renderCollectionList(eiketsuData, owned, list);

  // チェック変更イベント
  list.onclick = (e) => {
    const cb = e.target.closest("input[data-coll-name]");
    if (!cb) return;
    const name = cb.dataset.collName;
    if (name && window.collectionManager) {
      const wasOwned = window.collectionManager.hasEiketsu(name);
      window.collectionManager.toggleEiketsu(name);
      updateCollectionModalCount();
      updateOwnedCountDisplay();
      window.dispatchEvent(new CustomEvent("eiketsu-collection-changed", {
        detail: { name, owned: !wasOwned }
      }));
    }
  };

  // フィルター・検索のイベント登録
  const searchInput = document.getElementById("collection-search-input");
  if (searchInput) {
    searchInput.value = "";
    searchInput.oninput = () => _filterCollectionList(list);
  }
  ["coll-job-filter", "coll-cost-filter", "coll-factor-filter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.onchange = () => _filterCollectionList(list);
    }
  });
  // ソート変更 → リスト再構築
  const sortEl = document.getElementById("coll-sort");
  if (sortEl) {
    sortEl.value = "cost";
    sortEl.onchange = () => {
      const currentOwned = new Set(window.collectionManager ? window.collectionManager.getOwnedList() : []);
      _renderCollectionList(eiketsuData, currentOwned, list);
      _filterCollectionList(list);
    };
  }

  if (window.ModalManager) {
    window.ModalManager.open("collection-modal");
  } else {
    modal.classList.remove("hidden");
  }
  updateCollectionModalCount();
}

// フィルタードロップダウンの選択肢を動的生成
function _initCollectionFilters(eiketsuData) {
  // 職業ドロップダウン
  const jobFilter = document.getElementById("coll-job-filter");
  if (jobFilter && jobFilter.options.length <= 1) {
    const jobs = [...new Set(eiketsuData.map(e => e.job).filter(Boolean))].sort();
    jobs.forEach(j => {
      const opt = document.createElement("option");
      opt.value = j;
      opt.textContent = j;
      jobFilter.appendChild(opt);
    });
  }
  // 因子ドロップダウン
  const factorFilter = document.getElementById("coll-factor-filter");
  if (factorFilter && factorFilter.options.length <= 1) {
    const factors = new Set();
    eiketsuData.forEach(e => {
      if (e.factors) e.factors.forEach(f => { if (f && f !== "-") factors.add(f); });
    });
    [...factors].sort().forEach(f => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      factorFilter.appendChild(opt);
    });
  }
}

// リスト描画（ソート順を適用）
function _renderCollectionList(eiketsuData, owned, list) {
  const sortVal = document.getElementById("coll-sort")?.value || "cost";
  let sorted;
  if (sortVal === "name") {
    sorted = [...eiketsuData].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
  } else if (sortVal === "job") {
    sorted = [...eiketsuData].sort((a, b) => (a.job || "").localeCompare(b.job || "", "ja") || (b.cost || 0) - (a.cost || 0));
  } else {
    sorted = [...eiketsuData].sort((a, b) => (b.cost || 0) - (a.cost || 0));
  }

  list.innerHTML = "";
  sorted.forEach(e => {
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer";
    label.style.cssText = "transition:background 0.1s";
    label.onmouseover = () => { label.style.background = "var(--c-bg-alt)"; };
    label.onmouseout = () => { label.style.background = ""; };
    // data属性でフィルター用の情報を保持
    label.dataset.job = e.job || "";
    label.dataset.cost = e.cost || 0;
    label.dataset.factors = (e.factors || []).join(",");
    const isOwned = owned.has(e.name);
    const jobShort = e.job ? `<span class="text-xs" style="color:var(--brand-neutral)">${escapeHtml(e.job)}</span>` : "";
    label.innerHTML = `<input type="checkbox" class="rounded" data-coll-name="${escapeHtml(e.name)}" ${isOwned ? "checked" : ""} style="width:16px;height:16px;">
      <span class="text-sm" style="color:var(--c-text)">${escapeHtml(e.name)}</span>
      ${jobShort}
      <span class="text-xs ml-auto" style="color:var(--brand-neutral)">コスト${e.cost || "?"}</span>`;
    list.appendChild(label);
  });

  // チェック変更イベントは openCollectionModal で list.onclick に登録済み
}

// フィルター適用（AND条件）
function _filterCollectionList(list) {
  const q = (document.getElementById("collection-search-input")?.value || "").toLowerCase();
  const jobVal = document.getElementById("coll-job-filter")?.value || "";
  const costVal = document.getElementById("coll-cost-filter")?.value || "";
  const factorVal = document.getElementById("coll-factor-filter")?.value || "";

  list.querySelectorAll("label").forEach(l => {
    let show = true;
    // テキスト検索
    if (q && !l.textContent.toLowerCase().includes(q)) show = false;
    // 職業フィルター
    if (show && jobVal && l.dataset.job !== jobVal) show = false;
    // コストフィルター
    if (show && costVal) {
      const c = parseInt(l.dataset.cost);
      if (costVal === "4") { if (c > 4) show = false; }
      else { if (c !== parseInt(costVal)) show = false; }
    }
    // 因子フィルター
    if (show && factorVal && !(l.dataset.factors || "").includes(factorVal)) show = false;

    l.style.display = show ? "" : "none";
  });
}

function closeCollectionModal() {
  if (window.ModalManager) {
    window.ModalManager.close("collection-modal");
  } else {
    const modal = document.getElementById("collection-modal");
    if (modal) modal.classList.add("hidden");
  }
  // 検索結果を再描画（保有状態が変わった可能性）
  if (searchInitialized) triggerSearchUpdate();
}

// 表示中の英傑を一括選択
function selectVisibleCollection() {
  const list = document.getElementById("collection-modal-list");
  const mgr = window.collectionManager;
  if (!list || !mgr) return;
  const set = getOwnedSet(mgr);
  if (!set) return;
  let changed = false;
  list.querySelectorAll("label").forEach(l => {
    if (l.style.display === "none") return; // 非表示はスキップ
    const cb = l.querySelector("input[data-coll-name]");
    if (cb && !cb.checked) {
      cb.checked = true;
      if (cb.dataset.collName) { set.add(cb.dataset.collName); changed = true; }
    }
  });
  if (changed) {
    saveMgr(mgr);
    renderMgr(mgr);
    updateCollectionModalCount();
    updateOwnedCountDisplay();
    window.dispatchEvent(new CustomEvent("eiketsu-collection-changed", { detail: { bulk: true } }));
  }
}

// collectionManagerのSetプロパティを取得（バージョン差異を吸収）
function getOwnedSet(mgr) {
  return mgr.ownedEiketsu || mgr.owned || null;
}
function saveMgr(mgr) {
  if (typeof mgr.saveToStorage === "function") mgr.saveToStorage();
  else if (typeof mgr.updatePersistence === "function") mgr.updatePersistence();
}
function renderMgr(mgr) {
  if (typeof mgr.render === "function") mgr.render();
  else if (typeof mgr.updateAllUI === "function") mgr.updateAllUI();
}

// 一括選択
function selectAllCollection() {
  const list = document.getElementById("collection-modal-list");
  const mgr = window.collectionManager;
  if (!list || !mgr) return;
  const set = getOwnedSet(mgr);
  if (set) {
    list.querySelectorAll("input[data-coll-name]").forEach(cb => {
      cb.checked = true;
      if (cb.dataset.collName) set.add(cb.dataset.collName);
    });
    saveMgr(mgr);
    renderMgr(mgr);
  }
  updateCollectionModalCount();
  updateOwnedCountDisplay();
  window.dispatchEvent(new CustomEvent("eiketsu-collection-changed", { detail: { bulk: true } }));
}

// 一括解除
function clearAllCollection() {
  const mgr = window.collectionManager;
  if (!mgr) return;
  if (typeof mgr.clearAll === "function") {
    mgr.clearAll();
  } else if (typeof mgr.resetOwned === "function") {
    mgr.resetOwned();
  } else {
    const set = getOwnedSet(mgr);
    if (set) set.clear();
    saveMgr(mgr);
    renderMgr(mgr);
  }
  const list = document.getElementById("collection-modal-list");
  if (list) {
    list.querySelectorAll("input[data-coll-name]").forEach(cb => { cb.checked = false; });
  }
  updateCollectionModalCount();
  updateOwnedCountDisplay();
  window.dispatchEvent(new CustomEvent("eiketsu-collection-changed", { detail: { bulk: true } }));
}

// モーダルのボタンイベント（DOMContentLoaded後）
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search-open-collection")?.addEventListener("click", openCollectionModal);
  document.getElementById("collection-modal-close")?.addEventListener("click", closeCollectionModal);
  document.getElementById("collection-modal-done")?.addEventListener("click", closeCollectionModal);
  document.getElementById("collection-select-all")?.addEventListener("click", selectAllCollection);
  document.getElementById("collection-clear-all")?.addEventListener("click", clearAllCollection);
  // 「表示中を全選択」ボタン
  document.getElementById("coll-select-visible")?.addEventListener("click", selectVisibleCollection);
  // 背景クリックで閉じる
  document.getElementById("collection-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "collection-modal") closeCollectionModal();
  });
});

// 保有英傑変更イベントで件数更新
window.addEventListener("eiketsu-collection-changed", () => {
  updateOwnedCountDisplay();
});

// ステータス重視の同期受信（陣法例タブからの変更を反映）
window.addEventListener("stat-priority-changed", (e) => {
  if (e.detail?.source === "search") return; // 自分が発火したものは無視
  const statFilter = document.getElementById("search-stat-filter");
  if (!statFilter) return;
  window._statSyncInProgress = true;
  statFilter.value = e.detail.index >= 0 ? String(e.detail.index) : "";
  if (searchInitialized) {
    expandedRowIdx = -1;
    triggerSearchUpdate();
  }
  window._statSyncInProgress = false;
});

// グローバル公開
window.initFormationSearch = initFormationSearch;
window.lookupFormationStats = lookupFormationStats;
window.loadSearchFormations = loadSearchFormations;
window.openCollectionModal = openCollectionModal;
