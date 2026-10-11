#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""最新サイトZIP + 552参照と感度最適化表から12組＋実用域別検査を構築。
研究ファイルのみ出力し本番資産には触れない。
"""
from __future__ import annotations
import argparse,csv,io,zipfile,json,hashlib,collections
from pathlib import Path
STATS=['生命力','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
EXCLUDE={7,11,15,19,94,4,115,116,117}
MODELS=['現行','552','579']

def rd(p):
 with Path(p).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def wr(path,cols,rows):
 with Path(path).open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.writer(f);w.writerow(cols);w.writerows(rows)
def iv(x,y,r,s,ep):return (x*(r*100-ep)//10000-y*(s*100+ep)//10000,x*(r*100+ep)//10000-y*(s*100-ep)//10000)
def apart(a,b):return a[1]<b[0] or b[1]<a[0]

def main():
 a=argparse.ArgumentParser()
 for n in ('site_zip','m552','optimized','candidates','out'):a.add_argument('--'+n.replace('_','-'),required=True,type=Path)
 args=a.parse_args();args.out.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(args.site_zip) as z:
  orig=z.read('軍神/軍神データ.csv');sh=hashlib.sha256(orig).hexdigest()
  assert sh=='5dfde73d7763e3bd462beb9376651f0038b689427def7085bb7af30f574d3003'
  g={int(r['No']):r for r in csv.DictReader(io.StringIO(orig.decode('utf-8-sig')))}
  rates=json.loads(z.read('軍神/検索データ/構成倍率.json'))
  ref=json.loads(z.read('軍神/検証データ/三貴神3回_114柱_参考下端差分.json'))
 masks=[set(),{(int(r['No']),STATS.index(r['能力'])) for r in rd(args.m552)},
        {(int(n),i) for n,t in ref['差分（11能力順）'].items() for i,v in enumerate(t) if v=='1'}]
 assert len(masks[1])==552 and len(masks[2])==579 and masks[1]<masks[2]
 targets=sorted(masks[2]-masks[1]);expected={(x,t) for x in targets for t in ((0,1),(0,2),(1,2))}
 c=lambda ids:''.join(sorted((g[x]['コスト'] for x in ids),reverse=True))
 def validate(A,B):
  assert len(A)==len(B)==6 and len(set(A))==len(set(B))==6 and len(set(A)&set(B))==5
  assert not set(A+B)&EXCLUDE
  assert all(g[v]['設定可否']=='設定可' and all(g[v][s].isdigit() for s in STATS) for v in A+B)
  assert sum(map(int,c(A)))<=32 and sum(map(int,c(B)))<=32
  assert c(A) in rates and c(B) in rates
 def pred(A,B,i):
  st=STATS[i];rA=rates[c(A)][i+3];rB=rates[c(B)][i+3]
  raws=[(sum(int(g[v][st])-int((v,i) in mask) for v in A),sum(int(g[v][st])-int((v,i) in mask) for v in B)) for mask in masks]
  values=[(rs[0]*rA//100,rs[1]*rB//100) for rs in raws]
  return values,raws,(rA,rB)
 allplans=rd(args.optimized)
 selected=[r for r in allplans if r['倍率誤差±pp']=='1.5']
 assert len(selected)==12
 pairs=[]
 for row in selected:
  A=tuple(map(int,row['A6柱No'].split(',')));B=tuple(map(int,row['B6柱No'].split(',')));
  validate(A,B);pairs.append((A,B))
 assert len(set(pairs))==12
 cover=collections.defaultdict(list)
 for j,(A,B) in enumerate(pairs,1):
  for k in targets:
   no,i=k
   if no not in set(A+B):continue
   if sum(int(other[1]==i and other[0] in set(A+B)) for other in targets)!=1:continue
   _,raw,rr=pred(A,B,i)
   ii=[iv(*val,*rr,150) for val in raw]
   for m,n in ((0,1),(0,2),(1,2)):
    if apart(ii[m],ii[n]):cover[k,(m,n)].append(j)
 assert set(cover)==expected,len(cover)
 def create(prefix,pair_list,aim):
  plans=[];predictions=[];input_rows=[];sha_data=[]
  for j,(A,B) in enumerate(pair_list,1):
   validate(A,B);aa=','.join(map(str,A));bb=','.join(map(str,B))
   row=[j,c(A),c(B),aa,bb,'・'.join(g[v]['軍神名'] for v in A),'・'.join(g[v]['軍神名'] for v in B),aim,'未測定']
   plans.append(row);input_rows.append(row[:5]+['未確認','未確認','']+['']*22)
   for i,st in enumerate(STATS):
    vals,_,_=pred(A,B,i)
    predictions.append([j,st,*[n for a,b in vals for n in (a,b,a-b)]])
  pp=args.out/(prefix+'_編成一覧.csv');pv=args.out/(prefix+'_11能力全モデル予測.csv');inp=args.out/(prefix+'_実測入力.csv')
  wr(pp,['測定順','Aコスト構成','Bコスト構成','A6柱No','B6柱No','A6柱名','B6柱名','用途','測定状態'],plans)
  wr(pv,['測定順','能力','A現行予測','B現行予測','現行A-B','A552予測','B552予測','552A-B','A579予測','B579予測','579A-B'],predictions)
  wr(inp,['測定順','Aコスト構成','Bコスト構成','A6柱No','B6柱No','観測条件','同一条件で測定','証拠ID']+[f'ゲームA_{s}' for s in STATS]+[f'ゲームB_{s}' for s in STATS],input_rows)
  return {'prefix':prefix,'plan_sha256':hashlib.sha256(pp.read_bytes()).hexdigest(),'prediction_sha256':hashlib.sha256(pv.read_bytes()).hexdigest(),
          'site_data_sha256':sh,'pairs':len(pair_list),'model_prediction_rows':len(predictions),'value_recalculations':len(predictions)*9,
          'unique_configurations':len(set(x for pair in pair_list for x in pair)),
          'max_cost_histogram':dict(collections.Counter(str(max(sum(map(int,c(A))),sum(map(int,c(B))))) for A,B in pair_list)),
          'ground_truth_entries':0}
 meta12=create('三モデル12組_倍率±1.5pp識別',pairs,'仮説間81条件の区間分離。低コスト偏重／実ゲームへの汎化未確認')
 # 81条件 coverage proof
 cv=[]
 for no,i in targets:
  for m,n in ((0,1),(0,2),(1,2)):
   cv.append([no,g[no]['軍神名'],STATS[i],MODELS[m]+'vs'+MODELS[n],','.join(map(str,cover[(no,i),(m,n)])),len(cover[(no,i),(m,n)]),'倍率誤差独立±1.5pp、仮説間区間分離のみ'])
 wr(args.out/'三モデル12組_全81条件証明.csv',['軍神No','軍神名','能力','比較仮説','該当測定順','該当組数','解釈'],cv)
 # 32/31 practical transfer validation: six stats with diverse model-sign disagreements
 cand=[]
 for r in rd(args.candidates):
  A=tuple(map(int,r['A6柱No'].split(',')));B=tuple(map(int,r['B6柱No'].split(',')))
  ca,cb=sum(map(int,c(A))),sum(map(int,c(B)))
  if max(ca,cb)!=32 or min(ca,cb)<31 or (A,B) in pairs:continue
  try:validate(A,B)
  except (AssertionError,ValueError):continue
  flips={};spreads={}
  for i in range(2,11):
   v,_,_=pred(A,B,i);diffs=[a-b for a,b in v]
   spreads[STATS[i]]=max(diffs)-min(diffs)
   if len(set((d>0)-(d<0) for d in diffs))>1:flips[STATS[i]]=diffs
  cand.append((A,B,flips,spreads))
 # one representative per distinct stat; avoid duplicate A/B sets and identical swapped god where possible
 priority=['火属性','知力','腕力','水属性','耐久力','器用さ']
 pick=[];used_configs=set();used_swaps=set()
 for stat in priority:
  options=[r for r in cand if stat in r[2] and r[0] not in used_configs and r[1] not in used_configs]
  assert options,stat
  def sortkey(r):
   A,B,flips,spreads=r;swap=(tuple(set(A)-set(B)),tuple(set(B)-set(A)))
   return (swap in used_swaps,-spreads[stat],-sum(spreads.values()),','.join(map(str,A)),','.join(map(str,B)))
  choice=sorted(options,key=sortkey)[0];pick.append(choice);used_configs.update(choice[:2]);used_swaps.add((tuple(set(choice[0])-set(choice[1])),tuple(set(choice[1])-set(choice[0]))))
 assert len(pick)==6
 checks=[]
 for i,(A,B,flips,spreads) in enumerate(pick,1):
  checks.append([i,sum(map(int,c(A))),sum(map(int,c(B))),priority[i-1],','.join(str(d) for d in flips[priority[i-1]]),spreads[priority[i-1]],
                 'モデルの符号が異なる実用域比較。モデル精度の正解ではない'])
 wr(args.out/'コスト32実用域6組_差分観測重点.csv',['測定順','Aコスト合計','Bコスト合計','注目能力','現行_552_579の予測A-B','予測差幅','目的'],checks)
 meta6=create('コスト32実用域6組',[r[:2] for r in pick],'実用域（総コスト31/32）の優劣一致率確認。12組とは別の評価')
 summary={'モデル識別用12組':meta12,'コスト32実用域6組':meta6,'全81条件_倍率独立±1.5pp':len(cover),
          '候補1,780組内の最適化最少組数':12,'研究に含める1,780組目':{'A':[13,57,106,90,102,53],'B':[57,106,90,102,53,99]},
          '本番データ変更':0,'補正採用':0,'育成同条件の新規ゲーム内実測':0,
          '上振れ抑制のゲーム精度':'未確定。条件ごとの区間分離は実測による予測正答の証明ではない。'}
 (args.out/'12組および実用域6組_監査サマリー.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
