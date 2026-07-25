#!/usr/bin/env python3
from __future__ import annotations
import csv, gzip, hashlib, itertools, json, math, struct
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SITE = ROOT
DATA=SITE/'data'/'compact_search_v2'
MANIFEST=DATA/'jinpo_unified_search_manifest.json'
REC=52
STATS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
STAT_OFFSETS={s:21+2*i for i,s in enumerate(STATS)}
LINES={
 '衡軛':[(0,1,2),(3,4,5)],
 '鶴翼':[(0,1,2),(3,4,5)],
 '魚鱗':[(0,1,2),(2,3,4),(4,5,0)],
 '方円':[(1,2,3),(3,4,5),(1,0,5)],
}
BONUS_PCT={
 '衡軛':{s:5 for s in STATS},
 '鶴翼':{s:(10 if s in {'生命','耐久力','魅力','土属性','水属性','火属性','風属性'} else 0) for s in STATS},
 '魚鱗':{s:(10 if s in {'気合','腕力','耐久力','器用さ'} else 0) for s in STATS},
 '方円':{s:(10 if s in {'気合','知力','魅力','土属性','水属性','火属性','風属性'} else 0) for s in STATS},
}

def read_csv(p):
    with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))

def gzread(p):
    with gzip.open(p,'rb') as f:return f.read()

def gzwrite(p,raw):
    with p.open('wb') as out:
        with gzip.GzipFile(filename='',mode='wb',fileobj=out,compresslevel=6,mtime=0) as gz:gz.write(raw)

def file_meta(p,raw,rows):
    return {'file':str(p.relative_to(SITE)).replace('\\','/'),'rows':rows,'gzip_bytes':p.stat().st_size,'raw_bytes':len(raw),'sha256_16':hashlib.sha256(p.read_bytes()).hexdigest()[:16]}

def norm_stat(s):
    s=str(s or '').strip().replace('生命力','生命')
    return {'耐久':'耐久力','器用':'器用さ','土':'土属性','水':'水属性','火':'火属性','風':'風属性'}.get(s,s)

