#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
REPORT_DIR = ROOT / '_jinpo-next-report'
SYNC_REPORT = REPORT_DIR / 'master_sync.json'
FINGERPRINT_FILE = DATA / 'compact_search_v2' / 'record_model_fingerprint.json'
MASTER = DATA / 'jinpo_eiketsu_master.csv'
MODEL_INPUTS = [
    DATA / 'jinpo_inen_master.csv',
    DATA / '91因縁_計算式_倍率展開.csv',
    DATA / 'formation_bonus.csv',
    ROOT / 'tools-next' / 'rebuild_all_compact.py',
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
    h.update(b'jinpo-compact-record-model-v1\0')
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


def run(script: str) -> None:
    path = ROOT / 'tools-next' / script
    if not path.exists():
        raise RuntimeError(f'必須生成スクリプトがありません: tools-next/{script}')
    cp = subprocess.run([sys.executable, str(path)], cwd=str(ROOT), text=True)
    if cp.returncode != 0:
        raise RuntimeError(f'{script} がFAILしました')


def main() -> None:
    current, parts = model_fingerprint()
    previous = load_previous()
    old = str(previous.get('fingerprint','')).strip()
    changed = old != current
    forced = 0
    if changed:
        forced = force_all_dirty()
        # 元buildが既存レコードのbyte再利用をしていても、ここで全英傑をdirtyにして全recordを再計算する。
        run('rebuild_all_compact.py')
        run('rebuild_top500.py')
        run('rebuild_recommend_sum_top.py')
        run('audit_search_integrity.py')
        FINGERPRINT_FILE.parent.mkdir(parents=True, exist_ok=True)
        FINGERPRINT_FILE.write_text(json.dumps({
            'schema':'jinpo-compact-record-model-v1',
            'fingerprint':current,
            'inputs':parts,
        }, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({
        'status':'PASS',
        'model_changed':changed,
        'forced_dirty_hero_count':forced,
        'fingerprint':current,
    }, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('ERROR:', e, file=sys.stderr)
        raise SystemExit(1)
