"""Tabla de períodos de la guía: medido con RK4 (v = 0), exacto (elíptica) y error con las dos convenciones."""
from __future__ import annotations

import numpy as np

from app.core.integrators import measure_period_rk4
from app.core.pendulum import Params, exact_period, linear_period

ANGLES = (10, 45, 90, 150)
HEADER = ["theta0_grados", "T_medido_RK4_s", "T_exacto_s", "T0_lineal_s", "error_vs_T_pct", "error_vs_T0_pct"]


def period_table(L: float = 1.0, g: float = 9.81, angles: tuple[float, ...] = ANGLES) -> list[dict[str, float]]:
    T0 = linear_period(L, g)
    rows = []
    for a in angles:
        T_rk4 = measure_period_rk4(float(np.radians(a)), g, L)
        T_ex = exact_period(Params(a, L, g))
        rows.append({
            "theta0_grados": a, "T_medido_RK4_s": T_rk4, "T_exacto_s": T_ex, "T0_lineal_s": T0,
            "error_vs_T_pct": 100 * (T_rk4 - T0) / T_rk4, "error_vs_T0_pct": 100 * (T_rk4 - T0) / T0,
        })
    return rows


def to_csv(rows: list[dict[str, float]]) -> str:
    lines = [",".join(HEADER)]
    for r in rows:
        lines.append(",".join(f"{r[h]:g}" if h == "theta0_grados" else f"{r[h]:.4f}" for h in HEADER))
    return "\n".join(lines) + "\n"
