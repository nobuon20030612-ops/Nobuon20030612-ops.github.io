#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source-next" / "英傑一覧.csv"
MASTER = ROOT / "data" / "jinpo_eiketsu_master.csv"
INEN = ROOT / "data" / "jinpo_inen_master.csv"
BOND_JS = ROOT / "jinpo-bond-list.js"
FORMATION_JS = ROOT / "jinpo-formation-config.js"
MANIFEST = ROOT / "data" / "compact_search_v2" / "jinpo_unified_search_manifest.json"
OVERRIDES = ROOT / "tools-next" / "approved_overrides.json"

MOJIBAKE_MARKERS = tuple(chr(x) for x in (0xFFFD, 0x7E3A, 0x7E67, 0x8B41, 0x00C3, 0x00C2))
SOURCE_FACTOR_MAP = {
    "因子1(特化)": "因子1",
    "因子2(2凸)": "因子2",
    "因子3(LV20)": "因子3",
    "因子4(文曲)": "因子4",
}
ALLOWED_EMPTY_FACTORS = {"", "?", "対象外", "未確認", "ー"}
EXPECTED_LINES = {
    "衡軛": [[1,2,3],[4,5,6]],
    "鶴翼": [[1,2,3],[4,5,6]],
    "魚鱗": [[1,2,3],[3,4,5],[5,6,1]],
    "方円": [[2,3,4],[4,5,6],[2,1,6]],
}
EXPECTED_JOBS = {"侍","忍者","僧","薬師","陰陽師","神主/巫女","鍛冶屋","傾奇者"}

def fail(message: str) -> None:
    print("FAIL:", message, file=sys.stderr)
    raise SystemExit(1)

def read_text(path: Path) -> str:
    if not path.exists():
        fail(f"必須ファイル不足: {path.relative_to(ROOT)}")
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        fail(f"UTF-8不正: {path.relative_to(ROOT)}: {e}")
    hits = [m for m in MOJIBAKE_MARKERS if m in text]
    if hits:
        fail(f"文字化け疑い: {path.relative_to(ROOT)}: {' / '.join(hits)}")
    return text

def read_csv_strict(path: Path) -> tuple[list[dict], list[str]]:
    text = read_text(path)
    rows_raw = list(csv.reader(text.splitlines()))
    if not rows_raw:
        fail(f"CSV空: {path.relative_to(ROOT)}")
    width = len(rows_raw[0])
    for idx, row in enumerate(rows_raw[1:], 2):
        if len(row) != width:
            fail(f"CSV列数不一致: {path.relative_to(ROOT)} {idx}行 {len(row)} != {width}")
    rows = list(csv.DictReader(text.splitlines()))
    headers = rows_raw[0]
    return rows, headers

def occurrence_map(rows: list[dict], name_col: str) -> dict[tuple[str,int], dict]:
    out = {}
    counts = defaultdict(int)
    for row in rows:
        name = str(row.get(name_col, "")).strip()
        counts[name] += 1
        key = (name, counts[name])
        if key in out:
            fail(f"occurrence key重複: {name}#{counts[name]}")
        out[key] = row
    return out

def load_override_lookup() -> dict[tuple[str,int,str], tuple[str,str]]:
    if not OVERRIDES.exists():
        return {}
    try:
        obj = json.loads(read_text(OVERRIDES))
    except Exception as e:
        fail(f"approved_overrides.json不正: {e}")
    out = {}
    for item in obj.get("rows", []):
        key = (
            str(item.get("name","")).strip(),
            int(item.get("occurrence",1)),
            str(item.get("source_field","")).strip(),
        )
        out[key] = (
            str(item.get("source_value","")).strip(),
            str(item.get("canonical_value","")).strip(),
        )
    return out

def canonical_source_value(name: str, occurrence: int, field: str, value: str, overrides) -> str:
    value = str(value or "").strip()
    ov = overrides.get((name, occurrence, field))
    if not ov:
        return value
    before, after = ov
    if value == before or value == after:
        return after
    fail(f"承認済み補正の前提値不一致: {name}#{occurrence} {field}={value!r}")
    return value