hero_rows=read_csv(SITE/'data'/'jinpo_eiketsu_master.csv')
heroes={}; grade3=[]
for r in hero_rows:
    iid=r.get('internal_id','')
    if not iid.startswith('EIK_'):continue
    n=int(iid[4:])
    factors=[str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3','因子4')]
    heroes[n]={'factors':factors,'stats':[int(float(r.get(s) or 0)) for s in STATS],'cost':int(float(r.get('コスト') or 99))}
    if heroes[n]['cost']<=6:grade3.append(n)
grade3.sort()

inen_rows=read_csv(SITE/'data'/'jinpo_inen_master.csv')
bonds={}; bond_name={}
for r in inen_rows:
    bid=int(r['No']);bonds[bid]=[str(r[k]).strip() for k in ('因子1','因子2','因子3')];bond_name[bid]=str(r['因縁名']).strip()

coef_name=defaultdict(dict)
for r in read_csv(SITE/'data'/'91因縁_計算式_倍率展開.csv'):
    name=str(r.get('因縁名','')).strip();st=norm_stat(r.get('対象ステータス',''));v=float(r.get('実効係数') or 0)
    if name and st in STATS and v>0:coef_name[name][st]=v
coef={bid:[float(coef_name.get(name,{}).get(s,0)) for s in STATS] for bid,name in bond_name.items()}

# grade3 factor->hero index
by_factor=defaultdict(list)
for h in grade3:
    for f in set(x for x in heroes[h]['factors'] if x and x not in {'-','対象外'}):by_factor[f].append(h)

# Every triple's complete activated-bond bitmask, generated bond-wise with 3 distinct heroes.
triple_mask=defaultdict(int)
for bid,req in bonds.items():
    a_list,b_list,c_list=(by_factor[x] for x in req)
    bit=1<<(bid-1)
    for a in a_list:
        for b in b_list:
            if b==a:continue
            for c in c_list:
                if c==a or c==b:continue
                triple_mask[tuple(sorted((a,b,c)))] |= bit

def mask_bonds(mask):return tuple(i+1 for i in range(len(bonds)) if (mask>>i)&1)

def canonical_cycle(p):
    # p=(A,B,C,D,E,F), lines ABC/CDE/EFA. Pick the smallest slot tuple
    # among the 6 dihedral symmetries of the same three-line cycle.
    A,B,C,D,E,F=p
    seq=[A,B,C,D,E,F]
    variants=[]
    for shift in (0,2,4):
        variants.append(tuple(seq[shift:]+seq[:shift]))
    rev=[A,F,E,D,C,B]
    for shift in (0,2,4):
        variants.append(tuple(rev[shift:]+rev[:shift]))
    return min(variants)

def pair_groups(target):
    pg={}
    for i,u in enumerate(grade3):
        for v in grade3[i+1:]:
            d=defaultdict(list)
            for w in grade3:
                if w==u or w==v:continue
                m=triple_mask.get(tuple(sorted((u,v,w))),0)
                if m.bit_count()<=target:d[m].append(w)
            pg[(u,v)]=tuple((m,tuple(xs)) for m,xs in d.items())
    return pg

def generate_cycle(target):
    pg=pair_groups(target)
    def groups(u,v):return pg[(u,v) if u<v else (v,u)]
    out={}
    for A,C,E in itertools.combinations(grade3,3):
        shared={A,C,E}
        for m1,L1 in groups(A,C):
            for m2,L2 in groups(C,E):
                u12=m1|m2
                if u12.bit_count()>target:continue
                for m3,L3 in groups(A,E):
                    union=u12|m3
                    if union.bit_count()!=target:continue
                    for B in L1:
                        if B in shared:continue
                        for D in L2:
                            if D in shared or D==B:continue
                            for F in L3:
                                if F in shared or F==B or F==D:continue
                                p=canonical_cycle((A,B,C,D,E,F))
                                key=(tuple(sorted(p)),union)
                                old=out.get(key)
                                if old is None or p<old:out[key]=p
    return out

def generate_disjoint(target):
    by_count=defaultdict(list)
    for t,m in triple_mask.items():
        if m and m.bit_count()<=target:by_count[m.bit_count()].append((t,m))
    out={}
    for c1 in range(1,target+1):
        for c2 in range(c1,target+1):
            if c1+c2<target:continue
            A=by_count.get(c1,());B=by_count.get(c2,())
            for i,(t1,m1) in enumerate(A):
                start=i+1 if A is B else 0
                for t2,m2 in B[start:]:
                    if set(t1)&set(t2):continue
                    union=m1|m2
                    if union.bit_count()!=target:continue
                    a=tuple(sorted(t1));b=tuple(sorted(t2));p=min(a+b,b+a)
                    key=(tuple(sorted(p)),union)
                    old=out.get(key)
                    if old is None or p<old:out[key]=p
    return out

def assignment(line_ids,bid):
    req=bonds[bid];used=set();ans=[]
    def dfs(i):
        if i==3:return True
        factor=req[i]
        for hi,hid in enumerate(line_ids):
            if hi in used:continue
            if factor in heroes[hid]['factors']:
                used.add(hi);ans.append((hi,factor))
                if dfs(i+1):return True
                ans.pop();used.remove(hi)
        return False
    return tuple(ans) if dfs(0) else None

def factor4_count(placement,form,bond_ids):
    used_slots=set()
    for ln in LINES[form]:
        lids=[placement[i] for i in ln]
        for bid in bond_ids:
            a=assignment(lids,bid)
            if a is None:continue
            for hi,factor in a:
                hid=lids[hi];f4=heroes[hid]['factors'][3]
                if f4 and f4 not in {'-','対象外'} and factor==f4:used_slots.add(ln[hi])
    return len(used_slots)

def calc_stats(placement,bond_ids,form):
    base=[sum(heroes[h]['stats'][si] for h in placement) for si in range(len(STATS))]
    raw=[0]*len(STATS)
    for bid in bond_ids:
        cc=coef.get(bid,[0.0]*len(STATS))
        for si,mult in enumerate(cc):
            if mult:raw[si]+=math.floor(base[si]*mult+1e-9)
    vals=[]
    for si,s in enumerate(STATS):
        pct=BONUS_PCT[form][s]
        vals.append((raw[si]*(100+pct))//100)
    return vals,sum(vals)

def make_record(placement,bond_ids,form,tie):
    if len(placement)!=6 or len(set(placement))!=6:raise RuntimeError('bad placement')
    vals,total=calc_stats(placement,bond_ids,form)
    if any(v<0 or v>65535 for v in vals):raise RuntimeError('stat uint16 overflow')
    rec=bytearray(REC)
    struct.pack_into('<6H',rec,0,*placement)
    for i,bid in enumerate(bond_ids):rec[12+i]=bid
    for i,v in enumerate(vals):struct.pack_into('<H',rec,21+2*i,v)
    struct.pack_into('<I',rec,43,total)
    rec[47]=factor4_count(placement,form,bond_ids)
    struct.pack_into('<I',rec,48,tie)
    return bytes(rec)

def replace_dataset(manifest,count,form,keymap):
    entry=manifest['datasets']['grade3'][str(count)][form]
    path=SITE/entry['file'];old=gzread(path);header=bytearray(old[:16])
    items=sorted(keymap.items(),key=lambda kv:(kv[0][0],kv[0][1],kv[1]))
    body=[]
    for idx,((six,mask),fish_p) in enumerate(items,1):
        bond_ids=mask_bonds(mask)
        if len(bond_ids)!=count:raise RuntimeError('bond count mismatch')
        p=fish_p if form=='魚鱗' else ((fish_p[5],fish_p[0],fish_p[1],fish_p[2],fish_p[3],fish_p[4]) if form=='方円' else fish_p)
        body.append(make_record(p,bond_ids,form,idx))
    struct.pack_into('<I',header,8,len(items));header[12]=count
    raw=bytes(header)+b''.join(body);gzwrite(path,raw);entry.update(file_meta(path,raw,len(items)))

def rewrite_stats_in_full(manifest):
    changed={}
    for mode,counts in manifest['datasets'].items():
        for cstr,forms in counts.items():
            count=int(cstr)
            # normal5/6 are inaccessible legacy datasets and contain orphan IDs; leave them isolated.
            if mode=='normal' and count in (5,6):continue
            for form,entry in forms.items():
                path=SITE/entry['file'];raw=bytearray(gzread(path));rows=entry['rows'];diff_rows=0
                for i in range(rows):
                    b=16+i*REC
                    placement=struct.unpack_from('<6H',raw,b)
                    bond_ids=tuple(x for x in raw[b+12:b+12+count] if x)
                    if any(h not in heroes for h in placement):raise RuntimeError(f'unknown hero {mode}/{count}/{form} row {i}')
                    vals,total=calc_stats(placement,bond_ids,form)
                    old=[struct.unpack_from('<H',raw,b+21+2*k)[0] for k in range(len(STATS))]
                    old_total=struct.unpack_from('<I',raw,b+43)[0]
                    if old!=vals or old_total!=total:diff_rows+=1
                    for k,v in enumerate(vals):struct.pack_into('<H',raw,b+21+2*k,v)
                    struct.pack_into('<I',raw,b+43,total)
                # normalize header count as integrity invariant
                struct.pack_into('<I',raw,8,rows)
                gzwrite(path,bytes(raw));entry.update(file_meta(path,bytes(raw),rows));changed[f'{mode}/{count}/{form}']=diff_rows
    return changed

def existing_keyset(manifest,count,form):
    e=manifest['datasets']['grade3'][str(count)][form];raw=gzread(SITE/e['file']);out=set()
    for i in range(e['rows']):
        b=16+i*REC;ids=tuple(sorted(struct.unpack_from('<6H',raw,b)));bs=tuple(sorted(x for x in raw[b+12:b+12+count] if x));out.add((ids,bs))
    return out

def main():
    m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    # Generate exact grade3 5/6 from current master/rules.
    c5_cycle=generate_cycle(5); c6_cycle=generate_cycle(6); c7_cycle=generate_cycle(7)
    c5_disjoint=generate_disjoint(5); c6_disjoint=generate_disjoint(6)
    if len(c7_cycle)!=2:raise RuntimeError(f'grade3 c7 validation failed: {len(c7_cycle)} != 2')
    if c6_disjoint:raise RuntimeError(f'grade3 c6 disjoint expected 0: {len(c6_disjoint)}')
    expected={'c5_disjoint':1240,'c5_cycle':131607,'c6_cycle':955,'c7_cycle':2}
    actual={'c5_disjoint':len(c5_disjoint),'c5_cycle':len(c5_cycle),'c6_cycle':len(c6_cycle),'c7_cycle':len(c7_cycle)}
    if actual!=expected:raise RuntimeError(f'exact generation count changed {actual} != {expected}')
    replace_dataset(m,5,'衡軛',c5_disjoint);replace_dataset(m,5,'鶴翼',c5_disjoint)
    replace_dataset(m,5,'魚鱗',c5_cycle);replace_dataset(m,5,'方円',c5_cycle)
    replace_dataset(m,6,'衡軛',c6_disjoint);replace_dataset(m,6,'鶴翼',c6_disjoint)
    replace_dataset(m,6,'魚鱗',c6_cycle);replace_dataset(m,6,'方円',c6_cycle)
    stat_changed=rewrite_stats_in_full(m)
    m.setdefault('notes',[]).append('grade3 5/6 exact regeneration: unique activated bond set after all lines are fully re-evaluated')
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'exact_counts':actual,'stat_rows_rewritten_from_old_values':stat_changed},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
