from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)


def test_health():
    assert c.get("/api/health").json() == {"status": "ok"}


def test_simulate_shape_and_numbers():
    r = c.post("/api/simulate", json={"theta0_deg": 90, "t_max": 10, "n": 200}).json()
    assert len(r["t"]) == len(r["theta_real_deg"]) == 200
    assert abs(r["T_real"] - 2.3679) < 1e-3
    assert r["numeric_vs_exact_deg"] < 1e-4


def test_periods_error_curve_predict():
    assert len(c.get("/api/periods").json()["rows"]) == 4
    assert abs(c.get("/api/error-curve").json()["threshold_1pct_deg"] - 23) < 1
    p = c.get("/api/predict", params={"theta0_deg": 77}).json()
    assert p["rel_error_pct"] < 1.0


def test_validation():
    assert c.post("/api/simulate", json={"theta0_deg": 400}).status_code == 422


def test_models_catalog_and_simulate():
    cat = c.get("/api/models").json()["models"]
    assert [m["id"] for m in cat] == ["pendulum", "spring-mass"]
    assert cat[1]["params"][0]["key"] == "m"
    r = c.post("/api/models/spring-mass/simulate", json={"params": {"c": 10}, "t_max": 8, "n": 120}).json()
    assert r["metrics"][0]["value"] == "sobreamortiguado"
    assert len(r["series"][0]["values"]) == 120


def test_models_errors():
    assert c.post("/api/models/nope/simulate", json={}).status_code == 404
    assert c.post("/api/models/spring-mass/simulate", json={"params": {"m": 999}}).status_code == 422
    assert c.post("/api/models/spring-mass/simulate", json={"params": {"zzz": 1}}).status_code == 422
