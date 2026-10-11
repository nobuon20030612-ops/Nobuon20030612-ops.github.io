#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""軍神上振れ抑制・机上検証の最終監査。研究モデルは本番に反映しない。標準ライブラリのみ。"""
import csv
import io
import json
import hashlib
import zipfile
import argparse
from pathlib import Path

STATS = ['生命力','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性']
BASE='軍神/検証データ/上振れ抑制モデル/'
FIXED = {7,11,15,19,94}
EXCLUDED = FIXED | {4,115,116,117}


def read_csv(b):
    return list(csv.DictReader(io.StringIO(b.decode('utf-8-sig'))))


def audit(site_path, study_path):
    with zipfile.ZipFile(site_path) as site, zipfile.ZipFile(study_path) as study:
        assert site.testzip() is None and study.testzip() is None
        raw = site.read('軍神/軍神データ.csv')
        sha = hashlib.sha256(raw).hexdigest()
        assert sha == '5dfde73d7763e3bd462beb9376651f0038b689427def7085bb7af30f574d3003', '正本CSVが異なる'
        records = read_csv(raw)
        gods = {int(r['No']): r for r in records}
        assert len(gods) == 114
        rates = json.loads(site.read('軍神/検索データ/構成倍率.json'))
        ref = json.loads(site.read('軍神/検証データ/三貴神3回_114柱_参考下端差分.json'))
        mask552 = {(int(r['No']), STATS.index(r['能力'])) for r in read_csv(study.read(BASE+'再計算用_552項目最小参照.csv'))}
        mask579 = {(int(k), i) for k, v in ref['差分（11能力順）'].items() for i, d in enumerate(v) if d == '1'}
        assert len(mask552) == 552 and len(mask579) == 579 and mask552 < mask579
        assert all(k not in EXCLUDED for k, _ in mask579)
        assert all(i >= 2 for _,i in mask579)
        targets = mask579-mask552
        assert len(targets) == 27
        model_masks = [set(), mask552, mask579]
        pred_count = 0
        active_coverage = set()
        measured = 0
        all_configs = set()
        models = []
        for tag, n_expected in [('三モデル12組_倍率±1.5pp識別',12),('コスト32実用域6組',6)]:
            plan_name = BASE+tag+'_編成一覧.csv'
            pv_name = BASE+tag+'_11能力全モデル予測.csv'
            input_name = BASE+tag+'_実測入力.csv'
            plans = read_csv(study.read(plan_name))
            table = read_csv(study.read(pv_name))
            inputs = read_csv(study.read(input_name))
            assert len(plans) == len(inputs) == n_expected and len(table) == n_expected*11
            check = {(int(p['測定順']),p['能力']): p for p in table}
            assert len(check) == len(table)
            for plan, inp in zip(plans, inputs):
                n = int(plan['測定順'])
                A = [int(x) for x in plan['A6柱No'].split(',')]
                B = [int(x) for x in plan['B6柱No'].split(',')]
                assert len(A) == len(B) == len(set(A)) == len(set(B)) == 6
                assert len(set(A)&set(B)) == 5
                assert not (set(A+B)&EXCLUDED)
                assert all(gods[k]['設定可否'] == '設定可' for k in A+B)
                csA = ''.join(sorted((gods[k]['コスト'] for k in A),reverse=True))
                csB = ''.join(sorted((gods[k]['コスト'] for k in B),reverse=True))
                assert csA == plan['Aコスト構成'] == inp['Aコスト構成']
                assert csB == plan['Bコスト構成'] == inp['Bコスト構成']
                assert inp['A6柱No'] == plan['A6柱No'] and inp['B6柱No'] == plan['B6柱No']
                assert sum(map(int,csA)) <= 32 and sum(map(int,csB)) <= 32
                all_configs.update((tuple(A),tuple(B)))
                # ±1.5百分率ポイントの区間分離を、本番データから独立再検証。
                for key in targets:
                    no, stat_i = key
                    if no not in set(A+B):
                        continue
                    if sum(int(other_i == stat_i and other_no in set(A+B)) for other_no,other_i in targets) != 1:
                        continue
                    st = STATS[stat_i]
                    rA,rB = rates[csA][stat_i+3],rates[csB][stat_i+3]
                    intervals=[]
                    for m in model_masks:
                        ra=sum(int(gods[k][st])-int((k,stat_i) in m) for k in A)
                        rb=sum(int(gods[k][st])-int((k,stat_i) in m) for k in B)
                        intervals.append((ra*(rA*100-150)//10000-rb*(rB*100+150)//10000,
                                          ra*(rA*100+150)//10000-rb*(rB*100-150)//10000))
                    for left,right in ((0,1),(0,2),(1,2)):
                        l1,h1 = intervals[left];l2,h2=intervals[right]
                        if h1<l2 or h2<l1:
                            active_coverage.add((key,left,right))
                for i, stat in enumerate(STATS):
                    pr = check[(n,stat)]
                    got = []
                    for m in model_masks:
                        ax = sum(int(gods[k][stat])-int((k,i) in m) for k in A)
                        bx = sum(int(gods[k][stat])-int((k,i) in m) for k in B)
                        aa = ax * rates[csA][i+3] // 100
                        bb = bx * rates[csB][i+3] // 100
                        got += [aa,bb,aa-bb]
                    expected=[int(pr[k]) for k in ['A現行予測','B現行予測','現行A-B','A552予測','B552予測','552A-B','A579予測','B579予測','579A-B']]
                    assert got == expected, f'{tag}/{n}/{stat}: {got} != {expected}'
                    pred_count += len(got)
                for k in STATS:
                    assert not inp['ゲームA_'+k] and not inp['ゲームB_'+k], '同梱フォームに実測入力がある'
                measured += int(inp['観測条件'] == '三貴神×3・奉納物未使用' and inp['同一条件で測定'] == 'はい')
            models.append({'用途':tag,'組数':n_expected,'予測行':len(table),'再計算数':len(table)*9})
        assert pred_count == 1782 and measured == 0
        coverage = read_csv(study.read(BASE+'三モデル12組_全81条件証明.csv'))
        assert len(coverage) == 81
        unique = {(int(r['軍神No']),r['能力'],r['比較仮説']) for r in coverage}
        assert len(unique) == 81
        required = {(key,a,b) for key in targets for a,b in ((0,1),(0,2),(1,2))}
        assert active_coverage == required, f'再計算による81条件の網羅不足: {len(active_coverage)}'
        assert all(r['該当測定順'] for r in coverage)
        return {
            '状態':'机上検証終了：本番現行モデル維持、仮想補正案はいずれも不採用',
            '基準サイトZIP':Path(site_path).name,
            '基準研究ZIP':Path(study_path).name,
            '軍神CSV_SHA256':sha,
            '軍神数':len(gods),
            'モデル':'現行、552案、579案',
            '552案項目数':len(mask552),
            '579案項目数':len(mask579),
            '579案の追加保留項目':len(targets),
            '通常育成補正除外No': sorted(FIXED),
            '残した測定計画':models,
            'A_B合計組数':18,
            '異なる6柱編成数':len(all_configs),
            '独立の同条件実測_今回': measured,
            '比較計算一致数':pred_count,
            '仮説識別の条件数': len(coverage),
            '本番への変更':0,
            '補正採用':0,
            '過去52項目原本':'見つからず。推測による修正を行わない',
            '採否の理由':'同一育成条件かつ学習に未使用のゲーム内6柱A/B実測が無く、上振れ抑制による実ゲーム一致率向上を検証できない',
            '今後の取扱い':'机上検証を終了。追加の数値仮説・最適化を反復しない。独立実測と52項目の原本が確認できた時だけ再開判断'
        }

if __name__ == '__main__':
    pa=argparse.ArgumentParser()
    pa.add_argument('--site-zip',required=True)
    pa.add_argument('--study-zip',required=True)
    pa.add_argument('--out',required=True)
    args=pa.parse_args()
    result=audit(args.site_zip,args.study_zip)
    Path(args.out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
