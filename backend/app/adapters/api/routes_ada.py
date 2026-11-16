"""Verificación OPCIONAL por ADA (asistente local de IA del grupo).

El dashboard calcula todo por su cuenta (backend Python, o el navegador en modo local). Si ADA está encendida en este mismo equipo, esta ruta le
pide su análisis verificado del péndulo (período por dos métodos independientes: integral elíptica y EDO DOP853) y lo CONTRASTA con el cálculo
del dashboard. ADA no reemplaza ningún cálculo: es una segunda opinión. Sin ADA el dashboard funciona igual y esta ruta responde
`available: false` (nunca un error).

Seguridad: solo se consulta una dirección de ESTE equipo (127.0.0.1 / localhost); si `ADA_API_URL` apunta a otra parte se ignora.
"""
from __future__ import annotations

import os
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Query

from app.core import pendulum as pd
from app.core.pendulum import Params

router = APIRouter(prefix="/api/ada")

DEFAULT_URL = "http://127.0.0.1:8100"
TIMEOUT_S = 2.5
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
T_TOLERANCE_S = 1e-6        # Ada redondea a 8 decimales; 1e-6 s deja margen sin ocultar diferencias reales
ERR_TOLERANCE_PCT = 1e-3


def ada_base_url() -> str | None:
    """URL base de ADA, o None si `ADA_API_URL` no es una dirección local (así esta ruta nunca sirve de puente hacia otra red)."""
    url = (os.getenv("ADA_API_URL") or "").strip().rstrip("/") or DEFAULT_URL      # vacía (como en .env.example) = la de por defecto
    p = urlsplit(url)
    if p.scheme not in ("http", "https") or p.hostname not in LOCAL_HOSTS:
        return None
    return url


def fetch_ada(base: str, params: dict[str, float]) -> dict:
    """Pide el análisis a ADA. Lanza httpx.HTTPError si no responde (separado para poder sustituirlo en las pruebas)."""
    r = httpx.get(f"{base}/ada/pendulum/verify", params=params, timeout=TIMEOUT_S)
    r.raise_for_status()
    return r.json()


def _off(reason: str) -> dict:
    return {"available": False, "reason": reason}


@router.get("/verify")
def verify(theta0_deg: float = Query(90, gt=0, le=170), L: float = Query(1.0, gt=0.05, le=20), g: float = Query(9.81, gt=0.1, le=30)) -> dict:
    base = ada_base_url()
    if base is None:
        return _off("ADA_API_URL debe apuntar a este mismo equipo (127.0.0.1).")
    try:
        a = fetch_ada(base, {"theta0_deg": theta0_deg, "L": L, "g": g})
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 422:
            return _off("Ada no verifica este caso (fuera de su rango de validación).")
        return _off(f"Ada respondió con un error ({e.response.status_code}).")
    except (httpx.HTTPError, ValueError):
        return _off("Ada no está conectada (es opcional: el dashboard calcula igual).")

    p = Params(theta0_deg, L, g)
    mine_T, mine_err = pd.exact_period(p), pd.period_error_percent(p)
    ada_T, ada_err = float(a["exact_period_elliptic_s"]), float(a["period_error_pct"])
    d_T, d_err = abs(ada_T - mine_T), abs(ada_err - mine_err)
    return {
        "available": True,
        "verified": bool(a["verified"]),
        "methods": a["verification_methods"],
        "dual_discrepancy": float(a["dual_period_relative_discrepancy"]),
        "T0_s": float(a["linear_period_T0_s"]),
        "T_elliptic_s": ada_T,
        "T_dop853_s": float(a["exact_period_dop853_s"]),
        "period_error_pct": ada_err,
        "threshold_deg": float(a["critical_angles_for_tolerance"]["max_angle_for_period_error_deg"]),
        "dashboard": {"T_s": mine_T, "period_error_pct": mine_err},
        "abs_diff_T_s": d_T,
        "abs_diff_error_pct": d_err,
        "agree": d_T < T_TOLERANCE_S and d_err < ERR_TOLERANCE_PCT,
    }
