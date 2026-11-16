#!/usr/bin/env bash
# Linux / macOS / Git Bash: instala y compila.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
command -v uv  >/dev/null || { echo "Falta 'uv' (pip install uv)"; exit 1; }
command -v npm >/dev/null || { echo "Falta Node.js 20+"; exit 1; }
(cd "$root/backend"  && uv sync)
(cd "$root/frontend" && npm install && npm run build)
echo "Listo. Ejecuta: scripts/run.sh"
