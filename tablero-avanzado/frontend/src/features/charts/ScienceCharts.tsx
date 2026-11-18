import { useMemo } from 'react'
import {
  CONVERGENCE_HS, METHOD_LABEL, type Method, convergence, driftCurve, energyDrift, periodRatioExact,
  periodRatioSeries, phaseCurveLinear, phaseCurveReal, separatrix, stateAt,
} from '../../core-ts/analysis'
import { fmt } from '../../lib/format'
import { useStore } from '../../state/store'
import { Legend, LineChart, type Series } from './LineChart'

const DEEP = [30, 60, 120, 150, 170]

/** Espacio de fases (θ, ω): el real son niveles de energía; el lineal, elipses. Un punto por péndulo sigue la animación. */
export function PhasePortrait() {
  const theta0Deg = useStore((s) => s.theta0Deg)
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const { series, yMax } = useMemo(() => {
    const sx = separatrix(L, g)
    const real = phaseCurveReal(theta0Deg, L, g), lin = phaseCurveLinear(theta0Deg, L, g)
    const list: Series[] = [
      ...DEEP.filter((a) => Math.abs(a - theta0Deg) > 4).map((a) => {
        const c = phaseCurveReal(a, L, g)
        return { id: `e${a}`, label: `θ₀ = ${a}°`, color: 'var(--grid-strong)', x: c.x, y: c.y, width: 1.2 }
      }),
      { id: 'sepU', label: 'Separatriz', color: 'var(--warn)', x: sx.x, y: sx.top, dash: '6 5', width: 1.8 },
      { id: 'sepD', label: 'Separatriz', color: 'var(--warn)', x: sx.x, y: sx.bottom, dash: '6 5', width: 1.8 },
      { id: 'lin', label: 'Lineal', color: 'var(--lin)', x: lin.x, y: lin.y },
      { id: 'real', label: 'Real', color: 'var(--real)', x: real.x, y: real.y },
    ]
    return { series: list, yMax: Math.ceil((2 * Math.sqrt(g / L) * 180) / Math.PI * 1.12 / 50) * 50 }
  }, [theta0Deg, L, g])

  return (
    <div className="flex flex-col gap-3">
      <Legend items={[
        { label: `Real, θ₀ = ${theta0Deg}°: curva de energía constante`, color: 'var(--real)' },
        { label: 'Lineal: elipse', color: 'var(--lin)' },
        { label: 'Separatriz', color: 'var(--warn)', dash: true },
      ]} />
      <LineChart series={series} hover={false} height={420} xLabel="Ángulo θ" xUnit="°" yLabel="Velocidad angular ω" yUnit="°/s"
        xDomain={[-190, 190]} yDomain={[-yMax, yMax]}
        liveDots={() => {
          const { t, side } = useStore.getState()
          const st = stateAt(t, { theta0Deg, L, g })
          return [
            { x: st.lin.x * side, y: st.lin.y * side, color: 'var(--lin)' },
            { x: st.real.x * side, y: st.real.y * side, color: 'var(--real)' },
          ]
        }}
        ariaLabel="Espacio de fases del péndulo: velocidad angular contra ángulo" />
      <p className="small max-w-[70ch]">
        El péndulo real recorre una curva de energía constante; el lineal, una elipse. A ángulos pequeños coinciden; a ángulos grandes la curva real se
        achata hacia la <b style={{ color: 'var(--warn)' }}>separatriz</b>, la frontera a ±180° donde el péndulo dejaría de oscilar y daría vueltas.
        Los puntos siguen la animación.
      </p>
    </div>
  )
}

const METHODS: Method[] = ['euler', 'symplectic', 'rk4']
const M_COLOR: Record<Method, string> = {
  euler: 'var(--bad)', symplectic: 'var(--lin)', heun: 'var(--warn)', rk4: 'var(--exact)',
}

/** Conservación de energía a 50 s con paso h = 0.05 s, en décadas (log₁₀ de la deriva relativa). */
export function EnergyChart() {
  const theta0Deg = useStore((s) => s.theta0Deg)
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const data = useMemo(() => METHODS.map((m) => {
    const d = energyDrift(m, { theta0Deg, L, g }, 0.05, 50, 5)
    return { m, d, last: d.rel[d.rel.length - 1], max: Math.max(...d.rel) }
  }), [theta0Deg, L, g])
  const series: Series[] = data.map(({ m, d }) => ({
    id: m, label: METHOD_LABEL[m], color: M_COLOR[m], x: d.t.slice(1), y: d.rel.slice(1).map((r) => Math.log10(Math.max(r, 1e-16))), // t = 0 es exactamente 0: no tiene logaritmo
  }))
  return (
    <div className="flex flex-col gap-3">
      <Legend items={data.map(({ m }) => ({ label: METHOD_LABEL[m], color: M_COLOR[m] }))} />
      <LineChart series={series} height={340} xLabel="Tiempo t" xUnit="s" yLabel="log₁₀ |ΔE/E₀|" yUnit="adimensional" xDomain={[0, 50]}
        ariaLabel="Deriva relativa de la energía de tres métodos numéricos" />
      <dl className="readout">
        {data.map(({ m, last, max }) => (
          <div key={m}>
            <dt style={{ color: M_COLOR[m] }}>{METHOD_LABEL[m]}</dt><span className="dots" aria-hidden />
            <dd>{m === 'symplectic' ? `acotada, máx. ${fmt(max * 100, 1)} %` : `${last >= 1 ? fmt(last, 1) + '×' : fmt(last * 100, last < 1e-4 ? 6 : 3) + ' %'} a 50 s`}</dd>
          </div>
        ))}
      </dl>
      <p className="small max-w-[70ch]">
        La energía de un péndulo sin rozamiento es constante. Euler explícito la hace crecer sin control; Euler simpléctico la mantiene acotada porque respeta la
        estructura del problema; RK4 es de orden alto y casi no la deriva en este horizonte.
      </p>
    </div>
  )
}

