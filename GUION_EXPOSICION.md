# Guion de exposición (15 min + 5 de preguntas)

**Pantalla:** `simulador_3d_exposicion.html` (doble clic, no necesita internet). Se avanza haciendo
scroll y el menú de arriba salta a cada parte (Portada · 1 · A mano · 2 · RK4 · 3 · Período · 4 · 3D y cierre).
La página no muestra nombres: dice «Parte 1… 4» y «Cierre». El reparto es este:

| Min | Quién | Qué se dice | Qué se muestra |
|---|---|---|---|
| 0:00–3:30 | Santiago | La pregunta del proyecto y el **Punto 1** (pasos 01 a 11, hasta T₀ ≈ 2.0061 s) | Portada y Parte 1: el 3D se oculta y aparece la hoja con el ejercicio |
| 3:30–6:00 | Cristian | **Punto 2 y Punto 3** (pasos 12 a 21: Taylor, 0.51 % y 57.08 %) | Parte 1, segunda mitad de la hoja |
| 6:00–9:30 | Diego | **RK4 y verificación** contra las dos soluciones exactas | Parte 2: hoja + `verificacion.py` y la gráfica de verificación |
| 9:30–12:30 | Caterine | **Medir el período**, tabla de los 4 casos y umbral del 1 % (22.9°) | Parte 3: tabla en vivo y curva de error |
| 12:30–14:00 | Diego | **Demo 3D:** 90° contra 10° | Parte 4: render 3D |
| 14:00–15:00 | Caterine | **Conclusión de ingeniería** y la pregunta del reloj | Parte 4: nota de la conclusión |
| 15:00–20:00 | Todos | Preguntas | Cierre |

Todos hablan: quien no expone saca 0. Cada uno debe poder explicar *cualquier* parte de su bloque
sin leer, incluido el Python de su parte.

## Parte 1 · el ejercicio a mano (Santiago y Cristian, 6 min)

La hoja tiene 21 pasos numerados, igual que el PDF (5) del taller. Se recorre con scroll y se
detiene en los marcados con ★.

- **Santiago · Punto 1** (3:30): 01 ecuación y condiciones · 03 se reemplaza y se factoriza eʳᵗ ·
  ★ 04 se despeja r = ±iω (i = √−1, ω = frecuencia natural) · 05 solución general (e⁰ = 1) ·
  06 y 08 las dos condiciones iniciales (C₁ = θ₀, C₂ = 0) · ★ 09 θ(t) = θ₀cos(√(g/L)·t) ·
  ★ 10 T₀ = 2π√(L/g) · ★ 11 evaluación numérica: T₀ ≈ 2.0061 s con L = 1 m y g = 9.81 m/s².
- **Cristian · Punto 2** (≈ 30 s): ★ 12 θ₀ no aparece en T₀ (2.0061 s para cualquier ángulo);
  el péndulo real sí depende de la amplitud (T > T₀, tarda más).
- **Cristian · Punto 3** (≈ 2 min): 13 y 14 Taylor y Maclaurin · 15 derivadas de sen θ en 0 · 16 la serie ·
  ★ 17 sen θ ≈ θ · ★ 19 y 20 error de 0.51 % a 10° y de 57.08 % a 90° · 21 tabla resumen y conclusión.
- Cierre de Cristian: «Ahora vamos a comprobar con el programa cuándo el péndulo real deja de obedecer T₀».

Por defecto la hoja muestra solo el LaTeX. Botones (arriba de la tarjeta y también en el encabezado de la hoja):
- **✎ Ver pasos:** muestra una nota a lápiz sobre cada ecuación con lo que hace ese paso, dicho simple.
  Sirve de apoyo para explicar; otro toque las oculta.
- **‹/› Ver cód:** saca el editor con el Python de cada paso desde detrás de la hoja. Úsenlo si la profe
  pregunta por el código.
- **Ver código LaTeX:** muestra el código fuente de las fórmulas.

Las hojas de RK4 (Parte 2) y del período (Parte 3) también tienen **✎ Ver pasos**.

## Parte 4 · la demo (Diego)

Son 90 segundos: lo importante son estos tres pasos.

1. Botón **90°** y **Reiniciar**: los dos salen de θ(0) = 90° con θ'(0) = 0.
2. Dejar correr unos 10 s: el lineal (violeta) completa más oscilaciones que el real (dorado).
3. Botón **10°**: las dos pesas se mueven juntas. Ese es el contraste.

Solo si sobra tiempo: **🐢 Lento** para ver el desfase, mover **L** y **g**, o la cámara (arrastrar gira;
la rueda, el pellizco o **+ / −** acercan; doble clic sobre un péndulo lo enfoca; **⟲** vuelve a la vista completa).

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
