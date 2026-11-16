"""Integradores numéricos explícitos del péndulo. Módulo puro.

Un integrador no resuelve una ecuación de segundo orden directamente: se convierte en un sistema de primer orden
con u = θ y v = θ'. Aquí F(t, y) devuelve y' para y = [u, v].
"""
from __future__ import annotations

from collections.abc import Callable

import numpy as np

RHS = Callable[[float, np.ndarray], np.ndarray]
METHODS = ("euler", "symplectic", "rk4")


def rk4(F: RHS, y0: np.ndarray, t0: float, tf: float, h: float) -> tuple[np.ndarray, np.ndarray]:
    """Runge–Kutta de orden 4 (el de la guía). Devuelve (t, Y) con Y de forma (len(t), len(y0))."""
    n = int(round((tf - t0) / h))
    t = t0 + h * np.arange(n + 1)
    Y = np.empty((n + 1, len(y0)))
    Y[0] = y0
    for i in range(n):
        y, ti = Y[i], t[i]
        k1 = F(ti, y)
        k2 = F(ti + h / 2, y + h / 2 * k1)
        k3 = F(ti + h / 2, y + h / 2 * k2)
        k4 = F(ti + h, y + h * k3)
        Y[i + 1] = y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    return t, Y


def pendulum_rhs(g: float, L: float, linear: bool = False) -> RHS:
    """u' = v,  v' = −(g/L) sen u   (o −(g/L) u en el modelo lineal)."""
    w2 = g / L

    def F(_t: float, y: np.ndarray) -> np.ndarray:
        u, v = y
        return np.array([v, -w2 * (u if linear else np.sin(u))])

    return F


def measure_period_rk4(theta0_rad: float, g: float, L: float, h: float = 1e-3) -> float:
    """Período como en la guía: la velocidad vuelve a cero en T/2; se interpola el cruce de v por cero."""
    T0 = 2 * np.pi * np.sqrt(L / g)
    t, Y = rk4(pendulum_rhs(g, L), np.array([theta0_rad, 0.0]), 0.0, 6 * T0, h)
    v = Y[:, 1]
    idx = np.flatnonzero((v[:-1] < 0) & (v[1:] >= 0))
    if idx.size == 0:
        raise RuntimeError("No se encontró el cero de la velocidad: aumente el tiempo de integración")
    i = idx[0]
    return float(2 * (t[i] - v[i] * (t[i + 1] - t[i]) / (v[i + 1] - v[i])))


def energy(u: float, v: float, w2: float) -> float:
    """Energía específica ½ω² + (g/L)(1 − cos θ): constante en el péndulo real."""
    return 0.5 * v * v + w2 * (1 - np.cos(u))


def energy_drift(method: str, theta0_rad: float, g: float, L: float, h: float, t_end: float, every: int = 5):
    """Deriva relativa |ΔE/E₀| de un método ('euler' | 'symplectic' | 'rk4'). Devuelve (t, deriva)."""
    if method not in METHODS:
        raise ValueError(f"método desconocido: {method}")
    w2 = g / L
    f = pendulum_rhs(g, L)
    u, v = theta0_rad, 0.0
    E0 = energy(u, v, w2)
    ts, rel = [0.0], [0.0]
    n = int(round(t_end / h))
    for i in range(1, n + 1):
        if method == "euler":
            u, v = u + h * v, v - h * w2 * np.sin(u)
        elif method == "symplectic":
            v = v - h * w2 * np.sin(u)  # primero la velocidad, luego la posición con la velocidad nueva
            u = u + h * v
        else:
            _, Y = rk4(f, np.array([u, v]), 0.0, h, h)
            u, v = Y[1]
        if i % every == 0:
            ts.append(i * h)
            rel.append(abs((energy(u, v, w2) - E0) / E0))
    return np.array(ts), np.array(rel)
