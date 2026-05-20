import { notifyApiUnauthorized } from './api'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function vaultFileDownloadPath(fileId: number, inline = false): string {
  const q = inline ? '?inline=1' : ''
  return `/api/vault/files/${fileId}/download${q}`
}

export function formatFileBytes(n: number): string {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export async function downloadVaultFile(
  token: string | null,
  fileId: number,
  filename: string,
  onSuccess?: () => void
) {
  if (!token) throw new Error('Not signed in')
  const path = vaultFileDownloadPath(fileId, false)
  const res = await fetch(`${API_BASE}${path}`, {
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
  a.download = filename || 'document'
  a.click()
  URL.revokeObjectURL(url)
  onSuccess?.()
}

export async function openVaultFileInTab(token: string | null, fileId: number) {
  if (!token) throw new Error('Not signed in')
  const path = vaultFileDownloadPath(fileId, true)
  const res = await fetch(`${API_BASE}${path}`, {
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
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    URL.revokeObjectURL(url)
    throw new Error('Allow pop-ups to open the file, or use Download instead.')
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
}
