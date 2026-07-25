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
        SITE/'index.html', SITE/'jinpo-fast-search.js', SITE/'jinpo-fast-search-worker.js',
        SITE/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
    ]
    for p in required_site:
        if not p.exists(): fail('新陣法の必須ファイル不足: ' + str(p.relative_to(ROOT)), report)

    # Top500正式運用の整合性。初期表示用/単一優先ソート用は全件DBから事前生成した最大500件のみ。
    manifest_path = SITE/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
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

    forbidden_fragments = {
        'index.html': [
            'DB_LIST_MAX = 300', 'DB_LIST_MAX=300', 'Top300', 'top300',
            'jinpo_result_db_', 'factor4_usage_index.json', 'data-linegen-', '__jinpoLineGen', '__jinpoActualLineRows'
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
    ]
    for frag in required_fast_fragments:
        if frag not in fast_text:
            fail(f'確定済み500件/UI仕様が欠落: jinpo-fast-search.js: {frag}', report)

    required_worker_fragments = ['q.limit||500', 'Top500正式運用']
    for frag in required_worker_fragments:
        if frag not in worker_text:
            fail(f'Top500 Worker仕様が欠落: jinpo-fast-search-worker.js: {frag}', report)

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
    def verify_compact_entry(info, label):
        nonlocal compact_checked
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
        if info.get('raw_bytes') is not None and len(raw) != int(info['raw_bytes']):
            fail(f'compact DB rawサイズ不一致: {label}: {rel}', report)
        compact_checked += 1

    for mode, counts in manifest.get('datasets', {}).items():
        for count, forms in counts.items():
            for formation, info in forms.items():
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
    report['compact_integrity'] = {'files': compact_checked, 'errors': 0}

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
