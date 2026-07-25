#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,heapq,itertools,json,struct,sys,time
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SITE = ROOT
DATA=SITE/'data'/'compact_search_v2'
MANIFEST=DATA/'jinpo_unified_search_manifest.json'
REPORT_DIR=ROOT/'_jinpo-next-report'
REPORT=REPORT_DIR/'search_integrity_report.json'
REC=52
STAT_OFF={'生命':21,'気合':23,'腕力':25,'耐久力':27,'器用さ':29,'知力':31,'魅力':33,'土属性':35,'水属性':37,'火属性':39,'風属性':41}
LINES={'衡軛':[(0,1,2),(3,4,5)],'鶴翼':[(0,1,2),(3,4,5)],'魚鱗':[(0,1,2),(2,3,4),(4,5,0)],'方円':[(1,2,3),(3,4,5),(1,0,5)]}
GEN_REPORT=REPORT_DIR/'generation_report.json'
def csv_rows(path:Path):
    with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))

def read_raw(info):
    p=SITE/info['file']
    raw=gzip.decompress(p.read_bytes())
    if raw[:4]!=b'JCF1':raise RuntimeError(f'magic不一致: {info["file"]}')
    rec=struct.unpack_from('<H',raw,6)[0]
    if rec!=REC or (len(raw)-16)%REC:raise RuntimeError(f'record不正: {info["file"]}')
    rows=(len(raw)-16)//REC
    if rows!=int(info['rows']):raise RuntimeError(f'件数不一致: {info["file"]} {rows}!={info["rows"]}')
    if struct.unpack_from('<I',raw,8)[0]!=rows:raise RuntimeError(f'header件数不一致: {info["file"]}')
    return raw,rows

def rec_bytes(raw,i):return raw[16+i*REC:16+(i+1)*REC]
def stat_at(raw,off,stat):return struct.unpack_from('<H',raw,off+STAT_OFF[stat])[0]
def total_at(raw,off):return struct.unpack_from('<I',raw,off+43)[0]
def tie_at(raw,off):return struct.unpack_from('<I',raw,off+48)[0]

def keep_top(heap,item,limit=500):
    if len(heap)<limit:heapq.heappush(heap,item)
    elif item>heap[0]:heapq.heapreplace(heap,item)

def expected_top_indices(raw,rows,stats):
    default=[]; per={s:[] for s in stats}
    for i in range(rows):
        off=16+i*REC; total=total_at(raw,off); tie=tie_at(raw,off)
        keep_top(default,((total,-tie),-i,i))
        for s,h in per.items():keep_top(h,((stat_at(raw,off,s),total,-tie),-i,i))
    def ordered(h):return [x[2] for x in sorted(h,reverse=True)]
    return ordered(default),{s:ordered(h) for s,h in per.items()}

def compare_top_body(full_raw,idxs,info,label):
    top_raw,top_rows=read_raw(info)
    if top_rows!=len(idxs):raise RuntimeError(f'{label}: Top件数不一致 {top_rows}!={len(idxs)}')
    for pos,i in enumerate(idxs):
        if rec_bytes(top_raw,pos)!=rec_bytes(full_raw,i):
            raise RuntimeError(f'{label}: Top内容/順序不一致 pos={pos} full_row={i}')

