/**
 * Física de la cuerda.
 *
 * Una masa colgada de una cuerda se comporta de dos maneras:
 *   - Cuerda TENSA (T ≥ 0): la distancia al pivote es exactamente L y todo ocurre como en un cuerpo sólido: es el péndulo
 *     de siempre, θ'' = −(g/L) sen θ. Estirada al máximo, la cuerda actúa como una varilla rígida.
 *   - Cuerda FLOJA (T < 0): una cuerda solo puede tirar, nunca empujar. Si el modelo rígido pidiera una fuerza de compresión,
 *     la cuerda se afloja y la masa cae libre (tiro parabólico) hasta que vuelve a alcanzar la distancia L; entonces la
 *     cuerda se tensa de golpe («tirón») y pierde la componente radial de la velocidad.
 *
 * La tensión por unidad de peso es T/(m g) = L ω²/g + cos θ, que en el péndulo rígido vale 3 cos θ − 2 cos θ₀.
 * Solo es negativa si el ángulo de suelta supera 90°; hasta ahí la cuerda y la varilla dan el mismo movimiento.
 */

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export interface RopeSample {
  t: number[]
  /** Ángulo (°) de la dirección pivote → masa, medido desde la vertical hacia abajo. */
  thetaDeg: number[]
  /** Distancia al pivote dividida por L: 1 con la cuerda tensa, menor que 1 con la cuerda floja. */
  r: number[]
  /** Tensión T/(m g); 0 mientras la cuerda está floja. */
  tension: number[]
  /** Energía mecánica por unidad de masa, ½v² + g·y, con y hacia arriba desde el pivote. */
  energy: number[]
}

/** Tensión T/(m g) de la varilla rígida en el ángulo θ si se soltó desde θ₀ (negativa = la varilla empuja). */
export const rigidTension = (thetaDeg: number, theta0Deg: number) => 3 * Math.cos(rad(thetaDeg)) - 2 * Math.cos(rad(theta0Deg))

/** Misma tensión con la aproximación lineal (sen θ ≈ θ, cos θ ≈ 1 − θ²/2). */
export const linearTension = (thetaDeg: number, theta0Deg: number) => 1 + rad(theta0Deg) ** 2 - 1.5 * rad(thetaDeg) ** 2

/**
 * Péndulo de cuerda: tenso (péndulo rígido) mientras T ≥ 0 y en caída libre mientras la cuerda está floja.
 * Se integra con paso fijo `h` (RK4 con la cuerda tensa, tiro parabólico exacto con la cuerda floja).
 */
export function ropePendulum(theta0Deg: number, L: number, g: number, tMax: number, n: number, h = 2e-4): RopeSample {
  const w2 = g / L
  let mode: 'taut' | 'free' = 'taut'
  let th = rad(theta0Deg), om = 0
  let x = 0, y = 0, vx = 0, vy = 0

  const out: RopeSample = { t: [], thetaDeg: [], r: [], tension: [], energy: [] }
  const dtOut = tMax / (n - 1)
  const f = (a: number) => -w2 * Math.sin(a)

  const record = () => {
    if (mode === 'taut') {
      out.thetaDeg.push(deg(th)); out.r.push(1)
      out.tension.push((L * om * om + g * Math.cos(th)) / g)
      out.energy.push(0.5 * L * L * om * om - g * L * Math.cos(th))
    } else {
      out.thetaDeg.push(deg(Math.atan2(x, -y))); out.r.push(Math.hypot(x, y) / L)
      out.tension.push(0)
      out.energy.push(0.5 * (vx * vx + vy * vy) + g * y)
    }
  }

  let t = 0
  while (out.t.length < n) {
    if (mode === 'taut' && L * om * om + g * Math.cos(th) < 0) {   // la cuerda no puede empujar: se afloja
      x = L * Math.sin(th); y = -L * Math.cos(th)
      vx = L * om * Math.cos(th); vy = L * om * Math.sin(th)
      mode = 'free'
    }
    while (out.t.length < n && t >= out.t.length * dtOut - 1e-12) { out.t.push(out.t.length * dtOut); record() }
    if (out.t.length >= n) break

    if (mode === 'taut') {
      const k1u = om, k1v = f(th)
      const k2u = om + 0.5 * h * k1v, k2v = f(th + 0.5 * h * k1u)
      const k3u = om + 0.5 * h * k2v, k3v = f(th + 0.5 * h * k2u)
      const k4u = om + h * k3v, k4v = f(th + h * k3u)
      th += (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u)
      om += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
    } else {
      x += vx * h; y += vy * h - 0.5 * g * h * h; vy -= g * h   // caída libre
      const r = Math.hypot(x, y)
      if (r >= L) {                                           // la cuerda vuelve a tensarse: tirón inelástico
        const rx = x / r, ry = y / r
        const vr = vx * rx + vy * ry
        if (vr > 0) { vx -= vr * rx; vy -= vr * ry }
        x = L * rx; y = L * ry
        th = Math.atan2(x, -y)
        om = (vx * Math.cos(th) + vy * Math.sin(th)) / L
        mode = 'taut'
      }
    }
    t += h
  }
  return out
}

