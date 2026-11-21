# Proyecto 5 — El péndulo: ¿cuándo vale la aproximación lineal?

Ecuaciones Diferenciales · Unidad 3 · Institución Universitaria Colegio Mayor del Cauca

Compara el péndulo real `θ'' + (g/L) sen θ = 0` con su aproximación lineal `θ'' + (g/L) θ = 0`
(L = 1 m, g = 9.81 m/s²) y mide hasta qué amplitud sirve la aproximación.

**Resultado principal:** T₀ = 2.0061 s. El error del período pasa del 1 % a partir de θ₀ ≈ 23°
(22.8° midiendo contra T₀, 22.9° midiendo contra el período real).

No necesita servidor ni instalar nada para verlo: `simulador_3d.html` abre con doble clic.
El tablero web más grande quedó como extra en [`tablero-avanzado/`](tablero-avanzado/).

## Archivos

| Archivo | Qué es |
|---|---|
| `simulador_3d.html` | **Simulador principal** para la exposición: vista 3D y 2D, casos del enunciado, tabla de períodos, 7 gráficas y el ejercicio a mano paso a paso |
| `simulador_3d_exposicion.html` | Guion visual de exposición en 4 voces: la deducción del Punto 1 y la verificación del Punto 2 aparecen en dos columnas, **LaTeX renderizado** a la izquierda y **Python** (`math`/`numpy`) a la derecha. Incluye modo claro/oscuro y oculta el 3D mientras se lee la ecuación |
| `GUION_EXPOSICION.md` | Quién habla, cuánto tiempo, qué se muestra y preguntas probables |
| `requirements.txt` | Librerías de Python que necesita el proyecto |
| `pendulo.py` | Programa principal: modelo, RK4, solución exacta, medición del período, gráficas y animación |
| `pendulo_colab.ipynb` | El mismo código en cuaderno, para correrlo en Google Colab (sirve desde el navegador del celular) |
| `simulador.html` | Simulador ligero en un solo archivo (2D), por si el equipo no soporta 3D |
| `vendor/` | Librerías guardadas localmente (Three.js r128, Tailwind compilado, Font Awesome y KaTeX para las fórmulas del simulador de exposición) para que funcione sin internet |
| `tailwind.config.js`, `tailwind.input.css` | Solo para recompilar `vendor/tailwind.css` si se cambian clases del simulador 3D |
| `figuras/` | Resultados de `pendulo.py`: 3 gráficas PNG, la animación GIF y la tabla CSV |
| `tests/` | Pruebas automáticas de `pendulo.py` (T₀, los 4 períodos, verificación, umbral y Taylor) |
| `tablero-avanzado/` | Extra: tablero web con servidor (FastAPI + React). Necesita Python 3.12, `uv` y Node 22. Ver su README |

## Cómo ejecutarlo

### Código Python

**En el computador**

```bash
pip install -r requirements.txt
python pendulo.py
```

**En Visual Studio Code**

Se necesita instalado una sola vez: Python 3 (en Windows, marcar *Add Python to PATH* al
instalarlo), Git y VS Code con la extensión **Python**.

1. En VS Code: *Ctrl+Shift+P* → **Git: Clone** → pegar
   `https://github.com/katerine15/proyecto5-pendulo-edo` y abrir la carpeta.
2. Abrir la terminal (*Terminal → New Terminal*) y escribir:
   ```bash
   pip install -r requirements.txt
   ```
3. Abrir `pendulo.py` y darle ▶ (*Run Python File*), arriba a la derecha, o en la terminal:
   `python pendulo.py`.
4. Tarda cerca de un minuto. La tabla de períodos sale en la terminal y las gráficas y el GIF
   quedan en la carpeta `figuras/`.

- El cuaderno `pendulo_colab.ipynb` también abre en VS Code, celda por celda como en Colab.
  Necesita además la extensión **Jupyter** y `pip install ipykernel`.
- Si en Windows no se reconocen `pip` o `python`, usar `py -m pip install -r requirements.txt`
  y `py pendulo.py`.

**Pruebas automáticas**

```bash
python -m pytest
```

Deben salir 10 pruebas en verde (tarda unos segundos).

**En Google Colab (sin instalar nada)**

1. Entrar a https://colab.research.google.com
2. *Archivo → Subir cuaderno* y elegir `pendulo_colab.ipynb`
3. *Entorno de ejecución → Ejecutar todas*

### Simuladores

Abrir `simulador_3d.html` (o `simulador.html`) con doble clic en cualquier navegador,
o desde VS Code con la extensión *Live Server*. No necesitan Python.
No necesitan internet; sin conexión solo cambia la tipografía.
Si el repositorio se publica con GitHub Pages, `index.html` lleva a `simulador_3d.html`.

**Las 7 gráficas del simulador 3D**

1. θ(t) en tiempo real, real contra lineal.
2. Los 4 casos del enunciado (10°, 45°, 90°, 150°).
3. Error del período contra θ₀, con el umbral del 1 %.
4. Taylor: sen θ, θ y θ − θ³/6.
5. Verificación: RK4 contra la solución exacta del péndulo real (funciones elípticas de Jacobi) y contra θ₀cos(ωt).
6. Espacio de fases: θ contra θ'.
7. Energía con Euler explícito, Euler simpléctico y RK4: por qué se usa RK4.

El botón **Respuestas a mano** muestra los puntos 1, 2 y 3 renglón por renglón, igual que en el cuaderno.

## Qué produce `pendulo.py`

1. `1_verificacion_lineal.png` — numérica (RK4) vs exacta `θ0·cos(ωt)` del modelo lineal y su diferencia (~1e-11 rad).
2. `2_real_vs_lineal.png` — las dos ecuaciones para θ0 = 10°, 45°, 90° y 150°.
3. `3_error_periodo.png` — error del período frente a T0 entre 1° y 170°, con el umbral del 1 %.
4. `4_animacion_90grados.gif` — los dos péndulos soltados a 90°, lado a lado.
5. `tabla_periodos.csv` — período real y error porcentual (frente a T0 y frente a T).

## Parámetros

En `pendulo.py` están al inicio: `g`, `L`, el paso `h` y la lista `ANGULOS`. Si se cambian, se
vuelve a correr y todo se recalcula. En el simulador 3D, L y g se cambian con los deslizadores.

## Uso de inteligencia artificial

- **Claude (Anthropic):** estructura de `pendulo.py`, el cuaderno de Colab, `simulador.html`,
  la revisión de los valores de referencia y la redacción del desarrollo.
- **Gemini (Google):** diseño inicial de `simulador_3d.html`. Claude lo revisó y corrigió:
  el péndulo lineal pasó a usar la solución exacta deducida a mano, se quitó la fricción
  (el modelo es sin amortiguamiento), se corrigió el umbral (22.9°, no 23.1°), se amplió el eje
  de la gráfica de error y se guardaron las librerías localmente.
- **Del tablero avanzado** (`tablero-avanzado/`, hecho por el grupo con apoyo de IA, ver su README) se
  tomaron las ideas de la verificación con la solución exacta elíptica, el espacio de fases, la
  comparación de energía Euler/RK4 y el guion de exposición. Claude las implementó en `simulador_3d.html`,
  escribió `tests/` y `GUION_EXPOSICION.md`, y reescribió la ventana del ejercicio a mano.

El grupo revisó, ejecutó y es responsable de cada línea.
<!-- Ajusten esta sección según lo que realmente hayan hecho. -->
