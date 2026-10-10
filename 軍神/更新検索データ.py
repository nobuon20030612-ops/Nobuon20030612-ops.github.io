#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""軍神検索データの更新（追加時は影響するコスト構成だけ差分再計算）。

必要ファイル: 軍神データ.csv / 軍神画像/<No>.webp / 既存の検索データ/組合せ_XX.js
使い方:
   python 更新検索データ.py --verify    # 現在のデータと検索索引を監査
   python 更新検索データ.py --update    # 軍神追加・ステータス更新後に索引を更新
   python 更新検索データ.py --full      # 念のため全構成を再作成
   python 更新検索データ.py --stress    # 通常育成109柱の九光を±1して順位への影響を検証

全組合せの総当りではなく、各コスト人数の上位組合せを
最大ヒープで生成して、全215構成×11能力の正確な上位500を求める。
1ファイル25MB上限を超える時は書出し停止。UTF-8/日本語名維持。
"""
from __future__ import annotations
import argparse,base64,csv,hashlib,heapq,itertools,json,os,re,struct,sys,tempfile,zlib
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DATA=ROOT/'軍神データ.csv'
DIRECTORY=ROOT/'検索データ'
STAT_NAMES=['生命力','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
FMT='<6B11H';RECORD_BYTES=struct.calcsize(FMT);TOP=500;LIMIT=25*1024*1024
RATES=json.loads((DIRECTORY/'構成倍率.json').read_text('utf8'))
def stat_rate(profile, stat_index):
    rate=RATES[profile]
    return rate[stat_index+3] if len(rate)==14 else rate[0 if stat_index<2 else 1]

def read_rows():
    with DATA.open(encoding='utf-8-sig',newline='') as f: rs=list(csv.DictReader(f))
    names=set();ids=set();out=[]
    for r in rs:
        no=int(r['No']);cost=int(r['コスト']);name=r['軍神名'].strip()
        assert 0<no<255 and cost in range(3,9) and no not in ids and name not in names
        ids.add(no);names.add(name)
        vals=[int(r[s]) if r[s].strip() else None for s in STAT_NAMES]
        setting=r.get('設定可否','設定可')
        active=setting=='設定可' and all(v is not None for v in vals)
        if setting=='設定可':
            assert (ROOT/'軍神画像'/f'{no}.webp').is_file(),f'画像がありません: No.{no}'
        out.append({'id':no,'name':name,'cost':cost,'values':vals,'active':active,'setting':setting,
                    'level':int(r.get('Lv','80') or '80'),
                    'godtool':r.get('神具',''),'source':r.get('入手','')})
    assert len(out)>=6
    return out

def canonical(rs):
    return [[r['id'],r['name'],r['cost'],*r['values'],r['active'],r['level'],r['godtool'],r['source'],r['setting']] for r in rs]

def signature(rs):
    return hashlib.sha256(json.dumps(canonical(rs),separators=(',',':'),ensure_ascii=False).encode('utf8')).hexdigest()

def index_records(rs):
    return {str(r['id']):[r['id'],r['cost'],*r['values']] for r in rs if r['active']}

def get_patterns():
    raw=(DIRECTORY/'構成一覧.json').read_text('utf-8')
    spec=json.loads(raw)
    return sorted(spec['profiles'],reverse=True)

def zjs(blob,idx):
    b64=base64.b64encode(zlib.compress(blob,level=9)).decode('ascii')
    return f'window.GUNSHIN_PRECOMPUTED=window.GUNSHIN_PRECOMPUTED||{{}};window.GUNSHIN_PRECOMPUTED[{idx}]="{b64}";\n'.encode('utf8')

def read_part(i,profile_count):
    text=(DIRECTORY/f'組合せ_{i:02d}.js').read_text('utf8')
    match=re.search(r'GUNSHIN_PRECOMPUTED\['+str(i)+r'\]="([A-Za-z0-9+/=]+)"',text)
    assert match,f'壊れた構成DB {i}'
    blob=zlib.decompress(base64.b64decode(match[1]))
    assert len(blob)==profile_count*TOP*RECORD_BYTES,(i,len(blob),profile_count*TOP*RECORD_BYTES)
    return blob

def records(blob):
    return [struct.unpack_from(FMT,blob,i) for i in range(0,len(blob),RECORD_BYTES)]

def stat_score(data,index):
    return sum(x['values'][index] for x in data)

def cost_groups(rs):
    bycost={c:[] for c in range(3,9)}
    for r in rs:
        if r['active']: bycost[r['cost']].append(r)
    return bycost

def top_subsets(sorted_pool,need,i,k):
    """対象能力順の非重複k部分集合の上位k件（全列挙しない）。"""
    if need==0:return [(0,())]
    if len(sorted_pool)<need:return []
    initial=tuple(range(need));visited={initial}
    def score(t):return sum(sorted_pool[p]['values'][i] for p in t)
    heap=[(-score(initial),initial)]
    output=[]
    while heap and len(output)<k:
        neg,ind=heapq.heappop(heap)
        output.append((-neg,tuple(sorted_pool[x]['id'] for x in ind)))
        for pos in range(need):
            nxt=ind[pos]+1
            if nxt>=len(sorted_pool) or (pos+1<need and nxt>=ind[pos+1]):continue
            new=ind[:pos]+(nxt,)+ind[pos+1:]
            if new in visited:continue
            visited.add(new);heapq.heappush(heap,(-score(new),new))
    return output

def profile_top500(profile,i,rs,cache):
    counts=Counter(map(int,profile))
    costmap=cost_groups(rs)
    lists=[]
    for cost,count in sorted(counts.items(),reverse=True):
        key=(i,cost,count)
        if key not in cache:
            ranked=sorted(costmap[cost],key=lambda r:(-r['values'][i],r['id']))
            cache[key]=top_subsets(ranked,count,i,TOP)
        if not cache[key]: return []
        lists.append(cache[key])
    start=tuple(0 for _ in lists)
    def score(pos):return sum(lists[j][q][0] for j,q in enumerate(pos))
    pq=[(-score(start),start)];visited={start};result=[]
    idmap={r['id']:r for r in rs}
    while pq and len(result)<TOP:
        neg,pos=heapq.heappop(pq)
        ids=sum((lists[j][q][1] for j,q in enumerate(pos)),())
        raw=[sum(idmap[x]['values'][v] for x in ids) for v in range(11)]
        vals=[int(raw[v]*stat_rate(profile,v)//100) for v in range(11)]
        assert len(ids)==6 and len(set(ids))==6 and all(0<=v<65536 for v in vals)
        result.append(struct.pack(FMT,*ids,*vals))
        for j in range(len(pos)):
            if pos[j]+1>=len(lists[j]):continue
            n=pos[:j]+(pos[j]+1,)+pos[j+1:]
            if n in visited:continue
            visited.add(n);heapq.heappush(pq,(-score(n),n))
    return result

def rescore_existing_indices(rs,profiles,sign,cur):
    """係数のみ変更時：TOP500の組合せは不変なので全行を再採点する。"""
    idmap={r['id']:r['values'] for r in rs if r['active']}
    allparts=[];outputs={}
    for i in range(11):
        blob=read_part(i,len(profiles))
        remade=bytearray(len(blob))
        off=0
        for p in profiles:
            factors=[stat_rate(p,n) for n in range(11)]
            for _ in range(TOP):
                ids=struct.unpack_from('<6B',blob,off)
                sums=[0]*11
                for hero_id in ids:
                    vs=idmap[hero_id]
                    for n in range(11):sums[n]+=vs[n]
                vals=[sums[n]*factors[n]//100 for n in range(11)]
                struct.pack_into(FMT,remade,off,*ids,*vals)
                off+=RECORD_BYTES
        assert off==len(blob)
        data=bytes(remade);allparts.append(data)
        outputs[DIRECTORY/f'組合せ_{i:02d}.js']=zjs(data,i)
        print('倍率変更による再採点:',i+1,'/11',flush=True)
    # 215構成のトップ500を統合。構成間の順位は採点し直す必要がある。
    recommended=bytearray()
    for i,blob in enumerate(allparts):
        candidates=[]
        for j in range(len(profiles)):
            for k in range(TOP):
                off=(j*TOP+k)*RECORD_BYTES
                score=struct.unpack_from('<H',blob,off+6+2*i)[0]
                candidates.append((-score,j,k))
        candidates.sort()
        for _,j,k in candidates[:TOP]:
            off=(j*TOP+k)*RECORD_BYTES
            recommended.extend(blob[off:off+RECORD_BYTES])
    outputs[DIRECTORY/'おすすめ.js']=('window.GUNSHIN_RECOMMENDED_DB="'+base64.b64encode(bytes(recommended)).decode('ascii')+'";\n').encode('utf8')
    outputs[ROOT/'軍神情報.js']=compact_js(rs)
    manifest={'version':2,'signature':sign,'rate_signature':hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest(),'hero_index':cur,'profiles':profiles,
              'max_rows_per_profile':TOP,'bytes_per_row':RECORD_BYTES,'shards':11,
              'update_method':'cost-profile incremental k-best merge'}
    for path,data in outputs.items():write_atomic(path,data)
    write_atomic(DIRECTORY/'manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2).encode('utf8'))
    print('全215構成の再採点完了。検索データ・おすすめ・倍率・manifest同期済み。')

def compact_js(rs):
    shown=[r for r in rs if r['setting']=='設定可']
    arr=[[r['id'],r['name'],r['cost'],*r['values']] for r in shown]
    meta={str(r['id']):[r['godtool'],r['source']] for r in shown}
    levels={str(r['id']):r['level'] for r in shown}
    settings={str(r['id']):r['setting'] for r in shown}
    return ('window.GUNSHIN_HERO_ROWS='+json.dumps(arr,ensure_ascii=False,separators=(',',':'))+';\n'+
            'window.GUNSHIN_META='+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\n'+
            'window.GUNSHIN_LEVELS='+json.dumps(levels,ensure_ascii=False,separators=(',',':'))+';\n'+
             'window.GUNSHIN_SETTINGS='+json.dumps(settings,ensure_ascii=False,separators=(',',':'))+';\n'+
             'window.GUNSHIN_RATES='+json.dumps(RATES,ensure_ascii=False,separators=(',',':'))+';\n').encode('utf8')

def write_atomic(path,data):
    if len(data)>LIMIT:raise ValueError(f'25MB/ファイル超過 {path.name}: {len(data)}')
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:f.write(data)
        os.replace(name,path)
    finally:
        if os.path.exists(name):os.unlink(name)

def audit_recommended_and_measured(rs, profiles):
    """--verify 専用: 215構成からのおすすめTOP500と既存ゲーム実測を独立照合。"""
    # 2025年公開の検証資料にも記載された、6柱のコストによる基本倍率。
    # これはコスト7以下の軍神単体追加ボーナスを完全再現する式ではない。
    # 過去に実測した4能力の控えめ補正も別の配列要素として扱う。
    for profile in profiles:
        v=RATES[profile]
        reference=190+5*sum(c in '34' for c in profile)-5*profile.count('7')-10*profile.count('8')
        assert len(v)==14 and v[:3]==[reference,reference+470,sum(map(int,profile))], ('基本倍率規則不一致',profile,v)
        assert all(0 < x <= reference for x in v[3:5]), ('生命・気合補正異常',profile,v)
        # 暫定補正量は構成倍率.json 側だけで管理し、数値を検証コードへ二重登録しない。
        assert len(v[5:])==9 and all(0<rate<=reference+470 for rate in v[5:]), ('9能力の倍率不正',profile,v)
    print('215構成の基本倍率規則・能力別倍率形式: 全件一致')

    # CSV が唯一の軍神データ正本: 軍神情報.js が列単位で追従していることを検証する。
    src=(ROOT/'軍神情報.js').read_text('utf8')
    def jsval(key):
        match=re.search(r'window\.'+re.escape(key)+r'=(.*?);(?:\n|$)',src)
        assert match, ('JSデータが見つからない',key)
        return json.loads(match[1])
    expect=[r for r in rs if r['setting']=='設定可']
    assert jsval('GUNSHIN_HERO_ROWS')==[[r['id'],r['name'],r['cost'],*r['values']] for r in expect]
    assert jsval('GUNSHIN_META')=={str(r['id']):[r['godtool'],r['source']] for r in expect}
    assert jsval('GUNSHIN_LEVELS')=={str(r['id']):r['level'] for r in expect}
    assert jsval('GUNSHIN_SETTINGS')=={str(r['id']):r['setting'] for r in expect}
    assert jsval('GUNSHIN_RATES')==RATES
    print('軍神CSV → サイト用JS: 軍神・能力・Lv・神具・入手・倍率 完全一致')

    # 上位500件を既存検索索引から独立に統合して再計算し、表示用データとバイト単位で比較。
    src=(DIRECTORY/'おすすめ.js').read_text('utf8')
    m=re.search(r'window\.GUNSHIN_RECOMMENDED_DB="([A-Za-z0-9+/=]+)"',src)
    assert m, 'おすすめ検索DBがありません'
    result=base64.b64decode(m[1],validate=True)
    assert len(result)==11*TOP*RECORD_BYTES, ('おすすめDBの長さ',len(result))
    for i in range(11):
        blob=read_part(i,len(profiles))
        ranked=heapq.nsmallest(TOP,(
            (-struct.unpack_from('<H',blob,(j*TOP+k)*RECORD_BYTES+6+2*i)[0],j,k)
            for j in range(len(profiles)) for k in range(TOP)))
        exp=b''.join(blob[(j*TOP+k)*RECORD_BYTES:(j*TOP+k+1)*RECORD_BYTES]
                     for _,j,k in ranked)
        chunk=result[i*TOP*RECORD_BYTES:(i+1)*TOP*RECORD_BYTES]
        assert chunk==exp,('おすすめTOP500不一致',STAT_NAMES[i])
    print('おすすめ検索: 11能力すべてで、全215構成からの上位500件がバイト単位で一致')

    # 実測値の唯一の入力元: 検証データ/編成実測.json。
    # 実測は個別編成のみが検証対象。他215構成の保証に拡大しない。
    samples=json.loads((ROOT/'検証データ'/'編成実測.json').read_text('utf8'))['編成実測']
    assert samples,'実測照合データがありません'
    byname={r['name']:r for r in rs}
    seen=set()
    for sample in samples:
        key=sample['識別子']
        assert key not in seen,('実測データ重複',key)
        seen.add(key)
        profile=sample['コスト構成']
        assert profile in RATES,('コスト構成未登録',key,profile)
        names=sample['軍神名']
        assert len(names)==6 and len(set(names))==6,('6柱未満か重複',key)
        assert all(n in byname for n in names),('軍神名未登録',key,names)
        gods=[byname[n] for n in names]
        assert all(g['active'] for g in gods),('能力値未登録',key)
        assert ''.join(map(str,sorted((g['cost'] for g in gods),reverse=True)))==profile,('コスト不一致',key)
        actual=[sample['能力上昇'][name] for name in STAT_NAMES]
        assert all(isinstance(v,int) and v>=0 for v in actual),('実測値不正',key)
        estimated=[sum(g['values'][i] for g in gods)*stat_rate(profile,i)//100 for i in range(11)]
        issues=[(STAT_NAMES[i],estimated[i],actual[i]) for i in range(11) if estimated[i]>actual[i]]
        print('ゲーム実測との照合:',key,' (育成条件:',sample.get('育成条件','不明'),')')
        for i,name in enumerate(STAT_NAMES):
            print('  {:4s} サイト {:5d} / 実測 {:5d} / 余裕 {:4d}'.format(name,estimated[i],actual[i],actual[i]-estimated[i]))
        assert not issues,('実測よりサイトが高い能力あり',key,issues)
        assert all(estimated[i]<actual[i] for i in range(11)),('実測と同値・控えめにならない能力あり',key,[(STAT_NAMES[i],estimated[i],actual[i]) for i in range(11) if estimated[i]>=actual[i]])
    print('実測値以下: 登録済み',len(samples),'編成・各11能力。未登録の組合せは実測未検証。')

def audit_benchmarks_and_provenance(rs, profiles):
    """公開倍率・提供済み実数値の適用条件を区別し、全構成の検証状態をCSVで保存する。"""
    tests=json.loads((ROOT/'検証データ'/'コスト32公開倍率.json').read_text('utf8'))['既知倍率']
    checked=set()
    for row in tests:
        p=row['構成']; checked.add(p)
        assert p in RATES and len(p)==6 and sum(map(int,p))==32,('公開倍率の構成不正',p)
        assert RATES[p][:2]==[row['生気倍率'],row['九光基準倍率']],('公開倍率と不一致',p,RATES[p])
    assert len(tests)==len(checked)==10
    print('独立の公開倍率10例（コスト32）: サイト基本倍率と一致')

    observed=json.loads((ROOT/'検証データ'/'軍神単体実測.json').read_text('utf8'))['個別実測']
    godmap={r['name']:r for r in rs}
    import io
    def csv_bytes(header,lines):
        f=io.StringIO(newline=''); w=csv.writer(f,lineterminator='\n'); w.writerow(header);w.writerows(lines)
        return ('\ufeff'+f.getvalue()).encode('utf-8')

    # 全215構成×11能力、独立検証済み／推定を明示する。データの値自体は触らない。
    output=[]
    for p in profiles:
        total=sum(map(int,p))
        source=('公開資料で基本倍率のみ照合' if p in checked else '基本倍率は未実測の推定')
        for i,name in enumerate(STAT_NAMES):
            raw=RATES[p][0 if i<2 else 1]
            rate=stat_rate(p,i)
            output.append([p,total,name,rate,raw,rate-raw,source,
                          '同一6柱で11能力のゲーム実測あり（1組のみ）' if p=='666644' else '該当構成のゲーム実測なし',
                          'ゲーム実測以下の保証なし'])
    outpath=ROOT/'検証データ'/'全215構成_能力別検証状況.csv'
    write_atomic(outpath,csv_bytes(['コスト構成','コスト合計','能力','採用倍率％','基本倍率％',
                    '能力別補正差ポイント','基本倍率の根拠','編成実測の有無','推定値の保証'],output))
    assert len(output)==len(profiles)*len(STAT_NAMES)

    # 元の114柱すべて。Lv50/Lv1の固定軍神と配布Lv80を通常育成から明示的に分ける。
    fixed80={11,15,19}
    observed_map={x['軍神名']:x for x in observed}
    assert len(observed_map)==len(observed), '軍神単体実測の軍神名重複'
    confirmed=0
    for item in observed:
        assert item['軍神名'] in godmap,('実測の軍神名がCSVにない',item['軍神名'])
        if item['標準推定との直接比較可']:
            a=godmap[item['軍神名']]['values']
            b=[item['能力値'][n] for n in STAT_NAMES]
            assert a==b,('固定Lv80実測不一致',item['軍神名'],a,b)
            confirmed+=1
    print('軍神単体実測：固定Lv80の一致',confirmed,'柱、奉納物ありなど条件不一致',len(observed)-confirmed,'柱（補正未使用）')
    rows=[]
    for r in sorted(rs,key=lambda x:x['id']):
        if r['id'] in (7,94):cls='配布固定Lv{}・実能力数値未登録'.format(r['level'])
        elif r['id'] in fixed80:cls='配布済みLv80・通常育成モデル対象外'
        else:cls='通常育成モデルの参考値'
        prior=observed_map.get(r['name'])
        for i,name in enumerate(STAT_NAMES):
            v=r['values'][i]
            obs=prior['能力値'][name] if prior else None
            # 異なる条件の測定値を「超過」判定に使わない。
            status=('育成条件不一致・直接比較不可' if prior and not prior['標準推定との直接比較可']
                    else '固定Lv80実測と一致・通常育成の検証とは別' if prior and prior['標準推定との直接比較可'] and v==obs
                    else '能力実数値未登録' if v is None
                    else '同条件の軍神単体実測なし')
            rows.append([r['id'],r['name'],r['cost'],r['level'],cls,name,
                         '' if v is None else v,'' if obs is None else obs,
                         '' if obs is None or v is None else v-obs,status])
    personpath=ROOT/'検証データ'/'全114柱_能力値根拠.csv'
    write_atomic(personpath,csv_bytes(['No','軍神名','コスト','Lv','育成区分','能力','サイト基準値',
                                       '提供済み実測（条件違いを含む）','単純差（判定に使用しない）','判定'],rows))
    assert len(rows)==len(rs)*11
    summary={
       '軍神データ正本':'軍神データ.csv（受領した軍神データ(2).csvと一致することが前提）',
       '軍神登録数':len(rs),'実能力あり':sum(r['active'] for r in rs),
       'Lv固定・実能力未登録':['信長201X','七福神'],
       '固定Lv80の通常育成除外':['大志抱きし者','川中島の龍虎','泰平祈る女神'],
       '6柱コスト構成':len(profiles),'コスト32構成':sum(sum(map(int,p))==32 for p in profiles),
       'コスト32未満構成':sum(sum(map(int,p))<32 for p in profiles),
       '公開資料と照合した基本倍率の構成':len(tests),
       '構成別11能力のゲーム実測':1,
       '軍神単体の実測比較可能':1,'条件が異なる軍神単体の実測':1,
       '完了検査':['検索DBとサイト計算式の一致','検索上位500の並び替え','公開コスト32基本倍率10例の照合',
             'ゲーム実測1編成の11能力がサイト推定値以上'],
       '未検証':['他のコスト構成・軍神組合せのゲーム実測','三貴神3回・奉納物なしの軍神ごとの完成値',
               'コスト7以下の軍神別追加ボーナスの正確な式'],
       '数値の変更':False,
       '注意':'基本倍率の公開資料との一致は、能力別推定値の精度保証ではない。'}
    write_atomic(ROOT/'検証データ'/'監査サマリー.json',
                 (json.dumps(summary,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
    print('214/215構成の過大評価を証明・否定する実測は不足。全215構成・全114柱の根拠を別表化。')

def audit_input_sensitivity(rs, profiles):
    """上位検索索引について単体能力の仮定誤差を検査する。実測値を仮造しない。"""
    from collections import Counter
    import io
    def report(path, header, rows):
        buf=io.StringIO(newline='')
        w=csv.writer(buf,lineterminator='\n')
        w.writerow(header); w.writerows(rows)
        write_atomic(ROOT/'検証データ'/path, ('\ufeff'+buf.getvalue()).encode('utf8'))

    # CSVの単体値に誤差+1があった場合だけを独立した仮定として調べる。
    # 全構成・全能力500件の元データを現行の統一計算経路で再採点する。
    byid={r['id']:r for r in rs if r['active']}
    rows=[]
    for stat_index,name in enumerate(STAT_NAMES):
        blob=read_part(stat_index,len(profiles))
        for p_index,profile in enumerate(profiles):
            rate=stat_rate(profile,stat_index)
            plus_one_min=plus_six_min=10**9
            plus_one_max=plus_six_max=0
            for pos in range(TOP):
                off=(p_index*TOP+pos)*RECORD_BYTES
                entry=struct.unpack_from(FMT,blob,off)
                raw=sum(byid[g]['values'][stat_index] for g in entry[:6])
                baseline=raw*rate//100
                assert baseline==entry[6+stat_index], ('感度検査で計算不一致',profile,name,pos)
                d1=(raw+1)*rate//100-baseline
                d6=(raw+6)*rate//100-baseline
                plus_one_min=min(plus_one_min,d1)
                plus_one_max=max(plus_one_max,d1)
                plus_six_min=min(plus_six_min,d6)
                plus_six_max=max(plus_six_max,d6)
            rows.append([profile,sum(map(int,profile)),name,rate,plus_one_min,plus_one_max,
                         plus_six_min,plus_six_max,TOP,
                         '仮定誤差の感度。ゲーム実測との一致・推定誤差の分布を保証しない'])
    assert len(rows)==len(profiles)*11
    report('全215構成_入力1点誤差の感度.csv',
           ['コスト構成','コスト合計','能力','採用倍率％','1柱だけ元能力+1での上昇最小値',
            '1柱だけ元能力+1での上昇最大値','6柱とも元能力+1での上昇最小値',
            '6柱とも元能力+1での上昇最大値','検査した各構成の上位件数','注記'],rows)

    # 実測1編成では、推定誤差のわずかな増加が実測を超えるか厳密に判定する。
    samples=json.loads((ROOT/'検証データ'/'編成実測.json').read_text('utf8'))['編成実測']
    byname={r['name']:r for r in rs}
    seen=set(); empirical=[]
    for sample in samples:
        assert sample['識別子'] not in seen
        seen.add(sample['識別子'])
        gods=[byname[x] for x in sample['軍神名']]
        assert len(gods)==6 and len({g['id'] for g in gods})==6
        assert ''.join(str(g['cost']) for g in sorted(gods,key=lambda v:-v['cost']))==sample['コスト構成']
        for i,name in enumerate(STAT_NAMES):
            raw=sum(g['values'][i] for g in gods)
            rate=stat_rate(sample['コスト構成'],i)
            actual=sample['能力上昇'][name]
            base=raw*rate//100
            new1=(raw+1)*rate//100
            new6=(raw+6)*rate//100
            # floor((raw+delta)*rate/100)>actual の最小非負delta
            delta=max(0,(100*(actual+1)+rate-1)//rate-raw)
            # この実測編成の元能力を固定した条件で、推定値＜実測値を維持できる上限。
            # 未実測の同構成別編成に対して妥当性を保証するものではない。
            strict_rate_limit=(100*actual-1)//raw
            assert rate<=strict_rate_limit, ('実測を下回らない倍率',name,rate,strict_rate_limit)
            empirical.append([sample['識別子'],sample['コスト構成'],name,rate,raw,base,actual,
                              actual-base,new1,new1-actual,new6,new6-actual,delta,
                              strict_rate_limit,strict_rate_limit-rate,
                              '仮定誤差。実際に元能力が誤っていると確定したものではない'])
    assert len(empirical)==11*len(samples)
    report('実測編成_入力誤差による超過可能性.csv',
           ['実測識別子','コスト構成','能力','採用倍率％','元能力合計','現推定','ゲーム実測',
            '実測までの余裕','1柱の元能力を+1とした推定','実測との差_1柱+1',
            '6柱すべて元能力+1とした推定','実測との差_6柱+1','実測を超える最小元能力合計の増加',
            '実測未満を維持できる採用倍率の上限％','採用倍率から上限までの余地_ポイント',
            '注記'],empirical)

    # 上位500件×11能力の中で頻出する軍神。今後の同条件実測を優先するための目安。
    source=(DIRECTORY/'おすすめ.js').read_text('utf8')
    m=re.search(r'window\.GUNSHIN_RECOMMENDED_DB="([A-Za-z0-9+/=]+)"',source)
    assert m
    binary=base64.b64decode(m[1],validate=True)
    assert len(binary)==len(STAT_NAMES)*TOP*RECORD_BYTES
    hits={g['id']:[0]*len(STAT_NAMES) for g in rs if g['active']}
    for stat_index in range(len(STAT_NAMES)):
        for pos in range(TOP):
            off=(stat_index*TOP+pos)*RECORD_BYTES
            ids=struct.unpack_from('<6B',binary,off)
            assert len(set(ids))==6
            for no in ids:hits[no][stat_index]+=1
    rank_rows=[]
    for g in rs:
        if not g['active']:continue
        counts=hits[g['id']]
        kind='固定Lv80（通常育成除外）' if g['id'] in (11,15,19) else '通常育成（推定）'
        rank_rows.append([g['id'],g['name'],g['cost'],sum(counts),kind,*counts])
    rank_rows.sort(key=lambda x:(-x[3],x[0]))
    report('実測確認の優先候補_おすすめ上位500.csv',
           ['No','軍神名','コスト','全11能力での登場延べ回数','分類',*STAT_NAMES],rank_rows)

    summary={
        '目的':'単体元能力が1点違った場合の検索値の感度と、実測優先対象の抽出',
        '実測の件数':len(samples),
        '分析したコスト構成':len(profiles),
        '構成別能力分析行数':len(rows),
        '構成別候補の再採点回数':len(profiles)*len(STAT_NAMES)*TOP,
        '実測編成の能力点検数':len(empirical),
        '単柱の元能力+1で実測を超える項目':[x[2] for x in empirical if x[9]>0],
        '優先実測候補_上位10柱':[{'No':x[0],'軍神名':x[1],'登場延べ回数':x[3]} for x in rank_rows[:10]],
        '注意事項':['1点誤差は仮定の感度試験であり実誤差の存在・大きさを示さない',
                    '上位500件の登場頻度は今後の照合優先度であり育成能力の実測ではない',
                    '全215構成の実測以下保証は未達成',
                    'CSV・検索DB・倍率・サイト表示値は変更しない']
    }
    write_atomic(ROOT/'検証データ'/'感度検査サマリー.json',
                 (json.dumps(summary,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
    print('入力誤差の感度検査:',len(profiles),'構成×11能力×500件一致。単柱+1による超過が',
          len(summary['単柱の元能力+1で実測を超える項目']),'能力、優先候補',len(rank_rows),'柱を出力。')

def audit_ranking_perturbation(rs, profiles):
    """通常育成109柱の九光に±1を仮定し、検索順位を検索生成本経路で再計算する。

    この検査は実測の推定区間でも保証付きの誤差幅でもない。
    --stress は正本CSV・倍率・検索DBを書き換えず、検証データだけにレポートを作る。
    """
    from collections import Counter
    import io

    source_names=STAT_NAMES[2:]
    originals={i:read_part(i,len(profiles)) for i in range(2,11)}
    recommended_src=(DIRECTORY/'おすすめ.js').read_text('utf8')
    mat=re.search(r'window\.GUNSHIN_RECOMMENDED_DB="([A-Za-z0-9+/=]+)"',recommended_src)
    assert mat, 'おすすめデータ未登録'
    reference=base64.b64decode(mat[1],validate=True)
    assert len(reference)==11*TOP*RECORD_BYTES
    # 育成用4柱は正本114柱に含まれない。固定Lv80の3柱も仮想変動させない。
    normal={r['id'] for r in rs if r['id'] not in (7,11,15,19,94)}
    assert len(normal)==109
    original_hero_ids={r['id'] for r in rs if r['active']}
    assert len(original_hero_ids)==112

    rows=[];summaries=[]
    for i in range(2,11):
        name=STAT_NAMES[i]
        original_blob=originals[i]
        original_rec=reference[i*TOP*RECORD_BYTES:(i+1)*TOP*RECORD_BYTES]
        before_rec=[struct.unpack_from('<6B',original_rec,k*RECORD_BYTES) for k in range(TOP)]
        before_rec_set=set(before_rec)
        for shift in (-1,1):
            # 実データは一切書き換えず、変更する統計項目も1項目だけ。
            other=[]
            for r in rs:
                u=dict(r)
                v=list(r['values'])
                if r['id'] in normal and v[i] is not None:v[i]=max(0,v[i]+shift)
                u['values']=v
                other.append(u)
            assert len(other)==len(rs)
            cache={}
            all_blobs=[]
            changed_first=0;min_membership=TOP;max_membership=0
            for pnum,profile in enumerate(profiles):
                records_new=profile_top500(profile,i,other,cache)
                assert len(records_new)==TOP
                newblob=b''.join(records_new)
                all_blobs.append(newblob)
                baseline_chunk=original_blob[pnum*TOP*RECORD_BYTES:(pnum+1)*TOP*RECORD_BYTES]
                base_top=struct.unpack_from(FMT,baseline_chunk,0)
                new_top=struct.unpack_from(FMT,newblob,0)
                first_changed=base_top[:6]!=new_top[:6]
                changed_first+=int(first_changed)
                before_set={struct.unpack_from('<6B',baseline_chunk,k*RECORD_BYTES) for k in range(TOP)}
                after_set={struct.unpack_from('<6B',newblob,k*RECORD_BYTES) for k in range(TOP)}
                overlap=len(before_set&after_set)
                min_membership=min(min_membership,overlap)
                max_membership=max(max_membership,TOP-overlap)
                rows.append([name,shift,profile,sum(map(int,profile)),
                             base_top[6+i],new_top[6+i],int(first_changed),
                             overlap,TOP-overlap,
                             '通常育成109柱の対象能力を全員±1した仮想試験。実測の誤差範囲ではない'])
            # 215構成の全候補から独立に上位500を統合。
            best=heapq.nsmallest(TOP,(
                (-struct.unpack_from('<H',piece,k*RECORD_BYTES+6+2*i)[0],j,k)
                for j,piece in enumerate(all_blobs) for k in range(TOP)))
            new_rec=[struct.unpack_from('<6B',all_blobs[j],k*RECORD_BYTES)
                     for _,j,k in best]
            rec_common=len(before_rec_set&set(new_rec))
            assert len(new_rec)==500 and len(set(new_rec))==500, ('重複おすすめ候補',name,shift)
            summaries.append([name,shift,changed_first,min_membership,max_membership,
                              rec_common,500-rec_common,int(before_rec[0]!=new_rec[0]),
                              '仮想順位変動の検査であり実測値ではない'])
            print(f'±1順位感度: {name} {shift:+d}; 構成首位変更 {changed_first}/215, おすすめ共通 {rec_common}/500',flush=True)

    def emit(name,head,data):
        buf=io.StringIO(newline='')
        writer=csv.writer(buf,lineterminator='\n')
        writer.writerow(head);writer.writerows(data)
        write_atomic(ROOT/'検証データ'/name, ('\ufeff'+buf.getvalue()).encode('utf8'))
    emit('九光9能力_全215構成_順位変動_仮想1点.csv',
         ['能力','通常育成元能力の仮想変化','コスト構成','コスト計','現行首位推定','仮想変化後首位推定',
          '首位6柱の変化','TOP500共通件数','TOP500入替件数','注意'],rows)
    emit('九光9能力_おすすめTOP500_順位感度.csv',
         ['能力','通常育成元能力の仮想変化','首位変更構成数_全215',
          '構成別TOP500の最小共通数','構成別TOP500の最大入替件数',
          'おすすめTOP500共通件数','おすすめTOP500入替件数','おすすめ1位の編成変更','注意'],summaries)
    assert len(rows)==215*9*2 and len(summaries)==18
    sources={
        '元CSV_SHA256':DATA,
        '倍率_SHA256':DIRECTORY/'構成倍率.json',
        'manifest_SHA256':DIRECTORY/'manifest.json',
        '順位変動CSV_SHA256':ROOT/'検証データ'/'九光9能力_全215構成_順位変動_仮想1点.csv',
        'おすすめ順位感度CSV_SHA256':ROOT/'検証データ'/'九光9能力_おすすめTOP500_順位感度.csv',
    }
    record={key:hashlib.sha256(path.read_bytes()).hexdigest() for key,path in sources.items()}
    record.update({'通常育成軍神':109,'コスト構成':len(profiles),'検証条件':18,
                   '注意':'通常育成109柱の九光±1を仮定した順位検査。推定誤差の保証付き幅ではない。'})
    write_atomic(ROOT/'検証データ'/'順位感度_検証元.json',
                 (json.dumps(record,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
    print('9能力 × 2仮想条件 × 215構成 =',len(rows),'行を検証完了。CSVと検索DBの変更なし。')

def audit_reference_lower(rs, profiles):
    """114柱参考表の能力別「下端」を使い、通常育成109柱のみ仮想再計算。

    参考下端は保証付きの実測下限ではない。CSV・倍率・検索DBには一切書き戻さない。
    構成の検索順位は既存の profile_top500() を共用し、別の生成経路を作らない。
    """
    import io
    source_path=ROOT/'検証データ'/'三貴神3回_114柱_参考下端差分.json'
    info=json.loads(source_path.read_text('utf8'))
    expected_sha=info['比較元CSV_SHA256']
    current_sha=hashlib.sha256(DATA.read_bytes()).hexdigest()
    if expected_sha!=current_sha:
        raise ValueError('参考下端の対応CSVが変更されました。下端資料を再照合してください。')
    gaps=info['差分（11能力順）']
    assert len(gaps)==len(rs)==114
    fixed={7,11,15,19,94}
    baseline={r['id']:r for r in rs}
    assert {str(r['id']) for r in rs}==set(gaps)
    lowered=[]; gap_count=0
    for r in rs:
        offset=[int(x) for x in gaps[str(r['id'])]]
        assert len(offset)==11 and all(x in (0,1) for x in offset)
        assert (r['id'] not in fixed) or not any(offset)
        u=dict(r); vs=[]
        for i,v in enumerate(r['values']):
            if v is None:
                assert offset[i]==0
                vs.append(None)
            else:
                assert v>=offset[i]
                vs.append(v-offset[i]); gap_count+=offset[i]
        u['values']=vs
        lowered.append(u)
    assert gap_count==579,('参考下端への変更数が一致しない',gap_count)
    assert all(x['values'][:2]==baseline[x['id']]['values'][:2] for x in lowered)
    assert all(x['values']==baseline[x['id']]['values'] for x in lowered if x['id'] in fixed)
    print('参照下端：通常109柱・579能力を1点減。固定Lv5柱と生命気合は変更なし',flush=True)

    def emit(filename,header,rows):
        buf=io.StringIO(newline='');w=csv.writer(buf,lineterminator='\n')
        w.writerow(header);w.writerows(rows)
        write_atomic(ROOT/'検証データ'/filename, ('\ufeff'+buf.getvalue()).encode('utf8'))

    source=(DIRECTORY/'おすすめ.js').read_text('utf8')
    m=re.search(r'window\.GUNSHIN_RECOMMENDED_DB="([A-Za-z0-9+/=]+)"',source)
    assert m,'おすすめDBがありません'
    original_recommended=base64.b64decode(m[1],validate=True)
    assert len(original_recommended)==11*TOP*RECORD_BYTES
    profile_rows=[]; summary_rows=[]
    for i,name in enumerate(STAT_NAMES):
        if i<2:
            # 生命・気合の参考下端差は全軍神ゼロ。既存の索引をそのまま使う。
            reference_blob=read_part(i,len(profiles))
            assert reference_blob
            summary_rows.append([name,0,0,TOP,0,0,'参考中央値と参考下端が同一'])
            print('参考下端順位:',name,'= 変化なし',flush=True)
            continue
        original_blob=read_part(i,len(profiles))
        original_rec=original_recommended[i*TOP*RECORD_BYTES:(i+1)*TOP*RECORD_BYTES]
        base_rec_ids={struct.unpack_from('<6B',original_rec,j*RECORD_BYTES) for j in range(TOP)}
        cache={};revised_blobs=[];changed_first=0
        for j,p in enumerate(profiles):
            result=profile_top500(p,i,lowered,cache)
            assert len(result)==TOP,('参考下端で検索候補が不足',p,name)
            after_blob=b''.join(result)
            revised_blobs.append(after_blob)
            before_blob=original_blob[j*TOP*RECORD_BYTES:(j+1)*TOP*RECORD_BYTES]
            before_top=struct.unpack_from(FMT,before_blob,0)
            after_top=struct.unpack_from(FMT,after_blob,0)
            before_ids={struct.unpack_from('<6B',before_blob,k*RECORD_BYTES) for k in range(TOP)}
            after_ids={struct.unpack_from('<6B',after_blob,k*RECORD_BYTES) for k in range(TOP)}
            common=len(before_ids&after_ids)
            changed=before_top[:6]!=after_top[:6]
            changed_first+=int(changed)
            assert after_top[6+i]<=before_top[6+i],('参考下端の首位値が上昇',p,name)
            profile_rows.append([p,sum(map(int,p)),name,before_top[6+i],after_top[6+i],
                                before_top[6+i]-after_top[6+i],int(changed),common,TOP-common,
                                '参考下端は推定値であり実測下限の保証なし'])
        recommended=heapq.nsmallest(TOP,(
            (-struct.unpack_from('<H',blob,k*RECORD_BYTES+6+2*i)[0],j,k)
            for j,blob in enumerate(revised_blobs) for k in range(TOP)))
        rec_ids=[struct.unpack_from('<6B',revised_blobs[j],k*RECORD_BYTES) for _,j,k in recommended]
        assert len(set(rec_ids))==TOP
        common_rec=len(base_rec_ids & set(rec_ids))
        before_top=struct.unpack_from('<H',original_rec,6+2*i)[0]
        after_top=-recommended[0][0]
        assert after_top<=before_top
        summary_rows.append([name,changed_first,before_top-after_top,common_rec,
                             TOP-common_rec,int(rec_ids[0]!=struct.unpack_from('<6B',original_rec,0)),
                             '三貴神3回・奉納物なし参考値の下端。ゲーム内実測・保証値ではない'])
        print(f'参考下端順位: {name} 構成首位変更 {changed_first}/215, おすすめTOP500共通 {common_rec}/500, 首位推定差 {before_top-after_top}',flush=True)
    assert len(profile_rows)==9*215 and len(summary_rows)==11
    emit('九光9能力_全215構成_参考下端_順位影響.csv',
         ['コスト構成','コスト計','能力','現行首位推定','参考下端での首位推定',
          '首位推定減少','首位6柱の入替','TOP500共通件数','TOP500入替件数','注記'],profile_rows)
    emit('全11能力_おすすめTOP500_参考下端の比較.csv',
         ['能力','首位変更構成数','おすすめ首位推定減少','おすすめTOP500共通件数',
          'おすすめTOP500入替件数','おすすめ1位の編成変更','注記'],summary_rows)
    summary={
        '目的':'参照モデルの中央値ではなく能力別参考下端を用いた順位・数値の条件付き感度検査',
        '元CSV_SHA256':current_sha,
        '倍率_SHA256':hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest(),
        'manifest_SHA256':hashlib.sha256((DIRECTORY/'manifest.json').read_bytes()).hexdigest(),
        '参照下端入力_SHA256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
        '構成別順位CSV_SHA256':hashlib.sha256((ROOT/'検証データ'/'九光9能力_全215構成_参考下端_順位影響.csv').read_bytes()).hexdigest(),
        'おすすめCSV_SHA256':hashlib.sha256((ROOT/'検証データ'/'全11能力_おすすめTOP500_参考下端の比較.csv').read_bytes()).hexdigest(),
        '軍神114柱':len(rs),'通常育成109柱':sum(r['id'] not in fixed for r in rs),
        '変更しない固定Lv5柱':sorted(fixed),'中央値から1減の元能力項目数':gap_count,
        '基本倍率適用構成数':len(profiles),'構成ごとの比較行数':len(profile_rows),
        'おすすめ比較能力数':len(summary_rows),
        'おすすめ検索差分':[dict(zip(['能力','首位変更構成数','首位推定減少','TOP500共通件数','TOP500入替件数','おすすめ1位変更','注記'],r)) for r in summary_rows],
        '重要注意':'研究資料の下端は推定範囲であり、三貴神3回・奉納物なしのゲーム実測下限や保証区間ではない。正本・サイト・検索DBは変更なし。'
    }
    write_atomic(ROOT/'検証データ'/'参考下端_検証サマリー.json',
                 (json.dumps(summary,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
    print('参考下端再検索: 全215構成×九光9能力、11能力おすすめ比較完了',flush=True)

def audit_lower_freshness():
    """--verifyでは高コスト再検索せず、直近の参考下端検証の古さだけを確認する。"""
    summary_path=ROOT/'検証データ'/'参考下端_検証サマリー.json'
    if not summary_path.is_file():
        print('参考下端検査: 未実行（--lower-auditで検証結果を作成可能）')
        return
    d=json.loads(summary_path.read_text('utf8'))
    files={
       '元CSV_SHA256':DATA,
       '倍率_SHA256':DIRECTORY/'構成倍率.json',
       'manifest_SHA256':DIRECTORY/'manifest.json',
       '参照下端入力_SHA256':ROOT/'検証データ'/'三貴神3回_114柱_参考下端差分.json',
       '構成別順位CSV_SHA256':ROOT/'検証データ'/'九光9能力_全215構成_参考下端_順位影響.csv',
       'おすすめCSV_SHA256':ROOT/'検証データ'/'全11能力_おすすめTOP500_参考下端の比較.csv'
    }
    mismatches=[key for key,file in files.items() if not file.is_file() or d.get(key)!=hashlib.sha256(file.read_bytes()).hexdigest()]
    if mismatches:raise ValueError('参考下端検査が古くなっています。--lower-auditを再実行してください: '+','.join(mismatches))
    print('参考下端の検証元データ: CSV・倍率・manifest・下端資料は最新の検査結果と一致')

def audit_ranking_freshness():
    """長時間の--stressは通常--verifyで再走せず、データと結果の鮮度をチェック。"""
    fp=ROOT/'検証データ'/'順位感度_検証元.json'
    if not fp.is_file():
        print('順位感度: 未実行（--stressで検証結果を生成可能）')
        return
    rec=json.loads(fp.read_text('utf8'))
    paths={
        '元CSV_SHA256':DATA,
        '倍率_SHA256':DIRECTORY/'構成倍率.json',
        'manifest_SHA256':DIRECTORY/'manifest.json',
        '順位変動CSV_SHA256':ROOT/'検証データ'/'九光9能力_全215構成_順位変動_仮想1点.csv',
        'おすすめ順位感度CSV_SHA256':ROOT/'検証データ'/'九光9能力_おすすめTOP500_順位感度.csv',
    }
    stale=[key for key,file in paths.items()
           if not file.is_file() or rec.get(key)!=hashlib.sha256(file.read_bytes()).hexdigest()]
    if stale:
        raise ValueError('順位感度の検証結果が古いか欠損。--stressを再実行してください: '+','.join(stale))
    print('順位感度の検証元: CSV・倍率・manifest・結果ファイルのハッシュ一致')

def audit_subsets_by_bruteforce():
    """索引用の上位k集合を、独立した小規模総当りで照合する回帰試験。"""
    import random
    rng=random.Random(20261010)
    checks=0
    for size in (6,8,10):
        for choose in (1,2,3,4,5):
            for _ in range(20):
                pool=[{'id':i+1,'values':[rng.randrange(6,51),*([0]*10)]}
                      for i in range(size)]
                pool.sort(key=lambda r:(-r['values'][0],r['id']))
                expected=sorted((sum(x['values'][0] for x in combination)
                                 for combination in itertools.combinations(pool,choose)),reverse=True)[:TOP]
                actual=[score for score,_ in top_subsets(pool,choose,0,TOP)]
                assert expected==actual,('検索上位k順位の誤り',size,choose)
                checks+=1
    print('検索上位kアルゴリズム：独立した総当り',checks,'条件で一致')

def verify_input_provenance(rs, profiles):
    """受領データの育成区分を誤用しないための回帰試験。元CSV/DBは変更しない。"""
    required=['編成実測.json','コスト32公開倍率.json','軍神単体実測.json']
    missing=[x for x in required if not (ROOT/'検証データ'/x).is_file()]
    if missing:
        raise FileNotFoundError('検証入力が不足: '+', '.join(missing)+
                                '。旧差分ZIPだけでの実行は不可。必要な検証JSONを配置してください。')
    assert len(rs)==114 and len(profiles)==215, ('受領した114柱/215構成と不一致',len(rs),len(profiles))
    byid={x['id']:x for x in rs}
    assert len(byid)==114
    # 設定可でも「Lv50/1固定」の実能力が不明なら検索計算へ入れない。
    for no,level in [(7,50),(94,1)]:
        r=byid[no]
        assert r['level']==level and r['setting']=='設定可' and not r['active']
        assert all(v is None for v in r['values']), ('固定Lv軍神に架空値混入',r['name'])
    # 配布時Lv80完成の3柱。これらへ通常Lv80推定モデルを重ねない。
    for no in [11,15,19]:
        r=byid[no]
        assert r['level']==80 and r['active'] and all(v is not None for v in r['values']), ('固定Lv80欠損',no)
    # 育成用4柱は通常CSVの114柱に混ぜない（設定不可のHTML側資料で独立）。
    assert all(r['name'] not in {'三貴神','天照','彦星','織姫'} for r in rs)
    assert sum(r['active'] for r in rs)==112
    assert all(r['source'].strip() for r in rs), '入手欄の空欄あり。ユーザー最新版CSVを再確認してください'
    print('育成区分・受領CSV：通常109柱／固定Lv80 3柱／固定Lv50・1 未実数2柱。入手空欄なし')

def main():
    ap=argparse.ArgumentParser()
    group=ap.add_mutually_exclusive_group(required=True)
    group.add_argument('--verify',action='store_true')
    group.add_argument('--update',action='store_true')
    group.add_argument('--full',action='store_true')
    group.add_argument('--stress',action='store_true',help='通常育成の元能力±1で順位を再計算。正本・DBを更新しない')
    group.add_argument('--lower-audit',action='store_true',help='参考下端を用いた全215構成・順位の条件付き影響調査。DB変更なし')
    args=ap.parse_args()
    rs=read_rows();profiles=get_patterns();oldpath=DIRECTORY/'manifest.json'
    old=json.loads(oldpath.read_text('utf8')) if oldpath.is_file() else None
    sign=signature(rs)
    cur=index_records(rs)
    previous=old.get('hero_index',{}) if old else {}
    added=set(cur)-set(previous)
    removed=set(previous)-set(cur)
    changed={x for x in set(previous)&set(cur) if previous[x]!=cur[x]}
    if args.lower_audit:
        verify_input_provenance(rs,profiles)
        if not old or old.get('signature')!=sign or old.get('rate_signature')!=hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest():
            raise ValueError('正本・倍率・manifestが一致しません。参考下端検査を中止します。')
        audit_reference_lower(rs,profiles)
        return
    if args.stress:
        verify_input_provenance(rs,profiles)
        if not old or old.get('signature')!=sign or old.get('rate_signature')!=hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest():
            raise ValueError('正本・倍率・manifestが一致しません。感度検査を中止します。')
        audit_ranking_perturbation(rs,profiles)
        return
    if args.verify:
        verify_input_provenance(rs,profiles)
        # manifest が欠けている場合は検証成功と扱わず、DBの無断採用も行わない。
        if not old:
            raise FileNotFoundError('検索データ/manifest.json がありません。検証中に生成せず、正しい既存DBを復元してください。')
        if old['signature']!=sign or old.get('rate_signature')!=hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest():
            raise ValueError('軍神データ・構成倍率と検索DBが不一致。--updateが必要です')
        hero_cost={int(k):v[1] for k,v in cur.items()}
        hero_stats={int(k):v[2:] for k,v in cur.items()}
        for i in range(11):
            blob=read_part(i,len(profiles))
            for j,profile in enumerate(profiles):
                prev_score=65536
                for pos in range(TOP):
                    offset=(j*TOP+pos)*RECORD_BYTES
                    row=struct.unpack_from(FMT,blob,offset)
                    ids=row[:6]
                    assert len(set(ids))==6
                    assert ''.join(map(str,(hero_cost[x] for x in ids)))==profile,(i,j,pos,ids)
                    vals=row[6:]
                    raw=[sum(hero_stats[x][n] for x in ids) for n in range(11)]
                    check=tuple(raw[n]*stat_rate(profile,n)//100 for n in range(11))
                    assert vals==check,(i,j,pos,vals,check)
                    assert vals[i]<=prev_score,(i,j,pos)
                    prev_score=vals[i]
            print(f'能力{i:02d}：全{len(profiles)*TOP:,}行・11能力・降順・軍神重複・コスト完全一致')
        audit_subsets_by_bruteforce()
        audit_recommended_and_measured(rs,profiles)
        audit_benchmarks_and_provenance(rs,profiles)
        audit_input_sensitivity(rs,profiles)
        audit_lower_freshness()
        audit_ranking_freshness()
        print('軍神DBの整合性確認完了：',len(rs),'登録 /',len(cur),'検索対象 /',len(profiles),'構成')
        return
    # データ本体が同一で倍率のみ変わった場合は、計算式に従い既存TOP500を一度だけ再採点する。
    if (args.update and old and old.get('hero_index')==cur
        and old.get('rate_signature')!=hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest()):
        rescore_existing_indices(rs,profiles,sign,cur)
        return
    affected=set(profiles)
    incremental=bool(old and not args.full and not removed and not changed and old.get('rate_signature')==hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest())
    if incremental:
        affected={p for p in profiles if any(str(cur[x][1]) in p for x in added)}
        if not added:
            # 神具・入手・名称などの表示メタデータのみ更新した場合は索引を再作成しない。
            write_atomic(ROOT/'軍神情報.js',compact_js(rs))
            old['signature']=sign
            write_atomic(oldpath,json.dumps(old,ensure_ascii=False,indent=2).encode('utf8'))
            print('検索順位は変更なし。軍神の表示メタデータのみ同期完了。')
            return
    print('再生成:',len(affected),'/',len(profiles),'構成、追加',len(added),'変更',len(changed),'削除',len(removed))
    cache={};newparts=[];outputs={}
    for i in range(11):
        previous_blob=read_part(i,len(profiles)) if incremental else None
        parts=[]
        for j,p in enumerate(profiles):
            if previous_blob is not None and p not in affected:
                chunk=previous_blob[j*TOP*RECORD_BYTES:(j+1)*TOP*RECORD_BYTES]
            else:
                r=profile_top500(p,i,rs,cache)
                if len(r)!=TOP:
                    raise ValueError(f'組合せ不足：{p} 能力{i}: {len(r)}。増員時は最少母集団の確認が必要')
                chunk=b''.join(r)
            parts.append(chunk)
        blob=b''.join(parts)
        # sort composition-top500 global to produce complete recommended-top500
        newparts.append(blob)
        outputs[DIRECTORY/f'組合せ_{i:02d}.js']=zjs(blob,i)
        print('完了:',i+1,'/11')
    # The recommended list contains top500 across all cost profiles, ordered by corresponding stat.
    recommended=b''
    for i,blob in enumerate(newparts):
        candidates=[]
        for j in range(len(profiles)):
            for k in range(TOP):
                off=(j*TOP+k)*RECORD_BYTES
                score=struct.unpack_from('<H',blob,off+6+2*i)[0]
                candidates.append((-score,j,k))
        candidates.sort()
        recommended+=b''.join(blob[(j*TOP+k)*RECORD_BYTES:(j*TOP+k+1)*RECORD_BYTES] for _,j,k in candidates[:TOP])
    outputs[DIRECTORY/'おすすめ.js']=('window.GUNSHIN_RECOMMENDED_DB="'+base64.b64encode(recommended).decode('ascii')+'";\n').encode('utf8')
    outputs[ROOT/'軍神情報.js']=compact_js(rs)
    manifest={'version':2,'signature':sign,'rate_signature':hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest(),'hero_index':cur,'profiles':profiles,
              'max_rows_per_profile':TOP,'bytes_per_row':RECORD_BYTES,'shards':11,
              'update_method':'cost-profile incremental k-best merge'}
    for path,data in outputs.items():write_atomic(path,data)
    write_atomic(oldpath,json.dumps(manifest,ensure_ascii=False,indent=2).encode('utf8'))
    print('更新完了：',len(cur),'設定可能＆数値確定',len(profiles),'コスト構成、11能力TOP500')

if __name__=='__main__':main()
