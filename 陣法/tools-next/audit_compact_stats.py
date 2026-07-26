#!/usr/bin/env python3
from __future__ import annotations

import csv
import gzip
import json
import math
import struct
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'compact_search_v2'
MANIFEST = DATA / 'jinpo_unified_search_manifest.json'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'compact_stats_report.json'
REC = 52
STATS = ['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']


def rows(path: Path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def norm_stat(v: str) -> str:
    s=str(v or '').strip().replace('生命力','生命')
    return {'耐久':'耐久力','器用':'器用さ','土':'土属性','水':'水属性','火':'火属性','風':'風属性'}.get(s,s)


def load_model():
    heroes={}
    for r in rows(ROOT/'data'/'jinpo_eiketsu_master.csv'):
        iid=str(r.get('internal_id','')).strip()
        if not (iid.startswith('EIK_') and iid[4:].isdigit()): continue
        hid=int(iid[4:])
        heroes[hid]=[int(float(r.get(s) or 0)) for s in STATS]
    bond_names={int(r['No']):str(r['因縁名']).strip() for r in rows(ROOT/'data'/'jinpo_inen_master.csv')}
    coef_name=defaultdict(dict)
    for r in rows(ROOT/'data'/'91因縁_計算式_倍率展開.csv'):
        name=str(r.get('因縁名','')).strip(); stat=norm_stat(r.get('対象ステータス',''))
        try: value=float(r.get('実効係数') or 0)
        except Exception: value=0
        if name and stat in STATS and value>0: coef_name[name][stat]=value
    coef={bid:[coef_name.get(name,{}).get(s,0.0) for s in STATS] for bid,name in bond_names.items()}
    bonus={}
    for r in rows(ROOT/'data'/'formation_bonus.csv'):
        form=str(r.get('formation','')).strip()
        if not form: continue
        pct=[]
        for stat in STATS:
            factor=float(str(r.get(stat,'')).strip() or '1.00')
            hundred=round((factor-1.0)*100)
            if abs(factor-(1.0+hundred/100.0))>1e-9: raise RuntimeError(f'formation_bonus非1%刻み: {form} {stat}')
            pct.append(int(hundred))
        bonus[form]=pct
    return heroes,coef,bonus


def expected_stats(p,bids,form,heroes,coef,bonus):
    base=[sum(heroes[h][i] for h in p) for i in range(11)]
    raw=[0]*11
    for bid in bids:
        if bid not in coef: raise RuntimeError(f'未知因縁ID: {bid}')
        for i,mult in enumerate(coef[bid]):
            if mult: raw[i]+=math.floor(base[i]*mult+1e-9)
    vals=[raw[i]*(100+bonus[form][i])//100 for i in range(11)]
    return vals,sum(vals)


def main():
    started=time.time()
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    heroes,coef,bonus=load_model()
    checked=errors=0
    first=[]
    for mode,counts in manifest.get('datasets',{}).items():
        for count_s,forms in counts.items():
            count=int(count_s)
            for form,entry in forms.items():
                path=ROOT/entry['file']
                raw=gzip.decompress(path.read_bytes())
                if len(raw)<16 or raw[:4]!=b'JCF1' or struct.unpack_from('<H',raw,6)[0]!=REC:
                    raise RuntimeError(f'compact形式不正: {entry["file"]}')
                n=struct.unpack_from('<I',raw,8)[0]
                if len(raw)!=16+n*REC: raise RuntimeError(f'compact長不正: {entry["file"]}')
                for i in range(n):
                    off=16+i*REC
                    p=tuple(struct.unpack_from('<6H',raw,off))
                    if any(h not in heroes for h in p): raise RuntimeError(f'未知英傑ID: {entry["file"]} row={i}')
                    bids=[int(x) for x in raw[off+12:off+12+count] if x]
                    stored=[struct.unpack_from('<H',raw,off+21+2*j)[0] for j in range(11)]
                    total=struct.unpack_from('<I',raw,off+43)[0]
                    exp,exp_total=expected_stats(p,bids,form,heroes,coef,bonus)
                    checked+=1
                    if stored!=exp or total!=exp_total:
                        errors+=1
                        if len(first)<20:
                            first.append({'file':entry['file'],'row':i,'heroes':p,'bond_ids':bids,'stored':stored,'expected':exp,'stored_total':total,'expected_total':exp_total})
    report={'status':'PASS' if errors==0 else 'FAIL','records_checked':checked,'stat_errors':errors,'first_errors':first,'seconds':round(time.time()-started,3)}
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))
    if errors: raise SystemExit(1)


if __name__=='__main__':
    main()
