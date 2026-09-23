#!/usr/bin/env python3
from __future__ import annotations

import json
import struct
import time
from pathlib import Path

from rebuild_all_compact import Generator, load_model, read_manifest_entry
from audit_search_integrity import INDEPENDENT_CANONICAL_LINES_ZERO, independent_mask, read_fullmax

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data' / 'compact_search_v2' / 'jinpo_unified_search_manifest.json'
SELECTION = ROOT / 'data' / 'jinpo_popular_selection.json'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'popular_runtime_integrity.json'
REC = 52
FULLMAX_REC = 26


def main():
    started = time.time()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    cfg = json.loads(SELECTION.read_text(encoding='utf-8'))
    selected_iids = [str(x).strip() for x in cfg.get('selected_hero_ids', [])]
    if len(selected_iids) != 20 or len(set(selected_iids)) != 20:
        raise RuntimeError('選抜人気画像指定20英傑不正')

    heroes, grade3, bonds, _bond_names, coef, formation_bonus_pct = load_model()
    selected = {int(iid[4:]) for iid in selected_iids if iid.startswith('EIK_')}
    if len(selected) != 20 or any(h not in heroes for h in selected):
        raise RuntimeError('選抜人気指定英傑internal_id不正')
    eligible = set(grade3) | selected
    verifier = Generator(sorted(eligible), heroes, bonds, coef, formation_bonus_pct)

    rows_checked = 0
    eligibility_errors = 0
    bond_errors = 0
    factor4_errors = 0
    fullmax_errors = 0
    structure_errors = 0
    duplicate_errors = 0
    cycle_pair_errors = 0
    datasets = {}
    cycle_maps = {}

    popular = (manifest.get('datasets') or {}).get('popular') or {}
    if set(popular) != {'6','7','8','9'}:
        raise RuntimeError(f'選抜人気manifest因縁数不正: {sorted(popular)}')

    for count_s in ('6','7','8','9'):
        count = int(count_s)
        forms = popular[count_s]
        if set(forms) != {'衡軛','鶴翼','魚鱗','方円'}:
            raise RuntimeError(f'選抜人気陣形不足: {count_s}')
        for formation, info in forms.items():
            raw = read_manifest_entry(ROOT, info, b'JCF1', REC)
            mode_code, rec, nrows = struct.unpack_from('<HHI', raw, 4)
            if mode_code != 3 or rec != REC or raw[12] != count:
                raise RuntimeError(f'選抜人気header不正: {count_s}/{formation}')
            fm_info = (((manifest.get('fullmax_stats') or {}).get('popular') or {}).get(count_s) or {}).get(formation)
            if not fm_info:
                raise RuntimeError(f'選抜人気全MAX sidecar不足: {count_s}/{formation}')
            fm_raw = read_fullmax(fm_info, nrows)
            seen = set() if formation in {'衡軛','鶴翼'} else None
            pair_seen = set()
            local = {'rows': nrows, 'eligibility_errors':0, 'bond_errors':0, 'factor4_errors':0, 'fullmax_errors':0, 'structure_errors':0, 'duplicate_errors':0, 'cycle_pair_errors':0}
            for i in range(nrows):
                off = 16 + i * REC
                ids = struct.unpack_from('<6H', raw, off)
                active = tuple(raw[off+12:off+12+count])
                rest = raw[off+12+count:off+21]
                if len(set(ids)) != 6 or any(b == 0 for b in active) or len(set(active)) != count or any(rest) or any(h not in heroes for h in ids):
                    local['structure_errors'] += 1
                    continue
                if any(h not in eligible for h in ids):
                    local['eligibility_errors'] += 1
                stored_mask = 0
                for bid in active:
                    if bid not in bonds:
                        local['structure_errors'] += 1
                    stored_mask |= 1 << (bid - 1)
                canonical_mask = independent_mask(verifier, ids, formation)
                if canonical_mask != stored_mask:
                    local['bond_errors'] += 1
                    continue
                bids, _ = verifier.mask_info(canonical_mask)
                f4mask = verifier.factor4_mask(ids, formation, bids)
                if f4mask.bit_count() != raw[off+47]:
                    local['factor4_errors'] += 1
                sem_key = struct.pack('<6H', *sorted(ids)) + bytes(sorted(active))
                if seen is not None:
                    if sem_key in seen:
                        local['duplicate_errors'] += 1
                    seen.add(sem_key)
                if formation == '魚鱗':
                    pair_map = cycle_maps.setdefault(count, {})
                    if sem_key in pair_map:
                        local['duplicate_errors'] += 1
                    pair_map[sem_key] = f4mask.bit_count()
                elif formation == '方円':
                    peer = cycle_maps.get(count, {}).get(sem_key)
                    if peer is None or peer != f4mask.bit_count():
                        local['cycle_pair_errors'] += 1
                    if sem_key in pair_seen:
                        local['duplicate_errors'] += 1
                    pair_seen.add(sem_key)
                _bids, _normal_raw, fullmax_raw = verifier.shared_effects(ids, canonical_mask, f4mask)
                exp_vals, exp_total = verifier.apply_formation_bonus(fullmax_raw, formation)
                fm_off = 16 + i * FULLMAX_REC
                got_vals = struct.unpack_from('<11H', fm_raw, fm_off)
                got_total = struct.unpack_from('<I', fm_raw, fm_off+22)[0]
                if tuple(exp_vals) != tuple(got_vals) or int(exp_total) != int(got_total):
                    local['fullmax_errors'] += 1
            if formation == '方円':
                missing = len(cycle_maps.get(count, {})) - len(pair_seen)
                if missing > 0:
                    local['cycle_pair_errors'] += missing
                cycle_maps.pop(count, None)
            rows_checked += nrows
            eligibility_errors += local['eligibility_errors']
            bond_errors += local['bond_errors']
            factor4_errors += local['factor4_errors']
            fullmax_errors += local['fullmax_errors']
            structure_errors += local['structure_errors']
            duplicate_errors += local['duplicate_errors']
            cycle_pair_errors += local['cycle_pair_errors']
            datasets[f'popular/{count}/{formation}'] = local

    total_errors = eligibility_errors + bond_errors + factor4_errors + fullmax_errors + structure_errors + duplicate_errors + cycle_pair_errors
    report = {
        'status': 'PASS' if total_errors == 0 else 'FAIL',
        'selected_image_heroes': len(selected),
        'grade3_heroes': len(grade3),
        'popular_heroes': len(eligible),
        'rows_checked': rows_checked,
        'eligibility_errors': eligibility_errors,
        'bond_errors': bond_errors,
        'factor4_errors': factor4_errors,
        'fullmax_errors': fullmax_errors,
        'structure_errors': structure_errors,
        'duplicate_errors': duplicate_errors,
        'cycle_pair_errors': cycle_pair_errors,
        'datasets': datasets,
        'seconds': round(time.time() - started, 3),
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('status','rows_checked','eligibility_errors','bond_errors','factor4_errors','fullmax_errors','structure_errors','duplicate_errors','cycle_pair_errors','seconds')}, ensure_ascii=False))
    if total_errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
