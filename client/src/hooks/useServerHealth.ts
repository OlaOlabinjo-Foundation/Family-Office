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
  const [offlineReason, setOfflineReason] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, {
          credentials: USE_SESSION_COOKIE ? 'include' : 'same-origin',
        })
        const ct = res.headers.get('content-type') || ''
        let body: {
          version?: string
          auth?: HealthAuth
          error?: string
          hint?: string
          detail?: string
          ok?: boolean
        } = {}
        if (ct.includes('application/json')) {
          body = (await res.json().catch(() => ({}))) as typeof body
        } else {
          const text = await res.text().catch(() => '')
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error(
              'This deployment has no /api proxy. In Vercel set Root Directory to the repo root (.) or to client (which includes client/api), then redeploy.'
            )
          }
          throw new Error(text.slice(0, 200) || res.statusText || 'Health check failed')
        }
        if (!res.ok) {
          throw new Error(
            [body.hint, body.error, body.detail].filter(Boolean).join(' — ') || res.statusText || 'Health check failed'
          )
        }
        if (body.ok === false) {
          throw new Error(
            [body.hint, body.error, body.detail].filter(Boolean).join(' — ') || 'API reported not ready'
          )
        }
        if (c) return
        setApiOnline(true)
        setOfflineReason(null)
        if (typeof body.version === 'string' && body.version.length) setVersion(body.version)
        setAuth(body.auth ?? null)
        const cs = body.auth?.credentialStore
        if (cs === 'env' || cs === 'sqlite' || cs === 'demo') setCredentialStore(cs)
        else if (body.auth?.userSource === 'configured') setCredentialStore('env')
        else setCredentialStore('demo')
      } catch (e) {
        if (!c) {
          setApiOnline(false)
          setVersion(null)
          setAuth(null)
          setCredentialStore('demo')
          setOfflineReason(e instanceof Error ? e.message : 'Cannot reach /api/health')
        }
      }
    })()
    return () => {
      c = true
    }
  }, [])

  return { version, credentialStore, auth, apiOnline, offlineReason }
}
