import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Transición entre vistas: la saliente se desenfoca y se desvanece; la entrante aparece desde un
 * ligero escalado con desenfoque que se aclara. Con «reducir movimiento» solo hay fundido.
 */
export function BlurViewTransition({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)' }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
