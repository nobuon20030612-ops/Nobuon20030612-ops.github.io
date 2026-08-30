#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,heapq,itertools,json,struct,sys,time
from collections import defaultdict
from pathlib import Path
from formation_spec import LINES
from fullmax_model import STATS
from rebuild_all_compact import Generator, load_model

ROOT=Path(__file__).resolve().parents[1]
SITE = ROOT
DATA=SITE/'data'/'compact_search_v2'
MANIFEST=DATA/'jinpo_unified_search_manifest.json'
REPORT_DIR=ROOT/'_jinpo-next-report'
REPORT=REPORT_DIR/'search_integrity_report.json'
REC=52
FULLMAX_REC=26
STAT_OFF={'生命':21,'気合':23,'腕力':25,'耐久力':27,'器用さ':29,'知力':31,'魅力':33,'土属性':35,'水属性':37,'火属性':39,'風属性':41}
GEN_REPORT=REPORT_DIR/'generation_report.json'

# Independent full-record oracle. IMPORTANT: never derive/import this from formation_spec.LINES.
# This intentionally duplicates the user-confirmed invariant so a common-mode spec corruption is detectable.
INDEPENDENT_CANONICAL_LINES_ZERO={
 '衡軛': ((0,1,2),(3,4,5)),
 '鶴翼': ((0,1,2),(3,4,5)),
 '魚鱗': ((0,1,2),(2,3,4),(4,5,0)),
 '方円': ((0,1,2),(2,3,4),(4,5,0)),
}

def independent_mask(verifier, ids, formation):
    # Fast independent lookup: use only the precomputed triple->bond mask map.
    # Do not call placement_mask(), which reads the shared formation_spec.LINES path.
    get=verifier.tm.get
    mask=0
    for a,b,c in INDEPENDENT_CANONICAL_LINES_ZERO[formation]:
        mask |= get(tuple(sorted((ids[a],ids[b],ids[c]))),0)
    return mask
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

def read_fullmax(info,expected_rows):
    p=SITE/info['file']; raw=gzip.decompress(p.read_bytes())
    if raw[:4]!=b'JMX1':raise RuntimeError(f'fullMAX magic不一致: {info["file"]}')
    rec=struct.unpack_from('<H',raw,6)[0];rows=struct.unpack_from('<I',raw,8)[0]
    if rec!=FULLMAX_REC or rows!=expected_rows or rows!=int(info.get('rows',-1)) or len(raw)!=16+rows*FULLMAX_REC:
        raise RuntimeError(f'fullMAX record不正: {info["file"]}')
    return raw


