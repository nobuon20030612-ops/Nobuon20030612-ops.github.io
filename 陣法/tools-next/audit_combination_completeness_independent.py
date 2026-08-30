#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,json,struct,time
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CORE=ROOT/'data'/'bond56_index'/'bond56_core.bin.gz'
MANIFEST=ROOT/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
REPORT=ROOT/'_jinpo-next-report'/'combination_completeness_independent.json'
REC=52
FORM_FAMILY={'衡軛':'disjoint','鶴翼':'disjoint','魚鱗':'cycle','方円':'cycle'}

def rows(p):
    with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))

def parse_core():
    raw=gzip.decompress(CORE.read_bytes()); o=0
    if raw[:4]!=b'B56I': raise RuntimeError('bond56_core magic')
    o=4
    v,H,mc,gc,mic,tc=struct.unpack_from('<6I',raw,o);o+=24
    if v!=2: raise RuntimeError('bond56_core version')
    masks=[]
    for _ in range(mc):
        lo,hi=struct.unpack_from('<QQ',raw,o);o+=16;masks.append(lo|(hi<<64))
    groups=[]
    for _ in range(gc):
        a,b,m,c,off=struct.unpack_from('<HHHHI',raw,o);o+=12;groups.append((a,b,m,c,off))
    mids=struct.unpack_from('<%dH'%mic,raw,o);o+=2*mic
    triples=[]
    for _ in range(tc):
        a,b,c,m=struct.unpack_from('<HHHH',raw,o);o+=8;triples.append((a,b,c,m))
    if o!=len(raw): raise RuntimeError(f'core trailing {len(raw)-o}')
    return {'H':H,'masks':masks,'groups':groups,'mids':mids,'triples':triples}

def active_mask_from_record(active):
    m=0
    for b in active:m |= 1<<(b-1)
    return m

def read_db_semantic(mode,count,form,manifest):
    e=manifest['datasets'][mode][str(count)][form]
    raw=gzip.decompress((ROOT/e['file']).read_bytes())
    n=struct.unpack_from('<I',raw,8)[0]
    out=set(); exact=0
    for i in range(n):
        off=16+i*REC
        ids=struct.unpack_from('<6H',raw,off)
        active=tuple(raw[off+12:off+12+count])
        key=(tuple(sorted(ids)),active_mask_from_record(active))
        out.add(key); exact+=1
    return out,exact

def build_filtered(core,allowed):
    allowed=set(allowed)
    masks=core['masks']; mids=core['mids']
    pair_groups=defaultdict(list)
    for a,b,mi,c,off in core['groups']:
        if a not in allowed or b not in allowed: continue
        mm=tuple(x for x in mids[off:off+c] if x in allowed)
        if mm: pair_groups[(a,b)].append((masks[mi],mm))
    triples_by_mask=defaultdict(list)
    triple_mask={}
    for a,b,c,mi in core['triples']:
        if a in allowed and b in allowed and c in allowed:
            m=masks[mi]; t=(a,b,c);triples_by_mask[m].append(t);triple_mask[t]=m
    return pair_groups,triples_by_mask,triple_mask

def gen_disjoint(allowed,triples_by_mask,targets):
    outs={t:set() for t in targets}
    ms=sorted(triples_by_mask)
    for ii,m1 in enumerate(ms):
        L1=triples_by_mask[m1]
        for m2 in ms[ii:]:
            u=m1|m2; n=u.bit_count()
            if n not in outs: continue
            L2=triples_by_mask[m2]
            same=m1==m2
            for i,t1 in enumerate(L1):
                s1=set(t1); start=i+1 if same else 0
                for t2 in L2[start:]:
                    if s1.isdisjoint(t2): outs[n].add((tuple(sorted(t1+t2)),u))
    return outs

