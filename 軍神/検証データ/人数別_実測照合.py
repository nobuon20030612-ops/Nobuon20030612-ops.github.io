#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""画像12枚の数値転記・6柱表示/検索DBの同式・既存DBを非破壊で検証する。
   python 検証データ/人数別_実測照合.py [--db-full]
"""
import argparse,base64,csv,hashlib,json,re,struct,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
HERE=Path(__file__).resolve().parent
STAT=['生命力','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
FMT='<6B11H';SIZE=struct.calcsize(FMT);TOP=500

def main():
  arg=argparse.ArgumentParser();arg.add_argument('--db-full',action='store_true');args=arg.parse_args()
  with (ROOT/'軍神データ.csv').open(encoding='utf-8-sig',newline='') as f:
    entries=list(csv.DictReader(f))
  byname={r['軍神名']:r for r in entries};byid={int(r['No']):r for r in entries}
  assert len(entries)==len(byname)==len(byid)==114
  rates=json.loads((ROOT/'検索データ/構成倍率.json').read_text('utf-8'))
  samples=list(csv.DictReader((HERE/'人数別_2パターン_ゲーム画面実測_20261010.csv').open(encoding='utf-8-sig',newline='')))
  assert len(samples)==12
  seen=set(); differences=[]
  for sample in samples:
    label=sample['パターン'];num=int(sample['人数']);k=(label,num)
    assert k not in seen;seen.add(k)
    names=[sample['軍神'+str(i)] for i in range(1,7) if sample['軍神'+str(i)]]
    assert len(names)==len(set(names))==num
    profile=''.join(str(byname[n]['コスト']) for n in sorted(names,key=lambda n:-int(byname[n]['コスト'])))
    assert profile==sample['コスト構成'] and sum(map(int,profile))==int(sample['合計コスト'])
    photo=HERE/'画像資料/20261010_1から6柱'/sample['画像ファイル名']
    assert photo.is_file() and hashlib.sha256(photo.read_bytes()).hexdigest()==sample['画像_SHA256']
    values=[int(sample[s]) for s in STAT]
    assert all(v>=0 for v in values)
    raws=[sum(int(byname[name][s]) for name in names) for s in STAT]
    if num==6:
      assert profile in rates and len(rates[profile])==14
      computed=[raws[i]*rates[profile][i+3]//100 for i in range(11)]
      differences.append((label,[(STAT[i],computed[i],values[i]) for i in range(11) if computed[i]>values[i]]))
  assert seen=={(p,n) for p in 'AB' for n in range(1,7)}
  html=(ROOT/'gunshin.html').read_text('utf-8')
  assert html.count('Math.floor(v*rate[i+3]/100)')==1,'手動セット合計と検索DBの能力倍率が別経路'
  assert 'i<2?rate[0]:rate[1]' not in html,'旧倍率の表示計算が残存'
  print('画像ハッシュ12件・2パターン×1～6柱＝12編成×11能力（132件）・コスト・軍神重複：合格')
  print('画面セットの6柱倍率と検索DBの11能力別倍率：一致')
  for name,issues in differences:
    print(name,'の6柱で参考モデルがゲーム実測を上回る項目：',issues if issues else 'なし')
  print('注意：画像の軍神は奉納物を使用している（ユーザー説明）。人数別ボーナスとの切り分けは未完了で、基礎能力や検索DBは変更しない。')
  if args.db_full:
    profiles=sorted(json.loads((ROOT/'検索データ/構成一覧.json').read_text('utf-8'))['profiles'],reverse=True)
    assert len(profiles)==len(rates)==215
    count=0
    for i in range(11):
      text=(ROOT/f'検索データ/組合せ_{i:02d}.js').read_text('ascii')
      m=re.search(r'GUNSHIN_PRECOMPUTED\['+str(i)+r'\]="([A-Za-z0-9+/=]+)"',text)
      assert m
      buf=zlib.decompress(base64.b64decode(m.group(1)))
      assert len(buf)==len(profiles)*TOP*SIZE
      for j,profile in enumerate(profiles):
        factor=rates[profile][3:]
        old=2**16
        for k in range(TOP):
          result=struct.unpack_from(FMT,buf,(j*TOP+k)*SIZE)
          ids=result[:6]; values=result[6:]
          assert len(set(ids))==6
          assert ''.join(str(byid[g]['コスト']) for g in ids)==profile
          prediction=tuple(sum(int(byid[g][col]) for g in ids)*factor[idx]//100 for idx,col in enumerate(STAT))
          assert prediction==values,(profile,i,k,ids)
          assert values[i]<=old,(profile,i,k)
          old=values[i];count+=1
      print('検索DB',i+1,'/ 11 検証完了',flush=True)
    assert count==215*500*11
    print('既存DB全1,182,500行 ×11能力: 計算式・降順・コスト・軍神重複 合格')

if __name__=='__main__':main()
