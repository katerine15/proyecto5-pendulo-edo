import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { fmt } from '../../lib/format'
import { SegmentedTabs } from '../../ui/SegmentedTabs'
import { sample } from '../../lib/sample'
import { T_MAX, useStore } from '../../state/store'

/* Lienzo 1100×640. Cada péndulo cuelga de su pivote; el ángulo se mide desde la vertical. */
const W = 1100, H = 640, PIVOT_Y = 300, ROD = 290, ARC = ROD + 22, BOB = 19, TRAIL = 36
const PIVOTS = { lin: 330, real: 770 } as const

const rad = (d: number) => (d * Math.PI) / 180
const polar = (cx: number, deg: number, r: number) => ({ x: cx + Math.sin(rad(deg)) * r, y: PIVOT_Y + Math.cos(rad(deg)) * r })

/** Transportador: marcas cada 10°, más largas cada 30°, con rótulo. */
function Protractor({ cx }: { cx: number }) {
  const ticks = useMemo(() => {
    const out: { a: number; major: boolean }[] = []
    for (let a = -170; a <= 170; a += 10) out.push({ a, major: a % 30 === 0 })
    return out
  }, [])
  return (
    <g stroke="var(--grid-strong)" fill="var(--muted)" fontSize="12" textAnchor="middle">
      <path d={`M ${polar(cx, -170, ARC).x} ${polar(cx, -170, ARC).y} A ${ARC} ${ARC} 0 1 0 ${polar(cx, 170, ARC).x} ${polar(cx, 170, ARC).y}`}
        fill="none" strokeWidth="1" />
      {ticks.map(({ a, major }) => {
        const p1 = polar(cx, a, ARC), p2 = polar(cx, a, ARC - (major ? 14 : 7)), lab = polar(cx, a, ARC + 16)
        return (
          <g key={a}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} strokeWidth={major ? 1.4 : 1} />
            {major && <text x={lab.x} y={lab.y + 4} stroke="none">{Math.abs(a)}°</text>}
          </g>
        )
      })}
    </g>
  )
}

