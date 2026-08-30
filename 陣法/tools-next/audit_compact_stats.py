#!/usr/bin/env python3
from __future__ import annotations

import csv
import gzip
import json
import struct
import time
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'compact_search_v2'
MANIFEST = DATA / 'jinpo_unified_search_manifest.json'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'compact_stats_report.json'
REC = 52
STATS = ['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
CHUNK = 100_000

REC_DTYPE = np.dtype({
    'names': ['heroes', 'bond_ids', 'stats', 'total'],
    'formats': [('<u2', (6,)), ('u1', (9,)), ('<u2', (11,)), '<u4'],
    'offsets': [0, 12, 21, 43],
    'itemsize': REC,
})


def rows(path: Path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def norm_stat(v: str) -> str:
    s = str(v or '').strip().replace('生命力', '生命')
    return {'耐久':'耐久力','器用':'器用さ','土':'土属性','水':'水属性','火':'火属性','風':'風属性'}.get(s, s)


def load_model():
    hero_rows = []
    max_hid = 0
    for r in rows(ROOT / 'data' / 'jinpo_eiketsu_master.csv'):
        iid = str(r.get('internal_id', '')).strip()
        if not (iid.startswith('EIK_') and iid[4:].isdigit()):
            continue
        hid = int(iid[4:])
        max_hid = max(max_hid, hid)
        hero_rows.append((hid, [int(float(r.get(s) or 0)) for s in STATS]))
    heroes = np.zeros((max_hid + 1, len(STATS)), dtype=np.int64)
    hero_valid = np.zeros(max_hid + 1, dtype=np.bool_)
    for hid, vals in hero_rows:
        heroes[hid] = vals
        hero_valid[hid] = True

    bond_names = {int(r['No']): str(r['因縁名']).strip() for r in rows(ROOT / 'data' / 'jinpo_inen_master.csv')}
    coef_name = defaultdict(dict)
    for r in rows(ROOT / 'data' / '91因縁_計算式_倍率展開.csv'):
        name = str(r.get('因縁名', '')).strip()
        stat = norm_stat(r.get('対象ステータス', ''))
        try:
            value = float(r.get('実効係数') or 0)
        except Exception:
            value = 0
        if name and stat in STATS and value > 0:
            coef_name[name][stat] = value
    max_bid = max(bond_names, default=0)
    coef = np.zeros((max_bid + 1, len(STATS)), dtype=np.float64)
    bond_valid = np.zeros(max_bid + 1, dtype=np.bool_)
    bond_valid[0] = True
    for bid, name in bond_names.items():
        bond_valid[bid] = True
        coef[bid] = [coef_name.get(name, {}).get(s, 0.0) for s in STATS]

    bonus = {}
    for r in rows(ROOT / 'data' / 'formation_bonus.csv'):
        form = str(r.get('formation', '')).strip()
        if not form:
            continue
        pct = []
        for stat in STATS:
            factor = float(str(r.get(stat, '')).strip() or '1.00')
            hundred = round((factor - 1.0) * 100)
            if abs(factor - (1.0 + hundred / 100.0)) > 1e-9:
                raise RuntimeError(f'formation_bonus非1%刻み: {form} {stat}')
            pct.append(int(hundred))
        bonus[form] = np.asarray(pct, dtype=np.int64)
    return heroes, hero_valid, coef, bond_valid, bonus


def main():
    started = time.time()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    heroes, hero_valid, coef, bond_valid, bonus = load_model()
    checked = 0
    errors = 0
    first = []

    for mode, counts in manifest.get('datasets', {}).items():
        for count_s, forms in counts.items():
            count = int(count_s)
            for form, entry in forms.items():
                path = ROOT / entry['file']
                raw = gzip.decompress(path.read_bytes())
                if len(raw) < 16 or raw[:4] != b'JCF1' or struct.unpack_from('<H', raw, 6)[0] != REC:
                    raise RuntimeError(f'compact形式不正: {entry["file"]}')
                n = struct.unpack_from('<I', raw, 8)[0]
                if len(raw) != 16 + n * REC:
                    raise RuntimeError(f'compact長不正: {entry["file"]}')
                recs = np.ndarray(shape=(n,), dtype=REC_DTYPE, buffer=raw, offset=16)
                form_bonus = bonus.get(form)
                if form_bonus is None:
                    raise RuntimeError(f'未知陣形: {form}')

                for start in range(0, n, CHUNK):
                    end = min(n, start + CHUNK)
                    block = recs[start:end]
                    p = block['heroes'].astype(np.intp, copy=False)
                    if p.size:
                        if int(p.max()) >= len(hero_valid) or not bool(np.all(hero_valid[p])):
                            bad = np.argwhere((p >= len(hero_valid)) | (~hero_valid[np.minimum(p, len(hero_valid)-1)]))[0]
                            raise RuntimeError(f'未知英傑ID: {entry["file"]} row={start + int(bad[0])}')
                    base = heroes[p].sum(axis=1, dtype=np.int64)

                    bids = block['bond_ids'][:, :count].astype(np.intp, copy=False)
                    if bids.size:
                        if int(bids.max()) >= len(bond_valid):
                            raise RuntimeError(f'未知因縁ID: {int(bids.max())}')
                        bad_bonds = (bids != 0) & (~bond_valid[bids])
                        if bool(np.any(bad_bonds)):
                            bi = np.argwhere(bad_bonds)[0]
                            raise RuntimeError(f'未知因縁ID: {int(bids[tuple(bi)])}')

                    raw_bonus = np.zeros_like(base, dtype=np.int64)
                    for j in range(count):
                        c = coef[bids[:, j]]
                        raw_bonus += np.floor(base * c + 1e-9).astype(np.int64)
                    expected = raw_bonus * (100 + form_bonus) // 100
                    expected_total = expected.sum(axis=1, dtype=np.int64)

                    stored = block['stats'].astype(np.int64, copy=False)
                    stored_total = block['total'].astype(np.int64, copy=False)
                    bad = np.any(stored != expected, axis=1) | (stored_total != expected_total)
                    bad_indices = np.flatnonzero(bad)
                    checked += end - start
                    errors += int(bad_indices.size)

                    if bad_indices.size and len(first) < 20:
                        for local in bad_indices[:20 - len(first)]:
                            row = start + int(local)
                            bb = [int(x) for x in block['bond_ids'][local, :count] if int(x)]
                            first.append({
                                'file': entry['file'],
                                'row': row,
                                'heroes': tuple(int(x) for x in block['heroes'][local]),
                                'bond_ids': bb,
                                'stored': [int(x) for x in stored[local]],
                                'expected': [int(x) for x in expected[local]],
                                'stored_total': int(stored_total[local]),
                                'expected_total': int(expected_total[local]),
                            })

    report = {
        'status': 'PASS' if errors == 0 else 'FAIL',
        'records_checked': checked,
        'stat_errors': errors,
        'first_errors': first,
        'seconds': round(time.time() - started, 3),
        'audit_engine': 'numpy_chunked_exact',
    }
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
