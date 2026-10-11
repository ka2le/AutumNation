@echo off
rem Double-click to play Leaf Yard locally.
rem Uses Node.js if installed (with live reload), otherwise built-in PowerShell.
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js %*
) else (
  echo Node.js not found, using the PowerShell server instead.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
)
pause
