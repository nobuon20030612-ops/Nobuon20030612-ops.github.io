#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""12組のモデル識別試験／コスト32の実用域6組を、同じ定義で採点する。

使い方: python 上振れ抑制_共通実測採点.py --plan 編成一覧.csv --pred 11能力全モデル予測.csv --input 実測入力.csv --manifest 12組および実用域6組_監査サマリー.json --out 結果フォルダ
本番変更、自動採用、実測値の補完は一切行わない。
"""
from __future__ import annotations
import argparse,csv,json,hashlib,collections
from pathlib import Path
STATS=['生命力','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
MODELS=['現行','552','579']

def rd(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def wr(p,cols,rows):
 with p.open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.writer(f);w.writerow(cols);w.writerows(rows)
def sign(x):return (x>0)-(x<0)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
 pa=argparse.ArgumentParser()
 for x in ('plan','pred','input','manifest','out'):pa.add_argument('--'+x,required=True,type=Path)
 a=pa.parse_args();a.out.mkdir(exist_ok=True,parents=True)
 manifest=json.loads(a.manifest.read_text('utf-8'))
 plans=rd(a.plan);preds=rd(a.pred);measure=rd(a.input)
 assert plans and len(plans)==len(measure) and len(preds)==len(plans)*11
 prefix=a.plan.name.removesuffix('_編成一覧.csv')
 plan_meta=next((v for v in manifest.values() if isinstance(v,dict) and v.get('prefix')==prefix),None)
 assert plan_meta is not None,'未登録の計測計画'
 assert sha(a.plan)==plan_meta['plan_sha256'],'編成一覧が変更されています'
 assert sha(a.pred)==plan_meta['prediction_sha256'],'予測の変更が検出されました'
 by_no={int(r['測定順']):r for r in plans}
 pred={(int(r['測定順']),r['能力']):r for r in preds}
 assert len(by_no)==len(plans) and len(pred)==len(preds)
 assert set(n for n,_ in pred)==set(by_no)
 assert all((n,s) in pred for n in by_no for s in STATS)
 seen=set();result=[];bad=[];stats=collections.defaultdict(list)
 for r in measure:
  n=int(r['測定順']);assert n not in seen and n in by_no,'測定順の重複または不明な測定順';seen.add(n)
  for key in ('Aコスト構成','Bコスト構成','A6柱No','B6柱No'):
   assert r[key]==by_no[n][key],f'編成が予測と不一致: {n}/{key}'
  if r['観測条件']!='三貴神×3・奉納物未使用' or r['同一条件で測定']!='はい' or not r['証拠ID'].strip():
   bad.append([n,'全能力','育成条件・同一条件・証拠IDが未確認']);continue
  for st in STATS:
   sa=r.get('ゲームA_'+st,'').strip();sb=r.get('ゲームB_'+st,'').strip()
   if not sa or not sb:
    bad.append([n,st,'AまたはBの実測値が未入力']);continue
   if not sa.isdecimal() or not sb.isdecimal() or int(sa)<=0 or int(sb)<=0:
    bad.append([n,st,'実測は正の整数が必要']);continue
   v=int(sa)-int(sb);pr=pred[n,st]
   pv=[int(pr[k+'A-B']) for k in MODELS]; informative=int(len(set(pv))>1 and st not in STATS[:2])
   for k,pred_value in zip(MODELS,pv):
    row=[n,st,k,v,pred_value,abs(v-pred_value),int(sign(v)==sign(pred_value)),informative,r['証拠ID']]
    result.append(row);stats[k].append(row)
 assert seen==set(by_no) and len(result)%3==0
 summaries=[]
 for k in MODELS:
  one=stats[k];disc=[r for r in one if r[7]==1]
  def average(idx,rows):return round(sum(r[idx] for r in rows)/len(rows),6) if rows else ''
  summaries.append([k,len({r[0] for r in one}),len(one),len(disc),average(5,one),average(5,disc),average(6,disc),
                    '実測0・採否未判定' if not one else '比較結果を人手審査。自動採用は禁止'])
 wr(a.out/(prefix+'_モデル採点.csv'),['モデル','有効比較組数','有効能力行数','モデル間予測が異なる能力行','全能力A-B差分MAE','識別可能行だけのA-B差分MAE','識別可能行の符号一致率','補正判断'],summaries)
 wr(a.out/(prefix+'_採点明細.csv'),['測定順','能力','モデル','実測A-B','予測A-B','絶対誤差','符号一致','識別可能行','証拠ID'],result)
 wr(a.out/(prefix+'_除外明細.csv'),['測定順','能力','理由'],bad)
 bypair=[]
 for n in sorted(by_no):
  s=[r for r in result if r[0]==n]
  summary=[n, len(s)//3]
  for k in MODELS:
   info=[r for r in s if r[2]==k and r[7]==1]
   summary.append(round(sum(r[5] for r in info)/len(info),6) if info else '')
  summary.append('1組の11能力を独立11件として統計推定しない')
  bypair.append(summary)
 wr(a.out/(prefix+'_組別判定.csv'),['測定順','実測能力行数','現行_識別行MAE','552_識別行MAE','579_識別行MAE','解釈'],bypair)
 meta={'検証計画':prefix,'総比較組数':len(plans),'実測条件を満たした比較組数':len(set(r[0] for r in result)),
       '有効能力行':len(result)//3,'モデル間予測が異なる能力行':len([r for r in stats['現行'] if r[7]==1]),
       '生命力と気合は三モデル間の優劣判断から除外':'モデル間で補正しない項目のため判別への情報量なし',
       '自動補正':'禁止','採否':'ゲーム内同条件実測と修正履歴の確定前は保留'}
 (a.out/(prefix+'_採点概要.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(meta,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
