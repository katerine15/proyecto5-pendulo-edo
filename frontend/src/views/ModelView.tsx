import { useEffect, useMemo, useRef, useState } from 'react'
import { type SpringParams, exactSolution, regime } from '../core-ts/springMass'
import { LineChart, Legend, type Series } from '../features/charts/LineChart'
import { Field } from '../features/controls/Controls'
import { Row } from '../features/results/Results'
import { SpringStage3D } from '../features/scene/SpringStage3D'
import { PlaybackControls } from '../features/scene/Stage'
import { fmt } from '../lib/format'
import {
  type ModelMetric, type ModelResult, SPRING_SPEC, cForZeta, defaultSpringParams, simulateSpring,
} from '../models/spring'
import { T_MAX, useStore } from '../state/store'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { SegmentedTabs } from '../ui/SegmentedTabs'

type Reg = 'subamortiguado' | 'crítico' | 'sobreamortiguado'
const ZETA: Record<Reg, number> = { subamortiguado: 0.3, crítico: 1, sobreamortiguado: 1.5 }

function Metric({ m }: { m: ModelMetric }) {
  const v = m.value
  return (
    <Row label={m.label}>
      {typeof v === 'number'
        ? <><AnimatedNumber value={v} decimals={Math.abs(v) < 0.001 && v !== 0 ? 6 : 3} /> {m.unit}</>
        : v === null ? 'No aplica (no oscila)' : v}
    </Row>
  )
}

function SpringHudReadout({ params }: { params: SpringParams }) {
  const valRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const paint = (t: number) => {
      if (valRef.current) {
        valRef.current.textContent = `${fmt(exactSolution(t % T_MAX, params), 3)} m`
      }
    }
    paint(useStore.getState().t)
    return useStore.subscribe((s, p) => {
      if (s.t !== p.t) paint(s.t)
    })
  }, [params])

  return (
    <div className="hud-tag" style={{ left: '50%', color: 'var(--lin)' }}>
      <span className="hud-name">Desplazamiento x(t)</span>
      <span ref={valRef} className="hud-val tabular-nums" />
    </div>
  )
}

