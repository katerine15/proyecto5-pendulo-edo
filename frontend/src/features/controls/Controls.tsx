import { motion } from 'motion/react'
import { useStore } from '../../state/store'
import { SegmentedTabs } from '../../ui/SegmentedTabs'
import { Switch } from '../../ui/Switch'

const PRESETS = [10, 23, 45, 90, 150]

export function Field({ label, unit, value, min, max, step, onChange, color }: {
  label: string; unit: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; color: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between">
        <span className="small">{label}</span>
        <span className="font-semibold">{value.toFixed(step < 1 ? 2 : 0)} <span className="label font-normal">{unit}</span></span>
      </span>
      <input className="slider" type="range" min={min} max={max} step={step} value={value}
        style={{ ['--pct' as string]: `${pct}%`, ['--fill' as string]: color }}
        onChange={(e) => onChange(+e.target.value)} aria-label={`${label}, en ${unit}`} />
    </label>
  )
}

export function Controls() {
  const theta0Deg = useStore((s) => s.theta0Deg)
  const side = useStore((s) => s.side)
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const set = useStore((s) => s.set)
  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()} aria-label="Parámetros del péndulo">
      <div className="flex flex-col gap-3">
        <Field label="Ángulo de suelta θ₀" unit="°" value={theta0Deg} min={1} max={170} step={1}
          color="var(--ink)" onChange={(v) => set({ theta0Deg: v })} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ángulos predefinidos">
          {PRESETS.map((a) => (
            <motion.button key={a} type="button" className="chip" aria-pressed={theta0Deg === a}
              whileTap={{ scale: 0.95 }} onClick={() => set({ theta0Deg: a })}>{a}°</motion.button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="small">Lado de suelta</span>
          <SegmentedTabs label="Lado de suelta" value={side === 1 ? 'der' : 'izq'} onChange={(v) => set({ side: v === 'der' ? 1 : -1 })}
            options={[{ value: 'izq', label: 'Izquierda' }, { value: 'der', label: 'Derecha' }]} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Field label="Longitud L" unit="m" value={L} min={0.2} max={5} step={0.05} color="var(--ink-2)" onChange={(v) => set({ L: v })} />
        <Field label="Gravedad g" unit="m/s²" value={g} min={1.6} max={25} step={0.01} color="var(--ink-2)" onChange={(v) => set({ g: v })} />
      </div>
    </form>
  )
}

export function ViewOptions() {
  const showTrail = useStore((s) => s.showTrail)
  const showDial = useStore((s) => s.showDial)
  const showExact = useStore((s) => s.showExact)
  const showVectors = useStore((s) => s.showVectors)
  const ropeMode = useStore((s) => s.ropeMode)
  const setFlag = useStore((s) => s.setFlag)
  return (
    <div className="flex flex-col" role="group" aria-label="Opciones de visualización">
      <Switch label="Física de cuerda" hint="Tensa es un sólido; si θ₀ > 90° se afloja y la masa cae libre. Apagada: varilla rígida (modelo de la guía)" checked={ropeMode} onChange={(v) => setFlag('ropeMode', v)} />
      <Switch label="Estela del péndulo" hint="Muestra el recorrido reciente" checked={showTrail} onChange={(v) => setFlag('showTrail', v)} />
      <Switch label="Vectores 3D de fuerza y velocidad" hint="Compara −sen θ contra −θ en vivo" checked={showVectors} onChange={(v) => setFlag('showVectors', v)} />
      <Switch label="Transportador de grados" hint="Escala con relieve cada 2° y 10°" checked={showDial} onChange={(v) => setFlag('showDial', v)} />
      <Switch label="Solución exacta (elíptica)" hint="Anillo 3D y curva de verificación" checked={showExact} onChange={(v) => setFlag('showExact', v)} />
    </div>
  )
}
