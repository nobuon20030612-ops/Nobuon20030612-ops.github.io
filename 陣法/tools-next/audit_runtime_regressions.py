#!/usr/bin/env python3
from __future__ import annotations

import csv
import gzip
import itertools
import json
import math
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SOURCE = ROOT / "source-next" / "英傑一覧.csv"
MASTER = ROOT / "data" / "jinpo_eiketsu_master.csv"
INEN = ROOT / "data" / "jinpo_inen_master.csv"
BOND_JS = ROOT / "jinpo-bond-list.js"
INTERNAL_SAVE_JS = ROOT / "jinpo-internal-save.js"
FORMATION_JS = ROOT / "jinpo-formation-config.js"
HTML = ROOT / "jinpo.html"
WORKFLOW = REPO / ".github" / "workflows" / "jinpo-next.yml"
MANIFEST = ROOT / "data" / "compact_search_v2" / "jinpo_unified_search_manifest.json"
OVERRIDES = ROOT / "tools-next" / "approved_overrides.json"
FRESHNESS_GUARD = ROOT / "tools-next" / "ensure_compact_record_freshness.py"
COMPACT_STATS_AUDIT = ROOT / "tools-next" / "audit_compact_stats.py"
FACTOR4_OPTIMIZER = ROOT / "tools-next" / "factor4_optimizer.py"
FULLMAX_MODEL = ROOT / "tools-next" / "fullmax_model.py"
FULLMAX_BUILDER = ROOT / "tools-next" / "rebuild_fullmax_search.py"
FULLMAX_AUDIT = ROOT / "tools-next" / "audit_fullmax_search.py"
INCREMENTAL_BUILDER = ROOT / "tools-next" / "rebuild_incremental_additions.py"
INCREMENTAL_AUDIT = ROOT / "tools-next" / "audit_incremental_equivalence.py"
PUBLISH_GUARD = ROOT / "tools-next" / "guard_publish_changes.py"
PROVENANCE_AUDIT = ROOT / "tools-next" / "audit_source_provenance.py"
FAST_SEARCH_JS = ROOT / "jinpo-fast-search.js"
FAST_SEARCH_WORKER = ROOT / "jinpo-fast-search-worker.js"

MOJIBAKE_MARKERS = tuple(chr(x) for x in (0xFFFD, 0x7E3A, 0x7E67, 0x8B41, 0x00C3, 0x00C2))
SOURCE_FACTOR_MAP = {
    "因子1(特化)": "因子1",
    "因子2(2凸)": "因子2",
    "因子3(LV20)": "因子3",
    "因子4(文曲)": "因子4",
}
SOURCE_MASTER_FIELD_MAP = {
    "コスト": "コスト",
    "生命": "生命",
    "気合": "気合",
    "腕力": "腕力",
    "耐久": "耐久力",
    "器用": "器用さ",
    "知力": "知力",
    "魅力": "魅力",
    "土": "土属性",
    "水": "水属性",
    "火": "火属性",
    "風": "風属性",
    "育成技能1:(0凸)": "育成技能1",
    "育成技能2:(0凸)": "育成技能2",
    "育成技能3:(0凸)": "育成技能3",
}
ALLOWED_EMPTY_FACTORS = {"", "?", "対象外", "未確認", "ー"}
EXPECTED_LINES = {
    "衡軛": [[1,2,3],[4,5,6]],
    "鶴翼": [[1,2,3],[4,5,6]],
    "魚鱗": [[1,2,3],[3,4,5],[5,6,1]],
    "方円": [[2,3,4],[4,5,6],[2,1,6]],
}
FACTOR1_JOB = {
    "武士道":"侍", "軍学":"侍", "武芸":"侍",
    "暗殺術":"忍者", "忍術":"忍者", "忍法":"忍者",
    "仏門":"僧", "密教":"僧", "僧兵":"僧",
    "修験道":"薬師", "医学":"薬師", "神通力":"薬師",
    "陰陽道":"陰陽師", "仙道":"陰陽師", "召喚術":"陰陽師",
    "雅楽":"神主/巫女", "古神道":"神主/巫女", "神道":"神主/巫女",
    "鉄砲鍛冶":"鍛冶屋", "鎧鍛冶":"鍛冶屋", "刀鍛冶":"鍛冶屋",
    "四象":"傾奇者", "地勢":"傾奇者", "殺陣":"傾奇者",
}


def fail(message: str) -> None:
    print("FAIL:", message, file=sys.stderr)
    raise SystemExit(1)


def read_text(path: Path) -> str:
    if not path.exists():
        fail(f"必須ファイル不足: {path.relative_to(REPO)}")
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        fail(f"UTF-8不正: {path.relative_to(REPO)}: {e}")
    hits = [m for m in MOJIBAKE_MARKERS if m in text]
    if hits:
        fail(f"文字化け疑い: {path.relative_to(REPO)}: {' / '.join(hits)}")
    return text


def read_csv_strict(path: Path) -> tuple[list[dict], list[str]]:
    text = read_text(path)
    rows_raw = list(csv.reader(text.splitlines()))
    if not rows_raw:
        fail(f"CSV空: {path.relative_to(REPO)}")
    width = len(rows_raw[0])
    for idx, row in enumerate(rows_raw[1:], 2):
        if len(row) != width:
            fail(f"CSV列数不一致: {path.relative_to(REPO)} {idx}行 {len(row)} != {width}")
    return list(csv.DictReader(text.splitlines())), rows_raw[0]


def occurrence_map(rows: list[dict], name_col: str) -> dict[tuple[str,int], dict]:
    out: dict[tuple[str,int], dict] = {}
    counts = defaultdict(int)
    for row in rows:
        name = str(row.get(name_col, "")).strip()
        counts[name] += 1
        key = (name, counts[name])
        if key in out:
            fail(f"occurrence key重複: {name}#{counts[name]}")
        out[key] = row
    return out


def load_override_lookup() -> dict[tuple[str,int,str], tuple[str,str]]:
    if not OVERRIDES.exists():
        return {}
    try:
        obj = json.loads(read_text(OVERRIDES))
    except Exception as e:
        fail(f"approved_overrides.json不正: {e}")
    out = {}
    for item in obj.get("rows", []):
        key = (
            str(item.get("name","")).strip(),
            int(item.get("occurrence",1)),
            str(item.get("source_field","")).strip(),
        )
        if key in out:
            fail(f"approved_overrides key重複: {key}")
        out[key] = (
            str(item.get("source_value","")).strip(),
            str(item.get("canonical_value","")).strip(),
        )
    return out


def canonical_source_value(name: str, occurrence: int, field: str, value: str, overrides) -> str:
    value = str(value or "").strip()
    ov = overrides.get((name, occurrence, field))
    if not ov:
        return value
    before, after = ov
    if value == before or value == after:
        return after
    fail(f"承認済み補正の前提値不一致: {name}#{occurrence} {field}={value!r}")
    return value


def validate_source_master() -> dict:
    source, sheaders = read_csv_strict(SOURCE)
    master, mheaders = read_csv_strict(MASTER)
    inen, _ = read_csv_strict(INEN)
    provenance_fields = {
        "因子確認状態","因子確認日","因子1出典","因子2出典","因子3出典","因子4出典",
        "能力値確認状態","能力値確認日","能力値出典","確認メモ",
    }
    required_source = {"番号","名前",*SOURCE_FACTOR_MAP.keys(),*SOURCE_MASTER_FIELD_MAP.keys(),*provenance_fields}
    required_master = {"internal_id","英傑名","職業","因子1","因子2","因子3","因子4",*SOURCE_MASTER_FIELD_MAP.values()}
    miss = required_source - set(sheaders)
    if miss: fail("英傑一覧の必須列不足: " + ", ".join(sorted(miss)))
    miss = required_master - set(mheaders)
    if miss: fail("英傑マスタの必須列不足: " + ", ".join(sorted(miss)))

    for idx, row in enumerate(source, 2):
        raw = str(row.get("名前",""))
        if raw != raw.strip():
            fail(f"英傑一覧 名前の前後空白: {idx}行 {raw!r}")
        if not raw:
            fail(f"英傑一覧 名前空: {idx}行")
        for field, value in row.items():
            value = str(value or "")
            if value != value.strip():
                fail(f"英傑一覧 前後空白: {idx}行 {field}={value!r}")

    inen_names = set()
    for idx, row in enumerate(inen, 2):
        name_raw = str(row.get("因縁名", ""))
        name = name_raw.strip()
        if not name or name_raw != name:
            fail(f"因縁マスタ 因縁名不正: {idx}行 {name_raw!r}")
        key = re.sub(r"[\s　]+", "", name).lower()
        if key in inen_names:
            fail(f"因縁マスタ 因縁名重複: {idx}行 {name}")
        inen_names.add(key)
        for field in ("因子1","因子2","因子3"):
            raw_factor = str(row.get(field, ""))
            if not raw_factor.strip() or raw_factor != raw_factor.strip():
                fail(f"因縁マスタ 因子不正: {idx}行 {field}={raw_factor!r}")

    for idx, row in enumerate(master, 2):
        for field in ("internal_id","英傑名","職業","因子1","因子2","因子3","因子4"):
            raw_value = str(row.get(field, ""))
            if raw_value != raw_value.strip():
                fail(f"英傑マスタ 前後空白: {idx}行 {field}={raw_value!r}")

    nums = [str(r.get("番号","")).strip() for r in source]
    if any(not x for x in nums): fail("英傑一覧 番号空")
    if len(nums) != len(set(nums)): fail("英傑一覧 番号重複")

    ids = [str(r.get("internal_id","")).strip() for r in master]
    if any(not x for x in ids): fail("英傑マスタ internal_id空")
    if len(ids) != len(set(ids)): fail("英傑マスタ internal_id重複")

    canonical_factors = {
        str(r.get(c,"")).strip()
        for r in inen for c in ("因子1","因子2","因子3")
        if str(r.get(c,"")).strip()
    }
    overrides = load_override_lookup()

    scounts = defaultdict(int)
    for idx, row in enumerate(source, 2):
        name = str(row["名前"]).strip()
        scounts[name] += 1
        occ = scounts[name]
        for field in SOURCE_FACTOR_MAP:
            v = canonical_source_value(name, occ, field, row.get(field,""), overrides)
            if v not in ALLOWED_EMPTY_FACTORS and v not in canonical_factors:
                fail(f"英傑一覧 非標準因子: {name}#{occ} {field}={v}")

    for idx, row in enumerate(master, 2):
        f1 = str(row.get("因子1","")).strip()
        job = str(row.get("職業","")).strip()
        expected_job = FACTOR1_JOB.get(f1)
        if not expected_job:
            fail(f"因子1→職業ルール未定義: {idx}行 {row.get('英傑名')} 因子1={f1!r}")
        if job != expected_job:
            fail(f"英傑マスタ 職業不一致: {idx}行 {row.get('英傑名')} {job!r}!={expected_job!r}")
        for field in ("因子1","因子2","因子3","因子4"):
            v = str(row.get(field,"")).strip()
            if v not in ALLOWED_EMPTY_FACTORS and v not in canonical_factors:
                fail(f"英傑マスタ 非標準因子: {row.get('internal_id')} {field}={v}")

    smap = occurrence_map(source, "名前")
    mmap = occurrence_map(master, "英傑名")
    if set(smap) != set(mmap):
        only_s = sorted(set(smap)-set(mmap))[:10]
        only_m = sorted(set(mmap)-set(smap))[:10]
        fail(f"英傑一覧/マスタ名前対応不一致 source_only={only_s} master_only={only_m}")

    for (name, occ), srow in smap.items():
        mrow = mmap[(name, occ)]
        for sf, mf in SOURCE_FACTOR_MAP.items():
            sv = canonical_source_value(name, occ, sf, srow.get(sf,""), overrides)
            mv = str(mrow.get(mf,"")).strip()
            if sf != "因子1(特化)" and sv == "" and mv == "対象外":
                continue
            if sv != mv:
                fail(f"英傑一覧/マスタ因子不一致: {name}#{occ} {sf}->{mf}: {sv!r}!={mv!r}")
        for sf, mf in SOURCE_MASTER_FIELD_MAP.items():
            sv = str(srow.get(sf,"")).strip()
            mv = str(mrow.get(mf,"")).strip()
            if sv != mv:
                fail(f"英傑一覧/マスタ値不一致: {name}#{occ} {sf}->{mf}: {sv!r}!={mv!r}")

    return {
        "source_rows": len(source),
        "master_rows": len(master),
        "inen_rows": len(inen),
        "canonical_factor_count": len(canonical_factors),
        "source_master_all_mapped_fields": "PASS",
        "factor1_job_mapping": "PASS",
    }


