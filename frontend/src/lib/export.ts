/** Descarga un CSV (UTF-8 con BOM para que Excel lo abra con tildes). */
export function downloadCsv(filename: string, header: string[], rows: (number | string)[][]) {
  const body = [header, ...rows].map((r) => r.join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Copia texto al portapapeles; devuelve false si el navegador lo impide. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
