import { useEffect, useRef, useState } from 'react'
import { apiHeaders } from '../../lib/api'

/**
 * Pide una figura al servidor y devuelve una URL de imagen. Se redibuja sola cuando cambia la consulta.
 * - Espera `delay` ms tras el último cambio (para no pedir una figura por cada pixel del deslizador).
 * - Cancela la petición anterior y mantiene la imagen previa visible mientras llega la nueva.
 */
export function useFigure(path: string, query: Record<string, string | number>, enabled = true, delay = 220) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = useRef<string | null>(null)
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()

  useEffect(() => {
    if (!enabled) return
    const ctl = new AbortController()
    setBusy(true)
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/figures/${path}?${qs}`, { headers: apiHeaders(), signal: ctl.signal })
        if (!r.ok) throw new Error(r.status === 501 ? 'El servidor no tiene las dependencias de figuras (uv sync).' : `Error ${r.status}`)
        const next = URL.createObjectURL(await r.blob())
        if (last.current) URL.revokeObjectURL(last.current)
        last.current = next
        setUrl(next)
        setError(null)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message)
      } finally {
        if (!ctl.signal.aborted) setBusy(false)
      }
    }, delay)
    return () => { clearTimeout(id); ctl.abort() }
  }, [path, qs, enabled, delay])

  useEffect(() => () => { if (last.current) URL.revokeObjectURL(last.current) }, [])
  return { url, busy, error }
}
