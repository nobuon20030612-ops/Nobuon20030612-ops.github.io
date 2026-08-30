#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "data" / "jinpo_formation_spec.json"

# User-confirmed absolute oracle. This MUST NOT be derived from SPEC_PATH.
# It prevents a stale/incorrect JSON spec and all consumers from agreeing on the same wrong value.
CANONICAL_ACTIVE_LINES_ONE_BASED = {
    "衡軛": ((1,2,3),(4,5,6)),
    "鶴翼": ((1,2,3),(4,5,6)),
    "魚鱗": ((1,2,3),(3,4,5),(5,6,1)),
    "方円": ((1,2,3),(3,4,5),(5,6,1)),
}

def load_spec():
    data=json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    forms=data.get("formations") or {}
    required=("衡軛","鶴翼","魚鱗","方円")
    if tuple(forms.keys()) != required:
        raise RuntimeError("陣形正本の4陣形または順序が不正")
    for name, expected in CANONICAL_ACTIVE_LINES_ONE_BASED.items():
        got = tuple(tuple(int(slot) for slot in line) for line in (forms[name].get("activeLines") or []))
        if got != expected:
            raise RuntimeError(
                f"現行絶対正本ライン不一致: {name} got={got} expected={expected}. "
                "過去仕様や別資料へ自動追従してはいけません"
            )
    return data

def active_lines_zero_based():
    forms=load_spec()["formations"]
    out={}
    for name,cfg in forms.items():
        lines=cfg.get("activeLines") or []
        if not lines or any(len(line)!=3 for line in lines):
            raise RuntimeError(f"成立ライン不正: {name}")
        out[name]=tuple(tuple(int(slot)-1 for slot in line) for line in lines)
    return out

LINES=active_lines_zero_based()
FORM_CODE={"衡軛":1,"鶴翼":2,"魚鱗":3,"方円":4}
MODE_CODE={"normal":1,"grade3":2}
