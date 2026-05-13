import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

/** Reads workspace `version` from `GET /api/health` (no auth). */
export function useServerVersion() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const h = await apiFetch<{ version?: string }>('/api/health', {})
        if (!c && typeof h.version === 'string' && h.version.length) setVersion(h.version)
      } catch {
        if (!c) setVersion(null)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  return version
}
