# Instala dependencias del backend (Python/uv) y del frontend (npm) y compila el dashboard.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "Falta 'uv'. Instálalo con:  pip install uv   (o https://docs.astral.sh/uv/)" -ForegroundColor Yellow; exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "Falta Node.js 22 LTS (https://nodejs.org)." -ForegroundColor Yellow; exit 1
}
# Vite 8 necesita Node 20.19+ o 22.12+. Con una versión anterior npm omite el binario de Windows y la compilación falla.
$nodeVer = [version]((node --version).TrimStart('v'))
if (($nodeVer.Major -lt 20) -or ($nodeVer.Major -eq 20 -and $nodeVer.Minor -lt 19) -or ($nodeVer.Major -eq 21) -or ($nodeVer.Major -eq 22 -and $nodeVer.Minor -lt 12)) {
  Write-Host "Tu Node.js es v$nodeVer y el dashboard necesita 20.19+ o 22.12+." -ForegroundColor Yellow
  Write-Host "Instala la versión LTS desde https://nodejs.org, cierra y vuelve a abrir la terminal, borra la carpeta frontend\node_modules y corre de nuevo este script." -ForegroundColor Yellow
  exit 1
}

Push-Location "$root\backend"
uv sync
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Falló la instalación del backend (uv sync)." -ForegroundColor Red; exit 1 }
Pop-Location

Push-Location "$root\frontend"
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Falló npm install." -ForegroundColor Red; exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Falló la compilación del dashboard (npm run build)." -ForegroundColor Red; exit 1 }
Pop-Location

Write-Host "`nListo. Ejecuta:  .\scripts\run.ps1" -ForegroundColor Green
