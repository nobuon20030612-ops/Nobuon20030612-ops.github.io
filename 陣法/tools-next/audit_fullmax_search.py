#!/usr/bin/env python3
from __future__ import annotations

import gzip
import json
import struct
import time
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT
DATA=SITE/'data'/'compact_search_v2'
MANIFEST=DATA/'jinpo_unified_search_manifest.json'
REPORT_DIR=ROOT/'_jinpo-next-report'
REPORT=REPORT_DIR/'fullmax_search_audit_report.json'
BASE_REC=52
FULLMAX_REC=26
RECOMMEND_REC=80
STATS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
FORM_CODE={1:'衡軛',2:'鶴翼',3:'魚鱗',4:'方円'}


def ungzip(rel:str)->bytes:
    return gzip.decompress((SITE/rel).read_bytes())


def read_base(info:dict):
    raw=ungzip(info['file'])
    if len(raw)<16 or raw[:4]!=b'JCF1':raise RuntimeError(f'base magic不一致: {info["file"]}')
    rec=struct.unpack_from('<H',raw,6)[0];rows=struct.unpack_from('<I',raw,8)[0]
    if rec!=BASE_REC or rows!=int(info.get('rows',-1)) or len(raw)!=16+rows*rec:raise RuntimeError(f'base構造不一致: {info["file"]}')
    return raw,rows


def read_sidecar(info:dict,expected:int):
    raw=ungzip(info['file'])
    if len(raw)<16 or raw[:4]!=b'JMX1':raise RuntimeError(f'fullMAX magic不一致: {info["file"]}')
    rec=struct.unpack_from('<H',raw,6)[0];rows=struct.unpack_from('<I',raw,8)[0]
    if rec!=FULLMAX_REC or rows!=expected or rows!=int(info.get('rows',-1)) or len(raw)!=16+rows*rec:raise RuntimeError(f'fullMAX構造不一致: {info["file"]}')
    return raw


def better(a,b,pidx,sidx):
    # (stats,total,tie,count); mirrors Worker recommendation ordering.
    ast,at,az,ac=a;bst,bt,bz,bc=b
    if sidx is None:
        if ast[pidx]!=bst[pidx]:return ast[pidx]>bst[pidx]
        if az!=bz:return az<bz
        return ac<bc
    av,asv=ast[pidx],ast[sidx];bv,bsv=bst[pidx],bst[sidx]
    if av+asv!=bv+bsv:return av+asv>bv+bsv
    if av!=bv:return av>bv
    if asv!=bsv:return asv>bsv
    if at!=bt:return at>bt
    if az!=bz:return az<bz
    return ac<bc


def parse_recommend(info:dict,pstat:str,sstat:str|None,refs:dict):
    raw=ungzip(info['file'])
    if len(raw)<16 or raw[:4]!=b'JMR1':raise RuntimeError(f'おすすめmagic不一致: {info["file"]}')
    rec=struct.unpack_from('<H',raw,6)[0];rows=struct.unpack_from('<I',raw,8)[0]
    if rec!=RECOMMEND_REC or rows!=int(info.get('rows',-1)) or len(raw)!=16+rows*rec:raise RuntimeError(f'おすすめ構造不一致: {info["file"]}')
    pidx=STATS.index(pstat);sidx=STATS.index(sstat) if sstat else None
    grouped=defaultdict(list)
    for i in range(rows):
        off=16+i*rec;form=FORM_CODE.get(raw[off]);count=int(raw[off+1])
        if not form or count<5 or count>9:raise RuntimeError(f'おすすめform/count不正: {info["file"]} row={i}')
        base=bytes(raw[off+2:off+54]);fm=bytes(raw[off+54:off+80]);tie=struct.unpack_from('<I',base,48)[0]
        stats=struct.unpack_from('<11H',fm,0);total=struct.unpack_from('<I',fm,22)[0]
        grouped[form].append((stats,total,tie,count))
        key=(count,form,tie)
        payload=base+fm
        old=refs.get(key)
        if old is None:refs[key]=payload
        elif old!=payload:raise RuntimeError(f'おすすめ同一tieのpayload不一致: {info["file"]} {key}')
    for form,items in grouped.items():
        if len(items)>500:raise RuntimeError(f'おすすめ500件超過: {info["file"]} {form}={len(items)}')
        for i in range(1,len(items)):
            if better(items[i],items[i-1],pidx,sidx):raise RuntimeError(f'おすすめ並び順不一致: {info["file"]} {form} row={i}')
    return rows


