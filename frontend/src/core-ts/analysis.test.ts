import { describe, expect, it } from 'vitest'
import {
  CONVERGENCE_HS, convergence, designFor, driftCurve, energyDrift, periodRatioExact, periodRatioSeries, phaseCurveLinear, phaseCurveReal,
  energyHeight, separatrix, stateAt,
} from './analysis'
import { exactPeriod, linearPeriod } from './pendulum'

const P = (theta0Deg: number) => ({ theta0Deg, L: 1, g: 9.81 })

describe('conservación de energía', () => {
  const run = (m: 'euler' | 'symplectic' | 'rk4') => energyDrift(m, P(90), 0.05, 50, 20).rel
  it('Euler explícito gana energía y el simpléctico la conserva acotada', () => {
    const euler = run('euler'), sym = run('symplectic')
    expect(euler[euler.length - 1]).toBeGreaterThan(5) // la energía crece más de 5 veces
    expect(Math.max(...sym)).toBeLessThan(0.1)
  })
  it('RK4 la conserva mucho mejor que ambos en este horizonte', () => {
    expect(Math.max(...run('rk4'))).toBeLessThan(1e-3)
  })
})

describe('orden de convergencia observado', () => {
  it.each([['euler', 1], ['heun', 2], ['rk4', 4]] as const)('%s ≈ orden %i', (m, order) => {
    const s = convergence(m, P(60), CONVERGENCE_HS[m]).slope
    expect(s).toBeGreaterThan(order - 0.25)
    expect(s).toBeLessThan(order + 0.25)
  })
})

describe('serie del período', () => {
  it('coincide con el período exacto a ángulos pequeños y mejora con el orden', () => {
    expect(Math.abs(periodRatioSeries(10, 4) - periodRatioExact(10))).toBeLessThan(1e-7)
    const e = (o: 2 | 4 | 6) => Math.abs(periodRatioSeries(60, o) - periodRatioExact(60))
    expect(e(4)).toBeLessThan(e(2))
    expect(e(6)).toBeLessThan(e(4))
  })
})

describe('espacio de fases', () => {
  it('las curvas reales son niveles de energía y cierran', () => {
    const c = phaseCurveReal(90, 1, 9.81)
    const w2 = 9.81
    const E = (th: number, w: number) => 0.5 * ((w * Math.PI) / 180) ** 2 + w2 * (1 - Math.cos((th * Math.PI) / 180))
    const E0 = E(c.x[0], c.y[0])
    c.x.forEach((th, i) => expect(Math.abs(E(th, c.y[i]) - E0) / E0).toBeLessThan(1e-9))
    expect(c.x[0]).toBeCloseTo(c.x[c.x.length - 1], 6)
  })
  it('la separatriz pasa por ±180° con velocidad cero', () => {
    const s = separatrix(1, 9.81)
    expect(Math.abs(s.top[0])).toBeLessThan(1e-9)
    expect(s.top[90]).toBeCloseTo(2 * Math.sqrt(9.81) * 180 / Math.PI, 6)
  })
  it('estado en t=0: en reposo en θ₀', () => {
    const s = stateAt(0, P(90))
    expect(s.real.x).toBeCloseTo(90, 6)
    expect(Math.abs(s.real.y)).toBeLessThan(1e-3)
    expect(s.lin.x).toBeCloseTo(90, 6)
  })
})

describe('herramienta de diseño', () => {
  it('1 % ⇒ cerca de 23° y el período queda dentro de la tolerancia', () => {
    const d = designFor(1, 1, 9.81)
    expect(d.angleDeg).toBeCloseTo(23, 0)
    expect(d.errorPct).toBeCloseTo(1, 3)
    expect(d.T / linearPeriod(1, 9.81) - 1).toBeCloseTo(exactPeriod({ theta0Deg: d.angleDeg, L: 1, g: 9.81 }) / d.T0 - 1, 9)
  })
  it('más tolerancia permite más ángulo; la deriva del reloj crece con el ángulo', () => {
    expect(designFor(5, 1, 9.81).angleDeg).toBeGreaterThan(designFor(1, 1, 9.81).angleDeg)
    const c = driftCurve(1, 9.81)
    expect(c.y[c.y.length - 1]).toBeGreaterThan(c.y[10])
  })
})

describe('altura de la superficie de energía en 3D', () => {
  const g = 9.81, L = 1
  const wSep = 2 * Math.sqrt(g / L)
  const hAlong = (curve: { x: number[]; y: number[] }, kind: 'real' | 'linear') =>
    curve.x.map((xd, i) => energyHeight((xd * Math.PI) / 180, curve.y[i] / ((wSep * 180) / Math.PI), kind))

  it.each([30, 90, 150])('la órbita real a %i° queda a altura constante (energía constante)', (a) => {
    const h = hAlong(phaseCurveReal(a, L, g), 'real')
    expect(Math.max(...h) - Math.min(...h)).toBeLessThan(1e-9)
  })

  it('la órbita lineal también es plana sobre su paraboloide', () => {
    const h = hAlong(phaseCurveLinear(90, L, g), 'linear')
    expect(Math.max(...h) - Math.min(...h)).toBeLessThan(1e-9)
  })

  it('la separatriz está a la altura de E = 2 g/L y la superficie real queda por debajo de la lineal a ángulos grandes', () => {
    expect(energyHeight(0, 1, 'real') + 1.4).toBeCloseTo(0.8 * 2, 12)            // (θ = 0, ω = ω_sep)
    expect(energyHeight(Math.PI, 0, 'real') + 1.4).toBeCloseTo(0.8 * 2, 12)      // (θ = π, ω = 0): mismo nivel de energía
    expect(energyHeight(2.5, 0, 'real')).toBeLessThan(energyHeight(2.5, 0, 'linear'))
  })
})
