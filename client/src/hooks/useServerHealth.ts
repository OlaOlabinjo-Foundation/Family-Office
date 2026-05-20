import { useEffect, useState } from 'react'

import { USE_SESSION_COOKIE } from '../lib/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

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
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, {
          credentials: USE_SESSION_COOKIE ? 'include' : 'same-origin',
        })
        const body = (await res.json().catch(() => ({}))) as {
          version?: string
          auth?: HealthAuth
          error?: string
          hint?: string
        }
        if (!res.ok) {
          throw new Error(body.hint || body.error || res.statusText)
        }
        if (c) return
        setApiOnline(true)
        if (typeof body.version === 'string' && body.version.length) setVersion(body.version)
        setAuth(body.auth ?? null)
        const cs = body.auth?.credentialStore
        if (cs === 'env' || cs === 'sqlite' || cs === 'demo') setCredentialStore(cs)
        else if (body.auth?.userSource === 'configured') setCredentialStore('env')
        else setCredentialStore('demo')
      } catch {
        if (!c) {
          setApiOnline(false)
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

  return { version, credentialStore, auth, apiOnline }
}
