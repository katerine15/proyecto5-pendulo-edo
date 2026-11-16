import { Activity, BookOpen, ChartLine, Images, Moon, Orbit, Sun, Table, Target, Waves } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { type View, useStore } from '../state/store'

export const VIEW_META: Record<View, { label: string; short: string; title: string; icon: typeof Activity }> = {
  simulacion: { short: 'Simular', label: 'Simulación', title: 'Simulación', icon: Activity },
  verificacion: { short: 'Verificar', label: 'Verificación', title: 'Verificación contra lo exacto', icon: ChartLine },
  laboratorio: { short: 'Lab', label: 'Laboratorio', title: 'Laboratorio numérico', icon: Orbit },
  diseno: { short: 'Diseño', label: 'Diseño', title: 'Decisión de diseño', icon: Target },
  figuras: { short: 'Figuras', label: 'Figuras', title: 'Figuras para el informe', icon: Images },
  datos: { short: 'Datos', label: 'Datos y predicción', title: 'Datos y predicción', icon: Table },
  fundamento: { short: 'Teoría', label: 'Fundamento', title: 'Fundamento matemático', icon: BookOpen },
  resorte: { short: 'Resorte', label: 'Simulación', title: 'Masa-resorte amortiguada', icon: Waves },
}
const PENDULUM: View[] = ['simulacion', 'verificacion', 'laboratorio', 'diseno', 'figuras', 'datos', 'fundamento']
const SPRING: View[] = ['resorte']
const ALL: View[] = [...PENDULUM, ...SPRING]
export const modelName = (v: View) => (v === 'resorte' ? 'Masa-resorte amortiguada' : 'Péndulo simple')

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <rect x="1" y="1" width="26" height="26" rx="7" fill="var(--ink)" />
      <line x1="5" y1="7" x2="23" y2="7" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="7" x2="9.5" y2="19" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="20.5" r="3.2" fill="var(--real)" stroke="var(--bg)" strokeWidth="1.2" />
    </svg>
  )
}

function Item({ id }: { id: View }) {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const reduce = useReducedMotion()
  const { icon: Icon, label } = VIEW_META[id]
  const active = view === id
  return (
    <a href={`#/${id}`} className="nav-item" aria-current={active ? 'page' : undefined}
      onClick={(e) => { e.preventDefault(); setView(id) }}>
      {active && (
        <motion.span layoutId="nav-pill" className="nav-pill"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }} />
      )}
      <span className="nav-content"><Icon size={17} aria-hidden /> {label}</span>
    </a>
  )
}

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="flex items-center gap-3 px-3 pb-6">
        <Mark />
        <div className="leading-tight">
          <p className="font-semibold">Oscilaciones</p>
          <p className="small">Laboratorio de EDO</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Péndulo simple">
        <p className="nav-group">Péndulo simple</p>
        {PENDULUM.map((id) => <Item key={id} id={id} />)}
      </nav>

      <nav className="mt-6 flex flex-col gap-1" aria-label="Masa-resorte amortiguada">
        <p className="nav-group">Masa-resorte amortiguada</p>
        {SPRING.map((id) => <Item key={id} id={id} />)}
      </nav>

      <div className="mt-auto px-3 pt-6">
        <p className="small">Unidad 3 · Proyecto 5</p>
        <p className="small">Colegio Mayor del Cauca</p>
      </div>
    </aside>
  )
}

export function Topbar() {
  const view = useStore((s) => s.view)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const theta0Deg = useStore((s) => s.theta0Deg)
  const side = useStore((s) => s.side)
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const isSpring = view === 'resorte'

  return (
    <header className="topbar">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 lg:hidden"><Mark /></span>
        <div className="min-w-0">
          <p className="small truncate">{modelName(view)}</p>
          <h1 className="truncate text-[1.0625rem] font-semibold tracking-[-0.015em] leading-tight sm:text-[1.125rem]">
            {VIEW_META[view].title}
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {!isSpring && (
          <dl className="topbar-metrics hidden md:flex" aria-label="Parámetros activos del péndulo">
            <div>
              <dt>θ₀</dt>
              <dd>{(theta0Deg * side).toFixed(0)}°</dd>
            </div>
            <span className="topbar-sep" aria-hidden />
            <div>
              <dt>L</dt>
              <dd>{L.toFixed(2)} m</dd>
            </div>
            <span className="topbar-sep" aria-hidden />
            <div>
              <dt>g</dt>
              <dd>{g.toFixed(2)} m/s²</dd>
            </div>
          </dl>
        )}
        <button className="btn-icon"
          title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}

export function TabBar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  return (
    <nav className="tabbar" aria-label="Vistas">
      {ALL.map((id) => {
        const { icon: Icon, short } = VIEW_META[id]
        return (
          <button key={id} className="tab" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
            <Icon size={19} aria-hidden /><span>{short}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="page" id="contenido">{children}</main>
      </div>
      <TabBar />
    </div>
  )
}
