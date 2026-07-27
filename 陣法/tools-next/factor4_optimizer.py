#!/usr/bin/env python3
"""因縁成立に必要な文曲(因子4)使用英傑数を最小化する共通ロジック。

- 1因縁は同一ライン上の3英傑が1因子ずつ担当する。
- 同じ因縁が複数ラインで成立する場合も、どのライン/割当を採用するかを選べる。
- 編成全体で因子4を使う英傑の集合サイズを最小化する。
- 最小人数が複数ある場合は、slot bitmask が小さいものを採用して決定的にする。
"""
from __future__ import annotations

from typing import Mapping, Sequence

EMPTY_FACTORS = {'', '-', '対象外'}


def _hero_factors(hero) -> Sequence[str]:
    if isinstance(hero, Mapping):
        if 'f' in hero:
            return tuple(str(x or '').strip() for x in hero['f'])
        if 'factors' in hero:
            return tuple(str(x or '').strip() for x in hero['factors'])
        return tuple(str(hero.get(k, '') or '').strip() for k in ('因子1','因子2','因子3','因子4'))
    return tuple(str(x or '').strip() for x in hero)


def assignment_factor4_masks(line: Sequence[int], bid: int, heroes: Mapping[int, object], bonds: Mapping[int, Sequence[str]], cache: dict | None = None) -> tuple[int, ...]:
    """ordered 3 heroes + bond -> all possible relative factor4 masks.

    relative bit 0/1/2 corresponds to the hero position inside ``line``.
    The same hero cannot satisfy two required factors.
    """
    key = (tuple(line), int(bid))
    if cache is not None and key in cache:
        return cache[key]
    req = tuple(str(x or '').strip() for x in bonds[bid])
    if len(line) != 3 or len(req) != 3:
        out: tuple[int, ...] = ()
        if cache is not None:
            cache[key] = out
        return out

    factors = [_hero_factors(heroes[hid]) for hid in line]
    masks: set[int] = set()
    used = [False, False, False]

    def dfs(i: int, mask: int) -> None:
        if i == 3:
            masks.add(mask)
            return
        factor = req[i]
        for hi in range(3):
            if used[hi]:
                continue
            fs = factors[hi]
            matching_slots = [fi for fi, value in enumerate(fs) if value == factor]
            if not matching_slots:
                continue
            # 同じ因子が複数slotに存在する将来データにも対応。
            # 非因子4で提供できるなら文曲不要として扱う。
            uses_f4 = all(fi == 3 for fi in matching_slots)
            used[hi] = True
            dfs(i + 1, mask | ((1 << hi) if uses_f4 else 0))
            used[hi] = False

    dfs(0, 0)
    out = tuple(sorted(masks, key=lambda m: (m.bit_count(), m)))
    if cache is not None:
        cache[key] = out
    return out


def minimal_factor4_mask(placement: Sequence[int], form: str, bond_ids: Sequence[int], lines: Mapping[str, Sequence[Sequence[int]]], heroes: Mapping[int, object], bonds: Mapping[int, Sequence[str]], cache: dict | None = None) -> int:
    """Return the minimal global 6-slot factor4 mask for this formation.

    Every activated bond must choose exactly one valid line+assignment.  DP over
    the 6-bit union mask proves the globally minimal number of factor4 heroes.
    """
    if cache is None:
        cache = {}
    states = {0}
    for bid in bond_ids:
        options: set[int] = set()
        for ln in lines[form]:
            line = tuple(placement[i] for i in ln)
            for rel_mask in assignment_factor4_masks(line, bid, heroes, bonds, cache):
                global_mask = 0
                for hi in range(3):
                    if rel_mask & (1 << hi):
                        global_mask |= 1 << int(ln[hi])
                options.add(global_mask)
        if not options:
            raise RuntimeError(f'発動因縁の割当候補がありません: form={form} bid={bid} placement={tuple(placement)}')
        states = {state | opt for state in states for opt in options}
    return min(states, key=lambda m: (m.bit_count(), m)) if states else 0


def minimal_factor4_count(placement: Sequence[int], form: str, bond_ids: Sequence[int], lines: Mapping[str, Sequence[Sequence[int]]], heroes: Mapping[int, object], bonds: Mapping[int, Sequence[str]], cache: dict | None = None) -> int:
    return minimal_factor4_mask(placement, form, bond_ids, lines, heroes, bonds, cache).bit_count()
