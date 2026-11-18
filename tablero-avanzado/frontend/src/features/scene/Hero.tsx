import { useEffect, useRef, useState } from 'react'
import { fmt } from '../../lib/format'
import { type CameraPreset, useStore } from '../../state/store'
import { SegmentedTabs } from '../../ui/SegmentedTabs'
import { Phase, PlaybackControls, StageSvg } from './Stage'
import { Stage3D } from './Stage3D'

/** Estado de la cuerda o de la varilla: tensión T en unidades del peso mg. */
function tensionText(T: number | undefined, ropeMode: boolean, slack: boolean): { text: string; warn: boolean } | null {
  if (T === undefined) return null
  if (ropeMode) return slack ? { text: 'cuerda floja: caída libre', warn: true } : { text: `cuerda tensa · T = ${fmt(T, 2)} mg`, warn: false }
  return T < -0.005 ? { text: `la varilla empuja (T = ${fmt(T, 2)} mg)`, warn: true } : { text: `T = ${fmt(T, 2)} mg`, warn: false }
}

/** Θ y reparto K/U en vivo bajo cada péndulo. Actualiza el DOM vía suscripción sin re-renderizar React a 60 fps. */
function Readouts({ pivots }: { pivots: { lin: number; real: number } }) {
  const sim = useStore((s) => s.sim)
  const ropeMode = useStore((s) => s.ropeMode)
  const theta0Deg = useStore((s) => s.theta0Deg)
  const linValRef = useRef<HTMLSpanElement>(null)
  const realValRef = useRef<HTMLSpanElement>(null)
  const subRef = useRef<HTMLSpanElement>(null)
  const kBarRef = useRef<HTMLSpanElement>(null)
  const uBarRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!sim) return
    const den = Math.max(1e-9, 1 - Math.cos((theta0Deg * Math.PI) / 180))
    const paint = (t: number, rope: boolean) => {
      const i = Math.min(sim.t.length - 1, Math.round((t / sim.t[sim.t.length - 1]) * (sim.t.length - 1)))
      const thLin = sim.thetaLinearDeg[i]
      const thReal = sim.thetaRealDeg[i]
      if (linValRef.current) linValRef.current.textContent = `${fmt(thLin, 1)}°`
      if (realValRef.current) realValRef.current.textContent = `${fmt(thReal, 1)}°`
      if (subRef.current) {
        const sub = tensionText(sim.tensionReal?.[i], rope, rope && (sim.ropeR?.[i] ?? 1) < 0.999)
        subRef.current.textContent = sub ? sub.text : ''
        subRef.current.style.color = sub?.warn ? 'var(--warn)' : ''
        subRef.current.style.display = sub ? '' : 'none'
      }
      const uFrac = Math.max(0, Math.min(1, (1 - Math.cos((thReal * Math.PI) / 180)) / den))
      const kFrac = 1 - uFrac
      if (kBarRef.current) kBarRef.current.style.width = `${(kFrac * 100).toFixed(1)}%`
      if (uBarRef.current) uBarRef.current.style.width = `${(uFrac * 100).toFixed(1)}%`
    }
    const st0 = useStore.getState()
    paint(st0.t, st0.ropeMode)
    return useStore.subscribe((s, p) => {
      if (s.t !== p.t || s.ropeMode !== p.ropeMode || s.sim !== p.sim) {
        paint(s.t, s.ropeMode)
      }
    })
  }, [sim, theta0Deg])

  if (!sim) return null
  return (
    <>
      <div className="hud-tag" style={{ left: `${pivots.lin}%`, color: 'var(--lin)' }}>
        <span className="hud-name">Modelo lineal</span>
        <span ref={linValRef} className="hud-val tabular-nums" />
      </div>
      <div className="hud-tag" style={{ left: `${pivots.real}%`, color: 'var(--real)' }}>
        <span className="hud-name">Péndulo real</span>
        <span ref={realValRef} className="hud-val tabular-nums" />
        <span ref={subRef} className="hud-sub" />
        {!ropeMode && (
          <div className="mt-1 flex items-center gap-1.5" title="Energía cinética K frente a energía potencial U">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)]">K/U</span>
            <div className="flex h-1 w-16 overflow-hidden rounded-full bg-[var(--rule)]">
              <span ref={kBarRef} className="block h-full" style={{ background: 'var(--real)', width: '0%' }} />
              <span ref={uBarRef} className="block h-full" style={{ background: 'var(--lin)', opacity: 0.45, width: '100%' }} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export function Hero() {
  const [fallback, setFallback] = useState(false)
  const [pivots, setPivots] = useState({ lin: 34, real: 66 })
  const cameraPreset = useStore((s) => s.cameraPreset)
  const setCameraPreset = useStore((s) => s.setCameraPreset)

  return (
    <section className="hero" aria-label="Simulación 3D interactiva de los dos péndulos">
      <div className="hero-canvas">
        {fallback ? <StageSvg /> : <Stage3D onFail={() => setFallback(true)} onPivots={setPivots} />}
        {!fallback && <Readouts pivots={pivots} />}
        {!fallback && (
          <div className="pointer-events-none absolute bottom-2.5 right-3 hidden rounded-md border px-2.5 py-1 text-[11px] sm:block"
            style={{ background: 'color-mix(in srgb, var(--paper) 88%, transparent)', borderColor: 'var(--rule)', color: 'var(--muted)' }}>
            Arrastra una lenteja para cambiar θ₀ · Orbita y haz zoom con el ratón
          </div>
        )}
        {fallback && <p className="small absolute left-3 top-3">Modo sin 3D: tu navegador no tiene WebGL.</p>}
      </div>
      <div className="hero-bar">
        <Phase />
        <div className="flex flex-wrap items-center gap-2">
          {!fallback && (
            <SegmentedTabs label="Cámara 3D" value={cameraPreset} onChange={(v: CameraPreset) => setCameraPreset(v)}
              options={[
                { value: 'perspectiva', label: '3D' },
                { value: 'frontal', label: 'Frontal' },
                { value: 'reloj', label: 'Relojes' },
                { value: 'superior', label: 'Superior' },
              ]} />
          )}
          <PlaybackControls />
        </div>
      </div>
    </section>
  )
}
