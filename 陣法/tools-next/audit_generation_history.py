#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

from persist_generation_history import (
    GENERATOR_INPUTS,
    HISTORY_DIR,
    INDEX,
    LATEST,
    ROOT,
    SCHEMA,
    SOURCE_INPUTS,
    collect_artifacts,
    fingerprint_files,
    json_read,
    payload_integrity,
    sha256_file,
)


def fail(message: str) -> "NoReturn":
    print(json.dumps({"status": "FAIL", "error": message}, ensure_ascii=False, indent=2), file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not HISTORY_DIR.exists():
        fail("generation_historyがありません")
    if not LATEST.exists() or not INDEX.exists():
        fail("generation_history/latest.json または index.json がありません")

    latest = json_read(LATEST)
    index = json_read(INDEX)
    if latest.get("schema") != SCHEMA or index.get("schema") != SCHEMA:
        fail("generation_history schema不一致")

    generation_files = sorted(HISTORY_DIR.glob("gen_*.json"))
    if not generation_files:
        fail("永続世代レポートが1件もありません")

    generation_ids: list[str] = []
    for path in generation_files:
        obj = json_read(path)
        gid = str(obj.get("generation_id", ""))
        if path.name != f"{gid}.json":
            fail(f"世代ファイル名とgeneration_id不一致: {path.name} / {gid}")
        if obj.get("schema") != SCHEMA:
            fail(f"世代schema不一致: {path.name}")
        if obj.get("integrity_sha256") != payload_integrity(obj):
            fail(f"世代レポートintegrity不一致: {path.name}")
        if not obj.get("audits", {}).get("all_pass"):
            fail(f"監査PASSでない世代レポートを検出: {path.name}")
        generation_ids.append(gid)
    if len(generation_ids) != len(set(generation_ids)):
        fail("generation_id重複を検出")

    entries = index.get("generations")
    if not isinstance(entries, list):
        fail("index.generationsが配列ではありません")
    index_ids = [str(x.get("generation_id", "")) for x in entries if isinstance(x, dict)]
    if len(index_ids) != len(entries) or len(index_ids) != len(set(index_ids)):
        fail("indexに不正行またはgeneration_id重複があります")
    if set(index_ids) != set(generation_ids):
        fail("indexと世代ファイル集合が一致しません")

    latest_id = str(latest.get("generation_id", ""))
    if not index_ids or index_ids[0] != latest_id:
        fail("latestとindex先頭世代が一致しません")
    latest_file = ROOT / str(latest.get("file", ""))
    if not latest_file.exists():
        fail("latestが参照する世代ファイルがありません")
    current = json_read(latest_file)
    if current.get("generation_id") != latest_id:
        fail("latest参照先generation_id不一致")
    if current.get("integrity_sha256") != latest.get("integrity_sha256"):
        fail("latest integrity参照不一致")

    _, source_fp = fingerprint_files(SOURCE_INPUTS)
    _, generator_fp = fingerprint_files(GENERATOR_INPUTS)
    _, artifact_fp, artifact_bytes = collect_artifacts()
    manifest_sha = sha256_file(ROOT / "data" / "compact_search_v2" / "jinpo_unified_search_manifest.json")

    if current.get("source", {}).get("fingerprint_sha256") != source_fp:
        fail("latest世代と現在Source of Truthのfingerprintが一致しません")
    if current.get("generator", {}).get("fingerprint_sha256") != generator_fp:
        fail("latest世代と現在generatorのfingerprintが一致しません")
    if current.get("artifacts", {}).get("set_sha256") != artifact_fp:
        fail("latest世代と現在生成artifact集合のSHA-256が一致しません")
    if current.get("artifacts", {}).get("manifest_sha256") != manifest_sha:
        fail("latest世代と現在manifestのSHA-256が一致しません")
    if int(current.get("artifacts", {}).get("total_bytes", -1)) != artifact_bytes:
        fail("latest世代と現在artifact総byte数が一致しません")

    print(json.dumps({
        "status": "PASS",
        "latest_generation_id": latest_id,
        "history_count": len(generation_files),
        "source_fingerprint": source_fp,
        "generator_fingerprint": generator_fp,
        "artifact_set_sha256": artifact_fp,
        "artifact_total_bytes": artifact_bytes,
        "historical_integrity": "PASS",
        "latest_matches_current": "PASS",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
