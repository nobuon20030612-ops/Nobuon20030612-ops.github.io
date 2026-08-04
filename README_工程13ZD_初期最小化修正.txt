【歩き巫女 v3.69.0 工程13ZD 初期最小化修正】

基準:
・歩き巫女_v3.69.0_実Bot演出適合統合候補_stage13Z9_ローカル確認版

修正内容:
1. サイトを新しく開いた時は、過去の open / hidden / minimized 保存値に関係なく、
   歩き巫女チャット欄を必ず表示中かつ最小化状態で開始する。
2. 最小化中の復帰ボタン文言を「元に戻す」から「会話」へ変更する。

維持するもの:
・保存済みの位置、サイズ、手動移動・手動リサイズ情報
・会話履歴
・Bot会話処理
・陣法処理
・Firebase処理
・演出Stage13Z9の追加ファイル

変更ファイル:
・arukimiko/jinpo-ai-chat.js
・arukimiko/jinpo-bot-adv-theme.css（表示仕様コメントのみ）

追加ファイル:
・stage13zd-preview.html
・README_工程13ZD_初期最小化修正.txt
・工程13ZD_初期最小化修正_完了報告.txt
・reports/stage13zd_initial_minimized_audit.json

公開サイトへの反映:
・未実施
・ローカル確認版
