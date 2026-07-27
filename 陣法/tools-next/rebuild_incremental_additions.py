#!/usr/bin/env python3
from __future__ import annotations

import gc
import gzip
import json
import struct
import sys
import time
from collections import defaultdict
from pathlib import Path

import rebuild_all_compact as full

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT
DATA = SITE / 'data' / 'compact_search_v2'
MANIFEST = DATA / 'jinpo_unified_search_manifest.json'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'generation_report.json'
SYNC_REPORT = REPORT_DIR / 'master_sync.json'
REC = full.REC
FULLMAX_REC = full.FULLMAX_REC


def _add_cycle(outs: dict[int, dict], targets: set[int], placement, mask: int) -> None:
    count = mask.bit_count()
    if count not in targets or len(set(placement)) != 6:
        return
    p = full.canonical_cycle(tuple(placement))
    key = (tuple(sorted(p)), mask)
    old = outs[count].get(key)
    if old is None or p < old:
        outs[count][key] = p


def generate_cycle_delta(gen: full.Generator, targets: set[int], new_ids: set[int]):
    """Generate exactly the cycle-topology records that contain >=1 newly-added hero.

    Coverage:
      * new hero is a vertex or midpoint of any active line (3-active and 2-active cases)
      * new hero is only the midpoint of the zero-bond line in a 2-active case
    """
    outs = {t: {} for t in targets}
    min_target = min(targets)
    ids = tuple(gen.ids)
    id_set = set(ids)

    neighbors: dict[int, set[int]] = defaultdict(set)
    edge_entries: dict[int, list[tuple[int, int, tuple[int, ...]]]] = defaultdict(list)
    for (u, v), groups in gen.pair_groups.items():
        neighbors[u].add(v)
        neighbors[v].add(u)
        for mask, mids in groups:
            edge_entries[u].append((v, mask, mids))
            edge_entries[v].append((u, mask, mids))

    zero_cache: dict[tuple[int, int], tuple[int, ...]] = {}

    def zero_fillers(u: int, v: int) -> tuple[int, ...]:
        key = (u, v) if u < v else (v, u)
        cached = zero_cache.get(key)
        if cached is not None:
            return cached
        nonzero = set()
        for _mask, mids in gen.groups(u, v):
            nonzero.update(mids)
        result = tuple(sorted(id_set - {u, v} - nonzero))
        zero_cache[key] = result
        return result

    anchors = [(triple, mask) for triple, mask in gen.tm.items() if set(triple) & new_ids]

    # The new hero is on at least one active line.
    for t1, m1 in anchors:
        for shared in t1:
            rem = [x for x in t1 if x != shared]
            for outer_idx in (0, 1):
                outer = rem[outer_idx]
                midpoint = rem[1 - outer_idx]
                base_used = {outer, midpoint, shared}

                # Three active lines. The third vertex must connect to both endpoints.
                for third_vertex in neighbors[shared].intersection(neighbors[outer]):
                    if third_vertex in base_used:
                        continue
                    g2 = gen.groups(shared, third_vertex)
                    g3 = gen.groups(outer, third_vertex)
                    for m2, mids2 in g2:
                        u12 = m1 | m2
                        # A line can activate at most four bonds in the current model.
                        if u12.bit_count() + 4 < min_target:
                            continue
                        for m3, mids3 in g3:
                            mask = u12 | m3
                            if mask.bit_count() not in targets:
                                continue
                            for mid2 in mids2:
                                if mid2 in base_used or mid2 == third_vertex:
                                    continue
                                used5 = base_used | {mid2, third_vertex}
                                for mid3 in mids3:
                                    if mid3 in used5:
                                        continue
                                    _add_cycle(
                                        outs, targets,
                                        (outer, midpoint, shared, mid2, third_vertex, mid3),
                                        mask,
                                    )

                # Exactly two active lines. The remaining line must be zero-bond.
                for third_vertex in neighbors[shared]:
                    if third_vertex in base_used:
                        continue
                    for m2, mids2 in gen.groups(shared, third_vertex):
                        mask = m1 | m2
                        if mask.bit_count() not in targets:
                            continue
                        for mid2 in mids2:
                            if mid2 in base_used or mid2 == third_vertex:
                                continue
                            used5 = base_used | {mid2, third_vertex}
                            for zero_mid in zero_fillers(outer, third_vertex):
                                if zero_mid in used5:
                                    continue
                                _add_cycle(
                                    outs, targets,
                                    (outer, midpoint, shared, mid2, third_vertex, zero_mid),
                                    mask,
                                )

    # The new hero is used only as the midpoint of the zero-bond line.
    # Since the two active lines alone must reach the target count, low-count pairs are skipped safely.
    for shared, entries in edge_entries.items():
        for i, (outer1, m1, mids1) in enumerate(entries):
            c1 = m1.bit_count()
            for outer2, m2, mids2 in entries[i + 1:]:
                if outer2 == outer1 or c1 + m2.bit_count() < min_target:
                    continue
                mask = m1 | m2
                if mask.bit_count() not in targets:
                    continue
                for new_id in new_ids:
                    if new_id in {outer1, shared, outer2}:
                        continue
                    if gen.triple_mask(outer1, outer2, new_id) != 0:
                        continue
                    for mid1 in mids1:
                        if mid1 in {outer1, shared, outer2, new_id}:
                            continue
                        for mid2 in mids2:
                            if mid2 in {outer1, mid1, shared, outer2, new_id}:
                                continue
                            _add_cycle(
                                outs, targets,
                                (outer1, mid1, shared, mid2, outer2, new_id),
                                mask,
                            )
    return outs


