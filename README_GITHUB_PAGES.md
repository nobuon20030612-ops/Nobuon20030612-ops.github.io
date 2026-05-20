# GitHub Pages / サーバー公開対応版

## 起動ファイル
`index.html`

## GitHub Pagesで公開する場合
このフォルダの中身をリポジトリ直下、または Pages 公開対象フォルダへ置く。

## 追加対応
- `.nojekyll` 追加
- OGPメタ追加
- favicon.svg 追加
- ogp.svg 追加
- CSVキャッシュ対策 `?v=20260515154758` 付与
- 相対パス構成維持

## CSV更新時
`data/jinpo_eiketsu_master.csv`
`data/jinpo_inen_master.csv`

を差し替える。
キャッシュを強制更新したい場合は、HTML内の `?v=...` を新しい値に変える。

## 通常ユーザーに見せるもの
このフォルダ全体。
管理用ツールは含めない。
