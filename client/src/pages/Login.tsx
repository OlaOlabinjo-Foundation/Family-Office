import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../context/AuthContext'
import { useServerVersion } from '../hooks/useServerVersion'
import { apiFetch } from '../lib/api'
import { setDocumentTitle } from '../lib/documentTitle'

const DEMO_ROLES: { username: string; role: Role; label: string; hint: string }[] = [
  { username: 'chairman', role: 'chairman', label: 'Chairman', hint: 'Read-only' },
  { username: 'lead', role: 'lead', label: 'Lead', hint: 'Full write' },
  { username: 'analyst', role: 'analyst', label: 'Analyst', hint: 'Full write' },
  { username: 'viewer', role: 'viewer', label: 'Viewer', hint: 'Read-only' },
]

export function Login() {
  const { token, setSession } = useAuth()
  const serverVersion = useServerVersion()
  const nav = useNavigate()
  const loc = useLocation()
  const [username, setUsername] = useState('lead')
  const [password, setPassword] = useState('demo')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) return
    setDocumentTitle('Sign in')
  }, [token])

  if (token) return <Navigate to="/" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await apiFetch<{
        token: string
        user: { username: string; role: Role; displayName: string }
      }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      setSession(res.token, res.user)
      nav('/')
    } catch (e) {
      const msg = (e as Error).message
      if (/too many/i.test(msg)) {
        setErr('Too many failed attempts from this address. Please wait about fifteen minutes, then try again.')
      } else {
        setErr(msg || 'Sign-in failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-fo-black flex items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(rgba(212,175,55,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.2) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-2xl border border-fo-border bg-gradient-to-b from-fo-graphite to-fo-black p-8 shadow-2xl shadow-black/60 motion-safe:animate-[login-rise_0.35s_ease-out_both]">
        <div className="text-center">
          <div className="font-[family-name:var(--font-display)] text-3xl text-fo-gold md:text-4xl">Ola Olabinjo Investment</div>
          <p className="mt-2 text-[11px] uppercase tracking-[0.35em] text-zinc-500">Family Office Command Centre</p>
        </div>

        {loc.state && typeof loc.state === 'object' && 'reason' in loc.state && (loc.state as { reason?: string }).reason === 'session' ? (
          <div role="status" className="mt-6 rounded-md border border-fo-amber/40 bg-fo-amber/10 px-3 py-2 text-sm text-fo-amber">
            Your session ended. Sign in again to continue.
          </div>
        ) : null}

        <div className="mt-8">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Quick sign-in (demo)</div>
          <div className="flex flex-wrap gap-2">
            {DEMO_ROLES.map((r) => (
              <button
                key={r.username}
                type="button"
                onClick={() => {
                  setUsername(r.username)
                  setErr(null)
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors focus-ring-inset ${
                  username === r.username
                    ? 'border-fo-gold bg-fo-panel text-fo-gold-soft'
                    : 'border-fo-border text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
                aria-pressed={username === r.username}
              >
                {r.label}
                <span className="ml-1 text-[10px] text-zinc-600">· {r.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Username
            </label>
            <input
              id="login-username"
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2.5 text-sm text-white outline-none focus:border-fo-gold"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2.5 text-sm text-white outline-none focus:border-fo-gold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          {err ? (
            <div role="alert" className="rounded-md border border-fo-red/40 bg-fo-red/10 px-3 py-2 text-sm text-fo-red">
              {err}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-fo-gold py-3 text-sm font-semibold text-fo-black transition-colors hover:bg-fo-gold-soft disabled:cursor-not-allowed disabled:opacity-50 focus-ring-inset"
          >
            {loading ? 'Signing in…' : 'Enter command centre'}
          </button>
        </form>

        <p className="mt-8 border-t border-fo-border pt-6 text-center text-[11px] leading-relaxed text-zinc-500">
          All demo accounts use password <span className="font-mono text-fo-gold-soft">demo</span>. This is mock authentication for
          development only — do not use for real data.
          {serverVersion ? (
            <>
              {' '}
              <span className="text-zinc-600">API release {serverVersion}.</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}
