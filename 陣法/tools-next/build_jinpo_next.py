#!/usr/bin/env python3
from __future__ import annotations
import csv, json, sys, hashlib, gzip, struct, subprocess, shutil, tempfile, re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source-next' / '英傑一覧.csv'
SITE = ROOT / 'jinpo-next'
MASTER = SITE / 'data' / 'jinpo_eiketsu_master.csv'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'build_report.json'
OVERRIDES = ROOT / 'tools-next' / 'approved_overrides.json'

REQUIRED = [
    '番号','コスト','名前','育成技能1:(0凸)','育成技能2:(0凸)','育成技能3:(0凸)',
    '生命','気合','腕力','耐久','器用','知力','魅力','土','水','火','風',
    '因子1(特化)','因子2(2凸)','因子3(LV20)','因子4(文曲)'
]
MAP = {
    'コスト':'コスト','育成技能1':'育成技能1:(0凸)','育成技能2':'育成技能2:(0凸)','育成技能3':'育成技能3:(0凸)',
    '生命':'生命','気合':'気合','腕力':'腕力','耐久力':'耐久','器用さ':'器用','知力':'知力','魅力':'魅力',
    '土属性':'土','水属性':'水','火属性':'火','風属性':'風',
    '因子1':'因子1(特化)','因子2':'因子2(2凸)','因子3':'因子3(LV20)','因子4':'因子4(文曲)'
}

def read_csv(path: Path):
    raw = path.read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError as e:
        raise RuntimeError(f'{path}: UTF-8で読めません: {e}')
    if '\ufffd' in text:
        raise RuntimeError(f'{path}: 置換文字 U+FFFD を検出')
    rows = list(csv.DictReader(text.splitlines()))
    return rows, list(rows[0].keys()) if rows else []

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()

def fail(msg: str, report: dict):
    report['status'] = 'FAIL'
    report.setdefault('errors', []).append(msg)
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('ERROR:', msg, file=sys.stderr)
    sys.exit(1)