def main():
    started=time.time();m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if int(m.get('fullmax_stats_record_size') or 0)!=FULLMAX_REC:raise RuntimeError('fullmax_stats_record_size不一致')
    if int(m.get('fullmax_recommend_record_size') or 0)!=RECOMMEND_REC:raise RuntimeError('fullmax_recommend_record_size不一致')
    # sidecarはaudit_search_integrity.pyが全件数値再計算済み。ここでは構造と対応を独立に再確認する。
    sidecar_files=sidecar_rows=0
    base_cache={};fm_cache={}
    for mode,counts in (m.get('datasets') or {}).items():
        for count,forms in counts.items():
            for form,info in forms.items():
                base,n=read_base(info)
                fm_info=(((m.get('fullmax_stats') or {}).get(mode) or {}).get(count) or {}).get(form)
                if not fm_info:raise RuntimeError(f'fullMAX sidecar不足: {mode}/{count}/{form}')
                fm=read_sidecar(fm_info,n)
                base_cache[(mode,int(count),form)]=(base,n);fm_cache[(mode,int(count),form)]=fm
                sidecar_files+=1;sidecar_rows+=n

    recommend_files=recommend_rows=0
    # modeごとに参照tieを集め、元full DB + sidecarとbyte単位で一致させる。
    for mode in ('normal','grade3'):
        refs={}
        for pstat,info in ((m.get('fullmax_recommend_top') or {}).get(mode) or {}).items():
            recommend_rows+=parse_recommend(info,pstat,None,refs);recommend_files+=1
        for pstat,seconds in ((m.get('fullmax_recommend_sum_top') or {}).get(mode) or {}).items():
            for sstat,info in seconds.items():
                recommend_rows+=parse_recommend(info,pstat,sstat,refs);recommend_files+=1
        pending=dict(refs)
        by_dataset=defaultdict(dict)
        for (count,form,tie),payload in pending.items():by_dataset[(count,form)][tie]=payload
        for (count,form),needed in by_dataset.items():
            pair=base_cache.get((mode,count,form));fm=fm_cache.get((mode,count,form))
            if pair is None or fm is None:raise RuntimeError(f'おすすめ参照元DB不足: {mode}/{count}/{form}')
            base,n=pair;found=set()
            for i in range(n):
                bo=16+i*BASE_REC;tie=struct.unpack_from('<I',base,bo+48)[0]
                expected=needed.get(tie)
                if expected is None:continue
                payload=bytes(base[bo:bo+BASE_REC])+bytes(fm[16+i*FULLMAX_REC:16+(i+1)*FULLMAX_REC])
                if payload!=expected:raise RuntimeError(f'おすすめ参照元payload不一致: {mode}/{count}/{form} tie={tie}')
                found.add(tie)
            missing=set(needed)-found
            if missing:raise RuntimeError(f'おすすめ参照元に存在しないtie: {mode}/{count}/{form} count={len(missing)}')

    report={'status':'PASS','schema':'jinpo-fullmax-search-audit/v2','sidecar_files':sidecar_files,'sidecar_records_structural_checked':sidecar_rows,'recommend_files_checked':recommend_files,'recommend_records_checked':recommend_rows,'seconds':round(time.time()-started,3)}
    REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':
    try:main()
    except Exception as e:
        REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps({'status':'FAIL','error':str(e)},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        raise
