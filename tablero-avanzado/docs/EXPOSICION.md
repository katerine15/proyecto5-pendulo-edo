# Guion de exposición (15 min + 5 de preguntas)

Todos los integrantes hablan. Reparto sugerido: **A** (matemática), **B** (programa y verificación),
**C** (dashboard, IA y conclusión). Cada uno debe poder explicar *cualquier* parte de su bloque sin leer.

| Min | Quién | Qué | Pantalla |
|---|---|---|---|
| 0–1 | A | Pregunta del proyecto: ¿cuándo vale sen θ ≈ θ? | Título del dashboard |
| 1–5 | A | **A mano:** ecuación característica `r² + g/L = 0`, solución `θ₀cos(ω₀t)`, `T₀ = 2π√(L/g)`, T₀ no depende de la amplitud; error de Taylor en 10° y 90° | Pizarra / hoja de la deducción |
| 5–8 | B | De segundo orden a sistema `u' = v, v' = −(g/L) sin u`; RK4; cómo se mide el período (v = 0) | Código `backend/app/core/integrators.py` (`rk4`, `measure_period_rk4`) |
| 8–10 | B | **Verificación:** curvas lineal / real / exacta superpuestas; diferencia ≈ 1e-9° con la exacta elíptica | Gráfica «Ángulo en el tiempo» |
| 10–12 | C | **Punto alto:** simulación a 90° y a 150°; el real se atrasa. Tabla y umbral del 1 % (~23°) | Escena + gráfica de error |
| 12–13 | C | Predicción con IA: red neuronal vs física exacta; su error (<0.5 %). Qué es y qué no es | Tarjeta de predicción |
| 13–15 | C | **Conclusión de ingeniería** y la pregunta final | Veredicto |

## Conclusión de ingeniería (completar con sus números)

- Para amplitudes ≤ ~23° el error del período es < 1 %: se puede usar el modelo lineal.
- A 45° el error es ≈ 3.8 %; a 90° ≈ 15.3 %; a 150° ≈ 43 %. El lineal deja de servir.
- **Recomendación concreta:** diseñar con θ₀ ≤ 10° (error 0.19 %) si se necesita precisión de tiempo.

## Pregunta de cierre de la guía

*¿Un reloj de péndulo adelanta o atrasa si se le aumenta la amplitud?* **Atrasa**: más amplitud → período mayor.
A 10° atrasa ≈ 2.7 min/día; a 90°, ≈ 220 min/día (valores del dashboard, tarjeta «Veredicto»).

## Preguntas probables

- *¿Por qué la solución lineal no depende de la amplitud?* Porque en `θ'' + ω²θ = 0` la frecuencia es `ω = √(g/L)` y
  la amplitud solo escala la solución.
- *¿Cómo sabes que tu integrador es correcto?* Se compara con la solución exacta (funciones elípticas de Jacobi).
- *¿La curva «Real» del tablero es RK4?* En el servidor la curva usa DOP853 de SciPy y los períodos de la tabla salen de la fórmula exacta (integral elíptica). El RK4 de la guía está en `integrators.py`: con él se hacen la figura de verificación y la tabla `tabla_periodos.csv`, y en modo local el navegador también usa RK4. Todos dan los mismos períodos al cuarto decimal.
- *¿Qué hace la IA y qué no?* Estima el período; no resuelve la ecuación ni reemplaza la deducción. Muestra su error.
- *¿Qué pasa si falla el servidor?* El dashboard calcula en el navegador con el mismo núcleo (modo local).

## Antes de exponer

- [ ] Probar el dashboard en el equipo de la exposición (`scripts/run`), o llevarlo ya compilado.
- [ ] Tener la deducción a mano impresa o escaneada.
- [ ] Un video corto de la demo grabado por si falla el equipo.
