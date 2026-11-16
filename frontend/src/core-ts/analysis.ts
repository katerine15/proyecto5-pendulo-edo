/**
 * Análisis científico del péndulo: espacio de fases, conservación de energía, orden de los métodos
 * numéricos, desarrollo en serie del período y herramienta de diseño. Todo sobre el mismo núcleo de pendulum.ts.
 *
 * Energía específica (por unidad de masa y L²):  E = ½ ω² + (g/L)(1 − cos θ)   (constante en el péndulo real).
 */
import {
  dailyClockDrift, exactPeriod, exactSolution, linearPeriod, periodErrorPercent, thresholdAngle, type Params,
} from './pendulum'

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export type Method = 'euler' | 'symplectic' | 'heun' | 'rk4'
export const METHOD_LABEL: Record<Method, string> = {
  euler: 'Euler explícito', symplectic: 'Euler simpléctico', heun: 'Heun (RK2)', rk4: 'Runge–Kutta 4',
}

/** Un paso de u' = v, v' = −w2 sen u. */
export function step(m: Method, u: number, v: number, h: number, w2: number): [number, number] {
  const f = (x: number) => -w2 * Math.sin(x)
  switch (m) {
    case 'euler':
      return [u + h * v, v + h * f(u)]
    case 'symplectic': {
      const v2 = v + h * f(u) // primero la velocidad, luego la posición con la velocidad nueva
      return [u + h * v2, v2]
    }
    case 'heun': {
      const k1v = f(u), ue = u + h * v, ve = v + h * k1v
      return [u + (h / 2) * (v + ve), v + (h / 2) * (k1v + f(ue))]
    }
    default: {
      const k1u = v, k1v = f(u)
      const k2u = v + 0.5 * h * k1v, k2v = f(u + 0.5 * h * k1u)
      const k3u = v + 0.5 * h * k2v, k3v = f(u + 0.5 * h * k2u)
      const k4u = v + h * k3v, k4v = f(u + h * k3u)
      return [u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u), v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)]
    }
  }
}

export const energy = (u: number, v: number, w2: number) => 0.5 * v * v + w2 * (1 - Math.cos(u))

/** Deriva relativa de la energía |ΔE/E₀| a lo largo de `tEnd` segundos, muestreada cada `every` pasos. */
export function energyDrift(m: Method, p: Params, h: number, tEnd: number, every = 10) {
  const w2 = p.g / p.L
  let u = rad(p.theta0Deg), v = 0
  const E0 = energy(u, v, w2)
  const t: number[] = [0], rel: number[] = [0]
  const n = Math.round(tEnd / h)
  for (let i = 1; i <= n; i++) {
    ;[u, v] = step(m, u, v, h, w2)
    if (i % every === 0) { t.push(i * h); rel.push(Math.abs((energy(u, v, w2) - E0) / E0)) }
  }
  return { t, rel }
}

/** Pasos para medir el orden: pequeños para Euler (régimen asintótico) y grandes para RK4 (evita el ruido de redondeo). */
export const CONVERGENCE_HS: Record<Method, number[]> = {
  euler: [0.004, 0.002, 0.001, 0.0005],
  symplectic: [0.004, 0.002, 0.001, 0.0005],
  heun: [0.04, 0.02, 0.01, 0.005],
  rk4: [0.05, 0.025, 0.0125, 0.00625],
}

/**
 * Error máximo |θ_num − θ_exacta| (rad) en [0, tEnd] para cada paso h, y la pendiente log–log (orden observado).
 * Se usa el máximo sobre todo el intervalo y no el error en un solo instante: este último depende de la fase de la
 * onda y puede anularse por casualidad, lo que rompe la tendencia.
 */
export function convergence(m: Method, p: Params, hs: number[], tEnd = 10) {
  const w2 = p.g / p.L
  const err = hs.map((h) => {
    let u = rad(p.theta0Deg), v = 0, worst = 0
    const n = Math.round(tEnd / h)
    for (let i = 1; i <= n; i++) {
      ;[u, v] = step(m, u, v, h, w2)
      worst = Math.max(worst, Math.abs(u - exactSolution(i * h, p)))
    }
    return worst
  })
  const lx = hs.map(Math.log10), ly = err.map((e) => Math.log10(Math.max(e, 1e-300)))
  const mx = lx.reduce((a, b) => a + b) / lx.length, my = ly.reduce((a, b) => a + b) / ly.length
  const slope = lx.reduce((s, x, i) => s + (x - mx) * (ly[i] - my), 0) / lx.reduce((s, x) => s + (x - mx) ** 2, 0)
  return { hs, err, slope }
}

