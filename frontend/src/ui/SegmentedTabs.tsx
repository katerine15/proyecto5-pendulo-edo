import { motion, useReducedMotion } from 'motion/react'
import { useId, useRef } from 'react'

export interface TabOption<T extends string> { value: T; label: string }

/**
 * Pestañas segmentadas. La píldora activa se desliza entre opciones (layoutId compartido).
 * Teclado: flechas, Inicio y Fin mueven la selección (patrón WAI-ARIA tabs).
 */
export function SegmentedTabs<T extends string>({ options, value, onChange, label }: {
  options: TabOption<T>[]; value: T; onChange: (v: T) => void; label: string
}) {
  const id = useId() // un layoutId único por grupo: evita choques entre varios controles
  const reduce = useReducedMotion()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (to: number) => {
    const i = (to + options.length) % options.length
    onChange(options[i].value)
    refs.current[i]?.focus()
  }
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(i + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(options.length - 1) }
  }

  return (
    <div role="tablist" aria-label={label} className="seg">
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el }} role="tab" type="button"
            aria-selected={active} tabIndex={active ? 0 : -1} className="seg-tab"
            onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}>
            {active && (
              <motion.span layoutId={`${id}-indicator`} className="seg-pill"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            <span className="seg-label">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
