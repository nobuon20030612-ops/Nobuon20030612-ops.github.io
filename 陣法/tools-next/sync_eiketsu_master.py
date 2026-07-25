#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'source-next'/'英傑一覧.csv'
SITE = ROOT
MASTER = SITE/'data'/'jinpo_eiketsu_master.csv'
INEN = SITE/'data'/'jinpo_inen_master.csv'
JOB_MAP = SITE/'data'/'jinpo_job_mapping.json'
ID_MAP = ROOT/'tools-next'/'hero_internal_id_map.json'
OVERRIDES = ROOT/'tools-next'/'approved_overrides.json'
REPORT_DIR = ROOT/'_jinpo-next-report'
REPORT = REPORT_DIR/'master_sync.json'

REQUIRED = [
    '番号','コスト','名前','育成技能1:(0凸)','育成技能2:(0凸)','育成技能3:(0凸)',
    '生命','気合','腕力','耐久','器用','知力','魅力','土','水','火','風',
    '因子1(特化)','因子2(2凸)','因子3(LV20)','因子4(文曲)'
]
FIELD_MAP = {
    'コスト':'コスト','育成技能1':'育成技能1:(0凸)','育成技能2':'育成技能2:(0凸)','育成技能3':'育成技能3:(0凸)',
    '生命':'生命','気合':'気合','腕力':'腕力','耐久力':'耐久','器用さ':'器用','知力':'知力','魅力':'魅力',
    '土属性':'土','水属性':'水','火属性':'火','風属性':'風',
    '因子1':'因子1(特化)','因子2':'因子2(2凸)','因子3':'因子3(LV20)','因子4':'因子4(文曲)'
}
NUMERIC_MASTER = {'コスト','生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性'}
FACTOR_MASTER = {'因子1','因子2','因子3','因子4'}


def read_csv(path: Path):
    raw = path.read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError as e:
        raise RuntimeError(f'{path.relative_to(ROOT)}: UTF-8で読めません: {e}')
    if '\ufffd' in text:
        raise RuntimeError(f'{path.relative_to(ROOT)}: 置換文字U+FFFDを検出')
    reader = csv.DictReader(text.splitlines())
    rows = list(reader)
    return rows, list(reader.fieldnames or [])


def apply_overrides(rows):
    applied=[]
    if not OVERRIDES.exists():
        return applied
    data=json.loads(OVERRIDES.read_text(encoding='utf-8'))
    seen=defaultdict(int)
    for r in rows:
        name=str(r.get('名前','')).strip();seen[name]+=1
        for item in data.get('rows',[]):
            if str(item.get('name','')).strip()!=name or int(item.get('occurrence',1))!=seen[name]:
                continue
            fld=str(item.get('source_field','')).strip()
            before=str(r.get(fld,'')).strip(); expected=str(item.get('source_value','')).strip(); canonical=str(item.get('canonical_value','')).strip()
            if before==expected:
                r[fld]=canonical
                applied.append({'name':name,'occurrence':seen[name],'field':fld,'from':before,'to':canonical,'reason':item.get('reason','')})
            elif before!=canonical:
                raise RuntimeError(f'承認済み補正の前提値と一致しません: {name} {fld}={before}')
    return applied


def load_job_lookup():
    data=json.loads(JOB_MAP.read_text(encoding='utf-8'))
    lookup={}
    for job,specs in data.get('jobToSpecializations',{}).items():
        for s in specs:
            lookup[str(s).strip()]=job
    return lookup


def resolve_job(factor1,lookup):
    f=str(factor1 or '').strip()
    legacy_aliases={
        '武士道':'侍','暗殺術':'忍者','古神道':'神主/巫女','召喚術':'陰陽師',
        '修験':'薬師','医術':'薬師','神通':'薬師',
    }
    if f in lookup:
        return lookup[f]
    if f in legacy_aliases:
        return legacy_aliases[f]
    # mapping notesに従い、先頭2文字一致は一意な場合だけ許可。
    candidates={job for spec,job in lookup.items() if len(f)>=2 and len(spec)>=2 and f[:2]==spec[:2]}
    if len(candidates)==1:
        return next(iter(candidates))
    raise RuntimeError(f'因子1から職業を確定できません: {f}')


def norm_factor(v,required=False):
    s=str(v or '').strip()
    if required:
        return s
    if not s:
        return '対象外'
    return s


def source_value(src,master_field):
    v=str(src.get(FIELD_MAP[master_field],'')).strip()
    if master_field in FACTOR_MASTER:
        return norm_factor(v,required=(master_field=='因子1'))
    if master_field in NUMERIC_MASTER:
        if not v:
            raise RuntimeError(f'{src.get("名前","")}: {FIELD_MAP[master_field]} が空です')
        try:
            n=int(float(v))
        except Exception:
            raise RuntimeError(f'{src.get("名前","")}: {FIELD_MAP[master_field]} が数値ではありません: {v}')
        if n < 0:
            raise RuntimeError(f'{src.get("名前","")}: {FIELD_MAP[master_field]} が負数です: {v}')
        return str(n)
    return v


