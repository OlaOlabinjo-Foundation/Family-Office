import { useEffect, useState } from 'react'

import { apiFetch } from '../lib/api'

export type CredentialStore = 'demo' | 'env' | 'sqlite'

type HealthAuth = {
  mode?: string
  sessionSigned?: boolean
  credentialStore?: CredentialStore
  /** @deprecated use credentialStore */
  userSource?: 'demo' | 'configured'
}

/** Reads `GET /api/health` (no auth): version and deployment hints. */
export function useServerHealth() {
  const [version, setVersion] = useState<string | null>(null)
  const [credentialStore, setCredentialStore] = useState<CredentialStore>('demo')
  const [auth, setAuth] = useState<HealthAuth | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const h = await apiFetch<{ version?: string; auth?: HealthAuth }>('/api/health', {})
        if (c) return
        if (typeof h.version === 'string' && h.version.length) setVersion(h.version)
        setAuth(h.auth ?? null)
        const cs = h.auth?.credentialStore
        if (cs === 'env' || cs === 'sqlite' || cs === 'demo') setCredentialStore(cs)
        else if (h.auth?.userSource === 'configured') setCredentialStore('env')
        else setCredentialStore('demo')
      } catch {
        if (!c) {
          setVersion(null)
          setAuth(null)
          setCredentialStore('demo')
        }
      }
    })()
    return () => {
      c = true
    }
  }, [])

  return { version, credentialStore, auth }
}
