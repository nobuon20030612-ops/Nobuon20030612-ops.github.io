#!/usr/bin/env python3
from __future__ import annotations
import ast
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parent
SPEC=ROOT/'data'/'jinpo_formation_spec.json'
FORMATION_JS=ROOT/'jinpo-formation-config.js'
HTML=ROOT/'jinpo.html'
MANIFEST=ROOT/'data'/'compact_search_v2'/'jinpo_unified_search_manifest.json'
REPORT_DIR=ROOT/'_jinpo-next-report'
REPORT=REPORT_DIR/'tairano_spec_report.json'

# Independent user-confirmed oracle. Do not import this from formation_spec.py or JSON.
# The audit must be able to fail even when the generator and shared spec agree on the same wrong value.
INDEPENDENT_CANONICAL_ACTIVE_LINES={
 '衡軛': [[1,2,3],[4,5,6]],
 '鶴翼': [[1,2,3],[4,5,6]],
 '魚鱗': [[1,2,3],[3,4,5],[5,6,1]],
 '方円': [[1,2,3],[3,4,5],[5,6,1]],
}

EXPECTED_TOOL_FILES={
 'audit_compact_stats.py','audit_fullmax_search.py','audit_runtime_regressions.py',
 'audit_search_integrity.py','audit_source_provenance.py','audit_tairano_spec.py','build_jinpo_next.py',
 'factor4_optimizer.py','formation_spec.py','fullmax_model.py','guard_publish_changes.py','hero_internal_id_map.json',
 'rebuild_all_compact.py','rebuild_fullmax_search.py','rebuild_recommend_sum_top.py','rebuild_top500.py','sync_eiketsu_master.py',
 'build_bond56_index.py','bond56_index_builder.cpp',
 'audit_bond56_index_independent.py','audit_combination_completeness_independent.py',
}

def fail(msg):
    REPORT_DIR.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps({'status':'FAIL','error':msg},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('ERROR:',msg,file=sys.stderr); raise SystemExit(1)

def main():
    spec=json.loads(SPEC.read_text(encoding='utf-8'))
    forms=spec.get('formations') or {}
    if tuple(forms)!=('衡軛','鶴翼','魚鱗','方円'): fail('陣形正本は4種類固定です')
    for name,expected in INDEPENDENT_CANONICAL_ACTIVE_LINES.items():
        if (forms.get(name) or {}).get('activeLines') != expected:
            fail(f'ユーザー確定の絶対正本ライン不一致: {name} got={(forms.get(name) or {}).get("activeLines")} expected={expected}')
    for name,cfg in forms.items():
        lines=cfg.get('activeLines') or []
        if not lines or any(len(x)!=3 or len(set(x))!=3 or any(not 1<=int(s)<=6 for s in x) for x in lines):
            fail(f'成立ライン不正: {name}')
        slots=cfg.get('slots') or {}
        if set(slots)!=set(str(i) for i in range(1,7)): fail(f'配置番号不正: {name}')

    # Runtime config must match the JSON source of truth exactly for slots/activeLines.
    node=r'''
const fs=require('fs'),vm=require('vm');
let src=fs.readFileSync(process.argv[1],'utf8');
src=src.split('/* jinpo-update-info-from-summary-')[0];
const ctx={window:{},console};vm.createContext(ctx);vm.runInContext(src,ctx);
process.stdout.write(JSON.stringify(ctx.window.JINPO_FORMATION_CONFIG));
'''
    cp=subprocess.run(['node','-e',node,str(FORMATION_JS)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if cp.returncode: fail('陣形設定JS評価FAIL: '+cp.stderr.strip())
    runtime=json.loads(cp.stdout)
    if set(runtime)!=set(forms): fail('陣形設定JSの4陣形が正本と不一致')
    for name,cfg in forms.items():
        if runtime[name].get('activeLines')!=cfg['activeLines']: fail(f'成立ライン正本不一致: {name}')
        got_slots={str(k):[v.get('x'),v.get('y')] for k,v in runtime[name].get('slots',{}).items()}
        if got_slots!=cfg['slots']: fail(f'配置番号正本不一致: {name}')

    # No runtime file may carry another activeLines object literal.
    for path in list(ROOT.glob('*.js'))+[HTML]:
        if path==FORMATION_JS: continue
        txt=path.read_text(encoding='utf-8')
        if re.search(r'(?<![.\w])activeLines\s*:',txt): fail(f'陣形成立ラインの重複定義: {path.name}')
    html=HTML.read_text(encoding='utf-8')
    if 'JINPO_BUILTIN_FORMATION_CONFIG' in html: fail('HTML内に陣形予備定義があります')

    # Python generators/audits must import the shared formation spec instead of defining LINES locally.
    for name in ('rebuild_all_compact.py','rebuild_fullmax_search.py','audit_search_integrity.py'):
        txt=(ROOT/'tools-next'/name).read_text(encoding='utf-8')
        tree=ast.parse(txt)
        local_lines=False
        imports_shared=False
        for node0 in ast.walk(tree):
            if isinstance(node0,(ast.Assign,ast.AnnAssign)):
                targets=node0.targets if isinstance(node0,ast.Assign) else [node0.target]
                if any(isinstance(t,ast.Name) and t.id=='LINES' for t in targets): local_lines=True
            if isinstance(node0,ast.ImportFrom) and node0.module=='formation_spec' and any(a.name=='LINES' for a in node0.names): imports_shared=True
        if local_lines or not imports_shared: fail(f'Python陣形正本参照不正: {name}')

    actual_tools={p.name for p in (ROOT/'tools-next').iterdir() if p.is_file() and p.name!='__pycache__'}
    if actual_tools!=EXPECTED_TOOL_FILES:
        fail('tools-nextの現行構成が正本allowlistと不一致: '+', '.join(sorted(actual_tools^EXPECTED_TOOL_FILES)))
    data_dirs={p.name for p in (ROOT/'data').iterdir() if p.is_dir()}
    if data_dirs!={'compact_search_v2','bond56_index'}: fail('data配下の現行検索DB構成が正本と不一致です')
    b56=ROOT/'data'/'bond56_index'/'bond56_manifest.json'
    if not b56.exists(): fail('全等級5・6因縁manifestがありません')
    bm=json.loads(b56.read_text(encoding='utf-8'))
    if bm.get('schema')!='tairano-bond56-index/v1': fail('全等級5・6因縁manifest schema不正')
    for info in (bm.get('files') or {}).values():
        fp=ROOT/str(info.get('file') or '')
        if not fp.exists(): fail('全等級5・6因縁索引ファイル欠落: '+str(fp))
        if fp.stat().st_size>=25*1024*1024: fail('全等級5・6因縁索引25MiB超過: '+str(fp))

    # After generation, manifest itself must prove source-only full regeneration.
    if MANIFEST.exists():
        m=json.loads(MANIFEST.read_text(encoding='utf-8'))
        gen=m.get('generator') or {}
        if gen.get('name')!='tools-next/rebuild_all_compact.py' or gen.get('full_regeneration') is not True or gen.get('source_of_truth_only') is not True:
            fail('manifestの生成方針が現行完全再生成ではありません')
        if 'data/jinpo_formation_spec.json' not in (gen.get('source_of_truth') or []): fail('manifestに陣形正本が登録されていません')

    report={'status':'PASS','formations':4,'single_runtime_formation_definition':True,'independent_canonical_line_oracle':True,'canonical_active_lines':INDEPENDENT_CANONICAL_ACTIVE_LINES,'tool_files':len(actual_tools),'data_directories':sorted(data_dirs)}
    REPORT_DIR.mkdir(exist_ok=True);REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