def generate_disjoint_delta(gen: full.Generator, targets: set[int], new_ids: set[int]):
    """Generate exactly the disjoint-topology records containing >=1 newly-added hero."""
    outs = {t: {} for t in targets}
    min_target = min(targets)
    max_target = max(targets)
    by_count = defaultdict(list)
    new_triples = []
    for triple, mask in gen.tm.items():
        c = mask.bit_count()
        if mask and c <= max_target:
            by_count[c].append((triple, mask))
            if set(triple) & new_ids:
                new_triples.append((triple, mask))

    for t1, m1 in new_triples:
        s1 = set(t1)
        c1 = m1.bit_count()
        for c2, right in by_count.items():
            if c1 + c2 < min_target:
                continue
            for t2, m2 in right:
                if s1.intersection(t2):
                    continue
                mask = m1 | m2
                n = mask.bit_count()
                if n not in outs:
                    continue
                a, b = tuple(sorted(t1)), tuple(sorted(t2))
                p = min(a + b, b + a)
                key = (tuple(sorted(p)), mask)
                old = outs[n].get(key)
                if old is None or p < old:
                    outs[n][key] = p
    return outs


def _read_base(info: dict):
    path = SITE / info['file']
    raw = gzip.decompress(path.read_bytes())
    if len(raw) < 16 or raw[:4] != b'JCF1' or struct.unpack_from('<H', raw, 6)[0] != REC:
        raise RuntimeError(f'既存compact DB不正: {info["file"]}')
    rows = struct.unpack_from('<I', raw, 8)[0]
    if rows != int(info.get('rows', -1)) or len(raw) != 16 + rows * REC:
        raise RuntimeError(f'既存compact DB件数不正: {info["file"]}')
    return path, raw, rows


def _read_fullmax(manifest: dict, mode: str, count: int, form: str, rows: int):
    info = (((manifest.get('fullmax_stats') or {}).get(mode) or {}).get(str(count)) or {}).get(form)
    if not info:
        raise RuntimeError(f'既存全MAX sidecar不足: {mode}/{count}/{form}')
    path = SITE / info['file']
    raw = gzip.decompress(path.read_bytes())
    if len(raw) < 16 or raw[:4] != b'JMX1' or struct.unpack_from('<H', raw, 6)[0] != FULLMAX_REC:
        raise RuntimeError(f'既存全MAX sidecar不正: {info["file"]}')
    n = struct.unpack_from('<I', raw, 8)[0]
    if n != rows or len(raw) != 16 + n * FULLMAX_REC:
        raise RuntimeError(f'既存全MAX sidecar件数不正: {info["file"]}')
    return path, raw, info


