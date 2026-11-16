# Péndulo — ¿cuándo vale la aproximación lineal?

Dashboard interactivo del **Proyecto 5** de Ecuaciones Diferenciales (Unidad 3). Compara el péndulo real
`θ'' + (g/L) sin θ = 0` con su aproximación lineal `θ'' + (g/L) θ = 0`, mide el error del período,
verifica la simulación contra la solución exacta y predice el período con una red neuronal pequeña.

> **Regla del proyecto:** primero la matemática, después el programa. Este software **verifica** la solución
> analítica deducida a mano; no la reemplaza. La deducción a mano se entrega aparte (ver `docs/`).

## Qué hay en este repositorio

| Carpeta | Qué es | Qué necesita |
|---|---|---|
| raíz (`backend/`, `frontend/`, `docs/`, `assets/`, `scripts/`) | **Tablero principal** para la exposición | Python 3.12+ con `uv` y Node.js 20+ |
| [`version-ligera/`](version-ligera/) | **Respaldo**: `pendulo.py` (RK4, gráficas, GIF), cuaderno de Colab y dos simuladores HTML | Solo Python, o nada (los HTML abren con doble clic) |

Los dos dan los mismos números: T₀ = 2.0061 s, períodos 2.0099 / 2.0863 / 2.3679 / 3.5351 s y umbral del 1 % en 22.9°.

## Qué muestra

Siete vistas del péndulo y una del segundo modelo, en el menú lateral (pestañas inferiores en el móvil). La URL guarda la vista:
`#/simulacion`, `#/verificacion`, `#/laboratorio`, `#/diseno`, `#/figuras`, `#/datos`, `#/fundamento`, `#/resorte`.

| Vista | Qué comunica |
|---|---|
| **Simulación** | Frase con la respuesta («A 90°, el modelo lineal subestima el período real en un 15.3 %», error relativo al período real T, como las cifras de la guía). Escena 3D interactiva con dos péndulos y sus relojes de escape soltados al mismo ángulo (arrastre de lenteja en 3D para fijar θ₀, cámara orbital con presets, vectores 3D de fuerza/velocidad, anillo exacto elíptico, transportador en relieve y estela). |
| **Verificación** | Curvas lineal, real (RK4) y exacta (funciones elípticas) con área de desfase y cursor arrastrable; cuadrícula interactiva y superposición normalizada de los cuatro ángulos de la guía (**10°, 45°, 90° y 150°**); error del período contra ángulo con el límite del 1 %; el período real contra su desarrollo en serie. |
| **Laboratorio** | Espacio de fases 2D, **Paisaje 3D interactivo de energía E(θ, ω)**, **Duelo 3D Euler explícito vs Euler simpléctico** (donde Euler gana energía y da vueltas completas), conservación de la energía a 50 s y orden de convergencia observado (pendientes ≈ 1, 2 y 4). |
| **Diseño** | La conclusión de ingeniería: con el error de período que se acepta, el ángulo máximo y cuánto atrasa un reloj. Tabla por tolerancia, curva del atraso, y botones para copiar la conclusión, descargar los datos en CSV e imprimir. |
| **Figuras** | Ocho figuras listas para el informe (seis 2D y dos 3D) y una animación 3D en cámara lenta, dibujadas por el servidor **al instante con los parámetros de la pantalla**; PNG, SVG, GIF, CSV o todo en un ZIP. |
| **Datos y predicción** | Tabla de 10°, 45°, 90° y 150°; red neuronal que predice el período, contrastada con el cálculo exacto. |
| **Fundamento** | El modelo, conversión a sistema de primer orden (`u = θ, v = θ'`), solución lineal, gráfica interactiva del polinomio de Taylor de `sen θ` (con errores en 10° y 90°) y período exacto elíptico. |
| **Masa-resorte** | Segundo modelo en 3D interactivo (`resorte.glb` con resorte helicoidal real y cilindro hidráulico aletado): modo de un rig (analítica vs RK4) y comparador 3D de los **tres regímenes** (`ζ = 0.3, 1.0, 1.5`). |

La escena 3D usa un modelo hecho en **Blender** (`assets/blender/`) que el navegador carga y mueve con los datos de la simulación. Si el navegador no tiene WebGL, cae a una escena SVG.
Diseño y movimiento: [`docs/DISENO.md`](docs/DISENO.md).

