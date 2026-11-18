"""Punto de entrada. `uv run uvicorn app.main:app` sirve API + dashboard (si está compilado)."""
from __future__ import annotations

import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.adapters.api.routes import router
from app.adapters.api.routes_ada import router as ada_router
from app.adapters.api.routes_figures import router as figures_router
from app.models import registry

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
DIST = ROOT / "frontend" / "dist"

registry.register_defaults()


def _warm_up_figures() -> None:
    """Precalienta matplotlib (importación y caché de fuentes) para que la primera figura no tarde segundos."""
    try:
        from app.core.pendulum import Params
        from app.figures import render

        render.render("serie_periodo", Params(), "light", "png", 50)
    except Exception:  # noqa: BLE001  (si faltan las dependencias de figuras, el resto de la API sigue funcionando)
        pass


@asynccontextmanager
async def lifespan(_app: FastAPI):
    threading.Thread(target=_warm_up_figures, daemon=True).start()
    yield


app = FastAPI(title="Plataforma de modelos físicos — API", version="1.2.0", lifespan=lifespan)


@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    """Si API_KEY está definida (p. ej. al publicar por tunnel), exige X-API-Key en /api/*."""
    key = os.getenv("API_KEY", "")
    path = request.url.path
    if key and path.startswith("/api/") and path != "/api/health":
        if request.headers.get("x-api-key") != key:
            return JSONResponse({"detail": "API key inválida"}, status_code=401)
    return await call_next(request)


app.include_router(router)
app.include_router(figures_router)
app.include_router(ada_router)

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        dist_root = DIST.resolve()
        candidate = (dist_root / full_path).resolve()
        if candidate.is_relative_to(dist_root) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(dist_root / "index.html")
