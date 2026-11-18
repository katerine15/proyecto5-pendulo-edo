/**
 * Física del péndulo en TypeScript. Espejo de backend/app/core/pendulum.py.
 * Permite que el dashboard funcione sin backend (modo local) con los mismos resultados.
 *
 *   real:   θ'' + (g/L) sin θ = 0
 *   lineal: θ'' + (g/L) θ     = 0  →  θ(t) = θ0 cos(ω0 t)
 */

export interface Params {
  theta0Deg: number
  L: number // m
  g: number // m/s²
}

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export const omega0 = (p: Params) => Math.sqrt(p.g / p.L)
export const linearPeriod = (L: number, g: number) => 2 * Math.PI * Math.sqrt(L / g)

export const linearSolution = (t: number, p: Params) => rad(p.theta0Deg) * Math.cos(omega0(p) * t)

/** Media aritmético-geométrica. */
function agm(a: number, b: number): number {
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)]
  return a
}

/** Integral elíptica completa K(m), parámetro m = k². */
export const ellipK = (m: number) => Math.PI / (2 * agm(1, Math.sqrt(1 - m)))

/** sn(u | m) por descenso de Landen (Numerical Recipes, sncndn). */
export function jacobiSn(u: number, m: number): number {
  const emmc = 1 - m
  if (emmc === 0) return Math.tanh(u)
  const em: number[] = []
  const en: number[] = []
  let a = 1
  let emc = emmc
  let c = 1
  let l = 0
  for (let i = 0; i < 16; i++) {
    l = i
    em[i] = a
    emc = Math.sqrt(emc)
    en[i] = emc
    c = 0.5 * (a + emc)
    if (Math.abs(a - emc) <= 1e-14 * a) break
    emc *= a
    a = c
  }
  u *= c
  let sn = Math.sin(u)
  const cn = Math.cos(u)
  if (sn !== 0) {
    a = cn / sn
    c *= a
    let dn = 1
    for (let ii = l; ii >= 0; ii--) {
      const b = em[ii]
      a *= c
      c *= dn
      dn = (en[ii] + a) / (b + a)
      a = c / b
    }
    a = 1 / Math.sqrt(c * c + 1)
    sn = sn >= 0 ? a : -a
  }
  return sn
}

/** Período exacto: T = 4 sqrt(L/g) K(sin²(θ0/2)). */
export function exactPeriod(p: Params): number {
  const m = Math.sin(rad(p.theta0Deg) / 2) ** 2
  return 4 * Math.sqrt(p.L / p.g) * ellipK(m)
}

/** θ(t) exacta (rad) con funciones elípticas de Jacobi. */
export function exactSolution(t: number, p: Params): number {
  const m = Math.sin(rad(p.theta0Deg) / 2) ** 2
  const sn = jacobiSn(ellipK(m) + omega0(p) * t, m)
  return 2 * Math.asin(Math.sqrt(m) * sn)
}

/** Un paso de Runge–Kutta de orden 4 para u' = v, v' = -w2 sin(u). */
function rk4Step(u: number, v: number, h: number, w2: number): [number, number] {
  const f = (uu: number) => -w2 * Math.sin(uu)
  const k1u = v, k1v = f(u)
  const k2u = v + 0.5 * h * k1v, k2v = f(u + 0.5 * h * k1u)
  const k3u = v + 0.5 * h * k2v, k3v = f(u + 0.5 * h * k2u)
  const k4u = v + h * k3v, k4v = f(u + h * k3u)
  return [u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u), v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)]
}

/** Integra el sistema real y devuelve θ (rad) en `times` (creciente). */
export function numericSolution(times: number[], p: Params, h = 1e-3): number[] {
  const w2 = p.g / p.L
  let u = rad(p.theta0Deg), v = 0, t = 0
  return times.map((tt) => {
    while (t < tt - 1e-12) {
      const step = Math.min(h, tt - t)
      ;[u, v] = rk4Step(u, v, step, w2)
      t += step
    }
    return u
  })
}

/** Período medido: la velocidad vuelve a cero en T/2 (interpolación lineal del cruce). */
export function measuredPeriod(p: Params, h = 5e-4): number {
  const w2 = p.g / p.L
  let u = rad(p.theta0Deg), v = 0, t = 0
  const limit = 8 * linearPeriod(p.L, p.g)
  while (t < limit) {
    const [un, vn] = rk4Step(u, v, h, w2)
    if (t > h && v < 0 && vn >= 0) return 2 * (t + (h * -v) / (vn - v))
    u = un; v = vn; t += h
  }
  return NaN
}

export const periodErrorPercent = (p: Params) =>
  (100 * Math.abs(exactPeriod(p) - linearPeriod(p.L, p.g))) / exactPeriod(p)

export function thresholdAngle(percent = 1, L = 1, g = 9.81): number {
  let lo = 0.1, hi = 170
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (periodErrorPercent({ theta0Deg: mid, L, g }) > percent) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/** Segundos que atrasa por día un reloj calibrado con T0 si oscila con amplitud θ0. */
export const dailyClockDrift = (p: Params) => 86400 * (1 - linearPeriod(p.L, p.g) / exactPeriod(p))

export const toDeg = deg
