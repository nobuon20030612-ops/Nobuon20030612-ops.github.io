# プルダウン全英傑表示 修正レポート

## 修正内容
- プルダウンは検索欄に影響されず、常に全英傑を表示
- プルダウン表示から `EIK_0001 /` を削除
- 選択処理は英傑名ではなく `internal_id` で維持
- カード一覧の300件制限を削除
- 検索欄はカード検索だけに使用

## 検証
- dropdown_all_rows: OK
- select_value_internal_id: OK
- selection_by_internal_id: OK
- no_dropdown_internal_id_label: OK
- no_300_limit: OK
