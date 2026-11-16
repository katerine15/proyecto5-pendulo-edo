# Instala dependencias del backend (Python/uv) y del frontend (npm) y compila el dashboard.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "Falta 'uv'. Instálalo con:  pip install uv   (o https://docs.astral.sh/uv/)" -ForegroundColor Yellow; exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "Falta Node.js 20+ (https://nodejs.org)." -ForegroundColor Yellow; exit 1
}

Push-Location "$root\backend";  uv sync;                       Pop-Location
Push-Location "$root\frontend"; npm install; npm run build;    Pop-Location
Write-Host "`nListo. Ejecuta:  .\scripts\run.ps1" -ForegroundColor Green
