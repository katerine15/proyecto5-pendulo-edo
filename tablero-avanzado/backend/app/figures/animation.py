"""Animación 3D en cámara lenta: dos péndulos lado a lado, soltados a la vez, con estela y cámara que orbita despacio.

El tiempo de la animación avanza `slow` veces más despacio que el real (slow = 0.25 → cuatro veces más lento),
así el desfase entre el lineal y el real se ve cuadro a cuadro.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
from matplotlib.animation import FuncAnimation, PillowWriter
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

from app.core.pendulum import Params, exact_solution, linear_period, exact_period, linear_solution
from app.figures.style import new_figure, palette, style_axes_3d

ROD = 2.6
PIVOT_X = 2.1
FLOOR = -3.9
TRAIL = 42


def animation_gif(p: Params, theme: str = "light", slow: float = 0.25, seconds: float = 8.0, fps: int = 20,
                  dpi: int = 80) -> bytes:
    if not 0.05 <= slow <= 1.0:
        raise ValueError("slow debe estar entre 0.05 y 1")
    n = int(round(seconds * fps))
    if not 8 <= n <= 260:
        raise ValueError("la animación debe tener entre 8 y 260 cuadros (seconds × fps)")
    pal = palette(theme)
    T0, T = linear_period(p.L, p.g), exact_period(p)

    t_frames = np.arange(n) / fps * slow  # tiempo simulado de cada cuadro
    tau = 0.55 * T0  # cuánto pasado dibuja la estela (en tiempo simulado)
    offs = np.linspace(0, tau, TRAIL)

    def pos(theta: np.ndarray, cx: float):
        return cx + ROD * np.sin(theta), np.zeros_like(theta), -ROD * np.cos(theta)

    fig = new_figure(theme, (8.0, 4.6), dpi)
    ax = fig.add_subplot(111, projection="3d", position=(-0.06, -0.12, 1.12, 1.18), computed_zorder=False)
    style_axes_3d(ax, pal)
    ax.set_axis_off()
    ax.set_xlim(-5.2, 5.2)
    ax.set_ylim(-1.6, 1.6)
    ztop = max(0.9, -ROD * np.cos(p.theta0) + 0.6)  # a ángulos grandes el péndulo sube por encima del soporte
    ax.set_zlim(FLOOR, ztop)
    ax.set_box_aspect((10.4, 3.2, 4.8 * (ztop - FLOOR) / (0.9 - FLOOR)))

    # Escenario: suelo con cuadrícula, soporte y arcos de ±90°.
    for x in np.arange(-5, 5.1, 1.0):
        ax.plot([x, x], [-1.6, 1.6], [FLOOR, FLOOR], color=pal["grid_strong"], lw=0.7, alpha=0.9, zorder=0)
    for y in np.arange(-1.5, 1.6, 0.75):
        ax.plot([-5.2, 5.2], [y, y], [FLOOR, FLOOR], color=pal["grid_strong"], lw=0.7, alpha=0.9, zorder=0)
    ax.plot([-5.0, 5.0], [0, 0], [0, 0], color=pal["ink"], lw=5, solid_capstyle="round", zorder=2)
    for x in (-5.0, 5.0):
        ax.plot([x, x], [0, 0], [FLOOR, 0], color=pal["ink2"], lw=4, solid_capstyle="round", zorder=1)
    arc = np.linspace(-np.pi / 2, np.pi / 2, 90)
    for cx in (-PIVOT_X, PIVOT_X):
        ax.plot(cx + ROD * np.sin(arc), np.zeros_like(arc), -ROD * np.cos(arc), color=pal["rule"], lw=1.1, ls=(0, (4, 4)), zorder=1)

    rigs = []
    for kind, cx, color in (("lin", -PIVOT_X, pal["lin"]), ("real", PIVOT_X, pal["real"])):
        (rod,) = ax.plot([cx, cx], [0, 0], [0, -ROD], color=pal["ink"], lw=2.2, zorder=4)
        (trail,) = ax.plot([], [], [], color=color, lw=2.6, alpha=0.55, zorder=3)
        (bob,) = ax.plot([cx], [0], [-ROD], "o", ms=20, color=color, mec=pal["ink"], mew=1.8, zorder=6)
        (shadow,) = ax.plot([cx], [0], [FLOOR], "o", ms=14, color=pal["ink"], alpha=0.16, mew=0, zorder=1)
        (piv,) = ax.plot([cx], [0], [0], "o", ms=7, color=pal["ink"], zorder=5)
        ax.text(cx, 0.9, FLOOR - 0.15, "Modelo lineal" if kind == "lin" else "Péndulo real", color=color, fontsize=11, fontweight="bold",
                ha="center", zorder=7)
        rigs.append((kind, cx, rod, trail, bob, shadow))
    th0 = p.theta0
    for cx, color in ((-PIVOT_X, pal["lin"]), (PIVOT_X, pal["real"])):  # marca del ángulo de suelta
        ax.plot([cx + ROD * np.sin(th0)], [0], [-ROD * np.cos(th0)], "o", ms=8, mfc=pal["paper"], mec=color, mew=1.6, zorder=2)

    clock = fig.text(0.035, 0.93, "", fontsize=11, color=pal["ink"], fontweight="bold", va="top")
    info = fig.text(0.035, 0.865, "", fontsize=9.5, color=pal["ink2"], va="top")
    fig.text(0.965, 0.93, f"CÁMARA LENTA  {slow:g}×", fontsize=10, color=pal["warn"], fontweight="bold", va="top", ha="right")
    fig.text(0.965, 0.865, f"θ₀ = {p.theta0_deg:g}°   T₀ = {T0:.3f} s   T = {T:.3f} s", fontsize=9.5, color=pal["muted"], va="top", ha="right")

    def update(k: int):
        tk = t_frames[k]
        for kind, cx, rod, trail, bob, shadow in rigs:
            fn = linear_solution if kind == "lin" else exact_solution
            th = fn(np.array([tk]), p)[0]
            x, _, z = pos(np.array([th]), cx)
            rod.set_data_3d([cx, x[0]], [0, 0], [0, z[0]])
            bob.set_data_3d([x[0]], [0], [z[0]])
            shadow.set_data_3d([x[0]], [0], [FLOOR])
            tt = np.maximum(tk - offs, 0.0)
            xs, ys, zs = pos(fn(tt, p), cx)
            trail.set_data_3d(xs, ys, zs)
        ax.view_init(elev=13, azim=-76 + 14 * (0.5 - 0.5 * np.cos(np.pi * k / max(n - 1, 1))))  # órbita lenta, con suavizado
        clock.set_text(f"t = {tk:5.2f} s")
        info.set_text(f"ciclos: lineal {tk / T0:4.2f}   ·   real {tk / T:4.2f}")
        return ()

    anim = FuncAnimation(fig, update, frames=n, interval=1000 / fps, blit=False)
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "a.gif"
        anim.save(path, writer=PillowWriter(fps=fps), dpi=dpi)
        return path.read_bytes()
