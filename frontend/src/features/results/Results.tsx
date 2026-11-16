import { drift, fmt, verdict } from '../../lib/format'
import { useStore } from '../../state/store'
import { AnimatedNumber } from '../../ui/AnimatedNumber'

export const TONE = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' }

export function Row({ label, children, color }: { label: string; children: React.ReactNode; color?: string }) {
  return (
    <div>
      <dt>{label}</dt><span className="dots" aria-hidden />
      <dd style={{ color }}>{children}</dd>
    </div>
  )
}

/** La respuesta a la pregunta del proyecto, escrita como frase con la cifra animada dentro. */
export function Headline() {
  const sim = useStore((s) => s.sim)
  const theta0 = useStore((s) => s.theta0Deg)
  if (!sim) return null
  const v = verdict(sim.periodErrorPct)
  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      <h2 className="lead max-w-[30ch]">
        A {theta0}°, el modelo lineal subestima el período real en un{' '}
        <AnimatedNumber value={sim.periodErrorPct} decimals={sim.periodErrorPct < 10 ? 2 : 1} /> %.
      </h2>
      <p>
        <b style={{ color: TONE[v.tone], transition: 'color var(--t) var(--ease)' }}>{v.label}.</b>{' '}
        <span className="small">{v.text}</span>
      </p>
    </div>
  )
}

export function Measurements() {
  const sim = useStore((s) => s.sim)
  if (!sim) return null
  return (
    <dl className="readout">
      <Row label="Período lineal T₀" color="var(--lin)"><AnimatedNumber value={sim.T0} decimals={4} /> s</Row>
      <Row label="Período real T" color="var(--real)"><AnimatedNumber value={sim.TReal} decimals={4} /> s</Row>
      <Row label="Período medido en la simulación"><AnimatedNumber value={sim.TMeasured} decimals={4} /> s</Row>
      <Row label="Un reloj calibrado a ángulo pequeño atrasa">{drift(sim.clockDriftSPerDay)}</Row>
    </dl>
  )
}

export function PeriodTable() {
  const rows = useStore((s) => s.rows)
  const theta0 = useStore((s) => s.theta0Deg)
  return (
    <div>
      <p className="small mb-3">T es el período real; T₀, el del modelo lineal. Error = (T − T₀)/T: se divide entre el período real, como las cifras de la guía. Verde bajo 1 %, ámbar bajo 5 %, ciruela desde 5 %.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: 'var(--muted)' }}>
            <th className="pb-2 pr-4 font-medium">θ₀ (°)</th><th className="pb-2 pr-4 font-medium">T (s)</th>
            <th className="pb-2 pr-4 font-medium">T₀ (s)</th><th className="pb-2 text-right font-medium">Error (% de T)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.theta0Deg} className="rule-t" style={{ background: r.theta0Deg === theta0 ? 'var(--grid)' : undefined }}>
              <td className="py-2.5 pr-4">{r.theta0Deg}</td>
              <td className="pr-4" style={{ color: 'var(--real)' }}>{fmt(r.TReal, 4)}</td>
              <td className="pr-4" style={{ color: 'var(--lin)' }}>{fmt(r.T0, 4)}</td>
              <td className="text-right font-semibold" style={{ color: TONE[verdict(r.errorPct).tone] }}>{fmt(r.errorPct, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
