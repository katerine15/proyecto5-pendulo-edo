# Guion de exposición (15 min + preguntas)

Todos hablan. Reparto sugerido para 4 personas (si son 3, la persona D se reparte entre B y C).
Cada uno debe poder explicar *cualquier* parte de su bloque sin leer.

Pantalla principal: `simulador_3d.html` (doble clic, no necesita internet).

| Min | Quién | Qué se dice | Qué se muestra |
|---|---|---|---|
| 0–1 | A | La pregunta del proyecto: ¿hasta qué ángulo vale sen θ ≈ θ? | Simulador abierto en 90° |
| 1–5 | A | **Ejercicio a mano:** ecuación característica r² + g/L = 0, raíces ±iω (caso complejo), C₁ = θ₀ y C₂ = 0, θ(t) = θ₀cos(ωt), T₀ = 2π√(L/g) = 2.0061 s. Por qué T₀ no depende de la amplitud | Hoja del cuaderno, o el botón **Respuestas a mano** |
| 5–7 | B | Taylor: sen θ = θ − θ³/6 + …; error 0.51 % a 10° y 57.08 % a 90° | Pestaña **4. Taylor** |
| 7–10 | C | El código: de segundo orden a sistema (u = θ, v = θ'), RK4, y el período midiendo cuándo θ' vuelve a cero. **Verificación:** RK4 contra las dos soluciones exactas, diferencia de una millonésima de grado | `pendulo.py` (funciones `rk4` y `medir_periodo`) y pestaña **5. Verificación exacta** |
| 10–12 | D | **Punto alto:** botones 10°, 45°, 90°, 150°; los dos péndulos lado a lado, el real se atrasa. Tabla de períodos y umbral de 22.9° | Vista 3D, pestañas **2** y **3** y la tabla |
| 12–13 | D | Por qué RK4 y no Euler: Euler gana energía sola, RK4 casi no la cambia. Espacio de fases: la elipse del lineal contra la curva del real | Pestañas **7. Energía** y **6. Espacio de fases** |
| 13–15 | A | **Conclusión de ingeniería** y la pregunta del reloj | Banner del reloj en el simulador |

## Conclusión de ingeniería

- Hasta unos 20° el error del período es menor a 1 %: el modelo lineal sirve para cálculos.
- A 45° el error es 3.8 %, a 90° es 15.3 % y a 150° es 43 % (medido contra T real). El lineal deja de servir.
- Para un reloj, 1 % son casi 15 minutos por día. Recomendación: amplitudes de 5° o menos, y constantes.

| Amplitud | Error del período | Atraso de un reloj por día |
|---|---|---|
| 2° | 0.008 % | 7 s |
| 5° | 0.048 % | 41 s |
| 10° | 0.19 % | 2.7 min |
| 20° | 0.77 % | 11 min |

## Pregunta de cierre

*¿Un reloj de péndulo adelanta o atrasa si se le aumenta la amplitud?* **Atrasa.** Más amplitud → período
mayor → cada tic tarda más. La razón física: sen θ < θ, así que la fuerza real que lo devuelve es menor.

## Preguntas probables

- **¿Por qué no resolvieron a mano la ecuación con sen θ?** No es lineal: no sirve la ecuación característica.
  Por eso se integra con RK4.
- **¿Cómo saben que la simulación del péndulo real está bien?** Porque se compara con su solución exacta
  (funciones elípticas de Jacobi) y la diferencia es de una millonésima de grado (pestaña 5). Además el mismo
  RK4 reproduce θ₀cos(ωt) en el lineal, y las pruebas de `tests/` comprueban los períodos de referencia.
- **¿Por qué la velocidad cero da medio período?** Sale del reposo en un extremo y la velocidad vuelve a ser
  cero en el extremo opuesto, a la mitad de la oscilación.
- **¿Por qué RK4 y no Euler?** Con el mismo paso, Euler explícito hace crecer la energía (el péndulo se acelera
  solo); RK4 la conserva casi exacta (pestaña 7).
- **¿Por qué en radianes?** sen θ ≈ θ y la serie de Taylor solo valen en radianes.
- **¿Qué pasa si cambian L?** T₀ crece con √L, pero el error relativo depende solo de θ₀: el umbral no cambia.
- **¿Qué pasa cerca de 180°?** El período crece sin límite: arriba está el equilibrio inestable.
- **¿Por qué el error del período (0.19 % a 10°) es menor que el de la fuerza (0.51 %)?** El error de la fuerza
  es grande solo en los extremos; cerca del centro sen θ ≈ θ sigue siendo bueno.

## Antes de exponer

- [ ] Abrir `simulador_3d.html` en el equipo de la exposición y probar los botones de los casos.
- [ ] Llevar la hoja del ejercicio a mano (puntos 1, 2 y 3).
- [ ] Correr `python pendulo.py` una vez para tener las figuras, y `python -m pytest` para mostrar que pasa.
- [ ] Si el equipo no muestra 3D, usar `simulador.html` o la vista 2D del simulador.
