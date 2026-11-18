import { Copy, Download, Printer } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { designFor } from '../core-ts/analysis'
import { ConvergenceChart, DriftChart, EnergyChart, PhasePortrait } from '../features/charts/ScienceCharts'
import { Row } from '../features/results/Results'
import { LabStage3D } from '../features/scene/LabStage3D'
import { PlaybackControls } from '../features/scene/Stage'
import { downloadCsv, copyText } from '../lib/export'
import { drift, fmt, verdict } from '../lib/format'
import { useStore } from '../state/store'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { SegmentedTabs } from '../ui/SegmentedTabs'

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <h2 className="h2 mb-4">{title}</h2>
      {children}
    </section>
  )
}

type Lab = 'fases' | 'paisaje3d' | 'euler3d' | 'energia' | 'orden'

export function LaboratorioView() {
  const [tab, setTab] = useState<Lab>('fases')
  const titles: Record<Lab, string> = {
    fases: 'Espacio de fases (θ, ω)',
    paisaje3d: 'Paisaje 3D interactivo de energía E(θ, ω)',
    euler3d: 'Duelo 3D de integradores: Euler explícito frente a Euler simpléctico',
    energia: 'Conservación de la energía',
    orden: 'Orden de los métodos numéricos',
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="lead max-w-[34ch]">Lo que hay detrás de la simulación: fases, paisaje 3D, energía y precisión.</p>
        <SegmentedTabs label="Laboratorio" value={tab} onChange={setTab}
          options={[
            { value: 'fases', label: 'Fases 2D' },
            { value: 'paisaje3d', label: 'Paisaje 3D' },
            { value: 'euler3d', label: 'Euler 3D' },
            { value: 'energia', label: 'Energía' },
            { value: 'orden', label: 'Orden' },
          ]} />
      </div>
      <Panel title={titles[tab]}>
        {tab === 'fases' && <PhasePortrait />}
        {tab === 'paisaje3d' && (
          <div className="flex flex-col gap-3">
            <div className="hero">
              <div className="hero-canvas" style={{ height: 420 }}>
                <LabStage3D mode="paisaje" />
              </div>
              <div className="hero-bar">
                <p className="small">
                  Superficie real <b style={{ color: 'var(--real)' }}>E(θ, ω) = ½ω² + (g/L)(1 − cos θ)</b> frente a la malla cuadrática lineal <b style={{ color: 'var(--lin)' }}>½ω² + ½(g/L)θ²</b>.
                </p>
                <PlaybackControls />
              </div>
            </div>
          </div>
        )}
        {tab === 'euler3d' && (
          <div className="flex flex-col gap-3">
            <div className="hero">
              <div className="hero-canvas" style={{ height: 420 }}>
                <LabStage3D mode="euler" />
                <div className="hud-tag" style={{ left: '34%', color: 'var(--bad)' }}>
                  <span className="hud-name">Euler explícito (se acelera solo)</span>
                </div>
                <div className="hud-tag" style={{ left: '66%', color: 'var(--lin)' }}>
                  <span className="hud-name">Euler simpléctico (conserva estructura)</span>
                </div>
              </div>
              <div className="hero-bar">
                <p className="small">
                  Demostración en vivo: Euler explícito inyecta energía en cada paso hasta dar vueltas completas; el simpléctico mantiene la oscilación acotada.
                </p>
                <PlaybackControls />
              </div>
            </div>
          </div>
        )}
        {tab === 'energia' && <EnergyChart />}
        {tab === 'orden' && <ConvergenceChart />}
      </Panel>
    </div>
  )
}

const TOLERANCES = [0.5, 1, 2, 5, 10]

