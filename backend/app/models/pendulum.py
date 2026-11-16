from __future__ import annotations

from app.core.pendulum import Params
from app.models.base import Metric, ModelSpec, ParamSpec, Series, SimulationResult, validate_params
from app.services import simulation as svc


class PendulumModel:
    spec = ModelSpec(
        id="pendulum",
        name="Péndulo simple",
        summary="¿Cuándo vale la aproximación lineal sen θ ≈ θ? Compara el péndulo real con el modelo lineal.",
        equation="θ'' + (g/L) sen θ = 0",
        params=(
            ParamSpec("theta0_deg", "Ángulo de suelta θ₀", "°", 1, 170, 1, 90),
            ParamSpec("L", "Longitud L", "m", 0.2, 5, 0.05, 1.0),
            ParamSpec("g", "Gravedad g", "m/s²", 1.6, 25, 0.01, 9.81),
        ),
        y_label="Ángulo θ",
        y_unit="°",
        t_max_default=12.0,
    )

    def simulate(self, params: dict[str, float], t_max: float, n: int) -> SimulationResult:
        v = validate_params(self.spec, params)
        r = svc.simulate(Params(v["theta0_deg"], v["L"], v["g"]), t_max, n)
        err = r["period_error_pct"]
        verdict = ("La aproximación lineal vale." if err < 1
                   else "Aceptable, con cuidado." if err < 5 else "La aproximación lineal falla.")
        return SimulationResult(
            t=r["t"],
            series=[
                Series("approx", "Lineal", "approx", r["theta_linear_deg"]),
                Series("exact", "Exacta (elíptica)", "exact", r["theta_exact_deg"]),
                Series("numeric", "Real (numérica)", "numeric", r["theta_real_deg"]),
            ],
            metrics=[
                Metric("T0", "Período lineal T₀", r["T0"], "s"),
                Metric("T", "Período real T", r["T_real"], "s"),
                Metric("error", "Error del período", err, "%"),
                Metric("gap", "Diferencia numérica vs exacta", r["numeric_vs_exact_deg"], "°"),
            ],
            verdict=verdict,
        )
