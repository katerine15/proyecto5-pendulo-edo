import asyncio

from app.adapters.mcp import server


def test_tools_are_registered_and_return_physics():
    names = {t.name for t in asyncio.run(server.mcp.list_tools())}
    assert {"listar_modelos", "simular_pendulo", "tabla_de_periodos", "angulo_umbral", "predecir_periodo", "simular_modelo"} <= names

    r = server.simular_pendulo(90, 1, 9.81)
    assert abs(r["periodo_real_s"] - 2.3679) < 1e-3
    assert abs(server.angulo_umbral(1)["angulo_umbral_deg"] - 23) < 1
    assert server.predecir_periodo(77)["rel_error_pct"] < 1
    sm = server.simular_modelo("spring-mass", {"c": 10})
    assert sm["metricas"][0]["valor"] == "sobreamortiguado"
