import numpy as np
import pytest

from app.core.integrators import energy_drift, measure_period_rk4, pendulum_rhs, rk4
from app.core.pendulum import Params, exact_period, exact_solution, linear_solution


def test_rk4_linear_matches_analytic_solution():
    p = Params(45)
    t, Y = rk4(pendulum_rhs(9.81, 1.0, linear=True), np.array([p.theta0, 0.0]), 0.0, 10.0, 1e-3)
    assert np.max(np.abs(Y[:, 0] - linear_solution(t, p))) < 1e-10  # la diferencia que anuncia la guía (~1e-11 rad)


def test_rk4_real_matches_elliptic_solution():
    p = Params(120)
    t, Y = rk4(pendulum_rhs(9.81, 1.0), np.array([p.theta0, 0.0]), 0.0, 10.0, 1e-3)
    assert np.max(np.abs(Y[:, 0] - exact_solution(t, p))) < 1e-9


@pytest.mark.parametrize("deg", [10, 45, 90, 150])
def test_measured_period_matches_exact(deg):
    assert measure_period_rk4(np.radians(deg), 9.81, 1.0) == pytest.approx(exact_period(Params(deg)), abs=1e-5)


def test_energy_euler_grows_symplectic_bounded_rk4_tiny():
    args = (np.radians(90), 9.81, 1.0, 0.05, 50.0)
    _, euler = energy_drift("euler", *args)
    _, sym = energy_drift("symplectic", *args)
    _, rk = energy_drift("rk4", *args)
    assert euler[-1] > 5            # la energía crece más de 5 veces (resultado de la guía)
    assert sym.max() < 0.1          # acotada
    assert rk.max() < 1e-3          # casi no deriva
    with pytest.raises(ValueError):
        energy_drift("nope", *args)
