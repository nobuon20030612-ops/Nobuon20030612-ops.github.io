#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,heapq,itertools,json,struct,sys,time
from collections import defaultdict
from pathlib import Path
from factor4_optimizer import minimal_factor4_mask
from fullmax_model import STATS, calc_fullmax_stats

ROOT=Path(__file__).resolve().parents[1]
SITE = ROOT
DATA=SITE/'data'/'compact_search_v2'
MANIFEST=DATA/'jinpo_unified_search_manifest.json'
REPORT_DIR=ROOT/'_jinpo-next-report'
REPORT=REPORT_DIR/'search_integrity_report.json'
REC=52
FULLMAX_REC=26
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

def read_fullmax(info,expected_rows):
    p=SITE/info['file']; raw=gzip.decompress(p.read_bytes())
    if raw[:4]!=b'JMX1':raise RuntimeError(f'fullMAX magic不一致: {info["file"]}')
    rec=struct.unpack_from('<H',raw,6)[0];rows=struct.unpack_from('<I',raw,8)[0]
    if rec!=FULLMAX_REC or rows!=expected_rows or rows!=int(info.get('rows',-1)) or len(raw)!=16+rows*FULLMAX_REC:
        raise RuntimeError(f'fullMAX record不正: {info["file"]}')
    return raw


def main():
    started=time.time();m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    # Master factors and bond factor requirements.
    heroes={};by_factor=defaultdict(list)
    for r in csv_rows(SITE/'data'/'jinpo_eiketsu_master.csv'):
        iid=str(r.get('internal_id',''))
        if not iid.startswith('EIK_'):continue
        hid=int(iid[4:]);fs=[str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3','因子4')]
        heroes[hid]={'f':fs,'s':[int(float(r.get(s) or 0)) for s in STATS]}
        for f in set(x for x in fs if x and x not in ('-','対象外')):by_factor[f].append(hid)
    bonds={}; bond_names={}
    for r in csv_rows(SITE/'data'/'jinpo_inen_master.csv'):
        bid=int(r['No']); bonds[bid]=[str(r.get(k,'')).strip() for k in ('因子1','因子2','因子3')]; bond_names[bid]=str(r.get('因縁名','')).strip()

    def norm_stat(s):
        s=str(s or '').strip().replace('生命力','生命')
        return {'耐久':'耐久力','器用':'器用さ','土':'土属性','水':'水属性','火':'火属性','風':'風属性'}.get(s,s)
    coef_by_name=defaultdict(dict)
    for r in csv_rows(SITE/'data'/'91因縁_計算式_倍率展開.csv'):
        name=str(r.get('因縁名','')).strip(); stat=norm_stat(r.get('対象ステータス','')); val=float(r.get('実効係数') or 0)
        if name and stat in STATS and val>0: coef_by_name[name][stat]=val
    coef={bid:[coef_by_name.get(name,{}).get(s,0.0) for s in STATS] for bid,name in bond_names.items()}
    formation_bonus_pct={}
    for r in csv_rows(SITE/'data'/'formation_bonus.csv'):
        form=str(r.get('formation','')).strip()
        if not form: continue
        formation_bonus_pct[form]=[int(round((float(str(r.get(s,'')).strip() or '1.00')-1.0)*100)) for s in STATS]

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

    # 発動因縁集合はライン単位で確認し、文曲人数は全ライン・全割当を横断して最小化する。
    line_cache={}
    f4_assign_cache={}
    def line_info(line):
        if line in line_cache:return line_cache[line]
        result={bid:True for bid in triple_bonds.get(tuple(sorted(line)),())}
        line_cache[line]=result;return result

    accessible_rows=0;bond_errors=0;f4_errors=0;fullmax_errors=0;fullmax_records_checked=0;datasets={}
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
        raw,rows=read_raw(info);be=fe=fme=0
        fm_info=(((m.get('fullmax_stats') or {}).get(mode) or {}).get(str(count)) or {}).get(formation)
        if not fm_info: raise RuntimeError(f'全MAX sidecar不足 {label}')
        fm_raw=read_fullmax(fm_info,rows)
        for i in range(rows):
            off=16+i*REC;ids=struct.unpack_from('<6H',raw,off)
            stored=set(raw[off+12:off+12+count]);actual=set()
            for line_idx in LINES[formation]:
                line=tuple(ids[j] for j in line_idx);linfo=line_info(line);actual.update(linfo.keys())
            if actual!=stored:
                be+=1
                if be<=3:print(f'ERROR bondset {mode}/{count}/{formation} row={i}',file=sys.stderr)
                # 古いDB/マスタ不一致時は無効なstored bondを文曲最小化へ渡さず、
                # まず因縁集合不一致として安全に監査を継続する。
                continue
            f4mask=minimal_factor4_mask(ids,formation,tuple(sorted(stored)),LINES,heroes,bonds,f4_assign_cache)
            expected_f4=f4mask.bit_count()
            if expected_f4!=raw[off+47]:
                fe+=1
                if fe<=3:print(f'ERROR factor4 {mode}/{count}/{formation} row={i} stored={raw[off+47]} expected={expected_f4}',file=sys.stderr)
            exp_vals,exp_total=calc_fullmax_stats(ids,f4mask,tuple(sorted(stored)),formation,heroes,coef,formation_bonus_pct)
            fm_off=16+i*FULLMAX_REC
            got_vals=struct.unpack_from('<11H',fm_raw,fm_off);got_total=struct.unpack_from('<I',fm_raw,fm_off+22)[0]
            if tuple(exp_vals)!=tuple(got_vals) or exp_total!=got_total:
                fme+=1
                if fme<=3:print(f'ERROR fullmax {mode}/{count}/{formation} row={i}',file=sys.stderr)
        if be or fe or fme:raise RuntimeError(f'因縁/文曲/全MAX不一致 {mode}/{count}/{formation}: bond={be} factor4={fe} fullmax={fme}')
        accessible_rows+=rows;bond_errors+=be;f4_errors+=fe;fullmax_errors+=fme;fullmax_records_checked+=rows
        datasets[f'{mode}/{count}/{formation}']={'rows':rows,'bondset_errors':be,'factor4_errors':fe,'fullmax_errors':fme}

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
      'fullmax_errors':fullmax_errors,'fullmax_records_checked':fullmax_records_checked,
      'dataset_count':len(specs),
      'top_files_exact':top_files,'sort_top_files_exact':sort_files,
      'triple_map_entries':len(triple_bonds),'line_cache_entries':len(line_cache),
      'datasets':datasets,'seconds':round(time.time()-started,3)
    }
    REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ('status','accessible_full_records','bondset_errors','factor4_errors','fullmax_errors','fullmax_records_checked','top_files_exact','sort_top_files_exact','seconds')},ensure_ascii=False))

if __name__=='__main__':
    try:main()
    except Exception as e:
        REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps({'status':'FAIL','error':str(e)},ensure_ascii=False,indent=2),encoding='utf-8')
        print('ERROR:',e,file=sys.stderr);sys.exit(1)
