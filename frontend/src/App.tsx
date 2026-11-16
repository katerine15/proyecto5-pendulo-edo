import { Suspense, lazy, useEffect } from 'react'
import { Shell } from './layout/Shell'
import { useStore } from './state/store'
import { BlurViewTransition } from './ui/BlurViewTransition'
import { usePlayback } from './features/scene/usePlayback'
import { DatosView, FundamentoView, SimulacionView, VerificacionView } from './views/Views'

const FigurasView = lazy(() => import('./views/FigurasView').then((m) => ({ default: m.FigurasView })))
const ModelView = lazy(() => import('./views/ModelView').then((m) => ({ default: m.ModelView })))
const LaboratorioView = lazy(() => import('./views/ScienceViews').then((m) => ({ default: m.LaboratorioView })))
const DisenoView = lazy(() => import('./views/ScienceViews').then((m) => ({ default: m.DisenoView })))

const VIEWS = {
  simulacion: SimulacionView,
  verificacion: VerificacionView,
  laboratorio: LaboratorioView,
  diseno: DisenoView,
  figuras: FigurasView,
  datos: DatosView,
  fundamento: FundamentoView,
  resorte: ModelView,
} as const

export default function App() {
  const init = useStore((s) => s.init)
  const loading = useStore((s) => s.loading)
  const view = useStore((s) => s.view)
  usePlayback()
  useEffect(() => { void init() }, [init])

  const View = VIEWS[view]
  return (
    <Shell>
      {loading ? (
        <p className="label py-24 text-center">Calculando…</p>
      ) : (
        <BlurViewTransition viewKey={view}>
          <Suspense fallback={<p className="label py-12 text-center">Cargando vista…</p>}>
            <View />
          </Suspense>
        </BlurViewTransition>
      )}
    </Shell>
  )
}