/**
 * Cadena de Verlet que dibuja la cuerda. Los dos extremos están fijados (pivote y masa).
 *  - Si los extremos están a la distancia máxima (la cuerda estirada del todo) la cuerda es una recta rígida.
 *  - Si están más cerca, la cuerda cuelga y se mueve con gravedad: se comba y oscila.
 */
export class RopeChain {
  readonly segments: number
  readonly length: number
  readonly x: Float64Array
  readonly y: Float64Array
  private px: Float64Array
  private py: Float64Array

  constructor(segments: number, length: number) {
    this.segments = segments
    this.length = length
    this.x = new Float64Array(segments + 1)
    this.y = new Float64Array(segments + 1)
    this.px = new Float64Array(segments + 1)
    this.py = new Float64Array(segments + 1)
  }

  /** Coloca la cuerda recta entre a y b (y sin velocidad). */
  reset(ax: number, ay: number, bx: number, by: number) {
    const n = this.segments
    for (let i = 0; i <= n; i++) {
      const s = i / n
      this.x[i] = this.px[i] = ax + (bx - ax) * s
      this.y[i] = this.py[i] = ay + (by - ay) * s
    }
  }

  /** Avanza dt segundos con gravedad `gravity` (unidades/s², hacia −y). */
  step(dt: number, gravity: number, ax: number, ay: number, bx: number, by: number, iterations = 16, damping = 0.992) {
    const n = this.segments, rest = this.length / n
    const d = Math.hypot(bx - ax, by - ay)
    if (d >= this.length * 0.9999) {                    // estirada al máximo: cuerpo rígido
      this.reset(ax, ay, bx, by)
      return
    }
    for (let i = 1; i < n; i++) {                       // integración de Verlet (los extremos están fijados)
      const vx = (this.x[i] - this.px[i]) * damping, vy = (this.y[i] - this.py[i]) * damping
      this.px[i] = this.x[i]; this.py[i] = this.y[i]
      this.x[i] += vx
      this.y[i] += vy - gravity * dt * dt
    }
    this.x[0] = this.px[0] = ax; this.y[0] = this.py[0] = ay
    this.x[n] = this.px[n] = bx; this.y[n] = this.py[n] = by
    for (let k = 0; k < iterations; k++) {              // restricciones de longitud entre nodos
      for (let i = 0; i < n; i++) {
        const dx = this.x[i + 1] - this.x[i], dy = this.y[i + 1] - this.y[i]
        const len = Math.hypot(dx, dy) || 1e-9
        const diff = (len - rest) / len
        const wA = i === 0 ? 0 : 0.5, wB = i + 1 === n ? 0 : 0.5
        const sum = wA + wB
        if (sum === 0) continue
        this.x[i] += dx * diff * (wA / sum); this.y[i] += dy * diff * (wA / sum)
        this.x[i + 1] -= dx * diff * (wB / sum); this.y[i + 1] -= dy * diff * (wB / sum)
      }
    }
  }

  /** Longitud actual sumando los segmentos (debe quedar cerca de `length`). */
  currentLength(): number {
    let s = 0
    for (let i = 0; i < this.segments; i++) s += Math.hypot(this.x[i + 1] - this.x[i], this.y[i + 1] - this.y[i])
    return s
  }
}
