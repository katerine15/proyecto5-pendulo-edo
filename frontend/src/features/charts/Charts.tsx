import { useMemo, useState } from 'react'
import {
  exactPeriod, exactSolution, linearPeriod, linearSolution, numericSolution, periodErrorPercent, toDeg,
} from '../../core-ts/pendulum'
import { fmt } from '../../lib/format'
import { T_MAX, useStore } from '../../state/store'
import { SegmentedTabs } from '../../ui/SegmentedTabs'
import { Legend, LineChart, type Series } from './LineChart'

export function TrajectoryChart() {
  const sim = useStore((s) => s.sim)
  const setT = useStore((s) => s.setT)
  const showExact = useStore((s) => s.showExact)

  const series = useMemo<Series[]>(() => {
    if (!sim) return []
    const base: Series[] = [
      { id: 'lin', label: 'Lineal', color: 'var(--lin)', x: sim.t, y: sim.thetaLinearDeg },
      { id: 'real', label: 'Real (RK4)', color: 'var(--real)', x: sim.t, y: sim.thetaRealDeg },
    ]
    return showExact
      ? [...base, { id: 'exact', label: 'Exacta (elíptica)', color: 'var(--exact)', x: sim.t, y: sim.thetaExactDeg, dash: '2 5', width: 2.6 }]
      : base
  }, [sim, showExact])

  if (!sim) return null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend items={[
          { label: 'Lineal: θ₀ cos(ω₀t)', color: 'var(--lin)' },
          { label: 'Real: integración numérica', color: 'var(--real)' },
          ...(showExact ? [{ label: 'Exacta (verificación)', color: 'var(--exact)', dash: true }] : []),
        ]} />
        <span className="small" style={{ color: 'var(--muted)' }}>Arrastra sobre la gráfica para mover el tiempo t</span>
      </div>
      <LineChart series={series} xLabel="Tiempo t" xUnit="s" yLabel="Ángulo θ" yUnit="°"
        xDomain={[0, T_MAX]} liveCursor={() => useStore.getState().t} onSeek={setT} bandBetween={['lin', 'real']}
        height={340} ariaLabel="Ángulo contra tiempo: modelo lineal, real y exacto" />
      <p className="small">
        La curva numérica y la exacta coinciden (diferencia máxima{' '}
        <span style={{ color: 'var(--exact)' }}>{sim.numericVsExactDeg.toExponential(1)}°</span>
        ): el programa verifica la solución, no la reemplaza. La lineal se separa del real:{' '}
        <span style={{ color: 'var(--real)' }}>{fmt(sim.maxGapDeg, 0)}°</span> de desfase máximo.
      </p>
    </div>
  )
}

export function ErrorChart() {
  const curve = useStore((s) => s.curve)
  const theta0 = useStore((s) => s.theta0Deg)
  const row = useStore((s) => s.sim?.periodErrorPct)

  const series = useMemo<Series[]>(() => curve ? [
    { id: 'err', label: 'Error del período', color: 'var(--real)', x: curve.theta0Deg, y: curve.errorPct, fill: true },
  ] : [], [curve])

  if (!curve) return null
  return (
    <div className="flex flex-col gap-3">
      <Legend items={[{ label: 'Error de T₀ frente al período real', color: 'var(--real)' }]} />
      <LineChart series={series} xLabel="Ángulo de suelta θ₀" xUnit="°" yLabel="Error del período" yUnit="%"
        yDomain={[0, 60]} xDomain={[0, 170]} height={340}
        hMarks={[{ value: 1, label: 'límite 1 %', color: 'var(--warn)' }]}
        vMarks={[
          { value: curve.threshold1pctDeg, label: `umbral ${fmt(curve.threshold1pctDeg, 1)}°`, color: 'var(--warn)' },
          { value: theta0, label: `ahora ${fmt(row ?? 0, 1)} %`, color: 'var(--ink)' },
        ]}
        dots={row !== undefined ? [{ x: theta0, y: row, color: 'var(--real)' }] : []}
        ariaLabel="Error del período contra ángulo de suelta" />
      <p className="small">
        El error supera el 1 % a partir de{' '}
        <span style={{ color: 'var(--warn)' }}>{fmt(curve.threshold1pctDeg, 1)}°</span>.
      </p>
    </div>
  )
}

