#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,hashlib,json,os,re,shutil,struct,subprocess,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'bond56_index'
MASTER=ROOT/'data'/'jinpo_eiketsu_master.csv'
INEN=ROOT/'data'/'jinpo_inen_master.csv'
COEF=ROOT/'data'/'91因縁_計算式_倍率展開.csv'
FORM_BONUS=ROOT/'data'/'formation_bonus.csv'
FORM_SPEC=ROOT/'data'/'jinpo_formation_spec.json'
CPP=ROOT/'tools-next'/'bond56_index_builder.cpp'
STATS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
IGNORE={'','対象外','未確認','?'}

def rows(path):
    with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))

def hid(s:str)->int:
    m=re.fullmatch(r'EIK_(\d+)',str(s or '').strip())
    if not m: raise RuntimeError(f'internal_id形式不正: {s!r}')
    return int(m.group(1))

def deterministic_gzip(raw:bytes,level:int=6)->bytes:
    import io
    bio=io.BytesIO()
    with gzip.GzipFile(filename='',mode='wb',fileobj=bio,compresslevel=level,mtime=0) as g:g.write(raw)
    return bio.getvalue()

def build_model():
    hr=rows(MASTER); br=rows(INEN); cr=rows(COEF); fr=rows(FORM_BONUS)
    factors=['']; seen={''}
    for h in hr:
        for k in ('因子1','因子2','因子3','因子4'):
            v=str(h.get(k,'') or '').strip()
            if v not in IGNORE and v not in seen: factors.append(v);seen.add(v)
    for b in br:
        for k in ('因子1','因子2','因子3'):
            v=str(b.get(k,'') or '').strip()
            if v and v not in seen:factors.append(v);seen.add(v)
    fi={v:i for i,v in enumerate(factors)}
    maxh=max(hid(h['internal_id']) for h in hr); heroes=[None]*(maxh+1)
    from fullmax_model import enhanced_hero_stat
    for h in hr:
        n=hid(h['internal_id']); fs=[]
        for k in ('因子1','因子2','因子3','因子4'):
            v=str(h.get(k,'') or '').strip()
            if v not in IGNORE:fs.append(fi[v])
        s=[int(float(h.get(st,0) or 0)) for st in STATS]
        p=[enhanced_hero_stat(s[i],STATS[i],False) for i in range(11)]
        t=[enhanced_hero_stat(s[i],STATS[i],True) for i in range(11)]
        heroes[n]={'n':str(h.get('英傑名','')).strip(),'i':h['internal_id'],'f':fs,'s':s,'p':p,'t':t,'c':int(float(h.get('コスト',0) or 0))}
    maxb=max(int(b['No']) for b in br); bonds=[None]*(maxb+1)
    coef=[[0]*11 for _ in range(maxb+1)]; si={s:i for i,s in enumerate(STATS)}
    for r in cr:
        bid=int(r['No']); st=str(r.get('対象ステータス','')).strip()
        if st in si:
            coef[bid][si[st]]=int(round(float(r.get('実効係数',0) or 0)*10000))
    for b in br:
        bid=int(b['No']); bonds[bid]={'n':str(b['因縁名']).strip(),'r':[fi[str(b[k]).strip()] for k in ('因子1','因子2','因子3')],'m':coef[bid]}
    formationBonus={}
    for r in fr:
        form=str(r['formation']).strip();formationBonus[form]=[int(round((float(r.get(st,1) or 1)-1)*100)) for st in STATS]
    spec=json.loads(FORM_SPEC.read_text(encoding='utf-8'))['formations']; forms=list(spec)
    activeLines={f:[[int(x)-1 for x in line] for line in spec[f]['activeLines']] for f in forms}
    model={'schema':'tairano-bond56-model/v1','stats':STATS,'maxHeroId':maxh,'maxBondId':maxb,'factors':factors,'heroes':heroes,'bonds':bonds,'formationBonus':formationBonus,'activeLines':activeLines,'forms':forms}
    return model

def main():
    model=build_model(); OUT.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='bond56_build_') as td:
        td=Path(td); inp=td/'input.txt'; rawout=td/'raw';rawout.mkdir()
        with inp.open('w',encoding='utf-8',newline='\n') as f:
            f.write(f"{model['maxHeroId']} {model['maxBondId']} {len(model['factors'])-1}\n")
            for i,h in enumerate(model['heroes']):
                if h is None:f.write(f"{i} 0 0 0 0 0 0\n")
                else:
                    fs=list(h['f'])[:4]+[0]*4;fs=fs[:4]
                    f.write(f"{i} 1 {len(h['f'])} {' '.join(map(str,fs))}\n")
            for i in range(1,model['maxBondId']+1):f.write(f"{i} {' '.join(map(str,model['bonds'][i]['r']))}\n")
        exe=td/'bond56_builder'
        subprocess.run(['g++','-O3','-std=c++17',str(CPP),'-o',str(exe)],check=True)
        subprocess.run([str(exe),str(inp),str(rawout)],check=True)
        model_raw=json.dumps(model,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        raws={'bond56_model.json':model_raw}
        for n in ['bond56_core.bin','bondsets.bin','cycle2_c5.bin','cycle2_c6.bin','cycle3_c5.bin','cycle3_c6.bin','disjoint_c5.bin','disjoint_c6.bin']:
            raws[n]=(rawout/n).read_bytes()
        # Ensure individual GitHub Pages files remain <25 MiB after gzip.
        files={}; input_hash=hashlib.sha256()
        for n in sorted(raws):input_hash.update(n.encode());input_hash.update(raws[n])
        version='bond56-auto-'+input_hash.hexdigest()[:16]
        for rawname,raw in raws.items():
            gzname=rawname+'.gz'; gz=deterministic_gzip(raw,6); (OUT/gzname).write_bytes(gz)
            if len(gz)>=25*1024*1024:raise RuntimeError(f'25MiB制限超過: {gzname} {len(gz)}')
            files[gzname]={'file':f'data/bond56_index/{gzname}','gzip_bytes':len(gz),'raw_bytes':len(raw),'sha256_16':hashlib.sha256(gz).hexdigest()[:16]}
        manifest={'schema':'tairano-bond56-index/v1','version':version,'files':files}
        (OUT/'bond56_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        # Delete stale raw files if a prior interrupted build left any.
        for p in OUT.iterdir():
            if p.is_file() and p.suffix in {'.bin','.json'} and p.name!='bond56_manifest.json':
                if not p.name.endswith('.gz'): p.unlink()
    print(json.dumps({'status':'PASS','version':version,'maxHeroId':model['maxHeroId'],'heroes':sum(h is not None for h in model['heroes']),'bonds':model['maxBondId'],'files':files},ensure_ascii=False))
if __name__=='__main__':main()
