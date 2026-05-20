# 公開用 dataフォルダ構成版

## 起動
Live Serverで index.html を開く。

## 構成
- index.html
- jinpo.html
- eiketsu_list.html
- inen_list.html
- data/jinpo_eiketsu_master.csv
- data/jinpo_inen_master.csv

## 運用
通常ページは data/ 配下CSVを自動読み込みする。
管理用ツールでCSVを更新したら、data/ 内のCSVだけ差し替える。
