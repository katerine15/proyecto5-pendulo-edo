# Arranca backend + dashboard en http://127.0.0.1:8000
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$root\frontend\dist")) { & "$PSScriptRoot\install.ps1" }
Push-Location "$root\backend"
$env:PYTHONPATH = "."
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
Pop-Location
