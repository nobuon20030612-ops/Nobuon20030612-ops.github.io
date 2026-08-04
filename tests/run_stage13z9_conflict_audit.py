#!/usr/bin/env python3
"""Stage13Z9 exact conflict audit for arukimiko v3.69.0.
This script is read-only. It never modifies the target ZIP.

Usage:
  python tests/run_stage13z8_conflict_audit.py --target-zip "C:\\path\\arukimiko_v3.69.0_一括上書き用.zip"
"""
from pathlib import Path
import argparse, zipfile, tempfile, hashlib, json, re, sys, os

EXPECTED = {
  "version":"3.69.0",
  "zip_sha256":"c2763b849e6ad7a58bb4f5755b2025b39b2a38e08a8e0a809db79f01192d4d67",
  "zip_size":7347653,
  "file_count":122,
  "root":"arukimiko/",
  "official_image_sha256":"821be60a03e77a46c28d77811e3edf1bfc663e92fbad80c4fd3d5bec7e8c4650",
}
CORE_NAMES = [
  "arukimiko-expression-runtime-stage13z6.css",
  "arukimiko-expression-runtime-stage13z6.js",
  "arukimiko-expression-adapter-stage13z6.js",
  "arukimiko-expression-adapter-stage13z8-candidate.js",
]
CHANGED_EXPECTED = [
  "bootstrap-v304.js","bootstrap.js","jinpo-bot-conversation.js","jinpo-bot-hero-knowledge.js",
  "jinpo-bot.js","loader.js","tools/test_bot_route_site_guide.js","tools/test_release_version_consistency.js",
  "tools/test_hero_same_name_natural_followups.js"
]
DOM_TOKENS = [
 "jinpoAiRoot","jinpoAiWindow","jinpoAiInput","jinpoAiSend","jinpoAiMessages","jinpoAiHeaderMinBtn",
 "jinpoAiWindowCharacter","jinpoAiWindowCharacterImg","jinpoAiMessageRow","jinpoAiBubble",
 "isBotHidden","isOpen","isMinimized","data-jinpo-ai-typing"
]
GLOBALS = ["JINPO_AI_TRANSPORT","ARUKIMIKO_LAZY","groupsForMessage","JINPO_AI_CHAT","ARUKIMIKO_SHARED"]
NAMESPACES = ["ARUKIMIKO_EXPRESSION_RUNTIME","ARUKIMIKO_EXPRESSION_ADAPTER","ARUKIMIKO_EXPRESSION_ADAPTER_CANDIDATE","__ARUKIMIKO_EXPRESSION_ADAPTER_STAGE13Z6__","__ARUKIMIKO_EXPRESSION_ADAPTER_STAGE13Z8_CANDIDATE__","arukimikoFx","arukimiko:adapter-log","arukimiko:expression-state"]
HISTORY_TOKENS = ["knownTermClarification","clarificationReason","pendingHero","history","restore","hydrate"]
RESULT_TOKENS = ["expressionState","resultState","uiState","needsClarification","actionExecuted","executed","mode","answer","data","ok"]


