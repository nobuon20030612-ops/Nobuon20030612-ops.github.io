# 実数値表示 修正レポート

## 修正内容
- 仮係数による計算を削除
- でたらめな推定数値を出さない
- result_db / formations_master 完全一致時だけ数値表示
- 未一致時は `—` 表示
- `対象` 表示なし

## 検証
- bad_coeff_removed: OK
- no_formula_function: OK
- no_formula_mode_text: OK
- dash_fallback: OK
- result_db_loader_exists: OK