def gen_cycle(allowed,pair_groups,triple_mask,targets):
    outs={t:set() for t in targets}; allowed=tuple(sorted(allowed)); aset=set(allowed)
    zero_cache={}
    def groups(a,b): return pair_groups.get((a,b) if a<b else (b,a),())
    def tmask(a,b,c): return triple_mask.get(tuple(sorted((a,b,c))),0)
    def zero(a,b):
        k=(a,b) if a<b else (b,a)
        z=zero_cache.get(k)
        if z is None:
            z=tuple(h for h in allowed if h!=a and h!=b and tmask(a,b,h)==0);zero_cache[k]=z
        return z
    def add(mask, vals):
        n=mask.bit_count()
        if n in outs and len(set(vals))==6: outs[n].add((tuple(sorted(vals)),mask))
    N=len(allowed)
    # Anchor triple A<C<E. Edges AC, CE, AE correspond to the three possible active lines.
    for ai in range(N-2):
        A=allowed[ai]
        for ci in range(ai+1,N-1):
            C=allowed[ci]; gAC=groups(A,C)
            for ei in range(ci+1,N):
                E=allowed[ei]; gCE=groups(C,E); gAE=groups(A,E)
                active_edges=(bool(gAC)+bool(gCE)+bool(gAE))
                if active_edges<2: continue
                fixed={A,C,E}
                # all three active
                if gAC and gCE and gAE:
                    for m1,L1 in gAC:
                      for m2,L2 in gCE:
                        u12=m1|m2
                        for m3,L3 in gAE:
                          u=u12|m3
                          if u.bit_count() not in outs: continue
                          for B in L1:
                            if B in fixed: continue
                            for D in L2:
                              if D in fixed or D==B: continue
                              for F in L3:
                                if F in fixed or F==B or F==D: continue
                                add(u,(A,B,C,D,E,F))
                # AC + CE; AE inactive
                if gAC and gCE:
                    for m1,L1 in gAC:
                      for m2,L2 in gCE:
                        u=m1|m2
                        if u.bit_count() not in outs: continue
                        for B in L1:
                          if B in fixed: continue
                          for D in L2:
                            if D in fixed or D==B: continue
                            used=fixed|{B,D}
                            for F in zero(A,E):
                              if F not in used:add(u,(A,B,C,D,E,F))
                # CE + AE; AC inactive
                if gCE and gAE:
                    for m2,L2 in gCE:
                      for m3,L3 in gAE:
                        u=m2|m3
                        if u.bit_count() not in outs: continue
                        for D in L2:
                          if D in fixed: continue
                          for F in L3:
                            if F in fixed or F==D: continue
                            used=fixed|{D,F}
                            for B in zero(A,C):
                              if B not in used:add(u,(A,B,C,D,E,F))
                # AE + AC; CE inactive
                if gAE and gAC:
                    for m3,L3 in gAE:
                      for m1,L1 in gAC:
                        u=m3|m1
                        if u.bit_count() not in outs: continue
                        for F in L3:
                          if F in fixed: continue
                          for B in L1:
                            if B in fixed or B==F: continue
                            used=fixed|{F,B}
                            for D in zero(C,E):
                              if D not in used:add(u,(A,B,C,D,E,F))
    return outs

def compare_mode(core,mode,allowed,targets,manifest):
    started=time.time();pg,tbm,tm=build_filtered(core,allowed)
    dis=gen_disjoint(allowed,tbm,targets)
    cyc=gen_cycle(allowed,pg,tm,targets)
    result={}
    for count in sorted(targets):
      for form in ('衡軛','鶴翼','魚鱗','方円'):
        if str(count) not in manifest['datasets'].get(mode,{}): continue
        if form not in manifest['datasets'][mode][str(count)]: continue
        got,nrows=read_db_semantic(mode,count,form,manifest)
        exp=dis[count] if FORM_FAMILY[form]=='disjoint' else cyc[count]
        missing=exp-got; extra=got-exp
        result[f'{mode}/{count}/{form}']={
          'rows':nrows,'db_semantic_unique':len(got),'independent_expected':len(exp),
          'missing_from_db':len(missing),'extra_in_db':len(extra),
          'first_missing':[(list(k[0]),[i+1 for i in range(91) if (k[1]>>i)&1]) for k in list(missing)[:3]],
          'first_extra':[(list(k[0]),[i+1 for i in range(91) if (k[1]>>i)&1]) for k in list(extra)[:3]],
        }
    return result, {'triple_count':len(tm),'pair_group_pairs':len(pg),'seconds':round(time.time()-started,3)}

def main():
    started=time.time(); core=parse_core(); m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    hero_rows=rows(ROOT/'data'/'jinpo_eiketsu_master.csv')
    all_ids=[];g3=[]
    for r in hero_rows:
      iid=str(r['internal_id']).strip(); hid=int(iid[4:]);all_ids.append(hid)
      if int(float(r.get('コスト') or 99))<=6:g3.append(hid)
    normal,meta_n=compare_mode(core,'normal',all_ids,{7,8,9},m)
    grade3,meta_g=compare_mode(core,'grade3',g3,{5,6,7,8,9},m)
    ds={**normal,**grade3}; failures=sum(v['missing_from_db']+v['extra_in_db']+(v['rows']-v['db_semantic_unique']) for v in ds.values())
    rep={'status':'PASS' if failures==0 else 'FAIL','audit_engine':'independent_bond56_core_to_compact_semantic_regeneration',
         'all_hero_count':len(all_ids),'grade3_hero_count':len(g3),'core_triples':len(core['triples']),
         'normal_meta':meta_n,'grade3_meta':meta_g,'datasets':ds,'total_mismatch':failures,'seconds':round(time.time()-started,3)}
    REPORT.write_text(json.dumps(rep,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:rep[k] for k in ('status','all_hero_count','grade3_hero_count','core_triples','total_mismatch','seconds')},ensure_ascii=False));
    if failures: raise SystemExit(1)
if __name__=='__main__':main()
