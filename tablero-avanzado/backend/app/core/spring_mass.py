"""Masa-resorte amortiguada: m x'' + c x' + k x = 0, x(0) = x0, x'(0) = v0. Módulo puro.

Ecuación característica: m r² + c r + k = 0.  ζ = c / (2 sqrt(m k)),  ωn = sqrt(k/m).
  ζ < 1  subamortiguado:        x = e^(-αt) [x0 cos ωd t + (v0 + α x0)/ωd · sin ωd t],  α = c/2m, ωd = ωn sqrt(1-ζ²)
  ζ = 1  críticamente amortig.: x = (x0 + (v0 + α x0) t) e^(-αt)
  ζ > 1  sobreamortiguado:      x = C1 e^(r1 t) + C2 e^(r2 t),  r1,2 = -α ± sqrt(α² - ωn²)
"""
from __future__ import annotations

from dataclasses import dataclass
from math import pi, sqrt

import numpy as np
from scipy.integrate import solve_ivp

CRITICAL_TOL = 1e-9


@dataclass(frozen=True)
class Params:
    m: float = 1.0   # kg
    c: float = 0.4   # N·s/m
    k: float = 4.0   # N/m
    x0: float = 1.0  # m
    v0: float = 0.0  # m/s

    @property
    def omega_n(self) -> float:
        return sqrt(self.k / self.m)

    @property
    def zeta(self) -> float:
        return self.c / (2 * sqrt(self.m * self.k))

    @property
    def alpha(self) -> float:
        return self.c / (2 * self.m)


def regime(p: Params) -> str:
    """'subamortiguado' | 'crítico' | 'sobreamortiguado' (por el discriminante c² − 4mk)."""
    disc = p.c**2 - 4 * p.m * p.k
    if abs(disc) <= CRITICAL_TOL * max(p.c**2, 4 * p.m * p.k, 1e-12):
        return "crítico"
    return "subamortiguado" if disc < 0 else "sobreamortiguado"


def exact_solution(t: np.ndarray, p: Params) -> np.ndarray:
    t = np.asarray(t, dtype=float)
    a, reg = p.alpha, regime(p)
    if reg == "subamortiguado":
        wd = p.omega_n * sqrt(1 - p.zeta**2)
        return np.exp(-a * t) * (p.x0 * np.cos(wd * t) + (p.v0 + a * p.x0) / wd * np.sin(wd * t))
    if reg == "crítico":
        return (p.x0 + (p.v0 + a * p.x0) * t) * np.exp(-a * t)
    s = sqrt(a**2 - p.omega_n**2)
    r1, r2 = -a + s, -a - s
    c1 = (p.v0 - r2 * p.x0) / (r1 - r2)
    return c1 * np.exp(r1 * t) + (p.x0 - c1) * np.exp(r2 * t)


def numeric_solution(t: np.ndarray, p: Params) -> np.ndarray:
    """Integra el sistema u' = v, v' = −(c v + k u)/m."""

    def rhs(_t: float, y: np.ndarray) -> list[float]:
        return [y[1], -(p.c * y[1] + p.k * y[0]) / p.m]

    sol = solve_ivp(rhs, (0.0, float(t[-1])), [p.x0, p.v0], t_eval=t,
                    method="DOP853", rtol=1e-11, atol=1e-12)
    return sol.y[0]


def damped_period(p: Params) -> float | None:
    """Período de la oscilación amortiguada 2π/ωd (solo subamortiguado)."""
    if regime(p) != "subamortiguado":
        return None
    return 2 * pi / (p.omega_n * sqrt(1 - p.zeta**2))


def _time_grid(p: Params, n: int = 60001) -> np.ndarray:
    """Malla de tiempo lo bastante larga para que la respuesta se asiente (el decaimiento lo manda la raíz más lenta)."""
    slow = p.alpha - sqrt(p.alpha**2 - p.omega_n**2) if regime(p) == "sobreamortiguado" else p.alpha
    return np.linspace(0.0, 25.0 / slow, n)


def settling_time(p: Params, frac: float = 0.02) -> float | None:
    """Tiempo de asentamiento como lo define la guía: el instante a partir del cual |x| queda por debajo del
    `frac` (2 %) de la amplitud inicial |x0|. Se mide sobre la solución exacta, no con la fórmula aproximada 4/α."""
    if p.c == 0:
        return None
    t = _time_grid(p)
    x = np.abs(exact_solution(t, p))
    ref = abs(p.x0) if p.x0 != 0 else float(x.max())
    if ref == 0:
        return 0.0
    outside = np.flatnonzero(x > frac * ref)
    return 0.0 if outside.size == 0 else float(t[min(outside[-1] + 1, len(t) - 1)])


def overshoot_percent(p: Params) -> float:
    """Sobreimpulso: cuánto pasa del equilibrio hacia el otro lado, en % de |x0| (0 si no cruza)."""
    if p.c == 0:
        return 100.0
    t = _time_grid(p)
    x = exact_solution(t, p)
    ref = abs(p.x0) if p.x0 != 0 else float(np.abs(x).max())
    if ref == 0:
        return 0.0
    sign = 1.0 if p.x0 >= 0 else -1.0
    return float(max(0.0, -(sign * x).min()) / ref * 100)
