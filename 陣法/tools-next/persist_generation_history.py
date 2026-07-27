#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "_jinpo-next-report"
DATA_DIR = ROOT / "data"
COMPACT_DIR = DATA_DIR / "compact_search_v2"
MANIFEST = COMPACT_DIR / "jinpo_unified_search_manifest.json"
HISTORY_DIR = DATA_DIR / "generation_history"
LATEST = HISTORY_DIR / "latest.json"
INDEX = HISTORY_DIR / "index.json"
SCHEMA = "jinpo-generation-history/v1"

SOURCE_INPUTS = (
    ROOT / "source-next" / "英傑一覧.csv",
    DATA_DIR / "jinpo_inen_master.csv",
    DATA_DIR / "91因縁_計算式_倍率展開.csv",
    DATA_DIR / "formation_bonus.csv",
    DATA_DIR / "jinpo_job_mapping.json",
)
GENERATOR_INPUTS = (
    ROOT / "tools-next" / "build_jinpo_next.py",
    ROOT / "tools-next" / "sync_eiketsu_master.py",
    ROOT / "tools-next" / "rebuild_all_compact.py",
    ROOT / "tools-next" / "rebuild_incremental_additions.py",
    ROOT / "tools-next" / "rebuild_top500.py",
    ROOT / "tools-next" / "rebuild_recommend_sum_top.py",
    ROOT / "tools-next" / "rebuild_fullmax_search.py",
    ROOT / "tools-next" / "fullmax_model.py",
    ROOT / "tools-next" / "factor4_optimizer.py",
    ROOT / "tools-next" / "approved_overrides.json",
)
CORE_ARTIFACTS = (
    DATA_DIR / "jinpo_eiketsu_master.csv",
    DATA_DIR / "jinpo_latest_update_summary.json",
    ROOT / "tools-next" / "hero_internal_id_map.json",
)
REQUIRED_REPORTS = (
    "master_sync.json",
    "generation_report.json",
    "build_report.json",
)


