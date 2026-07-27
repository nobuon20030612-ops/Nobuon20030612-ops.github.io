#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
REPORT_DIR = ROOT / '_jinpo-next-report'
SYNC_REPORT = REPORT_DIR / 'master_sync.json'
FINGERPRINT_FILE = DATA / 'compact_search_v2' / 'record_model_fingerprint.json'
MASTER = DATA / 'jinpo_eiketsu_master.csv'
MODEL_INPUTS = [
    # ここは検索レコードの計算ルールそのものだけをfingerprint化する。
    # 英傑masterのデータ変更は別のmaster_sha256＋sync差分で追跡する。
    DATA / 'jinpo_inen_master.csv',
    DATA / '91因縁_計算式_倍率展開.csv',
    DATA / 'formation_bonus.csv',
    ROOT / 'tools-next' / 'rebuild_all_compact.py',
    ROOT / 'tools-next' / 'factor4_optimizer.py',
    ROOT / 'tools-next' / 'fullmax_model.py',
    ROOT / 'tools-next' / 'rebuild_fullmax_search.py',
    ROOT / 'tools-next' / 'audit_fullmax_search.py',
    ROOT / 'tools-next' / 'rebuild_incremental_additions.py',
    ROOT / 'tools-next' / 'audit_incremental_equivalence.py',
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def model_fingerprint() -> tuple[str, dict[str, str]]:
    parts: dict[str, str] = {}
    for path in MODEL_INPUTS:
        if not path.exists():
            raise RuntimeError(f'検索DBモデル入力がありません: {path.relative_to(ROOT)}')
        parts[str(path.relative_to(ROOT)).replace('\\','/')] = sha256(path)
    h = hashlib.sha256()
    h.update(b'jinpo-compact-record-model-v3\0')
    for name, digest in sorted(parts.items()):
        h.update(name.encode('utf-8')); h.update(b'\0'); h.update(digest.encode('ascii')); h.update(b'\0')
    return h.hexdigest(), parts


def all_hero_ids() -> list[str]:
    with MASTER.open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    ids = []
    for row in rows:
        iid = str(row.get('internal_id','')).strip()
        if iid.startswith('EIK_') and iid[4:].isdigit():
            ids.append(iid)
    if not ids:
        raise RuntimeError('英傑マスタからinternal_idを取得できません')
    if len(ids) != len(set(ids)):
        raise RuntimeError('英傑マスタinternal_id重複')
    return sorted(ids, key=lambda x:int(x[4:]))


def load_previous() -> dict:
    if not FINGERPRINT_FILE.exists():
        return {}
    try:
        obj = json.loads(FINGERPRINT_FILE.read_text(encoding='utf-8'))
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def force_all_dirty() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if SYNC_REPORT.exists():
        try: report = json.loads(SYNC_REPORT.read_text(encoding='utf-8'))
        except Exception: report = {}
    else:
        report = {}
    ids = all_hero_ids()
    report['dirty_internal_ids'] = ids
    report['compact_record_model_force_all_dirty'] = True
    SYNC_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    return len(ids)


def main() -> None:
    current, parts = model_fingerprint()
    previous = load_previous()
    old = str(previous.get('fingerprint','')).strip()
    model_changed = old != current

    current_master_sha = sha256(MASTER)
    previous_master_sha = str(previous.get('master_sha256','')).strip()
    master_changed = bool(previous_master_sha) and previous_master_sha != current_master_sha

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if SYNC_REPORT.exists():
        try:
            sync = json.loads(SYNC_REPORT.read_text(encoding='utf-8'))
        except Exception:
            sync = {}
    else:
        sync = {}

    dirty = list(sync.get('dirty_internal_ids') or [])
    has_declared_master_change = bool(dirty or sync.get('new_heroes') or sync.get('changed_existing') or sync.get('removed_heroes'))
    suspicious_master_change = master_changed and not has_declared_master_change

    forced = 0
    if model_changed or suspicious_master_change or not previous_master_sha:
        forced = force_all_dirty()
        sync = json.loads(SYNC_REPORT.read_text(encoding='utf-8'))
        sync['compact_record_model_force_all_dirty'] = True
        sync['compact_record_model_reason'] = (
            'record_model_changed' if model_changed else
            'master_changed_without_sync_delta' if suspicious_master_change else
            'fingerprint_v3_initialization'
        )
    else:
        sync['compact_record_model_force_all_dirty'] = False
        sync.pop('compact_record_model_reason', None)
    SYNC_REPORT.write_text(json.dumps(sync, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

    # Generation is intentionally NOT executed here. build_jinpo_next.py chooses exactly one path:
    # pure new-hero additions -> incremental; model/complex changes -> full.
    # This prevents the old double full-regeneration (freshness prebuild + normal build).
    FINGERPRINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    FINGERPRINT_FILE.write_text(json.dumps({
        'schema':'jinpo-compact-record-model-v3',
        'fingerprint':current,
        'inputs':parts,
        'master_sha256':current_master_sha,
    }, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

    print(json.dumps({
        'status':'PASS',
        'model_changed':model_changed,
        'master_changed':master_changed,
        'suspicious_master_change':suspicious_master_change,
        'forced_dirty_hero_count':forced,
        'generation_deferred_to_build':True,
        'fingerprint':current,
    }, ensure_ascii=False))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('ERROR:', e, file=sys.stderr)
        raise SystemExit(1)
