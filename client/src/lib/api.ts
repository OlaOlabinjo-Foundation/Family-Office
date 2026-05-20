const API_BASE = import.meta.env.VITE_API_URL || ''

/** When `1`, session token is httpOnly cookie only — do not send Bearer from localStorage. */
export const USE_SESSION_COOKIE = import.meta.env.VITE_SESSION_COOKIE === '1'

export const COOKIE_SESSION_SENTINEL = '__cookie__'

let onUnauthorized: (() => void) | null = null

/** Called from `SessionGuard` to clear session when an authenticated API call returns 401. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

/** CSV/binary downloads that bypass `apiFetch` should call this on 401 with the same rules. */
export function notifyApiUnauthorized(status: number, token: string | null, path: string) {
  if (status === 401 && token && !path.includes('/api/auth/login')) {
    onUnauthorized?.()
  }
}

export async function apiFetch<T>(path: string, opts: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, ...rest } = opts
  const headers = new Headers(rest.headers)
  const isForm = typeof FormData !== 'undefined' && rest.body instanceof FormData
  if (!isForm && !headers.has('Content-Type') && rest.body && typeof rest.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  if (token && token !== COOKIE_SESSION_SENTINEL) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    credentials: USE_SESSION_COOKIE || rest.credentials === 'include' ? 'include' : 'same-origin',
  })

  if (res.status === 401) {
    const hadSession = Boolean(token)
    const isLogin = path.includes('/api/auth/login')
    const err = await res.json().catch(() => ({}))
    if (hadSession && !isLogin) {
      onUnauthorized?.()
    }
    throw new Error((err as { error?: string }).error || res.statusText)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<T>
}
