/** Comprueba el contraste WCAG de los pares de color de los tokens, en claro y oscuro. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const [, k, v] of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) out[k] = v
  return out
}

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [texto, fondo, mínimo]: 4.5 para texto, 3 para trazos gráficos
const PAIRS: [string, string, number][] = [
  ['ink', 'bg', 4.5], ['ink-2', 'bg', 4.5], ['muted', 'bg', 4.5],
  ['lin', 'paper', 4.5], ['real', 'paper', 4.5], ['exact', 'paper', 4.5],
  ['ok', 'bg', 4.5], ['warn', 'bg', 4.5], ['bad', 'bg', 4.5],
  ['bg', 'ink', 4.5], // texto de los chips seleccionados
  ['grid-strong', 'paper', 1.1],
]

describe.each([['light', ':root[data-theme="light"]'], ['dark', ':root[data-theme="dark"]']])(
  'contraste en tema %s', (_name, sel) => {
    const t = block(sel)
    it('encuentra el bloque del tema', () => {
      expect(css.indexOf(sel)).toBeGreaterThan(-1)
      expect(Object.keys(t).length).toBeGreaterThan(10)
    })
    it.each(PAIRS)('%s sobre %s ≥ %f', (fg, bg, min) => {
      expect(t[fg], `falta --${fg}`).toBeTruthy()
      expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(min)
    })
  })