const GUIDE_ANGLES = [10, 45, 90, 150] as const

/** Punto 1 de la Guía (Proyecto 5): integrar y graficar juntas θ₀ = 10°, 45°, 90° y 150°. */
export function FourAnglesChart() {
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const theta0Deg = useStore((s) => s.theta0Deg)
  const setT = useStore((s) => s.setT)
  const set = useStore((s) => s.set)
  const setView = useStore((s) => s.setView)
  const [mode, setMode] = useState<'cuadricula' | 'normalizada'>('cuadricula')

  const cases = useMemo(() => {
    const n = 360
    const times = Array.from({ length: n }, (_, i) => (i * T_MAX) / (n - 1))
    const T0 = linearPeriod(L, g)
    return GUIDE_ANGLES.map((a) => {
      const p = { theta0Deg: a, L, g }
      const lin = times.map((tt) => toDeg(linearSolution(tt, p)))
      const real = numericSolution(times, p, 2e-3).map(toDeg)
      const ex = times.map((tt) => toDeg(exactSolution(tt, p)))
      const T = exactPeriod(p)
      const err = periodErrorPercent(p)
      return { angle: a, times, lin, real, ex, T0, T, err }
    })
  }, [L, g])

  const normSeries = useMemo<Series[]>(() => {
    const colors = ['var(--ok)', 'var(--warn)', 'var(--real)', 'var(--bad)']
    const times = cases[0].times
    const pLin = { theta0Deg: 10, L, g }
    return [
      {
        id: 'lin_norm', label: 'Lineal cos(ω₀t) (igual para todo θ₀)', color: 'var(--lin)',
        x: times, y: times.map((tt) => toDeg(linearSolution(tt, pLin)) / 10), dash: '4 4', width: 2.2,
      },
      ...cases.map((c, idx) => ({
        id: `r_${c.angle}`, label: `Real ${c.angle}° (T = ${fmt(c.T, 3)} s, err ${fmt(c.err, 1)} %)`,
        color: colors[idx], x: c.times, y: c.real.map((v) => v / c.angle), width: 2.3,
      })),
    ]
  }, [cases, L, g])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Legend items={[
          { label: 'Lineal θ₀ cos(ω₀t)', color: 'var(--lin)' },
          { label: 'Real RK4', color: 'var(--real)' },
          { label: 'Exacta elíptica', color: 'var(--exact)', dash: true },
        ]} />
        <SegmentedTabs label="Vista de los 4 ángulos" value={mode} onChange={setMode}
          options={[
            { value: 'cuadricula', label: '4 paneles (10° · 45° · 90° · 150°)' },
            { value: 'normalizada', label: 'Superpuestas (θ / θ₀)' },
          ]} />
      </div>

      {mode === 'normalizada' ? (
        <div className="flex flex-col gap-3">
          <Legend items={normSeries.map((s) => ({ label: s.label, color: s.color, dash: !!s.dash }))} />
          <LineChart series={normSeries} xLabel="Tiempo t" xUnit="s" yLabel="Amplitud normalizada θ / θ₀" yUnit="adimensional"
            xDomain={[0, T_MAX]} yDomain={[-1.12, 1.12]} liveCursor={() => useStore.getState().t} onSeek={setT} height={360}
            ariaLabel="Comparación superpuesta normalizada de 10, 45, 90 y 150 grados" />
          <p className="small">
            Al dividir por θ₀, el modelo lineal colapsa en una única curva <b style={{ color: 'var(--lin)' }}>cos(ω₀t)</b> porque su período T₀ no depende de la amplitud.
            Las cuatro curvas reales se retrasan progresivamente conforme crece θ₀.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {cases.map((c) => {
            const active = theta0Deg === c.angle
            const s: Series[] = [
              { id: `l${c.angle}`, label: 'Lineal', color: 'var(--lin)', x: c.times, y: c.lin },
              { id: `r${c.angle}`, label: 'Real (RK4)', color: 'var(--real)', x: c.times, y: c.real },
              { id: `e${c.angle}`, label: 'Exacta', color: 'var(--exact)', x: c.times, y: c.ex, dash: '2 5' },
            ]
            return (
              <div key={c.angle} className="rounded-lg border p-3.5" style={{ borderColor: active ? 'var(--ink)' : 'var(--rule)', background: 'var(--bg)' }}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">θ₀ = {c.angle}°</span>
                    <span className="small ml-3">
                      T = <b style={{ color: 'var(--real)' }}>{fmt(c.T, 4)} s</b> vs T₀ = <b style={{ color: 'var(--lin)' }}>{fmt(c.T0, 4)} s</b> (error <b>{fmt(c.err, 2)} %</b>)
                    </span>
                  </div>
                  <button type="button" className="chip" aria-pressed={active}
                    title={active ? `Ir a la simulación 3D con θ₀ = ${c.angle}°` : `Cargar θ₀ = ${c.angle}° en el péndulo 3D`}
                    onClick={() => (active ? setView('simulacion') : set({ theta0Deg: c.angle }))}>
                    {active ? 'Activo · Ver en 3D' : `Simular ${c.angle}°`}
                  </button>
                </div>
                <LineChart series={s} xLabel="Tiempo t" xUnit="s" yLabel="Ángulo θ" yUnit="°"
                  xDomain={[0, T_MAX]} yDomain={[-c.angle * 1.15, c.angle * 1.15]}
                  liveCursor={() => useStore.getState().t} onSeek={setT} bandBetween={[`l${c.angle}`, `r${c.angle}`]} height={220}
                  ariaLabel={`Trayectoria para ${c.angle} grados`} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Punto 3 de la Guía (Proyecto 5): Polinomio de Taylor de sen θ y error en 10° y 90°. */
export function TaylorChart() {
  const theta0Deg = useStore((s) => s.theta0Deg)
  const { series, errAtCurr } = useMemo(() => {
    const xs = Array.from({ length: 120 }, (_, i) => (i * 165) / 119)
    const r = (d: number) => (d * Math.PI) / 180
    const sSin = xs.map((d) => Math.sin(r(d)))
    const sT1 = xs.map((d) => r(d))
    const sT3 = xs.map((d) => { const x = r(d); return x - (x ** 3) / 6 })
    const sT5 = xs.map((d) => { const x = r(d); return x - (x ** 3) / 6 + (x ** 5) / 120 })
    const thCurr = r(theta0Deg)
    const err = (100 * (thCurr - Math.sin(thCurr))) / Math.sin(thCurr)
    return {
      errAtCurr: err,
      series: [
        { id: 't1', label: 'Lineal: θ', color: 'var(--lin)', x: xs, y: sT1, width: 2.3 },
        { id: 't3', label: 'Taylor orden 3: θ − θ³/6', color: 'var(--warn)', x: xs, y: sT3, dash: '5 4', width: 2.0 },
        { id: 't5', label: 'Taylor orden 5: θ − θ³/6 + θ⁵/120', color: 'var(--ok)', x: xs, y: sT5, dash: '2 4', width: 2.0 },
        { id: 'sin', label: 'Exacto: sen θ', color: 'var(--real)', x: xs, y: sSin, width: 2.6, fill: true },
      ] as Series[],
    }
  }, [theta0Deg])

  return (
    <div className="flex flex-col gap-3">
      <Legend items={series.map((s) => ({ label: s.label, color: s.color, dash: !!s.dash }))} />
      <LineChart series={series} xLabel="Ángulo θ" xUnit="°" yLabel="Fuerza restauradora adimensional" yUnit="rad"
        xDomain={[0, 165]} yDomain={[-0.2, 2.2]} height={300}
        bandBetween={['t1', 'sin']}
        vMarks={[
          { value: 10, label: '10° (0.51 %)', color: 'var(--ok)' },
          { value: 90, label: '90° (57.1 %)', color: 'var(--real)' },
          { value: theta0Deg, label: `actual ${theta0Deg}° (${fmt(errAtCurr, 1)} %)`, color: 'var(--ink)' },
        ]}
        ariaLabel="Comparación entre sen theta y sus polinomios de Taylor" />
      <p className="small">
        El modelo lineal reemplaza <b style={{ color: 'var(--real)' }}>sen θ</b> por la recta <b style={{ color: 'var(--lin)' }}>θ</b>, sobrestimando la fuerza restauradora para ángulos grandes (sombra roja).
        Como el modelo lineal empuja con más fuerza que la gravedad real, regresa antes y su período T₀ resulta artificialmente corto.
      </p>
    </div>
  )
}