def sha256(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()

def read_texts(root):
    texts={}
    for p in root.rglob('*'):
        if p.is_file() and p.suffix.lower() in {'.js','.css','.html','.json','.txt'}:
            try: texts[str(p.relative_to(root)).replace('\\','/')]=p.read_text(encoding='utf-8',errors='ignore')
            except Exception: pass
    return texts

def token_locations(texts, token):
    return sorted([name for name,text in texts.items() if token in text])

def assignment_locations(texts, token):
    rx=re.compile(r'(?:window\\.)?'+re.escape(token)+r'\\s*=')
    return sorted([name for name,text in texts.items() if rx.search(text)])

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--target-zip',required=True)
    ap.add_argument('--output',default='stage13z9_exact_conflict_audit.json')
    args=ap.parse_args()
    zpath=Path(args.target_zip).resolve()
    report={'stage':'13Z9','target_zip':str(zpath),'expected':EXPECTED,'checks':{},'risks':[],'ready_for_adapter_port':False,'ready_to_merge':False,'public_publish':False}
    out=Path(args.output)
    if not zpath.is_file():
        report['fatal']='target ZIP not found'; out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps(report,ensure_ascii=False,indent=2)); return 2

    report['actual']={'sha256':sha256(zpath),'bytes':zpath.stat().st_size}
    report['checks']['zip_sha256']=report['actual']['sha256']==EXPECTED['zip_sha256']
    report['checks']['zip_size']=report['actual']['bytes']==EXPECTED['zip_size']
    try:
        with zipfile.ZipFile(zpath) as z:
            names=z.namelist()
            file_names=[n for n in names if not n.endswith('/')]
            report['actual']['entry_count']=len(names)
            report['actual']['file_count']=len(file_names)
            report['checks']['file_count']=len(file_names)==EXPECTED['file_count']
            report['checks']['root']=all(n.startswith(EXPECTED['root']) for n in file_names)
            report['checks']['crc']=z.testzip() is None
            report['checks']['duplicates']=len(names)==len(set(names))
            report['checks']['path_traversal']=not any(Path(n).is_absolute() or '..' in Path(n).parts for n in names)
            official=EXPECTED['root']+'assets/arukimiko-chat-top.png'
            report['checks']['official_image_present']=official in names
            report['checks']['official_image_sha256']=official in names and sha256_bytes(z.read(official))==EXPECTED['official_image_sha256']
            target_paths={n[len(EXPECTED['root']):] for n in file_names if n.startswith(EXPECTED['root'])}
            report['checks']['expected_changed_files_present']={p:(p in target_paths) for p in CHANGED_EXPECTED}
            report['checks']['core_name_collisions']={name:(name in target_paths) for name in CORE_NAMES}
            with tempfile.TemporaryDirectory(prefix='stage13z8_') as td:
                extract=Path(td)
                z.extractall(extract)
                bot=extract/'arukimiko'
                texts=read_texts(bot)
                report['contracts']={
                  'dom':{t:token_locations(texts,t) for t in DOM_TOKENS},
                  'globals':{t:token_locations(texts,t) for t in GLOBALS},
                  'global_assignments':{t:assignment_locations(texts,t) for t in GLOBALS},
                  'namespaces':{t:token_locations(texts,t) for t in NAMESPACES},
                  'history':{t:token_locations(texts,t) for t in HISTORY_TOKENS},
                  'result_shape_hints':{t:token_locations(texts,t) for t in RESULT_TOKENS},
                }
                report['checks']['dom_contract_complete']=all(report['contracts']['dom'][t] for t in DOM_TOKENS)
                report['checks']['required_globals_found']=all(report['contracts']['globals'][t] for t in GLOBALS)
                report['checks']['namespace_collision_free']=all(not report['contracts']['namespaces'][t] for t in NAMESPACES)
                transport_files=report['contracts']['globals']['JINPO_AI_TRANSPORT']
                report['analysis']={
                  'transport_reference_files':transport_files,
                  'transport_assignment_count':sum(len(v) for k,v in report['contracts']['global_assignments'].items() if k=='JINPO_AI_TRANSPORT'),
                  'history_related_files':sorted(set(sum(report['contracts']['history'].values(),[]))),
                  'result_related_files':sorted(set(sum(report['contracts']['result_shape_hints'].values(),[]))),
                }
    except zipfile.BadZipFile:
        report['fatal']='bad ZIP'; out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps(report,ensure_ascii=False,indent=2)); return 3

    exact=all(report['checks'].get(k) is True for k in ['zip_sha256','zip_size','file_count','root','crc','duplicates','path_traversal','official_image_present','official_image_sha256'])
    collisions=report['checks'].get('core_name_collisions',{})
    no_collisions=not any(collisions.values())
    dom=report['checks'].get('dom_contract_complete',False)
    globals_ok=report['checks'].get('required_globals_found',False)
    namespaces_ok=report['checks'].get('namespace_collision_free',False)
    report['ready_for_adapter_port']=bool(exact and no_collisions and dom and globals_ok and namespaces_ok)
    if not exact: report['risks'].append({'severity':'BLOCKER','id':'TARGET_IDENTITY','detail':'ZIP identity does not exactly match v3.69.0 handoff metadata.'})
    if not no_collisions: report['risks'].append({'severity':'BLOCKER','id':'DIRECT_PATH_COLLISION','detail':collisions})
    if not dom: report['risks'].append({'severity':'HIGH','id':'DOM_CONTRACT','detail':'One or more Stage13Z6 DOM tokens are absent.'})
    if not globals_ok: report['risks'].append({'severity':'HIGH','id':'GLOBAL_CONTRACT','detail':'One or more required globals are absent.'})
    if not namespaces_ok: report['risks'].append({'severity':'HIGH','id':'NAMESPACE_COLLISION','detail':'Expression namespace already exists in target.'})
    report['risks'].append({'severity':'HIGH','id':'TRANSPORT_SEMANTICS','detail':'Function signature, reassignment order and result object must still be browser-tested before merge.'})
    report['risks'].append({'severity':'HIGH','id':'HISTORY_HYDRATION','detail':'v3.69.0 conversation/history behavior requires live hydration regression.'})
    report['risks'].append({'severity':'HIGH','id':'RESULT_CLASSIFICATION','detail':'Same-name group/search/clarification answers must remain normal or cannot states; search mode alone must never become success.'})
    report['decision']='READY_FOR_ADAPTER_PORT_ONLY' if report['ready_for_adapter_port'] else 'BLOCKED'
    report['ready_to_merge']=False
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 0 if report['ready_for_adapter_port'] else 4

if __name__=='__main__':
    sys.exit(main())