def validate_source_master() -> dict:
    source, sheaders = read_csv_strict(SOURCE)
    master, mheaders = read_csv_strict(MASTER)
    inen, _ = read_csv_strict(INEN)
    required_source = {"番号","名前",*SOURCE_FACTOR_MAP.keys()}
    required_master = {"internal_id","英傑名","職業","因子1","因子2","因子3","因子4"}
    miss = required_source - set(sheaders)
    if miss: fail("英傑一覧の必須列不足: " + ", ".join(sorted(miss)))
    miss = required_master - set(mheaders)
    if miss: fail("英傑マスタの必須列不足: " + ", ".join(sorted(miss)))

    # Source names are a matching key; invisible spaces are forbidden.
    for idx, row in enumerate(source, 2):
        raw = str(row.get("名前",""))
        if raw != raw.strip():
            fail(f"英傑一覧 名前の前後空白: {idx}行 {raw!r}")
        if not raw:
            fail(f"英傑一覧 名前空: {idx}行")

    nums = [str(r.get("番号","")).strip() for r in source]
    if any(not x for x in nums): fail("英傑一覧 番号空")
    if len(nums) != len(set(nums)): fail("英傑一覧 番号重複")

    ids = [str(r.get("internal_id","")).strip() for r in master]
    if any(not x for x in ids): fail("英傑マスタ internal_id空")
    if len(ids) != len(set(ids)): fail("英傑マスタ internal_id重複")

    canonical_factors = {
        str(r.get(c,"")).strip()
        for r in inen for c in ("因子1","因子2","因子3")
        if str(r.get(c,"")).strip()
    }
    overrides = load_override_lookup()

    scounts = defaultdict(int)
    for idx, row in enumerate(source, 2):
        name = str(row["名前"]).strip()
        scounts[name] += 1
        occ = scounts[name]
        for field in SOURCE_FACTOR_MAP:
            v = str(row.get(field,"")).strip()
            v = canonical_source_value(name, occ, field, v, overrides)
            if v not in ALLOWED_EMPTY_FACTORS and v not in canonical_factors:
                fail(f"英傑一覧 非標準因子: {name}#{occ} {field}={v}")

    for idx, row in enumerate(master, 2):
        job = str(row.get("職業","")).strip()
        if job not in EXPECTED_JOBS:
            fail(f"英傑マスタ 職業不正: {idx}行 {row.get('英傑名')}={job!r}")
        for field in ("因子1","因子2","因子3","因子4"):
            v = str(row.get(field,"")).strip()
            if v not in ALLOWED_EMPTY_FACTORS and v not in canonical_factors:
                fail(f"英傑マスタ 非標準因子: {row.get('internal_id')} {field}={v}")

    # Source→master factors must match after approved overrides.
    smap = occurrence_map(source, "名前")
    mmap = occurrence_map(master, "英傑名")
    if set(smap) != set(mmap):
        only_s = sorted(set(smap)-set(mmap))[:10]
        only_m = sorted(set(mmap)-set(smap))[:10]
        fail(f"英傑一覧/マスタ名前対応不一致 source_only={only_s} master_only={only_m}")
    for (name, occ), srow in smap.items():
        mrow = mmap[(name, occ)]
        for sf, mf in SOURCE_FACTOR_MAP.items():
            sv = canonical_source_value(name, occ, sf, srow.get(sf,""), overrides)
            mv = str(mrow.get(mf,"")).strip()
            # master uses 対象外 for empty optional slots.
            if sf != "因子1(特化)" and sv == "" and mv == "対象外":
                continue
            if sv != mv:
                fail(f"英傑一覧/マスタ因子不一致: {name}#{occ} {sf}->{mf}: {sv!r}!={mv!r}")

    return {
        "source_rows": len(source),
        "master_rows": len(master),
        "inen_rows": len(inen),
        "canonical_factor_count": len(canonical_factors),
    }

def validate_formation_config() -> None:
    read_text(FORMATION_JS)
    node = r"""
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(process.argv[1],'utf8').split('/* jinpo-update-info-from-summary-')[0];
const ctx={window:{},console}; vm.createContext(ctx); vm.runInContext(src,ctx);
process.stdout.write(JSON.stringify(ctx.window.JINPO_FORMATION_CONFIG));
"""
    cp = subprocess.run(
        ["node","-e",node,str(FORMATION_JS)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    if cp.returncode != 0:
        fail("陣形設定JS評価FAIL: " + cp.stderr.strip())
    try:
        cfg = json.loads(cp.stdout)
    except Exception as e:
        fail(f"陣形設定JSON化FAIL: {e}")
    for form, lines in EXPECTED_LINES.items():
        got = cfg.get(form,{}).get("activeLines")
        if got != lines:
            fail(f"因縁判定ライン不一致: {form}: {got} != {lines}")
        if any(len(x) != 3 or len(set(x)) != 3 for x in got):
            fail(f"因縁判定ラインは3人固定です: {form}: {got}")

def validate_bond_js() -> None:
    text = read_text(BOND_JS)
    cp = subprocess.run(["node","--check",str(BOND_JS)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail("jinpo-bond-list.js 構文FAIL: " + cp.stderr.strip())
    # These are regression invariants, not proof by themselves; behavioral tests run separately.
    required = [
        "var modalOpenToken = 0;",
        "var bondMasterLoadingPromise = null;",
        "var master = await loadBondMaster();",
        "activeCalculatedResult = currentCalculatedResult(master);",
        "if(requestToken !== modalOpenToken",
        "sanitizedUniquePlacement(placement)",
        "calculationFormationConfig(formation)",
        "現在発動中の因縁はありません。",
        "function correctOwnedHeroJobMeta()",
        "hero['職業']",
        "jinpoBondActiveCardNo",
        "jinpoBondCloseText",
        "SAFE_ACTIVE_FORMATION_V1",
    ]
    for frag in required:
        if frag not in text:
            fail(f"jinpo-bond-list.js 回帰ガード欠落: {frag}")
    forbidden = ["現在適用中の組み合わせはありません。"]
    for frag in forbidden:
        if frag in text:
            fail(f"旧表示文言が復活: {frag}")

def validate_manifest_if_present() -> None:
    if not MANIFEST.exists():
        return
    try:
        m = json.loads(read_text(MANIFEST))
    except Exception as e:
        fail(f"compact manifest JSON不正: {e}")
    if int(m.get("record_size",0)) != 52:
        fail(f"compact record_size不一致: {m.get('record_size')}")
    if int(m.get("top_limit",0)) != 500 or int(m.get("sort_top_limit",0)) != 500:
        fail("Top500設定不一致")
    version = str(m.get("version",""))
    if not version:
        fail("compact manifest version空")
    # A hash-derived version prevents stale binary cache after rebuild.
    if not re.search(r"[0-9a-f]{8,}", version.lower()):
        fail(f"compact manifest versionにDB fingerprintがありません: {version}")

def main() -> None:
    summary = validate_source_master()
    validate_formation_config()
    validate_bond_js()
    validate_manifest_if_present()
    print(json.dumps({
        "status":"PASS",
        **summary,
        "formation_lines":"PASS",
        "bond_modal_regressions":"PASS",
        "manifest_guard":"PASS" if MANIFEST.exists() else "SKIP(local fixture)",
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
