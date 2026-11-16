import { describe, expect, it } from 'vitest'
import { dragRelease } from './drag'

describe('ángulo de arrastre con signo', () => {
  it.each([
    ['abajo, a la derecha', 1, -1, 45, 1],
    ['abajo, a la izquierda', -1, -1, 45, -1],
    ['horizontal a la derecha', 1, 0, 90, 1],
    ['horizontal a la izquierda', -1, 0, 90, -1],
    ['arriba, a la derecha (más allá de la horizontal)', 1, 1, 135, 1],
    ['arriba, a la izquierda (más allá de la horizontal)', -1, 1, 135, -1],
  ])('%s', (_name, dx, dy, deg, side) => {
    const r = dragRelease(dx, dy)
    expect(r.magnitudeDeg).toBe(deg)
    expect(r.side).toBe(side)
  })

  it('respeta los límites del modelo (1° a 170°)', () => {
    expect(dragRelease(0, -1).magnitudeDeg).toBe(1)        // justo debajo: 0° → mínimo 1°
    expect(dragRelease(0.01, 1).magnitudeDeg).toBe(170)    // casi encima del pivote: 180° → máximo 170°
    expect(dragRelease(-0.01, 1)).toEqual({ magnitudeDeg: 170, side: -1 })
  })

  it('es simétrica: espejo en x da el mismo ángulo y el lado contrario', () => {
    for (const [dx, dy] of [[0.3, -0.9], [1, 0.2], [0.5, 1.4]]) {
      const a = dragRelease(dx, dy), b = dragRelease(-dx, dy)
      expect(a.magnitudeDeg).toBe(b.magnitudeDeg)
      expect(a.side).toBe(-b.side as 1 | -1)
    }
  })
})
