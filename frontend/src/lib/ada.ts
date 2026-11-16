/** Verificación OPCIONAL por ADA: tipos de la respuesta de `/api/ada/verify` y la regla que decide qué se le muestra a quien mira. */
export interface AdaReply {
  available: boolean
  reason?: string
  verified?: boolean
  agree?: boolean
  methods?: string[]
  dual_discrepancy?: number
  T0_s?: number
  T_elliptic_s?: number
  T_dop853_s?: number
  period_error_pct?: number
  threshold_deg?: number
  abs_diff_T_s?: number
  abs_diff_error_pct?: number
  dashboard?: { T_s: number; period_error_pct: number }
}

export type AdaTone = 'ok' | 'warn' | 'bad' | 'off'

export interface AdaStatus { tone: AdaTone; label: string; text: string }

/** Una discrepancia entre ADA y el dashboard NUNCA se esconde: es 'bad'. Que ADA esté apagada es normal ('off'): es opcional. */
export function adaStatus(r: AdaReply | null): AdaStatus {
  if (r === null) return { tone: 'off', label: 'Consultando a Ada…', text: '' }
  if (!r.available) return { tone: 'off', label: 'Sin segunda opinión de Ada', text: r.reason ?? 'Es opcional: el dashboard calcula igual.' }
  if (!r.verified) return { tone: 'warn', label: 'Ada no pudo verificar por doble método',
    text: 'Sus dos métodos independientes no coincidieron entre sí; no uses su resultado como confirmación.' }
  if (!r.agree) return { tone: 'bad', label: 'Ada y el dashboard NO coinciden',
    text: 'Hay una diferencia real entre los dos cálculos: revisa los parámetros (g, L) antes de confiar en alguno.' }
  return { tone: 'ok', label: 'Ada confirma el cálculo',
    text: 'Ada resolvió el período por dos métodos independientes y su resultado coincide con el del dashboard.' }
}

/** Ruta de la consulta, con los números tal como están en pantalla. */
export const adaUrl = (theta0Deg: number, L: number, g: number) => `/api/ada/verify?theta0_deg=${theta0Deg}&L=${L}&g=${g}`

/** Diferencia en notación científica corta (1.2e-9), porque aquí lo interesante es qué tan cerca están, no el número en sí. */
const SUPERSCRIPT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' }
export function sci(x: number): string {
  if (x === 0) return '0'
  const [mantissa, exp] = x.toExponential(1).split('e')
  return `${mantissa} × 10${[...String(parseInt(exp, 10))].map((c) => SUPERSCRIPT[c]).join('')}`
}
