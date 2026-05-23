/**
 * =====================================================
 * 英傑陣法シミュレーター - 使用ログ (usage-logger.js)
 * =====================================================
 *
 * main.js から分離（2026-03-21）
 * 使用データのログ送信・ページビュー追跡を担当。
 * コア計算には一切影響しない。
 *
 * 依存:
 *   - window.selectedEiketsu（グローバル）
 *   - window.getCurrentFormationValue()（main.js）
 *   - window.getCurrentActivatedInens()（main.js）
 *   - window.calculateAllBoosts()（main.js）
 */

// =====================================================
// 使用データログ
// =====================================================

// 使用データをログに送信
async function logUsage(action, additionalData = {}) {
  try {
    const eiketsuNames = selectedEiketsu
      .filter((s) => s && s.eiketsu)
      .map((s) => s.eiketsu.name);

    const data = {
      action: action,
      formation: getCurrentFormationValue(),
      eiketsu: eiketsuNames,
      inen_count:
        typeof getCurrentActivatedInens === "function"
          ? getCurrentActivatedInens().length
          : 0,
      ...additionalData,
    };

    await fetch("log_usage.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (error) {
    // ログ送信エラーは無視（ユーザー体験に影響しない）
    console.debug("Usage log error:", error);
  }
}

// 英傑選択時にログ（個別選択の追跡）
let lastSelectedEiketsu = "";
function logEiketsuSelection(eiketsuName) {
  if (eiketsuName && eiketsuName !== lastSelectedEiketsu) {
    lastSelectedEiketsu = eiketsuName;
    logUsage("eiketsu_select", { selected_eiketsu: eiketsuName });
  }
}

// 編成完了時にログを送信（6人選択時）- stat_boosts/inen_list込み
let lastLoggedTeam = "";
function logTeamIfComplete() {
  const filledSlots = selectedEiketsu.filter((s) => s && s.eiketsu).length;
  if (filledSlots === 6) {
    const teamKey = selectedEiketsu
      .filter((s) => s && s.eiketsu)
      .map((s) => s.eiketsu.name)
      .sort()
      .join(",");

    // 同じ編成は重複してログしない
    if (teamKey !== lastLoggedTeam) {
      lastLoggedTeam = teamKey;

      // stat_boosts と inen_list をサーバーに送信
      const additionalData = {};
      try {
        if (typeof calculateAllBoosts === "function") {
          const { inenBoosts, formationBoosts } = calculateAllBoosts();
          const stats = [
            "生命",
            "気合",
            "腕力",
            "耐久",
            "器用",
            "知力",
            "魅力",
            "土",
            "水",
            "火",
            "風",
          ];
          const statBoosts = {};
          stats.forEach((stat) => {
            const total = Math.floor(
              (inenBoosts[stat] || 0) + (formationBoosts[stat] || 0),
            );
            if (total > 0) statBoosts[stat] = total;
          });
          additionalData.stat_boosts = statBoosts;
        }
        if (typeof getCurrentActivatedInens === "function") {
          additionalData.inen_list = getCurrentActivatedInens().map(
            (r) => r.inen?.name || r.name || "",
          );
        }
      } catch (e) {
        console.debug("stat_boosts calculation error:", e);
      }

      logUsage("team_complete", additionalData);
    }
  }
}

// 陣形変更時にログ
function logFormationChange(formationType) {
  logUsage("formation_change", { new_formation: formationType });
}

// updateAll完了後にログを追加（モンキーパッチ廃止→CustomEvent方式 2026/02/11）
document.addEventListener("updateAllComplete", () => {
  setTimeout(logTeamIfComplete, 100);
});

// 陣形変更イベントにログを追加
setTimeout(() => {
  const formationSelect = document.getElementById("formation-select");
  if (formationSelect) {
    formationSelect.addEventListener("change", (e) => {
      logFormationChange(e.target.value);
    });
  }
}, 3000);

// トレンドデータを取得
async function fetchUsageTrends(type = "summary", period = "week") {
  try {
    const response = await fetch(`log_usage.php?type=${type}&period=${period}`);
    return await response.json();
  } catch (error) {
    console.error("Trend fetch error:", error);
    return null;
  }
}

// ページ閲覧ログ（初回のみ）
let pageViewLogged = false;
function logPageView() {
  if (pageViewLogged) return;
  pageViewLogged = true;

  fetch("log_usage.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "page_view",
      formation: null,
      eiketsu: [],
      inen_count: 0,
    }),
  })
    .then(() => {})
    .catch((err) => {
      console.debug("ログエラー:", err);
    });
}

// グローバル公開
window.logUsage = logUsage;
window.logEiketsuSelection = logEiketsuSelection;
window.fetchUsageTrends = fetchUsageTrends;
window.logPageView = logPageView;
