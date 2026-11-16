"""Casos de uso. Orquestan el núcleo de física; no saben nada de HTTP."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np

from app.core import pendulum as pd
from app.core.pendulum import Params
from app.ml import surrogate

_SURROGATE = Path(__file__).resolve().parents[1] / "ml" / "surrogate.json"
REFERENCE_ANGLES = (10, 45, 90, 150)


@lru_cache(maxsize=1)
def _model():
    return surrogate.load(_SURROGATE)


def simulate(p: Params, t_max: float, n: int) -> dict:
    t = np.linspace(0.0, t_max, n)
    lin, num, ex = pd.linear_solution(t, p), pd.numeric_solution(t, p), pd.exact_solution(t, p)
    T0, T = pd.linear_period(p.L, p.g), pd.exact_period(p)
    return {
        "params": {"theta0_deg": p.theta0_deg, "L": p.L, "g": p.g},
        "t": t.tolist(),
        "theta_linear_deg": np.degrees(lin).tolist(),
        "theta_real_deg": np.degrees(num).tolist(),
        "theta_exact_deg": np.degrees(ex).tolist(),
        "T0": T0, "T_real": T, "T_measured": pd.measured_period(p),
        "period_error_pct": pd.period_error_percent(p),
        "max_gap_deg": float(np.degrees(np.max(np.abs(lin - num)))),
        "numeric_vs_exact_deg": float(np.degrees(np.max(np.abs(num - ex)))),
        "clock_drift_s_per_day": pd.daily_clock_drift_seconds(p),
    }


def period_table(angles: tuple[float, ...], L: float, g: float) -> list[dict]:
    rows = []
    for a in angles:
        p = Params(a, L, g)
        rows.append({"theta0_deg": a, "T0": pd.linear_period(L, g), "T_real": pd.exact_period(p),
                     "error_pct": pd.period_error_percent(p),
                     "clock_drift_s_per_day": pd.daily_clock_drift_seconds(p)})
    return rows


def error_curve(L: float, g: float, points: int = 120) -> dict:
    deg = np.linspace(1, 170, points)
    err = [pd.period_error_percent(Params(float(a), L, g)) for a in deg]
    return {"theta0_deg": deg.tolist(), "error_pct": err,
            "threshold_1pct_deg": pd.threshold_angle(1.0, L, g)}


def predict(theta0_deg: float, L: float, g: float) -> dict:
    P, metrics = _model()
    T0 = pd.linear_period(L, g)
    ratio = float(surrogate.predict_ratio(P, theta0_deg)[0])
    T_pred, T_true = ratio * T0, pd.exact_period(Params(theta0_deg, L, g))
    return {"theta0_deg": theta0_deg, "T_pred": T_pred, "T_true": T_true,
            "abs_error_s": abs(T_pred - T_true),
            "rel_error_pct": 100 * abs(T_pred - T_true) / T_true,
            "in_training_range": surrogate.ANGLE_MIN <= theta0_deg <= surrogate.ANGLE_MAX,
            "model": {"type": "MLP 1-24-24-1 (tanh)", **metrics}}
