#!/usr/bin/env python3
from __future__ import annotations
import csv
import gzip
import html as htmlmod
import itertools
import json
import random
import re
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

from factor4_optimizer import minimal_factor4_mask
from formation_spec import LINES

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parent
HTML=ROOT/'jinpo.html'
FORMATION_JS=ROOT/'jinpo-formation-config.js'
ACTIVATION_JS=ROOT/'jinpo-activation-engine.js'
BOND_JS=ROOT/'jinpo-bond-list.js'
SAVE_JS=ROOT/'jinpo-internal-save.js'
MANIFEST=ROOT/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
WORKFLOW=REPO/'.github'/'workflows'/'jinpo-next.yml'
MOJIBAKE=('\ufffd','\u7e3a','\u7e67','\u8b41','\u00c3','\u00c2')


def fail(msg):
    print('FAIL:',msg,file=sys.stderr); raise SystemExit(1)

def read_text(path:Path):
    if not path.exists(): fail(f'必須ファイル不足: {path}')
    try: text=path.read_text(encoding='utf-8-sig')
    except Exception as e: fail(f'UTF-8不正: {path.name}: {e}')
    hits=[m for m in MOJIBAKE if m in text]
    if hits: fail(f'文字化け疑い: {path.name}: {hits}')
    return text

def csv_rows(path:Path):
    with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))

