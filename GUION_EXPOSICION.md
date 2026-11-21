# Guion de exposición (15 min + 5 de preguntas)

**Pantalla:** `simulador_3d_exposicion.html` (doble clic, no necesita internet). Se avanza haciendo
scroll: cada bloque es la intervención de un integrante y el menú de arriba salta a cada uno
(Portada · 1 · A mano · 2 · RK4 · 3 · Período · 4 · 3D y cierre).

Todos hablan: quien no expone saca 0. Cada uno debe poder explicar *cualquier* parte de su bloque
sin leer, incluido el Python que se ve en pantalla. Si son 3, el Integrante 4 se reparte entre el 2 y el 3.

| Min | Quién | Qué se dice | Qué se muestra |
|---|---|---|---|
| 0–1 | Integrante 1 | La pregunta del proyecto: ¿hasta qué ángulo vale sen θ ≈ θ? | Portada |
| 1–5 | Integrante 1 | **El ejercicio a mano** (Puntos 1, 2 y 3). Ver «Bloque 1» abajo | Bloque 1: el 3D se oculta y aparece el ejercicio a todo el ancho, con la hoja (LaTeX) a la izquierda y el editor (Python) a la derecha |
| 5–8 | Integrante 2 | **Del papel al código:** de segundo orden a sistema (u = θ, v = θ'), el paso RK4 y la verificación contra las dos soluciones exactas | Bloque 2: el sistema, el paso RK4, las dos columnas LaTeX ↔ Python y la gráfica de verificación |
| 8–11 | Integrante 3 | **Período y umbral:** se mide cuándo θ' vuelve a cero (medio período), la tabla de los 4 casos y el error del 1 % en 22.9° | Bloque 3: tabla en vivo y curva de error con la línea roja del 1 % |
| 11–15 | Integrante 4 | **Punto alto:** los dos péndulos soltados a 90°, el real se atrasa. Después, la conclusión de ingeniería y la pregunta del reloj | Bloque 4: render 3D (botones 90° y 10°) |
| 15–20 | Todos | Preguntas | Bloque «Cierre y preguntas» |

## Bloque 1 · el ejercicio a mano (Integrante 1, 4 min)

La tarjeta tiene 20 pasos numerados. No hay tiempo de leerlos todos: se recorren con scroll y se
detiene en los marcados con ★.

- **Punto 1** (≈ 2.5 min): 01 ecuación y condiciones · 03 se reemplaza y se factoriza eʳᵗ ·
  ★ 04 se despeja r = ±iω · 05 solución general · 06 y 08 las dos condiciones iniciales (C₁ = θ₀, C₂ = 0) ·
  ★ 09 θ(t) = θ₀cos(ωt) · ★ 10 T₀ = 2π√(L/g) = 2.0061 s.
- **Punto 2** (≈ 20 s): ★ 11 θ₀ no aparece en T₀; el péndulo real sí depende de la amplitud (T > T₀).
- **Punto 3** (≈ 1 min): 14 derivadas de sen θ en 0 · 15 serie hasta θ⁵ · ★ 16 sen θ ≈ θ ·
  ★ 18 y 19 error de 0.51 % a 10° y de 57.08 % a 90° · 20 tabla resumen.
- Cierre del bloque: «Ahora vamos a comprobar con el programa cuándo el péndulo real deja de obedecer T₀».

Para cada paso, a la derecha está la misma operación en Python con su salida real (`# → T0 = 2.0061 s`).
El botón **Ver código LaTeX** muestra el código fuente de las fórmulas, por si lo piden.

## Bloque 4 · la demo (Integrante 4)

1. Botón **90°** y **Reiniciar**: los dos salen de θ(0) = 90° con θ'(0) = 0.
2. Dejar correr unos 10 s: el lineal (violeta) completa más oscilaciones que el real (dorado).
3. Botón **10°**: las dos pesas se mueven juntas. Ese es el contraste.
4. Mover **L** y **g** para mostrar que los parámetros se pueden modificar.
5. Cámara: arrastrar gira; la rueda, el pellizco o **+ / −** acercan; doble clic sobre un péndulo lo enfoca;
   **⟲** vuelve a la vista completa.

## Conclusión de ingeniería

- Si se acepta como mucho 1 % de error en el período, el ángulo de trabajo debe ser **≤ 23°** (umbral 22.9°).
- Si se necesita precisión de tiempo, se diseña con **θ₀ ≤ 10°**, donde el error es 0.19 %. Para un reloj
  conviene aún menos: a 5° atrasa 41 s por día.
- A 45° el error es 3.8 %, a 90° es 15.3 % y a 150° es 43 % (medido contra T real): el modelo lineal deja de servir.

| Amplitud | Error del período | Atraso de un reloj por día |
|---|---|---|
| 2° | 0.008 % | 7 s |
| 5° | 0.048 % | 41 s |
| 10° | 0.19 % | 2.7 min |
| 20° | 0.76 % | 11 min |
| 23° | 1.0 % | 14.5 min |
| 90° | 15.3 % | 220 min |

## Pregunta de cierre

*¿Un reloj de péndulo adelanta o atrasa si se le aumenta la amplitud?* **Atrasa.** Más amplitud → período
mayor → cada tic tarda más. La razón física: sen θ < θ, así que la fuerza real que lo devuelve es menor.

## Preguntas probables

- **¿Por qué T₀ no depende de la amplitud?** En θ'' + ω²θ = 0 la frecuencia es ω = √(g/L); θ₀ solo escala la solución.
- **¿Por qué no resolvieron a mano la ecuación con sen θ?** No es lineal: no sirve la ecuación característica.
  Por eso se integra con RK4.
- **¿Por qué la serie termina en θ⁵?** Es el polinomio de Taylor de grado 5: los términos siguientes son todavía
  más pequeños. Por eso la primera igualdad es ≈ y no =.
- **¿Cómo saben que la simulación está bien?** RK4 reproduce θ₀cos(ωt) en el lineal (diferencia ~1e-11 rad) y
  coincide con la solución exacta del real (funciones elípticas de Jacobi). Además, `python -m pytest` comprueba
  los períodos de referencia.
- **¿Por qué la velocidad cero da medio período?** Sale del reposo en un extremo y la velocidad vuelve a ser
  cero en el extremo opuesto, a la mitad de la oscilación.
- **¿Por qué RK4 y no Euler?** Con el mismo paso, Euler explícito hace crecer la energía (el péndulo se acelera
  solo); RK4 la conserva casi exacta.
- **¿Qué pasa si agrandan el paso h?** La trayectoria se deforma; al reducirlo diez veces la curva se estabiliza.
- **¿Por qué en radianes?** sen θ ≈ θ y la serie de Taylor solo valen en radianes.
- **¿Qué pasa si cambian L?** T₀ crece con √L, pero el error relativo depende solo de θ₀: el umbral no cambia.
- **¿Qué pasa cerca de 180°?** El período crece sin límite: arriba está el equilibrio inestable.
- **¿Por qué el error del período (0.19 % a 10°) es menor que el de la fuerza (0.51 %)?** El error de la fuerza
  es grande solo en los extremos; cerca del centro sen θ ≈ θ sigue siendo bueno.

## Antes de exponer

- [ ] Abrir `simulador_3d_exposicion.html` en el equipo de la exposición y recorrerlo completo con scroll.
- [ ] Probar en ese proyector los botones 10°, 45°, 90° y 150° y el zoom del 3D.
- [ ] Llevar la hoja del ejercicio a mano (Puntos 1, 2 y 3, con el error a 10° y 90°).
- [ ] Correr `python pendulo.py` una vez para tener las figuras, y `python -m pytest` para mostrar que pasa.
- [ ] Ensayar con cronómetro: 15 min justos y todos hablan.
- [ ] Respaldo: si el equipo no muestra 3D, `simulador_3d.html` tiene vista 2D y `simulador.html` es solo 2D.
