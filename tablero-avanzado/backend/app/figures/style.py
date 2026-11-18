"""Estilo común de las figuras: los mismos colores del dashboard (tokens), en tema claro y oscuro.

Colores con significado fijo en todo el proyecto: lin = aproximación lineal (azul), real = péndulo real (rojo),
exact = solución exacta (grafito). Se usa `matplotlib.figure.Figure` directamente (sin pyplot): es seguro con hilos del servidor.
"""
from __future__ import annotations

from matplotlib import font_manager
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.figure import Figure

PALETTES: dict[str, dict[str, str]] = {
    "light": dict(bg="#f2f6f7", paper="#fafcfc", grid="#dde7ec", grid_strong="#c2d0d8", rule="#c9d4dc", ink="#0f1d2e",
                  ink2="#3e4e62", muted="#566679", lin="#1d4ed8", real="#c62828", exact="#2b2b2b", ok="#17663f",
                  warn="#8a5a00", bad="#8f1d5b"),
    "dark": dict(bg="#0c1621", paper="#0f1b28", grid="#1a2a3a", grid_strong="#27394b", rule="#26384a", ink="#e8eef4",
                 ink2="#b3c0ce", muted="#8fa0b2", lin="#7ca2ff", real="#ff7a6e", exact="#dadfe5", ok="#5fd08b",
                 warn="#e7b04a", bad="#e987b8"),
}


def _pick_font() -> str:
    available = {f.name for f in font_manager.fontManager.ttflist}
    return next((f for f in ("Segoe UI", "Inter", "Helvetica Neue", "Arial") if f in available), "DejaVu Sans")


FONT = _pick_font()


def palette(theme: str) -> dict[str, str]:
    if theme not in PALETTES:
        raise ValueError(f"tema desconocido: {theme}")
    return PALETTES[theme]


def new_figure(theme: str, size: tuple[float, float], dpi: int = 160) -> Figure:
    pal = palette(theme)
    fig = Figure(figsize=size, dpi=dpi, facecolor=pal["paper"])
    FigureCanvasAgg(fig)
    return fig


def style_axes(ax, pal: dict[str, str], grid: bool = True) -> None:
    """Ejes limpios: solo izquierda y abajo, cuadrícula fina, marcas discretas."""
    ax.set_facecolor(pal["paper"])
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(pal["rule"])
    ax.tick_params(colors=pal["muted"], labelsize=9.5, length=3, width=0.8, color=pal["rule"])
    ax.xaxis.label.set_color(pal["ink2"])
    ax.yaxis.label.set_color(pal["ink2"])
    ax.xaxis.label.set_size(10.5)
    ax.yaxis.label.set_size(10.5)
    if grid:
        ax.grid(True, color=pal["grid"], linewidth=0.9)
        ax.set_axisbelow(True)


def style_axes_3d(ax, pal: dict[str, str]) -> None:
    ax.set_facecolor(pal["paper"])
    for axis in (ax.xaxis, ax.yaxis, ax.zaxis):
        try:
            axis.set_pane_color(_with_alpha(pal["paper"], 0.0))
            axis._axinfo["grid"]["color"] = pal["grid"]
            axis._axinfo["grid"]["linewidth"] = 0.8
            axis.line.set_color(pal["rule"])
        except Exception:  # noqa: BLE001  (los detalles internos cambian entre versiones de matplotlib)
            pass
        axis.label.set_color(pal["ink2"])
        axis.label.set_size(10)
    ax.tick_params(colors=pal["muted"], labelsize=8.5)


def _with_alpha(hex_color: str, alpha: float) -> tuple[float, float, float, float]:
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, alpha)


def surface_cmap(pal: dict[str, str], theme: str) -> LinearSegmentedColormap:
    """Superficie neutra (pizarra): deja los colores con significado (azul, rojo, ámbar) a las curvas."""
    stops = ["#f1f5f8", "#c7d3de", "#8ea3b7"] if theme == "light" else ["#14243a", "#2a4560", "#4a6f8f"]
    return LinearSegmentedColormap.from_list("energia", stops)


def header(fig: Figure, pal: dict[str, str], title: str, subtitle: str = "") -> None:
    fig.text(0.04, 0.965, title, fontsize=15.5, fontweight="bold", color=pal["ink"], va="top", ha="left")
    if subtitle:
        fig.text(0.04, 0.915, subtitle, fontsize=10.5, color=pal["ink2"], va="top", ha="left")


def footer(fig: Figure, pal: dict[str, str], L: float, g: float) -> None:
    fig.text(0.04, 0.012, f"θ'' + (g/L) sen θ = 0     L = {L:.2f} m     g = {g:.2f} m/s²", fontsize=8.5, color=pal["muted"], va="bottom")
    fig.text(0.96, 0.012, "Oscilaciones · Laboratorio de EDO", fontsize=8.5, color=pal["muted"], va="bottom", ha="right")


def end_label(ax, x: float, y: float, text: str, color: str, dx: float = 0, dy: float = 0, size: float = 10) -> None:
    """Etiqueta directa sobre la curva (reemplaza a la leyenda)."""
    ax.annotate(text, (x, y), xytext=(dx, dy), textcoords="offset points", color=color, fontsize=size, fontweight="bold",
                va="center", ha="left" if dx >= 0 else "right")