def validate_formation_config() -> None:
    read_text(FORMATION_JS)
    node = r"""
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(process.argv[1],'utf8').split('/* jinpo-update-info-from-summary-')[0];
const ctx={window:{},console}; vm.createContext(ctx); vm.runInContext(src,ctx);
process.stdout.write(JSON.stringify(ctx.window.JINPO_FORMATION_CONFIG));
"""
    cp = subprocess.run(["node","-e",node,str(FORMATION_JS)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail("陣形設定JS評価FAIL: " + cp.stderr.strip())
    try:
        cfg = json.loads(cp.stdout)
    except Exception as e:
        fail(f"陣形設定JSON化FAIL: {e}")
    for form, lines in EXPECTED_LINES.items():
        got = cfg.get(form,{}).get("activeLines")
        if got != lines:
            fail(f"因縁判定ライン不一致: {form}: {got} != {lines}")
        if any(len(x) != 3 or len(set(x)) != 3 for x in got):
            fail(f"因縁判定ラインは3人固定です: {form}: {got}")


def validate_bond_js() -> None:
    text = read_text(BOND_JS)
    cp = subprocess.run(["node","--check",str(BOND_JS)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail("jinpo-bond-list.js 構文FAIL: " + cp.stderr.strip())
    required = [
        "var modalOpenToken = 0;",
        "var bondMasterLoadingPromise = null;",
        "var master = await loadBondMaster();",
        "activeCalculatedResult = currentCalculatedResult(master);",
        "if(requestToken !== modalOpenToken",
        "sanitizedUniquePlacement(placement)",
        "calculationFormationConfig(formation)",
        "現在発動中の因縁はありません。",
        "function correctOwnedHeroJobMeta()",
        "hero['職業']",
        "jinpoBondActiveCardNo",
        "jinpoBondCloseText",
        "SAFE_ACTIVE_FORMATION_V1",
        "function installFormationRenderGuard()",
        "restoreCanonicalCalculationLines();",
        "args[3] = calculationFormationConfig(canonical, args[3]);",
        "function safeCurrentFormationState()",
        "function safeApplyShareState(state)",
        "window.currentFormationState = safeCurrentFormationState;",
        "window.applyShareState = safeApplyShareState;",
        "function recoverShareUrlAfterInit()",
        "function cancelPendingShareUrlRecovery()",
        "window.__jinpoShareUrlRecoveryCancelled",
        "function syncFormationUiState()",
        "function clearTransientAppliedDbState()",
        "window.__currentAppliedDbRow = null;",
        "window.__lastReachAppliedDbRow = null;",
        "window.__jinpoExactAppliedDbRow = null;",
        "window.__jinpoBonusBaseDbRow = null;",
        "window.currentAppliedDbRow = null;",
        "window.__jinpoReachExactLookupSeq = Number(window.__jinpoReachExactLookupSeq || 0) + 1;",
        "function installReachSwapAppliedStateGuard()",
        "function clearStaleAppliedRefsAfterReachSwap()",
        "function installDbRowRenderStateGuard()",
        "function dbRowMatchesCurrentRuntimeState(row)",
        "__jinpoCurrentStateGuardWrapped",
        "if(btn) clearTransientAppliedDbState();",
        "function invalidateReachCandidateCacheAfterMasterChange()",
        "__JINPO_MASTER_CACHE_REV_",
        "#dbFormationList tr.jinpoCurrentAppliedMainRow",
        "#dbFormationList tr.jinpoCurrentAppliedStatRow",
        "function installDirectStateResetGuards()",
        "function refreshFormationDependentSearchUi()",
        "function validateInenOverrideStrict(rows)",
        "function installRuntimeMasterOverrideGuards()",
        "['No','因縁名','因子1','因子2','因子3','特大','大','中','小']",
        "function installPrecomputedSearchOverrideGuard()",
        "function observePrecomputedSearchOverrideTargets()",
        "observer.observe(target,{childList:true,subtree:true});",
        "jinpo-runtime-master-override",
        "data-jinpo-master-override-disabled",
        "window.addEventListener('click'",
        "MutationObserver",
        "マスター差替え中は事前生成検索DBと条件が一致しないため",
        "Date.now() - startedAt < 120000",
        "window.__jinpoShareUrlRecoveryScheduled = false;",
        "共有編成に同一英傑が重複しています",
        "共有編成の英傑が現在のマスタに存在しません",
        "共有編成生成時に同一英傑の重複配置を検出したため、重複枠を空欄化しました",
        "共有編成の枠データが不正です",
        "Object.prototype.hasOwnProperty.call(state,'slots')",
    ]
    for frag in required:
        if frag not in text:
            fail(f"jinpo-bond-list.js 回帰ガード欠落: {frag}")
    for frag in ["現在適用中の組み合わせはありません。"]:
        if frag in text:
            fail(f"旧表示文言が復活: {frag}")
    # 発動中因縁はホバー中だけライン発光。クリック固定や右下の固定案内は再導入しない。
    for frag in ["lockedActiveCard", ".is-locked", "jinpoBondActiveCardHelp", "固定表示できます", "tabindex=\"0\" data-line-ids"]:
        if frag in text:
            fail(f"発動中因縁のクリック固定が復活: {frag}")
    for frag in ["card.addEventListener('mouseenter'", "card.addEventListener('mouseleave'", "カーソルを合わせている間、対応ラインが光ります"]:
        if frag not in text:
            fail(f"発動中因縁のホバー専用動作が欠落: {frag}")
    # 本番jinpo.htmlはbody/html/document全体への広域MutationObserverを抑止する。
    # ここへ回帰するとfast-searchが再生成した検索ボタンの再無効化が動かなくなるため禁止する。
    forbidden_observer_targets = [
        "observer.observe(document.documentElement",
        "observer.observe(document.body",
        "observer.observe(document,",
        "__jinpoPrecomputedSearchOverrideObserver.observe(document.documentElement",
        "__jinpoPrecomputedSearchOverrideObserver.observe(document.body",
        "__jinpoPrecomputedSearchOverrideObserver.observe(document,",
    ]
    for frag in forbidden_observer_targets:
        if frag in text:
            fail(f"検索無効化監視が本番で抑止される広域MutationObserverへ回帰: {frag}")


def validate_bond_behavior() -> None:
    node = r"""
const fs=require('fs'),vm=require('vm');
let src=fs.readFileSync(process.argv[1],'utf8');
const end='\n})();';
const i=src.lastIndexOf(end);
if(i<0) throw new Error('outer IIFE end not found');
const expose=`\nwindow.__BOND_TEST__={canonicalFormation,calculationFormationConfig,sanitizedUniquePlacement,installActivationDuplicateGuard,installFormationRenderGuard,safeApplyShareState,safeCurrentFormationState,restoreCanonicalCalculationLines,recoverShareUrlAfterInit,cancelPendingShareUrlRecovery,sharePrerequisitesReady,loadBondMaster,currentCalculatedResult,validateInenOverrideStrict,syncFormationUiState,clearTransientAppliedDbState,refreshFormationDependentSearchUi,installReachSwapAppliedStateGuard,installDbRowRenderStateGuard,dbRowMatchesCurrentRuntimeState,invalidateReachCandidateCacheAfterMasterChange,placementIdentitySignature,currentRuntimeOverrideActive};`;
src=src.slice(0,i)+expose+src.slice(i);
const select={_value:'',options:[{value:''},{value:'衡軛'},{value:'鶴翼'},{value:'魚鱗'},{value:'方円'}]};
Object.defineProperty(select,'value',{get(){return this._value},set(v){this._value=String(v)}});
Object.defineProperty(select,'selectedOptions',{get(){return this.options.filter(o=>o.value===this._value).map(o=>({textContent:o.value,value:o.value}))}});
const document={readyState:'loading',addEventListener(){},getElementById(id){return id==='formationSelect'?select:null;},querySelector(){return null;},querySelectorAll(){return []}};
const window={JINPO_FORMATION_CONFIG:{
 '衡軛':{activeLines:[[1,2,3],[4,5,6],[1,4],[2,5],[3,6]]},
 '鶴翼':{activeLines:[[1,2,3],[4,5,6],[1,4],[2,5],[3,6]]},
 '魚鱗':{activeLines:[[1,2,3],[3,4,5],[5,6,1]]},
 '方円':{activeLines:[[2,3,4],[4,5,6],[2,1,6]]}
}};
const console={log(){},warn(){},error(){}};
let eiketsuMaster=[
 {internal_id:'EIK_A','英傑名':'A'},{internal_id:'EIK_B','英傑名':'B'},
 {internal_id:'EIK_C','英傑名':'C'},{internal_id:'EIK_0246','英傑名':'竹中半兵衛(知将)'}
];
let inenMaster=[{'因縁名':'x','因子1':'a','因子2':'b','因子3':'c'}];
let placement={1:eiketsuMaster[0],2:eiketsuMaster[1]};
let selectedDbResultId='OLD';
let calcCalls=0;
function clearAppliedDbRowDisplay(){}
function renderSlots(){}
function renderFormation(){}
function calculate(){calcCalls++}
const timers=[];
const ctx={window,document,console,eiketsuMaster,inenMaster,standardEiketsuMaster:eiketsuMaster.slice(),standardInenMaster:inenMaster.map(x=>({...x})),placement,selectedDbResultId,clearAppliedDbRowDisplay,renderSlots,renderFormation,calculate,
 setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){},location:{search:''},URLSearchParams,Map,Set,JSON,Array,Object,String,Number,RegExp,Error,Promise};
vm.createContext(ctx);
const pre=`let eiketsuMaster=globalThis.eiketsuMaster; let inenMaster=globalThis.inenMaster; let standardEiketsuMaster=globalThis.standardEiketsuMaster; let standardInenMaster=globalThis.standardInenMaster; let placement=globalThis.placement; let selectedDbResultId=globalThis.selectedDbResultId; function clearAppliedDbRowDisplay(){return globalThis.clearAppliedDbRowDisplay()} function renderSlots(){return globalThis.renderSlots()} function renderFormation(){return globalThis.renderFormation()} function calculate(){globalThis.calcCalls=(globalThis.calcCalls||0)+1} `;
vm.runInContext(pre+src+`\nglobalThis.__getPlacement=()=>placement; globalThis.__setPlacement=(v)=>{placement=v}; globalThis.__getSelected=()=>selectedDbResultId; globalThis.__setSelected=(v)=>{selectedDbResultId=v};`,ctx);
/* source末尾のbootタイマーは単体行動テストでは不要。 */
timers.length=0;
const t=window.__BOND_TEST__;
function eq(a,b,msg){if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(msg+': '+JSON.stringify(a)+' != '+JSON.stringify(b))}
if(t.canonicalFormation('衝軛')!=='衡軛') throw new Error('alias failed');
if(t.validateInenOverrideStrict([{'因縁名':'重複','因子1':'a','因子2':'b','因子3':'c'},{'因縁名':'重複','因子1':'x','因子2':'y','因子3':'z'}]).length===0) throw new Error('duplicate bond name accepted');
if(t.validateInenOverrideStrict([{'因縁名':'空因子','因子1':'a','因子2':'','因子3':'c'}]).length===0) throw new Error('blank factor accepted');
if(t.currentRuntimeOverrideActive()) throw new Error('standard masters falsely detected as override');
const oldInen=inenMaster[0]; inenMaster[0]={...oldInen,'特大':'生命力'};
if(!t.currentRuntimeOverrideActive()) throw new Error('effect-only inen override did not disable precomputed DB');
inenMaster[0]=oldInen;
if(t.currentRuntimeOverrideActive()) throw new Error('effect-only inen override did not restore standard state');
const safe=t.calculationFormationConfig('鶴翼',window.JINPO_FORMATION_CONFIG);
eq(safe['鶴翼'].activeLines,[[1,2,3],[4,5,6]],'safe lines');
const dup=t.sanitizedUniquePlacement({1:{internal_id:'X'},2:{internal_id:'X'},3:{internal_id:'Y'}});
if(dup[2]!==null) throw new Error('duplicate not removed');
window.JinpoActivationEngine={calculateFormation:function(){window.__lastArgs=[...arguments]; return {ok:true}}};
t.installActivationDuplicateGuard();
window.JinpoActivationEngine.calculateFormation({1:{internal_id:'X'},2:{internal_id:'X'}},'衝軛',[],window.JINPO_FORMATION_CONFIG);
if(window.__lastArgs[1]!=='衡軛') throw new Error('engine alias not canonical');
if(window.__lastArgs[0][2]!==null) throw new Error('engine duplicate not removed');
eq(window.__lastArgs[3]['衡軛'].activeLines,[[1,2,3],[4,5,6]],'engine lines');
window.renderFormation=function(){window.JINPO_FORMATION_CONFIG['鶴翼'].activeLines=[[1,2,3],[4,5,6],[1,4],[2,5],[3,6]]};
t.installFormationRenderGuard(); window.renderFormation();
eq(window.JINPO_FORMATION_CONFIG['鶴翼'].activeLines,[[1,2,3],[4,5,6]],'render restore');
window.currentAppliedDbRow={id:'OLD'}; window.__currentAppliedDbRow={id:'OLD'}; window.__lastReachAppliedDbRow={id:'OLD'}; window.__jinpoExactAppliedDbRow={id:'OLD'}; window.__jinpoBonusBaseDbRow={id:'OLD'};
window.__jinpoReachExactLookupSeq=41;
t.clearTransientAppliedDbState();
if(Number(window.__jinpoReachExactLookupSeq)!==42) throw new Error('pending reach exact lookup was not invalidated');
if(ctx.__getSelected()!=='') throw new Error('transient selectedDbResultId not cleared');
if(window.currentAppliedDbRow||window.__currentAppliedDbRow||window.__lastReachAppliedDbRow||window.__jinpoExactAppliedDbRow||window.__jinpoBonusBaseDbRow) throw new Error('transient applied DB refs not cleared');
ctx.selectedDbResultId='OLD';
window.currentAppliedDbRow={id:'OLD'}; window.__currentAppliedDbRow={id:'OLD'}; window.__lastReachAppliedDbRow={id:'OLD'}; window.__jinpoExactAppliedDbRow={id:'OLD'}; window.__jinpoBonusBaseDbRow={id:'OLD'};
t.safeApplyShareState({formation:'衝軛',slots:['EIK_A','EIK_B',null,null,null,null]});
if(ctx.__getSelected()!=='') throw new Error('share did not clear selectedDbResultId');
if(window.currentAppliedDbRow||window.__currentAppliedDbRow||window.__lastReachAppliedDbRow||window.__jinpoExactAppliedDbRow||window.__jinpoBonusBaseDbRow) throw new Error('share did not clear transient applied DB refs');
if(select.value!=='衡軛') throw new Error('share formation canonical failed');
let p=ctx.__getPlacement(); if(p[1].internal_id!=='EIK_A'||p[2].internal_id!=='EIK_B') throw new Error('share placement failed');
let threw=false; try{t.safeApplyShareState({formation:'魚鱗',slots:['EIK_A','EIK_A']})}catch(e){threw=true} if(!threw) throw new Error('share duplicate must fail');
threw=false; try{t.safeApplyShareState({formation:'魚鱗',slots:['EIK_NOT_FOUND']})}catch(e){threw=true} if(!threw) throw new Error('share missing hero must fail');
t.safeApplyShareState({formation:'鶴翼',slots:['EIK_0125']}); p=ctx.__getPlacement(); if(p[1].internal_id!=='EIK_0246') throw new Error('legacy hero migration failed');
const state=t.safeCurrentFormationState(); if(state.formation!=='鶴翼'||state.slots[0]!=='EIK_0246') throw new Error('share state failed');
/* 自分で生成した共有状態が、破損配置の重複英傑を含んで受信側で拒否されないよう送信側でも安全化する。 */
ctx.__setPlacement({1:eiketsuMaster[0],2:eiketsuMaster[0],3:{internal_id:'EIK_0125','英傑名':'legacy'}}); select.value='魚鱗';
const safeState=t.safeCurrentFormationState();
if(safeState.formation!=='魚鱗'||safeState.slots[0]!=='EIK_A'||safeState.slots[1]!==null||safeState.slots[2]!=='EIK_0246') throw new Error('share current-state duplicate/legacy sanitization failed');
threw=false; try{t.safeApplyShareState([])}catch(e){threw=true} if(!threw) throw new Error('share array state accepted');
threw=false; try{t.safeApplyShareState({formation:'魚鱗',slots:'EIK_A'})}catch(e){threw=true} if(!threw) throw new Error('share non-array slots accepted');
ctx.__setPlacement({1:eiketsuMaster[0],2:eiketsuMaster[1]});
/* 差替え成功時だけ旧DB補正参照を破棄し、新しいlast rowとlookup sequenceは保持する。 */
ctx.__setSelected('OLD_RESULT');
window.currentAppliedDbRow={id:'OLD'}; window.__currentAppliedDbRow={id:'OLD'}; window.__jinpoExactAppliedDbRow={id:'OLD'}; window.__jinpoBonusBaseDbRow={id:'OLD'}; window.__lastReachAppliedDbRow={id:'OLD'};
window.__jinpoReachExactLookupSeq=90;
window.applyReachSwapCandidate=function(slot,afterId){
  if(String(afterId)!=='VALID') return Promise.resolve(null);
  ctx.__setPlacement({1:eiketsuMaster[0],2:eiketsuMaster[2]});
  ctx.__setSelected('NEW_RESULT');
  window.__lastReachAppliedDbRow={id:'NEW_RESULT'};
  window.__jinpoReachExactLookupSeq=91;
  return Promise.resolve(window.__lastReachAppliedDbRow);
};
t.installReachSwapAppliedStateGuard();
window.applyReachSwapCandidate(2,'VALID');
if(ctx.__getSelected()!=='NEW_RESULT'||!window.__lastReachAppliedDbRow||window.__lastReachAppliedDbRow.id!=='NEW_RESULT') throw new Error('reach swap new state was cleared');
if(window.currentAppliedDbRow||window.__currentAppliedDbRow||window.__jinpoExactAppliedDbRow||window.__jinpoBonusBaseDbRow) throw new Error('reach swap stale DB refs survived');
if(Number(window.__jinpoReachExactLookupSeq)!==91) throw new Error('reach swap new lookup sequence was invalidated');
/* 無効/no-op差替えでは、現在の正しい適用状態を壊さない。 */
window.currentAppliedDbRow={id:'KEEP'}; window.__currentAppliedDbRow={id:'KEEP'};
window.applyReachSwapCandidate(2,'INVALID');
if(!window.currentAppliedDbRow||window.currentAppliedDbRow.id!=='KEEP'||!window.__currentAppliedDbRow) throw new Error('invalid reach swap cleared current state');
/* 遅延setTimeoutが保持した旧DB行は、編成/陣形が変わった後の総合値へ再描画させない。 */
ctx.__setPlacement({
  1:{internal_id:'R1','英傑名':'R1'},2:{internal_id:'R2','英傑名':'R2'},3:{internal_id:'R3','英傑名':'R3'},
  4:{internal_id:'R4','英傑名':'R4'},5:{internal_id:'R5','英傑名':'R5'},6:{internal_id:'R6','英傑名':'R6'}
}); select.value='方円';
window.JinpoActivationEngine.calculateFormation=function(){return {activated:[]}};
let dbRenderCalls=[];
window.renderRealtimeTotalStatsFromReachDbRow=function(row){dbRenderCalls.push(row&&row.result_id);return true};
t.installDbRowRenderStateGuard();
const oldRow={result_id:'ROW_OLD',formation:'方円',eiketsu_internal_ids:'R1|R2|R3|R4|R5|R6',bond_count:0,bond_names:''};
if(window.renderRealtimeTotalStatsFromReachDbRow(oldRow)!==true||dbRenderCalls.length!==1) throw new Error('matching DB row render was incorrectly blocked');
ctx.__setPlacement({
  1:{internal_id:'N1','英傑名':'N1'},2:{internal_id:'N2','英傑名':'N2'},3:{internal_id:'N3','英傑名':'N3'},
  4:{internal_id:'N4','英傑名':'N4'},5:{internal_id:'N5','英傑名':'N5'},6:{internal_id:'N6','英傑名':'N6'}
});
if(window.renderRealtimeTotalStatsFromReachDbRow(oldRow)!==false||dbRenderCalls.length!==1) throw new Error('stale delayed DB row render was not blocked');
const newRow={result_id:'ROW_NEW',formation:'方円',eiketsu_internal_ids:'N1|N2|N3|N4|N5|N6',bond_count:0,bond_names:''};
if(window.renderRealtimeTotalStatsFromReachDbRow(newRow)!==true||dbRenderCalls.join('|')!=='ROW_OLD|ROW_NEW') throw new Error('current matching DB row render was blocked');
/* runtime master override中はprecomputed DB数値を描画しない。 */
const stdRow=inenMaster[0]; inenMaster[0]={...stdRow,'特大':'生命'};
if(window.renderRealtimeTotalStatsFromReachDbRow(newRow)!==false||dbRenderCalls.length!==2) throw new Error('master override allowed precomputed DB row render');
inenMaster[0]=stdRow;

/* step66 private cacheはマスター差替え後に旧keyを使えないよう一時sentinel→通常keyの2段階で再計算する。 */
const baseExcluded=function(){return ['EIK_EXCLUDED']}; window.__jinpoGetExcludedHeroInternalIds=baseExcluded;
const reachRenders=[]; window.renderReachSlotOnlyUi=function(){reachRenders.push((window.__jinpoGetExcludedHeroInternalIds?window.__jinpoGetExcludedHeroInternalIds():[]).slice())};
t.invalidateReachCandidateCacheAfterMasterChange();
if(reachRenders.length!==1||!reachRenders[0].some(v=>String(v).indexOf('__JINPO_MASTER_CACHE_REV_')===0)) throw new Error('reach cache sentinel recompute missing');
if(!timers.length) throw new Error('reach cache restore timer missing');
while(timers.length){const fn=timers.shift();fn();}
if(reachRenders.length<2||reachRenders[reachRenders.length-1].some(v=>String(v).indexOf('__JINPO_MASTER_CACHE_REV_')===0)) throw new Error('reach cache normal-key recompute missing');
if(window.__jinpoGetExcludedHeroInternalIds!==baseExcluded) throw new Error('excluded hero getter not restored after reach cache invalidation');
/* マスターを短時間に連続差替えしても、一時getterが入れ子で残らない。 */
reachRenders.length=0;
t.invalidateReachCandidateCacheAfterMasterChange();
t.invalidateReachCandidateCacheAfterMasterChange();
while(timers.length){const fn=timers.shift();fn();}
if(window.__jinpoGetExcludedHeroInternalIds!==baseExcluded) throw new Error('rapid master changes leaked temporary excluded getter');
if(!reachRenders.length||reachRenders[reachRenders.length-1].some(v=>String(v).indexOf('__JINPO_MASTER_CACHE_REV_')===0)) throw new Error('rapid master changes did not finish on normal reach cache key');
/* 実ブラウザのclassic scriptでは、グローバルfunction宣言をwindowプロパティで差替えると
   既存イベントハンドラからも新実装が参照される。この前提をVMで固定テストする。 */
const g={}; g.window=g; vm.createContext(g);
vm.runInContext(`function currentFormationState(){return 1} function caller(){return currentFormationState()}`,g);
g.currentFormationState=function(){return 2};
if(g.caller()!==2) throw new Error('global function override semantics failed');

/* URL共有: 初期master未読込なら待機し、読込後だけ復元する。 */
const masterSeed=eiketsuMaster.slice(), bondSeed=inenMaster.slice();
eiketsuMaster.length=0; inenMaster.length=0;
window.__jinpoShareUrlRecoveryScheduled=false; window.__jinpoShareUrlRecoveryCancelled=false; window.__jinpoShareUrlRecovered=false;
ctx.location.search='?f=test';
window.decodeShareState=function(){return {formation:'衝軛',slots:['EIK_A','EIK_B']}};
t.recoverShareUrlAfterInit();
if(!timers.length) throw new Error('share recovery timer not scheduled');
timers.shift()();
if(window.__jinpoShareUrlRecovered) throw new Error('share restored before prerequisites');
masterSeed.forEach(x=>eiketsuMaster.push(x)); bondSeed.forEach(x=>inenMaster.push(x));
if(!timers.length) throw new Error('share recovery retry missing');
timers.shift()();
if(!window.__jinpoShareUrlRecovered || select.value!=='衡軛') throw new Error('delayed share recovery failed');
p=ctx.__getPlacement(); if(p[1].internal_id!=='EIK_A'||p[2].internal_id!=='EIK_B') throw new Error('delayed share placement failed');

/* 待機中にユーザー操作が入ったら、遅延復元で現在操作を上書きしない。 */
timers.length=0; eiketsuMaster.length=0; inenMaster.length=0;
window.__jinpoShareUrlRecoveryScheduled=false; window.__jinpoShareUrlRecoveryCancelled=false; window.__jinpoShareUrlRecovered=false;
ctx.location.search='?f=test2'; select.value='方円';
t.recoverShareUrlAfterInit(); timers.shift()();
t.cancelPendingShareUrlRecovery();
masterSeed.forEach(x=>eiketsuMaster.push(x)); bondSeed.forEach(x=>inenMaster.push(x));
while(timers.length) timers.shift()();
if(window.__jinpoShareUrlRecovered) throw new Error('cancelled share recovery executed');
if(select.value!=='方円') throw new Error('cancelled recovery overwrote user state');
process.stdout.write(JSON.stringify({status:'PASS'}));
"""
    cp = subprocess.run(["node","-e",node,str(BOND_JS)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail("jinpo-bond-list.js 行動テストFAIL: " + cp.stderr.strip())
    try:
        result = json.loads(cp.stdout)
    except Exception as e:
        fail(f"jinpo-bond-list.js 行動テスト結果不正: {e}: {cp.stdout!r}")
    if result.get("status") != "PASS":
        fail("jinpo-bond-list.js 行動テストFAIL")

    # Cache/timeout regressions are tested separately with a fake clock.
    node2 = r"""
const fs=require('fs'),vm=require('vm');
let src=fs.readFileSync(process.argv[1],'utf8');
const end='\n})();',i=src.lastIndexOf(end);
if(i<0)throw new Error('IIFE end missing');
src=src.slice(0,i)+`\nwindow.__T={loadBondMaster,recoverShareUrlAfterInit,resetBondCache:function(){bondMasterCache=null;bondMasterLoadingPromise=null;}};`+src.slice(i);
let now=0,timers=[];
const fakeDate={now(){return now}};
const select={value:'',options:[{value:''},{value:'衡軛'},{value:'鶴翼'},{value:'魚鱗'},{value:'方円'}],selectedOptions:[]};
const document={readyState:'loading',body:null,addEventListener(){},getElementById(id){return id==='formationSelect'?select:null},querySelector(){return null},querySelectorAll(){return[]}};
const live=[{'因縁名':'STANDARD','因子1':'a','因子2':'b','因子3':'c'}];
const ctx={window:{},document,console:{log(){},warn(){},error(){}},inenMaster:live,eiketsuMaster:[],placement:{},Date:fakeDate,location:{search:''},URLSearchParams,Map,Set,JSON,Array,Object,String,Number,RegExp,Error,Promise,
 setTimeout(fn,delay){timers.push([fn,Number(delay)||0]);return timers.length},clearTimeout(){}};
vm.createContext(ctx);
vm.runInContext(`let inenMaster=globalThis.inenMaster;let eiketsuMaster=globalThis.eiketsuMaster;let placement=globalThis.placement;`+src,ctx);
timers=[];
(async()=>{
 const t=ctx.window.__T;
 let first=await t.loadBondMaster(); if(first[0]['因縁名']!=='STANDARD')throw new Error('initial master failed');
 live.splice(0,live.length,{'因縁名':'OVERRIDE','因子1':'x','因子2':'y','因子3':'z'});
 let second=await t.loadBondMaster(); if(second[0]['因縁名']!=='OVERRIDE')throw new Error('live override lost to stale cache');
 // A standard CSV fetch resolving after a runtime override must never overwrite the newer live master.
 live.length=0;t.resetBondCache();let resolveFetch;
 ctx.window.JinpoActivationEngine={loadCSV(){return new Promise(r=>{resolveFetch=r})}};
 const pending=t.loadBondMaster();
 live.push({'因縁名':'RACE_OVERRIDE','因子1':'r1','因子2':'r2','因子3':'r3'});
 resolveFetch([{'因縁名':'LATE_STANDARD','因子1':'s1','因子2':'s2','因子3':'s3'}]);
 const raced=await pending;if(raced[0]['因縁名']!=='RACE_OVERRIDE')throw new Error('late standard fetch overwrote runtime override');
 // Slow/failed initialization must become retryable after timeout, not remain permanently scheduled.
 ctx.eiketsuMaster.length=0;live.length=0;ctx.location.search='?f=x';ctx.window.__jinpoShareUrlRecoveryScheduled=false;ctx.window.__jinpoShareUrlRecovered=false;ctx.window.__jinpoShareUrlRecoveryCancelled=false;
 t.recoverShareUrlAfterInit();
 let guard=0;while(timers.length&&guard++<1000){const [fn,d]=timers.shift();now+=d;fn();}
 if(ctx.window.__jinpoShareUrlRecoveryScheduled!==false)throw new Error('share timeout not retryable');
 if(!ctx.window.__jinpoShareUrlRecoveryTimedOut)throw new Error('share timeout flag missing');
 process.stdout.write(JSON.stringify({status:'PASS'}));
})().catch(e=>{console.error(e);process.exitCode=1});
"""
    cp2 = subprocess.run(["node","-e",node2,str(BOND_JS)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp2.returncode != 0:
        fail("jinpo-bond-list.js cache/timeoutテストFAIL: " + cp2.stderr.strip())
    if json.loads(cp2.stdout).get("status") != "PASS":
        fail("jinpo-bond-list.js cache/timeoutテストFAIL")


def validate_internal_save() -> None:
    text = read_text(INTERNAL_SAVE_JS)
    cp = subprocess.run(["node","--check",str(INTERNAL_SAVE_JS)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail("jinpo-internal-save.js 構文FAIL: " + cp.stderr.strip())
    for frag in [
        "formationName: canonical",
        "formation: canonical",
        "item.formationName = formation",
        "item.formation = formation",
        "衝軛",
        "EIK_0125",
        "EIK_0246",
        "function makeSaveId(usedIds)",
        "usedIds instanceof Set",
        "makeSaveId(seenSaveIds)",
        "saveSequence",
        "seenIds",
        "seenSlots",
        "cleanedMembers",
        "data.map(migrateSavedItem).filter",
        "item.members = []",
        "if(!formation) return null;",
        "seenSaveIds",
        "return true;",
        "return false;",
        "陣形未選択または未対応の陣形のため保存しません",
        "if(!write(list)) return null;",
        "function notifyStorageIssue(message, error)",
        "jinpo:save-storage-error",
        "ブラウザの保存容量・プライベート設定",
    ]:
        if frag not in text:
            fail(f"jinpo-internal-save.js 回帰ガード欠落: {frag}")
    node = r"""
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(process.argv[1],'utf8');
const store={};let failWrite=false,alertCount=0;
const localStorage={getItem(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null},setItem(k,v){if(failWrite)throw new Error('quota');store[k]=String(v)}};
function CustomEvent(type,opts){this.type=type;this.detail=opts&&opts.detail}
const win={alert(){alertCount++},dispatchEvent(){}};
const ctx={window:win,localStorage,console,Date,JSON,String,Array,Object,RegExp,CustomEvent,setTimeout(fn){fn();return 1}}; vm.createContext(ctx); vm.runInContext(src,ctx);
const api=ctx.window.JinpoInternalSave;
if(api.saveFormation('invalid',{1:{internal_id:'EIK_X','英傑名':'X'}},'')!==null) throw new Error('invalid formation saved');
api.saveFormation('x',{1:{internal_id:'EIK_A','英傑名':'A'}},'衝軛');
api.saveFormation('y',{1:{internal_id:'EIK_B','英傑名':'B'}},'魚鱗');
let saved=api.getSaved();
if(saved.length!==2 || saved[0].id===saved[1].id) throw new Error('rapid save id collision');
let x=saved[1];
if(x.formation!=='衡軛'||x.formationName!=='衡軛') throw new Error('save formation keys/canonical failed');
localStorage.setItem('jinpo_internal_saved_formations',JSON.stringify([
 {id:'dup',name:'old1',formation:'衝軛',members:[
   {slot:1,internal_id:'EIK_0125',name:'old'},
   {slot:1,internal_id:'EIK_B',name:'must_drop'},
   {slot:2,internal_id:'EIK_0125',name:'duplicate_hero'},
   {slot:7,internal_id:'EIK_C',name:'bad_slot'}
 ]},
 {id:'dup',name:'old2',formationName:'鶴翼',members:[]}
]));
saved=api.getSaved();
if(saved.length!==2 || saved[0].id===saved[1].id) throw new Error('legacy duplicate save ids not migrated');
x=saved[0];
if(x.formation!=='衡軛'||x.formationName!=='衡軛') throw new Error('legacy formation migration failed');
if(x.members.length!==2) throw new Error('invalid/duplicate slot was not dropped');
if(x.members[0].slot!==1||x.members[0].internal_id!=='EIK_0246') throw new Error('legacy hero migration failed');
if(x.members[1].slot!==2||x.members[1].internal_id!=='') throw new Error('duplicate hero was not blanked safely');
/* migration must persist so the next read is stable and does not mint new IDs again. */
const firstIds=saved.map(v=>v.id); saved=api.getSaved();
if(JSON.stringify(firstIds)!==JSON.stringify(saved.map(v=>v.id))) throw new Error('legacy id migration not persisted');
/* Corrupted/older localStorage entries must never leak primitives/null/members-missing rows to renderSavedFormations(). */
localStorage.setItem('jinpo_internal_saved_formations',JSON.stringify([
 null,'broken',[],{},
 {id:'badformation',name:'bad',formation:'unknown',members:[]},
 {id:'nomembers',name:'legacy',formation:'方円'},
 {id:'valid',name:'ok',formation:'魚鱗',members:[{slot:1,internal_id:'EIK_A',name:'A'}]}
]));
saved=api.getSaved();
if(saved.length!==2) throw new Error('corrupt saved entries were not filtered safely: '+JSON.stringify(saved));
if(saved.some(v=>!v||typeof v!=='object'||!Array.isArray(v.members))) throw new Error('unsafe saved item leaked from migration');
if(saved[0].id!=='nomembers'||saved[0].members.length!==0||saved[0].formationName!=='方円') throw new Error('members-missing legacy row not normalized');
if(saved[1].id!=='valid'||saved[1].members.length!==1) throw new Error('valid row lost during corrupt-data cleanup');
/* Even a corrupted duplicate placement must not be persisted as duplicate heroes. */
const dupSaved=api.saveFormation('dup-placement',{1:{internal_id:'EIK_DUP','英傑名':'D'},2:{internal_id:'EIK_DUP','英傑名':'D'}},'鶴翼');
if(!dupSaved||dupSaved.members[0].internal_id!=='EIK_DUP'||dupSaved.members[1].internal_id!=='') throw new Error('duplicate placement persisted unsafely');
/* randomUUIDが衝突しても保存IDは既存集合と照合して必ず一意にする。 */
ctx.crypto={randomUUID:()=> 'SAME-ID'};
localStorage.setItem('jinpo_internal_saved_formations','[]');
api.saveFormation('id1',{},'魚鱗'); api.saveFormation('id2',{},'方円'); api.saveFormation('id3',{},'鶴翼');
saved=api.getSaved();
if(saved.length!==3||new Set(saved.map(v=>v.id)).size!==3) throw new Error('forced randomUUID collision was not resolved: '+JSON.stringify(saved.map(v=>v.id)));
/* localStorage quota/private-mode failure must not report a false save success and must warn once. */
failWrite=true;const failed=api.saveFormation('quota',{1:{internal_id:'EIK_Z','英傑名':'Z'}},'方円');
if(failed!==null) throw new Error('storage failure falsely reported save success');
if(alertCount!==1) throw new Error('storage failure warning missing');
const failed2=api.saveFormation('quota2',{1:{internal_id:'EIK_Y','英傑名':'Y'}},'方円');
if(failed2!==null||alertCount!==1) throw new Error('storage warning should be deduplicated');
process.stdout.write(JSON.stringify({status:'PASS'}));
"""
    cp = subprocess.run(["node","-e",node,str(INTERNAL_SAVE_JS)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        fail("jinpo-internal-save.js 行動テストFAIL: " + cp.stderr.strip())
    if json.loads(cp.stdout).get("status") != "PASS":
        fail("jinpo-internal-save.js 行動テストFAIL")


def validate_html_integration_if_present() -> None:
    if not HTML.exists():
        return
    text = read_text(HTML)
    bond_pos = text.rfind('<script src="jinpo-bond-list.js"></script>')
    fast_pos = text.rfind('<script src="jinpo-fast-search.js"></script>')
    save_pos = text.find('<script src="jinpo-internal-save.js">')
    if min(bond_pos, fast_pos, save_pos) < 0:
        fail("jinpo.html 必須script読込が見つかりません")
    if not (save_pos < fast_pos < bond_pos):
        fail("jinpo.html script順序不正: runtime hardeningが最後に適用されません")


def validate_workflow() -> None:
    text = read_text(WORKFLOW)
    required = [
        "'陣法/source-next/**'",
        "'陣法/tools-next/**'",
        "'陣法/jinpo.html'",
        "'陣法/jinpo-bond-list.js'",
        "'陣法/jinpo-internal-save.js'",
        "'陣法/jinpo-activation-engine.js'",
        "'陣法/jinpo-formation-config.js'",
        "'陣法/data/jinpo_eiketsu_master.csv'",
        "'陣法/data/compact_search_v2/**'",
        "'陣法/data/91因縁_計算式_倍率展開.csv'",
        "'陣法/data/jinpo_job_mapping.json'",
        "github.actor != 'github-actions[bot]'",
        'python "陣法/tools-next/audit_source_provenance.py"',
        'python "陣法/tools-next/sync_eiketsu_master.py"',
        'python "陣法/tools-next/ensure_compact_record_freshness.py"',
        '生成失敗時の診断情報',
        'generation_report.json',
        'search_integrity_report.json',
        'python "陣法/tools-next/audit_incremental_equivalence.py"',
        'python "陣法/tools-next/audit_compact_stats.py"',
        'JINPO_PROVENANCE_AUDIT_READY:',
        'python "陣法/tools-next/build_jinpo_next.py"',
        'python "陣法/tools-next/audit_runtime_regressions.py"',
        'git ls-files -- \'陣法/_jinpo-next-report/**\'',
        'rm -rf -- "陣法/_jinpo-next-report"',
        'git status --porcelain -- "陣法"',
        'PYTHONDONTWRITEBYTECODE:',
        'python "陣法/tools-next/guard_publish_changes.py"',
        '公開前の生成物allowlist検査',
        '監査済み生成物だけコミット',
        '"陣法/data/jinpo_eiketsu_master.csv"',
        '"陣法/data/jinpo_latest_update_summary.json"',
        '"陣法/data/compact_search_v2"',
        '"陣法/tools-next/hero_internal_id_map.json"',
    ]
    for frag in required:
        if frag not in text:
            fail(f"workflow 回帰ガード欠落: {frag}")
    provenance_pos = text.find('python "陣法/tools-next/audit_source_provenance.py"')
    sync_pos = text.find('python "陣法/tools-next/sync_eiketsu_master.py"')
    fresh_pos = text.find('python "陣法/tools-next/ensure_compact_record_freshness.py"')
    build_pos = text.find('python "陣法/tools-next/build_jinpo_next.py"')
    if min(provenance_pos, sync_pos, fresh_pos, build_pos) < 0 or not (provenance_pos < sync_pos < fresh_pos < build_pos):
        fail("workflow順序不正: 出典監査→master同期→compact freshness→build の順でなければなりません")
    runtime_pos = text.find('python "陣法/tools-next/audit_runtime_regressions.py"')
    cleanup_pos = text.find('rm -rf -- "陣法/_jinpo-next-report"')
    guard_pos = text.find('python "陣法/tools-next/guard_publish_changes.py"')
    add_pos = text.find('git add --')
    push_pos = text.find('git push')
    if min(runtime_pos, cleanup_pos, guard_pos, add_pos, push_pos) < 0 or not (runtime_pos < cleanup_pos < guard_pos < add_pos < push_pos):
        fail("workflow公開順序不正: 全監査→一時レポート除去→allowlist→限定git add→push の順でなければなりません")
    if 'git add -- "陣法"' in text:
        fail("workflowに広すぎる git add -- 陣法 が復活しています")



def validate_provenance_audit_guard() -> None:
    text = read_text(PROVENANCE_AUDIT)
    build_path = ROOT / "tools-next" / "build_jinpo_next.py"
    if not build_path.exists():
        fail("必須ファイル不足: tools-next/build_jinpo_next.py")
    build = build_path.read_text(encoding="utf-8-sig")
    for frag in [
        "因子確認状態", "因子確認日", "因子1出典", "因子2出典", "因子3出典", "因子4出典",
        "能力値確認状態", "能力値確認日", "能力値出典", "確認メモ",
        "確認済", "暫定", "YYYY-MM-DD", "source_provenance_report.json",
    ]:
        if frag not in text:
            fail(f"出典管理監査ガード欠落: {frag}")
    for frag in [
        "audit_source_provenance.py", "source_provenance_report.json",
        "JINPO_PROVENANCE_AUDIT_READY", "build-standalone-audit",
    ]:
        if frag not in build:
            fail(f"buildの出典管理監査統合欠落: {frag}")


def validate_compact_pipeline_guards() -> None:
    fresh = read_text(FRESHNESS_GUARD)
    stats = read_text(COMPACT_STATS_AUDIT)
    for frag in [
        "record_model_fingerprint.json",
        "jinpo-compact-record-model-v3",
        "91因縁_計算式_倍率展開.csv",
        "formation_bonus.csv",
        "rebuild_all_compact.py",
        "rebuild_incremental_additions.py",
        "audit_incremental_equivalence.py",
        "factor4_optimizer.py",
        "fullmax_model.py",
        "rebuild_fullmax_search.py",
        "audit_fullmax_search.py",
        "dirty_internal_ids",
        "generation_deferred_to_build",
        "master_sha256",
    ]:
        if frag not in fresh:
            fail(f"compact再計算保証欠落: {frag}")
    for frag in [
        "records_checked", "stat_errors", "expected_stats",
        "91因縁_計算式_倍率展開.csv", "formation_bonus.csv",
        "stored!=exp or total!=exp_total",
    ]:
        if frag not in stats:
            fail(f"compactステータス全件監査欠落: {frag}")
    for path in (FRESHNESS_GUARD, COMPACT_STATS_AUDIT, FACTOR4_OPTIMIZER, FULLMAX_MODEL, FULLMAX_BUILDER, FULLMAX_AUDIT, INCREMENTAL_BUILDER, INCREMENTAL_AUDIT, PUBLISH_GUARD):
        cp = subprocess.run([sys.executable, "-m", "py_compile", str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if cp.returncode != 0:
            fail(f"{path.name} 構文FAIL: {cp.stderr.strip()}")


def validate_publish_guard_behavior() -> None:
    """Publish guard must allow only generated artifacts and reject stray/cache files before git add."""
    guard_text = read_text(PUBLISH_GUARD)
    for frag in [
        "ALLOWED_EXACT", "陣法/data/jinpo_eiketsu_master.csv", "陣法/data/jinpo_latest_update_summary.json",
        "陣法/tools-next/hero_internal_id_map.json", "陣法/data/compact_search_v2/",
        "__pycache__", ".pyc", "git_lines", "unexpected_paths", "forbidden_paths",
    ]:
        if frag not in guard_text:
            fail(f"公開前allowlistガード欠落: {frag}")
    with tempfile.TemporaryDirectory(prefix="jinpo-publish-guard-") as td:
        repo = Path(td)
        (repo / "陣法" / "tools-next").mkdir(parents=True)
        (repo / "陣法" / "data" / "compact_search_v2").mkdir(parents=True)
        shutil.copy2(PUBLISH_GUARD, repo / "陣法" / "tools-next" / "guard_publish_changes.py")
        (repo / "陣法" / "data" / "jinpo_eiketsu_master.csv").write_text("base\n", encoding="utf-8")
        (repo / "陣法" / "jinpo.html").write_text("base\n", encoding="utf-8")
        subprocess.run(["git","init"],cwd=repo,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        subprocess.run(["git","config","user.email","audit@example.invalid"],cwd=repo,check=True)
        subprocess.run(["git","config","user.name","audit"],cwd=repo,check=True)
        subprocess.run(["git","add","."],cwd=repo,check=True)
        subprocess.run(["git","commit","-m","base"],cwd=repo,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        guard = repo / "陣法" / "tools-next" / "guard_publish_changes.py"
        # Allowed generated output must pass.
        (repo / "陣法" / "data" / "jinpo_eiketsu_master.csv").write_text("changed\n", encoding="utf-8")
        cp = subprocess.run([sys.executable,str(guard)],cwd=repo,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if cp.returncode != 0:
            fail("公開前allowlistガードが許可済み生成物を拒否しました: " + cp.stderr.strip())
        # UI/source mutation by generator must fail.
        (repo / "陣法" / "jinpo.html").write_text("unexpected\n", encoding="utf-8")
        cp = subprocess.run([sys.executable,str(guard)],cwd=repo,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if cp.returncode == 0 or "陣法/jinpo.html" not in (cp.stdout + cp.stderr):
            fail("公開前allowlistガードが想定外UI変更を検出できません")
        subprocess.run(["git","checkout","--","陣法/jinpo.html"],cwd=repo,check=True,stdout=subprocess.DEVNULL)
        # Cache/temp file under an otherwise allowed area must still fail.
        bad = repo / "陣法" / "data" / "compact_search_v2" / "leftover.tmp"
        bad.write_text("tmp", encoding="utf-8")
        cp = subprocess.run([sys.executable,str(guard)],cwd=repo,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if cp.returncode == 0 or "leftover.tmp" not in (cp.stdout + cp.stderr):
            fail("公開前allowlistガードが一時ファイルを検出できません")


def validate_compact_pipeline_behavior() -> None:
    """Tiny executable fixtures prove both new pipeline guards actually catch the failures they were added for."""
    with tempfile.TemporaryDirectory(prefix="jinpo-compact-guard-") as td:
        base = Path(td)
        (base / "tools-next").mkdir(parents=True)
        (base / "data" / "compact_search_v2").mkdir(parents=True)
        shutil.copy2(FRESHNESS_GUARD, base / "tools-next" / FRESHNESS_GUARD.name)
        (base / "tools-next" / "factor4_optimizer.py").write_text("# synthetic fingerprint input\n", encoding="utf-8")
        (base / "tools-next" / "fullmax_model.py").write_text("# synthetic fingerprint input\n", encoding="utf-8")
        (base / "data" / "jinpo_inen_master.csv").write_text(
            "No,因縁名,因子1,因子2,因子3\n1,A,a,b,c\n", encoding="utf-8-sig")
        (base / "data" / "91因縁_計算式_倍率展開.csv").write_text(
            "因縁名,対象ステータス,実効係数\nA,生命,0.1\n", encoding="utf-8-sig")
        (base / "data" / "formation_bonus.csv").write_text(
            "formation,生命\n衡軛,1.00\n", encoding="utf-8-sig")
        with (base / "data" / "jinpo_eiketsu_master.csv").open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f); w.writerow(["internal_id","英傑名"]); w.writerow(["EIK_0001","A"]); w.writerow(["EIK_0002","B"])
        # Model-input stubs. Freshness v3 only marks the build path; it no longer runs generators itself.
        for script in (
            "rebuild_all_compact.py", "factor4_optimizer.py", "fullmax_model.py",
            "rebuild_fullmax_search.py", "audit_fullmax_search.py",
            "rebuild_incremental_additions.py", "audit_incremental_equivalence.py",
        ):
            path = base / "tools-next" / script
            if not path.exists():
                path.write_text("# synthetic fingerprint input\n", encoding="utf-8")

        guard = base / "tools-next" / FRESHNESS_GUARD.name
        def write_sync(dirty=None, new=None, changed=None):
            report_dir = base / "_jinpo-next-report"; report_dir.mkdir(exist_ok=True)
            (report_dir / "master_sync.json").write_text(json.dumps({
                "status":"PASS", "dirty_internal_ids": dirty or [],
                "new_heroes": new or [], "changed_existing": changed or [], "removed_heroes": [],
            }), encoding="utf-8")
        def run_guard() -> dict:
            cp = subprocess.run([sys.executable, str(guard)], cwd=base, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if cp.returncode != 0:
                fail("compact freshness synthetic FAIL: " + cp.stderr.strip())
            try: return json.loads(cp.stdout.strip())
            except Exception as e: fail(f"compact freshness synthetic JSON不正: {e}: {cp.stdout!r}")

        write_sync()
        first = run_guard()
        second = run_guard()
        coef = base / "data" / "91因縁_計算式_倍率展開.csv"
        coef.write_text(coef.read_text(encoding="utf-8-sig").replace("0.1","0.2"), encoding="utf-8-sig")
        write_sync()
        third = run_guard()
        # Pure new hero master change must be declared by sync and must NOT be mistaken for a model change.
        master_path = base / "data" / "jinpo_eiketsu_master.csv"
        master_text = master_path.read_text(encoding="utf-8-sig")
        master_path.write_text(master_text + "EIK_0003,C\n", encoding="utf-8-sig")
        write_sync(["EIK_0003"], [{"internal_id":"EIK_0003","英傑名":"C"}])
        fourth = run_guard()
        if not first.get("model_changed") or first.get("forced_dirty_hero_count") != 2 or not first.get("generation_deferred_to_build"):
            fail("compact freshness v3: 初期化時の全dirty指定FAIL")
        if second.get("model_changed") or second.get("forced_dirty_hero_count") != 0:
            fail("compact freshness v3: 同一fingerprintで不要な全dirty")
        if not third.get("model_changed") or third.get("forced_dirty_hero_count") != 2:
            fail("compact freshness v3: 係数変更を検知できません")
        if fourth.get("model_changed") or fourth.get("suspicious_master_change"):
            fail("compact freshness v3: 正規の新英傑追加をモデル変更扱いしました")

    # 文曲最小化: 各因縁を個別に最小化するだけでなく、編成全体の因子4使用英傑集合を最小化する。
    sys.path.insert(0, str(ROOT / "tools-next"))
    try:
        from factor4_optimizer import assignment_factor4_masks, minimal_factor4_mask
        heroes = {
            1:{"f":["C","","","A"]},
            2:{"f":["A","B","",""]},
            3:{"f":["B","C","",""]},
            4:{"f":["X","","","D"]},
            5:{"f":["D","E","",""]},
            6:{"f":["E","X","",""]},
        }
        bonds = {1:("A","B","C"), 2:("D","E","X")}
        masks = assignment_factor4_masks((1,2,3),1,heroes,bonds,{})
        if 0 not in masks:
            fail("文曲最小化: 因子4を使わない成立割当を列挙できません")
        lines = {"衡軛":((0,1,2),(3,4,5))}
        mask = minimal_factor4_mask((1,2,3,4,5,6),"衡軛",(1,2),lines,heroes,bonds,{})
        if mask != 0:
            fail(f"文曲最小化: 全体最小mask不正 {mask}")
    finally:
        try: sys.path.remove(str(ROOT / "tools-next"))
        except ValueError: pass

    with tempfile.TemporaryDirectory(prefix="jinpo-compact-stats-") as td:
        base = Path(td)
        (base / "tools-next").mkdir(parents=True)
        (base / "data" / "compact_search_v2").mkdir(parents=True)
        shutil.copy2(COMPACT_STATS_AUDIT, base / "tools-next" / COMPACT_STATS_AUDIT.name)
        stats = ["生命","気合","腕力","耐久力","器用さ","知力","魅力","土属性","水属性","火属性","風属性"]
        with (base / "data" / "jinpo_eiketsu_master.csv").open("w", encoding="utf-8-sig", newline="") as f:
            w=csv.writer(f); w.writerow(["internal_id","英傑名"]+stats)
            for hid in range(1,7): w.writerow([f"EIK_{hid:04d}",f"H{hid}"]+[100+hid]*11)
        (base / "data" / "jinpo_inen_master.csv").write_text(
            "No,因縁名,因子1,因子2,因子3\n1,B,a,b,c\n", encoding="utf-8-sig")
        (base / "data" / "91因縁_計算式_倍率展開.csv").write_text(
            "因縁名,対象ステータス,実効係数\nB,生命,0.1\nB,腕力,0.2\n", encoding="utf-8-sig")
        with (base / "data" / "formation_bonus.csv").open("w", encoding="utf-8-sig", newline="") as f:
            w=csv.writer(f); w.writerow(["formation"]+stats); w.writerow(["衡軛"]+["1.10"]+["1.00"]*10)
        base_stat=sum(100+h for h in range(1,7))
        vals=[0]*11; vals[0]=math.floor(base_stat*.1+1e-9)*110//100; vals[2]=math.floor(base_stat*.2+1e-9)
        rec=bytearray(52); struct.pack_into("<6H",rec,0,*range(1,7)); rec[12]=1
        for j,v in enumerate(vals): struct.pack_into("<H",rec,21+2*j,v)
        struct.pack_into("<I",rec,43,sum(vals))
        header=bytearray(16); header[:4]=b"JCF1"; struct.pack_into("<H",header,6,52); struct.pack_into("<I",header,8,1)
        dataset=base/"data"/"compact_search_v2"/"test.bin.gz"; dataset.write_bytes(gzip.compress(bytes(header+rec)))
        manifest={"datasets":{"normal":{"1":{"衡軛":{"file":"data/compact_search_v2/test.bin.gz","rows":1}}}}}
        (base/"data"/"compact_search_v2"/"jinpo_unified_search_manifest.json").write_text(json.dumps(manifest,ensure_ascii=False),encoding="utf-8")
        audit=base/"tools-next"/COMPACT_STATS_AUDIT.name
        good=subprocess.run([sys.executable,str(audit)],cwd=base,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if good.returncode != 0 or json.loads(good.stdout).get("stat_errors") != 0:
            fail("compact stats synthetic 正常recordをFAILしました")
        raw=bytearray(gzip.decompress(dataset.read_bytes())); off=16+21
        struct.pack_into("<H",raw,off,struct.unpack_from("<H",raw,off)[0]+1); dataset.write_bytes(gzip.compress(bytes(raw)))
        bad=subprocess.run([sys.executable,str(audit)],cwd=base,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if bad.returncode == 0 or json.loads(bad.stdout).get("stat_errors") != 1:
            fail("compact stats synthetic 改ざんrecordを検知できません")



def validate_fullmax_search_guards() -> None:
    """FullMAX search must remain a ranking/filter basis only; base formation payload must stay untouched."""
    ui = read_text(FAST_SEARCH_JS)
    worker = read_text(FAST_SEARCH_WORKER)
    html = read_text(HTML) if HTML.exists() else ""
    required_ui = [
        "searchStatMode='base'",
        "検索基準",
        "基礎値",
        "全MAX込み",
        "転生MAX（文曲使用英傑を除く）＋見聞録MAX＋鬼神石MAX",
        "statMode:searchStatMode",
        "getSearchStatMode",
        "setSearchStatMode",
        "row.fullmax_stats",
        "row.fullmax_total",
    ]
    for frag in required_ui:
        if frag not in ui:
            fail(f"全MAX検索UI回帰ガード欠落: {frag}")
    required_worker = [
        "JMX1", "JMR1", "FULLMAX_STAT_OFFSETS",
        "loadFullmaxStats", "fullmaxStatAt", "fullmaxTotalAt",
        "attachFullmaxRow", "fullmax_stats", "fullmax_total",
        "String(q&&q.statMode||'base')==='fullmax'", "recommendFromFullmaxPrecomputed",
    ]
    for frag in required_worker:
        if frag not in worker:
            fail(f"全MAX検索Worker回帰ガード欠落: {frag}")
    # Search-mode data must be attached separately. Overwriting base 52-byte stat fields would break apply/swap.
    bad_assignments = [
        "row['生命']=row.fullmax", "row.生命=row.fullmax", "r['生命']=r.fullmax",
    ]
    for frag in bad_assignments:
        if frag in worker or frag in ui:
            fail(f"全MAX検索が基礎値payloadを上書きしています: {frag}")
    if HTML.exists():
        fast_pos = html.rfind('<script src="jinpo-fast-search.js"></script>')
        worker_ref = 'jinpo-fast-search-worker.js'
        if fast_pos < 0 or worker_ref not in ui:
            fail("全MAX検索統合: fast-search/worker参照不正")
    for path in (FAST_SEARCH_JS, FAST_SEARCH_WORKER):
        cp = subprocess.run(["node", "--check", str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if cp.returncode != 0:
            fail(f"{path.name} 構文FAIL: {cp.stderr.strip()}")


def validate_search_db_runtime_integrity_guards() -> None:
    """Browser Worker must reject mixed/stale DB generations instead of silently searching them."""
    worker = read_text(FAST_SEARCH_WORKER)
    required = [
        "expectedHash16",
        "sha256_16",
        "self.crypto.subtle.digest('SHA-256',ab)",
        "integrityOk",
        "cache:'no-store'",
        "_repair",
        "検索DB整合性不一致",
        "cleanupOldCaches",
        "info.sha256_16,info.gzip_bytes",
    ]
    for frag in required:
        if frag not in worker:
            fail(f"検索DB世代/整合性ガード欠落: {frag}")
    if worker.count("cachedFetch(info.file,m.version,info.sha256_16,info.gzip_bytes)") < 4:
        fail("検索DB SHA-256検証が全読込経路へ適用されていません")
    # A stale Cache API hit must not be trusted before hash verification.
    cache_hit = worker.find("var hit=await cache.match(u.href)")
    cache_verify = worker.find("integrityOk(hab,expectedHash,expectedBytes)")
    if cache_hit < 0 or cache_verify < cache_hit:
        fail("Cache APIヒットのSHA-256検証順序が不正です")


def validate_no_unsupported_10_bonds() -> dict:
    """Exact guard: the current compact/search schema only publishes 5-9 bonds.

    Use the same triple-mask construction as rebuild_all_compact.py.  If a future
    hero/factor edit makes 10+ bonds possible, stop the build instead of silently
    dropping those formations from the search DB.
    """
    master, _ = read_csv_strict(MASTER)
    inen, _ = read_csv_strict(INEN)
    heroes: dict[int, list[str]] = {}
    for row in master:
        iid = str(row.get("internal_id", "")).strip()
        if not iid.startswith("EIK_"):
            continue
        try:
            hid = int(iid[4:])
        except ValueError:
            fail(f"10因縁監査: internal_id不正 {iid}")
        heroes[hid] = [str(row.get(k, "")).strip() for k in ("因子1","因子2","因子3","因子4")]
    bonds: dict[int, list[str]] = {}
    for idx, row in enumerate(inen, 1):
        try:
            bid = int(str(row.get("No", idx)).strip() or idx)
        except ValueError:
            fail(f"10因縁監査: 因縁No不正 {row.get('No')!r}")
        bonds[bid] = [str(row.get(k, "")).strip() for k in ("因子1","因子2","因子3")]

    ids = sorted(heroes)
    by_factor: dict[str, list[int]] = defaultdict(list)
    for hid in ids:
        for factor in set(x for x in heroes[hid] if x and x not in {"-", "対象外"}):
            by_factor[factor].append(hid)

    triple_masks: dict[tuple[int,int,int], int] = defaultdict(int)
    for bid, req in bonds.items():
        bit = 1 << (bid - 1)
        for a in by_factor.get(req[0], ()):
            for b in by_factor.get(req[1], ()):
                if b == a:
                    continue
                for c in by_factor.get(req[2], ()):
                    if c == a or c == b:
                        continue
                    triple_masks[tuple(sorted((a,b,c)))] |= bit

    max_line = max((mask.bit_count() for mask in triple_masks.values()), default=0)

    # 衡軛/鶴翼: two disjoint triples. Search exactly if the upper bound can reach 10.
    if max_line * 2 >= 10:
        by_count: dict[int, list[tuple[tuple[int,int,int], int]]] = defaultdict(list)
        for triple, mask in triple_masks.items():
            by_count[mask.bit_count()].append((triple, mask))
        counts = sorted(by_count)
        for c1 in counts:
            for c2 in counts:
                if c2 < c1 or c1 + c2 < 10:
                    continue
                left, right = by_count[c1], by_count[c2]
                same = left is right
                for i, (t1, m1) in enumerate(left):
                    s1 = set(t1)
                    start = i + 1 if same else 0
                    for t2, m2 in right[start:]:
                        if s1.isdisjoint(t2) and (m1 | m2).bit_count() >= 10:
                            fail(f"検索DB未対応の10因縁以上を検出: 衡軛/鶴翼 {t1}+{t2} count={(m1|m2).bit_count()}")

    # 魚鱗/方円: cycle ABC/CDE/EFA.  Build the same nonzero pair groups as production.
    if max_line * 3 >= 10:
        grouped = defaultdict(lambda: defaultdict(list))
        for (a,b,c), mask in triple_masks.items():
            grouped[(a,b)][mask].append(c)
            grouped[(a,c)][mask].append(b)
            grouped[(b,c)][mask].append(a)
        pair_groups = {
            pair: tuple((mask, tuple(values)) for mask, values in groups.items())
            for pair, groups in grouped.items()
        }
        def groups(a: int, b: int):
            return pair_groups.get((a,b) if a < b else (b,a), ())

        for A, C, E in itertools.combinations(ids, 3):
            g1, g2, g3 = groups(A,C), groups(C,E), groups(A,E)
            if not g1 or not g2 or not g3:
                continue
            shared = {A,C,E}
            for m1, L1 in g1:
                for m2, L2 in g2:
                    union12 = m1 | m2
                    if union12.bit_count() + max_line < 10:
                        continue
                    for m3, L3 in g3:
                        mask = union12 | m3
                        count = mask.bit_count()
                        if count < 10:
                            continue
                        for B in L1:
                            if B in shared:
                                continue
                            for D in L2:
                                if D in shared or D == B:
                                    continue
                                for F in L3:
                                    if F in shared or F == B or F == D:
                                        continue
                                    fail(f"検索DB未対応の10因縁以上を検出: 魚鱗/方円 {(A,B,C,D,E,F)} count={count}")

    return {
        "triple_masks": len(triple_masks),
        "max_bonds_one_line": max_line,
        "max_10plus_guard": "PASS",
    }



def validate_search_inflight_dedup_guard() -> None:
    if not FAST_SEARCH_JS.exists():
        fail("jinpo-fast-search.js がありません")
    js = read_text(FAST_SEARCH_JS)
    required = {
        "in-flight Map": "inFlightSearches=new Map()",
        "shared request helper": "function sharedSearchRequest(k,type,query)",
        "same-key sharing": "var running=inFlightSearches.get(k);if(running)return running;",
        "normal search sharing": "return sharedSearchRequest(keyFor(query),'search',query);",
        "recommend search sharing": "return sharedSearchRequest(recommendKeyFor(query),'recommend',query);",
        "success cleanup": "if(inFlightSearches.get(k)===promise)inFlightSearches.delete(k);return r;",
        "failure cleanup": "if(inFlightSearches.get(k)===promise)inFlightSearches.delete(k);throw err;",
        "cancel cleanup": "pending.clear();inFlightSearches.clear();activeWorkerToken=0;",
    }
    missing = [name for name, needle in required.items() if needle not in js]
    if missing:
        fail("同一条件検索のin-flight共有ガード欠落: " + ", ".join(missing))

def validate_manifest_if_present() -> None:
    if not MANIFEST.exists():
        return
    try:
        m = json.loads(read_text(MANIFEST))
    except Exception as e:
        fail(f"compact manifest JSON不正: {e}")
    if int(m.get("record_size",0)) != 52:
        fail(f"compact record_size不一致: {m.get('record_size')}")
    if int(m.get("top_limit",0)) != 500 or int(m.get("sort_top_limit",0)) != 500:
        fail("Top500設定不一致")
    version = str(m.get("version",""))
    if not version:
        fail("compact manifest version空")
    if not re.search(r"[0-9a-f]{8,}", version.lower()):
        fail(f"compact manifest versionにDB fingerprintがありません: {version}")
    referenced = 0
    def walk(node, path="manifest"):
        nonlocal referenced
        if isinstance(node, dict):
            if "file" in node:
                referenced += 1
                sha = str(node.get("sha256_16", "")).lower()
                if not re.fullmatch(r"[0-9a-f]{16}", sha):
                    fail(f"compact manifest参照ファイルSHA-256欠落/不正: {path} {node.get('file')}")
                try:
                    gz = int(node.get("gzip_bytes", 0))
                except Exception:
                    gz = 0
                if gz <= 0:
                    fail(f"compact manifest gzip_bytes欠落/不正: {path} {node.get('file')}")
            for k, v in node.items():
                walk(v, f"{path}/{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}/{i}")
    walk(m)
    if referenced == 0:
        fail("compact manifestに参照DBがありません")


def main() -> None:
    summary = validate_source_master()
    validate_formation_config()
    validate_bond_js()
    validate_bond_behavior()
    validate_internal_save()
    validate_html_integration_if_present()
    validate_workflow()
    validate_provenance_audit_guard()
    validate_publish_guard_behavior()
    validate_compact_pipeline_guards()
    validate_compact_pipeline_behavior()
    validate_fullmax_search_guards()
    validate_search_db_runtime_integrity_guards()
    validate_search_inflight_dedup_guard()
    max_guard = validate_no_unsupported_10_bonds()
    validate_manifest_if_present()
    print(json.dumps({
        "status":"PASS",
        **summary,
        "formation_lines":"PASS",
        "bond_modal_static_regressions":"PASS",
        "bond_runtime_behavior":"PASS",
        "internal_save_behavior":"PASS",
        "html_script_order":"PASS" if HTML.exists() else "SKIP(local fixture)",
        "workflow_regressions":"PASS",
        "source_provenance_guard":"PASS",
        "compact_record_freshness_guard":"PASS",
        "compact_stats_full_audit_guard":"PASS",
        "compact_pipeline_synthetic_behavior":"PASS",
        "fullmax_search_regressions":"PASS",
        "search_db_runtime_integrity":"PASS",
        "search_inflight_dedup":"PASS",
        **max_guard,
        "manifest_guard":"PASS" if MANIFEST.exists() else "SKIP(local fixture)",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
