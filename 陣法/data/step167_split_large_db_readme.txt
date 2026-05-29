step167 分割DB適用手順

目的:
- GitHubの100MB制限でpushできない巨大CSVを分割しました。
- 元の巨大CSVはアップロードしないでください。

削除するファイル:
- 陣法/data/jinpo_result_db_7.csv
- 陣法/data/step114_grade3_6_combinations.csv

追加するファイル/フォルダ:
- 陣法/jinpo.html
- 陣法/data/jinpo_result_db_7_parts/
- 陣法/data/grade3_6_parts/
- 陣法/data/jinpo_result_db_7_parts_manifest.json
- 陣法/data/step114_grade3_6_combinations_parts_manifest.json
- 陣法/data/step167_split_large_db_summary.json

確認:
- jinpo_result_db_7 は 13分割、合計250,060行です。
- step114_grade3_6_combinations は 6分割、合計253,412行です。
- 各partは約23MiB以下です。
- HTMLは元の巨大CSV名を呼んだ時、自動で分割CSVを順番に読み込みます。