def append_delta_dataset(manifest: dict, gen: full.Generator, mode: str, count: int, form: str,
                         delta: dict, new_ids: set[int], transform=lambda p: p):
    entry = manifest['datasets'][mode][str(count)][form]
    path, old_raw, old_rows = _read_base(entry)
    fm_path, old_fm, _fm_info = _read_fullmax(manifest, mode, count, form, old_rows)

    # A pure-addition delta must never touch or replace an existing record.
    old_keys = set()
    max_tie = 0
    for i in range(old_rows):
        off = 16 + i * REC
        p = tuple(struct.unpack_from('<6H', old_raw, off))
        if set(p) & new_ids:
            raise RuntimeError(f'増分生成前DBに新規internal_idが既に存在: {mode}/{count}/{form} {p}')
        mask = 0
        for bid in old_raw[off + 12:off + 12 + count]:
            if bid:
                mask |= 1 << (bid - 1)
        old_keys.add((tuple(sorted(p)), mask))
        max_tie = max(max_tie, struct.unpack_from('<I', old_raw, off + 48)[0])

    add_keys = []
    for key in sorted(delta, key=lambda k: (k[0], k[1])):
        if not (set(key[0]) & new_ids):
            raise RuntimeError(f'増分候補に新規英傑が含まれません: {mode}/{count}/{form} {key[0]}')
        if key not in old_keys:
            add_keys.append(key)

    new_rows = old_rows + len(add_keys)
    out = bytearray(16 + new_rows * REC)
    out[:16 + old_rows * REC] = old_raw
    struct.pack_into('<I', out, 8, new_rows)
    out[12] = count

    fm_out = bytearray(16 + new_rows * FULLMAX_REC)
    fm_out[:16 + old_rows * FULLMAX_REC] = old_fm
    struct.pack_into('<I', fm_out, 8, new_rows)

    tie = max_tie + 1
    for j, key in enumerate(add_keys):
        p = transform(delta[key])
        bids = gen.bond_ids(key[1])
        if len(bids) != count or gen.placement_mask(p, form) != key[1]:
            raise RuntimeError(f'増分配置/因縁集合不一致: {mode}/{count}/{form} {p}')
        rec, fm_rec = gen.record_bundle(p, bids, form, tie)
        dst = 16 + (old_rows + j) * REC
        out[dst:dst + REC] = rec
        fmdst = 16 + (old_rows + j) * FULLMAX_REC
        fm_out[fmdst:fmdst + FULLMAX_REC] = fm_rec
        tie += 1

    raw = bytes(out)
    full.gzwrite(path, raw)
    entry.update(full.meta(path, raw, new_rows))

    fm_raw = bytes(fm_out)
    full.gzwrite(fm_path, fm_raw)
    manifest['fullmax_stats'][mode][str(count)][form] = full.fullmax_meta(fm_path, fm_raw, new_rows)

    del old_raw, old_fm, out, fm_out, raw, fm_raw, old_keys
    gc.collect()
    return {'rows': new_rows, 'added': len(add_keys), 'removed': 0, 'old_rows_preserved': old_rows}


def _new_ids_from_sync() -> tuple[set[int], dict]:
    if not SYNC_REPORT.exists():
        raise RuntimeError('master_sync.json がありません')
    sync = json.loads(SYNC_REPORT.read_text(encoding='utf-8'))
    new_infos = sync.get('new_heroes') or []
    changed = sync.get('changed_existing') or []
    removed = sync.get('removed_heroes') or []
    if not new_infos:
        raise RuntimeError('増分生成対象の新英傑がありません')
    if changed or removed or sync.get('compact_record_model_force_all_dirty'):
        raise RuntimeError('純粋な新英傑追加ではないため増分生成不可')
    ids = {int(str(x['internal_id']).replace('EIK_', '')) for x in new_infos}
    dirty = {int(str(x).replace('EIK_', '')) for x in (sync.get('dirty_internal_ids') or [])}
    if dirty != ids:
        raise RuntimeError(f'増分生成のdirty ID不一致: new={sorted(ids)} dirty={sorted(dirty)}')
    return ids, sync


