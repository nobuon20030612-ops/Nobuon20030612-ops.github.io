@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp000_update_arukimiko_bootstrap.ps1"
echo.
pause