## La escena 3D: arrastre, materiales y cuerda

- **Arrastrar la lenteja** con el ratón fija el ángulo de suelta, a **los dos lados** y también por encima de la horizontal (hasta ±170°). Hay un selector «Lado de suelta» para hacerlo sin ratón. Soltar a la izquierda es el espejo de soltar a la derecha: la física es simétrica.
- **Materiales de péndulo clásico:** nogal con veta para la base, latón pulido, acero cepillado, hierro oscuro, cobre y vidrio; la espiral del resorte es de bronce. Los modelos de Blender traen todos los materiales con el valor por defecto, así que se pintan por nombre al cargarlos (`frontend/src/features/scene/classicMaterials.ts`). Las texturas se dibujan con código: no pesan en el modelo ni se descargan.
- **Cuerda con física** (`core-ts/rope.ts`, `features/scene/ropeVisual.ts`): el brazo es una cuerda de cáñamo. **Tensa**, a su distancia máxima, actúa como un cuerpo sólido: es el péndulo de la guía. **Floja**, cuelga y se mueve como una cuerda de verdad (cadena de Verlet con gravedad). Una cuerda solo puede tirar: si la varilla rígida tuviera que *empujar* (tensión T = mg·(3 cos θ − 2 cos θ₀) negativa, algo que solo ocurre si θ₀ > 90°), la cuerda se afloja y la masa cae libre hasta que se vuelve a tensar de golpe, con pérdida de energía.
  - Con la opción **«Física de cuerda» apagada** (por defecto) el movimiento es el del modelo de la guía; la pantalla muestra la tensión y avisa «la varilla empuja» cuando una cuerda se aflojaría.
  - Con ella **encendida**, el péndulo real se mueve como una cuerda. Hasta 90° da exactamente el mismo resultado; a 150° difiere (la cuerda se afloja desde el primer instante). Los períodos y las tablas siguen siendo los del modelo de varilla.

## Requisitos

