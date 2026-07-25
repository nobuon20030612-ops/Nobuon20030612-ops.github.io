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
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'jinpo-next'
DATA = SITE / 'data' / 'compact_search_v2'
MANIFEST = DATA / 'jinpo_unified_search_manifest.json'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'generation_report.json'
SYNC_REPORT = REPORT_DIR / 'master_sync.json'
REC = 52
STATS = ['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
LINES = {
    '衡軛': [(0,1,2),(3,4,5)],
    '鶴翼': [(0,1,2),(3,4,5)],
    '魚鱗': [(0,1,2),(2,3,4),(4,5,0)],
    '方円': [(1,2,3),(3,4,5),(1,0,5)],
}

def csv_rows(path: Path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def norm_stat(s: str) -> str:
    s = str(s or '').strip().replace('生命力','生命')
    return {'耐久':'耐久力','器用':'器用さ','土':'土属性','水':'水属性','火':'火属性','風':'風属性'}.get(s,s)


def gzread(path: Path) -> bytes:
    return gzip.decompress(path.read_bytes())


def gzwrite(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('wb') as out:
        with gzip.GzipFile(filename='', mode='wb', fileobj=out, compresslevel=6, mtime=0) as z:
            z.write(raw)


def meta(path: Path, raw: bytes, rows: int) -> dict:
    gz = path.read_bytes()
    return {
        'file': str(path.relative_to(SITE)).replace('\\','/'),
        'rows': rows,
        'gzip_bytes': len(gz),
        'raw_bytes': len(raw),
        'sha256_16': hashlib.sha256(gz).hexdigest()[:16],
    }


def canonical_cycle(p):
    s = list(p)
    variants = []
    for shift in (0,2,4):
        variants.append(tuple(s[shift:]+s[:shift]))
    rev = [s[0],s[5],s[4],s[3],s[2],s[1]]
    for shift in (0,2,4):
        variants.append(tuple(rev[shift:]+rev[:shift]))
    return min(variants)


def fish_to_hoen(p):
    # 魚鱗 ABC/CDE/EFA -> 方円の3ラインが同じ3集合になるよう1つ回転。
    return (p[5],p[0],p[1],p[2],p[3],p[4])


class Generator:
    def __init__(self, allowed_ids: list[int], heroes: dict, bonds: dict, coef: dict, formation_bonus_pct: dict):
        self.ids = sorted(allowed_ids)
        self.heroes = heroes
        self.bonds = bonds
        self.coef = coef
        self.formation_bonus_pct = formation_bonus_pct
        self.tm: dict[tuple[int,int,int], int] = defaultdict(int)
        self.pair_groups: dict[tuple[int,int], tuple[tuple[int,tuple[int,...]],...]] = {}
        self.assign_cache = {}
        self._build_triple_masks()
        self._build_nonzero_pair_groups()

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

    def groups(self,a,b):
        return self.pair_groups.get((a,b) if a<b else (b,a),())

    def triple_mask(self,a,b,c):
        return self.tm.get(tuple(sorted((a,b,c))),0)

    def placement_mask(self,p,form):
        mask = 0
        for ln in LINES[form]:
            mask |= self.triple_mask(p[ln[0]],p[ln[1]],p[ln[2]])
        return mask

    def generate_cycle(self, targets: set[int]):
        outs = {t:{} for t in targets}
        max_target = max(targets)
        ids = self.ids

        def add(target, A,B,C,D,E,F, mask):
            if len({A,B,C,D,E,F}) != 6:
                return
            p = canonical_cycle((A,B,C,D,E,F))
            key = (tuple(sorted(p)), mask)
            old = outs[target].get(key)
            if old is None or p < old:
                outs[target][key] = p

        # 3ラインすべてが少なくとも1因縁を持つケース。
        for A,C,E in itertools.combinations(ids,3):
            g1,g2,g3 = self.groups(A,C), self.groups(C,E), self.groups(A,E)
            if not g1 or not g2 or not g3:
                continue
            shared = {A,C,E}
            for m1,L1 in g1:
                for m2,L2 in g2:
                    u = m1 | m2
                    if u.bit_count() > max_target:
                        continue
                    for m3,L3 in g3:
                        mask = u | m3
                        n = mask.bit_count()
                        if n not in outs:
                            continue
                        for B in L1:
                            if B in shared:
                                continue
                            for D in L2:
                                if D in shared or D == B:
                                    continue
                                for F in L3:
                                    if F in shared or F == B or F == D:
                                        continue
                                    add(n,A,B,C,D,E,F,mask)

        # ちょうど2ラインが有効、残り1ラインは0因縁のケース。
        # 1ラインだけでは最大4因縁なので、検索対象5～9因縁ではこれで全ケースを覆う。
        cases = ((0,1,2),(1,2,0),(2,0,1))
        for A,C,E in itertools.combinations(ids,3):
            vertices = (A,C,E)
            groups = (self.groups(A,C), self.groups(C,E), self.groups(A,E))
            for i,j,k in cases:
                gi,gj = groups[i],groups[j]
                if not gi or not gj:
                    continue
                for mi,Li in gi:
                    for mj,Lj in gj:
                        mask = mi | mj
                        n = mask.bit_count()
                        if n not in outs:
                            continue
                        for xi in Li:
                            if xi in vertices:
                                continue
                            for xj in Lj:
                                if xj in vertices or xj == xi:
                                    continue
                                used = {A,C,E,xi,xj}
                                if k == 2:
                                    u,v = A,E
                                elif k == 0:
                                    u,v = A,C
                                else:
                                    u,v = C,E
                                for z in ids:
                                    if z in used or self.triple_mask(u,v,z) != 0:
                                        continue
                                    mids = [None,None,None]
                                    mids[i],mids[j],mids[k] = xi,xj,z
                                    add(n,A,mids[0],C,mids[1],E,mids[2],mask)
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

    def assign_factor4_bits(self,line,bid):
        key = (tuple(line),bid)
        if key in self.assign_cache:
            return self.assign_cache[key]
        req = self.bonds[bid]
        used = set()
        assigned = []
        def dfs(i):
            if i == 3:
                return True
            factor = req[i]
            for hi,hid in enumerate(line):
                if hi in used:
                    continue
                if factor in self.heroes[hid]['f']:
                    used.add(hi); assigned.append((hi,factor))
                    if dfs(i+1):
                        return True
                    assigned.pop(); used.remove(hi)
            return False
        if not dfs(0):
            self.assign_cache[key] = -1
            return -1
        bits = 0
        for hi,factor in assigned:
            f4 = self.heroes[line[hi]]['f'][3]
            if f4 and f4 not in {'-','対象外'} and factor == f4:
                bits |= 1 << hi
        self.assign_cache[key] = bits
        return bits

    def factor4_count(self,p,form,bond_ids):
        slots = set()
        for ln in LINES[form]:
            line = tuple(p[i] for i in ln)
            for bid in bond_ids:
                bits = self.assign_factor4_bits(line,bid)
                if bits < 0:
                    continue
                for hi in range(3):
                    if bits & (1 << hi):
                        slots.add(ln[hi])
        return len(slots)

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

    def record(self,p,bond_ids,form,tie):
        vals,total = self.calc_stats(p,bond_ids,form)
        r = bytearray(REC)
        struct.pack_into('<6H',r,0,*p)
        for i,bid in enumerate(bond_ids):
            r[12+i] = bid
        for i,v in enumerate(vals):
            struct.pack_into('<H',r,21+2*i,v)
        struct.pack_into('<I',r,43,total)
        r[47] = self.factor4_count(p,form,bond_ids)
        struct.pack_into('<I',r,48,tie)
        return bytes(r)


def load_model():
    heroes = {}
    grade3 = []
    hero_rows = csv_rows(SITE/'data'/'jinpo_eiketsu_master.csv')
    for r in hero_rows:
        iid = str(r.get('internal_id','')).strip()
        if not iid.startswith('EIK_'):
            continue
        hid = int(iid[4:])
        if hid <= 0 or hid > 65535:
            raise RuntimeError(f'internal_idがcompact形式範囲外: {iid}')
        if hid in heroes:
            raise RuntimeError(f'internal_id重複: {iid}')
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
            raise RuntimeError(f'因縁Noがcompact形式範囲外: {bid}')
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

    # 陣形補正はformation_bonus.csvを唯一の正として読み込む。
    formation_bonus_pct = {}
    for r in csv_rows(SITE/'data'/'formation_bonus.csv'):
        form = str(r.get('formation','')).strip()
        if not form:
            continue
        if form not in LINES:
            raise RuntimeError(f'formation_bonus.csvに未知の陣形: {form}')
        pct = []
        for stat in STATS:
            raw_value = str(r.get(stat,'')).strip() or '1.00'
            try:
                factor = float(raw_value)
            except Exception:
                raise RuntimeError(f'formation_bonus.csvの倍率が数値ではありません: {form} {stat}={raw_value}')
            hundred = round((factor - 1.0) * 100)
            if abs(factor - (1.0 + hundred/100.0)) > 1e-9 or hundred < 0:
                raise RuntimeError(f'formation_bonus.csvの倍率は1%刻みの1.00以上で指定してください: {form} {stat}={raw_value}')
            pct.append(int(hundred))
        formation_bonus_pct[form] = pct
    missing_forms = sorted(set(LINES) - set(formation_bonus_pct))
    if missing_forms:
        raise RuntimeError('formation_bonus.csvに陣形が不足: '+', '.join(missing_forms))

    return heroes,sorted(grade3),bonds,bond_names,coef,formation_bonus_pct


def write_dataset(manifest, generator: Generator, mode: str, count: int, form: str, generated: dict, dirty_ids: set[int], default_transform=lambda p:p):
    print('WRITE',mode,count,form,len(generated),flush=True)
    entry = manifest['datasets'][mode][str(count)][form]
    path = SITE/entry['file']
    old_raw = gzread(path)
    if len(old_raw) < 16 or old_raw[:4] != b'JCF1' or struct.unpack_from('<H',old_raw,6)[0] != REC:
        raise RuntimeError(f'既存compact DB不正: {entry["file"]}')
    old_n = (len(old_raw)-16)//REC
    remaining = set(generated.keys())
    out = bytearray(16 + len(generated)*REC)
    out[:16] = old_raw[:16]
    struct.pack_into('<I',out,8,len(generated))
    out[12] = count
    write_index = 0
    max_tie = 0
    preserved = 0
    reused_bytes = 0
    placement_replaced = 0
    removed = 0

    for i in range(old_n):
        off = 16+i*REC
        old_p = tuple(struct.unpack_from('<6H',old_raw,off))
        mask = 0
        for b in old_raw[off+12:off+12+count]:
            if b:
                mask |= 1 << (b-1)
        key = (tuple(sorted(old_p)),mask)
        tie = struct.unpack_from('<I',old_raw,off+48)[0]
        max_tie = max(max_tie,tie)
        if key not in generated:
            removed += 1
            continue
        dirty = bool(set(key[0]) & dirty_ids)
        if not dirty:
            p = old_p
            rec = old_raw[off:off+REC]
            preserved += 1
            reused_bytes += 1
        else:
            if generator.placement_mask(old_p,form) == mask:
                p = old_p
                preserved += 1
            else:
                p = default_transform(generated[key])
                placement_replaced += 1
            bids = generator.bond_ids(mask)
            rec = generator.record(p,bids,form,tie)
        dest = 16 + write_index*REC
        out[dest:dest+REC] = rec
        write_index += 1
        remaining.discard(key)

    next_tie = max_tie + 1
    for key in sorted(remaining,key=lambda k:(k[0],k[1])):
        p = default_transform(generated[key])
        bids = generator.bond_ids(key[1])
        if len(bids) != count:
            raise RuntimeError(f'因縁数不一致: {mode}/{count}/{form}')
        if generator.placement_mask(p,form) != key[1]:
            raise RuntimeError(f'配置と因縁集合不一致: {mode}/{count}/{form} {p}')
        rec = generator.record(p,bids,form,next_tie)
        dest = 16 + write_index*REC
        out[dest:dest+REC] = rec
        write_index += 1
        next_tie += 1

    if write_index != len(generated):
        raise RuntimeError(f'compact DB生成件数不一致: {mode}/{count}/{form} {write_index}!={len(generated)}')
    raw = bytes(out)
    gzwrite(path,raw)
    entry.update(meta(path,raw,len(generated)))
    added_count = len(remaining)
    result = {
        'rows':len(generated),
        'added':added_count,
        'removed':removed,
        'old_placement_preserved':preserved,
        'record_bytes_reused':reused_bytes,
        'old_placement_replaced':placement_replaced,
    }
    # 大規模set/bytearrayを次の陣形へ持ち越さない。GitHub Actionsのメモリピークを抑える。
    del remaining, out, old_raw, raw
    gc.collect()
    try:
        import ctypes
        ctypes.CDLL('libc.so.6').malloc_trim(0)
    except Exception:
        pass
    return result

def main():
    started = time.time()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    heroes,grade3,bonds,bond_names,coef,formation_bonus_pct = load_model()
    report = {'status':'RUNNING','hero_count':len(heroes),'grade3_hero_count':len(grade3),'datasets':{}}
    dirty_ids = set()
    if SYNC_REPORT.exists():
        sync = json.loads(SYNC_REPORT.read_text(encoding='utf-8'))
        dirty_ids = {int(str(x).replace('EIK_','')) for x in sync.get('dirty_internal_ids', [])}
    else:
        # 単体実行では安全側。通常のGitHub Actions経路ではmaster_sync.jsonが必ず生成される。
        dirty_ids = set(heroes)
    report['dirty_internal_ids'] = [f'EIK_{x:04d}' for x in sorted(dirty_ids)]

    # manifestのID表示表はmaster/因縁masterから毎回作り直す。削除済みIDの残骸を残さない。
    max_hid = max(heroes,default=0)
    hero_names = ['']*(max_hid+1)
    for hid,h in heroes.items():
        hero_names[hid] = h['name']
    manifest['hero_names'] = hero_names
    max_bid = max(bonds,default=0)
    names = ['']*(max_bid+1)
    for bid,name in bond_names.items():
        names[bid] = name
    manifest['bond_names'] = names
    manifest['record_size'] = REC

    # 通常7～9: 現在の全英傑から完全再生成。
    print('STAGE normal generator init', flush=True)
    normal_gen = Generator(sorted(heroes),heroes,bonds,coef,formation_bonus_pct)
    print('STAGE normal cycle', flush=True)
    normal_cycle = normal_gen.generate_cycle({7,8,9})
    print('STAGE normal disjoint', flush=True)
    normal_disjoint = normal_gen.generate_disjoint({7,8,9})
    print('STAGE normal write', flush=True)
    for count in (7,8,9):
        report['datasets'][f'normal/{count}/衡軛'] = write_dataset(manifest,normal_gen,'normal',count,'衡軛',normal_disjoint[count],dirty_ids)
        report['datasets'][f'normal/{count}/鶴翼'] = write_dataset(manifest,normal_gen,'normal',count,'鶴翼',normal_disjoint[count],dirty_ids)
        report['datasets'][f'normal/{count}/魚鱗'] = write_dataset(manifest,normal_gen,'normal',count,'魚鱗',normal_cycle[count],dirty_ids)
        report['datasets'][f'normal/{count}/方円'] = write_dataset(manifest,normal_gen,'normal',count,'方円',normal_cycle[count],dirty_ids,fish_to_hoen)
    del normal_cycle,normal_disjoint,normal_gen

    # 等級3以下5～9: コスト6以下だけから完全再生成。
    print('STAGE grade generator init', flush=True)
    grade_gen = Generator(grade3,heroes,bonds,coef,formation_bonus_pct)
    print('STAGE grade cycle', flush=True)
    grade_cycle = grade_gen.generate_cycle({5,6,7,8,9})
    print('STAGE grade disjoint', flush=True)
    grade_disjoint = grade_gen.generate_disjoint({5,6,7,8,9})
    print('STAGE grade write', flush=True)
    for count in (5,6,7,8,9):
        report['datasets'][f'grade3/{count}/衡軛'] = write_dataset(manifest,grade_gen,'grade3',count,'衡軛',grade_disjoint[count],dirty_ids)
        report['datasets'][f'grade3/{count}/鶴翼'] = write_dataset(manifest,grade_gen,'grade3',count,'鶴翼',grade_disjoint[count],dirty_ids)
        report['datasets'][f'grade3/{count}/魚鱗'] = write_dataset(manifest,grade_gen,'grade3',count,'魚鱗',grade_cycle[count],dirty_ids)
        report['datasets'][f'grade3/{count}/方円'] = write_dataset(manifest,grade_gen,'grade3',count,'方円',grade_cycle[count],dirty_ids,fish_to_hoen)

    manifest['generator'] = {
        'name':'tools-next/rebuild_all_compact.py',
        'source_of_truth':['source-next/英傑一覧.csv','jinpo-next/data/jinpo_inen_master.csv','jinpo-next/data/91因縁_計算式_倍率展開.csv','jinpo-next/data/formation_bonus.csv'],
        'full_regeneration':True,
    }
    notes = [x for x in manifest.get('notes',[]) if 'full regeneration' not in str(x).lower()]
    notes.append('Phase2 full regeneration from current hero/bond/formation source of truth')
    manifest['notes'] = notes
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    report['status'] = 'PASS'
    report['seconds'] = round(time.time()-started,3)
    report['full_records'] = sum(v['rows'] for v in report['datasets'].values())
    report['added_records'] = sum(v['added'] for v in report['datasets'].values())
    report['removed_records'] = sum(v['removed'] for v in report['datasets'].values())
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','hero_count':len(heroes),'full_records':report['full_records'],'added_records':report['added_records'],'removed_records':report['removed_records'],'seconds':report['seconds']},ensure_ascii=False))


if __name__ == '__main__':
    main()
