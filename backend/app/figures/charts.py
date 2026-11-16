"""Figuras 2D. Cada función recibe los parámetros y el tema y devuelve un `Figure` listo para guardar (PNG o SVG)."""
from __future__ import annotations

import numpy as np
from matplotlib.figure import Figure
from scipy.special import ellipk

from app.core.integrators import energy_drift, pendulum_rhs, rk4
from app.core.pendulum import Params, exact_solution, linear_period, linear_solution, threshold_angle
from app.figures.style import end_label, footer, header, new_figure, palette, style_axes

ANGLES = (10, 45, 90, 150)
deg = np.degrees


def _T(theta0_deg: np.ndarray, L: float, g: float) -> np.ndarray:
    """Período exacto (vectorizado): T = 4 sqrt(L/g) K(sen²(θ₀/2))."""
    return 4 * np.sqrt(L / g) * ellipk(np.sin(np.radians(theta0_deg) / 2) ** 2)


def verificacion(p: Params, theme: str, dpi: int = 160) -> Figure:
    pal = palette(theme)
    h = 2e-3
    y0 = np.array([p.theta0, 0.0])
    t, YL = rk4(pendulum_rhs(p.g, p.L, linear=True), y0, 0.0, 10.0, h)
    _, YR = rk4(pendulum_rhs(p.g, p.L), y0, 0.0, 10.0, h)
    lin_exact, real_exact = linear_solution(t, p), exact_solution(t, p)
    d_lin, d_real = np.abs(YL[:, 0] - lin_exact), np.abs(YR[:, 0] - real_exact)

    fig = new_figure(theme, (10.5, 7.0), dpi)
    header(fig, pal, "La simulación coincide con la solución exacta",
           f"RK4 con h = {h * 1000:.0f} ms. Diferencia máxima: {d_lin.max():.1e} rad (lineal) y {d_real.max():.1e} rad (real).")
    ax = fig.add_axes((0.08, 0.37, 0.88, 0.47))
    ax2 = fig.add_axes((0.08, 0.10, 0.88, 0.19), sharex=ax)
    for a in (ax, ax2):
        style_axes(a, pal)
    ax.plot(t, deg(lin_exact), color=pal["lin"], lw=7, alpha=0.28, solid_capstyle="round")
    ax.plot(t, deg(YL[:, 0]), color=pal["lin"], lw=1.4, ls=(0, (4, 3)))
    ax.plot(t, deg(real_exact), color=pal["real"], lw=7, alpha=0.26, solid_capstyle="round")
    ax.plot(t, deg(YR[:, 0]), color=pal["real"], lw=1.4, ls=(0, (4, 3)))
    ax.set_ylabel("Ángulo θ (°)")
    plt_hide_x(ax)
    fig.text(0.04, 0.878, "trazo ancho: solución exacta   ·   trazo fino punteado: simulación RK4   ·   azul: lineal   ·   rojo: real",
             fontsize=9.5, color=pal["muted"], va="top")
    end_label(ax, t[-1], deg(lin_exact[-1]), " lineal", pal["lin"], 6, 0)
    end_label(ax, t[-1], deg(real_exact[-1]), " real", pal["real"], 6, 0)
    ax2.semilogy(t[1:], np.maximum(d_lin[1:], 1e-17), color=pal["lin"], lw=1.4)
    ax2.semilogy(t[1:], np.maximum(d_real[1:], 1e-17), color=pal["real"], lw=1.4)
    ax2.set_ylim(1e-15, 1e-8)
    ax2.set_ylabel("|dif.| (rad)")
    ax2.set_xlabel("Tiempo t (s)")
    ax.set_xlim(0, 10.9)
    footer(fig, pal, p.L, p.g)
    return fig


def plt_hide_x(ax) -> None:
    ax.tick_params(labelbottom=False)


