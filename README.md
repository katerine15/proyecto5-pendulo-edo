# Proyecto 5 — El péndulo: ¿cuándo vale la aproximación lineal?

Ecuaciones Diferenciales · Unidad 3 · Institución Universitaria Colegio Mayor del Cauca

Compara el péndulo real `θ'' + (g/L) sen θ = 0` con su aproximación lineal `θ'' + (g/L) θ = 0`
(L = 1 m, g = 9.81 m/s²) y mide hasta qué amplitud sirve la aproximación.

> **Resultado principal:** T₀ = 2.0061 s. El error del período pasa del 1 % a partir de θ₀ ≈ 23° (22.9°).

---

## ▶ Ver el proyecto

| Forma | Qué hacer | Necesita instalar |
|---|---|---|
| **En línea (recomendado)** | Abrir **https://katerine15.github.io/proyecto5-pendulo-edo/** | Nada |
| **Descargado** | En GitHub: botón verde **Code → Download ZIP**, descomprimir y doble clic en **`index.html`** | Nada (funciona sin internet) |
| **Programa en Python** | Doble clic en **`Ejecutar Python.bat`** (Windows) o ver [Instalación](#instalación-del-programa-en-python) | Python 3 |

La página de la exposición contiene todo el proyecto: el ejercicio resuelto a mano en LaTeX, su paralelo en Python,
la verificación con RK4, la tabla de períodos, el umbral del 1 %, la animación 3D de los dos péndulos y la conclusión.

---

## Instalación del programa en Python

La página **no** necesita esto. Solo hace falta para correr `pendulo.py`, que genera las gráficas, la tabla y la
animación GIF.

### Requisitos

| Requisito | Versión | Para qué |
|---|---|---|
| Python | 3.9 o superior (probado con 3.12) | Lenguaje del programa |
| numpy | cualquiera reciente (probado con 2.5) | Cálculo numérico |
| matplotlib | cualquiera reciente (probado con 3.11) | Gráficas y animación |
| pillow | cualquiera reciente (probado con 13.0) | Guardar la animación como GIF |
| pytest | cualquiera reciente | Pruebas automáticas (opcional) |

Las librerías se instalan solas con `requirements.txt`; solo hay que tener Python.

### 1. Instalar Python (solo si no lo tiene)

Para saber si ya está instalado, abrir una terminal y escribir `python --version` (en Windows también `py --version`).
Si responde `Python 3.x`, pasar al paso 2.

- **Windows:** descargar de https://www.python.org/downloads/ y, **en la primera pantalla del instalador, marcar
  la casilla «Add python.exe to PATH»** antes de darle *Install Now*.
- **macOS:** descargar de https://www.python.org/downloads/ o, con Homebrew, `brew install python`.
- **Linux (Debian/Ubuntu):** `sudo apt install python3 python3-pip python3-venv`.

### 2. Ejecutar

**Windows, sin terminal:** doble clic en **`Ejecutar Python.bat`**. La primera vez instala las librerías (un minuto
aproximadamente); después corre el programa, muestra la tabla de períodos y abre la carpeta `python/figuras/`.

**Cualquier sistema, desde la terminal** (abierta en la carpeta del proyecto):

```bash
# Windows
py -m pip install -r python/requirements.txt
py python/pendulo.py

# macOS / Linux
python3 -m pip install -r python/requirements.txt
python3 python/pendulo.py
```

<details>
<summary><b>Opcional: instalar en un entorno virtual</b> (no mezcla las librerías con el resto del equipo)</summary>

```bash
# Windows (PowerShell)
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r python/requirements.txt
python python/pendulo.py

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
pip install -r python/requirements.txt
python python/pendulo.py
```

Para salir del entorno: `deactivate`.
</details>

<details>
<summary><b>Opcional: desde Visual Studio Code</b></summary>

1. Instalar la extensión **Python** (de Microsoft).
2. *File → Open Folder* y elegir la carpeta del proyecto.
3. Abrir `python/pendulo.py` y darle ▶ (*Run Python File*), arriba a la derecha.
   La primera vez, en la terminal de VS Code: `pip install -r python/requirements.txt`.
</details>

### 3. Qué debe salir

Tarda cerca de un minuto. En la terminal:

```
Verificación lineal: diferencia máxima numérica vs exacta = 1.88e-11 rad

T0 (lineal) = 2.0061 s

   θ0 | T real [s] | error vs T0 | error vs T
-----------------------------------------------
  10° |     2.0099 |       0.19% |      0.19%
  45° |     2.0863 |       4.00% |      3.84%
  90° |     2.3678 |      18.03% |     15.28%
 150° |     3.5351 |      76.22% |     43.25%

El error del período supera el 1 % a partir de θ0 ≈ 22.8°
```

Y en `python/figuras/` quedan:

| Archivo | Qué muestra |
|---|---|
| `1_verificacion_lineal.png` | RK4 contra la solución a mano θ₀·cos(ωt): las curvas se superponen (diferencia ~10⁻¹¹ rad) |
| `2_real_vs_lineal.png` | Las dos ecuaciones a 10°, 45°, 90° y 150° |
| `3_error_periodo.png` | Error del período contra θ₀, con el umbral del 1 % |
| `4_animacion_90grados.gif` | Los dos péndulos soltados a 90°, desfasándose |
| `tabla_periodos.csv` | La tabla de períodos y errores |

### 4. Pruebas automáticas (opcional)

```bash
cd python
python -m pytest
```

Deben salir **10 pruebas en verde**: comprueban T₀, los cuatro períodos, la verificación, el umbral y Taylor.

---

## Problemas frecuentes

| Problema | Solución |
|---|---|
| `'python' no se reconoce como un comando` (Windows) | Usar `py` en vez de `python`. Si tampoco funciona, reinstalar Python marcando **Add python.exe to PATH**. |
| `'pip' no se reconoce` | Usar `py -m pip ...` (Windows) o `python3 -m pip ...` (macOS/Linux). |
| `ModuleNotFoundError: No module named 'numpy'` (o matplotlib, PIL) | Falta instalar las librerías: `py -m pip install -r python/requirements.txt`. |
| `externally-managed-environment` (Linux) | Usar el entorno virtual de arriba. |
| El `.bat` se abre y se cierra | Abrirlo desde una terminal para ver el mensaje, o instalar Python como en el paso 1. |
| La página abre pero no se ve el 3D | El navegador no tiene WebGL activo: activar la *aceleración por hardware* en la configuración del navegador o usar Chrome/Edge/Firefox actualizados. El resto de la página (fórmulas, gráficas, tablas) funciona igual. |
| Las letras de la página cambian sin internet | Normal: sin conexión usa la tipografía del sistema. Las fórmulas y el 3D funcionan igual. |

---

## Estructura

```
Proyecto 5 - Pendulo/
├── index.html              Página de la exposición (abrir con doble clic, no necesita internet)
├── Ejecutar Python.bat     Corre el programa en Python con doble clic (Windows)
├── web/                    Lo que usa index.html
│   ├── three.min.js          Three.js r128: dibuja la escena 3D
│   ├── pendulo_modelo.js     Modelo 3D del aparato (hecho en Blender 5.2)
│   └── katex/                KaTeX: dibuja las fórmulas en LaTeX
├── python/                 El programa en Python
│   ├── pendulo.py            Modelo, RK4, solución exacta, período, gráficas y animación
│   ├── requirements.txt      Librerías que necesita
│   ├── tests/                Pruebas automáticas
│   ├── pytest.ini
│   └── figuras/              Resultados de pendulo.py (ya generados)
├── solucion-a-mano/        El ejercicio resuelto a mano (Puntos 1, 2 y 3)
└── docs/
    ├── Enunciado - Proyectos EDO U3.pdf
    └── GUION_EXPOSICION.md   Quién habla, cuánto tiempo, qué se muestra y preguntas probables
```

## Qué entrega cada parte del enunciado

| Se pide | Dónde está |
|---|---|
| Ejercicio resuelto a mano | `solucion-a-mano/` y la Parte 1 de la página (la misma solución en LaTeX, paso a paso) |
| Código que corra, con README | `python/pendulo.py` y este README |
| Las dos ecuaciones a 10°, 45°, 90° y 150° | `python/figuras/2_real_vs_lineal.png` y la gráfica de casos de la página |
| Tabla de períodos con el error frente a T₀ | `python/figuras/tabla_periodos.csv`, la terminal y la Parte 3 de la página |
| Error del período contra θ₀ y umbral del 1 % | `python/figuras/3_error_periodo.png` y la Parte 3 de la página |
| Simulación superpuesta con la solución exacta | `python/figuras/1_verificacion_lineal.png` y la Parte 2 de la página (RK4 contra las dos soluciones exactas) |
| Animación de los dos péndulos a 90° | `python/figuras/4_animacion_90grados.gif` y la escena 3D de la página |
| Conclusión de ingeniería | Parte 4 de la página y `docs/GUION_EXPOSICION.md` |

## Parámetros

Al inicio de `python/pendulo.py` están `g`, `L`, el paso `h` y la lista `ANGULOS`. Si se cambian, se vuelve a correr
y todo se recalcula. En la página, L y g se cambian con los deslizadores debajo de la escena 3D.

## Uso de inteligencia artificial

- **Claude (Anthropic):** estructura de `pendulo.py`, la página de la exposición (escena 3D, gráficas, hojas en
  LaTeX con su paralelo en Python), el modelo 3D en Blender, las pruebas, la revisión de los valores de
  referencia y la redacción del guion.
- **Gemini (Google):** diseño inicial del simulador 3D, revisado y corregido después.

El grupo revisó, ejecutó y es responsable de cada línea.
