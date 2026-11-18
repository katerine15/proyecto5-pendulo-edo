"""Figuras en tiempo real: el servidor las dibuja con los parámetros de la petición (PNG, SVG, GIF, CSV o ZIP)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response

from app.core.pendulum import Params

router = APIRouter(prefix="/api/figures")

MEDIA = {"png": "image/png", "svg": "image/svg+xml", "gif": "image/gif", "csv": "text/csv; charset=utf-8", "zip": "application/zip"}
THETA = Query(90.0, gt=0, le=170, description="Ángulo de suelta (°)")
LEN = Query(1.0, gt=0.05, le=20, description="Longitud L (m)")
GRAV = Query(9.81, gt=0.1, le=30, description="Gravedad g (m/s²)")
THEME = Query("light", pattern="^(light|dark)$")
DPI = Query(160, ge=50, le=300)


def _load():
    """Importa las figuras al primer uso: matplotlib es opcional para quien solo quiera el cálculo."""
    try:
        from app.figures import render

        return render
    except ImportError as e:  # pragma: no cover
        raise HTTPException(501, "Faltan las dependencias de figuras. Ejecute: uv sync") from e


def _send(data: bytes, ext: str, name: str, download: bool) -> Response:
    headers = {"Cache-Control": "public, max-age=300", "Content-Disposition": f'{"attachment" if download else "inline"}; filename="{name}"'}
    return Response(content=data, media_type=MEDIA[ext], headers=headers)


@router.get("")
def catalog() -> dict:
    r = _load()
    figs = [{"id": k, "title": v[1], "kind": v[2], "formats": list(r.FORMATS)} for k, v in r.CATALOG.items()]
    figs.append({"id": "animacion", "title": "Animación 3D en cámara lenta", "kind": "GIF", "formats": ["gif"]})
    figs.append({"id": "tabla_periodos", "title": "Tabla de períodos", "kind": "CSV", "formats": ["csv"]})
    return {"figures": figs}


@router.get("/todo.zip")
def everything(theta0_deg: float = THETA, L: float = LEN, g: float = GRAV, theme: str = THEME, dpi: int = DPI,
               gif: bool = False) -> Response:
    r = _load()
    return _send(r.render_zip(Params(theta0_deg, L, g), theme, dpi, gif), "zip", "figuras_pendulo.zip", True)


@router.get("/{filename}")
def figure(filename: str, theta0_deg: float = THETA, L: float = LEN, g: float = GRAV, theme: str = THEME, dpi: int = DPI,
           slow: float = Query(0.25, ge=0.05, le=1.0), seconds: float = Query(8.0, ge=2, le=13), fps: int = Query(20, ge=8, le=30),
           download: bool = False) -> Response:
    if "." not in filename:
        raise HTTPException(404, "Use nombre.formato, por ejemplo error_periodo.png")
    name, ext = filename.rsplit(".", 1)
    r = _load()
    p = Params(theta0_deg, L, g)
    try:
        if name == "tabla_periodos" and ext == "csv":
            data = r.render_csv(L, g)
        elif name == "animacion" and ext == "gif":
            data = r.render_gif(p, theme, slow, seconds, fps, min(dpi, 110))
        elif name in r.CATALOG and ext in r.FORMATS:
            data = r.render(name, p, theme, ext, dpi)
        else:
            raise HTTPException(404, f"No existe la figura {filename}")
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    return _send(data, ext, filename, download)
