/** Valor interpolado linealmente de un arreglo muestreado uniformemente en [0, tMax]. */
export function sample(arr: number[], t: number, tMax: number): number {
  const f = (t / tMax) * (arr.length - 1)
  const i = Math.min(arr.length - 2, Math.max(0, Math.floor(f)))
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i)
}