/** Desarrollo en serie de T/T₀ en la amplitud θ₀ (rad): 1 + θ²/16 + 11θ⁴/3072 + 173θ⁶/737280. */
export function periodRatioSeries(theta0Deg: number, order: 2 | 4 | 6): number {
  const a = rad(theta0Deg)
  let r = 1 + a ** 2 / 16
  if (order >= 4) r += (11 * a ** 4) / 3072
  if (order >= 6) r += (173 * a ** 6) / 737280
  return r
}

export const periodRatioExact = (theta0Deg: number) =>
  exactPeriod({ theta0Deg, L: 1, g: 9.81 }) / linearPeriod(1, 9.81)

/** Curva cerrada del espacio de fases del péndulo real a la amplitud θ₀ (θ en °, ω en °/s). Analítica, sin integrar. */
export function phaseCurveReal(theta0Deg: number, L: number, g: number, n = 241) {
  const w2 = g / L, a0 = rad(theta0Deg)
  const x: number[] = [], y: number[] = []
  for (let k = 0; k <= n; k++) {
    const phi = (2 * Math.PI * k) / n
    const th = a0 * Math.cos(phi)
    const w = Math.sqrt(Math.max(0, 2 * w2 * (Math.cos(th) - Math.cos(a0))))
    x.push(deg(th)); y.push(deg(Math.sin(phi) < 0 ? w : -w))
  }
  return { x, y }
}

/** Elipse del modelo lineal: ω² + ω₀²θ² = ω₀²θ₀². */
export function phaseCurveLinear(theta0Deg: number, L: number, g: number, n = 241) {
  const w0 = Math.sqrt(g / L), a0 = rad(theta0Deg)
  const x: number[] = [], y: number[] = []
  for (let k = 0; k <= n; k++) {
    const phi = (2 * Math.PI * k) / n
    x.push(deg(a0 * Math.cos(phi))); y.push(deg(-w0 * a0 * Math.sin(phi)))
  }
  return { x, y }
}

/** Separatriz: ω = ±2 √(g/L) cos(θ/2), la frontera entre oscilar y dar vueltas. */
export function separatrix(L: number, g: number, n = 181) {
  const w = 2 * Math.sqrt(g / L)
  const x = Array.from({ length: n }, (_, i) => -180 + (360 * i) / (n - 1))
  return { x, top: x.map((d) => deg(w * Math.cos(rad(d) / 2))), bottom: x.map((d) => -deg(w * Math.cos(rad(d) / 2))) }
}

/** Estado (θ°, ω°/s) en el instante t: real exacto (por derivada centrada) y lineal. */
export function stateAt(t: number, p: Params) {
  const eps = 1e-5
  const wReal = (exactSolution(t + eps, p) - exactSolution(t - eps, p)) / (2 * eps)
  const w0 = Math.sqrt(p.g / p.L), a0 = rad(p.theta0Deg)
  return {
    real: { x: deg(exactSolution(t, p)), y: deg(wReal) },
    lin: { x: deg(a0 * Math.cos(w0 * t)), y: deg(-w0 * a0 * Math.sin(w0 * t)) },
  }
}

/** Herramienta de diseño: dada una tolerancia de error del período, el ángulo máximo y sus consecuencias. */
export function designFor(tolerancePct: number, L: number, g: number) {
  const angle = thresholdAngle(tolerancePct, L, g)
  const p = { theta0Deg: angle, L, g }
  return {
    angleDeg: angle,
    T: exactPeriod(p),
    T0: linearPeriod(L, g),
    errorPct: periodErrorPercent(p),
    driftSPerDay: dailyClockDrift(p),
  }
}

export function driftCurve(L: number, g: number, points = 120) {
  const x = Array.from({ length: points }, (_, i) => 1 + (i * 169) / (points - 1))
  return { x, y: x.map((a) => dailyClockDrift({ theta0Deg: a, L, g }) / 60) } // min/día
}

/**
 * Altura de la superficie de energía para dibujarla en 3D, a escala.
 * E/(g/L) = 2 (ω/ω_sep)² + (1 − cos θ)  (real)   o   2 (ω/ω_sep)² + θ²/2  (modelo lineal),
 * con ω_sep = 2 √(g/L) la velocidad de la separatriz en θ = 0, y wNorm = ω/ω_sep ∈ [−1, 1].
 * Se multiplica por `scale` y se resta `base` solo para ubicarla en la escena; la proporción entre los dos términos
 * (2 a 1) es la física y no se toca.
 */
export function energyHeight(thetaRad: number, wNorm: number, kind: 'real' | 'linear', scale = 0.8, base = 1.4): number {
  const potential = kind === 'real' ? 1 - Math.cos(thetaRad) : 0.5 * thetaRad * thetaRad
  return scale * (2 * wNorm * wNorm + potential) - base
}