def main():
    started=time.time();m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    # Master factors and bond factor requirements.
    heroes={};by_factor=defaultdict(list)
    for r in csv_rows(SITE/'data'/'jinpo_eiketsu_master.csv'):
        iid=str(r.get('internal_id',''))
        if not iid.startswith('EIK_'):continue
        hid=int(iid[4:]);fs=[str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3','因子4')]
        heroes[hid]=fs
        for f in set(x for x in fs if x and x not in ('-','対象外')):by_factor[f].append(hid)
    bonds={}
    for r in csv_rows(SITE/'data'/'jinpo_inen_master.csv'):
        bonds[int(r['No'])]=[str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3')]

    # Every unordered triple -> all bonds that can activate with three distinct heroes.
    triple_bonds=defaultdict(list)
    for bid,req in bonds.items():
        seen=set();A,B,C=(by_factor[x] for x in req)
        for a in A:
            for b in B:
                if b==a:continue
                for c in C:
                    if c==a or c==b:continue
                    key=tuple(sorted((a,b,c)))
                    if key not in seen:triple_bonds[key].append(bid);seen.add(key)

    # Deterministic assignment must match the JS engine: required factor order, then line hero order.
    line_cache={}
    def line_info(line):
        if line in line_cache:return line_cache[line]
        active=triple_bonds.get(tuple(sorted(line)),())
        result={}
        for bid in active:
            req=bonds[bid];used=[False,False,False];assigned=[]
            def dfs(i):
                if i==3:return True
                factor=req[i]
                for hi,hid in enumerate(line):
                    if used[hi]:continue
                    if factor in heroes[hid]:
                        used[hi]=True;assigned.append((hi,factor))
                        if dfs(i+1):return True
                        assigned.pop();used[hi]=False
                return False
            if not dfs(0):raise RuntimeError('因縁割当内部不整合')
            bits=0
            for hi,factor in assigned:
                f4=heroes[line[hi]][3]
                if f4 and f4 not in ('-','対象外') and factor==f4:bits|=1<<hi
            result[bid]=bits
        line_cache[line]=result;return result

    accessible_rows=0;bond_errors=0;f4_errors=0;datasets={}
    generation_counts={}
    if GEN_REPORT.exists():
        gr=json.loads(GEN_REPORT.read_text(encoding='utf-8'))
        if gr.get('status')!='PASS':raise RuntimeError('generation_reportがPASSではありません')
        generation_counts={k:int(v.get('rows',-1)) for k,v in gr.get('datasets',{}).items()}
    specs=[]
    for mode,counts in m.get('datasets',{}).items():
        for count_s,forms in counts.items():
            if mode=='normal' and str(count_s) in {'5','6'}:
                raise RuntimeError(f'廃止済み通常{count_s}因縁DBがmanifestに存在します')
            for formation,info in forms.items():
                specs.append((mode,int(count_s),formation,info))
    for mode,count,formation,info in specs:
        label=f'{mode}/{count}/{formation}'
        if generation_counts and label in generation_counts and int(info['rows'])!=generation_counts[label]:
            raise RuntimeError(f'生成レポート件数不一致 {label}: {info["rows"]}!={generation_counts[label]}')
        raw,rows=read_raw(info);be=fe=0
        for i in range(rows):
            off=16+i*REC;ids=struct.unpack_from('<6H',raw,off)
            stored=set(raw[off+12:off+12+count]);actual=set();f4slots=set()
            for line_idx in LINES[formation]:
                line=tuple(ids[j] for j in line_idx);linfo=line_info(line);actual.update(linfo.keys())
                for bid in stored:
                    bits=linfo.get(bid)
                    if bits is None:continue
                    for hi in range(3):
                        if bits&(1<<hi):f4slots.add(line_idx[hi])
            if actual!=stored:
                be+=1
                if be<=3:print(f'ERROR bondset {mode}/{count}/{formation} row={i}',file=sys.stderr)
            if len(f4slots)!=raw[off+47]:
                fe+=1
                if fe<=3:print(f'ERROR factor4 {mode}/{count}/{formation} row={i}',file=sys.stderr)
        if be or fe:raise RuntimeError(f'因縁/文曲不一致 {mode}/{count}/{formation}: bond={be} factor4={fe}')
        accessible_rows+=rows;bond_errors+=be;f4_errors+=fe
        datasets[f'{mode}/{count}/{formation}']={'rows':rows,'bondset_errors':be,'factor4_errors':fe}

    # Prove every pre-generated Top500 / single-priority Top500 is derived from its full DB.
    top_files=0;sort_files=0
    for mode,counts in m['datasets'].items():
        for count,forms in counts.items():
            for formation,full_info in forms.items():
                full_raw,rows=read_raw(full_info)
                stats=[]
                if mode in m.get('sort_top',{}) and count in m['sort_top'][mode] and formation in m['sort_top'][mode][count]:
                    stats=list(m['sort_top'][mode][count][formation].keys())
                default_idx,per=expected_top_indices(full_raw,rows,stats)
                top_info=m.get('top',{}).get(mode,{}).get(count,{}).get(formation)
                if top_info:
                    compare_top_body(full_raw,default_idx,top_info,f'top/{mode}/{count}/{formation}');top_files+=1
                for stat,idxs in per.items():
                    info=m['sort_top'][mode][count][formation][stat]
                    compare_top_body(full_raw,idxs,info,f'sort_top/{mode}/{count}/{formation}/{stat}');sort_files+=1

    report={
      'status':'PASS','accessible_full_records':accessible_rows,
      'bondset_errors':bond_errors,'factor4_errors':f4_errors,
      'dataset_count':len(specs),
      'top_files_exact':top_files,'sort_top_files_exact':sort_files,
      'triple_map_entries':len(triple_bonds),'line_cache_entries':len(line_cache),
      'datasets':datasets,'seconds':round(time.time()-started,3)
    }
    REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ('status','accessible_full_records','bondset_errors','factor4_errors','top_files_exact','sort_top_files_exact','seconds')},ensure_ascii=False))

if __name__=='__main__':
    try:main()
    except Exception as e:
        REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps({'status':'FAIL','error':str(e)},ensure_ascii=False,indent=2),encoding='utf-8')
        print('ERROR:',e,file=sys.stderr);sys.exit(1)
