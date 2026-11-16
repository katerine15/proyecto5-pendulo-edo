#!/usr/bin/env bash
root="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$root/frontend/dist" ] || "$root/scripts/install.sh"
cd "$root/backend" && PYTHONPATH=. uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
