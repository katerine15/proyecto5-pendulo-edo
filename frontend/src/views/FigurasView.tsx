import { Download, Package } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Controls } from '../features/controls/Controls'
import { useFigure } from '../features/figures/useFigure'
import { downloadFromApi } from '../lib/api'
import { fmt } from '../lib/format'
import { useStore } from '../state/store'
import { SegmentedTabs } from '../ui/SegmentedTabs'

interface Fig { id: string; title: string; what: string; dim: '2D' | '3D' }
const FIGS: Fig[] = [
  { id: 'verificacion', dim: '2D', title: 'Verificación contra lo exacto', what: 'La simulación RK4 se superpone a la solución exacta; abajo, la diferencia en escala logarítmica.' },
  { id: 'comparacion', dim: '2D', title: 'Real contra lineal', what: 'Cuatro ángulos de suelta (10°, 45°, 90°, 150°) con su período y el error.' },
  { id: 'error_periodo', dim: '2D', title: 'Error del período y umbral', what: 'Dónde el error supera el 1 %, con las dos convenciones de error.' },
  { id: 'fases', dim: '2D', title: 'Espacio de fases', what: 'Curvas de energía constante, elipse lineal y separatriz.' },
  { id: 'serie_periodo', dim: '2D', title: 'Período y su serie', what: 'T/T₀ exacto frente a los desarrollos de orden 2, 4 y 6.' },
  { id: 'energia', dim: '2D', title: 'Conservación de la energía', what: 'Euler explícito, Euler simpléctico y RK4 durante 50 s.' },
  { id: 'paisaje_energia', dim: '3D', title: 'Paisaje de energía', what: 'La energía real como superficie y la del modelo lineal como malla: se separan a ángulos grandes.' },
  { id: 'espacio_tiempo', dim: '3D', title: 'Trayectoria θ–ω–t', what: 'El péndulo real tarda más en cerrar cada vuelta que el lineal.' },
]

function useQuery() {
  const theta0Deg = useStore((s) => s.theta0Deg)
  const L = useStore((s) => s.L)
  const g = useStore((s) => s.g)
  const theme = useStore((s) => s.theme)
  return { theta0_deg: theta0Deg, L, g, theme }
}

function useDownload() {
  const [dlError, setDlError] = useState<string | null>(null)
  const run = async (url: string, filename: string, label: string) => {
    setDlError(null)
    try {
      await downloadFromApi(url, filename)
    } catch {
      setDlError(`No se pudo descargar el ${label}.`)
    }
  }
  return { run, dlError }
}

function FigureCard({ fig }: { fig: Fig }) {
  const q = useQuery()
  const { url, busy, error } = useFigure(`${fig.id}.png`, { ...q, dpi: 110 })
  const { run, dlError } = useDownload()
  const get = (fmt: 'png' | 'svg') => run(
    `/api/figures/${fig.id}.${fmt}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])), dpi: '220' })}`,
    `${fig.id}.${fmt}`,
    fmt.toUpperCase(),
  )
  return (
    <article className="panel flex flex-col gap-3" aria-label={fig.title}>
      <header>
        <h2 className="h2">{fig.title}</h2>
        <p className="small mt-1">{fig.what}</p>
      </header>
      <div className="fig-frame" data-busy={busy}>
        {url && <img src={url} alt={`${fig.title}: ${fig.what}`} />}
        {!url && !error && <p className="small p-6">Dibujando…</p>}
        {error && <p className="small p-6" style={{ color: 'var(--bad)' }}>{error}</p>}
        {busy && url && <span className="fig-badge">Actualizando…</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(['png', 'svg'] as const).map((f) => (
          <motion.button key={f} className="chip" whileTap={{ scale: 0.96 }} onClick={() => void get(f)}>
            <Download size={14} aria-hidden /> <span className="ml-2">{f.toUpperCase()}</span>
          </motion.button>
        ))}
        {dlError && <span className="small" style={{ color: 'var(--bad)' }}>{dlError}</span>}
      </div>
    </article>
  )
}

