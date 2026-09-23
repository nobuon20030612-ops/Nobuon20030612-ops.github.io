#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path

import rebuild_all_compact as rac
from rebuild_all_compact import Generator, dump_candidates, load_model, release_memory, write_family_pair

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data' / 'compact_search_v2' / 'jinpo_unified_search_manifest.json'
SELECTION = ROOT / 'data' / 'jinpo_popular_selection.json'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'popular_search_report.json'
COUNTS = (6, 7, 8, 9)
FAMILIES = (('衡軛', '鶴翼'), ('魚鱗', '方円'))
FORM_FILE_CODE = rac.FORM_FILE_CODE


def fail(msg: str, report: dict):
    report['status'] = 'FAIL'
    report.setdefault('errors', []).append(msg)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    raise RuntimeError(msg)


def load_selection(heroes: dict[int, dict], grade3: list[int]):
    cfg = json.loads(SELECTION.read_text(encoding='utf-8'))
    if cfg.get('schema') != 'jinpo-popular-selection/v1' or cfg.get('mode') != 'popular':
        raise RuntimeError('選抜人気設定schema/mode不正')
    raw_ids = [str(x).strip() for x in cfg.get('selected_hero_ids', [])]
    if len(raw_ids) != 20 or len(set(raw_ids)) != 20:
        raise RuntimeError(f'画像指定英傑は20人・重複なし必須: {len(raw_ids)}')
    selected = []
    for iid in raw_ids:
        if not iid.startswith('EIK_'):
            raise RuntimeError(f'選抜人気internal_id不正: {iid}')
        hid = int(iid[4:])
        if hid not in heroes:
            raise RuntimeError(f'選抜人気internal_idが英傑マスタに存在しません: {iid}')
        selected.append(hid)
    counts = tuple(int(x) for x in cfg.get('search_counts', []))
    if counts != COUNTS:
        raise RuntimeError(f'選抜人気検索因縁数不正: {counts}')
    eligible = sorted(set(grade3) | set(selected))
    return cfg, selected, eligible


def init_popular_manifest(manifest: dict):
    datasets = manifest.setdefault('datasets', {})
    datasets['popular'] = {}
    for count in COUNTS:
        datasets['popular'][str(count)] = {}
        for form in rac.LINES:
            code = FORM_FILE_CODE[form]
            datasets['popular'][str(count)][form] = {
                'file': f'data/compact_search_v2/popular/jinpo_popular_c{count}_{code}_v2.bin.gz'
            }
    # write_family_pair will replace this branch with regenerated sidecars.
    manifest.setdefault('fullmax_stats', {}).pop('popular', None)


def main():
    started = time.time()
    report = {'status': 'RUNNING', 'errors': []}
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if not MANIFEST.exists():
        fail('検索manifestがありません', report)
    if not SELECTION.exists():
        fail('選抜人気設定がありません', report)

    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    heroes, grade3, bonds, _bond_names, coef, formation_bonus_pct = load_model()
    try:
        cfg, selected, eligible = load_selection(heroes, grade3)
    except Exception as e:
        fail(str(e), report)

    init_popular_manifest(manifest)
    # Current public binary header uses mode code 3 for popular. Do not change shared formation_spec.py.
    rac.MODE_CODE['popular'] = 3

    generator = Generator(eligible, heroes, bonds, coef, formation_bonus_pct)
    temp_dir = REPORT_DIR / 'popular_candidates'
    temp_dir.mkdir(parents=True, exist_ok=True)
    datasets = {}
    try:
        cycle = generator.generate_cycle(set(COUNTS))
        cycle_files = {}
        for count in COUNTS:
            p = temp_dir / f'popular_c{count}_cycle.tmp'
            cycle_files[count] = (p, dump_candidates(cycle[count], p))
        del cycle
        release_memory()

        disjoint = generator.generate_disjoint(set(COUNTS))
        disjoint_files = {}
        for count in COUNTS:
            p = temp_dir / f'popular_c{count}_disjoint.tmp'
            disjoint_files[count] = (p, dump_candidates(disjoint[count], p))
        del disjoint
        release_memory()

        for count in COUNTS:
            for forms, (candidate_path, rows) in ((FAMILIES[0], disjoint_files[count]), (FAMILIES[1], cycle_files[count])):
                pair = write_family_pair(manifest, generator, 'popular', count, forms, candidate_path, rows)
                for form, val in pair.items():
                    datasets[f'popular/{count}/{form}'] = val
                candidate_path.unlink(missing_ok=True)
                release_memory()
    finally:
        for p in temp_dir.glob('*.tmp'):
            p.unlink(missing_ok=True)
        try:
            temp_dir.rmdir()
        except OSError:
            pass

    note = '選抜人気モード: 画像指定20英傑＋等級3以下全員の専用検索DB（6～9因縁）'
    notes = manifest.setdefault('notes', [])
    if note not in notes:
        notes.append(note)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    report.update({
        'status': 'PASS',
        'selected_image_heroes': len(selected),
        'grade3_heroes': len(grade3),
        'popular_heroes': len(eligible),
        'search_counts': list(COUNTS),
        'selected_hero_ids': cfg.get('selected_hero_ids', []),
        'datasets': datasets,
        'full_records': sum(int(v['rows']) for v in datasets.values()),
        'semantic_unique_records': sum(int(v['rows']) for k, v in datasets.items() if k.endswith('/衡軛') or k.endswith('/魚鱗')),
        'seconds': round(time.time() - started, 3),
    })
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('status','selected_image_heroes','grade3_heroes','popular_heroes','full_records','seconds')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
