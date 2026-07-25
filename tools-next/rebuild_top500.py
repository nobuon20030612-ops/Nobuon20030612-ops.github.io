#!/usr/bin/env python3
from __future__ import annotations
import gzip, hashlib, json, struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'jinpo-next' / 'data' / 'compact_search_v2'
MANIFEST = DATA / 'jinpo_unified_search_manifest.json'
LIMIT = 500
REC = 52
STAT_OFFSETS = {
    '生命':21,'気合':23,'腕力':25,'耐久力':27,'器用さ':29,'知力':31,'魅力':33,
    '土属性':35,'水属性':37,'火属性':39,'風属性':41,
}

def read_gz(path: Path) -> bytes:
    with gzip.open(path, 'rb') as f:
        return f.read()

def write_gz(path: Path, raw: bytes) -> None:
    # Deterministic gzip (mtime=0), no embedded source filename.
    with path.open('wb') as out:
        with gzip.GzipFile(filename='', mode='wb', fileobj=out, compresslevel=6, mtime=0) as gz:
            gz.write(raw)

def meta(path: Path, raw: bytes, rows: int) -> dict:
    return {
        'rows': rows,
        'gzip_bytes': path.stat().st_size,
        'raw_bytes': len(raw),
        'sha256_16': hashlib.sha256(path.read_bytes()).hexdigest()[:16],
        'file': str(path.relative_to(ROOT / 'jinpo-next')).replace('\\','/'),
    }

def dtype_for(primary: str | None = None):
    names=['total','tie']; formats=['<u4','<u4']; offsets=[43,48]
    if primary:
        names.insert(0,'primary'); formats.insert(0,'<u2'); offsets.insert(0,STAT_OFFSETS[primary])
    return np.dtype({'names':names,'formats':formats,'offsets':offsets,'itemsize':REC})

def top_indices(raw: bytes, primary: str | None) -> np.ndarray:
    arr=np.frombuffer(raw, dtype=dtype_for(primary), offset=16)
    n=len(arr)
    if n == 0:
        return np.empty(0, dtype=np.int64)
    if primary:
        order=np.lexsort((arr['tie'], -arr['total'].astype(np.int64), -arr['primary'].astype(np.int64)))
    else:
        order=np.lexsort((arr['tie'], -arr['total'].astype(np.int64)))
    return order[:min(LIMIT,n)]

def build_from_full(full_path: Path, out_path: Path, primary: str | None) -> tuple[bytes,int]:
    raw=read_gz(full_path)
    if len(raw)<16 or raw[:4] != b'JCF1':
        raise RuntimeError(f'bad JCF1: {full_path}')
    rec_size=struct.unpack_from('<H',raw,6)[0]
    if rec_size != REC or (len(raw)-16)%REC:
        raise RuntimeError(f'bad record size: {full_path}')
    idx=top_indices(raw,primary)
    header=bytearray(raw[:16])
    struct.pack_into('<H',header,4,2)  # top/sort materialized dataset
    struct.pack_into('<I',header,8,len(idx))
    body=b''.join(raw[16+int(i)*REC:16+(int(i)+1)*REC] for i in idx)
    out_raw=bytes(header)+body
    write_gz(out_path,out_raw)
    return out_raw,len(idx)

def main():
    m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    old_version=m.get('version','')
    m['top_limit']=LIMIT
    m['sort_top_limit']=LIMIT

    # Rebuild every default Top dataset from the authoritative full compact dataset.
    for mode, counts in m.get('top',{}).items():
        for count, forms in counts.items():
            for formation, entry in forms.items():
                full=m['datasets'][mode][count][formation]
                full_path=ROOT/'jinpo-next'/full['file']
                out_path=ROOT/'jinpo-next'/entry['file']
                out_raw,rows=build_from_full(full_path,out_path,None)
                new=meta(out_path,out_raw,rows)
                entry.update(new)

    # Priority pre-index is only used for normal mode. Rebuild each first-priority stat to Top500.
    for mode, counts in m.get('sort_top',{}).items():
        for count, forms in counts.items():
            for formation, stats in forms.items():
                full=m['datasets'][mode][count][formation]
                full_path=ROOT/'jinpo-next'/full['file']
                # Decompress once per formation/count, then sort each stat from the same bytes.
                raw=read_gz(full_path)
                for stat, entry in stats.items():
                    idx=top_indices(raw,stat)
                    header=bytearray(raw[:16]); struct.pack_into('<H',header,4,2); struct.pack_into('<I',header,8,len(idx))
                    body=b''.join(raw[16+int(i)*REC:16+(int(i)+1)*REC] for i in idx)
                    out_raw=bytes(header)+body
                    out_path=ROOT/'jinpo-next'/entry['file']
                    write_gz(out_path,out_raw)
                    entry.update(meta(out_path,out_raw,len(idx)))

    # Browser cache version is derived from every compact file hash.
    # Re-running after a DB update can never silently reuse an older cached binary.
    version_parts=[]
    for section in ('datasets','top'):
        for mode,counts in m.get(section,{}).items():
            for count,forms in counts.items():
                for formation,entry in forms.items():
                    version_parts.append(f'{section}/{mode}/{count}/{formation}:{entry.get("sha256_16","")}')
    for mode,counts in m.get('sort_top',{}).items():
        for count,forms in counts.items():
            for formation,stats in forms.items():
                for stat,entry in stats.items():
                    version_parts.append(f'sort_top/{mode}/{count}/{formation}/{stat}:{entry.get("sha256_16","")}')
    fingerprint=hashlib.sha256('\n'.join(sorted(version_parts)).encode('utf-8')).hexdigest()[:12]
    m['version']='unified-v2-top500-'+fingerprint

    notes=[x for x in m.get('notes',[]) if 'top' not in str(x).lower() or '500' in str(x)]
    notes += ['default and priority top datasets rebuilt from authoritative full DB', 'Top500正式運用']
    m['notes']=notes
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'old_version':old_version,'new_version':m['version'],'top_limit':LIMIT},ensure_ascii=False))

if __name__=='__main__':
    main()
