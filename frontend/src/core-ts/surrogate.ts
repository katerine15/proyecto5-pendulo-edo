/** Evalúa en el navegador la red neuronal entrenada en Python (pesos en surrogate.json). */
import weights from '../assets/surrogate.json'

interface Net {
  angle_min: number
  angle_max: number
  W1: number[][]; b1: number[]
  W2: number[][]; b2: number[]
  W3: number[][]; b3: number[]
  metrics: {
    mean_abs_pct_error: number; max_abs_pct_error: number; n_train: number; n_test: number
    mean_abs_pct_error_full_range?: number; max_abs_pct_error_full_range?: number; max_error_at_deg?: number; n_full_range?: number
  }
}
const net = weights as unknown as Net

export const surrogateMetrics = net.metrics
export const SURROGATE_RANGE: [number, number] = [net.angle_min, net.angle_max]

/** Devuelve T/T0 predicho para un ángulo de suelta en grados. */
export function predictRatio(thetaDeg: number): number {
  const x = (2 * (thetaDeg - net.angle_min)) / (net.angle_max - net.angle_min) - 1
  const a1 = net.b1.map((b, j) => Math.tanh(x * net.W1[0][j] + b))
  const a2 = net.b2.map((b, k) => Math.tanh(a1.reduce((s, a, j) => s + a * net.W2[j][k], b)))
  return a2.reduce((s, a, k) => s + a * net.W3[k][0], net.b3[0]) + 1
}
