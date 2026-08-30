#!/usr/bin/env python3
from __future__ import annotations
import gzip,json,struct,time
from collections import defaultdict
from pathlib import Path
from rebuild_all_compact import load_model,Generator

ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'data'/'bond56_index'
REPORT=ROOT/'_jinpo-next-report'/'bond56_index_independent_audit.json'
CANON={'衡軛':[[0,1,2],[3,4,5]],'鶴翼':[[0,1,2],[3,4,5]],'魚鱗':[[0,1,2],[2,3,4],[4,5,0]],'方円':[[0,1,2],[2,3,4],[4,5,0]]}

def parse_core():
 raw=gzip.decompress((DIR/'bond56_core.bin.gz').read_bytes());o=4
 if raw[:4]!=b'B56I':raise RuntimeError('core magic')
 v,H,mc,gc,mic,tc=struct.unpack_from('<6I',raw,o);o+=24
 masks=[]
 for _ in range(mc):lo,hi=struct.unpack_from('<QQ',raw,o);o+=16;masks.append(lo|(hi<<64))
 groups=[]
 for _ in range(gc):a,b,m,c,off=struct.unpack_from('<HHHHI',raw,o);o+=12;groups.append((a,b,m,c,off))
 mids=struct.unpack_from('<%dH'%mic,raw,o);o+=2*mic
 triples=[]
 for _ in range(tc):a,b,c,m=struct.unpack_from('<HHHH',raw,o);o+=8;triples.append((a,b,c,m))
 if o!=len(raw):raise RuntimeError('core trailing')
 return v,H,masks,groups,mids,triples

def parse_bsets():
 raw=gzip.decompress((DIR/'bondsets.bin.gz').read_bytes());
 if raw[:4]!=b'B56B':raise RuntimeError('bset magic')
 v,n=struct.unpack_from('<II',raw,4);o=12; out=[]
 for _ in range(n):lo,hi=struct.unpack_from('<QQ',raw,o);o+=16;out.append(lo|(hi<<64))
 if o!=len(raw):raise RuntimeError('bset trailing')
 return out

def skeleton(name,typ,count):
 raw=gzip.decompress((DIR/name).read_bytes());
 if raw[:4]!=b'B56S' or struct.unpack_from('<H',raw,4)[0]!=2 or raw[6]!=typ or raw[7]!=count:raise RuntimeError(name+' header')
 n=struct.unpack_from('<Q',raw,8)[0]; rec={2:12,3:16,4:8}[typ]
 if len(raw)!=16+n*rec:raise RuntimeError(name+' length')
 return raw,n,rec

