import { describe, expect, it } from 'vitest'
import { exactPeriod, linearPeriod } from './pendulum'
import { predictRatio, surrogateMetrics } from './surrogate'

/** Las métricas que se muestran junto al predictor deben ser las reales: se recalculan aquí en todo el rango entrenado. */
describe('métricas del predictor en todo el rango entrenado', () => {
  const N = surrogateMetrics.n_full_range ?? 20001
  const T0 = linearPeriod(1, 9.81)
  let max = 0, sum = 0, at = 0
  for (let i = 0; i < N; i++) {
    const a = 1 + (159 * i) / (N - 1)
    const truth = exactPeriod({ theta0Deg: a, L: 1, g: 9.81 }) / T0
    const e = (Math.abs(predictRatio(a) - truth) / truth) * 100
    sum += e
    if (e > max) { max = e; at = a }
  }

  it('el máximo y el promedio guardados coinciden con el recálculo en el navegador', () => {
    expect(max).toBeCloseTo(surrogateMetrics.max_abs_pct_error_full_range ?? NaN, 3)
    expect(sum / N).toBeCloseTo(surrogateMetrics.mean_abs_pct_error_full_range ?? NaN, 3)
    expect(at).toBeCloseTo(surrogateMetrics.max_error_at_deg ?? NaN, 1)
  })

  it('el peor caso está en el borde de 160° y supera al «máximo» de los ángulos de prueba (0.46 %)', () => {
    expect(at).toBe(160)
    expect(max).toBeGreaterThan(0.85)
    expect(max).toBeLessThan(0.92)
    expect(max).toBeGreaterThan(surrogateMetrics.max_abs_pct_error)
  })
})
