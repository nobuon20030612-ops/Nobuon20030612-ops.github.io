#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SITE_PREFIX = "陣法/"

ALLOWED_EXACT = {
    "陣法/data/jinpo_eiketsu_master.csv",
    "陣法/data/jinpo_latest_update_summary.json",
    "陣法/tools-next/hero_internal_id_map.json",
}
ALLOWED_PREFIXES = (
    "陣法/data/compact_search_v2/",
    "陣法/data/bond56_index/",
)
FORBIDDEN_PARTS = (
    "/__pycache__/",
)
FORBIDDEN_SUFFIXES = (
    ".pyc", ".pyo", ".tmp", ".temp", ".bak", ".orig", ".rej", "~",
)


def git_lines(*args: str) -> list[str]:
    cp = subprocess.run(
        ["git", "-c", "core.quotepath=false", *args], cwd=str(REPO),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    if cp.returncode != 0:
        raise RuntimeError(cp.stderr.strip() or cp.stdout.strip() or "git command failed")
    return [x.strip().replace("\\", "/") for x in cp.stdout.splitlines() if x.strip()]


def is_forbidden(path: str) -> bool:
    p = "/" + path.replace("\\", "/")
    if any(part in p for part in FORBIDDEN_PARTS):
        return True
    return path.lower().endswith(FORBIDDEN_SUFFIXES)


def is_allowed(path: str) -> bool:
    path = path.replace("\\", "/")
    if path in ALLOWED_EXACT:
        return True
    return any(path.startswith(prefix) for prefix in ALLOWED_PREFIXES)


def main() -> int:
    try:
        # tracked edits/deletions + staged edits (normally none here) + untracked files.
        paths = set(git_lines("diff", "--name-only", "HEAD", "--", "陣法"))
        paths.update(git_lines("diff", "--cached", "--name-only", "HEAD", "--", "陣法"))
        paths.update(git_lines("ls-files", "--others", "--exclude-standard", "--", "陣法"))

        forbidden = sorted(p for p in paths if is_forbidden(p))
        unexpected = sorted(p for p in paths if not is_allowed(p) and not is_forbidden(p))
        allowed = sorted(p for p in paths if is_allowed(p) and not is_forbidden(p))

        result = {
            "status": "PASS" if not forbidden and not unexpected else "FAIL",
            "changed_paths": len(paths),
            "allowed_paths": len(allowed),
            "forbidden_paths": forbidden,
            "unexpected_paths": unexpected,
            "allowed_exact": sorted(ALLOWED_EXACT),
            "allowed_prefixes": list(ALLOWED_PREFIXES),
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if forbidden:
            print("公開禁止の一時/キャッシュファイルを検出しました。", file=sys.stderr)
        if unexpected:
            print("生成処理が公開許可外のファイルを変更しました。", file=sys.stderr)
        return 0 if result["status"] == "PASS" else 1
    except Exception as e:
        print(json.dumps({"status": "FAIL", "error": str(e)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