/** Error máximo contra paso h, en escala log–log; las pendientes son los órdenes observados de cada método. */
export function ConvergenceChart() {
  const theta0Deg = useStore((s) => s.theta0Deg)
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const ms: Method[] = ['euler', 'heun', 'rk4']
  const data = useMemo(() => ms.map((m) => {
    const c = convergence(m, { theta0Deg, L, g }, CONVERGENCE_HS[m])
    return { m, c }
  }), [theta0Deg, L, g])
  const series: Series[] = data.map(({ m, c }) => ({
    id: m, label: METHOD_LABEL[m], color: M_COLOR[m], x: c.hs.map(Math.log10), y: c.err.map((e) => Math.log10(e)), markers: true,
  }))
  return (
    <div className="flex flex-col gap-3">
      <Legend items={data.map(({ m, c }) => ({ label: `${METHOD_LABEL[m]}: pendiente ${fmt(c.slope, 2)}`, color: M_COLOR[m] }))} />
      <LineChart series={series} height={340} xLabel="log₁₀ h" xUnit="h en s" yLabel="log₁₀ error máx." yUnit="rad"
        ariaLabel="Error contra paso en escala logarítmica: tres rectas de pendiente distinta" />
      <p className="small max-w-[70ch]">
        En escala log–log el error de cada método es una recta cuya pendiente es su orden: cerca de 1 para Euler, 2 para Heun y 4 para Runge–Kutta.
        El error es el máximo contra la solución exacta (funciones elípticas) en 10 s.
      </p>
    </div>
  )
}

/** T/T₀ contra θ₀: exacto, desarrollo en serie de orden 2, 4 y 6, y el modelo lineal (constante 1). */
export function PeriodSeriesChart() {
  const series = useMemo<Series[]>(() => {
    const x = Array.from({ length: 100 }, (_, i) => 1 + (i * 149) / 99)
    return [
      { id: 'lin', label: 'Lineal (T = T₀)', color: 'var(--lin)', x, y: x.map(() => 1) },
      { id: 's2', label: 'Serie, orden 2', color: 'var(--warn)', x, y: x.map((a) => periodRatioSeries(a, 2)), dash: '5 4' },
      { id: 's4', label: 'Serie, orden 4', color: 'var(--bad)', x, y: x.map((a) => periodRatioSeries(a, 4)), dash: '5 4' },
      { id: 's6', label: 'Serie, orden 6', color: 'var(--ink-2)', x, y: x.map((a) => periodRatioSeries(a, 6)), dash: '2 4' },
      { id: 'ex', label: 'Exacto (elíptica)', color: 'var(--real)', x, y: x.map(periodRatioExact), width: 2.6 },
    ]
  }, [])
  return (
    <div className="flex flex-col gap-3">
      <Legend items={series.map((s) => ({ label: s.label, color: s.color, dash: !!s.dash }))} />
      <LineChart series={series} height={340} xLabel="Ángulo de suelta θ₀" xUnit="°" yLabel="Razón T / T₀" yUnit="adimensional"
        yDomain={[0.98, 2.4]} xDomain={[0, 150]} ariaLabel="Razón entre el período real y el lineal, exacta y por series" />
      <p className="small max-w-[70ch]">
        El período real crece con la amplitud: T/T₀ ≈ 1 + θ₀²/16 + 11θ₀⁴/3072 + … Cada término de la serie se acerca más a la curva exacta,
        y el modelo lineal es la recta en 1.
      </p>
    </div>
  )
}

/** Cuánto atrasa por día un reloj calibrado con T₀ en función de la amplitud. */
export function DriftChart({ markAngle }: { markAngle?: number }) {
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const series = useMemo<Series[]>(() => {
    const c = driftCurve(L, g)
    return [{ id: 'd', label: 'Atraso del reloj', color: 'var(--real)', x: c.x, y: c.y }]
  }, [L, g])
  return (
    <div className="flex flex-col gap-3">
      <LineChart series={series} height={300} xLabel="Amplitud θ₀" xUnit="°" yLabel="Atraso del reloj" yUnit="min/día"
        xDomain={[0, 170]} vMarks={markAngle ? [{ value: markAngle, label: `${fmt(markAngle, 1)}°`, color: 'var(--warn)' }] : []}
        ariaLabel="Minutos que atrasa por día un reloj de péndulo según su amplitud" />
    </div>
  )
}
