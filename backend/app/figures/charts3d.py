"""Figuras 3D (matplotlib mplot3d): el paisaje de energía y la trayectoria en el espacio θ–ω–t."""
from __future__ import annotations

import numpy as np
from matplotlib.figure import Figure
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401  (registra la proyección '3d')

from app.core.pendulum import Params, exact_period, exact_solution, linear_period, linear_solution
from app.figures.style import footer, header, new_figure, palette, style_axes_3d, surface_cmap

deg = np.degrees


def paisaje_energia(p: Params, theme: str, dpi: int = 160) -> Figure:
    """E(θ, ω) del péndulo real (superficie) contra la del modelo lineal (paraboloide en malla)."""
    pal = palette(theme)
    w2 = p.g / p.L
    wmax = 2 * np.sqrt(w2) * 1.12
    zmax = 4.6 * w2
    th = np.linspace(-np.radians(200), np.radians(200), 150)
    w = np.linspace(-wmax, wmax, 150)
    TH, W = np.meshgrid(th, w)
    Z_real = 0.5 * W**2 + w2 * (1 - np.cos(TH))
    Z_lin = 0.5 * W**2 + 0.5 * w2 * TH**2
    Z_lin = np.where(Z_lin <= zmax, Z_lin, np.nan)

    fig = new_figure(theme, (10.5, 8.0), dpi)
    header(fig, pal, "Paisaje de energía: dónde el modelo lineal deja de parecerse al real",
           "La superficie es la energía del péndulo real; la malla azul, la del modelo lineal (un paraboloide). Se separan a ángulos grandes.")
    ax = fig.add_subplot(111, projection="3d", position=(0.0, 0.03, 1.0, 0.84), computed_zorder=False)
    style_axes_3d(ax, pal)
    cmap = surface_cmap(pal, theme)
    ax.plot_surface(deg(TH), deg(W), Z_real, cmap=cmap, alpha=0.80, linewidth=0, antialiased=True, rstride=2, cstride=2,
                    vmin=0, vmax=zmax, zorder=1)
    ax.plot_wireframe(deg(TH), deg(W), Z_lin, color=pal["lin"], alpha=0.55, linewidth=0.7, rstride=7, cstride=7, zorder=2)

    # Separatriz: E = 2 g/L sobre la superficie real.
    ts = np.linspace(-np.pi, np.pi, 240)
    ws = 2 * np.sqrt(w2) * np.cos(ts / 2)
    for sgn in (1, -1):
        ax.plot(deg(ts), sgn * deg(ws), np.full_like(ts, 2 * w2) + 0.03 * w2, color=pal["warn"], lw=2.4, ls=(0, (5, 3)), zorder=5)

    # Órbitas elevadas a su nivel de energía.
    a0 = p.theta0
    phi = np.linspace(0, 2 * np.pi, 361)
    th_r = a0 * np.cos(phi)
    w_r = np.sqrt(np.maximum(0, 2 * w2 * (np.cos(th_r) - np.cos(a0))))
    w_r = np.where(np.sin(phi) < 0, w_r, -w_r)
    E_r = w2 * (1 - np.cos(a0))
    ax.plot(deg(th_r), deg(w_r), np.full_like(phi, E_r) + 0.10 * w2, color=pal["real"], lw=3.6, zorder=6)
    E_l = 0.5 * w2 * a0**2
    ax.plot(deg(a0 * np.cos(phi)), deg(-np.sqrt(w2) * a0 * np.sin(phi)), np.full_like(phi, E_l) + 0.10 * w2, color=pal["lin"], lw=3.6, zorder=6)
    ax.plot([p.theta0_deg], [0], [E_r + 0.10 * w2], "o", ms=8, color=pal["paper"], mec=pal["real"], mew=2.2, zorder=7)

    ax.set_xlabel("Ángulo θ (°)", labelpad=8)
    ax.set_ylabel("Velocidad ω (°/s)", labelpad=8)
    ax.set_zlabel("Energía E (1/s²)", labelpad=4)
    ax.set_zlim(0, zmax)
    ax.set_box_aspect((1.35, 1.1, 0.95))
    ax.view_init(elev=24, azim=-56)
    footer(fig, pal, p.L, p.g)
    fig.text(0.04, 0.878, "rojo: péndulo real   ·   azul: modelo lineal   ·   ámbar: separatriz (E = 2g/L)", fontsize=9.5, color=pal["muted"], va="top")
    return fig


def espacio_tiempo(p: Params, theme: str, dpi: int = 160) -> Figure:
    """Trayectorias (θ, ω, t): el real tarda más en cerrar cada vuelta; los marcadores lo muestran en la vertical."""
    pal = palette(theme)
    T0, T = linear_period(p.L, p.g), exact_period(p)
    t_end = 4.2 * T0
    t = np.linspace(0, t_end, 1600)
    th_r = exact_solution(t, p)
    w_r = np.gradient(th_r, t)
    w0 = np.sqrt(p.g / p.L)
    th_l = linear_solution(t, p)
    w_l = -w0 * p.theta0 * np.sin(w0 * t)

    fig = new_figure(theme, (10.5, 8.0), dpi)
    header(fig, pal, "Trayectoria en el espacio θ–ω–t: el real se atrasa",
           f"Cada vuelta completa devuelve el péndulo al punto de partida: el lineal en k·{T0:.3f} s; el real, en k·{T:.3f} s.")
    ax = fig.add_subplot(111, projection="3d", position=(0.0, 0.03, 1.0, 0.84), computed_zorder=False)
    style_axes_3d(ax, pal)
    ax.plot(deg(th_l), deg(w_l), np.zeros_like(t), color=pal["lin"], lw=1.2, alpha=0.35, zorder=1)  # proyección en el suelo
    ax.plot(deg(th_r), deg(w_r), np.zeros_like(t), color=pal["real"], lw=1.2, alpha=0.35, zorder=1)
    ax.plot(deg(th_l), deg(w_l), t, color=pal["lin"], lw=2.8, zorder=3)
    ax.plot(deg(th_r), deg(w_r), t, color=pal["real"], lw=2.8, zorder=4)
    for k in range(1, 5):
        zl, zr = k * T0, k * T
        if zl <= t_end:
            ax.plot([p.theta0_deg], [0], [zl], "o", ms=7, color=pal["paper"], mec=pal["lin"], mew=2)
        if zr <= t_end:
            ax.plot([p.theta0_deg], [0], [zr], "o", ms=7, color=pal["paper"], mec=pal["real"], mew=2)
    ax.plot([p.theta0_deg] * 2, [0, 0], [0, t_end], color=pal["muted"], lw=0.8, ls=(0, (2, 3)))
    ax.set_xlabel("Ángulo θ (°)", labelpad=8)
    ax.set_ylabel("Velocidad ω (°/s)", labelpad=8)
    ax.set_zlabel("Tiempo t (s)", labelpad=4)
    ax.set_zlim(0, t_end)
    ax.set_box_aspect((1.1, 1.1, 1.25))
    ax.view_init(elev=22, azim=-52)
    footer(fig, pal, p.L, p.g)
    fig.text(0.04, 0.878, "azul: modelo lineal   ·   rojo: péndulo real   ·   círculos: vueltas completas   ·   curvas tenues: proyección en el plano de fases", fontsize=9.5, color=pal["muted"], va="top")
    return fig
