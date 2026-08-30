#!/usr/bin/env python3
from __future__ import annotations

import csv
import gzip
import gc
import hashlib
import itertools
import json
import math
import struct
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
from pathlib import Path

from factor4_optimizer import minimal_factor4_mask
from formation_spec import LINES, FORM_CODE, MODE_CODE
from fullmax_model import calc_fullmax_stats

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT
DATA = SITE / 'data' / 'compact_search_v2'
MANIFEST = DATA / 'jinpo_unified_search_manifest.json'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'generation_report.json'
REC = 52
FULLMAX_REC = 26
FULLMAX_DIR = DATA / 'fullmax_stats'
STATS = ['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
FORM_FILE_CODE = {'衡軛':'kouyaku','鶴翼':'kakuyoku','魚鱗':'gyorin','方円':'hoen'}


def csv_rows(path: Path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def norm_stat(s: str) -> str:
    s = str(s or '').strip().replace('生命力','生命')
    return {'耐久':'耐久力','器用':'器用さ','土':'土属性','水':'水属性','火':'火属性','風':'風属性'}.get(s,s)


def gzip_writer(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = path.open('wb')
    gz = gzip.GzipFile(filename='', mode='wb', fileobj=raw, compresslevel=6, mtime=0)
    return raw, gz


def file_meta(path: Path, rows: int, raw_bytes: int, record_size: int | None = None) -> dict:
    blob = path.read_bytes()
    out = {
        'file': str(path.relative_to(SITE)).replace('\\','/'),
        'rows': rows,
        'gzip_bytes': len(blob),
        'raw_bytes': raw_bytes,
        'sha256_16': hashlib.sha256(blob).hexdigest()[:16],
    }
    if record_size is not None:
        out['record_size'] = record_size
    return out


def canonical_cycle(p):
    s = list(p)
    variants = []
    for shift in (0,2,4):
        variants.append(tuple(s[shift:]+s[:shift]))
    rev = [s[0],s[5],s[4],s[3],s[2],s[1]]
    for shift in (0,2,4):
        variants.append(tuple(rev[shift:]+rev[:shift]))
    return min(variants)


class Generator:
    def __init__(self, allowed_ids: list[int], heroes: dict, bonds: dict, coef: dict, formation_bonus_pct: dict):
        self.ids = sorted(allowed_ids)
        self.heroes = heroes
        self.bonds = bonds
        self.coef = coef
        self.formation_bonus_pct = formation_bonus_pct
        self.tm: dict[tuple[int,int,int], int] = defaultdict(int)
        self.pair_groups: dict[tuple[int,int], tuple[tuple[int,tuple[int,...]],...]] = {}
        # たいらの式正本から生成する現行キャッシュ。
        self.assign_cache = {}  # 旧実装との等価性監査用だけに保持
        self.zero_pair_cache: dict[tuple[int,int], tuple[int,...]] = {}
        self.neighbors: dict[int, set[int]] = {}
        self.mask_info_cache: dict[int, tuple[tuple[int,...], tuple[tuple[int,...],...]]] = {}
        self.hero_factor_f4 = {}
        self.f4_by_triple = {}
        self.rate_int = {bid: tuple(int(round(float(v)*10000)) for v in arr) for bid,arr in self.coef.items()}
        self.hero_stats = {hid: tuple(int(v) for v in h['s']) for hid,h in self.heroes.items()}
        # 全MAXは「文曲使用slotだけ転生不可」。見聞録/鬼神石加算はslotごとに固定なので事前計算する。
        from fullmax_model import KENBUN_MAX, KISHIN_MAX, TENSEI_RATE, STATS as FM_STATS
        self.hero_fullmax_plain = {}
        self.hero_fullmax_tensei = {}
        for hid,vals in self.hero_stats.items():
            plain=[]; tensei=[]
            for i,stat in enumerate(FM_STATS):
                add=int(KENBUN_MAX[stat])+int(KISHIN_MAX[stat])
                raw=int(vals[i])
                plain.append(raw+add)
                tensei.append(math.floor(raw*float(TENSEI_RATE)+1e-9)+add)
            self.hero_fullmax_plain[hid]=tuple(plain)
            self.hero_fullmax_tensei[hid]=tuple(tensei)
        for hid,h in self.heroes.items():
            fmap={}
            for fi,value in enumerate(h['f']):
                value=str(value or '').strip()
                if not value or value in {'-','対象外'}:
                    continue
                prev=fmap.get(value)
                uses_f4=(fi==3)
                # 同じ因子が非因子4にもあれば文曲不要。
                fmap[value]=uses_f4 if prev is None else (prev and uses_f4)
            self.hero_factor_f4[hid]=fmap
        self._build_triple_masks()
        self._build_factor4_triple_options()
        self._build_nonzero_pair_groups()
        self._build_neighbors()

    def _build_triple_masks(self):
        by_factor = defaultdict(list)
        for h in self.ids:
            for f in set(x for x in self.heroes[h]['f'] if x and x not in {'-','対象外'}):
                by_factor[f].append(h)
        for bid, req in self.bonds.items():
            bit = 1 << (bid-1)
            for a in by_factor.get(req[0],()):
                for b in by_factor.get(req[1],()):
                    if b == a:
                        continue
                    for c in by_factor.get(req[2],()):
                        if c == a or c == b:
                            continue
                        self.tm[tuple(sorted((a,b,c)))] |= bit

    def _build_factor4_triple_options(self):
        """成立済み3英傑ごとに、各因縁の文曲候補を一度だけ確定する。

        triple は昇順hero id。値の3bitはその昇順位置に対応する。
        以後の全2M件処理では因子文字列DFSを繰り返さない。
        """
        perms=((0,1,2),(0,2,1),(1,0,2),(1,2,0),(2,0,1),(2,1,0))
        out={}
        for triple,mask in self.tm.items():
            rows=[]
            for bid in self.bond_ids(mask):
                req=self.bonds[bid]
                opts=set()
                for perm in perms:
                    m=0; ok=True
                    for ri,hi in enumerate(perm):
                        flag=self.hero_factor_f4[triple[hi]].get(req[ri])
                        if flag is None:
                            ok=False; break
                        if flag: m |= 1 << hi
                    if ok: opts.add(m)
                if not opts:
                    raise RuntimeError(f'成立tripleの文曲割当候補なし: {triple} bid={bid}')
                rows.append((bid,tuple(sorted(opts,key=lambda x:(x.bit_count(),x)))))
            out[triple]=tuple(rows)
        self.f4_by_triple=out

    def factor4_mask_fast(self,p,form,bond_ids):
        """factor4_optimizer.py と同じ全体最適化を、事前計算済み割当で実行する。"""
        wanted=set(bond_ids)
        options={bid:set() for bid in bond_ids}
        for ln in LINES[form]:
            ordered=(p[ln[0]],p[ln[1]],p[ln[2]])
            triple=tuple(sorted(ordered))
            pos={hid:i for i,hid in enumerate(ordered)}
            for bid,rel_opts in self.f4_by_triple.get(triple,()):
                if bid not in wanted:
                    continue
                for rel in rel_opts:
                    gm=0
                    for sorted_i,hid in enumerate(triple):
                        if rel & (1<<sorted_i):
                            gm |= 1 << ln[pos[hid]]
                    options[bid].add(gm)
        states={0}
        for bid in bond_ids:
            opts=options[bid]
            if not opts:
                raise RuntimeError(f'発動因縁の割当候補がありません: form={form} bid={bid} placement={tuple(p)}')
            states={state|opt for state in states for opt in opts}
        return min(states,key=lambda m:(m.bit_count(),m)) if states else 0

    def mask_info(self,mask):
        cached=self.mask_info_cache.get(mask)
        if cached is not None:
            return cached
        bids=self.bond_ids(mask)
        rates=[]
        for si in range(11):
            rates.append(tuple(self.rate_int[bid][si] for bid in bids if self.rate_int[bid][si]))
        cached=(bids,tuple(rates))
        self.mask_info_cache[mask]=cached
        return cached

    @staticmethod
    def _effects(base,rates):
        return [sum((int(base[i])*rate)//10000 for rate in rates[i]) for i in range(11)]

    def shared_effects(self,p,mask,f4mask):
        bids,rates=self.mask_info(mask)
        base=[0]*11
        fm=[0]*11
        for slot,hid in enumerate(p):
            hs=self.hero_stats[hid]
            fs=self.hero_fullmax_plain[hid] if (f4mask & (1<<slot)) else self.hero_fullmax_tensei[hid]
            for i in range(11):
                base[i]+=hs[i]; fm[i]+=fs[i]
        return bids,self._effects(base,rates),self._effects(fm,rates)

    def apply_formation_bonus(self,raw,form):
        bonus=self.formation_bonus_pct[form]
        vals=[int(raw[i])*(100+int(bonus[i]))//100 for i in range(11)]
        if any(v<0 or v>65535 for v in vals):
            raise RuntimeError(f'ステータスがuint16範囲外: {form} {vals}')
        return vals,sum(vals)

    def _build_nonzero_pair_groups(self):
        pg = defaultdict(lambda: defaultdict(list))
        for (a,b,c), mask in self.tm.items():
            pg[(a,b)][mask].append(c)
            pg[(a,c)][mask].append(b)
            pg[(b,c)][mask].append(a)
        self.pair_groups = {
            pair: tuple((m,tuple(v)) for m,v in groups.items())
            for pair,groups in pg.items()
        }

    def _build_neighbors(self):
        n={h:set() for h in self.ids}
        for a,b in self.pair_groups:
            n[a].add(b); n[b].add(a)
        self.neighbors=n

    def groups(self,a,b):
        return self.pair_groups.get((a,b) if a<b else (b,a),())

    def triple_mask(self,a,b,c):
        return self.tm.get(tuple(sorted((a,b,c))),0)

    def zero_candidates(self,a,b):
        pair=(a,b) if a<b else (b,a)
        cached=self.zero_pair_cache.get(pair)
        if cached is not None:
            return cached
        out=tuple(h for h in self.ids if h not in pair and self.triple_mask(pair[0],pair[1],h)==0)
        self.zero_pair_cache[pair]=out
        return out

    def placement_mask(self,p,form):
        mask = 0
        for ln in LINES[form]:
            mask |= self.triple_mask(p[ln[0]],p[ln[1]],p[ln[2]])
        return mask

    def generate_cycle(self, targets: set[int]):
        outs = {t:{} for t in targets}
        max_target = max(targets)

        def add(target, A,B,C,D,E,F, mask):
            if len({A,B,C,D,E,F}) != 6:
                return
            p = canonical_cycle((A,B,C,D,E,F))
            key = (tuple(sorted(p)), mask)
            old = outs[target].get(key)
            if old is None or p < old:
                outs[target][key] = p

        # 3ラインすべて成立。非成立pairを最初から列挙しない。
        for A in self.ids:
            neighA=self.neighbors[A]
            for C in (x for x in neighA if x>A):
                common = neighA.intersection(self.neighbors[C])
                for E in (x for x in common if x>C):
                    g1,g2,g3=self.groups(A,C),self.groups(C,E),self.groups(A,E)
                    shared={A,C,E}
                    for m1,L1 in g1:
                        for m2,L2 in g2:
                            u=m1|m2
                            if u.bit_count()>max_target: continue
                            for m3,L3 in g3:
                                mask=u|m3; n=mask.bit_count()
                                if n not in outs: continue
                                for B in L1:
                                    if B in shared: continue
                                    for D in L2:
                                        if D in shared or D==B: continue
                                        for F in L3:
                                            if F in shared or F==B or F==D: continue
                                            add(n,A,B,C,D,E,F,mask)

        # 2ライン成立、残り1ライン不成立。各ケースは必要な2辺だけから列挙する。
        # case0: AC,CE active / AE inactive
        for C in self.ids:
            left=[x for x in self.neighbors[C] if x<C]
            right=[x for x in self.neighbors[C] if x>C]
            for A in left:
                gi=self.groups(A,C)
                for E in right:
                    gj=self.groups(C,E)
                    for mi,Li in gi:
                        for mj,Lj in gj:
                            mask=mi|mj; n=mask.bit_count()
                            if n not in outs: continue
                            for B in Li:
                                if B in (A,C,E): continue
                                for D in Lj:
                                    if D in (A,C,E) or D==B: continue
                                    used={A,C,E,B,D}
                                    for F in self.zero_candidates(A,E):
                                        if F in used: continue
                                        add(n,A,B,C,D,E,F,mask)

        # case1: CE,AE active / AC inactive
        for A in self.ids:
            for E in (x for x in self.neighbors[A] if x>A):
                gj=self.groups(A,E)
                for C in (x for x in self.neighbors[E] if A<x<E):
                    gi=self.groups(C,E)
                    for mi,Li in gi:
                        for mj,Lj in gj:
                            mask=mi|mj; n=mask.bit_count()
                            if n not in outs: continue
                            for D in Li:
                                if D in (A,C,E): continue
                                for F in Lj:
                                    if F in (A,C,E) or F==D: continue
                                    used={A,C,E,D,F}
                                    for B in self.zero_candidates(A,C):
                                        if B in used: continue
                                        add(n,A,B,C,D,E,F,mask)

        # case2: AE,AC active / CE inactive
        for A in self.ids:
            right=sorted(x for x in self.neighbors[A] if x>A)
            for ix,C in enumerate(right):
                gi=self.groups(A,C)
                for E in right[ix+1:]:
                    gj=self.groups(A,E)
                    for mi,Li in gi:
                        for mj,Lj in gj:
                            mask=mi|mj; n=mask.bit_count()
                            if n not in outs: continue
                            for B in Li:
                                if B in (A,C,E): continue
                                for F in Lj:
                                    if F in (A,C,E) or F==B: continue
                                    used={A,C,E,B,F}
                                    for D in self.zero_candidates(C,E):
                                        if D in used: continue
                                        add(n,A,B,C,D,E,F,mask)
        return outs

    def generate_disjoint(self, targets: set[int]):
        outs = {t:{} for t in targets}
        max_target = max(targets)
        by_count = defaultdict(list)
        for triple,mask in self.tm.items():
            c = mask.bit_count()
            if mask and c <= max_target:
                by_count[c].append((triple,mask))
        max_count = max(by_count, default=0)
        min_target = min(targets)
        for c1 in range(1,max_count+1):
            for c2 in range(c1,max_count+1):
                if c1+c2 < min_target:
                    continue
                left = by_count.get(c1,())
                right = by_count.get(c2,())
                same = left is right
                for i,(t1,m1) in enumerate(left):
                    s1 = set(t1)
                    start = i+1 if same else 0
                    for t2,m2 in right[start:]:
                        if s1.intersection(t2):
                            continue
                        mask = m1 | m2
                        n = mask.bit_count()
                        if n not in outs:
                            continue
                        a,b = tuple(sorted(t1)),tuple(sorted(t2))
                        p = min(a+b,b+a)
                        key = (tuple(sorted(p)),mask)
                        old = outs[n].get(key)
                        if old is None or p < old:
                            outs[n][key] = p
        return outs

    def bond_ids(self,mask):
        return tuple(i+1 for i in range(len(self.bonds)) if (mask >> i) & 1)

    def factor4_mask(self,p,form,bond_ids):
        return self.factor4_mask_fast(p,form,bond_ids)

    def calc_stats(self,p,bond_ids,form):
        base = [sum(self.heroes[h]['s'][i] for h in p) for i in range(11)]
        raw = [0]*11
        for bid in bond_ids:
            for i,mult in enumerate(self.coef[bid]):
                if mult:
                    raw[i] += math.floor(base[i]*mult + 1e-9)
        bonus = self.formation_bonus_pct[form]
        vals = [raw[i]*(100+bonus[i])//100 for i in range(11)]
        if any(v < 0 or v > 65535 for v in vals):
            raise RuntimeError(f'ステータスがuint16範囲外: {form} {p} {vals}')
        return vals,sum(vals)

    def record_from_known_f4(self,p,bond_ids,form,tie,f4mask):
        vals,total = self.calc_stats(p,bond_ids,form)
        r = bytearray(REC)
        struct.pack_into('<6H',r,0,*p)
        for i,bid in enumerate(bond_ids):
            r[12+i] = bid
        for i,v in enumerate(vals):
            struct.pack_into('<H',r,21+2*i,v)
        struct.pack_into('<I',r,43,total)
        r[47] = int(f4mask).bit_count()
        struct.pack_into('<I',r,48,tie)
        return bytes(r)

    def fullmax_from_known_f4(self,p,bond_ids,form,f4mask):
        vals,total = calc_fullmax_stats(
            p, f4mask, bond_ids, form, self.heroes, self.coef, self.formation_bonus_pct
        )
        out=bytearray(FULLMAX_REC)
        struct.pack_into('<11H',out,0,*vals)
        struct.pack_into('<I',out,22,total)
        return bytes(out)

    def records_from_shared(self,p,mask,form,tie,f4mask,normal_raw,fullmax_raw,bids):
        vals,total=self.apply_formation_bonus(normal_raw,form)
        r=bytearray(REC)
        struct.pack_into('<6H',r,0,*p)
        for i,bid in enumerate(bids): r[12+i]=bid
        for i,v in enumerate(vals): struct.pack_into('<H',r,21+2*i,v)
        struct.pack_into('<I',r,43,total)
        r[47]=int(f4mask).bit_count()
        struct.pack_into('<I',r,48,tie)
        fm_vals,fm_total=self.apply_formation_bonus(fullmax_raw,form)
        fm=bytearray(FULLMAX_REC)
        struct.pack_into('<11H',fm,0,*fm_vals)
        struct.pack_into('<I',fm,22,fm_total)
        return r,fm


def load_model():
    heroes = {}
    grade3 = []
    for r in csv_rows(SITE/'data'/'jinpo_eiketsu_master.csv'):
        iid = str(r.get('internal_id','')).strip()
        if not iid.startswith('EIK_'):
            continue
        hid = int(iid[4:])
        if hid <= 0 or hid > 65535 or hid in heroes:
            raise RuntimeError(f'internal_id不正または重複: {iid}')
        factors = [str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3','因子4')]
        stats = [int(float(r.get(s) or 0)) for s in STATS]
        cost = int(float(r.get('コスト') or 99))
        heroes[hid] = {'f':factors,'s':stats,'c':cost,'name':str(r.get('英傑名','')).strip()}
        if cost <= 6:
            grade3.append(hid)

    bonds = {}
    bond_names = {}
    for r in csv_rows(SITE/'data'/'jinpo_inen_master.csv'):
        bid = int(r['No'])
        if bid <= 0 or bid > 255:
            raise RuntimeError(f'因縁No不正: {bid}')
        bonds[bid] = [str(r[k]).strip() for k in ('因子1','因子2','因子3')]
        bond_names[bid] = str(r['因縁名']).strip()

    coef_name = defaultdict(dict)
    for r in csv_rows(SITE/'data'/'91因縁_計算式_倍率展開.csv'):
        name = str(r.get('因縁名','')).strip()
        stat = norm_stat(r.get('対象ステータス',''))
        value = float(r.get('実効係数') or 0)
        if name and stat in STATS and value > 0:
            coef_name[name][stat] = value
    coef = {bid:[coef_name.get(name,{}).get(s,0.0) for s in STATS] for bid,name in bond_names.items()}

    formation_bonus_pct = {}
    for r in csv_rows(SITE/'data'/'formation_bonus.csv'):
        form = str(r.get('formation','')).strip()
        if not form:
            continue
        if form not in LINES:
            raise RuntimeError(f'formation_bonus.csvに未知の陣形: {form}')
        pct = []
        for stat in STATS:
            factor = float(str(r.get(stat,'')).strip() or '1.00')
            hundred = round((factor - 1.0) * 100)
            if abs(factor - (1.0 + hundred/100.0)) > 1e-9 or hundred < 0:
                raise RuntimeError(f'formation_bonus.csv倍率不正: {form} {stat}={factor}')
            pct.append(int(hundred))
        formation_bonus_pct[form] = pct
    if set(formation_bonus_pct) != set(LINES):
        raise RuntimeError('formation_bonus.csvの4陣形が正本と一致しません')
    return heroes,sorted(grade3),bonds,bond_names,coef,formation_bonus_pct


CANDIDATE_REC=24

def dump_candidates(generated: dict, path: Path) -> int:
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('wb') as f:
        f.write(struct.pack('<4sI',b'JCG1',len(generated)))
        for key,p in generated.items():
            mask=int(key[1])
            f.write(struct.pack('<6H',*p))
            f.write(mask.to_bytes(12,'little'))
    return len(generated)

def iter_candidates(path: Path):
    with path.open('rb') as f:
        head=f.read(8)
        if len(head)!=8 or head[:4]!=b'JCG1': raise RuntimeError(f'一時候補形式不正: {path.name}')
        rows=struct.unpack_from('<I',head,4)[0]
        for _ in range(rows):
            rec=f.read(CANDIDATE_REC)
            if len(rec)!=CANDIDATE_REC: raise RuntimeError(f'一時候補長不正: {path.name}')
            p=struct.unpack_from('<6H',rec,0)
            mask=int.from_bytes(rec[12:24],'little')
            yield p,mask
        if f.read(1): raise RuntimeError(f'一時候補末尾不正: {path.name}')

def release_memory():
    gc.collect()
    try:
        import ctypes
        ctypes.CDLL('libc.so.6').malloc_trim(0)
    except Exception:
        pass

def fullmax_path(mode: str, count: int, form: str) -> Path:
    return FULLMAX_DIR/mode/f'c{count}_{FORM_FILE_CODE[form]}.bin.gz'


def compact_header(mode: str, count: int, form: str, rows: int) -> bytes:
    return struct.pack('<4sHHIBBBB', b'JCF1', MODE_CODE[mode], REC, rows, count, FORM_CODE[form], 1 if mode=='grade3' else 0, 0)


def fullmax_header(rows: int) -> bytes:
    return struct.pack('<4sHHII', b'JMX1', 1, FULLMAX_REC, rows, 0)


def _gzip_raw_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True,exist_ok=True)
    with dst.open('wb') as out:
        subprocess.run(['gzip','-n','-6','-c',str(src)],stdout=out,check=True)


def write_family_pair(manifest: dict, generator: Generator, mode: str, count: int, forms: tuple[str,str], candidate_path: Path, rows: int) -> dict:
    if LINES[forms[0]] != LINES[forms[1]]:
        raise RuntimeError(f'同一ファミリの成立ラインが一致しません: {forms}')

    temp_raw=REPORT_DIR/'raw_output'
    temp_raw.mkdir(parents=True,exist_ok=True)
    items=[]
    handles=[]
    for form in forms:
        entry=manifest['datasets'][mode][str(count)][form]
        path=SITE/entry['file']
        fm_path=fullmax_path(mode,count,form)
        raw_path=temp_raw/f'{mode}_{count}_{FORM_FILE_CODE[form]}.compact.raw'
        fm_raw_path=temp_raw/f'{mode}_{count}_{FORM_FILE_CODE[form]}.fullmax.raw'
        rf=raw_path.open('wb'); ff=fm_raw_path.open('wb')
        rf.write(compact_header(mode,count,form,rows)); ff.write(fullmax_header(rows))
        items.append((form,entry,path,fm_path,raw_path,fm_raw_path))
        handles.append((form,rf,ff))

    buffers={form:[bytearray(),bytearray()] for form in forms}
    flush_every=16384
    try:
        for tie,(p,mask) in enumerate(iter_candidates(candidate_path),start=1):
            bids,_=generator.mask_info(mask)
            if len(bids)!=count:
                raise RuntimeError(f'因縁数不一致: {mode}/{count} {p}')
            # 同一ファミリは正本ラインが同じなので成立集合検証も1回で十分。
            if generator.placement_mask(p,forms[0])!=mask:
                raise RuntimeError(f'配置と因縁集合不一致: {mode}/{count}/{forms[0]} {p}')
            f4mask=generator.factor4_mask(p,forms[0],bids)
            _,normal_raw,fullmax_raw=generator.shared_effects(p,mask,f4mask)
            for form,rf,ff in handles:
                r,fm=generator.records_from_shared(p,mask,form,tie,f4mask,normal_raw,fullmax_raw,bids)
                buffers[form][0].extend(r); buffers[form][1].extend(fm)
            if tie % flush_every==0:
                for form,rf,ff in handles:
                    rf.write(buffers[form][0]); ff.write(buffers[form][1])
                    buffers[form][0].clear(); buffers[form][1].clear()
                if tie % 131072==0:
                    release_memory()
        for form,rf,ff in handles:
            if buffers[form][0]: rf.write(buffers[form][0])
            if buffers[form][1]: ff.write(buffers[form][1])
    finally:
        for _,rf,ff in handles:
            rf.close(); ff.close()

    # レコード確定後の圧縮だけを並列化。計算順・tie順・中身は変えない。
    jobs=[]
    with ThreadPoolExecutor(max_workers=min(4,len(items)*2)) as ex:
        for form,entry,path,fm_path,raw_path,fm_raw_path in items:
            jobs.append(ex.submit(_gzip_raw_file,raw_path,path))
            jobs.append(ex.submit(_gzip_raw_file,fm_raw_path,fm_path))
        for job in jobs: job.result()

    result={}
    for form,entry,path,fm_path,raw_path,fm_raw_path in items:
        if path.stat().st_size > 25*1024*1024 or fm_path.stat().st_size > 25*1024*1024:
            raise RuntimeError(f'25MB制限超過: {form} {path.stat().st_size} {fm_path.stat().st_size}')
        entry.update(file_meta(path,rows,16+rows*REC))
        fm_meta=file_meta(fm_path,rows,16+rows*FULLMAX_REC,FULLMAX_REC)
        manifest.setdefault('fullmax_stats',{}).setdefault(mode,{}).setdefault(str(count),{})[form]=fm_meta
        result[form]={'rows':rows,'records_reused':0,'generation':'current_source_only'}
        raw_path.unlink(missing_ok=True); fm_raw_path.unlink(missing_ok=True)
    manifest['fullmax_stats_record_size']=FULLMAX_REC
    manifest['fullmax_model']='全MAX: 見聞録MAX+鬼神石MAX+転生MAX(最小文曲使用英傑を除外)'
    try: temp_raw.rmdir()
    except OSError: pass
    return result

def fresh_manifest() -> dict:
    datasets={'normal':{},'grade3':{}}
    for mode,counts in (('normal',(7,8,9)),('grade3',(5,6,7,8,9))):
        for count in counts:
            datasets[mode][str(count)]={}
            for form in LINES:
                code=FORM_FILE_CODE[form]
                datasets[mode][str(count)][form]={
                    'file':f'data/compact_search_v2/jinpo_{mode}_c{count}_{code}_v2.bin.gz'
                }
    return {
        'version':'tairano-current-source-rebuild',
        'magic':'JCF1',
        'header_size':16,
        'record_size':REC,
        'stats':STATS,
        'hero_names':[],
        'bond_names':[],
        'datasets':datasets,
        'notes':[],
    }

def main():
    started=time.time()
    # 現行の命名規則と正本からmanifestを毎回新規作成する。
    manifest=fresh_manifest()
    heroes,grade3,bonds,bond_names,coef,formation_bonus_pct=load_model()
    report={
        'status':'RUNNING',
        'generation_mode':'full_current_source_only',
        'full_regeneration':True,
        'source_of_truth_only':True,
        'hero_count':len(heroes),
        'grade3_hero_count':len(grade3),
        'datasets':{},
    }

    max_hid=max(heroes,default=0)
    hero_names=['']*(max_hid+1)
    for hid,h in heroes.items(): hero_names[hid]=h['name']
    manifest['hero_names']=hero_names
    max_bid=max(bonds,default=0)
    names=['']*(max_bid+1)
    for bid,name in bond_names.items(): names[bid]=name
    manifest['bond_names']=names
    manifest['record_size']=REC

    families=(('衡軛','鶴翼'),('魚鱗','方円'))

    temp_dir=REPORT_DIR/'current_candidates'
    temp_dir.mkdir(parents=True,exist_ok=True)
    families=(('衡軛','鶴翼'),('魚鱗','方円'))

    print('STAGE normal generator',flush=True)
    normal=Generator(sorted(heroes),heroes,bonds,coef,formation_bonus_pct)
    print('STAGE normal cycle',flush=True)
    cycle=normal.generate_cycle({7,8,9})
    cycle_files={}
    for count in (7,8,9):
        path=temp_dir/f'normal_c{count}_cycle.tmp'
        cycle_files[count]=(path,dump_candidates(cycle[count],path))
    del cycle; release_memory()
    print('STAGE normal disjoint',flush=True)
    disjoint=normal.generate_disjoint({7,8,9})
    disjoint_files={}
    for count in (7,8,9):
        path=temp_dir/f'normal_c{count}_disjoint.tmp'
        disjoint_files[count]=(path,dump_candidates(disjoint[count],path))
    del disjoint; release_memory()
    for count in (7,8,9):
        for forms,(path,rows) in ((families[0],disjoint_files[count]),(families[1],cycle_files[count])):
            print('WRITE','normal',count,forms,rows,flush=True)
            pair=write_family_pair(manifest,normal,'normal',count,forms,path,rows)
            for form,val in pair.items(): report['datasets'][f'normal/{count}/{form}']=val
            path.unlink(missing_ok=True); release_memory()
    del normal; release_memory()

    print('STAGE grade3 generator',flush=True)
    grade=Generator(grade3,heroes,bonds,coef,formation_bonus_pct)
    print('STAGE grade3 cycle',flush=True)
    cycle=grade.generate_cycle({5,6,7,8,9})
    cycle_files={}
    for count in (5,6,7,8,9):
        path=temp_dir/f'grade3_c{count}_cycle.tmp'
        cycle_files[count]=(path,dump_candidates(cycle[count],path))
    del cycle; release_memory()
    print('STAGE grade3 disjoint',flush=True)
    disjoint=grade.generate_disjoint({5,6,7,8,9})
    disjoint_files={}
    for count in (5,6,7,8,9):
        path=temp_dir/f'grade3_c{count}_disjoint.tmp'
        disjoint_files[count]=(path,dump_candidates(disjoint[count],path))
    del disjoint; release_memory()
    for count in (5,6,7,8,9):
        for forms,(path,rows) in ((families[0],disjoint_files[count]),(families[1],cycle_files[count])):
            print('WRITE','grade3',count,forms,rows,flush=True)
            pair=write_family_pair(manifest,grade,'grade3',count,forms,path,rows)
            for form,val in pair.items(): report['datasets'][f'grade3/{count}/{form}']=val
            path.unlink(missing_ok=True); release_memory()
    del grade; release_memory()
    try: temp_dir.rmdir()
    except OSError: pass

    manifest['generator']={
        'name':'tools-next/rebuild_all_compact.py',
        'source_of_truth':['source-next/英傑一覧.csv','data/jinpo_inen_master.csv','data/91因縁_計算式_倍率展開.csv','data/formation_bonus.csv','data/jinpo_formation_spec.json','tools-next/factor4_optimizer.py','tools-next/fullmax_model.py'],
        'full_regeneration':True,
        'source_of_truth_only':True,
    }
    manifest['notes']=['たいらの式: 現行正本から毎回完全再生成。']
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    report['status']='PASS'
    report['seconds']=round(time.time()-started,3)
    report['full_records']=sum(v['rows'] for v in report['datasets'].values())
    report['semantic_unique_records']=report['full_records']//2
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','full_records':report['full_records'],'source_of_truth_only':True,'seconds':report['seconds']},ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()
