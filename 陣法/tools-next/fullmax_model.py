#!/usr/bin/env python3
"""全MAX検索用の固定育成条件とステータス計算。

全MAXは現在のUI仕様と同一:
- 見聞録MAX: 生命/気合 +10,000、腕力〜魅力 +1,000、四象 +2,000（各英傑の職業へ適用）
- 鬼神石MAX: 生命/気合 +17,000、その他 +2,500（配置1〜6すべて）
- 転生MAX: 文曲(因子4)を実際に使用する英傑を除き、LV20素値を floor(x*1.236) へ
- 因縁/陣形計算は通常compact DBと同じ式
"""
from __future__ import annotations

import math
from typing import Mapping, Sequence

STATS = ['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
TENSEI_RATE = 1.236
KENBUN_MAX = {
    '生命': 10000, '気合': 10000,
    '腕力': 1000, '耐久力': 1000, '器用さ': 1000, '知力': 1000, '魅力': 1000,
    '土属性': 2000, '水属性': 2000, '火属性': 2000, '風属性': 2000,
}
KISHIN_MAX = {
    '生命': 17000, '気合': 17000,
    '腕力': 2500, '耐久力': 2500, '器用さ': 2500, '知力': 2500, '魅力': 2500,
    '土属性': 2500, '水属性': 2500, '火属性': 2500, '風属性': 2500,
}


def enhanced_hero_stat(raw: int, stat: str, tensei_allowed: bool) -> int:
    raw = int(raw or 0)
    base = math.floor(raw * TENSEI_RATE + 1e-9) if tensei_allowed else raw
    return base + KENBUN_MAX[stat] + KISHIN_MAX[stat]


def calc_fullmax_stats(
    placement: Sequence[int],
    factor4_mask: int,
    bond_ids: Sequence[int],
    form: str,
    heroes: Mapping[int, object],
    coef: Mapping[int, Sequence[float]],
    formation_bonus_pct: Mapping[str, Sequence[int]],
) -> tuple[list[int], int]:
    """Return 11 fullMAX values and total for one compact record.

    heroes[hid] supports either {'s':[11 stats]} or a mapping keyed by STATS.
    """
    sums = [0] * len(STATS)
    for slot, hid in enumerate(placement):
        hero = heroes[int(hid)]
        if isinstance(hero, Mapping) and 's' in hero:
            raw_stats = hero['s']
        else:
            raw_stats = [int(hero.get(stat, 0) or 0) for stat in STATS]
        tensei_allowed = not bool(int(factor4_mask) & (1 << slot))
        for si, stat in enumerate(STATS):
            sums[si] += enhanced_hero_stat(int(raw_stats[si] or 0), stat, tensei_allowed)

    raw_effect = [0] * len(STATS)
    for bid in bond_ids:
        multipliers = coef[int(bid)]
        for si, mult in enumerate(multipliers):
            if mult:
                raw_effect[si] += math.floor(sums[si] * float(mult) + 1e-9)

    bonus = formation_bonus_pct[form]
    values = [raw_effect[si] * (100 + int(bonus[si])) // 100 for si in range(len(STATS))]
    if any(v < 0 or v > 65535 for v in values):
        raise RuntimeError(f'全MAXステータスがuint16範囲外: {form} {tuple(placement)} {values}')
    return values, sum(values)
