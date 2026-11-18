# API (FastAPI)

Documentación interactiva automática: `http://127.0.0.1:8000/docs`.
Si `API_KEY` está definida en `.env`, todas las rutas `/api/*` (menos `/api/health`) exigen el header `X-API-Key`.

| Método | Ruta | Parámetros | Devuelve |
|---|---|---|---|
| GET | `/api/health` | — | `{"status":"ok"}` |
| POST | `/api/simulate` | JSON: `theta0_deg` (0–170], `L` m, `g` m/s², `t_max` s, `n` puntos | `t`, `theta_linear_deg`, `theta_real_deg`, `theta_exact_deg`, `T0`, `T_real`, `T_measured`, `period_error_pct`, `max_gap_deg`, `numeric_vs_exact_deg`, `clock_drift_s_per_day` |
| GET | `/api/periods` | `L`, `g` | Tabla para 10°, 45°, 90°, 150° |
| GET | `/api/error-curve` | `L`, `g` | `theta0_deg[]`, `error_pct[]`, `threshold_1pct_deg` |
| GET | `/api/predict` | `theta0_deg`, `L`, `g` | `T_pred`, `T_true`, `rel_error_pct`, métricas de la red |
| GET | `/api/ada/verify` | `theta0_deg` (0–170], `L`, `g` | **Opcional.** Con Ada encendida: `available: true`, `verified` (sus dos métodos coinciden), `agree` (coincide con el dashboard), `T_elliptic_s`, `T_dop853_s`, `abs_diff_T_s`, `threshold_deg`. Sin Ada: `available: false` y `reason` (nunca un error). Solo consulta direcciones de este equipo. |

Ejemplo:

```bash
curl -X POST http://127.0.0.1:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"theta0_deg": 90, "t_max": 10, "n": 300}'
```

Los servicios (`backend/app/services/simulation.py`) son el punto de entrada para futuros adaptadores
(por ejemplo un servidor MCP para un asistente con modelo local).

## Figuras en tiempo real

| Método | Ruta | Parámetros | Devuelve |
|---|---|---|---|
| GET | `/api/figures` | — | Catálogo de figuras y formatos |
| GET | `/api/figures/{nombre}.{png\|svg}` | `theta0_deg`, `L`, `g`, `theme` (`light`/`dark`), `dpi` (50–300), `download` | La figura dibujada al instante |
| GET | `/api/figures/animacion.gif` | los anteriores + `slow` (0.05–1), `seconds` (2–13), `fps` (8–30) | Animación 3D en cámara lenta |
| GET | `/api/figures/tabla_periodos.csv` | `L`, `g` | Períodos medidos con RK4, exactos y errores |
| GET | `/api/figures/todo.zip` | los de la figura + `gif` | Todas las figuras (PNG y SVG) y la tabla |

Errores: 404 si la figura no existe, 422 si un parámetro está fuera de rango, 501 si faltan las dependencias de figuras.