def comparacion(p: Params, theme: str, dpi: int = 160) -> Figure:
    pal = palette(theme)
    fig = new_figure(theme, (11.5, 7.6), dpi)
    header(fig, pal, "El péndulo real se atrasa respecto del lineal",
           "Mismo ángulo de suelta y mismo instante: cuanto mayor la amplitud, antes se desfasan.")
    t = np.linspace(0, 10, 900)
    T0 = linear_period(p.L, p.g)
    for k, a in enumerate(ANGLES):
        ax = fig.add_axes((0.075 + (k % 2) * 0.47, 0.50 - (k // 2) * 0.40, 0.42, 0.30))
        style_axes(ax, pal)
        q = Params(a, p.L, p.g)
        lin, real = deg(linear_solution(t, q)), deg(exact_solution(t, q))
        ax.fill_between(t, lin, real, color=pal["real"], alpha=0.10, lw=0)
        ax.plot(t, lin, color=pal["lin"], lw=2)
        ax.plot(t, real, color=pal["real"], lw=2)
        T = float(_T(np.array([a]), p.L, p.g)[0])
        ax.set_title(f"θ₀ = {a}°", loc="left", fontsize=11.5, fontweight="bold", color=pal["ink"], pad=6)
        ax.text(0.99, 1.04, f"T = {T:.4f} s   ·   error {100 * (T - T0) / T:.2f} %", transform=ax.transAxes, ha="right",
                fontsize=9.5, color=pal["ink2"])
        ax.set_xlim(0, 10)
        if k >= 2:
            ax.set_xlabel("Tiempo t (s)")
        else:
            ax.tick_params(labelbottom=False)
        if k % 2 == 0:
            ax.set_ylabel("Ángulo θ (°)")
    fig.text(0.04, 0.878, "azul: modelo lineal   ·   rojo: péndulo real   ·   sombra: diferencia entre ambos", fontsize=9.5,
             color=pal["muted"], va="top")
    footer(fig, pal, p.L, p.g)
    return fig


def error_periodo(p: Params, theme: str, dpi: int = 160) -> Figure:
    pal = palette(theme)
    ang = np.linspace(1, 170, 400)
    T0 = linear_period(p.L, p.g)
    T = _T(ang, p.L, p.g)
    e_T, e_T0 = 100 * (T - T0) / T, 100 * (T - T0) / T0
    thr = threshold_angle(1.0, p.L, p.g)

    fig = new_figure(theme, (11.5, 5.6), dpi)
    header(fig, pal, f"La aproximación lineal sirve hasta unos {thr:.0f}°",
           f"El error del período, (T − T₀)/T, supera el 1 % a partir de {thr:.1f}°. Se muestra también (T − T₀)/T₀.")
    for k, (xmax, ymax, title) in enumerate(((170, 60, "1° a 170°"), (40, 3.2, "Zoom: 1° a 40°"))):
        ax = fig.add_axes((0.075 + k * 0.47, 0.14, 0.42, 0.66))
        style_axes(ax, pal)
        m = ang <= xmax
        ax.axhspan(0, 1, color=pal["ok"], alpha=0.10, lw=0)
        ax.plot(ang[m], e_T[m], color=pal["real"], lw=2.6)
        ax.plot(ang[m], e_T0[m], color=pal["muted"], lw=1.6, ls=(0, (5, 3)))
        ax.axhline(1, color=pal["warn"], lw=1.2, ls=(0, (6, 4)))
        ax.axvline(thr, color=pal["warn"], lw=1.2, ls=(0, (2, 3)))
        if thr <= xmax:
            ax.annotate(f"umbral {thr:.1f}°", (thr, ymax), xytext=(6, -14), textcoords="offset points", color=pal["warn"],
                        fontsize=10, fontweight="bold")
        if p.theta0_deg <= xmax:
            ax.axvline(p.theta0_deg, color=pal["ink"], lw=1.0, alpha=0.45)
            ax.annotate(f"θ₀ = {p.theta0_deg:g}°", (p.theta0_deg, ymax), xytext=(6, -14), textcoords="offset points",
                        color=pal["ink2"], fontsize=9.5)
        ax.set_xlim(0, xmax)
        ax.set_ylim(0, ymax)
        ax.set_xlabel("Ángulo de suelta θ₀ (°)")
        ax.set_ylabel("Error del período (%)")
        ax.set_title(title, loc="left", fontsize=10.5, color=pal["ink2"], pad=6)
        if k == 0:
            for a in ANGLES:
                v = float(100 * (_T(np.array([a]), p.L, p.g)[0] - T0) / _T(np.array([a]), p.L, p.g)[0])
                ax.plot([a], [v], "o", ms=6.5, color=pal["paper"], mec=pal["real"], mew=2, zorder=5)
                ax.annotate(f"{v:.1f} %", (a, v), xytext=(-9, 9), textcoords="offset points", ha="right", fontsize=9, color=pal["ink2"])
            xl = 128
            end_label(ax, xl, float(np.interp(xl, ang, e_T0)), "(T − T₀)/T₀", pal["muted"], -8, 14, 9.5)
            end_label(ax, xl, float(np.interp(xl, ang, e_T)), "(T − T₀)/T", pal["real"], 10, -14, 9.5)
    footer(fig, pal, p.L, p.g)
    return fig


def fases(p: Params, theme: str, dpi: int = 160) -> Figure:
    pal = palette(theme)
    w2 = p.g / p.L

    def real(a_deg: float):
        a0 = np.radians(a_deg)
        phi = np.linspace(0, 2 * np.pi, 361)
        th = a0 * np.cos(phi)
        w = np.sqrt(np.maximum(0, 2 * w2 * (np.cos(th) - np.cos(a0))))
        return deg(th), deg(np.where(np.sin(phi) < 0, w, -w))

    fig = new_figure(theme, (10, 7.2), dpi)
    header(fig, pal, "Espacio de fases: el péndulo real recorre curvas de energía constante",
           "La elipse es el modelo lineal; a ángulos grandes la curva real se acerca a la separatriz (±180°).")
    ax = fig.add_axes((0.09, 0.09, 0.87, 0.77))
    style_axes(ax, pal)
    for a in (30, 60, 120, 150, 170):
        if abs(a - p.theta0_deg) > 4:
            x, y = real(a)
            ax.plot(x, y, color=pal["grid_strong"], lw=1.2)
    th = np.linspace(-np.pi, np.pi, 361)
    wsep = deg(2 * np.sqrt(w2) * np.cos(th / 2))
    ax.plot(deg(th), wsep, color=pal["warn"], lw=1.6, ls=(0, (6, 4)))
    ax.plot(deg(th), -wsep, color=pal["warn"], lw=1.6, ls=(0, (6, 4)))
    a0 = p.theta0
    ph = np.linspace(0, 2 * np.pi, 361)
    ax.fill(deg(a0 * np.cos(ph)), deg(-np.sqrt(w2) * a0 * np.sin(ph)), color=pal["lin"], alpha=0.07, lw=0)
    ax.plot(deg(a0 * np.cos(ph)), deg(-np.sqrt(w2) * a0 * np.sin(ph)), color=pal["lin"], lw=2.4)
    x, y = real(p.theta0_deg)
    ax.plot(x, y, color=pal["real"], lw=2.6)
    ax.plot([p.theta0_deg, -p.theta0_deg], [0, 0], "o", ms=7, color=pal["paper"], mec=pal["ink"], mew=2, zorder=6)
    end_label(ax, 0, wsep[180] * 1.0, "  separatriz", pal["warn"], 6, 8, 10)
    end_label(ax, -p.theta0_deg, 0, "lineal ", pal["lin"], -12, 22, 10)
    end_label(ax, p.theta0_deg, 0, " real", pal["real"], 12, 22, 10)
    ax.set_xlim(-195, 195)
    ym = float(wsep.max() * 1.12)
    ax.set_ylim(-ym, ym)
    ax.set_xlabel("Ángulo θ (°)")
    ax.set_ylabel("Velocidad angular ω (°/s)")
    footer(fig, pal, p.L, p.g)
    return fig


def serie_periodo(p: Params, theme: str, dpi: int = 160) -> Figure:
    pal = palette(theme)
    ang = np.linspace(1, 150, 300)
    a = np.radians(ang)
    exact = _T(ang, 1.0, 1.0) / (2 * np.pi)
    s2, s4 = 1 + a**2 / 16, 1 + a**2 / 16 + 11 * a**4 / 3072
    s6 = s4 + 173 * a**6 / 737280
    fig = new_figure(theme, (10, 6.0), dpi)
    header(fig, pal, "El período crece con la amplitud",
           "T/T₀ ≈ 1 + θ₀²/16 + 11θ₀⁴/3072 + 173θ₀⁶/737280 + …  Cada término se acerca más a la curva exacta.")
    ax = fig.add_axes((0.08, 0.12, 0.87, 0.72))
    style_axes(ax, pal)
    ax.plot(ang, np.ones_like(ang), color=pal["lin"], lw=2.2)
    ax.plot(ang, s2, color=pal["warn"], lw=1.6, ls=(0, (5, 3)))
    ax.plot(ang, s4, color=pal["bad"], lw=1.6, ls=(0, (5, 3)))
    ax.plot(ang, s6, color=pal["ink2"], lw=1.6, ls=(0, (2, 3)))
    ax.plot(ang, exact, color=pal["real"], lw=3)
    ax.set_xlim(0, 168)
    ax.set_ylim(0.98, 2.4)
    for txt, y, c in (("exacto", exact[-1], pal["real"]), ("orden 6", s6[-1], pal["ink2"]), ("orden 4", s4[-1], pal["bad"]),
                      ("orden 2", s2[-1], pal["warn"]), ("lineal (T = T₀)", 1.0, pal["lin"])):
        end_label(ax, 150, min(y, 2.36), "  " + txt, c, 4, 0, 9.5)
    ax.set_xlabel("Ángulo de suelta θ₀ (°)")
    ax.set_ylabel("Razón T / T₀")
    footer(fig, pal, p.L, p.g)
    return fig


def energia(p: Params, theme: str, dpi: int = 160) -> Figure:
    pal = palette(theme)
    fig = new_figure(theme, (10.5, 6.0), dpi)
    runs = {m: energy_drift(m, p.theta0, p.g, p.L, 0.05, 50.0) for m in ("euler", "symplectic", "rk4")}
    growth = runs["euler"][1][-1]
    header(fig, pal, "Conservación de la energía a lo largo de 50 s",
           f"Euler explícito la hace crecer (×{growth:.1f}); Euler simpléctico la mantiene acotada; RK4 casi no deriva. h = 0.05 s.")
    ax = fig.add_axes((0.08, 0.12, 0.70, 0.72))
    style_axes(ax, pal)
    spec = {"euler": ("Euler explícito", pal["bad"]), "symplectic": ("Euler simpléctico", pal["lin"]), "rk4": ("Runge–Kutta 4", pal["exact"])}
    for m, (t, rel) in runs.items():
        label, color = spec[m]
        ax.semilogy(t[1:], np.maximum(rel[1:], 1e-16), color=color, lw=2.2)
        end_label(ax, t[-1], max(rel[-1], 1e-16), "  " + label, color, 4, 0, 9.5)
    ax.set_xlim(0, 50)
    ax.set_xlabel("Tiempo t (s)")
    ax.set_ylabel("Deriva relativa de la energía |ΔE/E₀|")
    footer(fig, pal, p.L, p.g)
    return fig
