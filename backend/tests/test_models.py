import numpy as np
import pytest

from app.core import spring_mass as sm
from app.models import registry
from app.models.base import validate_params

registry.register_defaults()


def test_registry_lists_both_models():
    ids = [m.spec.id for m in registry.all_models()]
    assert ids == ["pendulum", "spring-mass"]
    with pytest.raises(KeyError):
        registry.get("nope")


@pytest.mark.parametrize("c,expected", [(0.4, "subamortiguado"), (4.0, "crítico"), (10.0, "sobreamortiguado")])
def test_spring_mass_regimes(c, expected):
    p = sm.Params(m=1, c=c, k=4)  # c crítico = 2 sqrt(m k) = 4
    assert sm.regime(p) == expected


@pytest.mark.parametrize("c", [0.4, 4.0, 10.0])
def test_spring_mass_exact_matches_numeric_and_initial_conditions(c):
    p = sm.Params(m=1, c=c, k=4, x0=1.0, v0=0.5)
    t = np.linspace(0, 12, 300)
    ex = sm.exact_solution(t, p)
    assert ex[0] == pytest.approx(1.0)
    tiny = np.array([0.0, 1e-6])
    assert (sm.exact_solution(tiny, p)[1] - 1.0) / 1e-6 == pytest.approx(0.5, abs=1e-3)  # x'(0) = v0
    assert np.max(np.abs(ex - sm.numeric_solution(t, p))) < 1e-7


def test_spring_mass_known_values():
    p = sm.Params(m=1, c=0.4, k=4)
    assert p.omega_n == pytest.approx(2.0)
    assert p.zeta == pytest.approx(0.1)
    assert sm.damped_period(p) == pytest.approx(2 * np.pi / (2 * np.sqrt(1 - 0.01)))
    assert sm.damped_period(sm.Params(m=1, c=10, k=4)) is None


def test_validate_params_errors():
    spec = registry.get("spring-mass").spec
    assert validate_params(spec, {})["m"] == 1.0
    with pytest.raises(ValueError, match="entre"):
        validate_params(spec, {"m": 999})
    with pytest.raises(ValueError, match="desconocidos"):
        validate_params(spec, {"zzz": 1})


def test_models_produce_uniform_results():
    for m in registry.all_models():
        r = m.simulate({}, 6.0, 100)
        assert len(r.t) == 100 and all(len(s.values) == 100 for s in r.series)
        assert r.metrics and r.verdict


def test_guide_project_1_settling_times_and_overshoot():
    """Valores de referencia del Proyecto 1 de la guía: m = 300 kg, k = 30 000 N/m, x0 = 5 cm."""
    m_, k_ = 300.0, 30000.0
    c_cr = 2 * np.sqrt(m_ * k_)
    expected = {0.3: 1.10, 1.0: 0.58, 1.5: 1.07}  # tiempos de asentamiento que da la guía (s)
    for z, ref in expected.items():
        p = sm.Params(m=m_, c=z * c_cr, k=k_, x0=0.05, v0=0.0)
        assert sm.settling_time(p) == pytest.approx(ref, abs=0.03)
    assert sm.overshoot_percent(sm.Params(m=m_, c=0.3 * c_cr, k=k_, x0=0.05)) == pytest.approx(37.0, abs=1.0)  # "cerca de un 37 %"
    assert sm.overshoot_percent(sm.Params(m=m_, c=c_cr, k=k_, x0=0.05)) == pytest.approx(0.0, abs=1e-6)
    assert sm.overshoot_percent(sm.Params(m=m_, c=1.5 * c_cr, k=k_, x0=0.05)) == pytest.approx(0.0, abs=1e-6)
