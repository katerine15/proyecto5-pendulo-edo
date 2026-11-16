/**
 * Definición local (TypeScript) del modelo masa-resorte. Espeja backend/app/models/spring_mass.py:
 * mismas parámetros, mismas métricas y misma forma de resultado, así el servidor y el navegador son intercambiables.
 */
import {
  type SpringParams, dampedPeriod, exactSolution, numericSolution, omegaN, overshootPercent, regime, settlingTime, zeta,
} from '../core-ts/springMass'

export interface ParamSpec { key: keyof SpringParams; label: string; unit: string; min: number; max: number; step: number; default: number }
export interface ModelSeries { key: string; label: string; kind: 'exact' | 'numeric' | 'approx'; values: number[] }
export interface ModelMetric { key: string; label: string; value: number | string | null; unit: string }
export interface ModelResult { t: number[]; series: ModelSeries[]; metrics: ModelMetric[]; verdict: string }

export const SPRING_SPEC = {
  id: 'spring-mass',
  name: 'Masa-resorte amortiguada',
  summary: 'Suspensión de un vehículo: cómo el amortiguamiento decide si el sistema oscila o se asienta.',
  equation: "m x'' + c x' + k x = 0",
  tMax: 12,
  params: [
    { key: 'm', label: 'Masa m', unit: 'kg', min: 0.1, max: 50, step: 0.1, default: 1 },
    { key: 'c', label: 'Amortiguamiento c', unit: 'N·s/m', min: 0, max: 120, step: 0.05, default: 0.4 },
    { key: 'k', label: 'Rigidez k', unit: 'N/m', min: 0.5, max: 200, step: 0.5, default: 4 },
    { key: 'x0', label: 'Posición inicial x₀', unit: 'm', min: -2, max: 2, step: 0.05, default: 1 },
    { key: 'v0', label: 'Velocidad inicial v₀', unit: 'm/s', min: -5, max: 5, step: 0.1, default: 0 },
  ] as ParamSpec[],
}

const VERDICTS = {
  subamortiguado: 'Subamortiguado: oscila y la amplitud decae. Raíces complejas conjugadas.',
  crítico: 'Críticamente amortiguado: el retorno más rápido sin oscilar. Raíz real doble.',
  sobreamortiguado: 'Sobreamortiguado: no oscila y vuelve lento. Dos raíces reales distintas.',
} as const

export function defaultSpringParams(): SpringParams {
  return Object.fromEntries(SPRING_SPEC.params.map((p) => [p.key, p.default])) as unknown as SpringParams
}

/** Amortiguamiento c que da la razón ζ pedida (ζ = 1 es el crítico). */
export const cForZeta = (z: number, p: SpringParams) => z * 2 * Math.sqrt(p.m * p.k)

export function simulateSpringLocal(p: SpringParams, tMax: number, n: number): ModelResult {
  const t = Array.from({ length: n }, (_, i) => (i * tMax) / (n - 1))
  const ex = t.map((x) => exactSolution(x, p))
  const num = numericSolution(t, p)
  const reg = regime(p)
  return {
    t,
    series: [
      { key: 'exact', label: 'Solución analítica', kind: 'exact', values: ex },
      { key: 'numeric', label: 'Simulación numérica', kind: 'numeric', values: num },
    ],
    metrics: [
      { key: 'regime', label: 'Régimen', value: reg, unit: '' },
      { key: 'zeta', label: 'Razón de amortiguamiento ζ', value: zeta(p), unit: '' },
      { key: 'omega_n', label: 'Frecuencia natural ωn', value: omegaN(p), unit: 'rad/s' },
      { key: 'period', label: 'Período amortiguado', value: dampedPeriod(p), unit: 's' },
      { key: 'settling', label: 'Tiempo de asentamiento (2 %)', value: settlingTime(p), unit: 's' },
      { key: 'overshoot', label: 'Sobreimpulso', value: overshootPercent(p), unit: '%' },
      { key: 'gap', label: 'Diferencia numérica vs analítica', value: Math.max(...ex.map((v, i) => Math.abs(v - num[i]))), unit: 'm' },
    ],
    verdict: VERDICTS[reg],
  }
}

/** Pide el cálculo al servidor si está disponible; si falla, calcula en el navegador. */
export async function simulateSpring(
  p: SpringParams, tMax: number, n: number, useApi: boolean, signal?: AbortSignal,
): Promise<ModelResult> {
  if (useApi) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const key = import.meta.env.VITE_API_KEY as string | undefined
      if (key) headers['X-API-Key'] = key
      const reqSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000)
      const r = await fetch('/api/models/spring-mass/simulate', {
        method: 'POST', headers, body: JSON.stringify({ params: p, t_max: tMax, n }), signal: reqSignal,
      })
      if (r.ok) return (await r.json()) as ModelResult
    } catch { /* cae al cálculo local */ }
  }
  return simulateSpringLocal(p, tMax, n)
}
