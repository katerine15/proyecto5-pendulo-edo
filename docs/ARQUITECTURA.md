# Arquitectura

## Idea central

La física vive en **un solo lugar conceptual** (el núcleo) y se expone por dos caminos equivalentes:
el backend Python (nivel A) y el mismo núcleo reescrito en TypeScript (nivel B/C). La interfaz no sabe
cuál de los dos usa: pide datos a una *estrategia* (`DataSource`).

```
                      ┌─────────────────────────── navegador ───────────────────────────┐
                      │  features/ (scene · charts · controls · results · predictor)     │
                      │            │ lee/escribe                                         │
                      │        state/store (Zustand)                                     │
                      │            │ pide datos                                          │
                      │     DataSource (Strategy)                                        │
                      │      ├── apiSource  ──── HTTP ───┐                               │
                      │      └── localSource ── core-ts  │  (respaldo automático)        │
                      └──────────────────────────────────┼───────────────────────────────┘
                                                         ▼
 backend (hexagonal)        adapters/api  →  services  →  core (física pura) · ml (red neuronal)
```

## Backend (`backend/app`)

| Capa | Responsabilidad | Regla |
|---|---|---|
| `core/pendulum.py` | Ecuaciones, solución lineal, solución exacta con funciones elípticas, período medido, umbral, deriva del reloj | Sin I/O, sin estado. Se prueba sola. |
| `ml/surrogate.py` | MLP 1-24-24-1 en numpy (entrenar, predecir, guardar/cargar) | No importa nada web. |
| `services/simulation.py` | Casos de uso: simular, tabla, curva de error, predecir | Orquesta el núcleo; no conoce HTTP. |
| `adapters/api/routes.py` | Rutas FastAPI y validación (pydantic) | Delgada: solo traduce. |
| `main.py` | App, guardia de `API_KEY`, sirve el frontend compilado | — |

Ventaja del patrón: se puede añadir otro adaptador (por ejemplo un servidor MCP o un asistente con modelo local)
sin tocar la física ni los servicios.

### Qué calcula y cómo se valida

- **Lineal:** `θ(t) = θ₀ cos(ω₀ t)`, `ω₀ = √(g/L)`, `T₀ = 2π√(L/g)`.
- **Real (numérico):** se convierte a sistema de primer orden `u' = v, v' = −(g/L) sin u` y se integra
  (DOP853 en Python, RK4 en TypeScript).
- **Real (exacto):** `sin(θ/2) = k·sn(K + ω₀t | k²)` con `k = sin(θ₀/2)`; período `T = 4√(L/g)·K(k²)`.
  Es la referencia independiente con la que se comprueba el integrador (diferencia ≈ 1e-9°).
- **Período medido:** la velocidad vuelve a cero en `T/2` (detección de evento).
- **Umbral del 1 %:** bisección sobre el error `|T − T₀|/T`.
- **Reloj:** un reloj calibrado con `T₀` que oscila con período `T` atrasa `86400·(1 − T₀/T)` s/día.

## Frontend (`frontend/src`)

- **Patrón de carpetas por *feature***: cada zona (`scene`, `charts`, `controls`, `results`, `predictor`) es autónoma.
- **Un solo store** (`state/store.ts`). El reloj de reproducción (`t`) se actualiza a 60 fps pero la escena SVG lo
  lee con `getState()` dentro de `requestAnimationFrame` y escribe atributos del SVG, sin re-renderizar React.
- **Tokens de diseño** (`design/tokens.css`): colores y radios definidos una vez; claro y oscuro.
- **Respaldo automático:** si `/api/health` no responde con JSON, o una llamada falla a mitad de sesión,
  el store cambia a `localSource` y lo avisa en el chip superior.
- **Gráficas propias en SVG** (sin librería): control total de rótulos, unidades, leyenda y cursor sincronizado.

## Paridad Python ↔ TypeScript

`backend/tests` y `frontend/src/core-ts/pendulum.test.ts` comprueban los mismos valores de la guía. Si cambias
la física en un lado, cambia el otro y corre ambas suites.

## Extensiones previstas (fuera de esta entrega)

1. **Asistente en lenguaje natural** con un modelo local (Ollama / LM Studio en un PC con GPU) y un servidor MCP
   (SDK `mcp`, ya listado en las dependencias) cuyas herramientas llamen a `services/simulation.py`
   (`simular`, `medir_periodo`, `tabla_errores`, `umbral_error`). La IA elige herramientas y explica; no calcula.
2. **Publicación por túnel** de Cloudflare con `API_KEY` y Cloudflare Access (ver README).
3. **Assets de Blender**: modelo `.glb` del péndulo y video de respaldo (`assets/blender/`).