def main():
    started=time.time();m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if LINES != INDEPENDENT_CANONICAL_LINES_ZERO:
        raise RuntimeError(f'共有陣形正本が独立オラクルと不一致: shared={LINES} independent={INDEPENDENT_CANONICAL_LINES_ZERO}')
    # 全件監査は現行正本から組み立てた高速照合器を使う。
    # 文曲アルゴリズム自体の独立brute-force比較は audit_runtime_regressions.py で実DB180件を別実装比較する。
    heroes,grade3,bonds,bond_names,coef,formation_bonus_pct=load_model()
    verifier=Generator(sorted(heroes),heroes,bonds,coef,formation_bonus_pct)

    accessible_rows=0;bond_errors=0;canonical_oracle_errors=0;f4_errors=0;fullmax_errors=0;fullmax_records_checked=0;datasets={}
    row_structure_errors=0;duplicate_combo_errors=0;grade3_cost_errors=0
    grade3_set=set(grade3)
    # 同一ライン構造を持つ陣形同士は、同じ6人＋因縁集合なら文曲人数も一致必須。
    cycle_pair_maps={}; cycle_pair_factor4_errors=0
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
        raw,rows=read_raw(info);be=coe=fe=fme=0;pair_errors=0;pair_seen=set()
        se=de=ge=0;seen_semantic=(None if formation in {'魚鱗','方円'} else set())
        fm_info=(((m.get('fullmax_stats') or {}).get(mode) or {}).get(str(count)) or {}).get(formation)
        if not fm_info: raise RuntimeError(f'全MAX sidecar不足 {label}')
        fm_raw=read_fullmax(fm_info,rows)
        for i in range(rows):
            off=16+i*REC;ids=struct.unpack_from('<6H',raw,off)
            active=tuple(raw[off+12:off+12+count])
            rest=raw[off+12+count:off+21]
            # build_jinpo_next.pyで従来別走査していた全件構造/意味監査をここへ統合する。
            # これにより安全性を落とさず、220万件のPython全走査を1回にする。
            if len(set(ids))!=6:
                se+=1
                if se<=3:print(f'ERROR duplicate hero {label} row={i}',file=sys.stderr)
            if any(b==0 for b in active) or len(set(active))!=count:
                se+=1
                if se<=3:print(f'ERROR active bond structure {label} row={i}',file=sys.stderr)
            if any(rest):
                se+=1
                if se<=3:print(f'ERROR rest bond slots {label} row={i}',file=sys.stderr)
            if any(b not in bonds for b in active):
                se+=1
                if se<=3:print(f'ERROR bond id range {label} row={i}',file=sys.stderr)
            if any(hid not in heroes for hid in ids):
                se+=1
                if se<=3:print(f'ERROR hero id range {label} row={i}',file=sys.stderr)
            if mode=='grade3' and any(hid not in grade3_set for hid in ids):
                ge+=1
                if ge<=3:print(f'ERROR grade3 cost guard {label} row={i}',file=sys.stderr)
            if raw[off+47]>6:
                se+=1
                if se<=3:print(f'ERROR factor4 stored range {label} row={i}',file=sys.stderr)
            sem_key=struct.pack('<6H',*sorted(ids))+bytes(sorted(active))
            if seen_semantic is not None:
                if sem_key in seen_semantic:
                    de+=1
                    if de<=3:print(f'ERROR semantic duplicate {label} row={i}',file=sys.stderr)
                seen_semantic.add(sem_key)
            stored=set(active)
            # Independent oracle first: direct union of triple masks using the user-confirmed absolute lines.
            # This does NOT call verifier.placement_mask(), because that method uses shared formation_spec.LINES.
            canonical_mask=independent_mask(verifier,ids,formation)
            stored_mask=0
            for bid in active:
                stored_mask |= 1 << (bid-1)
            if canonical_mask!=stored_mask:
                coe+=1
                if coe<=3:print(f'ERROR independent-canonical bondset {mode}/{count}/{formation} row={i}',file=sys.stderr)
                continue
            canonical_bids,_=verifier.mask_info(canonical_mask)
            # The shared LINES object was independently compared once at audit start.
            # Use the independent canonical mask for every record so the row oracle does not reuse the generator path.
            mask=canonical_mask
            f4mask=verifier.factor4_mask(ids,formation,canonical_bids)
            expected_f4=f4mask.bit_count()
            if expected_f4!=raw[off+47]:
                fe+=1
                if fe<=3:print(f'ERROR factor4 {mode}/{count}/{formation} row={i} stored={raw[off+47]} expected={expected_f4}',file=sys.stderr)
            if formation in {'魚鱗','方円'}:
                sem_key=struct.pack('<6H',*sorted(ids))+bytes(sorted(stored))
                pair_key=(mode,count)
                if formation=='魚鱗':
                    pair_map=cycle_pair_maps.setdefault(pair_key,{})
                    if sem_key in pair_map:
                        de+=1
                        if de<=3:print(f'ERROR semantic duplicate {label} row={i}',file=sys.stderr)
                    pair_map[sem_key]=expected_f4
                else:
                    pair_map=cycle_pair_maps.get(pair_key,{})
                    peer=pair_map.get(sem_key)
                    if peer is None or peer!=expected_f4:
                        pair_errors+=1
                        if pair_errors<=3:print(f'ERROR cycle-pair factor4 {mode}/{count} row={i} fish={peer} hoen={expected_f4}',file=sys.stderr)
                    if sem_key in pair_seen:
                        de+=1
                        if de<=3:print(f'ERROR semantic duplicate {label} row={i}',file=sys.stderr)
                    pair_seen.add(sem_key)
            _,_,fullmax_raw=verifier.shared_effects(ids,mask,f4mask)
            exp_vals,exp_total=verifier.apply_formation_bonus(fullmax_raw,formation)
            fm_off=16+i*FULLMAX_REC
            got_vals=struct.unpack_from('<11H',fm_raw,fm_off);got_total=struct.unpack_from('<I',fm_raw,fm_off+22)[0]
            if tuple(exp_vals)!=tuple(got_vals) or exp_total!=got_total:
                fme+=1
                if fme<=3:print(f'ERROR fullmax {mode}/{count}/{formation} row={i}',file=sys.stderr)
        if formation=='方円':
            pair_key=(mode,count); pair_map=cycle_pair_maps.get(pair_key,{})
            missing=len(pair_map)-len(pair_seen)
            if missing>0: pair_errors+=missing
            cycle_pair_maps.pop(pair_key,None)
        if be or coe or fe or fme or pair_errors or se or de or ge:
            raise RuntimeError(f'検索DB全件監査不一致 {mode}/{count}/{formation}: structure={se} duplicate={de} grade3={ge} shared_bond={be} independent_canonical={coe} factor4={fe} fullmax={fme} cycle_pair={pair_errors}')
        accessible_rows+=rows;bond_errors+=be;canonical_oracle_errors+=coe;f4_errors+=fe;fullmax_errors+=fme;fullmax_records_checked+=rows;cycle_pair_factor4_errors+=pair_errors
        row_structure_errors+=se;duplicate_combo_errors+=de;grade3_cost_errors+=ge
        datasets[f'{mode}/{count}/{formation}']={'rows':rows,'row_structure_errors':se,'duplicate_combo_errors':de,'grade3_cost_errors':ge,'bondset_errors':be,'independent_canonical_oracle_errors':coe,'factor4_errors':fe,'fullmax_errors':fme,'cycle_pair_factor4_errors':pair_errors}

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
      'row_structure_errors':row_structure_errors,'duplicate_combo_errors':duplicate_combo_errors,'grade3_cost_errors':grade3_cost_errors,
      'bondset_errors':bond_errors,'independent_canonical_oracle_errors':canonical_oracle_errors,'factor4_errors':f4_errors,
      'cycle_pair_factor4_errors':cycle_pair_factor4_errors,
      'fullmax_errors':fullmax_errors,'fullmax_records_checked':fullmax_records_checked,
      'dataset_count':len(specs),
      'top_files_exact':top_files,'sort_top_files_exact':sort_files,
      'triple_map_entries':len(verifier.tm),'line_cache_entries':0,
      'independent_canonical_lines_zero':{k:[list(x) for x in v] for k,v in INDEPENDENT_CANONICAL_LINES_ZERO.items()},
      'datasets':datasets,'seconds':round(time.time()-started,3)
    }
    REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ('status','accessible_full_records','row_structure_errors','duplicate_combo_errors','grade3_cost_errors','bondset_errors','independent_canonical_oracle_errors','factor4_errors','cycle_pair_factor4_errors','fullmax_errors','fullmax_records_checked','top_files_exact','sort_top_files_exact','seconds')},ensure_ascii=False))

if __name__=='__main__':
    try:main()
    except Exception as e:
        REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps({'status':'FAIL','error':str(e)},ensure_ascii=False,indent=2),encoding='utf-8')
        print('ERROR:',e,file=sys.stderr);sys.exit(1)
