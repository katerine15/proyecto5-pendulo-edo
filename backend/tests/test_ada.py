"""Verificación OPCIONAL por ADA: sin ADA el dashboard sigue igual; con ADA se contrastan los números. Sin red: ADA se sustituye por un doble."""
import httpx
import pytest
from fastapi.testclient import TestClient

from app.adapters.api import routes_ada
from app.core import pendulum as pd
from app.core.pendulum import Params
from app.main import app

c = TestClient(app)


def fake_ada(theta0_deg=90.0, L=1.0, g=9.81, dT=0.0, derr=0.0, verified=True):
    """Lo que devolvería el servicio de ADA (redondea a 8 decimales), calculado con la física del propio dashboard."""
    p = Params(theta0_deg, L, g)
    T = pd.exact_period(p) + dT
    return {
        "verified": verified, "verification_methods": ["scipy.special.ellipk", "scipy.integrate.solve_ivp_DOP853"],
        "dual_period_relative_discrepancy": 3e-13, "linear_period_T0_s": round(pd.linear_period(L, g), 8),
        "exact_period_elliptic_s": round(T, 8), "exact_period_dop853_s": round(T, 8),
        "period_error_pct": round(pd.period_error_percent(p) + derr, 6),
        "critical_angles_for_tolerance": {"tolerance_pct": 1.0, "max_angle_for_period_error_deg": round(pd.threshold_angle(1.0, L, g), 4)},
    }


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.delenv("ADA_API_URL", raising=False)
    monkeypatch.delenv("API_KEY", raising=False)


def test_without_ada_the_route_answers_available_false_not_an_error(monkeypatch):
    def down(*_a, **_k):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(routes_ada, "fetch_ada", down)
    r = c.get("/api/ada/verify", params={"theta0_deg": 90})
    assert r.status_code == 200
    assert r.json()["available"] is False and "no está conectada" in r.json()["reason"] and "opcional" in r.json()["reason"]


def test_with_ada_both_computations_agree_at_90_degrees(monkeypatch):
    seen = {}

    def ok(base, params):
        seen.update(base=base, params=params)
        return fake_ada(**{"theta0_deg": params["theta0_deg"], "L": params["L"], "g": params["g"]})

    monkeypatch.setattr(routes_ada, "fetch_ada", ok)
    r = c.get("/api/ada/verify", params={"theta0_deg": 90, "L": 1, "g": 9.81}).json()
    assert seen["base"] == "http://127.0.0.1:8100" and seen["params"] == {"theta0_deg": 90, "L": 1, "g": 9.81}, "se manda SIEMPRE la g de la guía, no la de ADA"
    assert r["available"] and r["verified"] and r["agree"] is True
    assert abs(r["dashboard"]["T_s"] - 2.3678) < 1e-4 and abs(r["dashboard"]["period_error_pct"] - 15.28) < 0.01      # valores de la guía
    assert r["abs_diff_T_s"] < 1e-6 and r["abs_diff_error_pct"] < 1e-3
    assert r["T0_s"] == pytest.approx(2.0061, abs=5e-5) and 22.90 < r["threshold_deg"] < 22.96
    assert any("DOP853" in m for m in r["methods"]) and r["dual_discrepancy"] < 1e-9


def test_a_real_disagreement_is_reported_not_hidden(monkeypatch):
    monkeypatch.setattr(routes_ada, "fetch_ada", lambda base, params: fake_ada(dT=0.01))
    r = c.get("/api/ada/verify", params={"theta0_deg": 90}).json()
    assert r["available"] is True and r["agree"] is False and r["abs_diff_T_s"] == pytest.approx(0.01, abs=1e-6)
    monkeypatch.setattr(routes_ada, "fetch_ada", lambda base, params: fake_ada(derr=0.5))
    assert c.get("/api/ada/verify", params={"theta0_deg": 90}).json()["agree"] is False
    monkeypatch.setattr(routes_ada, "fetch_ada", lambda base, params: fake_ada(verified=False))
    r2 = c.get("/api/ada/verify", params={"theta0_deg": 90}).json()
    assert r2["verified"] is False, "si Ada dice que su doble método NO coincide, se muestra"


def test_ada_rejecting_the_case_is_not_an_error(monkeypatch):
    def refuses(*_a, **_k):
        req = httpx.Request("GET", "http://127.0.0.1:8100/ada/pendulum/verify")
        raise httpx.HTTPStatusError("422", request=req, response=httpx.Response(422, request=req))

    monkeypatch.setattr(routes_ada, "fetch_ada", refuses)
    r = c.get("/api/ada/verify", params={"theta0_deg": 0.05}).json()
    assert r["available"] is False and "no verifica este caso" in r["reason"]


def test_only_local_addresses_are_ever_contacted(monkeypatch):
    called = []
    monkeypatch.setattr(routes_ada, "fetch_ada", lambda base, params: called.append(base) or fake_ada())
    for bad in ("http://example.com:8100", "http://192.168.1.20:8100", "ftp://127.0.0.1", "file:///C:/x", "http://127.0.0.1.evil.com"):
        monkeypatch.setenv("ADA_API_URL", bad)
        r = c.get("/api/ada/verify", params={"theta0_deg": 90}).json()
        assert r["available"] is False and "este mismo equipo" in r["reason"], bad
    assert called == [], "con una URL no local no se hace ninguna petición"
    monkeypatch.setenv("ADA_API_URL", "http://localhost:9000/")
    assert c.get("/api/ada/verify", params={"theta0_deg": 90}).json()["available"] is True and called == ["http://localhost:9000"]


def test_an_empty_ada_api_url_means_the_default_not_an_error(monkeypatch):
    """.env.example trae `ADA_API_URL=` vacía: al copiarlo, debe seguir usándose http://127.0.0.1:8100."""
    seen = []
    monkeypatch.setattr(routes_ada, "fetch_ada", lambda base, params: seen.append(base) or fake_ada())
    for empty in ("", "   "):
        monkeypatch.setenv("ADA_API_URL", empty)
        assert routes_ada.ada_base_url() == "http://127.0.0.1:8100"
        assert c.get("/api/ada/verify", params={"theta0_deg": 90}).json()["available"] is True
    assert seen == ["http://127.0.0.1:8100"] * 2


def test_inputs_are_validated_and_the_api_key_guard_covers_the_route(monkeypatch):
    monkeypatch.setattr(routes_ada, "fetch_ada", lambda base, params: fake_ada())
    assert c.get("/api/ada/verify", params={"theta0_deg": 500}).status_code == 422
    assert c.get("/api/ada/verify", params={"theta0_deg": 90, "g": 0}).status_code == 422
    monkeypatch.setenv("API_KEY", "clave-de-prueba-larga")
    assert c.get("/api/ada/verify", params={"theta0_deg": 90}).status_code == 401
    assert c.get("/api/ada/verify", params={"theta0_deg": 90}, headers={"X-API-Key": "clave-de-prueba-larga"}).status_code == 200
