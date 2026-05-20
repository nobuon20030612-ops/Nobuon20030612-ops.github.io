# 実倍率マスター リアルタイム計算版

## 追加
- data/jinpo_inen_multiplier_master.csv
- data/jinpo_eiketsu_status_master.csv

## 動作
1. result_db一致
   → 実DB数値表示

2. DB未一致
   → 因縁倍率マスターからリアルタイム計算

## 計算
成立ライン3人合計
×
因縁倍率
×
陣形倍率

## 特徴
- external_id未確認でも計算可能
- 新英傑追加対応
- result_db優先
- 未登録倍率は計算しない
