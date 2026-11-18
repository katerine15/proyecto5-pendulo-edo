#!/usr/bin/env bash
# Linux / macOS / Git Bash: instala y compila.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
command -v uv  >/dev/null || { echo "Falta 'uv' (pip install uv)"; exit 1; }
command -v npm >/dev/null || { echo "Falta Node.js 22 LTS (https://nodejs.org)"; exit 1; }
# Vite 8 necesita Node 20.19+ o 22.12+.
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=23?0:1)' \
  || { echo "Tu Node.js es $(node --version); se necesita 20.19+ o 22.12+ (instala la LTS de https://nodejs.org)"; exit 1; }
(cd "$root/backend"  && uv sync)
(cd "$root/frontend" && npm install && npm run build)
echo "Listo. Ejecuta: scripts/run.sh"
