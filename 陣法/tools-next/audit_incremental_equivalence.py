#!/usr/bin/env python3
from __future__ import annotations

import gzip
import json
import struct
import sys
import time
from pathlib import Path

import rebuild_all_compact as full
from rebuild_incremental_additions import generate_cycle_delta, generate_disjoint_delta

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT
MANIFEST = SITE / 'data' / 'compact_search_v2' / 'jinpo_unified_search_manifest.json'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'incremental_equivalence_report.json'
REC = full.REC


def read_records(info: dict, count: int):
    raw = gzip.decompress((SITE / info['file']).read_bytes())
    if raw[:4] != b'JCF1' or struct.unpack_from('<H', raw, 6)[0] != REC:
        raise RuntimeError(f'compact不正: {info["file"]}')
    rows = struct.unpack_from('<I', raw, 8)[0]
    for i in range(rows):
        off = 16 + i * REC
        p = tuple(struct.unpack_from('<6H', raw, off))
        mask = 0
        for bid in raw[off + 12:off + 12 + count]:
            if bid:
                mask |= 1 << (bid - 1)
        yield p, mask


def keys(d: dict):
    return set(d.keys())


def assert_cycle_case(label: str, all_heroes: dict, bonds, coef, formation_bonus_pct,
                      placement: tuple[int, ...], target: int, new_id: int):
    subset = {hid: all_heroes[hid] for hid in placement}
    gen = full.Generator(sorted(subset), subset, bonds, coef, formation_bonus_pct)
    expected = gen.generate_cycle({target})[target]
    actual = generate_cycle_delta(gen, {target}, {new_id})[target]
    if keys(expected) != keys(actual):
        raise RuntimeError(f'{label}: cycle delta/full不一致 expected={len(expected)} actual={len(actual)} missing={len(keys(expected)-keys(actual))} extra={len(keys(actual)-keys(expected))}')
    return {'label': label, 'target': target, 'new_id': new_id, 'full_keys': len(expected), 'delta_keys': len(actual)}


def assert_disjoint_case(label: str, all_heroes: dict, bonds, coef, formation_bonus_pct,
                         placement: tuple[int, ...], target: int, new_id: int):
    subset = {hid: all_heroes[hid] for hid in placement}
    gen = full.Generator(sorted(subset), subset, bonds, coef, formation_bonus_pct)
    expected = gen.generate_disjoint({target})[target]
    actual = generate_disjoint_delta(gen, {target}, {new_id})[target]
    if keys(expected) != keys(actual):
        raise RuntimeError(f'{label}: disjoint delta/full不一致 expected={len(expected)} actual={len(actual)} missing={len(keys(expected)-keys(actual))} extra={len(keys(actual)-keys(expected))}')
    return {'label': label, 'target': target, 'new_id': new_id, 'full_keys': len(expected), 'delta_keys': len(actual)}


def find_cycle_examples(manifest: dict, mode: str, counts: list[int], gen: full.Generator):
    three = None
    two_zero = None
    for count in counts:
        info = manifest['datasets'][mode][str(count)]['魚鱗']
        for p, mask in read_records(info, count):
            line_masks = [gen.triple_mask(p[a], p[b], p[c]) for a, b, c in full.LINES['魚鱗']]
            active = [i for i, m in enumerate(line_masks) if m]
            if len(active) == 3 and three is None:
                # midpoint of the first active line; proves active-midpoint addition path.
                three = (p, count, p[1])
            if len(active) == 2 and two_zero is None:
                zero_idx = next(i for i in range(3) if i not in active)
                midpoint_index = (1, 3, 5)[zero_idx]
                two_zero = (p, count, p[midpoint_index])
            if three and two_zero:
                return three, two_zero
    return three, two_zero


def find_disjoint_example(manifest: dict, mode: str, counts: list[int]):
    for count in counts:
        info = manifest['datasets'][mode][str(count)]['衡軛']
        for p, _mask in read_records(info, count):
            return p, count, p[0]
    return None


def main():
    started = time.time()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    heroes, grade3, bonds, _bond_names, coef, formation_bonus_pct = full.load_model()
    cases = []

    normal_gen = full.Generator(sorted(heroes), heroes, bonds, coef, formation_bonus_pct)
    three, two_zero = find_cycle_examples(manifest, 'normal', [7, 8, 9], normal_gen)
    if not three or not two_zero:
        raise RuntimeError('normal cycleの3ライン/2ライン実例を取得できません')
    cases.append(assert_cycle_case('normal-cycle-three-active', heroes, bonds, coef, formation_bonus_pct, *three))
    cases.append(assert_cycle_case('normal-cycle-new-on-zero-line', heroes, bonds, coef, formation_bonus_pct, *two_zero))
    dis = find_disjoint_example(manifest, 'normal', [7, 8, 9])
    if not dis:
        raise RuntimeError('normal disjoint実例を取得できません')
    cases.append(assert_disjoint_case('normal-disjoint', heroes, bonds, coef, formation_bonus_pct, *dis))

    grade_heroes = {hid: heroes[hid] for hid in grade3}
    grade_gen = full.Generator(grade3, heroes, bonds, coef, formation_bonus_pct)
    gthree, gtwo_zero = find_cycle_examples(manifest, 'grade3', [5, 6, 7, 8, 9], grade_gen)
    if not gthree or not gtwo_zero:
        raise RuntimeError('grade3 cycleの3ライン/2ライン実例を取得できません')
    cases.append(assert_cycle_case('grade3-cycle-three-active', grade_heroes, bonds, coef, formation_bonus_pct, *gthree))
    cases.append(assert_cycle_case('grade3-cycle-new-on-zero-line', grade_heroes, bonds, coef, formation_bonus_pct, *gtwo_zero))
    gdis = find_disjoint_example(manifest, 'grade3', [5, 6, 7, 8, 9])
    if not gdis:
        raise RuntimeError('grade3 disjoint実例を取得できません')
    cases.append(assert_disjoint_case('grade3-disjoint', grade_heroes, bonds, coef, formation_bonus_pct, *gdis))

    report = {'status': 'PASS', 'cases': cases, 'seconds': round(time.time() - started, 3)}
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        REPORT_DIR.mkdir(exist_ok=True)
        REPORT.write_text(json.dumps({'status': 'FAIL', 'error': str(e)}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('ERROR:', e, file=sys.stderr)
        raise SystemExit(1)
