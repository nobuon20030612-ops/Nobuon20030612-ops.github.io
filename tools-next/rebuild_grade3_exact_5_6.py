#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,hashlib,itertools,json,math,os,struct,tempfile
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SITE=ROOT/'jinpo-next';DATA=SITE/'data'/'compact_search_v2';MP=DATA/'jinpo_unified_search_manifest.json';REC=52
STATS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
LINES={'衡軛':[(0,1,2),(3,4,5)],'鶴翼':[(0,1,2),(3,4,5)],'魚鱗':[(0,1,2),(2,3,4),(4,5,0)],'方円':[(1,2,3),(3,4,5),(1,0,5)]}
BONUS_PCT={'衡軛':[5]*11,'鶴翼':[10,0,0,10,0,0,10,10,10,10,10],'魚鱗':[0,10,10,10,10,0,0,0,0,0,0],'方円':[0,10,0,0,0,10,10,10,10,10,10]}
def rows(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def normstat(s):
 s=str(s or '').strip().replace('生命力','生命');return {'耐久':'耐久力','器用':'器用さ','土':'土属性','水':'水属性','火':'火属性','風':'風属性'}.get(s,s)
def gzread(p):
 with gzip.open(p,'rb') as f:return f.read()
def gzbytes(raw):
 import io
 b=io.BytesIO()
 with gzip.GzipFile(filename='',mode='wb',fileobj=b,compresslevel=6,mtime=0) as z:z.write(raw)
 return b.getvalue()
def meta(path,raw,zipped,n):return {'file':str(path.relative_to(SITE)).replace('\\','/'),'rows':n,'gzip_bytes':len(zipped),'raw_bytes':len(raw),'sha256_16':hashlib.sha256(zipped).hexdigest()[:16]}
# masters
H={};g3=[]
for r in rows(SITE/'data'/'jinpo_eiketsu_master.csv'):
 iid=r['internal_id']
 if not iid.startswith('EIK_'):continue
 n=int(iid[4:]);H[n]={'f':[str(r[k]).strip() for k in ('因子1','因子2','因子3','因子4')],'s':[int(float(r[x] or 0)) for x in STATS],'c':int(float(r['コスト'] or 99))}
 if H[n]['c']<=6:g3.append(n)
g3.sort()
B={};BN={}
for r in rows(SITE/'data'/'jinpo_inen_master.csv'):
 bid=int(r['No']);B[bid]=[str(r[k]).strip() for k in ('因子1','因子2','因子3')];BN[bid]=str(r['因縁名']).strip()
coef_name=defaultdict(dict)
for r in rows(SITE/'data'/'91因縁_計算式_倍率展開.csv'):
 n=str(r['因縁名']).strip();s=normstat(r['対象ステータス']);v=float(r['実効係数'] or 0)
 if n and s in STATS and v>0:coef_name[n][s]=v
COEF={bid:[coef_name.get(name,{}).get(s,0.0) for s in STATS] for bid,name in BN.items()}
# triple masks
byf=defaultdict(list)
for h in g3:
 for f in set(x for x in H[h]['f'] if x and x not in {'-','対象外'}):byf[f].append(h)
TM=defaultdict(int)
for bid,req in B.items():
 bit=1<<(bid-1)
 for a in byf[req[0]]:
  for b in byf[req[1]]:
   if b==a:continue
   for c in byf[req[2]]:
    if c==a or c==b:continue
    TM[tuple(sorted((a,b,c)))] |= bit
def canonical_cycle(p):
 s=list(p);vs=[]
 for sh in (0,2,4):vs.append(tuple(s[sh:]+s[:sh]))
 r=[s[0],s[5],s[4],s[3],s[2],s[1]]
 for sh in (0,2,4):vs.append(tuple(r[sh:]+r[:sh]))
 return min(vs)
def pgroups(target):
 out={}
 for i,u in enumerate(g3):
  for v in g3[i+1:]:
   d=defaultdict(list)
   for w in g3:
    if w in (u,v):continue
    m=TM.get(tuple(sorted((u,v,w))),0)
    if m.bit_count()<=target:d[m].append(w)
   out[(u,v)]=tuple((m,tuple(x)) for m,x in d.items())
 return out
def cycle(target):
 pg=pgroups(target)
 def groups(a,b):return pg[(a,b) if a<b else (b,a)]
 out={}
 for A,C,E in itertools.combinations(g3,3):
  shared={A,C,E}
  for m1,L1 in groups(A,C):
   for m2,L2 in groups(C,E):
    u=m1|m2
    if u.bit_count()>target:continue
    for m3,L3 in groups(A,E):
     union=u|m3
     if union.bit_count()!=target:continue
     for b in L1:
      if b in shared:continue
      for d in L2:
       if d in shared or d==b:continue
       for f in L3:
        if f in shared or f in (b,d):continue
        p=canonical_cycle((A,b,C,d,E,f));k=(tuple(sorted(p)),union)
        if k not in out or p<out[k]:out[k]=p
 return out
def disjoint(target):
 byc=defaultdict(list)
 for t,m in TM.items():
  if m and m.bit_count()<=target:byc[m.bit_count()].append((t,m))
 out={}
 for c1 in range(1,4):
  for c2 in range(c1,4):
   if c1+c2<target:continue
   A=byc[c1];BB=byc[c2]
   for i,(t1,m1) in enumerate(A):
    start=i+1 if A is BB else 0
    for t2,m2 in BB[start:]:
     if set(t1)&set(t2):continue
     u=m1|m2
     if u.bit_count()!=target:continue
     a=tuple(sorted(t1));b=tuple(sorted(t2));p=min(a+b,b+a);k=(tuple(sorted(p)),u)
     if k not in out or p<out[k]:out[k]=p
 return out
def bondids(mask):return tuple(i+1 for i in range(len(B)) if (mask>>i)&1)
# deterministic assignment cache: ordered 3 heroes + bond -> relative factor4 slot bit (0 if activates without factor4, -1 if no activation)
AC={}
def assign_f4(line,bid):
 key=(tuple(line),bid)
 if key in AC:return AC[key]
 req=B[bid];used=set();ans=[]
 def dfs(i):
  if i==3:return True
  for hi,hid in enumerate(line):
   if hi in used:continue
   if req[i] in H[hid]['f']:
    used.add(hi);ans.append((hi,req[i]))
    if dfs(i+1):return True
    ans.pop();used.remove(hi)
  return False
 if not dfs(0):AC[key]=-1;return -1
 bits=0
 for hi,f in ans:
  f4=H[line[hi]]['f'][3]
  if f4 and f4 not in {'-','対象外'} and f==f4:bits|=1<<hi
 AC[key]=bits;return bits
def f4count(p,form,bids):
 slots=set()
 for ln in LINES[form]:
  line=tuple(p[i] for i in ln)
  for bid in bids:
   bits=assign_f4(line,bid)
   if bits<0:continue
   for hi in range(3):
    if bits&(1<<hi):slots.add(ln[hi])
 return len(slots)
def calc(p,bids,form):
 base=[sum(H[h]['s'][i] for h in p) for i in range(11)];raw=[0]*11
 for bid in bids:
  for i,m in enumerate(COEF[bid]):
   if m:raw[i]+=math.floor(base[i]*m+1e-9)
 vals=[raw[i]*(100+BONUS_PCT[form][i])//100 for i in range(11)]
 return vals,sum(vals)
def record(p,bids,form,tie):
 vals,total=calc(p,bids,form);r=bytearray(REC);struct.pack_into('<6H',r,0,*p)
 for i,b in enumerate(bids):r[12+i]=b
 for i,v in enumerate(vals):struct.pack_into('<H',r,21+2*i,v)
 struct.pack_into('<I',r,43,total);r[47]=f4count(p,form,bids);struct.pack_into('<I',r,48,tie);return bytes(r)
def build_raw(old_header,keymap,count,form):
 items=sorted(keymap.items(),key=lambda kv:(kv[0][0],kv[0][1],kv[1]));h=bytearray(old_header[:16]);struct.pack_into('<I',h,8,len(items));h[12]=count
 body=[]
 for tie,((six,mask),fish) in enumerate(items,1):
  p=fish if form=='魚鱗' else ((fish[5],fish[0],fish[1],fish[2],fish[3],fish[4]) if form=='方円' else fish)
  body.append(record(p,bondids(mask),form,tie))
 return bytes(h)+b''.join(body)
def main():
 m=json.loads(MP.read_text(encoding='utf-8'))
 c5c=cycle(5);c6c=cycle(6);c7c=cycle(7);c5d=disjoint(5);c6d=disjoint(6)
 got={'c5_disjoint':len(c5d),'c5_cycle':len(c5c),'c6_disjoint':len(c6d),'c6_cycle':len(c6c),'c7_cycle':len(c7c)}
 exp={'c5_disjoint':1240,'c5_cycle':131607,'c6_disjoint':0,'c6_cycle':955,'c7_cycle':2}
 if got!=exp:raise RuntimeError(f'generator validation failed {got} != {exp}')
 plans=[(5,'衡軛',c5d),(5,'鶴翼',c5d),(5,'魚鱗',c5c),(5,'方円',c5c),(6,'魚鱗',c6c),(6,'方円',c6c)]
 staged=[]
 for count,form,kmap in plans:
  e=m['datasets']['grade3'][str(count)][form];path=SITE/e['file'];old=gzread(path);raw=build_raw(old,kmap,count,form);z=gzbytes(raw)
  # self-check before replacement
  if raw[:4]!=b'JCF1' or (len(raw)-16)//REC!=len(kmap) or struct.unpack_from('<I',raw,8)[0]!=len(kmap):raise RuntimeError('staged binary invalid')
  staged.append((path,raw,z,len(kmap),e))
 # Atomic replacement only after every staged file validates.
 for path,raw,z,n,e in staged:
  tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_bytes(z);os.replace(tmp,path);e.update(meta(path,raw,z,n))
 m.setdefault('notes',[]).append('grade3 5/6 regenerated by complete line re-evaluation; duplicate bond names count once globally')
 MP.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'exact_counts':got,'factor4_assignment_cache':len(AC)},ensure_ascii=False))
if __name__=='__main__':main()
