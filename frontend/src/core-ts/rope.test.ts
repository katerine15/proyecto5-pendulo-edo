import { describe, expect, it } from 'vitest'
import { exactSolution } from './pendulum'
import { RopeChain, linearTension, rigidTension, ropePendulum } from './rope'

const P = (theta0Deg: number) => ({ theta0Deg, L: 1, g: 9.81 })
const T_END = 8, N = 801

describe('péndulo de cuerda', () => {
  it('con θ₀ ≤ 90° la cuerda siempre está tensa y se mueve igual que el péndulo rígido (cuerpo sólido)', () => {
    for (const a of [30, 60, 90]) {
      const s = ropePendulum(a, 1, 9.81, T_END, N)
      expect(Math.min(...s.r)).toBeGreaterThan(1 - 1e-9)
      expect(Math.min(...s.tension)).toBeGreaterThan(-1e-6)
      const dif = s.t.map((t, i) => Math.abs(s.thetaDeg[i] - (exactSolution(t, P(a)) * 180) / Math.PI))
      expect(Math.max(...dif)).toBeLessThan(1e-3)
    }
  })

  it('con θ₀ = 150° la cuerda se afloja desde el inicio y la masa queda dentro del círculo', () => {
    const s = ropePendulum(150, 1, 9.81, T_END, N)
    expect(Math.min(...s.r)).toBeLessThan(0.95)           // hubo tramos con la cuerda floja
    expect(Math.max(...s.r)).toBeLessThan(1 + 1e-6)       // nunca más lejos que L
    expect(s.tension[0]).toBe(0)                          // suelta en reposo por encima de la horizontal: cae libre
    expect(Math.min(...s.tension)).toBeGreaterThanOrEqual(0) // la cuerda nunca empuja
  })

  it('cada tirón pierde energía y nunca la gana', () => {
    const s = ropePendulum(150, 1, 9.81, T_END, N)
    expect(s.energy[s.energy.length - 1]).toBeLessThan(s.energy[0])
    for (let i = 1; i < s.energy.length; i++) expect(s.energy[i]).toBeLessThan(s.energy[0] + 1e-6)
  })

  it('con 150° el movimiento ya no es el del modelo rígido', () => {
    const s = ropePendulum(150, 1, 9.81, 4, 401)
    const dif = s.t.map((t, i) => Math.abs(s.thetaDeg[i] - (exactSolution(t, P(150)) * 180) / Math.PI))
    expect(Math.max(...dif)).toBeGreaterThan(20)
  })
})

describe('tensión', () => {
  it('varilla rígida: 3 cos θ − 2 cos θ₀ (T = mg·cos θ₀ al soltar, 3 − 2 cos θ₀ abajo)', () => {
    expect(rigidTension(90, 90)).toBeCloseTo(0, 12)
    expect(rigidTension(0, 90)).toBeCloseTo(3, 12)
    expect(rigidTension(150, 150)).toBeCloseTo(Math.cos((150 * Math.PI) / 180), 12)
    expect(rigidTension(0, 150)).toBeCloseTo(3 - 2 * Math.cos((150 * Math.PI) / 180), 12)
  })
  it('es negativa (la varilla empuja) solo si θ₀ > 90° y θ queda cerca de la amplitud', () => {
    expect(rigidTension(150, 150)).toBeLessThan(0)
    expect(rigidTension(60, 60)).toBeGreaterThan(0)
  })
  it('la aproximación lineal coincide con la rígida a ángulos pequeños', () => {
    expect(linearTension(5, 10)).toBeCloseTo(rigidTension(5, 10), 3)
  })
})

describe('cuerda dibujada (cadena de Verlet)', () => {
  it('estirada al máximo es una recta rígida', () => {
    const c = new RopeChain(20, 3)
    c.reset(0, 0, 3, 0)
    c.step(1 / 60, 30, 0, 0, 3, 0)
    for (let i = 0; i <= 20; i++) { expect(c.y[i]).toBeCloseTo(0, 12); expect(c.x[i]).toBeCloseTo((3 * i) / 20, 12) }
  })

  it('con los extremos más cerca cuelga: se comba hacia abajo y conserva su longitud', () => {
    const c = new RopeChain(20, 3)
    c.reset(0, 0, 2.2, 0)
    for (let k = 0; k < 600; k++) c.step(1 / 120, 30, 0, 0, 2.2, 0)
    expect(c.y[10]).toBeLessThan(-0.4)                      // el punto medio cuelga
    expect(c.currentLength()).toBeGreaterThan(2.9)
    expect(c.currentLength()).toBeLessThan(3.1)
    expect(c.x[0]).toBe(0); expect(c.x[20]).toBe(2.2)       // los extremos siguen fijos
  })
})