def validate_js_syntax():
    checked=0
    for path in sorted(ROOT.glob('jinpo*.js')):
        cp=subprocess.run(['node','--check',str(path)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if cp.returncode: fail(f'JS構文FAIL: {path.name}: {cp.stderr.strip()}')
        checked+=1
    text=read_text(HTML)
    scripts=re.findall(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>',text,flags=re.S|re.I)
    inline=0
    for attrs,body in scripts:
        if re.search(r'\bsrc\s*=',attrs,re.I) or not body.strip(): continue
        typem=re.search(r'\btype\s*=\s*["\']([^"\']+)',attrs,re.I)
        if typem and typem.group(1).lower() not in ('text/javascript','application/javascript','module'): continue
        with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:
            f.write(body); tmp=f.name
        cp=subprocess.run(['node','--check',tmp],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        Path(tmp).unlink(missing_ok=True)
        if cp.returncode: fail(f'jinpo.html inline script構文FAIL #{inline+1}: {cp.stderr.strip()}')
        inline+=1
    return checked,inline

def validate_html_integration():
    text=read_text(HTML)
    order=['jinpo-formation-config.js','jinpo-activation-engine.js','jinpo-internal-save.js','jinpo-fast-search.js','jinpo-bond-list.js']
    positions=[]
    for name in order:
        p=text.find(name)
        if p<0: fail(f'必須script読込なし: {name}')
        positions.append(p)
    if positions!=sorted(positions): fail('script読込順序不正')
    for id_ in ('formationSelect','formationView','dbFormationList','dbCountButtons','totalStatResult'):
        if f'id="{id_}"' not in text and f"id='{id_}'" not in text: fail(f'必須UI ID欠落: {id_}')
    return True

def hero_model():
    heroes={}
    for r in csv_rows(ROOT/'data'/'jinpo_eiketsu_master.csv'):
        iid=str(r.get('internal_id','')).strip()
        if iid.startswith('EIK_') and iid[4:].isdigit():
            heroes[int(iid[4:])]=tuple(str(r.get(k,'') or '').strip() for k in ('因子1','因子2','因子3','因子4'))
    bonds={}
    for r in csv_rows(ROOT/'data'/'jinpo_inen_master.csv'):
        bonds[int(r['No'])]=tuple(str(r.get(k,'') or '').strip() for k in ('因子1','因子2','因子3'))
    return heroes,bonds

def assignment_options(line,req,heroes):
    opts=set()
    for perm in itertools.permutations(range(3)):
        mask=0;ok=True
        for ri,hi in enumerate(perm):
            fs=heroes[line[hi]];factor=req[ri]
            if factor in fs[:3]: pass
            elif len(fs)>3 and fs[3]==factor: mask|=1<<hi
            else: ok=False;break
        if ok: opts.add(mask)
    return opts

def activated_bonds(placement,form,heroes,bonds):
    out=[]
    for bid,req in bonds.items():
        for ln in LINES[form]:
            line=tuple(placement[i] for i in ln)
            if assignment_options(line,req,heroes): out.append(bid);break
    return tuple(out)

def brute_factor4(placement,form,bids,heroes,bonds):
    states={0}
    for bid in bids:
        opts=set()
        for ln in LINES[form]:
            line=tuple(placement[i] for i in ln)
            for rel in assignment_options(line,bonds[bid],heroes):
                gm=0
                for i in range(3):
                    if rel&(1<<i): gm|=1<<ln[i]
                opts.add(gm)
        if not opts: raise RuntimeError('activated bond without assignment')
        states={a|b for a in states for b in opts}
    return min(states,key=lambda x:(x.bit_count(),x)) if states else 0

def validate_factor4_optimizer():
    """実際に生成された成立編成で、共通DPと独立brute forceを比較する。"""
    heroes,bonds=hero_model(); cache={}; checked=0
    m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    # 4陣形を横断。0件datasetは飛ばし、各datasetから最大40件を比較する。
    for mode,counts in m.get('datasets',{}).items():
        for count,forms in counts.items():
            for form,info in forms.items():
                if checked>=180: break
                path=ROOT/info['file']
                with gzip.open(path,'rb') as f:
                    head=f.read(16)
                    if len(head)!=16 or head[:4]!=b'JCF1': fail(f'文曲監査DBヘッダ不正: {info["file"]}')
                    rows=struct.unpack_from('<I',head,8)[0]
                    if not rows: continue
                    take=min(40,rows)
                    step=max(1,rows//take)
                    for i in range(rows):
                        rec=f.read(52)
                        if len(rec)!=52: fail(f'文曲監査DB長不正: {info["file"]}')
                        if i%step!=0: continue
                        p6=struct.unpack_from('<6H',rec,0)
                        bids=tuple(x for x in rec[12:21] if x)
                        if not bids: fail(f'成立DBなのに因縁0: {info["file"]} row={i}')
                        a=minimal_factor4_mask(p6,form,bids,LINES,heroes,bonds,cache)
                        b=brute_factor4(p6,form,bids,heroes,bonds)
                        if a!=b: fail(f'文曲全体最適化不一致: form={form} placement={p6} got={a} expected={b}')
                        if a.bit_count()!=rec[47]: fail(f'文曲人数DB不一致: form={form} placement={p6} stored={rec[47]} expected={a.bit_count()}')
                        checked+=1
                        if checked>=180 or (i//step)+1>=take: break
                if checked>=180: break
            if checked>=180: break
        if checked>=180: break
    if checked<100: fail(f'文曲最適化比較サンプル不足: {checked}')
    return checked

def validate_internal_save():
    read_text(SAVE_JS)
    node=r'''
const fs=require('fs'),vm=require('vm');
const store={};
const ctx={window:{},console,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},alert:()=>{}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),ctx);
const api=ctx.JinpoInternalSave||ctx.window.JinpoInternalSave;
if(!api) throw new Error('API missing');
const saved=api.saveFormation('audit',{1:{internal_id:'EIK_0001','英傑名':'A'}},'方円');
if(!saved||!saved.id) throw new Error('save failed');
const list=api.getSaved(); if(!Array.isArray(list)||list.length!==1||list[0].formationName!=='方円') throw new Error('getSaved failed');
api.deleteFormation(saved.id);
if(api.getSaved().length!==0) throw new Error('delete failed');
process.stdout.write('PASS');
'''
    cp=subprocess.run(['node','-e',node,str(SAVE_JS)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if cp.returncode or 'PASS' not in cp.stdout: fail('保存機能行動テストFAIL: '+cp.stderr.strip())

def validate_manifest():
    m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if set(m.get('datasets',{}))!={'normal','grade3'}: fail('検索DB mode不正')
    if set(m['datasets']['normal'])!={'7','8','9'}: fail('通常検索の因縁数構成不正')
    if set(m['datasets']['grade3'])!={'5','6','7','8','9'}: fail('等級3以下検索の因縁数構成不正')
    checked=0
    for mode,counts in m['datasets'].items():
        for count,forms in counts.items():
            if set(forms)!=set(LINES): fail(f'4陣形DB不足: {mode}/{count}')
            for form,info in forms.items():
                path=ROOT/info['file']
                if not path.exists(): fail(f'DB不足: {info["file"]}')
                if path.stat().st_size>25*1024*1024: fail(f'25MB超過: {info["file"]}')
                checked+=1
    return checked

def validate_workflow():
    if not WORKFLOW.exists(): fail('更新済みGitHub Actions workflowがありません')
    text=read_text(WORKFLOW)
    calls=re.findall(r'python\s+"陣法/tools-next/([^"]+)"',text)
    for name in calls:
        if not (ROOT/'tools-next'/name).exists(): fail(f'workflowが存在しないツールを参照: {name}')
    required=('audit_source_provenance.py','sync_eiketsu_master.py','audit_tairano_spec.py','build_jinpo_next.py','audit_compact_stats.py','audit_runtime_regressions.py','guard_publish_changes.py')
    for name in required:
        if name not in calls: fail(f'workflow監査工程不足: {name}')
    if 'data/jinpo_formation_spec.json' not in text: fail('workflow監視対象に陣形正本がありません')
    return len(calls)

def main():
    for path in (HTML,FORMATION_JS,ACTIVATION_JS,BOND_JS,SAVE_JS,ROOT/'tools-next'/'factor4_optimizer.py',ROOT/'tools-next'/'rebuild_all_compact.py'):
        read_text(path)
    js,inline=validate_js_syntax();validate_html_integration();f4=validate_factor4_optimizer();validate_internal_save();db=validate_manifest();wf=validate_workflow()
    print(json.dumps({'status':'PASS','js_files':js,'inline_scripts':inline,'factor4_random_cases':f4,'dataset_files':db,'workflow_python_steps':wf},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