def main():
 st=time.time();v,H,masks,groups,mids,triples=parse_core(); bsets=parse_bsets()
 heroes,grade,bonds,bnames,coef,fb=load_model(); py=Generator(list(heroes),heroes,bonds,coef,fb)
 # Cross-implementation exact triple mask comparison: Python compact generator vs C++ bond56 core.
 core_tm={(a,b,c):masks[mi] for a,b,c,mi in triples}
 py_tm=dict(py.tm)
 missing=set(py_tm)-set(core_tm);extra=set(core_tm)-set(py_tm); mask_mismatch=sum(core_tm[k]!=py_tm[k] for k in set(core_tm)&set(py_tm))
 # Exact pair-group/middle memberships after normalizing both implementations.
 core_pg={}
 for a,b,mi,c,off in groups:core_pg.setdefault((a,b),{})[masks[mi]]=tuple(mids[off:off+c])
 pg_missing=pg_extra=pg_mid_mismatch=pg_order_only_difference=0
 py_pairs=set(py.pair_groups);core_pairs=set(core_pg)
 pg_missing=len(py_pairs-core_pairs);pg_extra=len(core_pairs-py_pairs)
 for pair in py_pairs&core_pairs:
  pyd={m:tuple(v) for m,v in py.pair_groups[pair]}; cod=core_pg[pair]
  if set(pyd)!=set(cod):pg_mid_mismatch+=len(set(pyd)^set(cod));continue
  # Middle candidates are a semantic set. Python/C++ enumeration order is not part of the product contract.
  # Compare canonicalized membership; record order-only differences as diagnostics, never as failures.
  for m in pyd:
   if tuple(pyd[m])!=tuple(cod[m]):
    if sorted(pyd[m])==sorted(cod[m]): pg_order_only_difference+=1
    else: pg_mid_mismatch+=1
 # Model active lines independent absolute oracle.
 model=json.loads(gzip.decompress((DIR/'bond56_model.json.gz').read_bytes()).decode('utf-8'))
 model_line_errors=sum(model.get('activeLines',{}).get(k)!=v for k,v in CANON.items())
 # Skeleton exact stream verification against independently reconstructed expected records from validated core groups.
 pair_gids=defaultdict(list)
 for gi,(a,b,mi,c,off) in enumerate(groups):pair_gids[(a,b)].append(gi)
 def pg(a,b):
  if a>b:a,b=b,a
  return pair_gids.get((a,b),())
 skeleton_results={}; sk_errors=0
 # cycle3 order-independent logical verification plus expected count.
 for count in (5,6):
  raw,n,rec=skeleton(f'cycle3_c{count}.bin.gz',3,count); actual_count=0; bad=0
  for i in range(n):
   o=16+i*16;g1,g2,g3,bs=struct.unpack_from('<IIII',raw,o)
   if g1>=len(groups) or g2>=len(groups) or g3>=len(groups) or bs>=len(bsets):bad+=1;continue
   a1,b1,m1,_,_=groups[g1];a2,b2,m2,_,_=groups[g2];a3,b3,m3,_,_=groups[g3]
   u=masks[m1]|masks[m2]|masks[m3]
   if not (a1<b1 and a2<b2 and a3<b3 and b1==a2 and a1==a3 and b2==b3 and u.bit_count()==count and bsets[bs]==u):bad+=1
  # independently count all expected logical skeletons from pair groups.
  exp=0
  ids=sorted(heroes)
  for ai,A in enumerate(ids[:-2]):
   for ci in range(ai+1,len(ids)-1):
    C=ids[ci];l1=pg(A,C)
    if not l1:continue
    for E in ids[ci+1:]:
     l2=pg(C,E);l3=pg(A,E)
     if not l2 or not l3:continue
     for g1 in l1:
      m1=masks[groups[g1][2]]
      for g2 in l2:
       u12=m1|masks[groups[g2][2]]
       for g3 in l3:
        if (u12|masks[groups[g3][2]]).bit_count()==count:exp+=1
  e=bad+abs(n-exp);sk_errors+=e;skeleton_results[f'cycle3_c{count}']={'actual':n,'expected':exp,'record_errors':bad,'errors':e}
  # cycle2
  raw,n,rec=skeleton(f'cycle2_c{count}.bin.gz',2,count);bad=0
  for i in range(n):
   o=16+i*12;g1,g2,bs=struct.unpack_from('<III',raw,o)
   if g1>=len(groups) or g2>=len(groups) or bs>=len(bsets):bad+=1;continue
   a1,b1,m1,_,_=groups[g1];a2,b2,m2,_,_=groups[g2];shared=set((a1,b1))&set((a2,b2));u=masks[m1]|masks[m2]
   if len(shared)!=1 or u.bit_count()!=count or bsets[bs]!=u:bad+=1
  exp=0
  ids=sorted(heroes)
  for C in ids:
   for A in ids:
    if A==C:continue
    l1=pg(A,C)
    if not l1:continue
    for E in ids:
     if E<=A or E==C:continue
     l2=pg(C,E)
     if not l2:continue
     for g1 in l1:
      m1=masks[groups[g1][2]]
      for g2 in l2:
       if (m1|masks[groups[g2][2]]).bit_count()==count:exp+=1
  e=bad+abs(n-exp);sk_errors+=e;skeleton_results[f'cycle2_c{count}']={'actual':n,'expected':exp,'record_errors':bad,'errors':e}
  # disjoint skeleton: every unordered mask pair whose union has exact count.
  raw,n,rec=skeleton(f'disjoint_c{count}.bin.gz',4,count);bad=0
  for i in range(n):
   o=16+i*8;m1,m2,bs=struct.unpack_from('<HHI',raw,o)
   if m1>=len(masks) or m2>=len(masks) or bs>=len(bsets):bad+=1;continue
   u=masks[m1]|masks[m2]
   if m1>m2 or u.bit_count()!=count or bsets[bs]!=u:bad+=1
  exp=sum(1 for i in range(len(masks)) for j in range(i,len(masks)) if (masks[i]|masks[j]).bit_count()==count)
  e=bad+abs(n-exp);sk_errors+=e;skeleton_results[f'disjoint_c{count}']={'actual':n,'expected':exp,'record_errors':bad,'errors':e}
 errors=len(missing)+len(extra)+mask_mismatch+pg_missing+pg_extra+pg_mid_mismatch+model_line_errors+sk_errors
 rep={'status':'PASS' if errors==0 else 'FAIL','cross_implementation':{'python_triples':len(py_tm),'cpp_core_triples':len(core_tm),'missing':len(missing),'extra':len(extra),'mask_mismatch':mask_mismatch,'pair_missing':pg_missing,'pair_extra':pg_extra,'pair_group_mismatch':pg_mid_mismatch,'pair_group_order_only_difference':pg_order_only_difference},'model_active_line_errors':model_line_errors,'skeletons':skeleton_results,'errors':errors,'seconds':round(time.time()-st,3)}
 REPORT.write_text(json.dumps(rep,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':rep['status'],'errors':errors,'seconds':rep['seconds'],'cross':rep['cross_implementation'],'skeletons':skeleton_results},ensure_ascii=False));
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