def main():
    report = {
        'phase': 'phase1-safe-staging',
        'status': 'CHECKING',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'source': str(SOURCE.relative_to(ROOT)),
        'site': str(SITE.relative_to(ROOT)),
        'errors': [],
        'warnings': []
    }
    if not SOURCE.exists(): fail('source-next/英傑一覧.csv がありません', report)
    if not MASTER.exists(): fail('jinpo-next/data/jinpo_eiketsu_master.csv がありません', report)

    source_rows, source_headers = read_csv(SOURCE)
    master_rows, _ = read_csv(MASTER)

    # 承認済みの既知誤記だけを自動補正する。条件が完全一致した場合のみ適用。
    applied_overrides = []
    if OVERRIDES.exists():
        ov = json.loads(OVERRIDES.read_text(encoding='utf-8'))
        name_seen = {}
        for r in source_rows:
            name = str(r.get('名前','')).strip()
            name_seen[name] = name_seen.get(name, 0) + 1
            occ = name_seen[name]
            for item in ov.get('rows', []):
                if str(item.get('name','')).strip() != name or int(item.get('occurrence',1)) != occ:
                    continue
                fld = str(item.get('source_field','')).strip()
                before = str(r.get(fld,'')).strip()
                expected = str(item.get('source_value','')).strip()
                canonical = str(item.get('canonical_value','')).strip()
                if before == expected:
                    r[fld] = canonical
                    applied_overrides.append({
                        'name': name, 'occurrence': occ, 'field': fld,
                        'from': before, 'to': canonical, 'reason': item.get('reason','')
                    })
                elif before != canonical:
                    fail(f'承認済み補正の前提値と一致しません: {name} {fld}={before}', report)
        report['applied_overrides'] = applied_overrides
    missing = [h for h in REQUIRED if h not in source_headers]
    if missing: fail('英傑一覧の必須列不足: ' + ', '.join(missing), report)

    nums = [str(r.get('番号','')).strip() for r in source_rows]
    names = [str(r.get('名前','')).strip() for r in source_rows]
    if any(not x for x in nums): fail('番号が空の行があります', report)
    if any(not x for x in names): fail('名前が空の行があります', report)
    if len(nums) != len(set(nums)): fail('英傑一覧の番号重複を検出', report)
    # 同名英傑は実データ上存在するため、名前だけを主キーにはしない。
    # 同名内の出現順を含む occurrence key で既存行を対応させる。
    def occurrence_map(rows, name_field):
        counts = {}
        out = {}
        for r in rows:
            name = str(r.get(name_field,'')).strip()
            if not name:
                continue
            counts[name] = counts.get(name, 0) + 1
            out[(name, counts[name])] = r
        return out

    by_master = occurrence_map(master_rows, '英傑名')
    by_source = occurrence_map(source_rows, '名前')
    new_keys = sorted(set(by_source) - set(by_master))
    removed_keys = sorted(set(by_master) - set(by_source))
    new_names = [f'{n}#{i}' if i > 1 else n for n,i in new_keys]
    removed_names = [f'{n}#{i}' if i > 1 else n for n,i in removed_keys]
    changed = []
    for key in sorted(set(by_source) & set(by_master)):
        name, occurrence = key
        s, m = by_source[key], by_master[key]
        diffs = []
        for mc, sc in MAP.items():
            mv, sv = str(m.get(mc,'')).strip(), str(s.get(sc,'')).strip()
            # Current master uses 対象外 while source may use blank for factor slots.
            if mc in ('因子2','因子3','因子4') and mv == '対象外' and sv == '':
                continue
            if mv != sv:
                diffs.append({'field': mc, 'master': mv, 'source': sv})
        if diffs:
            changed.append({'name': name, 'occurrence': occurrence, 'diffs': diffs})

    report.update({
        'source_rows': len(source_rows),
        'master_rows': len(master_rows),
        'new_heroes': new_names,
        'removed_heroes': removed_names,
        'changed_existing': changed,
        'source_sha256': sha256(SOURCE),
        'master_sha256': sha256(MASTER),
    })

    # Phase 1 is deliberately fail-safe: existing-data changes or new heroes do not publish until
    # the combination generator is connected in Phase 2.
    if removed_names:
        fail('既存英傑の削除を検出。自動公開を停止します: ' + ' / '.join(removed_names[:10]), report)
    if changed:
        fail('既存英傑の値変更を検出。誤字等を勝手に上書きしないため停止します。', report)
    if new_names:
        fail('新英傑を検出しました。Phase 2の組み合わせ再生成エンジン接続前なので安全停止します: ' + ' / '.join(new_names), report)

    # Static-site integrity checks for staging.
    required_site = [
        SITE/'index.html', SITE/'jinpo-fast-search.js', SITE/'jinpo-fast-search-worker.js', SITE/'jinpo-activation-engine.js', SITE/'jinpo-bond-list.js',
        SITE/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
    ]
    for p in required_site:
        if not p.exists(): fail('新陣法の必須ファイル不足: ' + str(p.relative_to(ROOT)), report)

    # Top500正式運用の整合性。初期表示用/単一優先ソート用は全件DBから事前生成した最大500件のみ。
    manifest_path = SITE/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

    # 通常5・6因縁は等級3以下ON専用の画面仕様であり、旧通常DBは不正データを含んでいたため完全廃止。
    # manifest参照だけでなく物理ファイルの残存も公開前に拒否する。
    for section in ('datasets', 'top', 'sort_top'):
        normal_counts = manifest.get(section, {}).get('normal', {})
        for count in ('5', '6'):
            if count in normal_counts:
                fail(f'廃止済み通常{count}因縁DBがmanifestに残っています: {section}/normal/{count}', report)
    legacy_normal56_files = sorted(
        x.name for x in (SITE/'data'/'compact_search_v2').glob('*.bin.gz')
        if ('normal_c5_' in x.name or 'normal_c6_' in x.name)
    )
    if legacy_normal56_files:
        fail('廃止済み通常5・6因縁DBの物理ファイルが残っています: ' + ' / '.join(legacy_normal56_files[:10]), report)

    if int(manifest.get('top_limit', 0)) != 500 or int(manifest.get('sort_top_limit', 0)) != 500:
        fail('Top500設定不一致: manifest top_limit/sort_top_limit が500ではありません', report)
    for mode, counts in manifest.get('top', {}).items():
        for count, forms in counts.items():
            for formation, info in forms.items():
                full = manifest.get('datasets', {}).get(mode, {}).get(count, {}).get(formation, {})
                expected = min(500, int(full.get('rows', 0)))
                if int(info.get('rows', -1)) != expected:
                    fail(f'Top500件数不一致: {mode}/{count}/{formation} {info.get("rows")} != {expected}', report)
    for mode, counts in manifest.get('sort_top', {}).items():
        for count, forms in counts.items():
            for formation, stats in forms.items():
                full = manifest.get('datasets', {}).get(mode, {}).get(count, {}).get(formation, {})
                expected = min(500, int(full.get('rows', 0)))
                for stat, info in stats.items():
                    if int(info.get('rows', -1)) != expected:
                        fail(f'SortTop500件数不一致: {mode}/{count}/{formation}/{stat} {info.get("rows")} != {expected}', report)
    report['top_limit'] = 500

    # 過去ログで確定したUI/検索仕様の回帰ガード。
    # 新方式ではTop300・300件上限・旧CSV検索経路を復活させない。
    index_text = (SITE/'index.html').read_text(encoding='utf-8')
    fast_text = (SITE/'jinpo-fast-search.js').read_text(encoding='utf-8')
    worker_text = (SITE/'jinpo-fast-search-worker.js').read_text(encoding='utf-8')
    activation_text = (SITE/'jinpo-activation-engine.js').read_text(encoding='utf-8')
    bond_list_text = (SITE/'jinpo-bond-list.js').read_text(encoding='utf-8')

    forbidden_fragments = {
        'index.html': [
            'DB_LIST_MAX = 300', 'DB_LIST_MAX=300', 'Top300', 'top300',
            'jinpo_result_db_', 'factor4_usage_index.json', 'data-linegen-', '__jinpoLineGen', '__jinpoActualLineRows',
            'confirm(' , 'window.confirm('
        ],
        'jinpo-fast-search.js': [
            'LIMIT=300', 'LIMIT = 300', 'Top300', 'top300', 'jinpo_result_db_',
            "label.insertAdjacentElement('afterend',note)"
        ],
        'jinpo-fast-search-worker.js': [
            'q.limit||300', 'q.limit || 300', 'Top300', 'top300', 'jinpo_result_db_'
        ],
    }
    texts = {
        'index.html': index_text,
        'jinpo-fast-search.js': fast_text,
        'jinpo-fast-search-worker.js': worker_text,
        'jinpo-activation-engine.js': activation_text,
        'jinpo-bond-list.js': bond_list_text,
    }
    for name, fragments in forbidden_fragments.items():
        for frag in fragments:
            if frag in texts[name]:
                fail(f'旧方式/300件制限の残骸を検出: {name}: {frag}', report)

    required_fast_fragments = [
        'var LIMIT=500',
        'ステータスのみ選択時は高い順で表示します',
        '検索結果は各ステータスで並べ替えできます',
        'jinpoResultHitValue',
        'jinpoResultShownValue',
        'data-list-sort',
        'jinpoSortActive',
        "listSort.dir==='desc'?'asc':'desc'",
        "listSort={key:key,dir:'desc'}",
        'font-size:15px;font-weight:950',
        '.jinpoStat-life{color:#ffffff',
        '.jinpoStat-ki{color:#cfefff',
        '.jinpoStat-str{color:#ff7777',
        '.jinpoStat-vit{color:#70a0ff',
        '.jinpoStat-dex{color:#75d28d',
        '.jinpoStat-int{color:#fff083',
        '.jinpoStat-cha{color:#c88fe8',
        '.jinpoStat-earth{color:#fff1a8',
        '.jinpoStat-water{color:#73d7f3',
        '.jinpoStat-fire{color:#f3a0a0',
        '.jinpoStat-wind{color:#a8e2a6',
        '.jinpoStatSortButton.jinpoSortActive,#dbFormationList .jinpoStatCell.jinpoSortActive',
        '.jinpoPriorityTitleRow{display:flex !important',
        "titleRow.appendChild(label)",
        "titleRow.appendChild(note)",
        "function stableRowKey(row)",
        "appliedListRowKey=stableRowKey(row)",
        "jinpoAppliedRow",
        "(isApplied?'適用中':'適用')",
        'data-hero-internal-id',
    ]
    for frag in required_fast_fragments:
        if frag not in fast_text:
            fail(f'確定済み500件/UI仕様が欠落: jinpo-fast-search.js: {frag}', report)

    required_worker_fragments = [
        'q.limit||500', 'Top500正式運用', '_heroNameToIds', 'ownedInternalIds',
        'eiketsu_internal_ids:internalIds.join', "d.type==='lookupExact'",
        'function lookupExact(q,token)', 'function exactBondIds(names,m)', "cache:'no-cache'",
        'function normalFiveSixUnsupported(q)', "reason:'normal_5_6_not_supported'"
    ]
    for frag in required_worker_fragments:
        if frag not in worker_text:
            fail(f'Top500/内部ID/完全照合 Worker仕様が欠落: jinpo-fast-search-worker.js: {frag}', report)
    if '_heroNameToId=' in worker_text or '_heroNameToId =' in worker_text:
        fail('同名英傑を1IDへ潰す旧Workerマップを検出', report)

    required_function_fragments = {
        'jinpo-fast-search.js': [
            'function ownedInternalIds()', 'ownedInternalIds:ownIds', 'function lookupExactState(opts)',
            'worker.terminate()', "(c===5||c===6)&&!gradeOn()",
            'selectedExclude=0;syncFactor4()', 'eiketsu_internal_ids||',
            'resetAll:function()', "listSort={key:'',dir:'desc'};appliedListRowKey=''",
        ],
        'index.html': [
            'function sameReachInternalIdSet', 'function sameReachBondSet',
            'function dbRowMatchesReachState', 'function lookupReachSwapExactDbRow',
            'dbRowMatchesReachState(row,placement,liveResult',
            'function buildHeroInternalIdLookup', 'internalIds.length === 6',
            '同名英傑が複数いるため、名前よりinternal_idを必ず優先する',
            '所持英傑はinternal_idを正とする。同名別個体を名前でまとめない',
            "+'@@g3='+(grade3On66()?'1':'0')+'@@owned='",
            "+'@@excluded='+excluded.join(',')",
            "(!grade3||hCost(h)<=6)", '__jinpoGetExcludedHeroes',
            'source:"current_result_db_exact"', 'if(modern) return null;',
            'if(stat === "生命" || stat === "気合") return [20000,18000,16000,14000,12000,10000,8000,6000];',
            'return [1600,1400,1200,1000,800,600,400,200];',
            'function findHeroByInternalId', 'heroFactor4IdentityKey', 'data-hero-internal-id',
            'Number(a.heroIndex) === rel', 'function activatedLinesText(act)',
            'return lookupPromise;', 'swapApplySeq=0', 'Promise.resolve(ret).catch',
            'if(applySeq===swapApplySeq) hideSwapLoading()',
            'function bonusHeroInternalId(hero)', 'function bonusRowInternalIds(row)',
            'function bonusHeroByInternalId(id)', "if(ret && typeof ret.then==='function')",
            'id="jinpoGlobalResetBtn"', 'window.__jinpoAskYesNo=function(opts)',
            'window.__jinpoPerformGlobalReset=performGlobalReset', 'window.__jinpoClearExcludedHeroes = function(opts)',
            'window.__jinpoResetEiketsuBonusAll = function(opts)', 'いいえ</button><button type="button" id="jinpoCommonConfirmYes"',
        ],
        'jinpo-activation-engine.js': [
            'const activatedOccurrences = [];', 'const activatedByName = new Map();',
            'occurrences:[occurrence]', 'activated: activatedFlat', 'activatedOccurrences', 'heroInternalId:',
        ],
    }
    for name, fragments in required_function_fragments.items():
        for frag in fragments:
            if frag not in texts[name]:
                fail(f'検索/適用/差替の確定済み回帰ガード欠落: {name}: {frag}', report)

    # 現在発動中因縁は、現在の陣形図と成立位置を同じ大型モーダルで確認できること。
    # 因縁カードのホバー/フォーカス/タップで、対応ラインと配置枠を強調する。
    required_bond_modal_fragments = [
        'ACTIVE_FORMATION_VIEW', 'function liveFormationSlotPositions()', 'function activeFormationConfig()',
        'function currentCalculatedResult()', 'act.occurrences', 'function renderFormationDiagram()',
        'jinpoBondActiveLayout', 'jinpoBondFormationDiagram', 'jinpoBondDiagramLine.is-hover',
        'data-line-ids', '成立ライン ', 'function setDiagramHighlight', 'function bindActiveCardHighlight()',
        '現在の陣形図', '右の因縁にカーソルを合わせると対応ラインが光ります'
    ]
    for frag in required_bond_modal_fragments:
        if frag not in bond_list_text:
            fail(f'発動中因縁モーダルの陣形図/ライン強調仕様が欠落: jinpo-bond-list.js: {frag}', report)
    report['active_bond_modal_guard'] = {
        'formation_diagram': True,
        'live_slot_position_sync': True,
        'line_hover_highlight': True,
        'multi_occurrence_lines': True,
    }

    # 見聞録の職業判定は、過去に確定した通り英傑マスタ「職業」列を直接見る。
    hero_job_match = re.search(r'function\s+heroJob\s*\(hero\)\s*\{(?P<body>.*?)\n\s*\}', index_text, re.S)
    if not hero_job_match:
        fail('見聞録のheroJob関数が見つかりません', report)
    hero_job_body = hero_job_match.group('body')
    if "hero['職業']" not in hero_job_body or "hero['因子1']" in hero_job_body:
        fail('見聞録の職業判定が英傑マスタ「職業」列直接参照ではありません', report)

    report['regression_guards'] = {
        'top300_removed': True,
        'limit_500': True,
        'hit_and_shown_count_ui': True,
        'list_sort_ui': True,
        'list_sort_desc_asc_toggle': True,
        'stat_colors_and_active_column_glow': True,
        'stat_font_enlarged': True,
        'priority_notice_next_to_each_heading': True,
        'applied_row_glow_survives_list_sort': True,
        'legacy_csv_search_refs_removed': True,
        'legacy_linegen_search_refs_removed': True,
        'duplicate_name_internal_id_search': True,
        'owned_hero_internal_id_priority': True,
        'exact_bond_set_db_match': True,
        'full_db_exact_lookup_after_swap': True,
        'stale_async_swap_lookup_rejected': True,
        'swap_cache_tracks_grade_owned_excluded': True,
        'grade3_swap_cost_guard': True,
        'excluded_swap_guard': True,
        'search_cancel_terminates_worker': True,
        'factor4_reset': True,
        'priority_threshold_values_match_visible_buttons': True,
        'factor4_duplicate_name_uses_internal_id': True,
        'unique_bond_count_with_line_occurrences_preserved': True,
        'manifest_fetch_fresh_before_versioned_db_cache': True,
        'normal_5_6_worker_access_blocked': True,
        'legacy_normal_5_6_manifest_and_files_removed': True,
        'factor4_assignment_uses_line_hero_index': True,
        'swap_loading_waits_for_exact_lookup': True,
        'swap_loading_stale_completion_guard': True,
        'bonus_fallback_internal_id_first': True,
        'bonus_recalc_after_exact_lookup': True,
        'kenbun_job_uses_master_job_column_directly': True,
        'global_reset_button_and_state_reset': True,
        'all_yes_no_confirmations_use_common_modal': True,
        'native_confirm_removed': True,
    }

    # 文字化け/UTF-8/CSV/JSONを毎回自動検査する。
    text_exts = {'.html','.js','.json','.csv','.txt','.md','.py','.yml','.yaml'}
    mojibake_markers = ['\ufffd','縺','繧','蜿','譁','莠','Ã','Â','ΘÖúµ│ò']
    text_checked = 0
    csv_checked = 0
    json_checked = 0
    for base_dir in (SITE, ROOT/'source-next', ROOT/'tools-next'):
        if not base_dir.exists():
            continue
        for p in base_dir.rglob('*'):
            if not p.is_file() or p.suffix.lower() not in text_exts:
                continue
            if p.resolve() == Path(__file__).resolve():
                continue
            try:
                text = p.read_text(encoding='utf-8-sig')
            except UnicodeDecodeError as e:
                fail(f'UTF-8不正: {p.relative_to(ROOT)}: {e}', report)
            text_checked += 1
            hits = [m for m in mojibake_markers if m in text]
            if hits:
                fail(f'文字化け疑い: {p.relative_to(ROOT)}: {" / ".join(hits)}', report)
            if p.suffix.lower() == '.json':
                try:
                    json.loads(text)
                except Exception as e:
                    fail(f'JSON構文エラー: {p.relative_to(ROOT)}: {e}', report)
                json_checked += 1
            if p.suffix.lower() == '.csv':
                try:
                    rows = list(csv.reader(text.splitlines()))
                except Exception as e:
                    fail(f'CSV構文エラー: {p.relative_to(ROOT)}: {e}', report)
                if rows:
                    width = len(rows[0])
                    for lineno, row in enumerate(rows[1:], 2):
                        if len(row) != width:
                            fail(f'CSV列数崩れ: {p.relative_to(ROOT)}:{lineno} {len(row)}列 != {width}列', report)
                csv_checked += 1
    report['encoding_structure_checks'] = {
        'text_files': text_checked,
        'json_files': json_checked,
        'csv_files': csv_checked,
        'mojibake': 0,
        'utf8_errors': 0,
        'csv_column_errors': 0,
        'json_errors': 0,
    }

    # compact DBをmanifestと突き合わせる。件数・magic・record size・gzipハッシュを検査。
    compact_checked = 0
    seen_compact = set()
    # Current master IDs are sparse by design; compact numeric hero ID is the numeric part of internal_id.
    master_id_to_row = {}
    for r in master_rows:
        iid = str(r.get('internal_id','')).strip()
        mm = re.fullmatch(r'EIK_(\d+)', iid, flags=re.I)
        if not mm:
            fail(f'英傑マスタ internal_id 形式不正: {iid}', report)
        hid = int(mm.group(1))
        if hid in master_id_to_row:
            fail(f'英傑マスタ internal_id 重複: {iid}', report)
        master_id_to_row[hid] = r
    hero_names_manifest = manifest.get('hero_names', [])
    for hid, r in master_id_to_row.items():
        if hid >= len(hero_names_manifest):
            fail(f'compact manifestに英傑IDがありません: EIK_{hid:04d}', report)
        expected_name = str(r.get('英傑名','')).strip()
        if str(hero_names_manifest[hid] or '').strip() != expected_name:
            fail(f'compact hero_names/internal_id対応不一致: EIK_{hid:04d} {expected_name} != {hero_names_manifest[hid]}', report)
    name_counts = {}
    for r in master_rows:
        n = str(r.get('英傑名','')).strip()
        name_counts[n] = name_counts.get(n, 0) + 1
    duplicate_display_names = sorted(n for n,c in name_counts.items() if n and c > 1)

    semantic_records = 0
    semantic_duplicate_combos = 0

    def verify_compact_entry(info, label, semantic=None):
        nonlocal compact_checked, semantic_records, semantic_duplicate_combos
        if not isinstance(info, dict) or not info.get('file'):
            fail(f'compact DB manifest不正: {label}', report)
        rel = str(info['file'])
        if rel in seen_compact:
            return
        seen_compact.add(rel)
        path = SITE / rel
        if not path.exists():
            fail(f'compact DB参照切れ: {label}: {rel}', report)
        gz = path.read_bytes()
        if info.get('gzip_bytes') is not None and len(gz) != int(info['gzip_bytes']):
            fail(f'compact DB gzipサイズ不一致: {label}: {rel}', report)
        if info.get('sha256_16') and hashlib.sha256(gz).hexdigest()[:16] != str(info['sha256_16']):
            fail(f'compact DB SHA不一致: {label}: {rel}', report)
        try:
            raw = gzip.decompress(gz)
        except Exception as e:
            fail(f'compact DB gzip破損: {label}: {rel}: {e}', report)
        if len(raw) < 16 or raw[:4] != b'JCF1':
            fail(f'compact DB magic不一致: {label}: {rel}', report)
        rec = struct.unpack_from('<H', raw, 6)[0]
        if rec != int(manifest.get('record_size', 52)):
            fail(f'compact DB record size不一致: {label}: {rel}: {rec}', report)
        if (len(raw)-16) % rec:
            fail(f'compact DB body長不正: {label}: {rel}', report)
        rows = (len(raw)-16)//rec
        if rows != int(info.get('rows', -1)):
            fail(f'compact DB件数不一致: {label}: {rel}: {rows} != {info.get("rows")}', report)
        header_rows = struct.unpack_from('<I', raw, 8)[0]
        if header_rows != rows:
            fail(f'compact DBヘッダー件数不一致: {label}: {rel}: header={header_rows} body={rows}', report)
        if info.get('raw_bytes') is not None and len(raw) != int(info['raw_bytes']):
            fail(f'compact DB rawサイズ不一致: {label}: {rel}', report)

        if semantic is not None:
            mode, count, formation = semantic
            count = int(count)
            seen = set()
            for idx in range(rows):
                off = 16 + idx * rec
                hero_ids = struct.unpack_from('<6H', raw, off)
                if len(set(hero_ids)) != 6:
                    fail(f'compact DB 1編成内の英傑重複: {label}: row={idx}', report)
                active_bonds = tuple(raw[off+12:off+12+count])
                rest_bonds = raw[off+12+count:off+21]
                if any(b == 0 for b in active_bonds) or len(set(active_bonds)) != count:
                    fail(f'compact DB 発動因縁の欠損/重複: {label}: row={idx}', report)
                if any(rest_bonds):
                    fail(f'compact DB 因縁余剰スロット不正: {label}: row={idx}', report)
                for b in active_bonds:
                    if b >= len(manifest.get('bond_names', [])):
                        fail(f'compact DB 因縁ID範囲外: {label}: row={idx}: {b}', report)
                f4 = raw[off+47]
                if f4 > 6:
                    fail(f'compact DB 文曲使用数不正: {label}: row={idx}: {f4}', report)
                for hid in hero_ids:
                    if hid >= len(hero_names_manifest) or not str(hero_names_manifest[hid] or '').strip():
                        fail(f'compact DB 英傑ID範囲外/名称なし: {label}: row={idx}: {hid}', report)
                    if hid not in master_id_to_row:
                        fail(f'compact DBに英傑マスタ未登録ID: {label}: row={idx}: EIK_{hid:04d}', report)
                    elif mode == 'grade3':
                        cost = int(float(str(master_id_to_row[hid].get('コスト','999') or '999')))
                        if cost > 6:
                            fail(f'等級3以下DBにコスト7以上を検出: {label}: row={idx}: EIK_{hid:04d} cost={cost}', report)
                combo_key = struct.pack('<6H', *sorted(hero_ids)) + bytes(sorted(active_bonds))
                if combo_key in seen:
                    semantic_duplicate_combos += 1
                    fail(f'正しい重複定義でcompact DB重複: {label}: row={idx}', report)
                seen.add(combo_key)
            semantic_records += rows
        compact_checked += 1

    for mode, counts in manifest.get('datasets', {}).items():
        for count, forms in counts.items():
            for formation, info in forms.items():
                verify_compact_entry(info, f'datasets/{mode}/{count}/{formation}', (mode, count, formation))
    for mode, counts in manifest.get('top', {}).items():
        for count, forms in counts.items():
            for formation, info in forms.items():
                verify_compact_entry(info, f'top/{mode}/{count}/{formation}')
    for mode, counts in manifest.get('sort_top', {}).items():
        for count, forms in counts.items():
            for formation, stats in forms.items():
                for stat, info in stats.items():
                    verify_compact_entry(info, f'sort_top/{mode}/{count}/{formation}/{stat}')
    report['compact_integrity'] = {
        'files': compact_checked, 'errors': 0,
        'full_records_semantic_checked': semantic_records,
        'duplicate_combo_errors': semantic_duplicate_combos,
        'duplicate_display_names_kept_distinct_by_internal_id': duplicate_display_names,
        'legacy_normal_5_6_removed': True,
        'header_row_count_errors': 0,
    }


    rebuild_top_path = ROOT/'tools-next'/'rebuild_top500.py'
    if rebuild_top_path.exists():
        rebuild_top_text = rebuild_top_path.read_text(encoding='utf-8')
        for frag in ["fingerprint=hashlib.sha256", "m['version']='unified-v2-top500-'+fingerprint", 'LIMIT = 500']:
            if frag not in rebuild_top_text:
                fail(f'Top500再生成のcache version自動更新仕様が欠落: {frag}', report)
        report['top500_rebuild_cache_version_guard'] = True

    # 検索可能な全件DBについて、実際の発動因縁集合/文曲人数とDB記録を全件照合。
    # さらに全件DBからTop500/単一優先Top500を独立再計算し、内容と順序まで一致させる。
    integrity_audit = ROOT/'tools-next'/'audit_search_integrity.py'
    if not integrity_audit.exists():
        fail('検索DB全件監査スクリプトがありません: tools-next/audit_search_integrity.py', report)
    cp = subprocess.run([sys.executable, str(integrity_audit)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('検索DB全件監査FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    audit_report_path = REPORT_DIR/'search_integrity_report.json'
    if not audit_report_path.exists():
        fail('検索DB全件監査レポートが生成されませんでした', report)
    audit_report = json.loads(audit_report_path.read_text(encoding='utf-8'))
    if audit_report.get('status') != 'PASS':
        fail('検索DB全件監査レポートがPASSではありません', report)
    report['search_integrity_audit'] = {
        'accessible_full_records': audit_report.get('accessible_full_records'),
        'bondset_errors': audit_report.get('bondset_errors'),
        'factor4_errors': audit_report.get('factor4_errors'),
        'top_files_exact': audit_report.get('top_files_exact'),
        'sort_top_files_exact': audit_report.get('sort_top_files_exact'),
        'seconds': audit_report.get('seconds'),
    }

    # JS構文をGitHub Actions上でも検査。外部JSとindex.html内のinline scriptを対象にする。
    node = shutil.which('node')
    if not node:
        fail('node が見つからないためJS構文検査を実行できません', report)
    js_checked = 0
    for p in SITE.rglob('*.js'):
        cp = subprocess.run([node, '--check', str(p)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if cp.returncode != 0:
            fail(f'JavaScript構文エラー: {p.relative_to(ROOT)}: {cp.stderr.strip()}', report)
        js_checked += 1
    inline_scripts = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', index_text, flags=re.S|re.I)
    with tempfile.TemporaryDirectory() as td:
        for i, code in enumerate(inline_scripts):
            tmp = Path(td)/f'inline_{i:03d}.js'
            tmp.write_text(code, encoding='utf-8')
            cp = subprocess.run([node, '--check', str(tmp)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if cp.returncode != 0:
                fail(f'index.html inline JavaScript構文エラー #{i}: {cp.stderr.strip()}', report)
    report['javascript_syntax'] = {'external_js': js_checked, 'inline_scripts': len(inline_scripts), 'errors': 0}

    # 5/6因縁は既存仕様どおり、陣形選択済みでも等級3以下OFFなら無効のまま固定。
    grade_lock_fragment = 'if((c === 5 || c === 6) && formed && !grade3On()) return true;'
    if grade_lock_fragment not in index_text:
        fail('5/6因縁の等級3以下ON限定ロックが欠落', report)
    report['grade3_5_6_lock'] = True

    too_large = []
    site_files = [p for p in SITE.rglob('*') if p.is_file()]
    for p in site_files:
        if p.stat().st_size > 25_000_000:
            too_large.append({'file': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size})
    if too_large:
        report['too_large'] = too_large
        fail('25MB超過ファイルを検出', report)
    max_file = max(site_files, key=lambda x: x.stat().st_size) if site_files else None
    report['file_size_check'] = {
        'over_25mb': 0,
        'max_file': str(max_file.relative_to(ROOT)) if max_file else '',
        'max_bytes': max_file.stat().st_size if max_file else 0,
    }

    report['status'] = 'PASS'
    report['message'] = 'Phase 1: 現行384英傑と一致。/jinpo-next/ の安全な別入口を公開可能。'
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
