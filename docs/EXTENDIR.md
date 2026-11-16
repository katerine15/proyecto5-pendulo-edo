# Cómo extender el producto

El proyecto está pensado para crecer sin reescribirse. Hoy resuelve el péndulo; estas son las costuras
por donde se añade lo demás. Cada receta indica los archivos exactos.

## 0. Estado del registro de modelos

**Hecho de punta a punta** con dos modelos (péndulo y masa-resorte amortiguada con sus tres regímenes):
- Backend: contrato `ModelSpec`/`ParamSpec`/`SimulationResult` y registro en `backend/app/models/`; API `GET /api/models` y `POST /api/models/{id}/simulate`.
- Navegador: `core-ts/springMass.ts` (espejo probado contra Python), `models/spring.ts` (especificación y simulación, con servidor y respaldo local) y la vista genérica `views/ModelView.tsx`, que dibuja controles y mediciones desde la especificación.
- MCP: `simular_modelo(model_id, params)` sirve cualquier modelo registrado a un asistente.

Para sumar un tercero (por ejemplo RLC) se repite el patrón de la sección siguiente; la vista genérica se reutiliza.

## 1. Añadir otro modelo físico (péndulo amortiguado, forzado, doble, masa-resorte, RLC…)

1. **Núcleo**: crea `backend/app/core/<modelo>.py` con funciones puras (parámetros → soluciones, período,
   métricas). Sin I/O. Sigue el estilo de `core/pendulum.py`.
2. **Pruebas**: `backend/tests/test_<modelo>.py` con valores de referencia (de la guía o de una solución exacta).
3. **Servicio**: añade casos de uso en `backend/app/services/` (o un archivo nuevo) que orquesten el núcleo.
4. **API**: nuevas rutas en `backend/app/adapters/api/routes.py` (o un `routes_<modelo>.py` incluido en `main.py`).
5. **Respaldo local**: reescribe el núcleo en `frontend/src/core-ts/<modelo>.ts` + su prueba de paridad, y
   añade el método a `DataSource` (`state/types.ts`) en `apiSource` y `localSource` (`state/datasource.ts`).
6. **Interfaz**: una carpeta nueva en `frontend/src/features/<modelo>/` y su sección en `App.tsx`.

Siguiente paso natural (aún no construido): un **registro de modelos** (`/api/models`, cada modelo declara sus
parámetros y sus gráficas) para que el frontend pinte los paneles de forma genérica y los otros cuatro
proyectos de la guía sean módulos de la misma plataforma.

## 2. Añadir un asistente con lenguaje natural (modelo local + MCP)

Es un **adaptador más**, igual que la API HTTP: `backend/app/adapters/mcp/server.py` expone como herramientas
las funciones de `services/simulation.py` (`simular`, `tabla_de_periodos`, `curva_de_error`, `predecir`).
El modelo (Ollama / LM Studio, API compatible con OpenAI) elige herramientas y explica los resultados; **no calcula**.
La dependencia `mcp` ya está en `pyproject.toml`. Para el frontend, un panel `features/assistant/` que
muestre la conversación y dispare `refresh()` del store cuando el asistente cambie el ángulo.

## 3. Añadir un panel nuevo al dashboard

1. Crea `frontend/src/features/<panel>/Panel.tsx`; lee del store con `useStore((s) => s.<campo>)`.
2. Si necesita datos nuevos, añade el campo en `state/store.ts` y el método en `DataSource`.
3. Colócalo en `App.tsx`. Usa solo tokens (`var(--lin)`, `var(--ink)`…): hereda claro y oscuro gratis.

## 4. Añadir un integrador numérico (Euler, Heun, RK4, simpléctico)

`backend/app/core/` ya separa el modelo del método. Añade el integrador como función pura que reciba la
función `f(t, u, v)` y devuelva la trayectoria; compáralo en una prueba contra la solución exacta
(`exact_solution`) y mide su orden de convergencia (el Proyecto 3 de la guía).

## 5. Publicar y operar

- Túnel de Cloudflare y `API_KEY`: ver README.
- Reentrenar el predictor: `backend/scripts/train_surrogate.py`.
- Versionado de la API: prefija nuevas rutas incompatibles con `/api/v2/` y deja `/api/` intacta.

## Principios para no romper nada

- La física solo vive en `core/` (y su espejo `core-ts/`). Ninguna otra capa calcula.
- Todo cambio de física viene con prueba de valores de referencia en Python **y** en TypeScript.
- El frontend nunca asume el backend: siempre hay `localSource` de respaldo.
- Colores solo desde tokens; todo par nuevo se añade a `tokens.test.ts`.
