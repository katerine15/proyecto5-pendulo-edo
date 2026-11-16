import {
  dailyClockDrift, exactPeriod, exactSolution, linearPeriod, linearSolution, measuredPeriod,
  numericSolution, periodErrorPercent, thresholdAngle, toDeg,
} from '../core-ts/pendulum'
import { SURROGATE_RANGE, predictRatio, surrogateMetrics } from '../core-ts/surrogate'
import type { DataSource, ErrorCurve, PeriodRow, Prediction, SimInput, SimResult } from './types'

export const REFERENCE_ANGLES = [10, 45, 90, 150]

/** Modo local: todo se calcula en el navegador (sin backend, sin red). */
export const localSource: DataSource = {
  name: 'local',
  async simulate({ theta0Deg, L, g, tMax, n }: SimInput): Promise<SimResult> {
    const p = { theta0Deg, L, g }
    const t = Array.from({ length: n }, (_, i) => (i * tMax) / (n - 1))
    const lin = t.map((x) => linearSolution(x, p))
    const num = numericSolution(t, p)
    const ex = t.map((x) => exactSolution(x, p))
    const gap = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))
    return {
      t,
      thetaLinearDeg: lin.map(toDeg),
      thetaRealDeg: num.map(toDeg),
      thetaExactDeg: ex.map(toDeg),
      T0: linearPeriod(L, g),
      TReal: exactPeriod(p),
      TMeasured: measuredPeriod(p),
      periodErrorPct: periodErrorPercent(p),
      maxGapDeg: toDeg(gap(lin, num)),
      numericVsExactDeg: toDeg(gap(num, ex)),
      clockDriftSPerDay: dailyClockDrift(p),
    }
  },
  async periods(L, g): Promise<PeriodRow[]> {
    return REFERENCE_ANGLES.map((a) => {
      const p = { theta0Deg: a, L, g }
      return { theta0Deg: a, T0: linearPeriod(L, g), TReal: exactPeriod(p),
        errorPct: periodErrorPercent(p), clockDriftSPerDay: dailyClockDrift(p) }
    })
  },
  async errorCurve(L, g): Promise<ErrorCurve> {
    const angles = Array.from({ length: 120 }, (_, i) => 1 + (i * 169) / 119)
    return {
      theta0Deg: angles,
      errorPct: angles.map((a) => periodErrorPercent({ theta0Deg: a, L, g })),
      threshold1pctDeg: thresholdAngle(1, L, g),
    }
  },
  async predict(theta0Deg, L, g): Promise<Prediction> {
    const TPred = predictRatio(theta0Deg) * linearPeriod(L, g)
    const TTrue = exactPeriod({ theta0Deg, L, g })
    return {
      theta0Deg, TPred, TTrue, relErrorPct: (100 * Math.abs(TPred - TTrue)) / TTrue,
      inTrainingRange: theta0Deg >= SURROGATE_RANGE[0] && theta0Deg <= SURROGATE_RANGE[1],
      meanErrPct: surrogateMetrics.mean_abs_pct_error, maxErrPct: surrogateMetrics.max_abs_pct_error, nTest: surrogateMetrics.n_test,
      meanErrFullPct: surrogateMetrics.mean_abs_pct_error_full_range, maxErrFullPct: surrogateMetrics.max_abs_pct_error_full_range,
      maxErrAtDeg: surrogateMetrics.max_error_at_deg,
    }
  },
}

const headers: HeadersInit = { 'Content-Type': 'application/json' }
const key = import.meta.env.VITE_API_KEY as string | undefined
if (key) (headers as Record<string, string>)['X-API-Key'] = key

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 8000)
  try {
    const r = await fetch(path, { ...init, headers, signal: ctl.signal })
    if (!r.ok) throw new Error(`${r.status}`)
    return (await r.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Modo API: el cálculo lo hace el backend Python. */
export const apiSource: DataSource = {
  name: 'api',
  async simulate(i) {
    const r: any = await call('/api/simulate', {
      method: 'POST',
      body: JSON.stringify({ theta0_deg: i.theta0Deg, L: i.L, g: i.g, t_max: i.tMax, n: i.n }),
    })
    return {
      t: r.t, thetaLinearDeg: r.theta_linear_deg, thetaRealDeg: r.theta_real_deg,
      thetaExactDeg: r.theta_exact_deg, T0: r.T0, TReal: r.T_real, TMeasured: r.T_measured,
      periodErrorPct: r.period_error_pct, maxGapDeg: r.max_gap_deg,
      numericVsExactDeg: r.numeric_vs_exact_deg, clockDriftSPerDay: r.clock_drift_s_per_day,
    }
  },
  async periods(L, g) {
    const r: any = await call(`/api/periods?L=${L}&g=${g}`)
    return r.rows.map((x: any) => ({ theta0Deg: x.theta0_deg, T0: x.T0, TReal: x.T_real,
      errorPct: x.error_pct, clockDriftSPerDay: x.clock_drift_s_per_day }))
  },
  async errorCurve(L, g) {
    const r: any = await call(`/api/error-curve?L=${L}&g=${g}`)
    return { theta0Deg: r.theta0_deg, errorPct: r.error_pct, threshold1pctDeg: r.threshold_1pct_deg }
  },
  async predict(theta0Deg, L, g) {
    const r: any = await call(`/api/predict?theta0_deg=${theta0Deg}&L=${L}&g=${g}`)
    return { theta0Deg, TPred: r.T_pred, TTrue: r.T_true, relErrorPct: r.rel_error_pct,
      inTrainingRange: r.in_training_range, meanErrPct: r.model.mean_abs_pct_error,
      maxErrPct: r.model.max_abs_pct_error, nTest: r.model.n_test,
      meanErrFullPct: r.model.mean_abs_pct_error_full_range, maxErrFullPct: r.model.max_abs_pct_error_full_range,
      maxErrAtDeg: r.model.max_error_at_deg }
  },
}

/** Comprueba si el backend responde; si no, el dashboard sigue en modo local. */
export async function detectSource(): Promise<DataSource> {
  try {
    await call('/api/health')
    return apiSource
  } catch {
    return localSource
  }
}
