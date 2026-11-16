import { useEffect } from 'react'
import { T_MAX, useStore } from '../../state/store'

/** Reloj de reproducción: avanza t con requestAnimationFrame y lo guarda en el store. */
export function usePlayback() {
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const { playing, t, speed, setT } = useStore.getState()
      if (playing) setT((t + dt * speed) % T_MAX)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
}
