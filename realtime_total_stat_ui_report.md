# リアルタイム陣法能力表示＋UI整理レポート

## 修正内容
- 陣法能力トータル上昇値を上部に固定表示
- 英傑配置・変更ごとにリアルタイム更新
- formations_master一致時は実数値表示
- 未一致時は推測計算せず対象ステータスのみ表示
- 上部プルダウン/常時英傑カード欄を非表示
- 先頭6人仮配置ボタンを削除
- 因子/因縁効果の対象外・未確認・空欄を非表示

## 検証
- total_panel: OK
- realtime_function: OK
- auto_fill_removed: OK
- slot_grid_hidden: OK
- clean_list: OK
- target_off_filter: OK