- **Python 3.12+** con [`uv`](https://docs.astral.sh/uv/) (`pip install uv`)
- **Node.js 20+** (incluye `npm`)

## Instalación y ejecución

**Windows (PowerShell):**

```powershell
.\scripts\install.ps1     # instala dependencias y compila el dashboard
.\scripts\run.ps1         # abre http://127.0.0.1:8000
```

**Linux / macOS / Git Bash:**

```bash
scripts/install.sh
scripts/run.sh
```

Abre <http://127.0.0.1:8000>. Todo corre **en local, sin internet y sin IA externa**.

### En Visual Studio Code

1. *Ctrl+Shift+P* → **Git: Clone** → pegar `https://github.com/katerine15/proyecto5-pendulo-edo` y abrir la carpeta.
2. Instalar una sola vez: Python 3.12+, Node.js 20+ y `uv` (en la terminal: `pip install uv`).
3. En la terminal de VS Code (*Terminal → New Terminal*), desde la raíz del proyecto:
   - Windows: `.\scripts\install.ps1` y luego `.\scripts\run.ps1`
   - Linux / macOS / Git Bash: `scripts/install.sh` y luego `scripts/run.sh`
4. Abrir <http://127.0.0.1:8000> en el navegador.

Si PowerShell no deja correr los scripts, ejecutar antes `Set-ExecutionPolicy -Scope Process Bypass`.
Para la versión ligera, ver [`version-ligera/README.md`](version-ligera/README.md).

### Desarrollo (con recarga en caliente)

```bash
# terminal 1 — backend
cd backend && PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000
# terminal 2 — frontend (http://localhost:5173, redirige /api al backend)
cd frontend && npm run dev
```

### Pruebas

```bash
cd backend  && uv run pytest -q     # 61 pruebas: valores de la guía (péndulo y resorte), API, modelos, MCP, integradores, figuras, métricas del predictor y la verificación opcional por Ada
cd frontend && npm test             # 93 pruebas: núcleo en TypeScript, análisis científico, energía 3D, arrastre con signo, cuerda, masa-resorte (valores de la guía), predictor (y sus métricas), contraste de colores y panel de Ada
```

Los valores de referencia de la guía se comprueban automáticamente: T₀ = 2.0061 s; períodos reales
2.0099 / 2.0863 / 2.3679 / 3.5351 s a 10° / 45° / 90° / 150°; umbral del 1 % cerca de 23°.

## Si algo falla (niveles de respaldo)

El dashboard baja de nivel solo, sin que el usuario haga nada:

| Nivel | Situación | Qué pasa |
|---|---|---|
| **A** | Todo funciona | El backend Python calcula. El chip superior dice «Backend Python». |
| **B** | Se cae el backend o no hay red | El navegador calcula con el mismo núcleo en TypeScript. El chip dice «Modo local». Resultados idénticos. |
| **C** | Sin Python en el equipo | `cd frontend && npm run build && npm run preview`: el dashboard completo funciona solo con Node (modo local). |
| **D** | Falla el equipo o la red de la exposición | Abrir el proyecto en otro portátil con los pasos de arriba (≈3 min), o usar el video/capturas de respaldo (`assets/`). |
| **E** | No hay Node ni `uv` | `version-ligera/simulador_3d.html` con doble clic (no necesita instalar nada), y `python version-ligera/pendulo.py` para las gráficas. |

El predictor de IA también funciona en modo local: sus pesos viajan en `frontend/src/assets/surrogate.json`.

## Publicarlo desde casa (opcional, túnel de Cloudflare)

1. Copia `.env.example` a `.env` y define `API_KEY=una-clave-larga`.
2. Arranca el proyecto (`scripts/run`) y, en otra terminal: `cloudflared tunnel --url http://127.0.0.1:8000`
   (o un túnel con nombre hacia tu dominio).
3. Si defines `API_KEY`, la API rechaza peticiones sin el header `X-API-Key`. Protege también el dominio con
   **Cloudflare Access**. Publica solo el puerto 8000; no expongas Ollama ni otros servicios.

## Estructura

```
backend/            Python · FastAPI · numpy/scipy
  app/core/         Física pura (sin I/O): modelo, período, solución exacta, umbral
  app/services/     Casos de uso (simular, tabla, curva de error, predecir)
  app/models/       Contrato y registro de modelos (péndulo, masa-resorte)
  app/adapters/mcp/ Servidor MCP para asistentes de IA
  app/figures/      Figuras 2D y 3D, animación en cámara lenta y tabla (PNG, SVG, GIF, CSV)
  figuras/          Resultado del script generate_figures.py
  app/adapters/api/ Rutas HTTP (hexagonal: la API es un adaptador más)
  app/ml/           Red neuronal (solo numpy) y sus pesos
  tests/            pytest con los valores de la guía
  scripts/train_surrogate.py   Reentrena el predictor y exporta pesos al frontend
frontend/           React · Vite · TypeScript · Tailwind v4 · Zustand · Motion · Three.js (gráficas propias en SVG)
  src/design/       Tokens de diseño (colores, tipografía, modo claro/oscuro)
  src/ui/           Componentes reutilizables: BlurViewTransition, SegmentedTabs, AnimatedNumber, Switch
  src/layout/       Barra lateral, barra superior y pestañas móviles
  src/models/       Modelos del registro en el navegador (masa-resorte)
  src/views/        Las vistas
  src/features/     scene (3D + respaldo SVG) · charts · controls · results · predictor
  src/core-ts/      Mismo núcleo físico en TypeScript (respaldo sin backend) y análisis científico
  src/state/        Store + estrategias de datos (API / local)
docs/               Arquitectura, diseño y guion de exposición
version-ligera/     Respaldo sin servidor: pendulo.py, cuaderno de Colab, simulador.html y simulador_3d.html
assets/blender/     Modelo 3D: build_pendulum.py genera pendulo.glb (y pendulo.blend)
scripts/            install / run (PowerShell y Bash)
```

Documentación de apoyo: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) · [`docs/DISENO.md`](docs/DISENO.md) ·
[`docs/EXTENDIR.md`](docs/EXTENDIR.md) · [`docs/EXPOSICION.md`](docs/EXPOSICION.md) · [`docs/API.md`](docs/API.md)

## Regenerar el modelo 3D (opcional)

El `.glb` ya está en `frontend/public/models/`. Para rehacerlo con Blender 4.5 (sin abrir su interfaz):

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b --factory-startup `
  -P assets/blender/build_pendulum.py -- frontend/public/models/pendulo.glb assets/blender/pendulo.blend
```

## Figuras (tiempo real y script)

