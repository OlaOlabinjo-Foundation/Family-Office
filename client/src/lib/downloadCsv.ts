import { notifyApiUnauthorized } from './api'

export type CsvDownloadOpts = {
  onSuccess?: () => void
}

export async function downloadExportCsv(
  token: string | null,
  table: string,
  opts?: CsvDownloadOpts & { filename?: string }
) {
  const filename = opts?.filename ?? `${table}.csv`
  return downloadApiCsv(token, `/api/export/${encodeURIComponent(table)}`, filename, opts)
}

/** GET any `/api/...` path that returns CSV (e.g. `/api/export/audit?limit=500`). */
export async function downloadApiCsv(
  token: string | null,
  apiPath: string,
  filename: string,
  opts?: CsvDownloadOpts
) {
  if (!token) throw new Error('Not signed in')
  const path = apiPath.startsWith('/api') ? apiPath : `/api/${apiPath}`
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    notifyApiUnauthorized(res.status, token, path)
    let msg = res.statusText
    try {
      const j = (await res.json()) as { error?: string }
      msg = j.error || msg
    } catch {
      try {
        msg = await res.text()
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  opts?.onSuccess?.()
}
