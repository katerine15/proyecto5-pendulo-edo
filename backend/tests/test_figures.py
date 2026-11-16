import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.core.pendulum import Params
from app.figures import render as R
from app.figures import tables
from app.main import app

c = TestClient(app)
P = Params(90, 1.0, 9.81)
PNG, GIF = b"\x89PNG\r\n\x1a\n", b"GIF89a"


@pytest.mark.parametrize("name", list(R.CATALOG))
def test_every_figure_renders_png_and_svg(name):
    assert R.render(name, P, "light", "png", 60).startswith(PNG)
    assert b"<svg" in R.render(name, P, "dark", "svg", 60)[:2000]


def test_themes_differ_and_results_are_cached():
    light, dark = R.render("fases", P, "light", "png", 60), R.render("fases", P, "dark", "png", 60)
    assert light != dark
    assert R.render("fases", P, "light", "png", 60) is light  # misma instancia: sale de la caché


def test_parameters_change_the_figure():
    assert R.render("fases", Params(30, 1, 9.81), "light", "png", 60) != R.render("fases", Params(120, 1, 9.81), "light", "png", 60)


def test_invalid_inputs():
    with pytest.raises(KeyError):
        R.render("nope", P)
    with pytest.raises(ValueError):
        R.render("fases", P, theme="neon")
    with pytest.raises(ValueError):
        R.render("fases", P, fmt="bmp")
    with pytest.raises(ValueError):
        R.render("fases", P, dpi=5)


def test_period_table_matches_guide_and_has_both_error_conventions():
    rows = {r["theta0_grados"]: r for r in tables.period_table()}
    assert rows[10]["T_exacto_s"] == pytest.approx(2.0099, abs=1e-4)
    assert rows[90]["error_vs_T_pct"] == pytest.approx(15.28, abs=0.02)   # frente a T (la guía)
    assert rows[90]["error_vs_T0_pct"] == pytest.approx(18.03, abs=0.02)  # frente a T₀
    assert rows[150]["T_medido_RK4_s"] == pytest.approx(rows[150]["T_exacto_s"], abs=1e-4)
    assert tables.to_csv(list(rows.values())).splitlines()[0].startswith("theta0_grados")


def test_slow_motion_gif_small():
    data = R.render_gif(P, "light", slow=0.25, seconds=2, fps=8, dpi=50)
    assert data.startswith(GIF)
    with pytest.raises(ValueError):
        R.render_gif(P, slow=2.0)


def test_api_serves_figures_in_real_time():
    r = c.get("/api/figures/error_periodo.png", params={"theta0_deg": 45, "dpi": 60})
    assert r.status_code == 200 and r.headers["content-type"] == "image/png" and r.content.startswith(PNG)
    s = c.get("/api/figures/fases.svg", params={"theme": "dark", "dpi": 60})
    assert s.status_code == 200 and "svg" in s.headers["content-type"]
    csv = c.get("/api/figures/tabla_periodos.csv")
    assert csv.status_code == 200 and "error_vs_T_pct" in csv.text
    assert [f["id"] for f in c.get("/api/figures").json()["figures"]][:2] == ["verificacion", "comparacion"]


def test_api_errors_and_download_header():
    assert c.get("/api/figures/nope.png").status_code == 404
    assert c.get("/api/figures/fases").status_code == 404
    assert c.get("/api/figures/fases.png", params={"theta0_deg": 400}).status_code == 422
    assert c.get("/api/figures/fases.png", params={"theme": "neon"}).status_code == 422
    d = c.get("/api/figures/fases.png", params={"dpi": 60, "download": True})
    assert "attachment" in d.headers["content-disposition"]


def test_api_zip_contains_everything():
    r = c.get("/api/figures/todo.zip", params={"dpi": 60})
    names = set(zipfile.ZipFile(io.BytesIO(r.content)).namelist())
    assert {"error_periodo.png", "paisaje_energia.svg", "tabla_periodos.csv"} <= names
    assert len(names) == 2 * len(R.CATALOG) + 1
