#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""軍神検索データの更新（追加時は影響するコスト構成だけ差分再計算）。

必要ファイル: 軍神データ.csv / 軍神画像/<No>.webp / 既存の検索データ/組合せ_XX.js
使い方:
   python 更新検索データ.py --verify    # 現在のデータと検索索引を監査
   python 更新検索データ.py --update    # 軍神追加・ステータス更新後に索引を更新
   python 更新検索データ.py --full      # 念のため全構成を再作成

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
        vals=[int(raw[v]*RATES[profile][0 if v<2 else 1]//100) for v in range(11)]
        assert len(ids)==6 and len(set(ids))==6 and all(0<=v<65536 for v in vals)
        result.append(struct.pack(FMT,*ids,*vals))
        for j in range(len(pos)):
            if pos[j]+1>=len(lists[j]):continue
            n=pos[:j]+(pos[j]+1,)+pos[j+1:]
            if n in visited:continue
            visited.add(n);heapq.heappush(pq,(-score(n),n))
    return result

def compact_js(rs):
    shown=[r for r in rs if r['setting']=='設定可']
    arr=[[r['id'],r['name'],r['cost'],*r['values']] for r in shown]
    meta={str(r['id']):[r['godtool'],r['source']] for r in shown}
    levels={str(r['id']):r['level'] for r in shown}
    return ('window.GUNSHIN_HERO_ROWS='+json.dumps(arr,ensure_ascii=False,separators=(',',':'))+';\n'+
            'window.GUNSHIN_META='+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\n'+
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

def main():
    ap=argparse.ArgumentParser()
    group=ap.add_mutually_exclusive_group(required=True)
    group.add_argument('--verify',action='store_true')
    group.add_argument('--update',action='store_true')
    group.add_argument('--full',action='store_true')
    args=ap.parse_args()
    rs=read_rows();profiles=get_patterns();oldpath=DIRECTORY/'manifest.json'
    old=json.loads(oldpath.read_text('utf8')) if oldpath.is_file() else None
    sign=signature(rs)
    cur=index_records(rs)
    previous=old.get('hero_index',{}) if old else {}
    added=set(cur)-set(previous)
    removed=set(previous)-set(cur)
    changed={x for x in set(previous)&set(cur) if previous[x]!=cur[x]}
    if args.verify:
        # Support initial baseline manifest generation, but forbid silent stale data after adoption.
        if old and (old['signature']!=sign or old.get('rate_signature')!=hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest()):raise ValueError('軍神データ・構成倍率と検索DBが不一致。--updateが必要です')
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
                    check=tuple(raw[n]*RATES[profile][0 if n<2 else 1]//100 for n in range(11))
                    assert vals==check,(i,j,pos,vals,check)
                    assert vals[i]<=prev_score,(i,j,pos)
                    prev_score=vals[i]
            print(f'能力{i:02d}：全{len(profiles)*TOP:,}行・11能力・降順・軍神重複・コスト完全一致')
        if not old:
            # Baseline built from previously verified 112 hero data. Next run catches changed inputs.
            manifest={'version':2,'signature':sign,'rate_signature':hashlib.sha256((DIRECTORY/'構成倍率.json').read_bytes()).hexdigest(),'hero_index':cur,'profiles':profiles,
                      'max_rows_per_profile':TOP,'bytes_per_row':RECORD_BYTES,'shards':11,
                      'update_method':'cost-profile incremental k-best merge'}
            write_atomic(oldpath,json.dumps(manifest,ensure_ascii=False,indent=2).encode('utf8'))
        print('軍神DBの整合性確認完了：',len(rs),'登録 /',len(cur),'検索対象 /',len(profiles),'構成')
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