def new_master_row(headers,src,iid,job):
    r={h:'' for h in headers}
    r.update({
        'internal_id':iid,
        'external_id':'未確認','image_external_id':'未確認','image_file':'未確認','image_path':'未確認','image_url':'未確認',
        'ID方式':'独自ID','external_id状態':'元サイトID未確認',
        '英傑名':str(src['名前']).strip(),'職':'','職業':job,
        'ID対応状況':'英傑一覧.csvから新規追加','ID対応方法':'source-next/英傑一覧.csv','ID元英傑名':str(src['名前']).strip(),
        '追加更新':datetime.now(ZoneInfo('Asia/Tokyo')).strftime('%Y-%m-%d'),
        '技能':'','詳細':'','確認状態':'source-next/英傑一覧.csvで確認','主キー運用':'internal_id','external_id運用メモ':'未確認。internal_idで運用',
    })
    return r


def main():
    if not SOURCE.exists() or not MASTER.exists():
        raise RuntimeError('英傑一覧または英傑マスタがありません')
    src,src_headers=read_csv(SOURCE)
    master,master_headers=read_csv(MASTER)
    missing=[x for x in REQUIRED if x not in src_headers]
    if missing:
        raise RuntimeError('英傑一覧の必須列不足: '+', '.join(missing))
    if not master_headers:
        raise RuntimeError('英傑マスタのヘッダーがありません')
    applied=apply_overrides(src)

    input_rows=len(src)
    numbers=[]
    for r in src:
        n=str(r.get('番号','')).strip()
        if not n or not n.isdigit() or int(n)<=0:
            raise RuntimeError(f'英傑一覧の番号不正: {n}')
        numbers.append(n)
        if not str(r.get('名前','')).strip():
            raise RuntimeError(f'番号{n}: 名前が空です')
    if len(numbers)!=len(set(numbers)):
        raise RuntimeError('英傑一覧の番号重複を検出')

    # 一度削除確定した重複行が、後日の元一覧更新で復活しても再登録しない。
    # 番号だけで無条件スキップせず、登録済みの名前と一致する場合だけretiredとして扱う。
    if not ID_MAP.exists():
        raise RuntimeError('tools-next/hero_internal_id_map.json がありません')
    id_map=json.loads(ID_MAP.read_text(encoding='utf-8'))
    retired=id_map.get('retired_entries',{}) or {}
    retired_skipped=[]
    active_src=[]
    for r in src:
        n=str(r.get('番号','')).strip()
        if n not in retired:
            active_src.append(r)
            continue
        spec=retired[n] or {}
        expected_name=str(spec.get('last_name','')).strip()
        actual_name=str(r.get('名前','')).strip()
        if expected_name and actual_name!=expected_name:
            raise RuntimeError(f'削除済み番号{n}が別英傑として再利用されています。自動更新停止: {expected_name} -> {actual_name}')
        retired_skipped.append({
            '番号':int(n),'英傑名':actual_name,
            'replacement_internal_id':str(spec.get('replacement_internal_id','')).strip(),
            'reason':str(spec.get('reason','')).strip(),
        })
    src=active_src
    numbers=[str(r.get('番号','')).strip() for r in src]

    # 因子 typo をDB化する前に拒否。
    known_factors=set()
    for r in read_csv(INEN)[0]:
        for k in ('因子1','因子2','因子3'):
            v=str(r.get(k,'')).strip()
            if v: known_factors.add(v)
    job_lookup=load_job_lookup()

    entries=id_map.setdefault('entries',{})
    source_numbers=set(numbers)
    mapped_numbers=set(entries)
    removed=sorted(mapped_numbers-source_numbers,key=int)
    if removed:
        raise RuntimeError('既存英傑の削除を検出したため自動更新を停止: 番号 '+', '.join(removed[:20]))

    master_by_id={str(r.get('internal_id','')).strip():r for r in master}
    for item in retired_skipped:
        replacement=item.get('replacement_internal_id','')
        if replacement and replacement not in master_by_id:
            raise RuntimeError(f'削除済み番号{item["番号"]}の置換先internal_idが英傑マスタにありません: {replacement}')
    existing_ids=[]
    for iid in master_by_id:
        if iid.startswith('EIK_') and iid[4:].isdigit(): existing_ids.append(int(iid[4:]))
    next_id=max(existing_ids,default=0)+1

    new_infos=[]; changed_infos=[]; dirty_ids=[]
    src_by_number={str(r['番号']).strip():r for r in src}
    for num in sorted(numbers,key=int):
        s=src_by_number[num]
        name=str(s['名前']).strip()
        if num in entries:
            iid=str(entries[num].get('internal_id','')).strip()
            if iid not in master_by_id:
                raise RuntimeError(f'ID対応表のinternal_idが英傑マスタにありません: 番号{num} {iid}')
            last_name=str(entries[num].get('last_name','')).strip()
            if last_name and last_name!=name:
                raise RuntimeError(f'既存番号の英傑名変更を検出。誤対応防止のため停止: 番号{num} {last_name} -> {name}')
            row=master_by_id[iid]
        else:
            while f'EIK_{next_id:04d}' in master_by_id:
                next_id+=1
            if next_id>65535:
                raise RuntimeError('internal_idがcompact DBのuint16上限を超えます')
            iid=f'EIK_{next_id:04d}'; next_id+=1
            job=resolve_job(s.get('因子1(特化)'),job_lookup)
            row=new_master_row(master_headers,s,iid,job)
            master.append(row);master_by_id[iid]=row
            entries[num]={'internal_id':iid,'last_name':name}
            new_infos.append({'番号':int(num),'internal_id':iid,'英傑名':name})

        diffs=[]
        if str(row.get('英傑名','')).strip()!=name:
            diffs.append({'field':'英傑名','before':str(row.get('英傑名','')).strip(),'after':name});row['英傑名']=name
        for mf in FIELD_MAP:
            nv=source_value(s,mf);ov=str(row.get(mf,'')).strip()
            if ov!=nv:
                diffs.append({'field':mf,'before':ov,'after':nv});row[mf]=nv
        job=resolve_job(row.get('因子1'),job_lookup)
        if str(row.get('職業','')).strip()!=job:
            diffs.append({'field':'職業','before':str(row.get('職業','')).strip(),'after':job});row['職業']=job
        entries[num]['last_name']=name
        changed_factor_fields={d['field'] for d in diffs if d['field'] in {'因子1','因子2','因子3','因子4'}}
        is_new=any(x['internal_id']==iid for x in new_infos)
        for mf in ('因子1','因子2','因子3','因子4'):
            f=str(row.get(mf,'')).strip()
            if f and f not in {'対象外','-','ー','－'} and f not in known_factors:
                # 既存データに残る古い略称/既知表記は現状維持。新規行または今回変更された因子だけ厳格に検査。
                if is_new or mf in changed_factor_fields:
                    raise RuntimeError(f'{iid} {name}: 因子マスタに存在しない因子を検出: {mf}={f}')
        if diffs:
            dirty_ids.append(iid)
            if not any(x['internal_id']==iid for x in new_infos):
                changed_infos.append({'番号':int(num),'internal_id':iid,'英傑名':name,'diffs':diffs})

    # マッピング済みID以外のmaster行を勝手に残さない。sourceが唯一の英傑一覧。
    mapped_ids={str(v.get('internal_id','')).strip() for v in entries.values()}
    extra_master=sorted(set(master_by_id)-mapped_ids)
    if extra_master:
        raise RuntimeError('英傑一覧に対応しない英傑マスタ行を検出: '+', '.join(extra_master[:20]))

    # 正しい重複ルール: 4因子+11ステータス完全一致。名前は判定に使わない。
    seen={};dups=[]
    sig_fields=['因子1','因子2','因子3','因子4','生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
    for r in master:
        sig=tuple(str(r.get(k,'')).strip() for k in sig_fields)
        iid=str(r.get('internal_id','')).strip()
        if sig in seen:
            dups.append((seen[sig],iid))
        else:
            seen[sig]=iid
    if dups:
        raise RuntimeError('ステータス+因子完全一致の重複候補を検出。自動公開停止: '+' / '.join(f'{a}={b}' for a,b in dups[:20]))

    # UTF-8 + CSV quotingをcsv moduleで統一。
    with MASTER.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=master_headers,extrasaction='ignore',lineterminator='\n')
        w.writeheader();w.writerows(master)
    ID_MAP.write_text(json.dumps(id_map,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    report={
        'status':'PASS','source_rows_input':input_rows,'source_rows':len(src),'master_rows':len(master),
        'new_heroes':new_infos,'changed_existing':changed_infos,'removed_heroes':[],
        'retired_source_rows_skipped':retired_skipped,
        'dirty_internal_ids':sorted(set(dirty_ids),key=lambda x:int(x[4:])),
        'applied_overrides':applied,
        'id_map_entries':len(entries),
    }
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','new_heroes':new_infos,'changed_existing_count':len(changed_infos),'master_rows':len(master)},ensure_ascii=False))

if __name__=='__main__':
    try: main()
    except Exception as e:
        REPORT_DIR.mkdir(exist_ok=True)
        REPORT.write_text(json.dumps({'status':'FAIL','error':str(e)},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('ERROR:',e,file=sys.stderr);sys.exit(1)
