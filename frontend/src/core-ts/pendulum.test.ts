import { describe, expect, it } from 'vitest'
import {
  dailyClockDrift, exactPeriod, exactSolution, linearPeriod, measuredPeriod,
  numericSolution, periodErrorPercent, thresholdAngle,
} from './pendulum'
import { predictRatio } from './surrogate'

const P = (theta0Deg: number) => ({ theta0Deg, L: 1, g: 9.81 })

describe('paridad con los valores de la guía (y con Python)', () => {
  it('T0', () => expect(linearPeriod(1, 9.81)).toBeCloseTo(2.0061, 3))

  it.each([[10, 2.0099], [45, 2.0863], [90, 2.3679], [150, 3.5351]])('período a %i°', (a, T) => {
    expect(exactPeriod(P(a))).toBeCloseTo(T, 3)
    expect(measuredPeriod(P(a))).toBeCloseTo(T, 3)
  })

  it('error del período', () => {
    expect(periodErrorPercent(P(10))).toBeCloseTo(0.19, 1)
    expect(periodErrorPercent(P(90))).toBeCloseTo(15.3, 0)
  })

  it('umbral del 1 % cerca de 23°', () => expect(thresholdAngle(1)).toBeCloseTo(23, 0))

  it('RK4 coincide con la solución elíptica exacta', () => {
    const ts = Array.from({ length: 50 }, (_, i) => i * 0.2)
    const num = numericSolution(ts, P(120))
    ts.forEach((t, i) => expect(Math.abs(num[i] - exactSolution(t, P(120)))).toBeLessThan(1e-7))
  })

  it('el reloj atrasa más con más amplitud', () => {
    expect(dailyClockDrift(P(45))).toBeGreaterThan(dailyClockDrift(P(10)))
  })

  it('el predictor ML acierta el período a menos del 1 %', () => {
    for (const a of [12, 33, 77, 120, 155]) {
      const pred = predictRatio(a) * linearPeriod(1, 9.81)
      expect(Math.abs(pred - exactPeriod(P(a))) / exactPeriod(P(a))).toBeLessThan(0.01)
    }
  })

  it('ángulo extremo 170° devuelve período medido finito consistente', () => {
    const T = exactPeriod(P(170))
    expect(Number.isFinite(T)).toBe(true)
    expect(measuredPeriod(P(170))).toBeCloseTo(T, 3)
  })
})
