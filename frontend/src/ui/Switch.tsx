import { motion, useReducedMotion } from 'motion/react'

/** Interruptor accesible (role="switch"); la perilla se mueve con un resorte elástico. */
export function Switch({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string
}) {
  const reduce = useReducedMotion()
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" onClick={() => onChange(!checked)}>
      <span className="text-left">
        <span className="block text-[0.9375rem]">{label}</span>
        {hint && <span className="small block">{hint}</span>}
      </span>
      <span className="switch-track" data-on={checked}>
        <motion.span className="switch-thumb" layout
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 30 }}
          style={{ justifySelf: checked ? 'end' : 'start' }} />
      </span>
    </button>
  )
}
