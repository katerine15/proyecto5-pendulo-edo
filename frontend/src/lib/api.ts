/** Cabeceras comunes de la API (incluye la clave si se definió VITE_API_KEY). */
export function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const key = import.meta.env.VITE_API_KEY as string | undefined
  if (key) h['X-API-Key'] = key
  return h
}

/** Descarga un archivo de la API (respeta la clave, que un enlace simple no enviaría). */
export async function downloadFromApi(url: string, filename: string): Promise<void> {
  const r = await fetch(url, { headers: apiHeaders() })
  if (!r.ok) throw new Error(`${r.status}`)
  const blobUrl = URL.createObjectURL(await r.blob())
  const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
}
