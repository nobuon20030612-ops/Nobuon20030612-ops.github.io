#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""画像12枚の数値転記・6柱表示/検索DBの同式・既存DBを非破壊で検証する。
   python 検証データ/人数別_実測照合.py [--db-full]
"""
import argparse,base64,csv,hashlib,json,re,struct,zlib,io
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
  html=(ROOT/'gunshin.html').read_text('utf-8')
  def js_obj(variable, numeric_keys=False):
    match=re.search(r'const '+re.escape(variable)+r'=(\{[^;]+\});',html)
    assert match, f'HTMLに {variable} がありません'
    literal=match.group(1)
    if numeric_keys: literal=re.sub(r'(?<=[{,])(\d+):',r'"\1":',literal)
    return json.loads(literal)
  partial=js_obj('PARTIAL_PROFILE_RATES')
  count=js_obj('COUNT_BONUS_RATES', True)
  cost=js_obj('COST_BONUS_RATES', True)
  assert set(partial)=={'4','44','644','6644','66644'}
  assert all(len(v)==len(STAT) and all(isinstance(x,int) and x>0 for x in v) for v in partial.values())
  assert html.count('PARTIAL_PROFILE_RATES[getComposition(ids)]')==1
  seen=set(); differences=[]; observations=[];pair={};present_photos=0;missing_photos=[]
  for sample in samples:
    label=sample['パターン'];num=int(sample['人数']);k=(label,num)
    assert k not in seen;seen.add(k)
    names=[sample['軍神'+str(i)] for i in range(1,7) if sample['軍神'+str(i)]]
    assert len(names)==len(set(names))==num
    profile=''.join(str(byname[n]['コスト']) for n in sorted(names,key=lambda n:-int(byname[n]['コスト'])))
    assert profile==sample['コスト構成'] and sum(map(int,profile))==int(sample['合計コスト'])
    photo=HERE/'画像資料/20261010_1から6柱'/sample['画像ファイル名']
    if photo.is_file():
      assert hashlib.sha256(photo.read_bytes()).hexdigest()==sample['画像_SHA256'], ('画像ハッシュ不一致',photo)
      present_photos+=1
    else: missing_photos.append(sample['画像ファイル名'])
    values=[int(sample[s]) for s in STAT]
    assert all(v>=0 for v in values)
    raws=[sum(int(byname[name][s]) for name in names) for s in STAT]
    if num==6:
      assert profile in rates and len(rates[profile])==14
      before_rate=after_rate=rates[profile][3:]
    else:
      extra=sum(cost[str(byname[name]['コスト'])] for name in names)
      before_rate=[count[str(num)][0 if i<2 else 1]+extra for i in range(11)]
      after_rate=partial.get(profile,before_rate)
    assert len(before_rate)==len(after_rate)==len(STAT)
    before=[raws[i]*before_rate[i]//100 for i in range(11)]
    after=[raws[i]*after_rate[i]//100 for i in range(11)]
    assert all(after[i]<=before[i] for i in range(11))
    pair[k]=(before,after)
    for i,name in enumerate(STAT):
      observations.append([label,num,profile,name,raws[i],before_rate[i],after_rate[i],before[i],after[i],values[i],values[i]-before[i],values[i]-after[i],sample['画像ファイル名'],
        '画像は同梱されていないため転記CSVのみ照合' if not photo.is_file() else '画像SHA256照合済み'])
    if num==6 or profile in partial:
      assert all(after[i]<values[i] for i in range(11)), ('上振れ/同値が残存',label,num,[(STAT[i],after[i],values[i]) for i in range(11) if after[i]>=values[i]])
    differences.append((label,num,[(STAT[i],after[i],values[i]) for i in range(11) if after[i]>=values[i]]))
  assert seen=={(p,n) for p in 'AB' for n in range(1,7)}
  for n in range(1,6):
    A0,A1=pair[('A',n)];B0,B1=pair[('B',n)]
    sign=lambda a: (a>0)-(a<0)
    assert [sign(A0[i]-B0[i]) for i in range(11)]==[sign(A1[i]-B1[i]) for i in range(11)],('A/B優劣変化',n)
    assert max(abs((A0[i]-B0[i])-(A1[i]-B1[i])) for i in range(11))<=1,('能力差変動大',n)
  assert html.count('Math.floor(v*rate[i+3]/100)')==1,'6柱と検索DBの計算経路不一致'
  assert 'i<2?rate[0]:rate[1]' not in html,'旧倍率の表示計算が残存'
  assert len(observations)==132
  buf=io.StringIO(newline=''); writer=csv.writer(buf,lineterminator='\n')
  writer.writerow(['パターン','柱数','コスト構成','能力','元能力合計','補正前倍率％','補正後倍率％','補正前サイト値','補正後サイト値','提供済みゲーム表示値','補正前余裕','補正後余裕','元画像名','画像照合状態'])
  writer.writerows(observations)
  output=HERE/'人数別_2パターン_能力別上振れ抑制比較.csv'
  output.write_bytes(('\ufeff'+buf.getvalue()).encode('utf-8'))
  print('2パターン×1～6柱×11能力＝132比較・CSV/HTML/倍率：合格')
  print('画像のSHA256が照合できた件数:',present_photos,'/12（画像未同梱時は転記CSVのみ検証）')
  print('1～5柱のA/B優劣変化0件、能力差変動最大1、6柱は元倍率・DBを保持')
  print('実測値以上の項目:',[(label,n,issues) for label,n,issues in differences if issues] or 'なし')
  print('注意：実測には奉納物使用による上積みを含む。奉納物なしの完全育成値を下回る保証ではない。')
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
