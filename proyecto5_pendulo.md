# Proyecto 5 — El péndulo: ¿cuándo vale la aproximación lineal?

Ecuaciones Diferenciales · Unidad 3 · Ingeniería Informática / Multimedia
Institución Universitaria Colegio Mayor del Cauca

Fuente: *Proyectos de aula, Unidad 3* (PDF de la actividad, páginas 1–10).

---

## 1. Objetivo del proyecto

El grupo toma un sistema real modelado con una ecuación diferencial de segundo orden, lo **resuelve a mano**, lo **programa** y explica en una exposición qué dice la matemática sobre el comportamiento del sistema.

> **La regla que define este trabajo:** primero la matemática, después el programa. El programa no reemplaza la solución analítica: la **verifica**. Todo grupo debe mostrar que su simulación coincide con la solución exacta que dedujo a mano, y decir en qué se diferencian y por qué.
>
> Un proyecto que solo simula, sin la deducción, se califica sobre la mitad.

---

## 2. Modelo

Con L = 1 m y g = 9.81 m/s²:

**Ecuación real (no lineal):**

θ'' + (g/L)·sen θ = 0

**Aproximación lineal:**

θ'' + (g/L)·θ = 0

Condiciones iniciales: θ(0) = θ₀, θ'(0) = 0.

---

## 3. Qué se entrega

1. **El ejercicio resuelto a mano:** deducción de la ecuación, ecuación característica, solución general, aplicación de las condiciones iniciales y solución particular si la hay.
2. **El código**, en un repositorio o una carpeta comprimida, que corra sin errores y con un archivo **README** que diga cómo ejecutarlo. El README debe incluir la declaración de herramientas de IA usadas.
3. **Las gráficas y la animación** que pide el proyecto.
4. **La exposición** de 15 minutos más 5 de preguntas.

Lenguaje libre. Las indicaciones técnicas del PDF están en Python (numpy y matplotlib). JavaScript con p5.js, Processing o Unity también son válidos.

---

## 4. Lo que resuelven a mano

1. Resolver la ecuación **lineal** con θ(0) = θ₀, θ'(0) = 0, y deducir el período **T₀ = 2π√(L/g)**.
2. Observar que T₀ **no depende de la amplitud**. Esa es la propiedad que el péndulo real no tiene, y es justamente lo que el grupo va a medir.
3. Justificar la aproximación con el polinomio de Taylor de sen θ y estimar el error relativo en θ₀ = 10° y en θ₀ = 90°.

---

## 5. Lo que programan

1. Integrar numéricamente **las dos ecuaciones** y graficarlas juntas para θ₀ = 10°, 45°, 90° y 150°.
2. Medir el **período real** en cada caso (detectar cuándo la velocidad vuelve a cero) y hacer una tabla con el **error porcentual** frente a T₀.
3. Graficar el **error del período** en función de θ₀ y determinar a partir de qué ángulo el error supera el **1 %**.
4. Animar los dos péndulos lado a lado, soltados a 90°: se van desfasando a la vista.

---

## 6. Valores de referencia (PDF)

- T₀ = 2.0061 s
- Período real:
  - 10°: 2.0099 s (error 0.19 %)
  - 45°: 2.0863 s (error 3.8 %)
  - 90°: 2.3679 s (error 15.3 %)
  - 150°: 3.5351 s (error 43 %)
- El umbral del 1 % cae cerca de **23°**.

Los errores de la tabla están medidos frente al período real T, que es la convención de la guía.

---

## 7. En la exposición

- La animación de los dos péndulos desfasándose es el punto alto.
- Cierre con la pregunta: **¿un reloj de péndulo adelanta o atrasa si se le aumenta la amplitud?**
- Los tres (o cuatro) integrantes hablan. Quien no habla baja la calificación del grupo.
- Se responde sobre el propio trabajo y se reconoce lo que no se sabe.

---

## 8. Indicaciones técnicas

### De segundo orden a sistema de primer orden

Ningún integrador numérico resuelve directamente una ecuación de segundo orden: hay que convertirla primero. Con u = θ y v = θ', la ecuación queda:

- u' = v
- v' = −(g/L)·sen u (real)
- v' = −(g/L)·u (lineal)

### Esqueleto de referencia (RK4)

```python
import numpy as np
import matplotlib.pyplot as plt

def rk4(F, y0, t0, tf, h):
    t = np.arange(t0, tf + h, h)
    Y = np.zeros((len(t), len(y0)))
    Y[0] = y0
    for i in range(len(t) - 1):
        y, ti = Y[i], t[i]
        k1 = F(ti, y)
        k2 = F(ti + h/2, y + h/2 * k1)
        k3 = F(ti + h/2, y + h/2 * k2)
        k4 = F(ti + h, y + h * k3)
        Y[i+1] = y + h/6 * (k1 + 2*k2 + 2*k3 + k4)
    return t, Y
```

Para JavaScript o Processing: el paso de integración va dentro de `draw()` con un h fijo (no `deltaTime`).

### Errores que se repiten

- **Paso h demasiado grande.** Si la simulación se ve rara, reducir h diez veces y ver si cambia.
- **Grados y radianes.** Las funciones trigonométricas trabajan en radianes. Mezclarlos es el error silencioso más común.
- **Unidades inconsistentes.** Masa en kg y constantes en N/m; no mezclar gramos con newtons.
- **Comparar con la exacta en puntos distintos.** Las dos curvas deben evaluarse en el mismo vector de tiempos.

---