/** Vista interactiva 3D + 2D del sistema masa-resorte amortiguado (Proyecto 1 de la Guía). */
export function ModelView() {
  const apiUp = useStore((s) => s.source.name === 'api')
  const setT = useStore((s) => s.setT)
  const [p, setP] = useState<SpringParams>(defaultSpringParams)
  const [res, setRes] = useState<ModelResult | null>(null)
  const [compareThree, setCompareThree] = useState(false)

  useEffect(() => {
    let live = true
    const ctl = new AbortController()
    const id = setTimeout(() => {
      void simulateSpring(p, SPRING_SPEC.tMax, 600, apiUp, ctl.signal).then((r) => { if (live) setRes(r) })
    }, 60)
    return () => { live = false; clearTimeout(id); ctl.abort() }
  }, [p, apiUp])

  const series = useMemo<Series[]>(() => {
    if (!res) return []
    if (compareThree) {
      const pSub = { ...p, c: cForZeta(0.3, p) }
      const pCrit = { ...p, c: cForZeta(1.0, p) }
      const pOver = { ...p, c: cForZeta(1.5, p) }
      return [
        { id: 'sub', label: 'Subamortiguado (ζ = 0.3)', color: 'var(--real)', x: res.t, y: res.t.map((tt) => exactSolution(tt, pSub)), width: 2.4 },
        { id: 'crit', label: 'Crítico (ζ = 1.0)', color: 'var(--ok)', x: res.t, y: res.t.map((tt) => exactSolution(tt, pCrit)), width: 2.5 },
        { id: 'over', label: 'Sobreamortiguado (ζ = 1.5)', color: 'var(--lin)', x: res.t, y: res.t.map((tt) => exactSolution(tt, pOver)), width: 2.4 },
      ]
    }
    return res.series.map((s) => s.kind === 'exact'
      ? { id: s.key, label: s.label, color: 'var(--lin)', x: res.t, y: s.values, width: 2.6, fill: true }
      : { id: s.key, label: s.label, color: 'var(--real)', x: res.t, y: s.values, dash: '2 5', width: 2.4 })
  }, [res, compareThree, p])

  const settling = res?.metrics.find((m) => m.key === 'settling')?.value
  const reg = regime(p) as Reg

  const loadGuideCarPreset = () => {
    // Parámetros del Proyecto 1 de la Guía: m = 300 kg (en rango UI 50 kg escalado equivalente ωn = 10 rad/s: m = 2, k = 200, x0 = 0.05)
    const next = { m: 2, k: 200, x0: 0.05, v0: 0, c: 2 * Math.sqrt(2 * 200) * 0.3 }
    setP(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="lead max-w-[34ch]">{res?.verdict ?? SPRING_SPEC.summary}</p>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs label="Modo 3D" value={compareThree ? 'tres' : 'uno'}
            onChange={(v) => setCompareThree(v === 'tres')}
            options={[{ value: 'uno', label: '1 Rig (Analítica vs RK4)' }, { value: 'tres', label: '3 Regímenes (ζ = 0.3, 1, 1.5)' }]} />
          <SegmentedTabs label="Régimen" value={reg}
            onChange={(r: Reg) => setP((q) => ({ ...q, c: cForZeta(ZETA[r], q) }))}
            options={[{ value: 'subamortiguado', label: 'Sub (0.3)' }, { value: 'crítico', label: 'Crítico (1.0)' }, { value: 'sobreamortiguado', label: 'Sobre (1.5)' }]} />
        </div>
      </div>

      <section className="hero" aria-label="Simulación 3D del sistema masa-resorte-amortiguador">
        <div className="hero-canvas" style={{ height: 390 }}>
          <SpringStage3D params={p} compareThree={compareThree} onChangeX0={(x0) => setP((q) => ({ ...q, x0 }))} />
          {compareThree ? (
            <>
              <div className="hud-tag" style={{ left: '24%', color: 'var(--real)' }}><span className="hud-name">Subamortiguado (ζ = 0.3)</span></div>
              <div className="hud-tag" style={{ left: '50%', color: 'var(--ok)' }}><span className="hud-name">Crítico (ζ = 1.0)</span></div>
              <div className="hud-tag" style={{ left: '76%', color: 'var(--lin)' }}><span className="hud-name">Sobreamortiguado (ζ = 1.5)</span></div>
            </>
          ) : (
            <SpringHudReadout params={p} />
          )}
        </div>
        <div className="hero-bar">
          <div className="flex flex-wrap items-center gap-2">
            <span className="small">Modelo 3D en vivo (resorte.glb con cilindro hidráulico aletado y resorte helicoidal).</span>
            <button type="button" className="chip" onClick={loadGuideCarPreset}>
              Cargar bache Guía (ωn = 10 rad/s, x₀ = 0.05 m)
            </button>
          </div>
          <PlaybackControls />
        </div>
      </section>

      <section className="panel" aria-label="Posición en el tiempo">
        <h2 className="h2 mb-1">{SPRING_SPEC.equation}</h2>
        <p className="small mb-4">{SPRING_SPEC.summary}</p>
        {res && (
          <div className="flex flex-col gap-3">
            <Legend items={compareThree
              ? [
                  { label: 'Subamortiguado (c = 0.3 c_cr)', color: 'var(--real)' },
                  { label: 'Crítico (c = c_cr)', color: 'var(--ok)' },
                  { label: 'Sobreamortiguado (c = 1.5 c_cr)', color: 'var(--lin)' },
                ]
              : [
                  { label: 'Solución analítica', color: 'var(--lin)' },
                  { label: 'Simulación numérica (RK4)', color: 'var(--real)', dash: true },
                ]} />
            <LineChart series={series} height={340} xLabel="Tiempo t" xUnit="s" yLabel="Posición x" yUnit="m"
              xDomain={[0, SPRING_SPEC.tMax]} liveCursor={() => useStore.getState().t % T_MAX} onSeek={setT}
              vMarks={!compareThree && typeof settling === 'number' && settling < SPRING_SPEC.tMax ? [{ value: settling, label: `asentamiento ${fmt(settling, 2)} s`, color: 'var(--warn)' }] : []}
              ariaLabel="Posición de la masa en el tiempo: solución analítica y numérica" />
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="panel" aria-label="Parámetros">
          <h2 className="h2 mb-4">Parámetros</h2>
          <form className="grid gap-5 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            {SPRING_SPEC.params.map((s) => (
              <Field key={s.key} label={s.label} unit={s.unit} value={p[s.key]} min={s.min} max={s.max} step={s.step}
                color="var(--ink-2)" onChange={(v) => setP((q) => ({ ...q, [s.key]: v }))} />
            ))}
          </form>
        </section>
        <section className="panel" aria-label="Mediciones">
          <h2 className="h2 mb-4">Mediciones</h2>
          <dl className="readout">{res?.metrics.map((m) => <Metric key={m.key} m={m} />)}</dl>
        </section>
      </div>
    </div>
  )
}
