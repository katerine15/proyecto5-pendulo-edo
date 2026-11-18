"""Generación de figuras bajo demanda, con caché. Es el único punto de entrada que usan la API y el script.

    render("error_periodo", Params(90, 1.0, 9.81), theme="light", fmt="png")  ->  bytes

Es "tiempo real": cada llamada con parámetros nuevos produce la figura al vuelo (la caché evita repetir trabajo
si los parámetros no cambiaron). Las figuras se dibujan con `Figure` sin pyplot y se serializan con un candado.
"""
from __future__ import annotations

import io
import threading
from collections.abc import Callable
from functools import lru_cache

from matplotlib.figure import Figure

from app.core.pendulum import Params
from app.figures import charts, charts3d

Builder = Callable[[Params, str, int], Figure]

CATALOG: dict[str, tuple[Builder, str, str]] = {
    "verificacion": (charts.verificacion, "Verificación contra la solución exacta", "2D"),
    "comparacion": (charts.comparacion, "Real contra lineal en cuatro ángulos", "2D"),
    "error_periodo": (charts.error_periodo, "Error del período y umbral del 1 %", "2D"),
    "fases": (charts.fases, "Espacio de fases", "2D"),
    "serie_periodo": (charts.serie_periodo, "Período exacto y su desarrollo en serie", "2D"),
    "energia": (charts.energia, "Conservación de la energía", "2D"),
    "paisaje_energia": (charts3d.paisaje_energia, "Paisaje de energía", "3D"),
    "espacio_tiempo": (charts3d.espacio_tiempo, "Trayectoria en θ–ω–t", "3D"),
}
FORMATS = ("png", "svg")
_LOCK = threading.Lock()


def _key(p: Params) -> tuple[float, float, float]:
    return round(p.theta0_deg, 1), round(p.L, 3), round(p.g, 3)


@lru_cache(maxsize=160)
def _render(name: str, theta0: float, L: float, g: float, theme: str, fmt: str, dpi: int) -> bytes:
    builder = CATALOG[name][0]
    with _LOCK:
        fig = builder(Params(theta0, L, g), theme, dpi)
        buf = io.BytesIO()
        fig.savefig(buf, format=fmt, dpi=dpi, facecolor=fig.get_facecolor())
        return buf.getvalue()


def render(name: str, p: Params, theme: str = "light", fmt: str = "png", dpi: int = 160) -> bytes:
    if name not in CATALOG:
        raise KeyError(f"Figura desconocida: {name}")
    if fmt not in FORMATS:
        raise ValueError(f"Formato no admitido: {fmt}")
    if theme not in ("light", "dark"):
        raise ValueError(f"Tema desconocido: {theme}")
    if not 50 <= dpi <= 300:
        raise ValueError("dpi debe estar entre 50 y 300")
    return _render(name, *_key(p), theme, fmt, int(dpi))


# ───────────── Animación, tabla y paquete completo ─────────────
@lru_cache(maxsize=24)
def _gif(theta0: float, L: float, g: float, theme: str, slow: float, seconds: float, fps: int, dpi: int) -> bytes:
    from app.figures.animation import animation_gif

    with _LOCK:
        return animation_gif(Params(theta0, L, g), theme, slow, seconds, fps, dpi)


def render_gif(p: Params, theme: str = "light", slow: float = 0.25, seconds: float = 8.0, fps: int = 20, dpi: int = 80) -> bytes:
    """GIF 3D en cámara lenta. Tarda unos segundos la primera vez; después sale de la caché."""
    if theme not in ("light", "dark"):
        raise ValueError(f"Tema desconocido: {theme}")
    return _gif(*_key(p), theme, round(slow, 2), round(seconds, 1), int(fps), int(dpi))


def render_csv(L: float = 1.0, g: float = 9.81) -> bytes:
    from app.figures import tables

    return tables.to_csv(tables.period_table(round(L, 3), round(g, 3))).encode("utf-8")


def render_zip(p: Params, theme: str = "light", dpi: int = 160, with_gif: bool = False) -> bytes:
    """Todas las figuras (PNG y SVG), la tabla CSV y, si se pide, la animación, en un solo ZIP."""
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name in CATALOG:
            for fmt in FORMATS:
                z.writestr(f"{name}.{fmt}", render(name, p, theme, fmt, dpi))
        z.writestr("tabla_periodos.csv", render_csv(p.L, p.g))
        if with_gif:
            z.writestr("animacion_camara_lenta.gif", render_gif(p, theme))
    return buf.getvalue()