/** Un péndulo. Se mueve escribiendo atributos directamente (sin re-renderizar React a 60 fps). */
function Pendulum({ kind, label }: { kind: 'lin' | 'real'; label: string }) {
  const cx = PIVOTS[kind]
  const series = kind === 'lin' ? 'thetaLinearDeg' : 'thetaRealDeg'
  const rod = useRef<SVGLineElement>(null)
  const bob = useRef<SVGCircleElement>(null)
  const exactShadow = useRef<SVGLineElement>(null)
  const trail = useRef<SVGPolylineElement>(null)
  const read = useRef<SVGTextElement>(null)
  const pts = useRef<string[]>([])
  const theta0 = useStore((s) => s.theta0Deg)
  const side = useStore((s) => s.side)
  const showDial = useStore((s) => s.showDial)
  const showTrail = useStore((s) => s.showTrail)
  const showExact = useStore((s) => s.showExact)
  const ropeMode = useStore((s) => s.ropeMode)
  const release = polar(cx, theta0 * side, ARC)
  const color = `var(--${kind})`

  useEffect(() => {
    pts.current = []
    if (trail.current) trail.current.setAttribute('points', '')
  }, [theta0, side, ropeMode])

  useEffect(() => {
    let raf = 0
    let lastT = -1
    const tick = () => {
      const { sim, t, showTrail: trailOn, showExact: exactOn, ropeMode: ropeOn } = useStore.getState()
      if (sim && rod.current && bob.current && trail.current && read.current) {
        if (t < lastT - 0.1 || (t === 0 && lastT > 0.05)) pts.current = []
        lastT = t
        const th = sample(sim[series], t, T_MAX)
        const rFrac = kind === 'real' && ropeOn && sim.ropeR ? Math.max(0.05, sample(sim.ropeR, t, T_MAX)) : 1
        const p = polar(cx, th, ROD * rFrac)
        rod.current.setAttribute('x2', p.x.toFixed(1))
        rod.current.setAttribute('y2', p.y.toFixed(1))
        if (kind === 'real' && ropeOn) {
          rod.current.setAttribute('stroke-dasharray', rFrac < 0.999 ? '4 4' : '')
          rod.current.setAttribute('stroke-width', rFrac < 0.999 ? '1.5' : '2')
        } else {
          rod.current.setAttribute('stroke-dasharray', '')
          rod.current.setAttribute('stroke-width', '2')
        }
        bob.current.setAttribute('cx', p.x.toFixed(1))
        bob.current.setAttribute('cy', p.y.toFixed(1))
        if (trailOn) {
          pts.current.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          if (pts.current.length > TRAIL) pts.current.shift()
          trail.current.setAttribute('points', pts.current.join(' '))
        }
        if (exactShadow.current && kind === 'real') {
          if (exactOn) {
            const thEx = sample(sim.thetaExactDeg, t, T_MAX)
            const pEx = polar(cx, thEx, ROD)
            exactShadow.current.setAttribute('x2', pEx.x.toFixed(1))
            exactShadow.current.setAttribute('y2', pEx.y.toFixed(1))
            exactShadow.current.style.display = ''
          } else {
            exactShadow.current.style.display = 'none'
          }
        }
        read.current.textContent = `θ = ${fmt(th, 1)}°`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cx, kind, series])

  return (
    <g>
      {showDial && <Protractor cx={cx} />}
      {/* ángulo de suelta */}
      <line x1={cx} y1={PIVOT_Y} x2={release.x} y2={release.y} stroke={color} strokeWidth="1" strokeDasharray="3 5" opacity="0.55" />
      <circle cx={release.x} cy={release.y} r="5" fill="var(--paper)" stroke={color} strokeWidth="1.5" />
      {showTrail && (
        <polyline ref={trail} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      )}
      {kind === 'real' && showExact && (
        <line ref={exactShadow} x1={cx} y1={PIVOT_Y} x2={cx} y2={PIVOT_Y + ROD} stroke="var(--ok)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
      )}
      <line ref={rod} x1={cx} y1={PIVOT_Y} x2={cx} y2={PIVOT_Y + ROD} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      <circle ref={bob} cx={cx} cy={PIVOT_Y + ROD} r={BOB} fill={color} stroke="var(--ink)" strokeWidth="2" />
      <circle cx={cx} cy={PIVOT_Y} r="5" fill="var(--ink)" />
      <text x={cx} y={H - 38} textAnchor="middle" fill={color} fontSize="18" fontWeight="650">{label}</text>
      <text ref={read} x={cx} y={H - 14} textAnchor="middle" fill="var(--ink-2)" fontSize="15" />
    </g>
  )
}

/** Ciclos completados por cada péndulo: el desfase se lee como diferencia sin re-renderizar React a 60 fps. */
function Phase() {
  const sim = useStore((s) => s.sim)
  const timeRef = useRef<HTMLSpanElement>(null)
  const linRef = useRef<HTMLElement>(null)
  const realRef = useRef<HTMLElement>(null)
  const diffRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sim) return
    const paint = (t: number) => {
      const lin = t / sim.T0, real = t / sim.TReal
      if (timeRef.current) timeRef.current.textContent = fmt(t, 1)
      if (linRef.current) linRef.current.textContent = fmt(lin, 2)
      if (realRef.current) realRef.current.textContent = fmt(real, 2)
      if (diffRef.current) diffRef.current.textContent = fmt(lin - real, 2)
    }
    paint(useStore.getState().t)
    return useStore.subscribe((s, p) => {
      if (s.t !== p.t || s.sim !== p.sim) paint(s.t)
    })
  }, [sim])

  if (!sim) return null
  return (
    <p className="small tabular-nums" aria-live="off">
      Tiempo <span ref={timeRef} /> s. Ciclos completados:{' '}
      <b ref={linRef} style={{ color: 'var(--lin)' }} /> el lineal y <b ref={realRef} style={{ color: 'var(--real)' }} /> el real.
      Diferencia: <b ref={diffRef} />.
    </p>
  )
}

/** Escena SVG: respaldo cuando el navegador no tiene WebGL. */
export function StageSvg() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-full w-full"
      aria-label="Dos péndulos soltados desde el mismo ángulo: el modelo lineal a la izquierda y el péndulo real a la derecha"
      style={{ background: 'var(--paper)' }}>
      <defs>
        <pattern id="mm" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="var(--grid)" strokeWidth="0.6" />
        </pattern>
        <pattern id="cm" width="50" height="50" patternUnits="userSpaceOnUse">
          <rect width="50" height="50" fill="url(#mm)" />
          <path d="M50 0H0V50" fill="none" stroke="var(--grid-strong)" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#cm)" />
      <line x1="60" y1={PIVOT_Y - 12} x2={W - 60} y2={PIVOT_Y - 12} stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
      <Pendulum kind="lin" label="Modelo lineal" />
      <Pendulum kind="real" label="Péndulo real" />
    </svg>
  )
}

export function PlaybackControls() {
  const playing = useStore((s) => s.playing)
  const setPlaying = useStore((s) => s.setPlaying)
  const reset = useStore((s) => s.reset)
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Reproducción">
      <SegmentedTabs label="Velocidad" value={String(speed)} onChange={(v) => setSpeed(Number(v))}
        options={[{ value: '0.25', label: '0.25×' }, { value: '0.5', label: '0.5×' }, { value: '1', label: '1×' }]} />
      <button className="btn-icon" onClick={() => reset()} aria-label="Reiniciar"><RotateCcw size={16} /></button>
      <button className="btn-icon" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pausar' : 'Reproducir'}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
    </div>
  )
}

export { Phase }
