export interface SimInput {
  theta0Deg: number
  L: number
  g: number
  tMax: number
  n: number
}

export interface SimResult {
  t: number[]
  thetaLinearDeg: number[]
  thetaRealDeg: number[]
  thetaExactDeg: number[]
  T0: number
  TReal: number
  TMeasured: number
  periodErrorPct: number
  maxGapDeg: number
  numericVsExactDeg: number
  clockDriftSPerDay: number
  /** Tensión T/(m g) del péndulo real en cada instante (negativa: la varilla empuja; una cuerda se aflojaría). */
  tensionReal?: number[]
  /** Distancia de la masa real al pivote dividida por L: 1 = cuerda tensa (sólido), < 1 = cuerda floja. Solo con la física de cuerda. */
  ropeR?: number[]
}

export interface PeriodRow {
  theta0Deg: number
  T0: number
  TReal: number
  errorPct: number
  clockDriftSPerDay: number
}

export interface ErrorCurve {
  theta0Deg: number[]
  errorPct: number[]
  threshold1pctDeg: number
}

export interface Prediction {
  theta0Deg: number
  TPred: number
  TTrue: number
  relErrorPct: number
  inTrainingRange: boolean
  /** Error en los ángulos de prueba (que la red no vio). */
  meanErrPct: number
  maxErrPct: number
  nTest?: number
  /** Error medido en TODO el rango entrenado (malla densa): el máximo suele estar en un borde. */
  meanErrFullPct?: number
  maxErrFullPct?: number
  maxErrAtDeg?: number
}

/** Estrategia de datos: la UI no sabe si el cálculo ocurre en el servidor o en el navegador. */
export interface DataSource {
  readonly name: 'api' | 'local'
  simulate(i: SimInput): Promise<SimResult>
  periods(L: number, g: number): Promise<PeriodRow[]>
  errorCurve(L: number, g: number): Promise<ErrorCurve>
  predict(theta0Deg: number, L: number, g: number): Promise<Prediction>
}
