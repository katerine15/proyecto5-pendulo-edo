import { describe, expect, it } from 'vitest'
import { dampedPeriod, exactSolution, numericSolution, omegaN, overshootPercent, regime, settlingTime, zeta } from './springMass'

const P = (c: number, v0 = 0.5) => ({ m: 1, c, k: 4, x0: 1, v0 })

describe('masa-resorte amortiguada (espejo de Python)', () => {
  it.each([[0.4, 'subamortiguado'], [4, 'crítico'], [10, 'sobreamortiguado']] as const)('c = %f es %s', (c, r) => {
    expect(regime(P(c))).toBe(r)
  })

  it.each([0.4, 4, 10])('la analítica cumple las condiciones iniciales y coincide con RK4 (c = %f)', (c) => {
    const p = P(c)
    expect(exactSolution(0, p)).toBeCloseTo(1, 12)
    expect((exactSolution(1e-6, p) - exactSolution(0, p)) / 1e-6).toBeCloseTo(0.5, 3)
    const ts = Array.from({ length: 60 }, (_, i) => i * 0.2)
    const num = numericSolution(ts, p)
    ts.forEach((t, i) => expect(Math.abs(num[i] - exactSolution(t, p))).toBeLessThan(1e-7))
  })

  it('valores conocidos', () => {
    const p = P(0.4)
    expect(omegaN(p)).toBeCloseTo(2, 12)
    expect(zeta(p)).toBeCloseTo(0.1, 12)
    expect(dampedPeriod(p)).toBeCloseTo((2 * Math.PI) / (2 * Math.sqrt(1 - 0.01)), 12)
    expect(dampedPeriod(P(10))).toBeNull()
    expect(settlingTime(P(10))!).toBeGreaterThan(settlingTime(P(4))!) // el sobreamortiguado tarda más que el crítico
  })
})

describe('Proyecto 1 de la guía: m = 300 kg, k = 30 000 N/m, x₀ = 5 cm', () => {
  const cCr = 2 * Math.sqrt(300 * 30000)
  const P1 = (z: number) => ({ m: 300, c: z * cCr, k: 30000, x0: 0.05, v0: 0 })

  it.each([[0.3, 1.1], [1, 0.58], [1.5, 1.07]])('tiempo de asentamiento con c = %f·c_cr ≈ %f s', (z, ref) => {
    expect(settlingTime(P1(z))!).toBeCloseTo(ref, 1)
  })

  it('sobreimpulso: ≈ 37 % si es subamortiguado y 0 en el crítico y el sobreamortiguado', () => {
    expect(overshootPercent(P1(0.3))).toBeGreaterThan(36)
    expect(overshootPercent(P1(0.3))).toBeLessThan(38)
    expect(overshootPercent(P1(1))).toBeCloseTo(0, 6)
    expect(overshootPercent(P1(1.5))).toBeCloseTo(0, 6)
  })

  it('casos borde: c = 0 sin amortiguamiento y x0 = 0 con v0 ≠ 0', () => {
    const undamped = { m: 1, c: 0, k: 4, x0: 1, v0: 0 }
    expect(settlingTime(undamped)).toBeNull()
    expect(overshootPercent(undamped)).toBe(100)
    const pulse = { m: 1, c: 0.4, k: 4, x0: 0, v0: 4 }
    expect(exactSolution(0, pulse)).toBeCloseTo(0, 12)
    expect(Number.isFinite(overshootPercent(pulse))).toBe(true)
  })
})