def fail(message: str) -> "NoReturn":
    print(json.dumps({"status": "FAIL", "error": message}, ensure_ascii=False, indent=2), file=sys.stderr)
    raise SystemExit(1)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def canonical_sha256(value: object) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def json_read(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        fail(f"JSONを読めません: {rel(path) if path.is_relative_to(ROOT) else path}: {e}")
    if not isinstance(value, dict):
        fail(f"JSONルートがobjectではありません: {path}")
    return value


def atomic_write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def csv_count(path: Path) -> int:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return sum(1 for _ in csv.DictReader(f))


def fingerprint_files(paths: tuple[Path, ...], *, required: bool = True) -> tuple[list[dict], str]:
    rows: list[dict] = []
    for path in paths:
        if not path.exists():
            if required:
                fail(f"fingerprint対象ファイルがありません: {rel(path)}")
            continue
        rows.append({"file": rel(path), "bytes": path.stat().st_size, "sha256": sha256_file(path)})
    return rows, canonical_sha256(rows)


def collect_artifacts() -> tuple[list[dict], str, int]:
    paths: list[Path] = []
    for path in CORE_ARTIFACTS:
        if path.exists():
            paths.append(path)
    if not MANIFEST.exists():
        fail("compact manifestがありません")
    paths.extend(p for p in COMPACT_DIR.rglob("*") if p.is_file())
    # generation_history 自身はcompact配下ではないため循環しない。
    unique = sorted(set(paths), key=lambda p: rel(p))
    artifacts = [{"file": rel(p), "bytes": p.stat().st_size, "sha256": sha256_file(p)} for p in unique]
    return artifacts, canonical_sha256(artifacts), sum(x["bytes"] for x in artifacts)


def collect_audits() -> tuple[list[dict], bool]:
    for name in REQUIRED_REPORTS:
        if not (REPORT_DIR / name).exists():
            fail(f"成功世代の必須監査レポートがありません: {name}")
    rows: list[dict] = []
    all_pass = True
    for path in sorted(REPORT_DIR.glob("*.json")):
        obj = json_read(path)
        status = str(obj.get("status", "UNKNOWN")).upper()
        if status not in {"PASS", "UNKNOWN"}:
            all_pass = False
        rows.append({
            "file": rel(path),
            "status": status,
            "sha256": sha256_file(path),
        })
    required_status = {x["file"].split("/")[-1]: x["status"] for x in rows}
    for name in REQUIRED_REPORTS:
        if required_status.get(name) != "PASS":
            fail(f"成功世代として保存できません: {name} status={required_status.get(name)}")
    if not all_pass:
        bad = [x["file"] for x in rows if x["status"] not in {"PASS", "UNKNOWN"}]
        fail("FAIL監査レポートが残っています: " + ", ".join(bad))
    return rows, True


def dataset_rows(manifest: dict) -> dict:
    out: dict[str, dict[str, dict[str, int]]] = {}
    for mode, counts in manifest.get("datasets", {}).items():
        mode_out: dict[str, dict[str, int]] = {}
        for count, forms in counts.items():
            mode_out[str(count)] = {
                str(form): int(info.get("rows", 0))
                for form, info in forms.items()
                if isinstance(info, dict)
            }
        out[str(mode)] = mode_out
    return out


def detect_generation_mode(generation_report: dict, build_report: dict) -> str:
    direct = str(generation_report.get("generation_mode", "")).strip().lower()
    if direct in {"full", "incremental"}:
        return direct
    full_flag = generation_report.get("full_regeneration")
    if isinstance(full_flag, bool):
        return "full" if full_flag else "incremental"
    build_gen = build_report.get("generation", {}) if isinstance(build_report.get("generation"), dict) else {}
    build_flag = build_gen.get("full_regeneration")
    if isinstance(build_flag, bool):
        return "full" if build_flag else "incremental"
    return "unknown"


def payload_integrity(report: dict) -> str:
    copy = dict(report)
    copy.pop("integrity_sha256", None)
    return canonical_sha256(copy)


def main() -> None:
    if not REPORT_DIR.exists():
        fail("一時監査レポートフォルダがありません。全監査PASS後に実行してください")
    if not MANIFEST.exists():
        fail("compact manifestがありません")

    generation_report = json_read(REPORT_DIR / "generation_report.json")
    build_report = json_read(REPORT_DIR / "build_report.json")
    master_sync = json_read(REPORT_DIR / "master_sync.json")
    manifest = json_read(MANIFEST)
    audits, audits_all_pass = collect_audits()

    source_files, source_fingerprint = fingerprint_files(SOURCE_INPUTS)
    generator_files, generator_fingerprint = fingerprint_files(GENERATOR_INPUTS)
    artifacts, artifact_set_fingerprint, artifact_total_bytes = collect_artifacts()
    manifest_sha = sha256_file(MANIFEST)

    generation_fingerprint = canonical_sha256({
        "source_fingerprint_sha256": source_fingerprint,
        "generator_fingerprint_sha256": generator_fingerprint,
        "artifact_set_sha256": artifact_set_fingerprint,
        "manifest_sha256": manifest_sha,
    })
    generation_id = "gen_" + generation_fingerprint[:24]
    generation_mode = detect_generation_mode(generation_report, build_report)

    now_utc = datetime.now(timezone.utc)
    now_jst = now_utc.astimezone(ZoneInfo("Asia/Tokyo"))
    hero_count = csv_count(DATA_DIR / "jinpo_eiketsu_master.csv")
    bond_count = csv_count(DATA_DIR / "jinpo_inen_master.csv")

    build_gen = build_report.get("generation", {}) if isinstance(build_report.get("generation"), dict) else {}
    report = {
        "schema": SCHEMA,
        "generation_id": generation_id,
        "generation_fingerprint_sha256": generation_fingerprint,
        "persisted_at_utc": now_utc.isoformat(),
        "persisted_at_jst": now_jst.isoformat(),
        "generation_mode": generation_mode,
        "counts": {
            "heroes": hero_count,
            "bonds": bond_count,
            "grade3_heroes": int(generation_report.get("grade3_hero_count", 0) or 0),
            "full_records": int(generation_report.get("full_records", build_gen.get("full_records", 0)) or 0),
            "added_records": int(generation_report.get("added_records", build_gen.get("added_records", 0)) or 0),
            "removed_records": int(generation_report.get("removed_records", build_gen.get("removed_records", 0)) or 0),
        },
        "timing": {
            "generation_seconds": generation_report.get("seconds", build_gen.get("seconds")),
            "build_started_at_utc": build_report.get("generated_at_utc"),
        },
        "source": {
            "fingerprint_sha256": source_fingerprint,
            "files": source_files,
            "source_rows": master_sync.get("source_rows"),
            "new_heroes": master_sync.get("new_heroes", []),
            "changed_existing": master_sync.get("changed_existing", []),
            "removed_heroes": master_sync.get("removed_heroes", []),
        },
        "generator": {
            "fingerprint_sha256": generator_fingerprint,
            "files": generator_files,
            "manifest_generator": manifest.get("generator", {}),
            "record_model_fingerprint": (
                json_read(COMPACT_DIR / "record_model_fingerprint.json")
                if (COMPACT_DIR / "record_model_fingerprint.json").exists()
                else None
            ),
        },
        "datasets": dataset_rows(manifest),
        "artifacts": {
            "count": len(artifacts),
            "total_bytes": artifact_total_bytes,
            "set_sha256": artifact_set_fingerprint,
            "manifest_sha256": manifest_sha,
            "files": artifacts,
        },
        "audits": {
            "all_pass": audits_all_pass,
            "reports": audits,
        },
        "github": {
            "repository": os.environ.get("GITHUB_REPOSITORY", ""),
            "source_commit_sha": os.environ.get("GITHUB_SHA", ""),
            "ref_name": os.environ.get("GITHUB_REF_NAME", ""),
            "event_name": os.environ.get("GITHUB_EVENT_NAME", ""),
            "actor": os.environ.get("GITHUB_ACTOR", ""),
            "run_id": os.environ.get("GITHUB_RUN_ID", ""),
            "run_number": os.environ.get("GITHUB_RUN_NUMBER", ""),
            "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT", ""),
        },
    }
    report["integrity_sha256"] = payload_integrity(report)

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    history_file = HISTORY_DIR / f"{generation_id}.json"
    created = False
    if history_file.exists():
        old = json_read(history_file)
        if old.get("generation_id") != generation_id:
            fail(f"既存世代ファイルのgeneration_id不一致: {rel(history_file)}")
        if old.get("generation_fingerprint_sha256") != generation_fingerprint:
            fail(f"既存世代ファイルのfingerprint不一致: {rel(history_file)}")
        if old.get("integrity_sha256") != payload_integrity(old):
            fail(f"既存世代ファイルのintegrity不一致: {rel(history_file)}")
        # 同じ生成物を再実行しただけならimmutable履歴は書き換えない。
        report = old
    else:
        atomic_write_json(history_file, report)
        created = True

    latest = {
        "schema": SCHEMA,
        "generation_id": generation_id,
        "file": rel(history_file),
        "persisted_at_utc": report.get("persisted_at_utc"),
        "persisted_at_jst": report.get("persisted_at_jst"),
        "generation_mode": report.get("generation_mode"),
        "heroes": report.get("counts", {}).get("heroes"),
        "bonds": report.get("counts", {}).get("bonds"),
        "full_records": report.get("counts", {}).get("full_records"),
        "source_fingerprint_sha256": report.get("source", {}).get("fingerprint_sha256"),
        "generator_fingerprint_sha256": report.get("generator", {}).get("fingerprint_sha256"),
        "artifact_set_sha256": report.get("artifacts", {}).get("set_sha256"),
        "manifest_sha256": report.get("artifacts", {}).get("manifest_sha256"),
        "integrity_sha256": report.get("integrity_sha256"),
    }
    atomic_write_json(LATEST, latest)

    index = {"schema": SCHEMA, "generations": []}
    if INDEX.exists():
        old_index = json_read(INDEX)
        if isinstance(old_index.get("generations"), list):
            index["generations"] = old_index["generations"]
    summary = {
        "generation_id": generation_id,
        "file": rel(history_file),
        "persisted_at_utc": report.get("persisted_at_utc"),
        "persisted_at_jst": report.get("persisted_at_jst"),
        "generation_mode": report.get("generation_mode"),
        "heroes": report.get("counts", {}).get("heroes"),
        "bonds": report.get("counts", {}).get("bonds"),
        "full_records": report.get("counts", {}).get("full_records"),
        "artifact_set_sha256": report.get("artifacts", {}).get("set_sha256"),
    }
    generations = [x for x in index["generations"] if isinstance(x, dict) and x.get("generation_id") != generation_id]
    generations.insert(0, summary)
    index["generations"] = generations
    atomic_write_json(INDEX, index)

    print(json.dumps({
        "status": "PASS",
        "generation_id": generation_id,
        "history_created": created,
        "history_file": rel(history_file),
        "history_count": len(generations),
        "heroes": hero_count,
        "bonds": bond_count,
        "artifacts": len(artifacts),
        "artifact_total_bytes": artifact_total_bytes,
        "generation_mode": generation_mode,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