## 9. Criterios de evaluación (rúbrica, total 5.0)

| Criterio | Puntos | Qué se busca |
|---|---|---|
| Solución analítica correcta | 1.0 | Ecuación característica, solución general, condiciones iniciales bien aplicadas. Procedimiento visible, no solo el resultado. |
| Modelo bien implementado | 1.0 | El código resuelve la ecuación que dice resolver. Parámetros identificables y modificables. |
| Verificación contra lo exacto | 0.5 | Gráfica donde la curva numérica y la analítica se superponen, con comentario sobre la diferencia. |
| Visualización y animación | 1.0 | Ejes rotulados, unidades, leyenda. La animación comunica algo que la gráfica estática no. |
| Conclusión de ingeniería | 1.0 | Una recomendación concreta, justificada con los números obtenidos. |
| Exposición y defensa | 0.5 | Quince minutos, todos los integrantes hablan, se entiende sin leer diapositivas. Responden sobre su propio trabajo y reconocen lo que no saben. |

### Descuentos

- Código que no corre: **−1.0**
- Gráficas sin rótulos ni unidades: **−0.3**
- Entregar sin la parte a mano: la nota se calcula **sobre 3.0**
- Integrante que no expone: **0 para esa persona**

---

## 10. Lo mínimo que todo proyecto debe mostrar

1. La ecuación diferencial y de dónde sale cada término.
2. La solución analítica completa.
3. Una gráfica donde la curva simulada y la curva exacta se superpongan.
4. Una conclusión de ingeniería: qué valor de parámetro elegirían y por qué.

---

## 11. Uso de asistentes de IA

Pueden usarlos, con dos condiciones:

1. **Declararlo.** En el README, escribir qué herramienta se usó y para qué. Usarla no baja la nota; ocultarla sí.
2. **Responder por lo que se entrega.** En la defensa se pregunta sobre el código. Si nadie del grupo puede explicar una línea, esa parte no cuenta, aunque funcione.

La parte analítica se hace a mano. Es la que se evalúa en el parcial y la que permite darse cuenta de que una simulación está mal.

---

## 12. Orden recomendado para la solución

**Paso 1 — Deducción a mano (base de todo lo demás).**
- Ecuación real y de dónde sale cada término.
- Aproximación lineal, ecuación característica, solución general y condiciones iniciales.
- θ(t) = θ₀·cos(ωt), con ω = √(g/L), y T₀ = 2π√(L/g).
- Taylor de sen θ y error relativo en 10° y 90°.

**Paso 2 — Conversión a sistema de primer orden.**
- u = θ, v = θ'. Escribir u' = v y v' = −(g/L)·sen u (y la versión lineal).

**Paso 3 — Implementar RK4 y verificar la lineal.**
- Integrar la lineal y superponer la solución exacta θ₀·cos(ωt). Deben coincidir.
- Comentar la diferencia numérica y reducir h para ver si cambia.

**Paso 4 — Integrar la ecuación real.**
- Graficar real y lineal juntas para 10°, 45°, 90° y 150°. Rotular ejes, unidades y leyenda.

**Paso 5 — Medir el período real.**
- Detectar cuándo la velocidad vuelve a cero (T/2) y calcular T.
- Tabla con el error porcentual frente a T₀ (y frente a T, indicando cuál se usa).

**Paso 6 — Error del período contra el ángulo.**
- Graficar el error de θ₀ = 1° a 170° y determinar el ángulo donde supera el 1 % (≈23°).

**Paso 7 — Animación.**
- Dos péndulos lado a lado, soltados a 90°, que se desfasan. Verificar que se entienda sin leer nada.

**Paso 8 — Conclusión de ingeniería.**
- Elegir un ángulo máximo de trabajo o una tolerancia de error y justificarla con los números medidos.
- Responder la pregunta del reloj: si aumenta la amplitud, el período real crece y el reloj atrasa.

**Paso 9 — Entrega.**
- README con cómo ejecutar el código y la declaración de herramientas de IA.
- Revisar que el código corra desde cero y que todas las gráficas tengan rótulos y unidades.

**Paso 10 — Exposición.**
- Repartir las partes entre los integrantes; todos deben poder explicar su código.
- Estructura sugerida (15 min): problema (1), ecuación (2), solución analítica (2), aproximación (1), verificación (2), medición del período (2), animación (2), conclusión de ingeniería (2), cierre con la pregunta del reloj (1).
- Ensayar la defensa: preguntas sobre el código y sobre la deducción.

---

## 13. Checklist final

- [ ] Ecuación real y lineal, con el origen de cada término.
- [ ] Solución analítica completa, con condiciones iniciales aplicadas.
- [ ] T₀ deducido y explicado como independiente de la amplitud.
- [ ] Taylor y error estimado en 10° y 90°.
- [ ] Sistema de primer orden escrito.
- [ ] RK4 implementado; parámetros modificables.
- [ ] Gráfica numérica vs exacta superpuestas, con comentario.
- [ ] Períodos medidos en 10°, 45°, 90° y 150°; tabla de error.
- [ ] Gráfica del error contra θ₀ con el umbral del 1 %.
- [ ] Gráficas con ejes rotulados, unidades y leyenda.
- [ ] Animación de dos péndulos a 90°.
- [ ] Conclusión de ingeniería con recomendación concreta.
- [ ] Respuesta a la pregunta del reloj.
- [ ] README con instrucciones y declaración de IA.
- [ ] Código corre sin errores.
- [ ] Exposición de 15 min, todos los integrantes hablan.
