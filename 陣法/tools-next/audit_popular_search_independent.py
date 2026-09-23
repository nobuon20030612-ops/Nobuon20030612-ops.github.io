#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import time
from collections import defaultdict
from pathlib import Path

from audit_combination_completeness_independent import gen_cycle, gen_disjoint, read_db_semantic

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data' / 'compact_search_v2' / 'jinpo_unified_search_manifest.json'
SELECTION = ROOT / 'data' / 'jinpo_popular_selection.json'
MASTER = ROOT / 'data' / 'jinpo_eiketsu_master.csv'
BONDS = ROOT / 'data' / 'jinpo_inen_master.csv'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'popular_search_independent_audit.json'
TARGETS = {6, 7, 8, 9}
FORMS = ('衡軛','鶴翼','魚鱗','方円')
FORM_FAMILY = {'衡軛':'disjoint','鶴翼':'disjoint','魚鱗':'cycle','方円':'cycle'}


def rows(path: Path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def build_current_popular_core(master_rows: list[dict], bond_rows: list[dict], eligible: set[int]):
    """Build an independent current-source triple oracle without using bond56_index or rebuild_all_compact.Generator."""
    factors = {}
    by_factor = defaultdict(list)
    for r in master_rows:
        iid = str(r.get('internal_id','')).strip()
        if not iid.startswith('EIK_'):
            continue
        hid = int(iid[4:])
        if hid not in eligible:
            continue
        fs = tuple(str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3','因子4'))
        factors[hid] = fs
        for f in set(x for x in fs if x and x not in {'-','対象外'}):
            by_factor[f].append(hid)

    triple_mask = defaultdict(int)
    for r in bond_rows:
        bid = int(r['No'])
        req = tuple(str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3'))
        bit = 1 << (bid - 1)
        for a in by_factor.get(req[0], ()): 
            for b in by_factor.get(req[1], ()): 
                if b == a:
                    continue
                for c in by_factor.get(req[2], ()): 
                    if c == a or c == b:
                        continue
                    triple_mask[tuple(sorted((a,b,c)))] |= bit

    triples_by_mask = defaultdict(list)
    grouped_pairs = defaultdict(lambda: defaultdict(list))
    for triple, mask in triple_mask.items():
        a,b,c = triple
        triples_by_mask[mask].append(triple)
        grouped_pairs[(a,b)][mask].append(c)
        grouped_pairs[(a,c)][mask].append(b)
        grouped_pairs[(b,c)][mask].append(a)
    pair_groups = {
        pair: [(mask, tuple(mids)) for mask, mids in groups.items()]
        for pair, groups in grouped_pairs.items()
    }
    return pair_groups, triples_by_mask, dict(triple_mask)


def main():
    started = time.time()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    cfg = json.loads(SELECTION.read_text(encoding='utf-8'))
    if tuple(int(x) for x in cfg.get('search_counts', [])) != (6,7,8,9):
        raise RuntimeError('選抜人気search_counts不正')
    selected_ids = [str(x).strip() for x in cfg.get('selected_hero_ids', [])]
    if len(selected_ids) != 20 or len(set(selected_ids)) != 20:
        raise RuntimeError('選抜人気画像指定20英傑不正')

    master_rows = rows(MASTER)
    by_iid = {str(r.get('internal_id','')).strip(): r for r in master_rows}
    missing = [iid for iid in selected_ids if iid not in by_iid]
    if missing:
        raise RuntimeError('選抜人気指定英傑がマスタに存在しません: ' + ','.join(missing))
    grade3 = {
        int(str(r['internal_id']).strip()[4:]) for r in master_rows
        if str(r.get('internal_id','')).strip().startswith('EIK_') and int(float(r.get('コスト') or 99)) <= 6
    }
    selected = {int(iid[4:]) for iid in selected_ids}
    eligible = grade3 | selected

    pair_groups, triples_by_mask, triple_mask = build_current_popular_core(master_rows, rows(BONDS), eligible)
    disjoint = gen_disjoint(sorted(eligible), triples_by_mask, TARGETS)
    cycle = gen_cycle(sorted(eligible), pair_groups, triple_mask, TARGETS)

    datasets = {}
    mismatch = 0
    for count in sorted(TARGETS):
        for form in FORMS:
            got, nrows = read_db_semantic('popular', count, form, manifest)
            expected = disjoint[count] if FORM_FAMILY[form] == 'disjoint' else cycle[count]
            missing_set = expected - got
            extra_set = got - expected
            duplicate_semantic = nrows - len(got)
            datasets[f'popular/{count}/{form}'] = {
                'rows': nrows,
                'db_semantic_unique': len(got),
                'independent_expected': len(expected),
                'missing_from_db': len(missing_set),
                'extra_in_db': len(extra_set),
                'semantic_duplicates': duplicate_semantic,
            }
            mismatch += len(missing_set) + len(extra_set) + duplicate_semantic

    report = {
        'status': 'PASS' if mismatch == 0 else 'FAIL',
        'audit_engine': 'independent_current_master_popular_semantic_regeneration',
        'uses_bond56_index': False,
        'selected_image_heroes': len(selected),
        'grade3_heroes': len(grade3),
        'popular_heroes': len(eligible),
        'triple_count': len(triple_mask),
        'pair_group_pairs': len(pair_groups),
        'counts': {k: int(v['rows']) for k,v in datasets.items()},
        'datasets': datasets,
        'total_mismatch': mismatch,
        'seconds': round(time.time() - started, 3),
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('status','uses_bond56_index','selected_image_heroes','grade3_heroes','popular_heroes','total_mismatch','seconds')}, ensure_ascii=False))
    if mismatch:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
