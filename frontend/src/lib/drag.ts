/**
 * Ángulo de suelta a partir de dónde está el puntero respecto del pivote, en el plano de oscilación.
 *
 * Se mide desde la vertical hacia abajo: 0° es colgando, +90° es horizontal a la derecha, −90° horizontal a la izquierda
 * y ±180° es justo encima del pivote. Se devuelve la magnitud (1° a 170°, lo que admite el modelo) y el lado (+1 derecha,
 * −1 izquierda) por separado, porque la física es simétrica: soltar a la izquierda es el espejo de soltar a la derecha.
 *
 * @param dx  puntero − pivote, horizontal (positivo a la derecha)
 * @param dy  puntero − pivote, vertical (positivo hacia arriba)
 */
export function dragRelease(dx: number, dy: number, maxDeg = 170): { magnitudeDeg: number; side: 1 | -1 } {
  const signedDeg = (Math.atan2(dx, -dy) * 180) / Math.PI // (−180°, 180°]
  return {
    magnitudeDeg: Math.max(1, Math.min(maxDeg, Math.round(Math.abs(signedDeg)))),
    side: signedDeg < 0 ? -1 : 1,
  }
}
