#!/usr/bin/env python3
from __future__ import annotations
import csv, json, sys, hashlib
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
    too_large = []
    for p in SITE.rglob('*'):
        if p.is_file() and p.stat().st_size > 25_000_000:
            too_large.append({'file': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size})
    if too_large:
        report['too_large'] = too_large
        fail('25MB超過ファイルを検出', report)

    report['status'] = 'PASS'
    report['message'] = 'Phase 1: 現行384英傑と一致。/jinpo-next/ の安全な別入口を公開可能。'
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
