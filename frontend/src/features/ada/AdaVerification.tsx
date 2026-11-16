import { useEffect, useState } from 'react'
import { adaStatus, adaUrl, sci, type AdaReply } from '../../lib/ada'
import { apiHeaders } from '../../lib/api'
import { fmt } from '../../lib/format'
import { useStore } from '../../state/store'
import { Row, TONE } from '../results/Results'

/**
 * Segunda opinión de ADA (asistente local de IA del grupo). OPCIONAL: solo se muestra si el backend responde, y si ADA está apagada dice
 * que no está conectada sin afectar nada más. Los números del dashboard no dependen de ella.
 */
export function AdaVerification() {
  const sourceName = useStore((s) => s.source.name)
  const theta0 = useStore((s) => s.theta0Deg)
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const [reply, setReply] = useState<AdaReply | null>(null)

  useEffect(() => {
    if (sourceName !== 'api') { setReply(null); return }
    const ctl = new AbortController()
    const timer = setTimeout(async () => {          // espera a que se deje de mover el deslizador
      try {
        const r = await fetch(adaUrl(theta0, L, g), { headers: apiHeaders(), signal: ctl.signal })
        if (!r.ok) throw new Error(`${r.status}`)
        setReply((await r.json()) as AdaReply)
      } catch {
        if (!ctl.signal.aborted) setReply({ available: false, reason: 'No se pudo consultar a Ada (es opcional).' })
      }
    }, 450)
    return () => { clearTimeout(timer); ctl.abort() }
  }, [sourceName, theta0, L, g])

  if (sourceName !== 'api') return null            // modo local (sin backend): ADA no interviene
  const st = adaStatus(reply)
  const color = st.tone === 'off' ? 'var(--muted)' : TONE[st.tone]
  return (
    <section className="panel" aria-label="Verificación de Ada">
      <header className="mb-4">
        <h2 className="h2">Verificación de Ada</h2>
        <p className="small mt-1 max-w-[60ch]">Opcional. Ada es el asistente local de IA del grupo; aquí solo da una segunda opinión, no reemplaza ningún cálculo.</p>
      </header>
      <p aria-live="polite"><b style={{ color, transition: 'color var(--t) var(--ease)' }}>{st.label}.</b>{st.text && <> <span className="small">{st.text}</span></>}</p>
      {reply?.available && reply.T_elliptic_s !== undefined && reply.dashboard && (
        <dl className="readout mt-3">
          <Row label="Período real T según Ada">{fmt(reply.T_elliptic_s, 4)} s</Row>
          <Row label="Diferencia con el dashboard">{sci(reply.abs_diff_T_s ?? 0)} s</Row>
          <Row label="Desacuerdo entre los dos métodos de Ada">{sci(reply.dual_discrepancy ?? 0)}</Row>
          <Row label="Ángulo donde el error pasa del 1 %">{fmt(reply.threshold_deg ?? 0, 2)}°</Row>
        </dl>
      )}
      {reply?.available && reply.methods && <p className="small mt-3">Métodos: {reply.methods.join(' · ')}.</p>}
    </section>
  )
}
