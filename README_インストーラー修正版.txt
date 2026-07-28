v2.8.0 インストーラー文字化け修正版

原因:
Windows PowerShell 5系が、旧PS1内のUTF-8日本語を誤った文字コードで解釈したため
ParserErrorになっていました。

修正版:
- PowerShell本体をASCII文字だけで記述
- PS1自体にもUTF-8 BOMを付与
- HTML変更前にTEMPへバックアップ
- 陣法DB / Worker / 計算データには触れない

使い方:
1. 旧
   01_install_arukimiko_sitewide.bat
   01_install_arukimiko_sitewide.ps1
   を、このZIPの2ファイルで上書き
2. 01_install_arukimiko_sitewide.bat を実行
3. 完了後、GitHub DesktopのChangesを確認
4. まだCommit / Pushしない

前回のParserError実行では、PowerShellがスクリプト実行前の解析段階で停止したため、
HTML変更処理は開始されていません。
