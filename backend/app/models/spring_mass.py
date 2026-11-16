from __future__ import annotations

import numpy as np

from app.core import spring_mass as sm
from app.models.base import Metric, ModelSpec, ParamSpec, Series, SimulationResult, validate_params

VERDICTS = {
    "subamortiguado": "Subamortiguado: oscila y la amplitud decae. Raíces complejas conjugadas.",
    "crítico": "Críticamente amortiguado: el retorno más rápido sin oscilar. Raíz real doble.",
    "sobreamortiguado": "Sobreamortiguado: no oscila y vuelve lento. Dos raíces reales distintas.",
}


class SpringMassModel:
    spec = ModelSpec(
        id="spring-mass",
        name="Masa-resorte amortiguada",
        summary="Suspensión de un vehículo: cómo el amortiguamiento decide si el sistema oscila o se asienta.",
        equation="m x'' + c x' + k x = 0",
        params=(
            ParamSpec("m", "Masa m", "kg", 0.1, 50, 0.1, 1.0),
            ParamSpec("c", "Amortiguamiento c", "N·s/m", 0, 120, 0.05, 0.4),
            ParamSpec("k", "Rigidez k", "N/m", 0.5, 200, 0.5, 4.0),
            ParamSpec("x0", "Posición inicial x₀", "m", -2, 2, 0.05, 1.0),
            ParamSpec("v0", "Velocidad inicial v₀", "m/s", -5, 5, 0.1, 0.0),
        ),
        y_label="Posición x",
        y_unit="m",
        t_max_default=12.0,
    )

    def simulate(self, params: dict[str, float], t_max: float, n: int) -> SimulationResult:
        p = sm.Params(**validate_params(self.spec, params))
        t = np.linspace(0.0, t_max, n)
        ex, num = sm.exact_solution(t, p), sm.numeric_solution(t, p)
        reg = sm.regime(p)
        return SimulationResult(
            t=t.tolist(),
            series=[
                Series("exact", "Solución analítica", "exact", ex.tolist()),
                Series("numeric", "Simulación numérica", "numeric", num.tolist()),
            ],
            metrics=[
                Metric("regime", "Régimen", reg),
                Metric("zeta", "Razón de amortiguamiento ζ", float(p.zeta)),
                Metric("omega_n", "Frecuencia natural ωn", float(p.omega_n), "rad/s"),
                Metric("period", "Período amortiguado", sm.damped_period(p), "s"),
                Metric("settling", "Tiempo de asentamiento (2 %)", sm.settling_time(p), "s"),
                Metric("overshoot", "Sobreimpulso", sm.overshoot_percent(p), "%"),
                Metric("gap", "Diferencia numérica vs analítica", float(np.max(np.abs(ex - num))), "m"),
            ],
            verdict=VERDICTS[reg],
        )
