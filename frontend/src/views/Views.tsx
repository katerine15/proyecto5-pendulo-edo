import { useState } from 'react'
import { AdaVerification } from '../features/ada/AdaVerification'
import { ErrorChart, FourAnglesChart, TaylorChart, TrajectoryChart } from '../features/charts/Charts'
import { PeriodSeriesChart } from '../features/charts/ScienceCharts'
import { Controls, ViewOptions } from '../features/controls/Controls'
import { Predictor } from '../features/predictor/Predictor'
import { Headline, Measurements, PeriodTable, Row } from '../features/results/Results'
import { Hero } from '../features/scene/Hero'
import { fmt } from '../lib/format'
import { useStore } from '../state/store'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { SegmentedTabs } from '../ui/SegmentedTabs'

function Panel({ title, note, children, className = '' }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <header className="mb-4">
        <h2 className="h2">{title}</h2>
        {note && <p className="small mt-1 max-w-[60ch]">{note}</p>}
      </header>
      {children}
    </section>
  )
}

export function SimulacionView() {
  return (
    <div className="flex flex-col gap-6">
      <Headline />
      <Hero />
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Parámetros" note="Mueve el ángulo (o arrastra la lenteja en 3D) y los péndulos se reinician con los nuevos datos.">
          <Controls />
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="Mediciones"><Measurements /></Panel>
          <AdaVerification />
          <Panel title="Vista"><ViewOptions /></Panel>
        </div>
      </div>
    </div>
  )
}

type Charts = 'ambas' | 'cuatro' | 'trayectoria' | 'error' | 'periodo'

export function VerificacionView() {
  const [which, setWhich] = useState<Charts>('ambas')
  const sim = useStore((s) => s.sim)
  const show = (c: 'trayectoria' | 'error') => which === 'ambas' || which === c
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="lead max-w-[34ch]">La simulación coincide con la solución exacta; el modelo lineal no.</p>
        <SegmentedTabs label="Gráficas" value={which} onChange={setWhich}
          options={[
            { value: 'ambas', label: 'Ambas' },
            { value: 'cuatro', label: '10° · 45° · 90° · 150°' },
            { value: 'trayectoria', label: 'Trayectoria' },
            { value: 'error', label: 'Error' },
            { value: 'periodo', label: 'Serie del período' },
          ]} />
      </div>
      <div className={`grid gap-6 ${which === 'ambas' ? 'lg:grid-cols-2' : ''}`}>
        {show('trayectoria') && <Panel title="El modelo lineal se separa del real"><TrajectoryChart /></Panel>}
        {show('error') && <Panel title="El error crece con el ángulo"><ErrorChart /></Panel>}
        {which === 'cuatro' && (
          <Panel title="Los cuatro ángulos de referencia de la guía (10°, 45°, 90° y 150°)"
            note="Punto 1 de «Lo que programan»: integración numérica del péndulo real frente al modelo lineal y solución exacta.">
            <FourAnglesChart />
          </Panel>
        )}
        {which === 'periodo' && <Panel title="El período real frente a su desarrollo en serie"><PeriodSeriesChart /></Panel>}
      </div>
      {sim && (
        <Panel title="Comprobaciones" note="Lo que el programa verifica con el ángulo actual.">
          <dl className="readout">
            <Row label="Simulación numérica contra solución exacta (elíptica)" color="var(--ok)">
              <AnimatedNumber value={sim.numericVsExactDeg * 1e9} decimals={2} /> × 10⁻⁹ °
            </Row>
            <Row label="Período medido (v = 0) contra período exacto">
              <AnimatedNumber value={Math.abs(sim.TMeasured - sim.TReal) * 1e6} decimals={2} /> × 10⁻⁶ s
            </Row>
            <Row label="Desfase máximo entre el lineal y el real" color="var(--real)">
              <AnimatedNumber value={sim.maxGapDeg} decimals={0} />°
            </Row>
          </dl>
        </Panel>
      )}
    </div>
  )
}

export function DatosView() {
  const [tab, setTab] = useState<'tabla' | 'red'>('tabla')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="lead max-w-[34ch]">Cuatro ángulos de referencia y lo que predice la red neuronal.</p>
        <SegmentedTabs label="Datos" value={tab} onChange={setTab}
          options={[{ value: 'tabla', label: 'Tabla' }, { value: 'red', label: 'Red neuronal' }]} />
      </div>
      <div className="max-w-[760px]">
        {tab === 'tabla'
          ? <Panel title="Período según el ángulo"><PeriodTable /></Panel>
          : <Panel title="Predicción con red neuronal"><Predictor /></Panel>}
      </div>
    </div>
  )
}

const rad = (d: number) => (d * Math.PI) / 180

export function FundamentoView() {
  return (
    <div className="flex max-w-[820px] flex-col gap-6">
      <p className="lead">Qué se resuelve y por qué la aproximación lineal tiene un límite.</p>

      <Panel title="El modelo y paso a sistema de primer orden" note="Péndulo de longitud L en un campo de gravedad g, sin rozamiento.">
        <pre className="math">{`Real:     θ'' + (g/L) sen θ = 0     (no lineal)
Lineal:   θ'' + (g/L) θ     = 0     (aproximación sen θ ≈ θ)
Con θ(0) = θ₀,  θ'(0) = 0

Conversión a sistema de primer orden para RK4 (con u = θ, v = θ'):
  u' = v
  v' = −(g/L) sen u`}</pre>
      </Panel>

      <Panel title="Solución del modelo lineal">
        <pre className="math">{`Ecuación característica:   r² + g/L = 0   →   r = ± i ω₀,   ω₀ = √(g/L)
Solución general:         θ(t) = A cos(ω₀ t) + B sen(ω₀ t)
Condiciones iniciales:    A = θ₀,  B = 0      →   θ(t) = θ₀ cos(ω₀ t)
Período:                  T₀ = 2π √(L/g)      →   no depende de la amplitud`}</pre>
      </Panel>

      <Panel title="Por qué falla: desarrollo de Taylor de sen θ" note="El polinomio de Taylor explica el error y por qué el modelo lineal oscila más rápido.">
        <pre className="math">{`sen θ = θ − θ³/6 + θ⁵/120 − …       error relativo de usar θ:  (θ − sen θ) / sen θ ≈ θ²/6`}</pre>
        <div className="mt-4">
          <TaylorChart />
        </div>
        <dl className="readout mt-4">
          {[10, 45, 90, 150].map((a) => (
            <Row key={a} label={`Error relativo de sen θ ≈ θ a ${a}°`}>
              {fmt((100 * (rad(a) - Math.sin(rad(a)))) / Math.sin(rad(a)), 2)} %
            </Row>
          ))}
        </dl>
      </Panel>

      <Panel title="El período real" note="La solución exacta usa la integral elíptica completa de primera especie K.">
        <pre className="math">{`T = 4 √(L/g) · K( sen²(θ₀/2) )            T/T₀ ≈ 1 + θ₀²/16 + 11 θ₀⁴/3072 + …`}</pre>
      </Panel>

      <p className="small">
        Esta vista resume el fundamento. La deducción paso a paso, escrita a mano, se entrega por separado: el programa verifica la solución analítica, no la reemplaza.
      </p>
    </div>
  )
}