Las figuras salen de un solo módulo, `backend/app/figures/`, con el mismo estilo del dashboard (tema claro y oscuro). Dos formas de usarlo:

**1. En tiempo real, por la API** (es lo que usa la vista *Figuras*): cada petición dibuja la figura con los parámetros recibidos.

```
GET /api/figures/error_periodo.png?theta0_deg=60&L=1&g=9.81&theme=dark&dpi=200
GET /api/figures/paisaje_energia.svg?theta0_deg=120
GET /api/figures/animacion.gif?theta0_deg=90&slow=0.25&seconds=8     # cámara lenta (tarda unos segundos)
GET /api/figures/tabla_periodos.csv
GET /api/figures/todo.zip?theta0_deg=90                              # todo junto
GET /api/figures                                                      # catálogo
```

Las figuras son: `verificacion`, `comparacion`, `error_periodo`, `fases`, `serie_periodo`, `energia`, `paisaje_energia` (3D) y `espacio_tiempo` (3D).
Hay una caché: repetir los mismos parámetros devuelve al instante. Para que el servidor las dibuje con otro tamaño use `dpi` (50 a 300).

**2. Por script**, sin abrir el dashboard (deja todo en `figuras/`):

```bash
cd backend
PYTHONPATH=. uv run python scripts/generate_figures.py                       # θ₀ = 90°, tema claro, PNG + SVG + GIF + CSV
PYTHONPATH=. uv run python scripts/generate_figures.py --theta0 60 --theme both --slow 0.2
PYTHONPATH=. uv run python scripts/generate_figures.py --no-gif              # sin animación (más rápido)
```

La tabla de períodos incluye el error con las dos convenciones: frente a T, que es la de la guía (15.28 % a 90°), y frente a T₀ (18.03 %).

## Asistente de IA (servidor MCP)

`backend/app/adapters/mcp/server.py` expone la física como herramientas MCP: `listar_modelos`, `simular_pendulo`, `tabla_de_periodos`,
`angulo_umbral`, `predecir_periodo` y `simular_modelo`. Un modelo local (Ollama, LM Studio) o cualquier cliente MCP las usa para
consultar resultados y explicarlos; **no calcula**, todas las cifras salen de Python.

```bash
cd backend && PYTHONPATH=. uv run python -m app.adapters.mcp.server     # transporte stdio
```

Configuración típica de un cliente MCP (ajusta la ruta):

```json
{ "mcpServers": { "oscilaciones": {
    "command": "uv", "args": ["run", "--directory", "C:/ruta/a/proyecto5-pendulo-edo/backend", "python", "-m", "app.adapters.mcp.server"],
    "env": { "PYTHONPATH": "." } } } }
```

El modelo de lenguaje en sí (por ejemplo uno de ~20B en un PC con GPU) no viene en el repositorio: se instala con Ollama o LM Studio y se conecta a este servidor.
El dashboard no depende de la IA: funciona completo sin ella.

## Verificación opcional por Ada (segunda opinión)

**Es opcional: el dashboard calcula todo por su cuenta y funciona igual sin Ada** (niveles A–D de arriba). Ada es el asistente local de IA del grupo
(modelo Qwen3 de 14B servido con Ollama). Si su servicio está encendido en **este mismo equipo**, la vista *Simulación* muestra el panel
**«Verificación de Ada»**: Ada calcula el período del péndulo real por **dos métodos independientes** (integral elíptica completa y EDO integrada con
DOP853) y el dashboard **contrasta** su resultado con el suyo. Si hay diferencia, se muestra (nunca se esconde). Ada no reemplaza ningún cálculo.

```powershell
# En el repositorio de Ada (otra carpeta), en otra terminal:
.\scripts\start_ada_pendulum_api.ps1        # escucha solo en 127.0.0.1:8100
```

- El navegador **no** habla con Ada: lo hace el backend del dashboard por `GET /api/ada/verify` (ver [`docs/API.md`](docs/API.md)); sin backend (modo local) el panel no aparece.
- Siempre se le envía la `g` de la pantalla (9.81 m/s² en la guía); Ada usa 9.80665 si no se le indica.
- `ADA_API_URL` (opcional, en `.env`) cambia la dirección; **solo se aceptan direcciones de este equipo** (`127.0.0.1` / `localhost`), cualquier otra se ignora.
- Si Ada está apagada, el panel dice «Sin segunda opinión de Ada» y nada más cambia.

