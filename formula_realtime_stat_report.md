# 因縁成立ライン計算によるリアルタイム数値表示レポート

## 修正内容
- DB完全一致しなくても、成立した因縁から数値を出す処理を追加
- 各因縁の成立ライン3人合計ステータスを使用
- 効果段階ごとの係数CSV `jinpo_effect_coefficient_master.csv` を追加
- external_id未確認英傑でも、internal_id側の英傑ステータスで計算可能
- result_db一致時はresult_dbを優先
- result_db不一致時はリアルタイム計算へフォールバック

## 重要
- 係数はCSVで差し替え可能。
- 今後、実測倍率が確定したら `data/jinpo_effect_coefficient_master.csv` だけ更新する。

## 検証
- coeff_file: OK
- coeff_loader: OK
- formula_calc: OK
- render_uses_formula: OK
