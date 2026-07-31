#!/usr/bin/env python3
from __future__ import annotations

import csv
import gzip
import hashlib
import json
import shutil
import struct
import time
from collections import defaultdict
from pathlib import Path

try:
    import numpy as np
except Exception as e:
    raise SystemExit(f'numpy が必要です: {e}')

from factor4_optimizer import minimal_factor4_mask
from fullmax_model import STATS, calc_fullmax_stats

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT
DATA = SITE / 'data' / 'compact_search_v2'
MANIFEST = DATA / 'jinpo_unified_search_manifest.json'
FULLMAX_DIR = DATA / 'fullmax_stats'
RECOMMEND_DIR = DATA / 'fullmax_recommend'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'fullmax_search_report.json'

BASE_REC = 52
FULLMAX_REC = 26  # 11*uint16 + uint32 total
RECOMMEND_REC = 80  # formation byte + bond-count byte + base52 + fullmax26
LIMIT = 500
STAT_OFFSETS = {s:i*2 for i,s in enumerate(STATS)}
STAT_CODES = {'生命':'life','気合':'ki','腕力':'str','耐久力':'vit','器用さ':'dex','知力':'int','魅力':'cha','土属性':'earth','水属性':'water','火属性':'fire','風属性':'wind'}
FORMS = ['衡軛','鶴翼','魚鱗','方円']
FORM_CODES = {'衡軛':1,'鶴翼':2,'魚鱗':3,'方円':4}
FORM_FILE_CODES = {'衡軛':'kouyaku','鶴翼':'kakuyoku','魚鱗':'gyorin','方円':'hoen'}
MODE_COUNTS = {'normal':[7,8,9], 'grade3':[5,6,7,8,9]}
LINES = {
    '衡軛': [(0,1,2),(3,4,5)],
    '鶴翼': [(0,1,2),(3,4,5)],
    '魚鱗': [(0,1,2),(2,3,4),(4,5,0)],
    '方円': [(1,2,3),(3,4,5),(1,0,5)],
}


