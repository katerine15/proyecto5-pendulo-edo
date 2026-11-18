"""Servidor MCP: deja que un asistente (modelo local con Ollama / LM Studio, o cualquier cliente MCP) use la física del proyecto.

Es un adaptador delgado, igual que la API HTTP: solo traduce llamadas a `app.services` y `app.models`.
El asistente elige herramientas y explica los resultados; NO calcula: todas las cifras salen de Python.

Ejecutar (transporte stdio, el que usan los clientes MCP locales):
    cd backend && PYTHONPATH=. uv run python -m app.adapters.mcp.server
"""
from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from app.core.pendulum import Params
from app.models import registry
from app.models.base import validate_params
from app.services import simulation as svc

registry.register_defaults()
mcp = MCPServer("oscilaciones")


def _round(x: float, d: int = 6) -> float:
    return round(float(x), d)


@mcp.tool()
def listar_modelos() -> list[dict]:
    """Lista los modelos físicos disponibles con sus parámetros, unidades y rangos válidos."""
    return [m.spec.to_dict() for m in registry.all_models()]


@mcp.tool()
def simular_pendulo(theta0_deg: float = 90.0, L: float = 1.0, g: float = 9.81) -> dict:
    """Compara el péndulo real con la aproximación lineal para un ángulo de suelta (grados), longitud L (m) y gravedad g (m/s²).

    Devuelve los períodos, el error porcentual del modelo lineal y cuánto atrasa por día un reloj calibrado a ángulo pequeño.
    No devuelve las series completas (son largas); usa `serie_pendulo` si las necesitas.
    """
    validate_params(registry.get("pendulum").spec, {"theta0_deg": theta0_deg, "L": L, "g": g})
    r = svc.simulate(Params(theta0_deg, L, g), t_max=10.0, n=100)
    return {
        "theta0_deg": theta0_deg, "L_m": L, "g_m_s2": g,
        "periodo_lineal_s": _round(r["T0"]), "periodo_real_s": _round(r["T_real"]),
        "error_periodo_pct": _round(r["period_error_pct"], 4),
        "reloj_atrasa_s_por_dia": _round(r["clock_drift_s_per_day"], 2),
        "numerico_vs_exacto_grados": float(f"{r['numeric_vs_exact_deg']:.3e}"),
    }


@mcp.tool()
def tabla_de_periodos(L: float = 1.0, g: float = 9.81) -> list[dict]:
    """Tabla de períodos real y lineal con su error para 10°, 45°, 90° y 150° (los casos de la guía)."""
    return [{k: _round(v, 6) for k, v in row.items()} for row in svc.period_table(svc.REFERENCE_ANGLES, L, g)]


@mcp.tool()
def angulo_umbral(error_pct: float = 1.0, L: float = 1.0, g: float = 9.81) -> dict:
    """Ángulo de suelta (grados) a partir del cual el error del período del modelo lineal supera `error_pct` por ciento."""
    if not 0.01 <= error_pct <= 50:
        raise ValueError("error_pct debe estar entre 0.01 y 50")
    from app.core import pendulum as pd

    a = pd.threshold_angle(error_pct, L, g)
    return {"error_pct": error_pct, "angulo_umbral_deg": _round(a, 3),
            "periodo_real_s": _round(pd.exact_period(Params(a, L, g)), 6),
            "reloj_atrasa_s_por_dia": _round(pd.daily_clock_drift_seconds(Params(a, L, g)), 2)}


@mcp.tool()
def predecir_periodo(theta0_deg: float = 60.0, L: float = 1.0, g: float = 9.81) -> dict:
    """Período estimado por la red neuronal entrenada, contrastado con el cálculo exacto. Rango de entrenamiento: 1° a 160°."""
    r = svc.predict(theta0_deg, L, g)
    return {k: (_round(v, 6) if isinstance(v, float) else v) for k, v in r.items() if k != "model"} | {
        "red": r["model"]["type"], "error_medio_pct": _round(r["model"]["mean_abs_pct_error"], 3)}


@mcp.tool()
def simular_modelo(model_id: str, params: dict[str, float] | None = None, t_max: float = 10.0) -> dict:
    """Simula cualquier modelo del registro (por ejemplo 'spring-mass') y devuelve métricas y veredicto (no las series)."""
    model = registry.get(model_id)
    res = model.simulate(params or {}, t_max, 200)
    return {"modelo": model.spec.name, "ecuacion": model.spec.equation, "veredicto": res.verdict,
            "metricas": [{"nombre": m.label, "valor": m.value, "unidad": m.unit} for m in res.metrics]}


if __name__ == "__main__":
    mcp.run()
