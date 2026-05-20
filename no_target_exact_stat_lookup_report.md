# 対象表示削除＋実数値DB自動読込 修正レポート

## 修正内容
- トータル上昇値欄の「対象」表示を削除
- 数値未取得時は `—` 表示に統一
- result_db_lookup.csv を data/ に同梱
- formation_bonus.csv を data/ に同梱
- result_db_lookup.csv を起動時に自動読込
- external_idが揃い、result_dbに一致した場合は陣形補正後の実数値を表示
- 一致しない場合は推測計算せず `—` 表示

## 注意
- external_id未確認英傑を含む編成は、既存result_dbと照合できないため数値は `—`。
- internal_idだけで実数値を出すには、internal_id対応の結果DBを別途登録する必要あり。

## 検証
- result_db_copied: OK
- formation_bonus_copied: OK
- result_db_loader: OK
- target_fallback_removed: OK
- dash_fallback: OK
