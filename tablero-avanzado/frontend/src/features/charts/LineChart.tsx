import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useStore } from '../../state/store'

export interface Series {
  id: string
  label: string
  color: string // var(--token)
  x: number[]
  y: number[]
  dash?: string
  width?: number
  markers?: boolean
  fill?: boolean
}
interface Mark { value: number; label: string; color: string }
export interface LiveDot { x: number; y: number; color: string }

interface Props {
  series: Series[]
  xLabel: string
  yLabel: string
  xUnit: string
  yUnit: string
  xDomain?: [number, number]
  yDomain?: [number, number]
  vMarks?: Mark[]
  hMarks?: Mark[]
  cursorX?: number | null
  liveCursor?: () => number | null
  onSeek?: (x: number) => void
  bandBetween?: [string, string]
  dots?: LiveDot[]
  liveDots?: () => LiveDot[]
  hover?: boolean
  height?: number
  ariaLabel: string
}

const M = { top: 14, right: 18, bottom: 44, left: 56 }

function niceTicks(lo: number, hi: number, target = 5): number[] {
  const span = hi - lo || 1
  const raw = span / target
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10))
  return out
}

const tickText = (v: number) => (Math.abs(v) >= 100 || Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)).replace('-', '−')

/** Evalúa linealmente y(x) sobre una serie ordenada en x. */
function interpAt(xs: number[], ys: number[], x: number): number {
  const n = xs.length
  if (n === 0) return 0
  if (x <= xs[0]) return ys[0]
  if (x >= xs[n - 1]) return ys[n - 1]
  let lo = 0, hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= x) lo = mid; else hi = mid
  }
  const span = xs[hi] - xs[lo] || 1
  const u = (x - xs[lo]) / span
  return ys[lo] + (ys[hi] - ys[lo]) * u
}

function sameData(prevY: Record<string, number[]>, prevDom: [number, number], series: Series[], nextDom: [number, number]): boolean {
  if (Math.abs(prevDom[0] - nextDom[0]) > 1e-12 || Math.abs(prevDom[1] - nextDom[1]) > 1e-12) return false
  if (Object.keys(prevY).length !== series.length) return false
  for (const s of series) {
    const a = prevY[s.id]
    if (!a || a.length !== s.y.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== s.y[i]) return false
    }
  }
  return true
}

