param([string]$Root = "")

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Get-Location).Path
}

$Root = [System.IO.Path]::GetFullPath(
    ([string]$Root).Trim().Trim([char]34)
)
$Root = $Root.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
)

$Boot = Join-Path $Root "arukimiko\bootstrap-v304.js"
if (-not (Test-Path -LiteralPath $Boot)) {
    Write-Host "ERROR: arukimiko\bootstrap-v304.js not found." -ForegroundColor Red
    exit 1
}

$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Backup = Join-Path $env:TEMP ("arukimiko_v304_backup_" + $Stamp)
New-Item -ItemType Directory -Path $Backup -Force | Out-Null

$ScriptTag = '<script src="/arukimiko/bootstrap-v304.js?v=304"></script>'

$ScriptPattern = '(?im)^[ \t]*<script[^>]+src\s*=\s*["''][^"'']*/arukimiko/(?:loader|bootstrap(?:-v[0-9]+)?)\.js(?:\?[^"'']*)?["''][^>]*>\s*</script>[ \t]*\r?\n?'
$CssPattern = '(?im)^[ \t]*<link[^>]+href\s*=\s*["''][^"'']*(?:jinpo-ai-chat|jinpo-bot-adv-theme|jinpo-bot-guide)\.css(?:\?[^"'']*)?["''][^>]*>[ \t]*\r?\n?'

function Backup-File([string]$FilePath) {
    $Relative = $FilePath.Substring($Root.Length).TrimStart('\','/')
    $Dest = Join-Path $Backup $Relative
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

    $Text = [regex]::Replace($Text,$ScriptPattern,"")
    $Text = [regex]::Replace($Text,$CssPattern,"")

    if ($Text -match '(?is)</body>') {
        $Text = [regex]::Replace(
            $Text,
            '(?is)</body>',
            ($ScriptTag + [Environment]::NewLine + '</body>'),
            1
        )
    }
    else {
        $Text = $Text + [Environment]::NewLine +
                $ScriptTag + [Environment]::NewLine
    }

    if ($Text -ne $Before) {
        Backup-File $File.FullName
        [System.IO.File]::WriteAllText(
            $File.FullName,
            $Text,
            $Utf8NoBom
        )
        $Changed++
    }
}

Write-Host ""
Write-Host "Arukimiko v3.0.4 hard bootstrap installed." -ForegroundColor Green
Write-Host ("Changed HTML files : " + $Changed)
Write-Host ("Backup directory   : " + $Backup)
Write-Host ""
Write-Host "Expected HTML tag:"
Write-Host $ScriptTag
Write-Host ""
Write-Host "Check GitHub Desktop before commit."
