/**
 * Masa-resorte amortiguada en TypeScript. Espejo de backend/app/core/spring_mass.py.
 *   m x'' + c x' + k x = 0,  x(0) = x0,  x'(0) = v0
 */
export interface SpringParams { m: number; c: number; k: number; x0: number; v0: number }

export type Regime = 'subamortiguado' | 'crítico' | 'sobreamortiguado'

export const omegaN = (p: SpringParams) => Math.sqrt(p.k / p.m)
export const zeta = (p: SpringParams) => p.c / (2 * Math.sqrt(p.m * p.k))
const alpha = (p: SpringParams) => p.c / (2 * p.m)

export function regime(p: SpringParams): Regime {
  const disc = p.c ** 2 - 4 * p.m * p.k
  if (Math.abs(disc) <= 1e-9 * Math.max(p.c ** 2, 4 * p.m * p.k, 1e-12)) return 'crítico'
  return disc < 0 ? 'subamortiguado' : 'sobreamortiguado'
}

/** Solución analítica según el régimen (se deduce de las raíces de m r² + c r + k = 0). */
export function exactSolution(t: number, p: SpringParams): number {
  const a = alpha(p)
  switch (regime(p)) {
    case 'subamortiguado': {
      const wd = omegaN(p) * Math.sqrt(1 - zeta(p) ** 2)
      return Math.exp(-a * t) * (p.x0 * Math.cos(wd * t) + ((p.v0 + a * p.x0) / wd) * Math.sin(wd * t))
    }
    case 'crítico':
      return (p.x0 + (p.v0 + a * p.x0) * t) * Math.exp(-a * t)
    default: {
      const s = Math.sqrt(a * a - omegaN(p) ** 2)
      const r1 = -a + s, r2 = -a - s
      const c1 = (p.v0 - r2 * p.x0) / (r1 - r2)
      return c1 * Math.exp(r1 * t) + (p.x0 - c1) * Math.exp(r2 * t)
    }
  }
}

/** RK4 sobre u' = v, v' = −(c v + k u)/m. Devuelve x en `times` (creciente). */
export function numericSolution(times: number[], p: SpringParams, h = 1e-3): number[] {
  let u = p.x0, v = p.v0, t = 0
  const f = (uu: number, vv: number) => -(p.c * vv + p.k * uu) / p.m
  return times.map((tt) => {
    while (t < tt - 1e-12) {
      const s = Math.min(h, tt - t)
      const k1u = v, k1v = f(u, v)
      const k2u = v + 0.5 * s * k1v, k2v = f(u + 0.5 * s * k1u, k2u)
      const k3u = v + 0.5 * s * k2v, k3v = f(u + 0.5 * s * k2u, k3u)
      const k4u = v + s * k3v, k4v = f(u + s * k3u, k4u)
      u += (s / 6) * (k1u + 2 * k2u + 2 * k3u + k4u)
      v += (s / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
      t += s
    }
    return u
  })
}

export function dampedPeriod(p: SpringParams): number | null {
  return regime(p) === 'subamortiguado' ? (2 * Math.PI) / (omegaN(p) * Math.sqrt(1 - zeta(p) ** 2)) : null
}

/** Malla de tiempo lo bastante larga para que la respuesta se asiente (la raíz más lenta manda el decaimiento). */
function timeGrid(p: SpringParams, n = 60001): number[] {
  const a = alpha(p)
  const slow = regime(p) === 'sobreamortiguado' ? a - Math.sqrt(a * a - omegaN(p) ** 2) : a
  return Array.from({ length: n }, (_, i) => (i * 25) / slow / (n - 1))
}

/**
 * Tiempo de asentamiento como lo define la guía: el instante a partir del cual |x| queda por debajo del 2 % de |x0|.
 * Se mide sobre la solución exacta; la fórmula 4/α da valores distintos (p. ej. 0.40 s en vez de 0.58 s en el caso crítico).
 */
export function settlingTime(p: SpringParams, frac = 0.02): number | null {
  if (p.c === 0) return null
  const t = timeGrid(p)
  const x = t.map((tt) => Math.abs(exactSolution(tt, p)))
  const ref = p.x0 !== 0 ? Math.abs(p.x0) : Math.max(...x)
  if (ref === 0) return 0
  for (let i = x.length - 1; i >= 0; i--) if (x[i] > frac * ref) return t[Math.min(i + 1, t.length - 1)]
  return 0
}

/** Sobreimpulso: cuánto pasa del equilibrio hacia el otro lado, en % de |x0|. */
export function overshootPercent(p: SpringParams): number {
  if (p.c === 0) return 100
  const t = timeGrid(p)
  const sign = p.x0 >= 0 ? 1 : -1
  let minSigned = Infinity, maxAbs = 0
  for (const tt of t) {
    const x = exactSolution(tt, p)
    minSigned = Math.min(minSigned, sign * x)
    maxAbs = Math.max(maxAbs, Math.abs(x))
  }
  const ref = p.x0 !== 0 ? Math.abs(p.x0) : maxAbs
  return ref === 0 ? 0 : (Math.max(0, -minSigned) / ref) * 100
}
