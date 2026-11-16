import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

const fmt = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '—')

/**
 * Cifra que cuenta hasta su valor: desde 0 al montar y, después, desde el valor anterior.
 * Se escribe en el DOM directamente (sin re-renderizar React en cada cuadro).
 */
export function AnimatedNumber({ value, decimals = 2, duration = 0.7, className, style }: {
  value: number; decimals?: number; duration?: number; className?: string; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !Number.isFinite(value)) return
    if (reduce) { el.textContent = fmt(value, decimals); from.current = value; return }
    const controls = animate(from.current, value, {
      duration, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { el.textContent = fmt(v, decimals); from.current = v },
    })
    return () => controls.stop()
  }, [value, decimals, duration, reduce])

  return <span ref={ref} className={className} style={style}>{fmt(value, decimals)}</span>
}
