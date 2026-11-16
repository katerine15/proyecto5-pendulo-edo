"""Predictor de aprendizaje automático (red neuronal pequeña, solo numpy).

Aprende la relación  θ0 → T/T0  a partir de datos generados con el modelo físico
(período exacto elíptico). Es un *sustituto* (surrogate): no reemplaza la física,
la imita rápido, y el dashboard muestra siempre su error frente al valor exacto.
Los pesos se exportan a JSON para que el navegador también pueda evaluarlo
(funciona sin backend).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.core.pendulum import Params, exact_period, linear_period

ANGLE_MIN, ANGLE_MAX = 1.0, 160.0
HIDDEN = 24


def _features(deg: np.ndarray) -> np.ndarray:
    """Normaliza el ángulo a [-1, 1]."""
    return (2 * (deg - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN) - 1).reshape(-1, 1)


def make_dataset(n: int = 400) -> tuple[np.ndarray, np.ndarray]:
    deg = np.linspace(ANGLE_MIN, ANGLE_MAX, n)
    T0 = linear_period(1.0, 9.81)
    ratio = np.array([exact_period(Params(a)) / T0 for a in deg])
    return deg, ratio


def _init(rng: np.random.Generator) -> dict[str, np.ndarray]:
    def w(i: int, o: int) -> np.ndarray:
        return rng.normal(0, np.sqrt(1.0 / i), (i, o))
    return {"W1": w(1, HIDDEN), "b1": np.zeros(HIDDEN), "W2": w(HIDDEN, HIDDEN),
            "b2": np.zeros(HIDDEN), "W3": w(HIDDEN, 1), "b3": np.zeros(1)}


def _forward(P: dict[str, np.ndarray], x: np.ndarray):
    a1 = np.tanh(x @ P["W1"] + P["b1"])
    a2 = np.tanh(a1 @ P["W2"] + P["b2"])
    return a1, a2, a2 @ P["W3"] + P["b3"]


def train(epochs: int = 12000, lr: float = 3e-3, seed: int = 7) -> dict[str, np.ndarray]:
    rng = np.random.default_rng(seed)
    deg, ratio = make_dataset()
    x, y = _features(deg), (ratio - 1.0).reshape(-1, 1)
    P = _init(rng)
    m = {k: np.zeros_like(v) for k, v in P.items()}
    s = {k: np.zeros_like(v) for k, v in P.items()}
    for step in range(1, epochs + 1):
        a1, a2, out = _forward(P, x)
        d3 = 2 * (out - y) / len(x)
        g = {"W3": a2.T @ d3, "b3": d3.sum(0)}
        d2 = (d3 @ P["W3"].T) * (1 - a2**2)
        g.update(W2=a1.T @ d2, b2=d2.sum(0))
        d1 = (d2 @ P["W2"].T) * (1 - a1**2)
        g.update(W1=x.T @ d1, b1=d1.sum(0))
        for k in P:
            m[k] = 0.9 * m[k] + 0.1 * g[k]
            s[k] = 0.999 * s[k] + 0.001 * g[k] ** 2
            P[k] -= lr * (m[k] / (1 - 0.9**step)) / (np.sqrt(s[k] / (1 - 0.999**step)) + 1e-8)
        if step == int(epochs * 0.6):
            lr *= 0.3
    return P


def predict_ratio(P: dict[str, np.ndarray], deg: float | np.ndarray) -> np.ndarray:
    x = _features(np.atleast_1d(np.asarray(deg, dtype=float)))
    return _forward(P, x)[2].ravel() + 1.0


def full_range_metrics(P: dict[str, np.ndarray], n: int = 20001) -> dict:
    """Error de la red en TODO el rango entrenado (malla densa de `n` ángulos), no solo en unos pocos ángulos de prueba.

    Los ángulos de prueba (300) dan una idea del error típico, pero el máximo verdadero suele estar en un borde del rango: aquí se mide ahí.
    """
    deg = np.linspace(ANGLE_MIN, ANGLE_MAX, n)
    T0 = linear_period(1.0, 9.81)
    truth = np.array([exact_period(Params(a)) / T0 for a in deg])
    rel = np.abs(predict_ratio(P, deg) - truth) / truth * 100
    worst = int(rel.argmax())
    return {"mean_abs_pct_error_full_range": float(rel.mean()), "max_abs_pct_error_full_range": float(rel.max()),
            "max_error_at_deg": float(deg[worst]), "n_full_range": int(n)}


def save(P: dict[str, np.ndarray], path: Path, metrics: dict) -> None:
    payload = {"angle_min": ANGLE_MIN, "angle_max": ANGLE_MAX, "hidden": HIDDEN,
               "metrics": metrics, **{k: v.tolist() for k, v in P.items()}}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def load(path: Path) -> tuple[dict[str, np.ndarray], dict]:
    d = json.loads(path.read_text(encoding="utf-8"))
    P = {k: np.array(d[k]) for k in ("W1", "b1", "W2", "b2", "W3", "b3")}
    return P, d["metrics"]
