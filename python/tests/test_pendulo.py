"""Pruebas de pendulo.py: comprueban los números que se entregan y se exponen.

Ejecutar desde la carpeta del proyecto:   python -m pytest
"""
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pendulo as P  # noqa: E402


def test_periodo_lineal():
    # Punto 1 a mano: T0 = 2π√(L/g) con L = 1 m y g = 9.81 m/s²
    assert P.T0 == pytest.approx(2.0061, abs=1e-4)
    assert P.w == pytest.approx(3.1321, abs=1e-4)


@pytest.mark.parametrize("grados, referencia", [(10, 2.0099), (45, 2.0863), (90, 2.3679), (150, 3.5351)])
def test_periodos_de_referencia(grados, referencia):
    # Valores de referencia del enunciado (4 decimales)
    assert P.medir_periodo(grados) == pytest.approx(referencia, abs=2e-4)


def test_rk4_reproduce_la_solucion_exacta_lineal():
    theta0 = np.radians(45)
    t, Y = P.rk4(P.F_lineal, np.array([theta0, 0.0]), 0.0, 10.0, P.h)
    assert np.max(np.abs(Y[:, 0] - P.exacta_lineal(t, theta0))) < 1e-8


def test_el_periodo_crece_con_la_amplitud():
    # Punto 2: en el péndulo real T > T0 y crece con θ0
    periodos = [P.medir_periodo(d) for d in (5, 20, 60, 120)]
    assert all(T > P.T0 for T in periodos)
    assert periodos == sorted(periodos)


def test_umbral_del_1_por_ciento():
    # Bisección: ángulo donde (T − T0)/T0 = 1 %
    error = lambda d: (P.medir_periodo(d) - P.T0) / P.T0 - 0.01
    a, b = 10.0, 40.0
    for _ in range(25):
        m = (a + b) / 2
        a, b = (m, b) if error(m) < 0 else (a, m)
    assert (a + b) / 2 == pytest.approx(22.8, abs=0.1)


@pytest.mark.parametrize("grados, esperado", [(10, 0.51), (90, 57.08)])
def test_error_de_taylor(grados, esperado):
    # Punto 3 a mano: error relativo de usar sen θ ≈ θ
    th = np.radians(grados)
    assert 100 * (th - np.sin(th)) / np.sin(th) == pytest.approx(esperado, abs=0.01)
