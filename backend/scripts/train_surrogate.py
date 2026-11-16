"""Entrena el predictor y lo guarda en backend/app/ml/surrogate.json y en el frontend.

Uso:
    python scripts/train_surrogate.py                  # reentrena y guarda pesos + métricas
    python scripts/train_surrogate.py --metrics-only   # NO reentrena: recalcula las métricas de los pesos que ya están guardados
"""
import argparse
from pathlib import Path

import numpy as np

from app.core.pendulum import Params, exact_period, linear_period
from app.ml import surrogate

ROOT = Path(__file__).resolve().parents[2]
BACKEND_JSON = ROOT / "backend/app/ml/surrogate.json"
FRONTEND_JSON = ROOT / "frontend/src/assets/surrogate.json"


def compute_metrics(P: dict[str, np.ndarray]) -> dict:
    test = np.linspace(2.5, 158.5, 300)  # puntos que NO están en la malla de entrenamiento
    T0 = linear_period(1.0, 9.81)
    truth = np.array([exact_period(Params(a)) / T0 for a in test])
    pred = surrogate.predict_ratio(P, test)
    rel = np.abs(pred - truth) / truth * 100
    return {"mean_abs_pct_error": float(rel.mean()), "max_abs_pct_error": float(rel.max()),
            "n_test": int(len(test)), "n_train": 400, **surrogate.full_range_metrics(P)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--metrics-only", action="store_true", help="no reentrena: recalcula las métricas de los pesos guardados")
    args = ap.parse_args()
    P = surrogate.load(BACKEND_JSON)[0] if args.metrics_only else surrogate.train()
    metrics = compute_metrics(P)
    print(metrics)
    surrogate.save(P, BACKEND_JSON, metrics)
    surrogate.save(P, FRONTEND_JSON, metrics)


if __name__ == "__main__":
    main()
