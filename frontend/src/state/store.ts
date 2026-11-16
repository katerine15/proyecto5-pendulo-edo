import { create } from 'zustand'
import { detectSource, localSource } from './datasource'
import { rigidTension, ropePendulum } from '../core-ts/rope'
import type { DataSource, ErrorCurve, PeriodRow, Prediction, SimResult } from './types'

export type View = 'simulacion' | 'verificacion' | 'laboratorio' | 'diseno' | 'figuras' | 'datos' | 'fundamento' | 'resorte'
export type CameraPreset = 'perspectiva' | 'frontal' | 'reloj' | 'superior'
export const VIEWS: View[] = ['simulacion', 'verificacion', 'laboratorio', 'diseno', 'figuras', 'datos', 'fundamento', 'resorte']
const viewFromHash = (): View => {
  const h = window.location.hash.replace(/^#\/?/, '') as View
  return VIEWS.includes(h) ? h : 'simulacion'
}

export const T_MAX = 12 // s de simulación que se reproducen en bucle
export const N_POINTS = 1200

interface State {
  // entradas
  theta0Deg: number
  /** Lado de suelta: +1 a la derecha, −1 a la izquierda. La física es simétrica, así que es el espejo del mismo cálculo. */
  side: 1 | -1
  L: number
  g: number
  theme: 'dark' | 'light'
  view: View
  showExact: boolean
  showTrail: boolean
  showDial: boolean
  showVectors: boolean
  /** Física de cuerda: la cuerda se afloja si la varilla rígida tendría que empujar (θ₀ > 90°). Apagada: modelo de la guía. */
  ropeMode: boolean
  cameraPreset: CameraPreset
  // datos
  source: DataSource
  sim: SimResult | null
  rows: PeriodRow[]
  curve: ErrorCurve | null
  prediction: Prediction | null
  loading: boolean
  fallbackNote: string | null
  // reproducción (t se actualiza a 60 fps; se lee con getState(), no re-renderiza la escena)
  playing: boolean
  t: number
  speed: number
  // acciones
  set: (p: Partial<Pick<State, 'theta0Deg' | 'side' | 'L' | 'g'>>) => void
  setTheme: (t: 'dark' | 'light') => void
  setView: (v: View) => void
  setFlag: (k: 'showExact' | 'showTrail' | 'showDial' | 'showVectors' | 'ropeMode', v: boolean) => void
  setCameraPreset: (c: CameraPreset) => void
  setPlaying: (v: boolean) => void
  setSpeed: (v: number) => void
  setT: (t: number) => void
  reset: () => void
  init: () => Promise<void>
  refresh: () => Promise<void>
}

/** Tema guardado; si no hay, el del sistema. Claro por defecto (se proyecta en salón). */
function initialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch { /* sin almacenamiento */ }
  return 'light'
}
const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** Soltar a la izquierda es el espejo de soltar a la derecha: se niegan los ángulos, el resto (períodos, errores) no cambia. */
function mirrorSim(sim: SimResult, side: 1 | -1): SimResult {
  if (side === 1) return sim
  const neg = (a: number[]) => a.map((v) => -v)
  return { ...sim, thetaLinearDeg: neg(sim.thetaLinearDeg), thetaRealDeg: neg(sim.thetaRealDeg), thetaExactDeg: neg(sim.thetaExactDeg) }
}

/**
 * Añade la tensión del péndulo real (el modelo lineal no define una). Con la física de cuerda, además reemplaza el movimiento del péndulo real por el de una
 * cuerda (tensa = sólido; floja = caída libre) y guarda a qué distancia del pivote queda la masa.
 */
function withTension(sim: SimResult, theta0Deg: number, side: 1 | -1, L: number, g: number, ropeMode: boolean): SimResult {
  if (!ropeMode) return { ...sim, tensionReal: sim.thetaRealDeg.map((a) => rigidTension(a, theta0Deg)) }
  const rope = ropePendulum(theta0Deg, L, g, sim.t[sim.t.length - 1], sim.t.length)
  return { ...sim, thetaRealDeg: rope.thetaDeg.map((a) => a * side), tensionReal: rope.tension, ropeR: rope.r }
}

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
let initPromise: Promise<void> | null = null
let hashBound = false

export const useStore = create<State>((set, get) => ({
  theta0Deg: 90, side: 1, L: 1, g: 9.81, theme: initialTheme(), view: viewFromHash(),
  showExact: true, showTrail: true, showDial: true, showVectors: true, ropeMode: false, cameraPreset: 'perspectiva',
  source: localSource, sim: null, rows: [], curve: null, prediction: null,
  loading: true, fallbackNote: null,
  playing: !prefersReducedMotion(), t: 0, speed: 1,

  set: (p) => {
    set(p)
    clearTimeout(timer) // espera 60 ms tras el último cambio del slider para respuesta más fluida
    timer = setTimeout(() => void get().refresh(), 60)
  },
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch { /* sin almacenamiento */ }
    set({ theme })
  },
  setFlag: (k, v) => {
    set({ [k]: v } as Partial<State>)
    if (k === 'ropeMode') void get().refresh() // cambia la física del péndulo real
  },
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setView: (view) => {
    if (window.location.hash !== `#/${view}`) window.location.hash = `/${view}`
    set({ view })
  },
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setT: (t) => set({ t }),
  reset: () => set({ t: 0 }),

  init: () => {
    if (initPromise) return initPromise
    initPromise = (async () => {
      document.documentElement.dataset.theme = get().theme
      if (!hashBound) {
        hashBound = true
        window.addEventListener('hashchange', () => set({ view: viewFromHash() }))
      }
      set({ source: await detectSource() })
      await get().refresh()
    })()
    return initPromise
  },

  refresh: async () => {
    const id = ++seq
    const { theta0Deg, side, L, g, ropeMode } = get()
    const run = async (src: DataSource) => {
      const [raw, rows, curve, prediction] = await Promise.all([
        src.simulate({ theta0Deg, L, g, tMax: T_MAX, n: N_POINTS }),
        src.periods(L, g), src.errorCurve(L, g), src.predict(theta0Deg, L, g),
      ])
      return { sim: withTension(mirrorSim(raw, side), theta0Deg, side, L, g, ropeMode), rows, curve, prediction }
    }
    try {
      const data = await run(get().source)
      if (id === seq) set({ ...data, loading: false })
    } catch {
      // Respaldo automático: si el backend cae a mitad de la sesión, seguimos en modo local.
      const data = await run(localSource)
      if (id === seq) set({ ...data, source: localSource, loading: false,
        fallbackNote: 'Se perdió la conexión con el backend: cálculo local en el navegador.' })
    }
  },
}))
