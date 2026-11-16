"""Física del péndulo. Módulo puro: sin red, sin disco, sin estado.

Ecuación real:      θ'' + (g/L) sin θ = 0
Aproximación lineal: θ'' + (g/L) θ     = 0   →  θ(t) = θ0 cos(ω0 t),  ω0 = sqrt(g/L)
Con θ(0) = θ0, θ'(0) = 0.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import pi, radians, sqrt

import numpy as np
from scipy.integrate import solve_ivp
from scipy.special import ellipj, ellipk


@dataclass(frozen=True)
class Params:
    theta0_deg: float = 90.0
    L: float = 1.0  # m
    g: float = 9.81  # m/s²

    @property
    def theta0(self) -> float:
        return radians(self.theta0_deg)

    @property
    def omega0(self) -> float:
        return sqrt(self.g / self.L)


def linear_period(L: float, g: float) -> float:
    """T0 = 2π sqrt(L/g). No depende de la amplitud."""
    return 2 * pi * sqrt(L / g)


def linear_solution(t: np.ndarray, p: Params) -> np.ndarray:
    """θ(t) = θ0 cos(ω0 t): solución analítica de la ecuación lineal."""
    return p.theta0 * np.cos(p.omega0 * t)


def exact_period(p: Params) -> float:
    """Período exacto del péndulo real: T = 4 sqrt(L/g) K(m), m = sin²(θ0/2)."""
    m = np.sin(p.theta0 / 2) ** 2
    return float(4 * sqrt(p.L / p.g) * ellipk(m))


def exact_solution(t: np.ndarray, p: Params) -> np.ndarray:
    """θ(t) exacta del péndulo real con funciones elípticas de Jacobi.

    sin(θ/2) = k · sn(K + ω0 t | m), con k = sin(θ0/2) y m = k².
    """
    m = np.sin(p.theta0 / 2) ** 2
    K = ellipk(m)
    sn, _, _, _ = ellipj(K + p.omega0 * np.asarray(t), m)
    return 2 * np.arcsin(np.sqrt(m) * sn)


def _rhs(_t: float, y: np.ndarray, w2: float) -> list[float]:
    return [y[1], -w2 * np.sin(y[0])]


def numeric_solution(t: np.ndarray, p: Params) -> np.ndarray:
    """Integra numéricamente θ'' + (g/L) sin θ = 0 como sistema de primer orden."""
    sol = solve_ivp(
        _rhs, (0.0, float(t[-1])), [p.theta0, 0.0], t_eval=t,
        args=(p.g / p.L,), method="DOP853", rtol=1e-11, atol=1e-12,
    )
    return sol.y[0]


def measured_period(p: Params) -> float:
    """Período medido numéricamente: la velocidad vuelve a cero a los T/2."""

    def v_zero(_t: float, y: np.ndarray, _w2: float) -> float:
        return y[1]

    v_zero.terminal = True  # type: ignore[attr-defined]
    v_zero.direction = 1.0  # type: ignore[attr-defined]
    guess = 6 * linear_period(p.L, p.g)
    sol = solve_ivp(
        _rhs, (0.0, guess), [p.theta0, 0.0], events=v_zero,
        args=(p.g / p.L,), method="DOP853", rtol=1e-11, atol=1e-12,
    )
    if sol.t_events[0].size == 0:
        return float("nan")
    return float(2 * sol.t_events[0][0])


def period_error_percent(p: Params) -> float:
    """Error relativo (%) de usar T0 en vez del período real."""
    T = exact_period(p)
    return 100.0 * abs(T - linear_period(p.L, p.g)) / T


def threshold_angle(percent: float = 1.0, L: float = 1.0, g: float = 9.81) -> float:
    """Ángulo (°) a partir del cual el error del período supera `percent` %. Bisección."""
    lo, hi = 0.1, 170.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if period_error_percent(Params(mid, L, g)) > percent:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def daily_clock_drift_seconds(p: Params) -> float:
    """Segundos que atrasa por día un reloj calibrado para amplitud pequeña (T0)
    si realmente oscila con amplitud θ0 (período T > T0)."""
    T = exact_period(p)
    return 86400.0 * (1.0 - linear_period(p.L, p.g) / T)
