import { fmt } from '../../lib/format'
import { useStore } from '../../state/store'
import { AnimatedNumber } from '../../ui/AnimatedNumber'
import { Row } from '../results/Results'

/** Red neuronal pequeña que estima el período; se compara siempre con el valor exacto. */
export function Predictor() {
  const p = useStore((s) => s.prediction)
  if (!p) return null
  return (
    <div className="flex flex-col gap-3">
      <p className="small">
        Una red entrenada solo con ángulos y períodos estima cuánto dura una oscilación a {p.theta0Deg}°. Aquí se contrasta con el cálculo exacto.
      </p>
      <dl className="readout">
        <Row label="Red neuronal" color="var(--lin)"><AnimatedNumber value={p.TPred} decimals={4} /> s</Row>
        <Row label="Cálculo exacto"><AnimatedNumber value={p.TTrue} decimals={4} /> s</Row>
        <Row label="Error de la predicción" color={p.relErrorPct < 1 ? 'var(--ok)' : 'var(--warn)'}>
          <AnimatedNumber value={p.relErrorPct} decimals={3} /> %
        </Row>
      </dl>
      {!p.inTrainingRange && (
        <p className="small" style={{ color: 'var(--bad)' }}>Este ángulo está fuera del rango de entrenamiento (1° a 160°): la predicción no es fiable.</p>
      )}
      <p className="small">
        Arquitectura 1-24-24-1, 400 ángulos de entrenamiento. En {p.nTest ?? 300} ángulos de prueba que no vio: error medio {fmt(p.meanErrPct, 2)} %, máximo {fmt(p.maxErrPct, 2)} %.
        {p.maxErrFullPct !== undefined && (
          <> En <b>todo</b> el rango entrenado (1° a 160°) el error máximo llega a {fmt(p.maxErrFullPct, 2)} %
            {p.maxErrAtDeg !== undefined && <>, en {fmt(p.maxErrAtDeg, 0)}°, el borde del rango</>}.</>
        )}{' '}
        Imita a la física; no la reemplaza.
      </p>
    </div>
  )
}
