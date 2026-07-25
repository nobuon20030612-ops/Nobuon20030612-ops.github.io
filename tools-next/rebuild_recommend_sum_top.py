#!/usr/bin/env python3
from __future__ import annotations

import gzip
import hashlib
import json
import shutil
import struct
import time
from pathlib import Path

try:
    import numpy as np
except Exception as e:
    raise SystemExit(f'numpy が必要です: {e}')

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'jinpo-next'
DATA = SITE / 'data' / 'compact_search_v2'
MANIFEST = DATA / 'jinpo_unified_search_manifest.json'
OUT_DIR = DATA / 'recommend_sum_top'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'recommend_sum_top_report.json'

LIMIT = 500
SRC_REC = 52
OUT_REC = 54
STATS = ['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
STAT_OFFSETS = {'生命':21,'気合':23,'腕力':25,'耐久力':27,'器用さ':29,'知力':31,'魅力':33,'土属性':35,'水属性':37,'火属性':39,'風属性':41}
STAT_CODES = {'生命':'life','気合':'ki','腕力':'str','耐久力':'vit','器用さ':'dex','知力':'int','魅力':'cha','土属性':'earth','水属性':'water','火属性':'fire','風属性':'wind'}
FORMS = ['衡軛','鶴翼','魚鱗','方円']
FORM_CODES = {'衡軛':1,'鶴翼':2,'魚鱗':3,'方円':4}
MODE_COUNTS = {'normal':[7,8,9], 'grade3':[5,6,7,8,9]}

def read_gz(path: Path) -> bytes:
    return gzip.decompress(path.read_bytes())

def write_gz(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('wb') as out:
        with gzip.GzipFile(filename='', mode='wb', fileobj=out, compresslevel=6, mtime=0) as z:
            z.write(raw)

def metadata(path: Path, raw: bytes, rows: int) -> dict:
    gz = path.read_bytes()
    return {
        'file': str(path.relative_to(SITE)).replace('\\','/'),
        'rows': rows,
        'gzip_bytes': len(gz),
        'raw_bytes': len(raw),
        'sha256_16': hashlib.sha256(gz).hexdigest()[:16],
        'record_size': OUT_REC,
        'limit_per_formation': LIMIT,
    }

def load_formation(m: dict, mode: str, formation: str):
    rec_parts=[]; count_parts=[]; stats_parts=[]; total_parts=[]; tie_parts=[]; source_rows=0
    for count in MODE_COUNTS[mode]:
        info = (((m.get('datasets') or {}).get(mode) or {}).get(str(count)) or {}).get(formation)
        if not info or int(info.get('rows',0) or 0) <= 0:
            continue
        raw = read_gz(SITE / info['file'])
        if len(raw) < 16 or raw[:4] != b'JCF1':
            raise RuntimeError(f'compact magic不一致: {mode}/{count}/{formation}')
        rec = struct.unpack_from('<H', raw, 6)[0]; rows = struct.unpack_from('<I', raw, 8)[0]
        if rec != SRC_REC or rows != int(info.get('rows',0)) or len(raw) != 16 + rows*SRC_REC:
            raise RuntimeError(f'compact構造不一致: {mode}/{count}/{formation}')
        records = np.ndarray((rows,SRC_REC), dtype=np.uint8, buffer=raw, offset=16, strides=(SRC_REC,1)).copy()
        stat_matrix = np.empty((rows,len(STATS)), dtype=np.uint16)
        for si,stat in enumerate(STATS):
            stat_matrix[:,si] = np.ndarray((rows,), dtype='<u2', buffer=raw, offset=16+STAT_OFFSETS[stat], strides=(SRC_REC,))
        totals = np.ndarray((rows,), dtype='<u4', buffer=raw, offset=16+43, strides=(SRC_REC,)).copy()
        ties = np.ndarray((rows,), dtype='<u4', buffer=raw, offset=16+48, strides=(SRC_REC,)).copy()
        rec_parts.append(records); count_parts.append(np.full(rows,count,dtype=np.uint8)); stats_parts.append(stat_matrix); total_parts.append(totals); tie_parts.append(ties); source_rows += rows
    if not source_rows:
        return None
    return {'records':np.concatenate(rec_parts,axis=0),'counts':np.concatenate(count_parts),'stats':np.concatenate(stats_parts,axis=0),'totals':np.concatenate(total_parts),'ties':np.concatenate(tie_parts),'source_rows':source_rows}

def top_indices(primary, secondary, totals, ties, limit):
    n=len(primary)
    if n==0: return np.empty(0,dtype=np.int64)
    k=min(limit,n); score=primary.astype(np.uint32)+secondary.astype(np.uint32)
    if n>k:
        threshold=np.partition(score,n-k)[n-k]; cand=np.flatnonzero(score>=threshold)
    else:
        cand=np.arange(n,dtype=np.int64)
    sv=score[cand].astype(np.int64); pv=primary[cand].astype(np.int64); qv=secondary[cand].astype(np.int64); tv=totals[cand].astype(np.int64); zv=ties[cand].astype(np.int64)
    order=np.lexsort((zv,-tv,-qv,-pv,-sv))
    return cand[order[:k]]

def fingerprint_manifest(m: dict) -> str:
    parts=[]
    for section in ('datasets','top'):
        for mode,counts in (m.get(section) or {}).items():
            for count,forms in counts.items():
                for form,e in forms.items(): parts.append(f'{section}/{mode}/{count}/{form}:{e.get("sha256_16","")}')
    for mode,counts in (m.get('sort_top') or {}).items():
        for count,forms in counts.items():
            for form,stats in forms.items():
                for stat,e in stats.items(): parts.append(f'sort_top/{mode}/{count}/{form}/{stat}:{e.get("sha256_16","")}')
    for mode,primaries in (m.get('recommend_sum_top') or {}).items():
        for primary,secondaries in primaries.items():
            for secondary,e in secondaries.items(): parts.append(f'recommend_sum_top/{mode}/{primary}/{secondary}:{e.get("sha256_16","")}')
    return hashlib.sha256('\n'.join(sorted(parts)).encode()).hexdigest()[:12]

def main():
    started=time.time(); m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if OUT_DIR.exists(): shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True,exist_ok=True)
    section={'normal':{},'grade3':{}}; total_files=0; total_rows=0; source_rows_by_mode={}
    for mode in ('normal','grade3'):
        pair_payloads={(p,s):bytearray() for p in STATS for s in STATS if s!=p}; source_rows_by_mode[mode]=0
        for formation in FORMS:
            data=load_formation(m,mode,formation)
            if not data: continue
            source_rows_by_mode[mode]+=data['source_rows']; records=data['records']; counts=data['counts']; matrix=data['stats']; totals=data['totals']; ties=data['ties']; fcode=FORM_CODES[formation]
            for pi,primary_name in enumerate(STATS):
                primary=matrix[:,pi]
                for si,secondary_name in enumerate(STATS):
                    if si==pi: continue
                    idxs=top_indices(primary,matrix[:,si],totals,ties,LIMIT); payload=pair_payloads[(primary_name,secondary_name)]
                    for idx in idxs.tolist():
                        payload.append(fcode); payload.append(int(counts[idx])); payload.extend(records[idx].tobytes())
        mode_dir=OUT_DIR/mode; mode_dir.mkdir(parents=True,exist_ok=True)
        for primary in STATS:
            section[mode].setdefault(primary,{})
            for secondary in STATS:
                if secondary==primary: continue
                payload=pair_payloads[(primary,secondary)]; rows=len(payload)//OUT_REC; raw=struct.pack('<4sHHII',b'JRS1',1,OUT_REC,rows,0)+bytes(payload)
                path=mode_dir/f'{STAT_CODES[primary]}__{STAT_CODES[secondary]}.bin.gz'; write_gz(path,raw); section[mode][primary][secondary]=metadata(path,raw,rows); total_files+=1; total_rows+=rows
    m['recommend_sum_top']=section; m['recommend_sum_top_limit']=LIMIT; m['recommend_sum_top_record_size']=OUT_REC
    notes=list(m.get('notes',[])); note='おすすめ陣法の第1＋第2合計Top500を事前生成（因縁数混在・陣形別）'
    if note not in notes: notes.append(note)
    m['notes']=notes; m['version']='unified-v2-top500-recsum-'+fingerprint_manifest(m)
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report={'status':'PASS','schema':'jinpo-recommend-sum-top/v1','limit_per_formation':LIMIT,'record_size':OUT_REC,'files':total_files,'rows':total_rows,'source_rows_by_mode':source_rows_by_mode,'version':m['version'],'seconds':round(time.time()-started,3)}
    REPORT_DIR.mkdir(exist_ok=True); REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
