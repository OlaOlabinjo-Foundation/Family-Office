/** Returns a safe http(s) URL, or null if the value is not a browser-openable link. */
export function normalizeHttpUrl(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

export function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url
  return `${url.slice(0, max - 1)}…`
}
