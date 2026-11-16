"""Las métricas del predictor que se muestran deben ser las REALES: aquí se recalculan con scipy y un recorrido propio de la red, sin código de entrenamiento."""
import json
import math
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient
from scipy.special import ellipk

from app.main import app

JSON_PATH = Path(__file__).resolve().parents[1] / "app" / "ml" / "surrogate.json"
saved = json.loads(JSON_PATH.read_text(encoding="utf-8"))
W = {k: np.array(saved[k]) for k in ("W1", "b1", "W2", "b2", "W3", "b3")}


def predicted_ratio(deg: np.ndarray) -> np.ndarray:
    """Pasada hacia adelante de la red 1-24-24-1 (tanh), escrita aparte de app/ml/surrogate.py."""
    x = (2 * (deg - saved["angle_min"]) / (saved["angle_max"] - saved["angle_min"]) - 1).reshape(-1, 1)
    a2 = np.tanh(np.tanh(x @ W["W1"] + W["b1"]) @ W["W2"] + W["b2"])
    return (a2 @ W["W3"] + W["b3"]).ravel() + 1.0


def exact_ratio(deg: np.ndarray) -> np.ndarray:
    """T/T0 = (2/π) K(m), m = sen²(θ0/2): no depende de L ni de g."""
    return 2 / math.pi * ellipk(np.sin(np.radians(deg) / 2) ** 2)


def test_stored_full_range_metrics_match_an_independent_recomputation():
    m = saved["metrics"]
    deg = np.linspace(1.0, 160.0, m["n_full_range"])
    rel = np.abs(predicted_ratio(deg) - exact_ratio(deg)) / exact_ratio(deg) * 100
    assert m["max_abs_pct_error_full_range"] == np.float64(rel.max()) or abs(m["max_abs_pct_error_full_range"] - rel.max()) < 1e-6
    assert abs(m["mean_abs_pct_error_full_range"] - rel.mean()) < 1e-6
    assert abs(m["max_error_at_deg"] - deg[rel.argmax()]) < 1e-6


def test_the_true_worst_case_is_at_the_edge_and_larger_than_the_test_set_maximum():
    """Hallazgo de la revisión: el 'máximo 0.46 %' era solo de 300 ángulos de prueba; en todo el rango llega a ≈ 0.88 % en 160°."""
    m = saved["metrics"]
    assert m["max_error_at_deg"] == 160.0, "el peor caso está en el borde del rango entrenado"
    assert 0.85 < m["max_abs_pct_error_full_range"] < 0.92
    assert m["max_abs_pct_error_full_range"] > m["max_abs_pct_error"] > 0.4, "el máximo en todo el rango supera al de los ángulos de prueba"
    assert m["mean_abs_pct_error_full_range"] < 0.15, "el error TÍPICO sí es pequeño: el problema era solo el máximo citado"


def test_the_api_exposes_the_full_range_metrics():
    r = TestClient(app).get("/api/predict", params={"theta0_deg": 100}).json()["model"]
    assert r["max_abs_pct_error_full_range"] == saved["metrics"]["max_abs_pct_error_full_range"] and r["max_error_at_deg"] == 160.0
    assert r["n_test"] == 300 and r["n_full_range"] == 20001