## Reentrenar el predictor

```bash
cd backend && PYTHONPATH=. uv run python scripts/train_surrogate.py
```

Genera 400 ángulos con la física, entrena una red 1-24-24-1 (tanh) y guarda los pesos en
`backend/app/ml/surrogate.json` y `frontend/src/assets/surrogate.json`. Imprime el error en ángulos de prueba
que no usó para entrenar (hoy: medio 0.13 %, máximo 0.46 %) y, aparte, el error en **todo** el rango entrenado (1°–160°, 20 001 ángulos):
hoy medio 0.14 % y máximo **0.88 % en 160°**, el borde del rango; ese máximo es el que importa. Fuera de 1°–160° la red no es fiable
(a 170° se equivoca 7.9 %; la pantalla lo avisa). `python scripts/train_surrogate.py --metrics-only` recalcula estas métricas sin reentrenar.

## Declaración de uso de herramientas de IA (según pág. 10 de la guía)

Se usaron dos asistentes de inteligencia artificial. El grupo revisó, ejecutó y responde por el código entregado.

**Claude (Anthropic, mediante Claude Code)** apoyó en:
- Backend y física en Python (`backend/app/core`, servicios, API con FastAPI, registro de modelos) y su espejo en TypeScript (`frontend/src/core-ts`).
- El módulo de figuras 2D y 3D, la animación en cámara lenta y el script `generate_figures.py`.
- El servidor MCP, el predictor de red neuronal, las pruebas automáticas (Python y TypeScript) y la documentación (`docs/`).
- La estructura del dashboard (menú, vistas, sistema de diseño claro/oscuro, componentes de interfaz).
- Los materiales y texturas de las escenas 3D, el arrastre de la lenteja a ambos lados y la física de la cuerda.

**Antigravity (Gemini) + Blender MCP** apoyó en:
- Modelado procedimental 3D en Blender ([`build_pendulum.py`](assets/blender/build_pendulum.py)) con relieves mecánicos y horológicos (`pendulo.glb` y `resorte.glb`).
- Escenas interactivas en Three.js (`Stage3D.tsx`, `LabStage3D.tsx`, `SpringStage3D.tsx`) y animaciones fluidas de gráficas en SVG (`LineChart.tsx`).

**Ada (asistente local de IA del grupo, Qwen3 14B con Ollama) y Claude (Anthropic, mediante Claude Code)** apoyaron en la integración **opcional** con Ada y en la revisión:
- La ruta `backend/app/adapters/api/routes_ada.py` (con `backend/tests/test_ada.py`) y el panel «Verificación de Ada» (`frontend/src/features/ada/`, `frontend/src/lib/ada.ts` y sus pruebas).
- El servicio local de Ada que calcula el período por dos métodos vive en el repositorio de Ada (`ada.pendulum.http_service`), no aquí; solo da una segunda opinión.
- La revisión del proyecto: pruebas, instalación desde cero y comprobación independiente (con SciPy) de los valores de referencia de la guía.

**Claude (Anthropic)**, en una conversación aparte, hizo la versión ligera (`version-ligera/`: `pendulo.py`, cuaderno de Colab y `simulador.html`), corrigió el simulador 3D de Gemini (`version-ligera/simulador_3d.html`) y unificó los dos proyectos en este repositorio. En la unificación corrigió: el texto de la figura de energía (Euler explícito **gana** energía, no la pierde), el guion de exposición (el RK4 de la guía está en `integrators.py`), el archivo de dependencias de npm desactualizado y una ruta de un equipo particular en este README.

**Hecho a mano por el grupo:** la deducción analítica (ecuación característica, solución general, condiciones iniciales, T₀ = 2π√(L/g) y serie de Taylor). El software la **verifica** contra la integración numérica RK4 y las funciones elípticas de Jacobi; no la reemplaza.

## Qué NO hace este software

- No sustituye la deducción a mano (ecuación característica, condiciones iniciales, T₀ = 2π√(L/g), error de Taylor).
- La IA del dashboard es un **predictor numérico pequeño**, no un asistente de lenguaje. El asistente con modelo
  local (Ollama + MCP) queda como una extensión futura: ver `docs/ARQUITECTURA.md`. La verificación opcional por Ada tampoco es un asistente de lenguaje: es una consulta numérica a su servicio local.