function Animation() {
  const q = useQuery()
  const [slow, setSlow] = useState('0.25')
  const [asked, setAsked] = useState<string | null>(null) // la animación tarda: solo se pide al pulsar
  const key = `${slow}|${q.theta0_deg}|${q.L}|${q.g}|${q.theme}`
  const query = { ...q, slow, seconds: 8, fps: 20 }
  const { url, busy, error } = useFigure('animacion.gif', query, asked === key, 0)
  const { run, dlError } = useDownload()
  const fresh = asked === key
  return (
    <section className="panel flex flex-col gap-4" aria-label="Animación en cámara lenta">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="h2">Animación 3D en cámara lenta</h2>
          <p className="small mt-1 max-w-[60ch]">
            Los dos péndulos soltados a {fmt(q.theta0_deg, 0)}° con estela, sombra en el suelo y cámara que orbita despacio. Se dibuja cuadro a cuadro en el servidor.
          </p>
        </div>
        <SegmentedTabs label="Velocidad de la animación" value={slow} onChange={setSlow}
          options={[{ value: '0.1', label: '0.1×' }, { value: '0.25', label: '0.25×' }, { value: '0.5', label: '0.5×' }]} />
      </header>
      <div className="fig-frame" data-busy={busy}>
        {fresh && url && <img src={url} alt="Animación 3D en cámara lenta de los dos péndulos" />}
        {fresh && busy && !url && <p className="small p-8">Dibujando los cuadros… tarda unos segundos.</p>}
        {!fresh && <p className="small p-8">Pulsa «Generar» para dibujarla con los parámetros actuales.</p>}
        {error && <p className="small p-6" style={{ color: 'var(--bad)' }}>{error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <motion.button className="chip" aria-pressed={fresh} whileTap={{ scale: 0.96 }} onClick={() => setAsked(key)}>
          {fresh && busy ? 'Generando…' : fresh ? 'Generada' : 'Generar'}
        </motion.button>
        {fresh && url && (
          <motion.button className="chip" whileTap={{ scale: 0.96 }}
            onClick={() => void run(`/api/figures/animacion.gif?${new URLSearchParams(Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])))}&download=true`, 'animacion_camara_lenta.gif', 'GIF')}>
            <Download size={14} aria-hidden /> <span className="ml-2">GIF</span>
          </motion.button>
        )}
        {dlError && <span className="small" style={{ color: 'var(--bad)' }}>{dlError}</span>}
      </div>
    </section>
  )
}

type Tab = '2d' | '3d' | 'anim'

export function FigurasView() {
  const apiUp = useStore((s) => s.source.name === 'api')
  const q = useQuery()
  const [tab, setTab] = useState<Tab>('2d')
  const { run, dlError: zipError } = useDownload()
  const list = FIGS.filter((f) => f.dim === (tab === '3d' ? '3D' : '2D'))

  const zip = () => void run(
    `/api/figures/todo.zip?${new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])))}&dpi=200`,
    'figuras_pendulo.zip',
    'ZIP',
  )

  if (!apiUp) {
    return (
      <div className="flex max-w-[760px] flex-col gap-6">
        <p className="lead">Las figuras vectoriales y animaciones se generan desde el servicio de renderizado.</p>
        <section className="panel">
          <h2 className="h2 mb-2">Generación por línea de comandos</h2>
          <p className="small mb-3">Esta vista redibuja cada figura al instante cuando la API está disponible. También puedes generarlas directamente:</p>
          <pre className="math">{`cd backend
PYTHONPATH=. uv run python scripts/generate_figures.py`}</pre>
          <p className="small mt-3">Deja los PNG, los SVG, la animación y la tabla de períodos en la carpeta <b>figuras/</b>.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="lead max-w-[36ch]">Figuras para el informe, dibujadas al instante con tus parámetros.</p>
        <div className="flex flex-col items-end gap-1">
          <motion.button className="chip" whileTap={{ scale: 0.96 }} onClick={() => void zip()}>
            <Package size={15} aria-hidden /> <span className="ml-2">Descargar todo (ZIP)</span>
          </motion.button>
          {zipError && <span className="small" style={{ color: 'var(--bad)' }}>{zipError}</span>}
        </div>
      </div>

      <section className="panel" aria-label="Parámetros">
        <h2 className="h2 mb-4">Parámetros</h2>
        <Controls />
      </section>

      <SegmentedTabs label="Tipo de figura" value={tab} onChange={setTab}
        options={[{ value: '2d', label: 'Gráficas 2D' }, { value: '3d', label: 'Figuras 3D' }, { value: 'anim', label: 'Animación' }]} />

      {tab === 'anim' ? <Animation /> : (
        <div className={`grid gap-6 ${tab === '2d' ? 'lg:grid-cols-2' : ''}`}>
          {list.map((f) => <FigureCard key={f.id} fig={f} />)}
        </div>
      )}
    </div>
  )
}
