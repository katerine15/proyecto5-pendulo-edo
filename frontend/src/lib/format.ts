export const fmt = (x: number, d = 2) => x.toFixed(d).replace('-', '−')

/** Reglas de lectura del veredicto (umbrales de la guía: 1 % y 5 %). */
export function verdict(errPct: number): { label: string; tone: 'ok' | 'warn' | 'bad'; text: string } {
  if (errPct < 1) return { label: 'La aproximación lineal vale', tone: 'ok',
    text: 'El error del período es menor al 1 %: usar sen θ ≈ θ es razonable.' }
  if (errPct < 5) return { label: 'Aceptable, con cuidado', tone: 'warn',
    text: 'El error pasó del 1 %. Sirve para estimaciones, no para relojes ni mediciones finas.' }
  return { label: 'La aproximación lineal falla', tone: 'bad',
    text: 'El péndulo real oscila notablemente más lento que el modelo lineal.' }
}

/** Segundos por día → texto legible (min:s cuando es grande). */
export function drift(s: number): string {
  if (Math.abs(s) < 120) return `${fmt(s, 0)} s/día`
  return `${fmt(s / 60, 1)} min/día`
}
