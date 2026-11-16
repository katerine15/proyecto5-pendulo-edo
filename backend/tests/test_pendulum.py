"""Verificación del modelo contra los valores de referencia de la guía."""
import numpy as np
import pytest

from app.core.pendulum import (
    Params, daily_clock_drift_seconds, exact_period, exact_solution, linear_period,
    linear_solution, measured_period, numeric_solution, period_error_percent,
    threshold_angle,
)


def test_linear_period_T0():
    assert linear_period(1.0, 9.81) == pytest.approx(2.0061, abs=1e-4)


@pytest.mark.parametrize("deg,T,err", [(10, 2.0099, 0.19), (45, 2.0863, 3.8),
                                       (90, 2.3679, 15.3), (150, 3.5351, 43.0)])
def test_reference_periods(deg, T, err):
    p = Params(deg)
    assert exact_period(p) == pytest.approx(T, abs=1e-3)
    assert measured_period(p) == pytest.approx(T, abs=1e-3)
    assert period_error_percent(p) == pytest.approx(err, rel=0.03)


def test_numeric_matches_elliptic_exact():
    p = Params(90)
    t = np.linspace(0, 10, 400)
    assert np.max(np.abs(numeric_solution(t, p) - exact_solution(t, p))) < 1e-7


def test_linear_good_for_small_angle_bad_for_large():
    t = np.linspace(0, 10, 400)
    small, large = Params(5), Params(120)
    d_small = np.max(np.abs(linear_solution(t, small) - exact_solution(t, small)))
    d_large = np.max(np.abs(linear_solution(t, large) - exact_solution(t, large)))
    assert d_small < 0.01 and d_large > 1.0


def test_threshold_one_percent_near_23_degrees():
    assert threshold_angle(1.0) == pytest.approx(23.0, abs=1.0)


def test_clock_loses_time_with_larger_amplitude():
    assert daily_clock_drift_seconds(Params(10)) < daily_clock_drift_seconds(Params(45))
    assert daily_clock_drift_seconds(Params(45)) > 0


def test_extreme_angle_measured_period():
    p = Params(170)
    assert measured_period(p) == pytest.approx(exact_period(p), abs=1e-3)
