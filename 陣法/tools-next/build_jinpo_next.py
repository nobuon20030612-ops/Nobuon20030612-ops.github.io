#!/usr/bin/env python3
from __future__ import annotations
import csv, json, sys, hashlib, gzip, struct, subprocess, shutil, tempfile, re, os
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source-next' / '英傑一覧.csv'
SITE = ROOT
MASTER = SITE / 'data' / 'jinpo_eiketsu_master.csv'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'build_report.json'
PROVENANCE_AUDIT = ROOT / 'tools-next' / 'audit_source_provenance.py'
TAIRANO_SPEC_AUDIT = ROOT / 'tools-next' / 'audit_tairano_spec.py'

REQUIRED = [
    '番号','コスト','名前','読み','育成技能1:(0凸)','育成技能2:(0凸)','育成技能3:(0凸)',
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

def last_added_hero_from_summary(summary: dict) -> str:
    """Return the current explicit last-added hero field."""
    if not isinstance(summary, dict):
        return ''
    return str(summary.get('last_added_hero', '')).strip()


def write_latest_update_summary(summary_path: Path, new_infos: list, changed_infos: list, generation: dict, updated_at: str | None = None):
    """Update date for a real hero-list change, but change added-hero text only for true new registrations."""
    previous_summary = {}
    if summary_path.exists():
        try:
            previous_summary = json.loads(summary_path.read_text(encoding='utf-8'))
        except Exception:
            previous_summary = {}

    previous_last_added = last_added_hero_from_summary(previous_summary)
    last_added_hero = previous_last_added
    if new_infos:
        # sync_eiketsu_master.py emits new_heroes in source-number order; the final item is the latest addition.
        last_added_hero = str(new_infos[-1].get('英傑名', '')).strip() or previous_last_added

    if not (new_infos or changed_infos):
        return False, previous_last_added

    if updated_at is None:
        from zoneinfo import ZoneInfo
        updated_at = datetime.now(ZoneInfo('Asia/Tokyo')).strftime('%Y-%m-%d')

    update_summary = {
        'schema': 'jinpo-next-phase2-auto-update/v2',
        'source_file': 'source-next/英傑一覧.csv',
        'updated_at': updated_at,
        'last_added_hero': last_added_hero,
        'new_registration_only': bool(new_infos) and not changed_infos,
        'new_heroes': new_infos,
        'changed_existing': changed_infos,
        'generation': generation,
        'note': '英傑一覧.csvと現行正本から英傑マスタ・5～9因縁compact DB・Top500を完全再生成',
    }
    summary_path.write_text(json.dumps(update_summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return True, last_added_hero

def main():
    report = {
        'phase': 'phase2-auto-regeneration',
        'status': 'CHECKING',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'source': str(SOURCE.relative_to(ROOT)),
        'site': str(SITE.relative_to(ROOT)),
        'errors': [],
        'warnings': []
    }
    if not SOURCE.exists(): fail('source-next/英傑一覧.csv がありません', report)
    if not MASTER.exists(): fail('陣法/data/jinpo_eiketsu_master.csv がありません', report)

    # Critical invariant guard: validate against an independent user-confirmed oracle BEFORE regeneration.
    # Do not rely only on components that share formation_spec.py; that would allow circular validation.
    if not TAIRANO_SPEC_AUDIT.exists(): fail('たいらの式独立正本監査がありません', report)
    cp = subprocess.run([sys.executable, str(TAIRANO_SPEC_AUDIT)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('たいらの式独立正本監査FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    tairano_report_path = REPORT_DIR/'tairano_spec_report.json'
    if not tairano_report_path.exists(): fail('たいらの式独立正本監査レポートがありません', report)
    tairano_report = json.loads(tairano_report_path.read_text(encoding='utf-8'))
    if tairano_report.get('status') != 'PASS' or tairano_report.get('independent_canonical_line_oracle') is not True:
        fail('たいらの式独立正本監査が独立オラクルPASSではありません', report)
    report['independent_formation_oracle_prebuild'] = True

    # 出典列は検索計算に使わない研究メタデータだが、スロット誤記を将来追跡できるよう
    # standalone buildでも必ず監査する。Actionsでは直前の専用stepを再利用する。
    provenance_report_path = REPORT_DIR / 'source_provenance_report.json'
    provenance_ready = os.environ.get('JINPO_PROVENANCE_AUDIT_READY') == '1'
    if not provenance_ready:
        if not PROVENANCE_AUDIT.exists(): fail('英傑一覧の出典監査スクリプトがありません', report)
        cp = subprocess.run([sys.executable, str(PROVENANCE_AUDIT)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if cp.returncode != 0:
            fail('英傑一覧の出典監査FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    if not provenance_report_path.exists(): fail('英傑一覧の出典監査レポートがありません', report)
    provenance_report = json.loads(provenance_report_path.read_text(encoding='utf-8'))
    if provenance_report.get('status') != 'PASS': fail('英傑一覧の出典監査レポートがPASSではありません', report)
    report['source_provenance_audit'] = 'workflow-pre-audit' if provenance_ready else 'build-standalone-audit'

    # GitHub Actionsでは直前の同期レポートをそのまま利用する。
    # 単体実行時だけこのスクリプト内で同期する。
    sync_report_path = REPORT_DIR/'master_sync.json'
    sync_ready = os.environ.get('JINPO_MASTER_SYNC_READY') == '1'
    if not sync_ready:
        sync_script = ROOT/'tools-next'/'sync_eiketsu_master.py'
        if not sync_script.exists(): fail('Phase2英傑マスタ同期スクリプトがありません', report)
        cp = subprocess.run([sys.executable, str(sync_script)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if cp.returncode != 0:
            fail('英傑マスタ自動同期FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    if not sync_report_path.exists(): fail('英傑マスタ同期レポートがありません', report)
    sync_report = json.loads(sync_report_path.read_text(encoding='utf-8'))
    if sync_report.get('status') != 'PASS': fail('英傑マスタ同期レポートがPASSではありません', report)
    if sync_ready:
        report['master_sync_source'] = 'workflow-pre-sync'
    else:
        report['master_sync_source'] = 'build-standalone-sync'

    source_rows, source_headers = read_csv(SOURCE)
    master_rows, _ = read_csv(MASTER)

    missing = [h for h in REQUIRED if h not in source_headers]
    if missing: fail('英傑一覧の必須列不足: ' + ', '.join(missing), report)

    nums = [str(r.get('番号','')).strip() for r in source_rows]
    names = [str(r.get('名前','')).strip() for r in source_rows]
    if any(not x for x in nums): fail('番号が空の行があります', report)
    if any(not x for x in names): fail('名前が空の行があります', report)
    if len(nums) != len(set(nums)): fail('英傑一覧の番号重複を検出', report)
    # 番号↔internal_id対応表を現行識別の正本とする。

    report.update({
        'source_rows_input': sync_report.get('source_rows_input', len(source_rows)),
        'source_rows': sync_report.get('source_rows', len(source_rows)),
        'master_rows': len(master_rows),
        'new_heroes': sync_report.get('new_heroes', []),
        'removed_heroes': sync_report.get('removed_heroes', []),
        'changed_existing': sync_report.get('changed_existing', []),
        'dirty_internal_ids': sync_report.get('dirty_internal_ids', []),
        'id_map_entries': sync_report.get('id_map_entries'),
        'source_sha256': sha256(SOURCE),
        'master_sha256': sha256(MASTER),
    })

    # たいらの式: 現行正本から毎回完全再生成する。
    generator = ROOT/'tools-next'/'rebuild_all_compact.py'
    if not generator.exists(): fail('完全再生成スクリプトがありません', report)
    cp = subprocess.run([sys.executable, str(generator)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('5～9因縁 完全再生成FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    generation_report_path = REPORT_DIR/'generation_report.json'
    if not generation_report_path.exists(): fail('組み合わせ生成レポートがありません', report)
    generation_report = json.loads(generation_report_path.read_text(encoding='utf-8'))
    if generation_report.get('status') != 'PASS': fail('組み合わせ生成レポートがPASSではありません', report)
    if generation_report.get('source_of_truth_only') is not True:
        fail('完全再生成が現行正本限定になっていません', report)
    report['generation'] = {
        'full_records': generation_report.get('full_records'),
        'seconds': generation_report.get('seconds'),
        'full_regeneration': True,
        'generation_mode': 'full_current_source_only',
        'source_of_truth_only': True,
    }

    # 全等級5・6因縁専用索引も同じ英傑マスタ・因縁マスタから毎回完全再生成する。
    bond56_builder = ROOT/'tools-next'/'build_bond56_index.py'
    if not bond56_builder.exists(): fail('全等級5・6因縁索引生成スクリプトがありません', report)
    cp = subprocess.run([sys.executable, str(bond56_builder)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('全等級5・6因縁索引 完全再生成FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    try:
        bond56_report = json.loads((cp.stdout.strip().splitlines() or ['{}'])[-1])
    except Exception as e:
        fail('全等級5・6因縁索引生成レポート解析FAIL: ' + str(e), report)
    if bond56_report.get('status') != 'PASS':
        fail('全等級5・6因縁索引生成がPASSではありません', report)
    report['bond56_generation'] = {
        'version': bond56_report.get('version'),
        'heroes': bond56_report.get('heroes'),
        'bonds': bond56_report.get('bonds'),
        'files': len(bond56_report.get('files') or {}),
        'full_regeneration': True,
        'source_of_truth_only': True,
    }

    # Independent completeness audits must not be optional. These catch common-mode failures
    # where generator and ordinary integrity audit agree on the same wrong combination universe.
    b56_independent = ROOT/'tools-next'/'audit_bond56_index_independent.py'
    if not b56_independent.exists(): fail('5・6因縁独立完全性監査がありません', report)
    cp = subprocess.run([sys.executable, str(b56_independent)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('5・6因縁独立完全性監査FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    b56_independent_report_path = REPORT_DIR/'bond56_index_independent_audit.json'
    if not b56_independent_report_path.exists(): fail('5・6因縁独立完全性監査レポートがありません', report)
    b56_independent_report = json.loads(b56_independent_report_path.read_text(encoding='utf-8'))
    if b56_independent_report.get('status') != 'PASS' or int(b56_independent_report.get('errors') or 0) != 0:
        fail('5・6因縁独立完全性監査がPASS/0errorsではありません', report)
    report['bond56_independent_completeness'] = {
        'errors': b56_independent_report.get('errors'),
        'cross_implementation': b56_independent_report.get('cross_implementation'),
        'skeletons': b56_independent_report.get('skeletons'),
    }

    combo_independent = ROOT/'tools-next'/'audit_combination_completeness_independent.py'
    if not combo_independent.exists(): fail('5～9因縁組み合わせ独立完全性監査がありません', report)
    cp = subprocess.run([sys.executable, str(combo_independent)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('5～9因縁組み合わせ独立完全性監査FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    combo_independent_report_path = REPORT_DIR/'combination_completeness_independent.json'
    if not combo_independent_report_path.exists(): fail('5～9因縁組み合わせ独立完全性監査レポートがありません', report)
    combo_independent_report = json.loads(combo_independent_report_path.read_text(encoding='utf-8'))
    if combo_independent_report.get('status') != 'PASS' or int(combo_independent_report.get('total_mismatch') or 0) != 0:
        fail('5～9因縁組み合わせ独立完全性監査がPASS/0 mismatchではありません', report)
    report['combination_independent_completeness'] = {
        'datasets': len(combo_independent_report.get('datasets') or {}),
        'total_mismatch': combo_independent_report.get('total_mismatch'),
        'all_hero_count': combo_independent_report.get('all_hero_count'),
        'grade3_hero_count': combo_independent_report.get('grade3_hero_count'),
    }

    rebuild_top = ROOT/'tools-next'/'rebuild_top500.py'
    cp = subprocess.run([sys.executable, str(rebuild_top)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('Top500/優先Top500再生成FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)

    rebuild_recommend_sum = ROOT/'tools-next'/'rebuild_recommend_sum_top.py'
    if not rebuild_recommend_sum.exists(): fail('おすすめ陣法合計Top500再生成スクリプトがありません', report)
    cp = subprocess.run([sys.executable, str(rebuild_recommend_sum)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('おすすめ陣法 第1＋第2合計Top500再生成FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    recommend_report_path = REPORT_DIR/'recommend_sum_top_report.json'
    if not recommend_report_path.exists(): fail('おすすめ陣法合計Top500レポートがありません', report)
    recommend_report = json.loads(recommend_report_path.read_text(encoding='utf-8'))
    if recommend_report.get('status') != 'PASS': fail('おすすめ陣法合計Top500レポートがPASSではありません', report)
    report['recommend_sum_top'] = {'files':recommend_report.get('files'),'rows':recommend_report.get('rows'),'limit_per_formation':recommend_report.get('limit_per_formation'),'seconds':recommend_report.get('seconds')}

    rebuild_fullmax = ROOT/'tools-next'/'rebuild_fullmax_search.py'
    if not rebuild_fullmax.exists(): fail('全MAX検索DB生成スクリプトがありません', report)
    cp = subprocess.run([sys.executable, str(rebuild_fullmax)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('全MAX込み合計検索DB再生成FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    fullmax_report_path = REPORT_DIR/'fullmax_search_report.json'
    if not fullmax_report_path.exists(): fail('全MAX検索DBレポートがありません', report)
    fullmax_report = json.loads(fullmax_report_path.read_text(encoding='utf-8'))
    if fullmax_report.get('status') != 'PASS': fail('全MAX検索DBレポートがPASSではありません', report)
    report['fullmax_search'] = {
        'full_records': fullmax_report.get('full_records'),
        'recommend_files': fullmax_report.get('recommend_files'),
        'recommend_rows': fullmax_report.get('recommend_rows'),
        'seconds': fullmax_report.get('seconds'),
    }

    # ヘッダー表示:
    # - 最終更新日は、英傑一覧に実変更があった更新日に変更してよい。
    # - 「追加英傑」は最後に本当に追加された1人だけを保持し、既存英傑修正やDB整備では変更しない。
    new_infos = sync_report.get('new_heroes', [])
    changed_infos = sync_report.get('changed_existing', [])
    summary_path = SITE/'data'/'jinpo_latest_update_summary.json'
    summary_updated, last_added_hero = write_latest_update_summary(
        summary_path, new_infos, changed_infos, report['generation']
    )
    report['latest_update_summary_updated'] = summary_updated
    report['last_added_hero'] = last_added_hero

    # Static-site integrity checks for staging.
    required_site = [
        SITE/'jinpo.html', SITE/'jinpo-fast-search.js', SITE/'jinpo-fast-search-worker.js', SITE/'jinpo-activation-engine.js',
        SITE/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
    ]
    for p in required_site:
        if not p.exists(): fail('新陣法の必須ファイル不足: ' + str(p.relative_to(ROOT)), report)

    # Top500正式運用の整合性。初期表示用/単一優先ソート用は全件DBから事前生成した最大500件のみ。
    manifest_path = SITE/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

    # 現行検索モードごとの因縁数を固定する。
    expected_counts = {'normal': {'7','8','9'}, 'grade3': {'5','6','7','8','9'}}
    for section in ('datasets', 'top', 'sort_top'):
        for mode, expected in expected_counts.items():
            actual = set(manifest.get(section, {}).get(mode, {}).keys())
            if actual != expected:
                fail(f'現行因縁数構成不一致: {section}/{mode}: {sorted(actual)}', report)

    if int(manifest.get('top_limit', 0)) != 500 or int(manifest.get('sort_top_limit', 0)) != 500:
        fail('Top500設定不一致: manifest top_limit/sort_top_limit が500ではありません', report)
    if int(manifest.get('recommend_sum_top_limit', 0)) != 500 or int(manifest.get('recommend_sum_top_record_size', 0)) != 54:
        fail('おすすめ合計Top500設定不一致', report)
    recommend_stats = ['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
    recommend_files = 0
    for mode in ('normal','grade3'):
        for primary in recommend_stats:
            for secondary in recommend_stats:
                if secondary == primary: continue
                info = manifest.get('recommend_sum_top', {}).get(mode, {}).get(primary, {}).get(secondary)
                if not info: fail(f'おすすめ合計Top500不足: {mode}/{primary}/{secondary}', report)
                fp = SITE / str(info.get('file',''))
                if not fp.exists(): fail(f'おすすめ合計Top500ファイル不足: {fp.relative_to(ROOT)}', report)
                gz = fp.read_bytes()
                if hashlib.sha256(gz).hexdigest()[:16] != str(info.get('sha256_16','')): fail(f'おすすめ合計Top500 SHA不一致: {fp.relative_to(ROOT)}', report)
                try: raw = gzip.decompress(gz)
                except Exception as e: fail(f'おすすめ合計Top500 gzip不正: {fp.relative_to(ROOT)}: {e}', report)
                if len(raw) < 16 or raw[:4] != b'JRS1': fail(f'おすすめ合計Top500 magic不一致: {fp.relative_to(ROOT)}', report)
                rec = struct.unpack_from('<H', raw, 6)[0]; rows = struct.unpack_from('<I', raw, 8)[0]
                if rec != 54 or rows != int(info.get('rows', -1)) or len(raw) != 16 + rows * rec: fail(f'おすすめ合計Top500構造不一致: {fp.relative_to(ROOT)}', report)
                if rows > 4 * 500: fail(f'おすすめ合計Top500件数超過: {fp.relative_to(ROOT)} rows={rows}', report)
                recommend_files += 1
    report['recommend_sum_top_integrity'] = {'files':recommend_files,'errors':0}
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
    index_text = (SITE/'jinpo.html').read_text(encoding='utf-8')
    fast_text = (SITE/'jinpo-fast-search.js').read_text(encoding='utf-8')
    worker_text = (SITE/'jinpo-fast-search-worker.js').read_text(encoding='utf-8')
    activation_text = (SITE/'jinpo-activation-engine.js').read_text(encoding='utf-8')
    bond_list_text = (SITE/'jinpo-bond-list.js').read_text(encoding='utf-8')

    forbidden_fragments = {
        'jinpo.html': [
            'DB_LIST_MAX = 300', 'DB_LIST_MAX=300', 'Top300', 'top300',
            'jinpo_result_db_', 'factor4_usage_index.json', 'data-linegen-', '__jinpoLineGen', '__jinpoActualLineRows',
            'confirm(', 'window.confirm(', 'alert(', 'window.alert(', 'prompt(', 'window.prompt('
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
        'jinpo.html': index_text,
        'jinpo-fast-search.js': fast_text,
        'jinpo-fast-search-worker.js': worker_text,
        'jinpo-activation-engine.js': activation_text,
        'jinpo-bond-list.js': bond_list_text,
    }
    for name, fragments in forbidden_fragments.items():
        for frag in fragments:
            if frag in texts[name]:
                fail(f'禁止仕様/旧方式の残骸を検出: {name}: {frag}', report)

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
        "var recommendState={active:false,targetStat:'',secondaryStat:'',formation:''",
        'function searchRecommended(query)',
        'function prepareRecommendPriority(target,clearSecond)',
        'excludedInternalIds:exIds',
        'recommendModeLocked',
    ]
    for frag in required_fast_fragments:
        if frag not in fast_text:
            fail(f'確定済み500件/UI仕様が欠落: jinpo-fast-search.js: {frag}', report)

    required_worker_fragments = [
        'q.limit||500', 'Top500正式運用', 'ownedInternalIds', 'excludedInternalIds',
        'eiketsu_internal_ids:internalIds.join', "d.type==='lookupExact'",
        'function lookupExact(q,token)', 'function exactBondIds(names,m)', "cache:'no-store'",
        'for(var h=0;h<heroIds.length&&heroOk;h++)if(dv.getUint16(base+h*2,true)!==heroIds[h])heroOk=false',
        'function normalFiveSixUnsupported(q)', "reason:'normal_5_6_not_supported'"
    ]
    for frag in required_worker_fragments:
        if frag not in worker_text:
            fail(f'Top500/内部ID/完全照合 Worker仕様が欠落: jinpo-fast-search-worker.js: {frag}', report)
    if '_heroNameToId=' in worker_text or '_heroNameToId =' in worker_text:
        fail('同名英傑を1IDへ潰す旧Workerマップを検出', report)
    bond56_worker_text=(SITE/'jinpo-bond56-worker.js').read_text(encoding='utf-8')
    for frag in ['semanticComboKey', 'heapSemantic:new Map()', 'matchedSemantic:new Set()', 'async function countHits', "d.type==='countHits'", '__hitCap']:
        if frag not in bond56_worker_text:
            fail(f'全等級5・6因縁Workerの重複排除/10万件打切り件数仕様が欠落: {frag}', report)
    if 'excludedNames:ex' in fast_text or 'excludedNameSet66' in index_text:
        fail('除外英傑の名前基準検索/差替判定が残っています。internal_id基準へ統一してください', report)

    required_function_fragments = {
        'jinpo-fast-search.js': [
            'function ownedInternalIds()', 'ownedInternalIds:ownIds', 'function excludedInternalIds()', 'excludedInternalIds:exIds', 'function lookupExactState(opts)',
            'worker.terminate()', "(c===5||c===6)&&!gradeOn()",
            'selectedExclude=0;syncFactor4()', 'eiketsu_internal_ids||',
            'resetAll:function()', "listSort={key:'',dir:'desc'};appliedListRowKey=''",
        ],
        'jinpo.html': [
            'function sameReachInternalIdOrder', 'function sameReachBondSet',
            'function dbRowMatchesReachState', 'function lookupReachSwapExactDbRow',
            'const currentIds=[1,2,3,4,5,6].map(s=>String(placement[s]?.internal_id || "").trim()).join("|")',
            'const lookupIds=[1,2,3,4,5,6].map(s=>String(nextPlacement[s]?.internal_id || "").trim()).join("|")',
            'dbRowMatchesReachState(row,placement,liveResult',
            'function buildHeroInternalIdLookup', 'internalIds.length !== 6',
            '同名英傑が複数いるため、名前よりinternal_idを必ず優先する',
            'function ownedHeroReachLockState()', 'const ids = new Set();',
            "+'@@g3='+(grade3On66()?'1':'0')+'@@owned='",
            "+'@@excluded='+excluded.join(',')",
            "(!grade3||hCost(h)<=6)", '__jinpoGetExcludedHeroInternalIds', 'function excludedIdSet66',
            'source:"current_result_db_exact"', 'function lookupReachSwapExactDbRow',
            'if(stat === "生命" || stat === "気合") return [20000,18000,16000,14000,12000,10000,8000,6000];',
            'return [1600,1400,1200,1000,800,600,400,200];',
            'function findHeroByInternalId', 'heroFactor4IdentityKey', 'data-hero-internal-id',
            'Number(a.heroIndex) === rel', 'function activatedLinesText(act)',
            'return lookupPromise;', 'swapApplySeq=0', 'Promise.resolve(ret).catch',
            'function bonusHeroInternalId(hero)', 'function bonusRowInternalIds(row)',
            'function bonusHeroByInternalId(id)',
            'id="jinpoGlobalResetBtn"', 'window.__jinpoAskYesNo=function(opts)',
            'window.__jinpoPerformGlobalReset=performGlobalReset', 'window.__jinpoClearExcludedHeroes = function(opts)',
            "jinpo_excluded_hero_internal_ids_v2", 'window.__jinpoGetExcludedHeroInternalIds = getList',
            'window.__jinpoResetEiketsuBonusAll = function(opts)', 'いいえ</button><button type="button" id="jinpoCommonConfirmYes"',
            'id="eiketsuKishinsekiGlobalMaxBtn"', 'window.__jinpoApplyGlobalAllMax = applyGlobalAllMaxPreset',
            'id="eiketsuKishinsekiGlobalMaxClearBtn"', 'window.__jinpoClearGlobalAllMax = clearGlobalAllMaxPreset',
            'function syncGlobalAllMaxForCurrentPlacement', '全MAX中', '鬼神石MAX：生命・気合 17,000／その他 2,500', '転生MAX：全てLv30（文曲除く）',
        ],
        'jinpo-activation-engine.js': [
            'const activatedOccurrences = [];', 'const activatedByName = new Map();',
            'occurrences:[occurrence]', 'activated: activatedFlat', 'activatedOccurrences', 'factor4Slots: factor4Plan.slots.slice()', 'chooseMinimalFactor4Plan', 'heroInternalId:',
        ],
        'jinpo-bond-list.js': [
            'jinpoRecommendNav', 'おすすめ陣法', 'jinpoRecommendExitBtn',
            'jinpoRecommendModeBadge', 'jinpoRecommendModeNotice', 'jinpoRecommendSumGuide',
            'jinpoScrollTopBtn', '上へ戻る',
            'おすすめモード中は5〜9因縁の通常検索は使用できません',
            '※第1・第2優先の数値条件を指定すると、その条件に応じて検索結果も変わります',
            "['生命','生命'],['気合','気合'],['腕力','腕力'],['耐久力','耐久'],['器用さ','器用'],['知力','知力']",
            "['魅力','魅力'],['土属性','土'],['水属性','水'],['火属性','火'],['風属性','風']",
        ],
    }
    # 差替まわりは、過去のソース文字列そのものではなく安全条件を監査する。
    # 空白・改行の変更では止めないが、世代/トークン/非同期完了待ちのいずれかが欠けたら停止する。
    def guard_section(start_pattern: str, end_pattern: str, label: str) -> str:
        start = re.search(start_pattern, index_text, re.S)
        if not start:
            fail(f'{label}: 開始位置が見つかりません', report)
        end = re.search(end_pattern, index_text[start.end():], re.S)
        if not end:
            fail(f'{label}: 終了位置が見つかりません', report)
        return index_text[start.start():start.end() + end.start()]

    swap_loading_section = guard_section(
        r'function\s+showSwapLoading\s*\(\s*\)',
        r'function\s+openModal\s*\(\s*slot\s*\)',
        '差替ローディング安全監査',
    )
    swap_apply_section = guard_section(
        r'function\s+applyCandidate\s*\(\s*id\s*\)',
        r'function\s+schedule\s*\(\s*delay\s*\)',
        '差替適用安全監査',
    )

    loading_patterns = [
        (r'token\s*=\s*\+\+swapLoadingVisualSeq\s*;', '表示トークンの世代更新'),
        (r'loadingToken\s*=\s*String\s*\(\s*token\s*\)', '表示トークンの保存'),
        (r'function\s+hideSwapLoading\s*\(\s*token\s*\)', 'トークン指定の解除関数'),
    ]
    for pattern, label in loading_patterns:
        if not re.search(pattern, swap_loading_section, re.S):
            fail(f'差替ローディング安全監査: {label}が欠落', report)

    stale_token_pattern = re.compile(
        r'if\s*\(\s*token\s*&&\s*String\s*\(\s*el\.dataset\.loadingToken\s*\|\|\s*[\"\']{2}\s*\)'
        r'\s*!==\s*String\s*\(\s*token\s*\)\s*\)\s*return\s*;',
        re.S,
    )
    if len(stale_token_pattern.findall(swap_loading_section)) < 2:
        fail('差替ローディング安全監査: 古い表示トークンの即時/遅延拒否が不足', report)

    apply_patterns = [
        (r'applySeq\s*=\s*\+\+swapApplySeq\s*;', '差替世代の更新'),
        (r'loadingToken\s*=\s*showSwapLoading\s*\(\s*\)\s*;', '表示トークンの取得'),
        (r'combinedPromise\s*=\s*window\.__jinpoLastCombinedRefreshPromise\s*\|\|\s*null', '込み合計更新Promiseの取得'),
        (r'Promise\.resolve\s*\(\s*ret\s*\)', '差替本体の完了待ち'),
        (r'Promise\.resolve\s*\(\s*combinedPromise\s*\)', '込み合計更新の完了待ち'),
        (r'if\s*\(\s*applySeq\s*===\s*swapApplySeq\s*\)\s*hideSwapLoading\s*\(\s*loadingToken\s*\)', '最新世代＋同一トークンでの解除'),
    ]
    apply_positions = []
    for pattern, label in apply_patterns:
        match = re.search(pattern, swap_apply_section, re.S)
        if not match:
            fail(f'差替適用安全監査: {label}が欠落', report)
        apply_positions.append(match.start())
    if apply_positions != sorted(apply_positions) or len(set(apply_positions)) != len(apply_positions):
        fail('差替適用安全監査: 世代更新→差替完了→込み合計完了→表示解除の順序が崩れています', report)

    # 旧「registered hit preview」ラッパーは廃止済み。
    # 現行は applyReachSwapCandidate 自体が現在6人を再計算し、全件DB完全照合Promiseを返す。
    # 上の差替適用安全監査と required_function_fragments の return lookupPromise で監査する。

    for name, fragments in required_function_fragments.items():
        for frag in fragments:
            if frag not in texts[name]:
                fail(f'検索/適用/差替の確定済み回帰ガード欠落: {name}: {frag}', report)

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
        'compact_search_only': True,
        'current_generation_path_only': True,
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
        'current_mode_count_sets_exact': True,
        'factor4_assignment_uses_line_hero_index': True,
        'factor4_global_minimum_plan': True,
        'swap_loading_waits_for_exact_lookup': True,
        'swap_loading_stale_completion_guard': True,
        'swap_loading_token_generation_guard': True,
        'bonus_internal_id_exact': True,
        'bonus_recalc_after_exact_lookup': True,
        'kenbun_job_uses_master_job_column_directly': True,
        'global_reset_button_and_state_reset': True,
        'all_yes_no_confirmations_use_common_modal': True,
        'native_confirm_removed': True,
        'recommend_mode_ui_guarded': True,
        'recommend_mode_count_lock_guarded': True,
        'recommend_priority_sync_guarded': True,
        'recommend_scroll_top_guarded': True,
        'excluded_hero_internal_id_guarded': True,
    }

    # 文字化け/UTF-8/CSV/JSONを毎回自動検査する。
    text_exts = {'.html','.js','.json','.csv','.txt','.md','.py','.yml','.yaml'}
    mojibake_markers = ['\ufffd','\u7e3a','\u7e67','\u873f','\u8b41','\u83a0','\u00c3','\u00c2','\u0398\u00d6\u00fa\u00b5\u2502\u00f2']
    text_checked = 0
    csv_checked = 0
    json_checked = 0
    for base_dir in (SITE, ROOT/'source-next', ROOT/'tools-next'):
        if not base_dir.exists():
            continue
        for p in base_dir.rglob('*'):
            if not p.is_file() or p.suffix.lower() not in text_exts:
                continue
            # 一時監査レポートは過去実行の診断情報であり、現行ソース判定には混ぜない。
            if '_jinpo-next-report' in p.parts:
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
                # 全件意味/構造監査は直後の audit_search_integrity.py に統合。
                # ここではgzip/SHA/magic/record size/件数/manifest整合性を検査する。
                verify_compact_entry(info, f'datasets/{mode}/{count}/{formation}')
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
        'current_mode_count_sets_exact': True,
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
    if audit_report.get('independent_canonical_oracle_errors') != 0:
        fail('独立オラクル全件監査が0件ではありません: ' + str(audit_report.get('independent_canonical_oracle_errors')), report)
    if not audit_report.get('independent_canonical_lines_zero'):
        fail('独立オラクル全件監査の正本ライン記録がありません', report)
    report['compact_integrity']['full_records_semantic_checked'] = int(audit_report.get('accessible_full_records') or 0)
    report['compact_integrity']['duplicate_combo_errors'] = int(audit_report.get('duplicate_combo_errors') or 0)
    report['compact_integrity']['row_structure_errors'] = int(audit_report.get('row_structure_errors') or 0)
    report['compact_integrity']['grade3_cost_errors'] = int(audit_report.get('grade3_cost_errors') or 0)
    report['search_integrity_audit'] = {
        'accessible_full_records': audit_report.get('accessible_full_records'),
        'row_structure_errors': audit_report.get('row_structure_errors'),
        'duplicate_combo_errors': audit_report.get('duplicate_combo_errors'),
        'grade3_cost_errors': audit_report.get('grade3_cost_errors'),
        'bondset_errors': audit_report.get('bondset_errors'),
        'independent_canonical_oracle_errors': audit_report.get('independent_canonical_oracle_errors'),
        'independent_canonical_lines_zero': audit_report.get('independent_canonical_lines_zero'),
        'factor4_errors': audit_report.get('factor4_errors'),
        'fullmax_errors': audit_report.get('fullmax_errors'),
        'fullmax_records_checked': audit_report.get('fullmax_records_checked'),
        'top_files_exact': audit_report.get('top_files_exact'),
        'sort_top_files_exact': audit_report.get('sort_top_files_exact'),
        'seconds': audit_report.get('seconds'),
    }

    # 全MAX込み検索sidecarは直前の検索DB全件監査で数値再計算済み。ここではsidecar対応とおすすめTopの構造・順序・参照元payloadを独立照合する。
    fullmax_audit = ROOT/'tools-next'/'audit_fullmax_search.py'
    if not fullmax_audit.exists():
        fail('全MAX検索DB監査スクリプトがありません: tools-next/audit_fullmax_search.py', report)
    cp = subprocess.run([sys.executable, str(fullmax_audit)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail('全MAX検索DB全件監査FAIL: ' + (cp.stderr.strip() or cp.stdout.strip()), report)
    fullmax_audit_report_path = REPORT_DIR/'fullmax_search_audit_report.json'
    if not fullmax_audit_report_path.exists():
        fail('全MAX検索DB監査レポートが生成されませんでした', report)
    fullmax_audit_report = json.loads(fullmax_audit_report_path.read_text(encoding='utf-8'))
    if fullmax_audit_report.get('status') != 'PASS':
        fail('全MAX検索DB監査レポートがPASSではありません', report)
    report['fullmax_search_audit'] = {
        'sidecar_files': fullmax_audit_report.get('sidecar_files'),
        'sidecar_records_structural_checked': fullmax_audit_report.get('sidecar_records_structural_checked'),
        'recommend_files_checked': fullmax_audit_report.get('recommend_files_checked'),
        'recommend_records_checked': fullmax_audit_report.get('recommend_records_checked'),
        'seconds': fullmax_audit_report.get('seconds'),
    }

    # JS構文をGitHub Actions上でも検査。外部JSとjinpo.html内のinline scriptを対象にする。
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
                fail(f'jinpo.html inline JavaScript構文エラー #{i}: {cp.stderr.strip()}', report)
    report['javascript_syntax'] = {'external_js': js_checked, 'inline_scripts': len(inline_scripts), 'errors': 0}

    # 通常5/6は等級3以下ON限定を維持し、独立した全等級5・6モード中だけ例外とする。
    # 文字列の空白差ではなく、通常ロック条件とbond56例外の両方を監査する。
    grade_lock_patterns = [
        r'if\s*\(\s*\(c\s*===\s*5\s*\|\|\s*c\s*===\s*6\)\s*&&\s*formed\s*&&\s*!grade3On\(\)\s*&&\s*!b56\s*\)\s*return\s+true\s*;',
        r'\(\(c\s*===\s*5\s*\|\|\s*c\s*===\s*6\)\s*&&\s*formed\s*&&\s*!g3\s*&&\s*!b56\)',
    ]
    if not all(re.search(pat, index_text) for pat in grade_lock_patterns):
        fail('通常5/6の等級3以下ON限定ロック、または全等級5・6モード例外が欠落', report)
    report['grade3_5_6_lock'] = True
    report['bond56_grade3_lock_exception'] = True

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
    report['message'] = 'Phase 2: 英傑一覧から英傑マスタ・配置/除外候補・5～9因縁・Top500を自動再生成し、全検証PASS。'
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