export function DisenoView() {
  const theta0Deg = useStore((s) => s.theta0Deg)
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const sim = useStore((s) => s.sim)
  const [tol, setTol] = useState(1)
  const [copied, setCopied] = useState<'si' | 'no' | null>(null)
  const d = useMemo(() => designFor(tol, L, g), [tol, L, g])
  const table = useMemo(() => TOLERANCES.map((x) => ({ x, ...designFor(x, L, g) })), [L, g])
  const now = sim ? verdict(sim.periodErrorPct) : null

  const conclusion =
    `Para que el modelo lineal no yerre más de ${fmt(tol, 1)} % en el período de un péndulo de L = ${fmt(L, 2)} m (g = ${fmt(g, 2)} m/s²), ` +
    `conviene soltarlo con amplitudes de hasta ${fmt(d.angleDeg, 1)}°. En ese límite el período real es ${fmt(d.T, 4)} s frente a ${fmt(d.T0, 4)} s del modelo lineal, ` +
    `y un reloj calibrado a ángulo pequeño atrasaría ${drift(d.driftSPerDay)}. ` +
    (sim ? `Con la amplitud actual (${theta0Deg}°) el error es ${fmt(sim.periodErrorPct, 2)} %: ${now?.label.toLowerCase()}.` : '')

  const onCopy = async () => {
    setCopied((await copyText(conclusion)) ? 'si' : 'no')
    setTimeout(() => setCopied(null), 2200)
  }
  const onCsv = () => {
    if (!sim) return
    downloadCsv(`pendulo_theta0-${theta0Deg}_L-${L}_g-${g}.csv`,
      ['t_s', 'theta_lineal_deg', 'theta_real_deg', 'theta_exacta_deg'],
      sim.t.map((t, i) => [t.toFixed(5), sim.thetaLinearDeg[i].toFixed(6), sim.thetaRealDeg[i].toFixed(6), sim.thetaExactDeg[i].toFixed(6)]))
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="lead max-w-[34ch]">¿Qué amplitud elegir? La respuesta depende de cuánto error acepta.</p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel title="Conclusión de ingeniería">
          <label className="mb-5 flex flex-col gap-1">
            <span className="flex items-baseline justify-between">
              <span className="small">Error del período que acepta</span>
              <span className="font-semibold">{fmt(tol, 1)} <span className="label font-normal">%</span></span>
            </span>
            <input className="slider" type="range" min={0.2} max={15} step={0.1} value={tol}
              style={{ ['--pct' as string]: `${((tol - 0.2) / 14.8) * 100}%`, ['--fill' as string]: 'var(--ink)' }}
              onChange={(e) => setTol(+e.target.value)} aria-label="Error del período aceptado, en por ciento" />
          </label>
          <p className="lead" aria-live="polite">
            Suéltelo con <AnimatedNumber value={d.angleDeg} decimals={1} />° o menos.
          </p>
          <dl className="readout mt-4">
            <Row label="Período real a ese ángulo" color="var(--real)"><AnimatedNumber value={d.T} decimals={4} /> s</Row>
            <Row label="Período del modelo lineal" color="var(--lin)"><AnimatedNumber value={d.T0} decimals={4} /> s</Row>
            <Row label="Un reloj calibrado a ángulo pequeño atrasa">{drift(d.driftSPerDay)}</Row>
          </dl>
          <p className="small mt-4">{conclusion}</p>
          <div className="no-print mt-5 flex flex-wrap gap-2">
            <motion.button className="chip" whileTap={{ scale: 0.96 }} onClick={onCopy}>
              <Copy size={15} aria-hidden /> <span className="ml-2">{copied === 'si' ? 'Copiado' : copied === 'no' ? 'No se pudo copiar' : 'Copiar conclusión'}</span>
            </motion.button>
            <motion.button className="chip" whileTap={{ scale: 0.96 }} onClick={onCsv}>
              <Download size={15} aria-hidden /> <span className="ml-2">Descargar datos (CSV)</span>
            </motion.button>
            <motion.button className="chip" whileTap={{ scale: 0.96 }} onClick={() => window.print()}>
              <Printer size={15} aria-hidden /> <span className="ml-2">Imprimir</span>
            </motion.button>
          </div>
        </Panel>

        <Panel title="Ángulo máximo según la tolerancia">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--muted)' }}>
                <th className="pb-2 pr-4 font-medium">Error aceptado</th><th className="pb-2 pr-4 font-medium">θ₀ máx. (°)</th>
                <th className="pb-2 text-right font-medium">Reloj atrasa</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.x} className="rule-t">
                  <td className="py-2.5 pr-4">{r.x} %</td>
                  <td className="pr-4 font-semibold">{fmt(r.angleDeg, 1)}</td>
                  <td className="text-right">{drift(r.driftSPerDay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Cuánto atrasa un reloj de péndulo según su amplitud">
        <DriftChart markAngle={d.angleDeg} />
        <p className="small mt-3 max-w-[70ch]">
          Más amplitud significa período mayor, así que el reloj atrasa. La marca indica el ángulo máximo para la tolerancia elegida.
        </p>
      </Panel>
    </div>
  )
}
