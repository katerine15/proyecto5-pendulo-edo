import { describe, expect, it } from 'vitest'
import { adaStatus, adaUrl, sci, type AdaReply } from './ada'

const base: AdaReply = { available: true, verified: true, agree: true }

describe('verificación opcional de Ada: qué se le muestra a quien mira', () => {
  it('sin respuesta todavía: consulta en curso, sin alarmas', () => {
    expect(adaStatus(null)).toMatchObject({ tone: 'off', label: 'Consultando a Ada…' })
  })

  it('Ada apagada es normal (es opcional): no es un error ni se pinta de rojo', () => {
    const s = adaStatus({ available: false, reason: 'Ada no está conectada (es opcional: el dashboard calcula igual).' })
    expect(s.tone).toBe('off')
    expect(s.label).toBe('Sin segunda opinión de Ada')
    expect(s.text).toContain('no está conectada')
    expect(s.text).toContain('opcional')
    expect(s.text.startsWith(s.label)).toBe(false)
    expect(adaStatus({ available: false }).text).toContain('Es opcional')
  })

  it('verificado por doble método Y de acuerdo con el dashboard: confirma', () => {
    expect(adaStatus(base)).toMatchObject({ tone: 'ok', label: 'Ada confirma el cálculo' })
  })

  it('una discrepancia real entre Ada y el dashboard NUNCA se esconde', () => {
    const s = adaStatus({ ...base, agree: false })
    expect(s.tone).toBe('bad')
    expect(s.label).toContain('NO coinciden')
  })

  it('si los dos métodos de Ada no coinciden entre sí, no cuenta como confirmación (aunque coincida con el dashboard)', () => {
    const s = adaStatus({ ...base, verified: false, agree: true })
    expect(s.tone).toBe('warn')
    expect(s.label).not.toContain('confirma')
  })
})

describe('consulta y formato', () => {
  it('manda los números tal como están en pantalla (incluida la g de la guía)', () => {
    expect(adaUrl(90, 1, 9.81)).toBe('/api/ada/verify?theta0_deg=90&L=1&g=9.81')
  })

  it.each([
    [0, '0'],
    [1.2e-9, '1.2 × 10⁻⁹'],
    [3e-13, '3.0 × 10⁻¹³'],
    [0.01, '1.0 × 10⁻²'],
    [2500, '2.5 × 10³'],
  ])('notación científica corta %s', (x, text) => {
    expect(sci(x)).toBe(text)
  })
})