def csv_rows(path: Path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def norm_stat(s: str) -> str:
    s = str(s or '').strip().replace('生命力','生命')
    return {'耐久':'耐久力','器用':'器用さ','土':'土属性','水':'水属性','火':'火属性','風':'風属性'}.get(s,s)


def read_gz(path: Path) -> bytes:
    return gzip.decompress(path.read_bytes())


def write_gz(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('wb') as out:
        with gzip.GzipFile(filename='', mode='wb', fileobj=out, compresslevel=6, mtime=0) as z:
            z.write(raw)


def file_meta(path: Path, raw: bytes, rows: int, rec: int) -> dict:
    gz = path.read_bytes()
    return {
        'file': str(path.relative_to(SITE)).replace('\\','/'),
        'rows': rows,
        'record_size': rec,
        'gzip_bytes': len(gz),
        'raw_bytes': len(raw),
        'sha256_16': hashlib.sha256(gz).hexdigest()[:16],
    }


def load_model():
    heroes = {}
    for r in csv_rows(SITE/'data'/'jinpo_eiketsu_master.csv'):
        iid = str(r.get('internal_id','')).strip()
        if not iid.startswith('EIK_'):
            continue
        hid = int(iid[4:])
        heroes[hid] = {
            'f':[str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3','因子4')],
            's':[int(float(r.get(s) or 0)) for s in STATS],
        }

    bonds = {}
    bond_names = {}
    for r in csv_rows(SITE/'data'/'jinpo_inen_master.csv'):
        bid = int(r['No'])
        bonds[bid] = [str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3')]
        bond_names[bid] = str(r.get('因縁名','')).strip()

    coef_name = defaultdict(dict)
    for r in csv_rows(SITE/'data'/'91因縁_計算式_倍率展開.csv'):
        name = str(r.get('因縁名','')).strip()
        stat = norm_stat(r.get('対象ステータス',''))
        value = float(r.get('実効係数') or 0)
        if name and stat in STATS and value > 0:
            coef_name[name][stat] = value
    coef = {bid:[coef_name.get(name,{}).get(s,0.0) for s in STATS] for bid,name in bond_names.items()}

    formation_bonus_pct = {}
    for r in csv_rows(SITE/'data'/'formation_bonus.csv'):
        form = str(r.get('formation','')).strip()
        if not form:
            continue
        pct=[]
        for stat in STATS:
            factor=float(str(r.get(stat,'')).strip() or '1.00')
            hundred=round((factor-1.0)*100)
            if abs(factor-(1.0+hundred/100.0))>1e-9 or hundred<0:
                raise RuntimeError(f'formation_bonus不正: {form} {stat}={factor}')
            pct.append(int(hundred))
        formation_bonus_pct[form]=pct
    return heroes,bonds,coef,formation_bonus_pct


def validate_base(raw: bytes, info: dict, label: str) -> int:
    if len(raw)<16 or raw[:4]!=b'JCF1':
        raise RuntimeError(f'compact magic不一致: {label}')
    rec=struct.unpack_from('<H',raw,6)[0]
    rows=struct.unpack_from('<I',raw,8)[0]
    if rec!=BASE_REC or rows!=int(info.get('rows',-1)) or len(raw)!=16+rows*BASE_REC:
        raise RuntimeError(f'compact構造不一致: {label}')
    return rows


def build_sidecars(m: dict, heroes, bonds, coef, formation_bonus_pct):
    if FULLMAX_DIR.exists():
        shutil.rmtree(FULLMAX_DIR)
    FULLMAX_DIR.mkdir(parents=True, exist_ok=True)
    section={'normal':{},'grade3':{}}
    assign_cache={}
    total_rows=0
    started=time.time()
    for mode,counts in m.get('datasets',{}).items():
        section.setdefault(mode,{})
        for count_s,forms in counts.items():
            section[mode].setdefault(count_s,{})
            count=int(count_s)
            for form,info in forms.items():
                raw=read_gz(SITE/info['file']); rows=validate_base(raw,info,f'{mode}/{count}/{form}')
                out=bytearray(16+rows*FULLMAX_REC)
                struct.pack_into('<4sHHII',out,0,b'JMX1',1,FULLMAX_REC,rows,0)
                for i in range(rows):
                    off=16+i*BASE_REC
                    placement=struct.unpack_from('<6H',raw,off)
                    bond_ids=tuple(int(x) for x in raw[off+12:off+12+count] if x)
                    f4mask=minimal_factor4_mask(placement,form,bond_ids,LINES,heroes,bonds,assign_cache)
                    vals,total=calc_fullmax_stats(placement,f4mask,bond_ids,form,heroes,coef,formation_bonus_pct)
                    dst=16+i*FULLMAX_REC
                    struct.pack_into('<11H',out,dst,*vals)
                    struct.pack_into('<I',out,dst+22,total)
                path=FULLMAX_DIR/mode/f'c{count}_{FORM_FILE_CODES[form]}.bin.gz'
                write_gz(path,bytes(out))
                section[mode][count_s][form]=file_meta(path,bytes(out),rows,FULLMAX_REC)
                total_rows+=rows
                print('FULLMAX',mode,count,form,rows,flush=True)
    return section,total_rows,round(time.time()-started,3)


def load_sidecar(info: dict, expected_rows: int) -> bytes:
    raw=read_gz(SITE/info['file'])
    if len(raw)<16 or raw[:4]!=b'JMX1':
        raise RuntimeError(f'fullMAX magic不一致: {info["file"]}')
    rec=struct.unpack_from('<H',raw,6)[0]; rows=struct.unpack_from('<I',raw,8)[0]
    if rec!=FULLMAX_REC or rows!=expected_rows or rows!=int(info.get('rows',-1)) or len(raw)!=16+rows*FULLMAX_REC:
        raise RuntimeError(f'fullMAX構造不一致: {info["file"]}')
    return raw


def top_indices_single(primary, ties, counts, limit):
    # Existing recommendation semantics: target stat desc, then stable tie/count.
    # Do not introduce total-score as a new tie-break just for fullMAX.
    n=len(primary)
    if not n:return np.empty(0,dtype=np.int64)
    k=min(limit,n)
    if n>k:
        threshold=np.partition(primary,n-k)[n-k]
        cand=np.flatnonzero(primary>=threshold)
    else:cand=np.arange(n,dtype=np.int64)
    pv=primary[cand].astype(np.int64);zv=ties[cand].astype(np.int64);cv=counts[cand].astype(np.int64)
    order=np.lexsort((cv,zv,-pv))
    return cand[order[:k]]


def top_indices_pair(primary,secondary,totals,ties,counts,limit):
    # Existing pair semantics: sum, first, second, total, stable tie/count.
    n=len(primary)
    if not n:return np.empty(0,dtype=np.int64)
    k=min(limit,n);score=primary.astype(np.uint32)+secondary.astype(np.uint32)
    if n>k:
        threshold=np.partition(score,n-k)[n-k];cand=np.flatnonzero(score>=threshold)
    else:cand=np.arange(n,dtype=np.int64)
    sv=score[cand].astype(np.int64);pv=primary[cand].astype(np.int64);qv=secondary[cand].astype(np.int64);tv=totals[cand].astype(np.int64);zv=ties[cand].astype(np.int64);cv=counts[cand].astype(np.int64)
    order=np.lexsort((cv,zv,-tv,-qv,-pv,-sv))
    return cand[order[:k]]


def build_recommend(m: dict, fullmax_section: dict):
    if RECOMMEND_DIR.exists():
        shutil.rmtree(RECOMMEND_DIR)
    RECOMMEND_DIR.mkdir(parents=True,exist_ok=True)
    single_section={'normal':{},'grade3':{}}
    pair_section={'normal':{},'grade3':{}}
    files=rows_written=0
    for mode in ('normal','grade3'):
        single_payloads={s:bytearray() for s in STATS}
        pair_payloads={(p,s):bytearray() for p in STATS for s in STATS if s!=p}
        for form in FORMS:
            rec_parts=[];fm_parts=[];count_parts=[];total_parts=[];tie_parts=[];source_rows=0
            for count in MODE_COUNTS[mode]:
                c=str(count)
                base_info=(((m.get('datasets') or {}).get(mode) or {}).get(c) or {}).get(form)
                fm_info=(((fullmax_section.get(mode) or {}).get(c) or {}).get(form))
                if not base_info or not fm_info or int(base_info.get('rows',0) or 0)<=0:continue
                base_raw=read_gz(SITE/base_info['file']); n=validate_base(base_raw,base_info,f'{mode}/{count}/{form}')
                fm_raw=load_sidecar(fm_info,n)
                records=np.ndarray((n,BASE_REC),dtype=np.uint8,buffer=base_raw,offset=16,strides=(BASE_REC,1)).copy()
                fm_records=np.ndarray((n,FULLMAX_REC),dtype=np.uint8,buffer=fm_raw,offset=16,strides=(FULLMAX_REC,1)).copy()
                ties=np.ndarray((n,),dtype='<u4',buffer=base_raw,offset=16+48,strides=(BASE_REC,)).copy()
                totals=np.ndarray((n,),dtype='<u4',buffer=fm_raw,offset=16+22,strides=(FULLMAX_REC,)).copy()
                rec_parts.append(records);fm_parts.append(fm_records);count_parts.append(np.full(n,count,dtype=np.uint8));total_parts.append(totals);tie_parts.append(ties);source_rows+=n
            if not source_rows:continue
            records=np.concatenate(rec_parts,axis=0);fm_records=np.concatenate(fm_parts,axis=0);counts=np.concatenate(count_parts);totals=np.concatenate(total_parts);ties=np.concatenate(tie_parts)
            matrix=np.empty((source_rows,len(STATS)),dtype=np.uint16)
            for si in range(len(STATS)):
                # fm_records is copied contiguous rows of bytes; reinterpret each 2-byte field.
                matrix[:,si]=fm_records[:,si*2:si*2+2].copy().view('<u2').reshape(-1)
            fcode=FORM_CODES[form]
            for pi,pname in enumerate(STATS):
                idxs=top_indices_single(matrix[:,pi],ties,counts,LIMIT);payload=single_payloads[pname]
                for idx in idxs.tolist():
                    payload.append(fcode);payload.append(int(counts[idx]));payload.extend(records[idx].tobytes());payload.extend(fm_records[idx].tobytes())
                for si,sname in enumerate(STATS):
                    if si==pi:continue
                    idxs=top_indices_pair(matrix[:,pi],matrix[:,si],totals,ties,counts,LIMIT);payload2=pair_payloads[(pname,sname)]
                    for idx in idxs.tolist():
                        payload2.append(fcode);payload2.append(int(counts[idx]));payload2.extend(records[idx].tobytes());payload2.extend(fm_records[idx].tobytes())
        mode_dir=RECOMMEND_DIR/mode;mode_dir.mkdir(parents=True,exist_ok=True)
        for stat,payload in single_payloads.items():
            n=len(payload)//RECOMMEND_REC;raw=struct.pack('<4sHHII',b'JMR1',1,RECOMMEND_REC,n,0)+bytes(payload)
            path=mode_dir/f'{STAT_CODES[stat]}.bin.gz';write_gz(path,raw);single_section[mode][stat]=file_meta(path,raw,n,RECOMMEND_REC);files+=1;rows_written+=n
        for p in STATS:
            pair_section[mode].setdefault(p,{})
            for s in STATS:
                if s==p:continue
                payload=pair_payloads[(p,s)];n=len(payload)//RECOMMEND_REC;raw=struct.pack('<4sHHII',b'JMR1',1,RECOMMEND_REC,n,0)+bytes(payload)
                path=mode_dir/f'{STAT_CODES[p]}__{STAT_CODES[s]}.bin.gz';write_gz(path,raw);pair_section[mode][p][s]=file_meta(path,raw,n,RECOMMEND_REC);files+=1;rows_written+=n
    return single_section,pair_section,files,rows_written


def fingerprint_manifest(m: dict) -> str:
    parts=[]
    def add_flat(section):
        for mode,counts in (m.get(section) or {}).items():
            for count,forms in counts.items():
                for form,e in forms.items():parts.append(f'{section}/{mode}/{count}/{form}:{e.get("sha256_16","")}')
    for sec in ('datasets','top','fullmax_stats'):
        add_flat(sec)
    for section in ('sort_top',):
        for mode,counts in (m.get(section) or {}).items():
            for count,forms in counts.items():
                for form,stats in forms.items():
                    for stat,e in stats.items():parts.append(f'{section}/{mode}/{count}/{form}/{stat}:{e.get("sha256_16","")}')
    for section in ('recommend_sum_top','fullmax_recommend_sum_top'):
        for mode,primaries in (m.get(section) or {}).items():
            for primary,secondaries in primaries.items():
                for secondary,e in secondaries.items():parts.append(f'{section}/{mode}/{primary}/{secondary}:{e.get("sha256_16","")}')
    for mode,stats in (m.get('fullmax_recommend_top') or {}).items():
        for stat,e in stats.items():parts.append(f'fullmax_recommend_top/{mode}/{stat}:{e.get("sha256_16","")}')
    return hashlib.sha256('\n'.join(sorted(parts)).encode()).hexdigest()[:12]


def validate_existing_sidecars(m: dict):
    section=m.get('fullmax_stats') or {}
    if int(m.get('fullmax_stats_record_size') or 0)!=FULLMAX_REC:
        raise RuntimeError('fullmax_stats_record_sizeがありません。先にrebuild_all_compact.pyを実行してください')
    total=0; files=0
    for mode,counts in (m.get('datasets') or {}).items():
        for count_s,forms in counts.items():
            for form,base_info in forms.items():
                fm_info=(((section.get(mode) or {}).get(count_s) or {}).get(form))
                if not fm_info:
                    raise RuntimeError(f'全MAX sidecar不足: {mode}/{count_s}/{form}')
                raw=read_gz(SITE/base_info['file'])
                n=validate_base(raw,base_info,f'{mode}/{count_s}/{form}')
                load_sidecar(fm_info,n)
                total+=n;files+=1
    return section,total,files


def main():
    started=time.time();m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    sidecar_seconds=0.0
    try:
        section,total_rows,sidecar_files=validate_existing_sidecars(m)
        sidecar_source='existing-valid'
    except RuntimeError:
        # sidecarが未同梱・不完全な場合だけ、compact本体から安全に再生成する。
        heroes,bonds,coef,formation_bonus_pct=load_model()
        section,total_rows,sidecar_seconds=build_sidecars(m,heroes,bonds,coef,formation_bonus_pct)
        sidecar_files=sum(len(forms) for counts in section.values() for forms in counts.values())
        m['fullmax_stats']=section
        m['fullmax_stats_record_size']=FULLMAX_REC
        m['fullmax_model']='全MAX: 見聞録MAX+鬼神石MAX+転生MAX(最小文曲使用英傑を除外)'
        sidecar_source='rebuilt-from-compact'
    single,pairs,files,rec_rows=build_recommend(m,section)
    m['fullmax_recommend_top']=single
    m['fullmax_recommend_sum_top']=pairs
    m['fullmax_recommend_limit']=LIMIT
    m['fullmax_recommend_record_size']=RECOMMEND_REC
    m['fullmax_model']='全MAX: 見聞録MAX+鬼神石MAX+転生MAX(最小文曲使用英傑を除外)'
    notes=list(m.get('notes',[]))
    note='全MAX込み合計検索用ステータスsidecar＋おすすめTop500を事前生成'
    if note not in notes:notes.append(note)
    m['notes']=notes
    m['version']='unified-v2-top500-recsum-fullmax-'+fingerprint_manifest(m)
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report={'status':'PASS','schema':'jinpo-fullmax-search/v2','fullmax_record_size':FULLMAX_REC,'recommend_record_size':RECOMMEND_REC,'full_records':total_rows,'sidecar_files':sidecar_files,'sidecar_source':sidecar_source,'sidecar_seconds':sidecar_seconds,'recommend_files':files,'recommend_rows':rec_rows,'seconds':round(time.time()-started,3),'version':m['version']}
    REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    try:main()
    except Exception as e:
        REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps({'status':'FAIL','error':str(e)},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        raise
