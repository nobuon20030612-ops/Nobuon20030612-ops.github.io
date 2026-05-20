# スロットクリック選択モーダル版 修正レポート

## 修正内容
- 上部プルダウン/カード選択UIを非表示
- 陣形スロットをクリック可能に変更
- スロットクリックで英傑選択モーダル表示
- モーダル内に画像/名前/職/因子カード表示
- モーダル内に名前検索・職フィルタ・因子フィルタ追加
- 選択後に即配置・自動判定
- 表示上はEIK表記を出さず、内部はinternal_id維持

## 検証
- modal_exists: OK
- slot_click: OK
- old_slot_hidden: OK
- modal_filters: OK
- internal_id_used: OK
