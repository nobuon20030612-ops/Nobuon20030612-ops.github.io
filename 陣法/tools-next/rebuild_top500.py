#!/usr/bin/env python3
from __future__ import annotations
import gzip, hashlib, heapq, json, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT
DATA = SITE/'data'/'compact_search_v2'
MANIFEST = DATA/'jinpo_unified_search_manifest.json'
LIMIT = 500
REC = 52
STAT_OFFSETS = {'生命':21,'気合':23,'腕力':25,'耐久力':27,'器用さ':29,'知力':31,'魅力':33,'土属性':35,'水属性':37,'火属性':39,'風属性':41}

def read_gz(path): return gzip.decompress(path.read_bytes())
def write_gz(path,raw):
    with path.open('wb') as out:
        with gzip.GzipFile(filename='',mode='wb',fileobj=out,compresslevel=6,mtime=0) as z:z.write(raw)
def meta(path,raw,rows):
    gz=path.read_bytes()
    return {'rows':rows,'gzip_bytes':len(gz),'raw_bytes':len(raw),'sha256_16':hashlib.sha256(gz).hexdigest()[:16],'file':str(path.relative_to(SITE)).replace('\\','/')}
def keep(heap,item):
    if len(heap)<LIMIT:heapq.heappush(heap,item)
    elif item>heap[0]:heapq.heapreplace(heap,item)
def top_indices(raw,primary=None):
    n=(len(raw)-16)//REC
    h=[]
    for i in range(n):
        off=16+i*REC;total=struct.unpack_from('<I',raw,off+43)[0];tie=struct.unpack_from('<I',raw,off+48)[0]
        if primary:
            p=struct.unpack_from('<H',raw,off+STAT_OFFSETS[primary])[0];key=(p,total,-tie)
        else:key=(total,-tie)
        keep(h,(key,-i,i))
    return [x[2] for x in sorted(h,reverse=True)]
def materialize(raw,idx):
    h=bytearray(raw[:16]);struct.pack_into('<H',h,4,2);struct.pack_into('<I',h,8,len(idx))
    return bytes(h)+b''.join(raw[16+i*REC:16+(i+1)*REC] for i in idx)

def main():
    m=json.loads(MANIFEST.read_text(encoding='utf-8'));old=m.get('version','');m['top_limit']=LIMIT;m['sort_top_limit']=LIMIT
    raw_cache={}
    def full_raw(mode,count,form):
        k=(mode,count,form)
        if k not in raw_cache:
            info=m['datasets'][mode][count][form];raw_cache[k]=read_gz(SITE/info['file'])
        return raw_cache[k]
    for mode,counts in m.get('top',{}).items():
        for count,forms in counts.items():
            for form,e in forms.items():
                raw=full_raw(mode,count,form);out=materialize(raw,top_indices(raw,None));p=SITE/e['file'];write_gz(p,out);e.update(meta(p,out,(len(out)-16)//REC))
    for mode,counts in m.get('sort_top',{}).items():
        for count,forms in counts.items():
            for form,stats in forms.items():
                raw=full_raw(mode,count,form)
                for stat,e in stats.items():
                    out=materialize(raw,top_indices(raw,stat));p=SITE/e['file'];write_gz(p,out);e.update(meta(p,out,(len(out)-16)//REC))
    parts=[]
    for section in ('datasets','top'):
        for mode,counts in m.get(section,{}).items():
            for count,forms in counts.items():
                for form,e in forms.items():parts.append(f'{section}/{mode}/{count}/{form}:{e.get("sha256_16","")}')
    for mode,counts in m.get('sort_top',{}).items():
        for count,forms in counts.items():
            for form,stats in forms.items():
                for stat,e in stats.items():parts.append(f'sort_top/{mode}/{count}/{form}/{stat}:{e.get("sha256_16","")}')
    fingerprint=hashlib.sha256('\n'.join(sorted(parts)).encode()).hexdigest()[:12]
    m['version']='unified-v2-top500-'+fingerprint
    notes=list(m.get('notes',[]))
    for note in ('default and priority top datasets rebuilt from authoritative full DB','Top500正式運用'):
        if note not in notes:
            notes.append(note)
    m['notes']=notes
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'old_version':old,'new_version':m['version'],'top_limit':LIMIT},ensure_ascii=False))
if __name__=='__main__':main()