def main() -> None:
    started = time.time()
    new_ids, sync = _new_ids_from_sync()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    heroes, grade3, bonds, bond_names, coef, formation_bonus_pct = full.load_model()
    missing = sorted(new_ids - set(heroes))
    if missing:
        raise RuntimeError(f'新規internal_idが英傑マスタにありません: {missing}')

    report = {
        'status': 'RUNNING',
        'generation_mode': 'incremental_additions',
        'full_regeneration': False,
        'new_internal_ids': [f'EIK_{x:04d}' for x in sorted(new_ids)],
        'datasets': {},
    }

    normal_gen = full.Generator(sorted(heroes), heroes, bonds, coef, formation_bonus_pct)
    normal_cycle = generate_cycle_delta(normal_gen, {7, 8, 9}, new_ids)
    normal_disjoint = generate_disjoint_delta(normal_gen, {7, 8, 9}, new_ids)
    for count in (7, 8, 9):
        report['datasets'][f'normal/{count}/衡軛'] = append_delta_dataset(manifest, normal_gen, 'normal', count, '衡軛', normal_disjoint[count], new_ids)
        report['datasets'][f'normal/{count}/鶴翼'] = append_delta_dataset(manifest, normal_gen, 'normal', count, '鶴翼', normal_disjoint[count], new_ids)
        report['datasets'][f'normal/{count}/魚鱗'] = append_delta_dataset(manifest, normal_gen, 'normal', count, '魚鱗', normal_cycle[count], new_ids)
        report['datasets'][f'normal/{count}/方円'] = append_delta_dataset(manifest, normal_gen, 'normal', count, '方円', normal_cycle[count], new_ids, full.fish_to_hoen)

    grade_new = new_ids.intersection(grade3)
    if grade_new:
        grade_gen = full.Generator(grade3, heroes, bonds, coef, formation_bonus_pct)
        grade_cycle = generate_cycle_delta(grade_gen, {5, 6, 7, 8, 9}, grade_new)
        grade_disjoint = generate_disjoint_delta(grade_gen, {5, 6, 7, 8, 9}, grade_new)
        for count in (5, 6, 7, 8, 9):
            report['datasets'][f'grade3/{count}/衡軛'] = append_delta_dataset(manifest, grade_gen, 'grade3', count, '衡軛', grade_disjoint[count], grade_new)
            report['datasets'][f'grade3/{count}/鶴翼'] = append_delta_dataset(manifest, grade_gen, 'grade3', count, '鶴翼', grade_disjoint[count], grade_new)
            report['datasets'][f'grade3/{count}/魚鱗'] = append_delta_dataset(manifest, grade_gen, 'grade3', count, '魚鱗', grade_cycle[count], grade_new)
            report['datasets'][f'grade3/{count}/方円'] = append_delta_dataset(manifest, grade_gen, 'grade3', count, '方円', grade_cycle[count], grade_new, full.fish_to_hoen)
    else:
        # Grade3 datasets are unchanged; report their current sizes for downstream count checks.
        for count in (5, 6, 7, 8, 9):
            for form in ('衡軛', '鶴翼', '魚鱗', '方円'):
                rows = int(manifest['datasets']['grade3'][str(count)][form].get('rows', 0))
                report['datasets'][f'grade3/{count}/{form}'] = {'rows': rows, 'added': 0, 'removed': 0, 'old_rows_preserved': rows}

    manifest['generator'] = {
        'name': 'tools-next/rebuild_incremental_additions.py',
        'source_of_truth': ['source-next/英傑一覧.csv', 'data/jinpo_inen_master.csv', 'data/91因縁_計算式_倍率展開.csv', 'data/formation_bonus.csv'],
        'full_regeneration': False,
        'generation_mode': 'incremental_additions',
    }
    notes = [x for x in manifest.get('notes', []) if 'Phase2 full regeneration' not in str(x)]
    note = 'Pure new-hero additions use exact incremental generation; complex changes fall back to full regeneration'
    if note not in notes:
        notes.append(note)
    manifest['notes'] = notes
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    report['status'] = 'PASS'
    report['seconds'] = round(time.time() - started, 3)
    report['full_records'] = sum(v['rows'] for v in report['datasets'].values())
    report['added_records'] = sum(v['added'] for v in report['datasets'].values())
    report['removed_records'] = 0
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'status': 'PASS',
        'generation_mode': 'incremental_additions',
        'new_internal_ids': report['new_internal_ids'],
        'added_records': report['added_records'],
        'seconds': report['seconds'],
    }, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        REPORT_DIR.mkdir(exist_ok=True)
        REPORT.write_text(json.dumps({'status': 'FAIL', 'generation_mode': 'incremental_additions', 'error': str(e)}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('ERROR:', e, file=sys.stderr)
        raise SystemExit(1)