export function LineChart({
  series, xLabel, yLabel, xUnit, yUnit, xDomain, yDomain, vMarks = [], hMarks = [],
  cursorX = null, liveCursor, onSeek, bandBetween, dots = [], liveDots, hover: hoverOn = true, height = 280, ariaLabel,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  const [hover, setHover] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const draggingSeek = useRef(false)
  const cursorGroupRef = useRef<SVGGElement>(null)
  const cursorLineRef = useRef<SVGLineElement>(null)
  const cursorHaloRefs = useRef<(SVGCircleElement | null)[]>([])
  const cursorDotRefs = useRef<(SVGCircleElement | null)[]>([])
  const liveDotHaloRefs = useRef<(SVGCircleElement | null)[]>([])
  const liveDotCoreRefs = useRef<(SVGCircleElement | null)[]>([])

  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const targetDom = useMemo(() => {
    const xs = series.flatMap((s) => s.x), ys = series.flatMap((s) => s.y)
    const x: [number, number] = xDomain ?? (xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1])
    let y: [number, number] = yDomain ?? (ys.length ? [Math.min(...ys), Math.max(...ys)] : [-1, 1])
    if (!yDomain) { const pad = (y[1] - y[0]) * 0.08 || 1; y = [y[0] - pad, y[1] + pad] }
    return { x, y }
  }, [series, xDomain, yDomain])

  // Interpolación fluida de series y dominio Y (260 ms con curva cubic-out)
  const [animState, setAnimState] = useState<{ yMap: Record<string, number[]>; yDom: [number, number] }>(() => ({
    yMap: Object.fromEntries(series.map((s) => [s.id, s.y])),
    yDom: targetDom.y,
  }))
  const prevRef = useRef(animState)

  useEffect(() => {
    const fromYMap = prevRef.current.yMap
    const fromYDom = prevRef.current.yDom
    const toYDom = targetDom.y
    if (sameData(fromYMap, fromYDom, series, toYDom)) return

    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      const immediate = { yMap: Object.fromEntries(series.map((s) => [s.id, s.y])), yDom: toYDom }
      prevRef.current = immediate
      setAnimState(immediate)
      return
    }

    const start = performance.now()
    const duration = 260
    let raf = 0

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const ease = 1 - (1 - p) ** 3
      const nextMap: Record<string, number[]> = {}
      for (const s of series) {
        const prevArr = fromYMap[s.id]
        if (prevArr && prevArr.length === s.y.length) {
          const out = new Array<number>(s.y.length)
          for (let i = 0; i < s.y.length; i++) out[i] = prevArr[i] + (s.y[i] - prevArr[i]) * ease
          nextMap[s.id] = out
        } else {
          nextMap[s.id] = s.y
        }
      }
      const nextDom: [number, number] = [
        fromYDom[0] + (toYDom[0] - fromYDom[0]) * ease,
        fromYDom[1] + (toYDom[1] - fromYDom[1]) * ease,
      ]
      const next = { yMap: nextMap, yDom: nextDom }
      prevRef.current = next
      setAnimState(next)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [series, targetDom.y])

  const dom = { x: targetDom.x, y: animState.yDom }
  const iw = w - M.left - M.right, ih = height - M.top - M.bottom
  const sx = (v: number) => M.left + ((v - dom.x[0]) / (dom.x[1] - dom.x[0] || 1)) * iw
  const sy = (v: number) => M.top + ih - ((v - dom.y[0]) / (dom.y[1] - dom.y[0] || 1)) * ih
  const yZero = Math.min(M.top + ih, Math.max(M.top, sy(0)))

  const { paths, areas, bandPath } = useMemo(() => {
    const ps: string[] = []
    const as: (string | null)[] = []
    for (const s of series) {
      const ys = animState.yMap[s.id] ?? s.y
      const d = s.x.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join('')
      ps.push(d)
      if (s.fill && s.x.length > 1) {
        const x0 = sx(s.x[0]).toFixed(1), xN = sx(s.x[s.x.length - 1]).toFixed(1)
        as.push(`${d}L${xN},${yZero.toFixed(1)}L${x0},${yZero.toFixed(1)}Z`)
      } else {
        as.push(null)
      }
    }
    let bp: string | null = null
    if (bandBetween) {
      const sA = series.find((s) => s.id === bandBetween[0])
      const sB = series.find((s) => s.id === bandBetween[1])
      if (sA && sB && sA.x.length === sB.x.length && sA.x.length > 1) {
        const yA = animState.yMap[sA.id] ?? sA.y
        const yB = animState.yMap[sB.id] ?? sB.y
        const fwd = sA.x.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(yA[i]).toFixed(1)}`).join('')
        let rev = ''
        for (let i = sB.x.length - 1; i >= 0; i--) {
          rev += `L${sx(sB.x[i]).toFixed(1)},${sy(yB[i]).toFixed(1)}`
        }
        bp = `${fwd}${rev}Z`
      }
    }
    return { paths: ps, areas: as, bandPath: bp }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, animState, w, height, dom.x, dom.y])

  const xt = niceTicks(dom.x[0], dom.x[1], Math.max(3, Math.floor(iw / 90)))
  const yt = niceTicks(dom.y[0], dom.y[1], 5)

  const xFromEvent = (e: React.PointerEvent<SVGSVGElement>): number | null => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    if (px < M.left || px > w - M.right) return null
    return dom.x[0] + ((px - M.left) / iw) * (dom.x[1] - dom.x[0])
  }

  const probe = (e: React.PointerEvent<SVGSVGElement>) => {
    const val = xFromEvent(e)
    setHover(val)
    if (draggingSeek.current && onSeek && val !== null) {
      onSeek(Math.max(dom.x[0], Math.min(dom.x[1], val)))
    }
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onSeek) return
    const val = xFromEvent(e)
    if (val !== null) {
      draggingSeek.current = true
      onSeek(Math.max(dom.x[0], Math.min(dom.x[1], val)))
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingSeek.current) {
      draggingSeek.current = false
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    }
  }

  const near = (s: Series, x: number) => {
    let lo = 0, hi = s.x.length - 1
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s.x[mid] < x) lo = mid; else hi = mid }
    return Math.abs(s.x[lo] - x) < Math.abs(s.x[hi] - x) ? lo : hi
  }

  const liveCursorRef = useRef(liveCursor)
  liveCursorRef.current = liveCursor
  const liveDotsRef = useRef(liveDots)
  liveDotsRef.current = liveDots

  useEffect(() => {
    if (!liveCursor && !liveDots) return
    const paintLive = () => {
      if (liveCursorRef.current && cursorGroupRef.current) {
        const cur = liveCursorRef.current()
        if (cur !== null && cur >= dom.x[0] && cur <= dom.x[1]) {
          cursorGroupRef.current.style.display = ''
          const cx = sx(cur).toFixed(2)
          if (cursorLineRef.current) {
            cursorLineRef.current.setAttribute('x1', cx)
            cursorLineRef.current.setAttribute('x2', cx)
          }
          series.forEach((s, idx) => {
            const ys = animState.yMap[s.id] ?? s.y
            const cy = sy(interpAt(s.x, ys, cur)).toFixed(2)
            cursorHaloRefs.current[idx]?.setAttribute('cx', cx)
            cursorHaloRefs.current[idx]?.setAttribute('cy', cy)
            cursorDotRefs.current[idx]?.setAttribute('cx', cx)
            cursorDotRefs.current[idx]?.setAttribute('cy', cy)
          })
        } else {
          cursorGroupRef.current.style.display = 'none'
        }
      }
      if (liveDotsRef.current) {
        const pts = liveDotsRef.current()
        pts.forEach((d, idx) => {
          const cx = sx(d.x).toFixed(2)
          const cy = sy(d.y).toFixed(2)
          liveDotHaloRefs.current[idx]?.setAttribute('cx', cx)
          liveDotHaloRefs.current[idx]?.setAttribute('cy', cy)
          liveDotCoreRefs.current[idx]?.setAttribute('cx', cx)
          liveDotCoreRefs.current[idx]?.setAttribute('cy', cy)
        })
      }
    }
    paintLive()
    return useStore.subscribe((s, p) => {
      if (s.t !== p.t || s.sim !== p.sim || s.side !== p.side) paintLive()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(liveCursor), Boolean(liveDots), series, animState, w, height, dom.x[0], dom.x[1], dom.y[0], dom.y[1]])

  const activeCursor = !liveCursor && cursorX !== null && cursorX >= dom.x[0] && cursorX <= dom.x[1] ? cursorX : null
  const seedLiveDots = liveDots ? liveDots() : []

  return (
    <div ref={wrap} className="relative w-full select-none">
      <svg width={w} height={height} role="img" aria-label={ariaLabel}
        onPointerDown={onSeek ? onDown : undefined}
        onPointerMove={hoverOn || onSeek ? probe : undefined}
        onPointerUp={onSeek ? onUp : undefined}
        onPointerLeave={() => { setHover(null); draggingSeek.current = false }}
        style={{ touchAction: 'pan-y', cursor: onSeek ? 'ew-resize' : undefined }}>
        <defs>
          <clipPath id={`clip-${uid}`}>
            <rect x={M.left} y={M.top - 2} height={ih + 4}
              width={revealed ? iw : 0}
              style={{ transition: 'width 520ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
          </clipPath>
          {series.map((s) => (
            <linearGradient key={`grad-${s.id}`} id={`grad-${uid}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
            </linearGradient>
          ))}
        </defs>

        <rect x={M.left} y={M.top} width={iw} height={ih} fill="var(--paper)" />
        {xt.map((v) => <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={M.top} y2={M.top + ih} stroke="var(--grid)" strokeWidth={1} />)}
        <rect x={M.left} y={M.top} width={iw} height={ih} fill="none" stroke="var(--rule)" />
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.left} x2={w - M.right} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? "var(--grid-strong)" : "var(--grid)"} strokeWidth={1} />
            <text x={M.left - 8} y={sy(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{tickText(v)}</text>
          </g>
        ))}
        {xt.map((v) => (
          <text key={`x${v}`} x={sx(v)} y={height - M.bottom + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">{tickText(v)}</text>
        ))}
        <text x={M.left + iw / 2} y={height - 6} textAnchor="middle" fontSize={12} fill="var(--muted)">{xLabel} ({xUnit})</text>
        <text transform={`translate(14 ${M.top + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--muted)">{yLabel} ({yUnit})</text>

        {hMarks.map((m) => (
          <g key={m.label} style={{ transition: 'transform 220ms cubic-bezier(0.2, 0, 0, 1)' }}>
            <line x1={M.left} x2={w - M.right} y1={sy(m.value)} y2={sy(m.value)} stroke={m.color} strokeDasharray="5 5" opacity={0.85} />
            <text x={w - M.right - 4} y={sy(m.value) - 6} textAnchor="end" fontSize={11} fill={m.color}>{m.label}</text>
          </g>
        ))}
        {vMarks.map((m, idx) => (
          <g key={idx}>
            <line x1={sx(m.value)} x2={sx(m.value)} y1={M.top} y2={M.top + ih} stroke={m.color} strokeDasharray="5 5" opacity={0.85} />
            <text x={Math.min(w - M.right - 48, sx(m.value) + 6)} y={M.top + 13 + idx * 14} fontSize={11} fill={m.color}>{m.label}</text>
          </g>
        ))}

        {/* Curvas y áreas con animación de revelado y morphing fluido */}
        <g clipPath={`url(#clip-${uid})`}>
          {bandPath && (
            <path d={bandPath} fill="var(--real)" opacity={0.075} />
          )}
          {series.map((s, i) => areas[i] && (
            <path key={`area-${s.id}`} d={areas[i]!} fill={`url(#grad-${uid}-${s.id})`} />
          ))}
          {series.map((s, i) => (
            <path key={s.id} d={paths[i]} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.3}
              strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </g>

        {series.filter((s) => s.markers).map((s) => {
          const ys = animState.yMap[s.id] ?? s.y
          return s.x.map((x, i) => (
            <circle key={`${s.id}${i}`} cx={sx(x)} cy={sy(ys[i])} r={4} fill="var(--paper)" stroke={s.color} strokeWidth={2} />
          ))
        })}

        {dots.map((d, i) => (
          <g key={`dot${i}`}>
            <circle cx={sx(d.x)} cy={sy(d.y)} r={10} fill={d.color} opacity={0.18} />
            <circle cx={sx(d.x)} cy={sy(d.y)} r={5.5} fill={d.color} stroke="var(--paper)" strokeWidth={2} />
          </g>
        ))}

        {seedLiveDots.map((d, i) => (
          <g key={`ldot${i}`} pointerEvents="none">
            <circle ref={(el) => { liveDotHaloRefs.current[i] = el }} cx={sx(d.x)} cy={sy(d.y)} r={10} fill={d.color} opacity={0.18} />
            <circle ref={(el) => { liveDotCoreRefs.current[i] = el }} cx={sx(d.x)} cy={sy(d.y)} r={5.5} fill={d.color} stroke="var(--paper)" strokeWidth={2} />
          </g>
        ))}

        {/* Cursor en vivo sincronizado con el tiempo de reproducción */}
        {liveCursor && (
          <g ref={cursorGroupRef} pointerEvents="none">
            <line ref={cursorLineRef} x1={M.left} x2={M.left} y1={M.top} y2={M.top + ih} stroke="var(--ink)" strokeWidth={1.2} opacity={0.55} />
            {series.map((s, idx) => (
              <g key={`lcur-${s.id}`}>
                <circle ref={(el) => { cursorHaloRefs.current[idx] = el }} cx={M.left} cy={M.top} r={8.5} fill={s.color} opacity={0.18} />
                <circle ref={(el) => { cursorDotRefs.current[idx] = el }} cx={M.left} cy={M.top} r={4.2} fill={s.color} stroke="var(--paper)" strokeWidth={1.8} />
              </g>
            ))}
          </g>
        )}
        {activeCursor !== null && (
          <g pointerEvents="none">
            <line x1={sx(activeCursor)} x2={sx(activeCursor)} y1={M.top} y2={M.top + ih} stroke="var(--ink)" strokeWidth={1.2} opacity={0.55} />
            {series.map((s) => {
              const ys = animState.yMap[s.id] ?? s.y
              const yVal = interpAt(s.x, ys, activeCursor)
              const cx = sx(activeCursor), cy = sy(yVal)
              return (
                <g key={`cur-${s.id}`}>
                  <circle cx={cx} cy={cy} r={8.5} fill={s.color} opacity={0.18} />
                  <circle cx={cx} cy={cy} r={4.2} fill={s.color} stroke="var(--paper)" strokeWidth={1.8} />
                </g>
              )
            })}
          </g>
        )}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={sx(hover)} x2={sx(hover)} y1={M.top} y2={M.top + ih} stroke="var(--muted)" strokeDasharray="2 3" />
            {series.map((s) => {
              const ys = animState.yMap[s.id] ?? s.y
              const i = near(s, hover)
              return <circle key={s.id} cx={sx(s.x[i])} cy={sy(ys[i])} r={4.5} fill={s.color} stroke="var(--paper)" strokeWidth={2} />
            })}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute rounded-md border px-3 py-2 text-xs shadow-sm"
          style={{ left: Math.min(Math.max(sx(hover) + 12, 8), w - 195), top: 8, background: 'var(--paper)', borderColor: 'var(--rule)', color: 'var(--ink)' }}>
          <div style={{ color: 'var(--muted)' }}>{xLabel} = {tickText(hover)} {xUnit}</div>
          {series.map((s) => {
            const ys = animState.yMap[s.id] ?? s.y
            return (
              <div key={s.id} style={{ color: s.color }}>
                {s.label}: {ys[near(s, hover)].toFixed(2).replace('-', '−')} {yUnit}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dash?: boolean }[] }) {
  return (
    <ul className="small flex flex-wrap gap-x-5 gap-y-1">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke={i.color} strokeWidth="2.5" strokeDasharray={i.dash ? '4 3' : undefined} /></svg>
          {i.label}
        </li>
      ))}
    </ul>
  )
}
