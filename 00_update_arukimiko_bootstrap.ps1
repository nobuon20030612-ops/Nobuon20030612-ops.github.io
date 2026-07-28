param([string]$Root = "")

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Get-Location).Path
}
$Root = [System.IO.Path]::GetFullPath(([string]$Root).Trim().Trim([char]34))
$Root = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar,[System.IO.Path]::AltDirectorySeparatorChar)

$Bootstrap = Join-Path $Root "arukimiko\bootstrap.js"
if (-not (Test-Path -LiteralPath $Bootstrap)) {
    Write-Host "ERROR: arukimiko\bootstrap.js was not found." -ForegroundColor Red
    exit 1
}

$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupRoot = Join-Path $env:TEMP ("arukimiko_bootstrap_backup_" + $Stamp)
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

$Tag = '<script src="/arukimiko/bootstrap.js?v=1"></script>'
$Pattern = '(?im)^[ \t]*<script[^>]+src\s*=\s*["''][^"'']*/arukimiko/(?:loader|bootstrap)\.js(?:\?[^"'']*)?["''][^>]*>\s*</script>[ \t]*\r?\n?'

function Backup-File([string]$FilePath) {
    $Relative = $FilePath.Substring($Root.Length).TrimStart('\','/')
    $Dest = Join-Path $BackupRoot $Relative
    $Dir = Split-Path -Parent $Dest
    if (-not (Test-Path -LiteralPath $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }
    Copy-Item -LiteralPath $FilePath -Destination $Dest -Force
}

$Changed = 0
$Files = Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "*.html" |
    Where-Object { $_.FullName -notmatch '[\\/]+arukimiko[\\/]' }

foreach ($File in $Files) {
    $Text = [System.IO.File]::ReadAllText($File.FullName)
    $Before = $Text

    $Text = [regex]::Replace($Text,$Pattern,"")

    if ($Text -match '(?is)</body>') {
        $Text = [regex]::Replace($Text,'(?is)</body>',($Tag + [Environment]::NewLine + '</body>'),1)
    } else {
        $Text = $Text + [Environment]::NewLine + $Tag + [Environment]::NewLine
    }

    if ($Text -ne $Before) {
        Backup-File $File.FullName
        [System.IO.File]::WriteAllText($File.FullName,$Text,$Utf8NoBom)
        $Changed++
    }
}

Write-Host ""
Write-Host "Arukimiko bootstrap update completed." -ForegroundColor Green
Write-Host ("Changed HTML files : " + $Changed)
Write-Host ("Backup directory   : " + $BackupRoot)
Write-Host ""
Write-Host "All pages now load /arukimiko/bootstrap.js?v=1"
Write-Host "bootstrap.js always requests a fresh loader.js."
Write-Host "Check GitHub Desktop before commit."
