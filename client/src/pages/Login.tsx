import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../context/AuthContext'
import { useServerHealth } from '../hooks/useServerHealth'
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
  const { version: serverVersion, credentialStore, apiOnline } = useServerHealth()
  const nav = useNavigate()
  const loc = useLocation()
  const [username, setUsername] = useState('lead')
  const [password, setPassword] = useState('demo')
  const [step, setStep] = useState<'password' | 'mfa' | 'enroll'>('password')
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [enrollCode, setEnrollCode] = useState('')
  const [enrollQr, setEnrollQr] = useState<string | null>(null)
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [mfaUserLabel, setMfaUserLabel] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) return
    setDocumentTitle('Sign in')
  }, [token])

  useEffect(() => {
    if (step !== 'enroll' || !enrollmentToken || enrollQr) return
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await apiFetch<{ qrUrl: string; secret: string }>('/api/auth/mfa/enrollment/setup', {
          method: 'POST',
          body: JSON.stringify({ enrollmentToken }),
        })
        if (!c) {
          setEnrollQr(r.qrUrl)
          setEnrollSecret(r.secret)
        }
      } catch (e) {
        if (!c) setErr((e as Error).message)
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [step, enrollmentToken, enrollQr])

  if (token) return <Navigate to="/" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      if (step === 'enroll' && enrollmentToken) {
        const res = await apiFetch<{
          token: string
          user: { username: string; role: Role; displayName: string }
          recoveryCodes: string[]
        }>('/api/auth/mfa/enrollment/enable', {
          method: 'POST',
          body: JSON.stringify({ enrollmentToken, code: enrollCode }),
        })
        setRecoveryCodes(res.recoveryCodes)
        setSession(res.token, res.user)
        return
      }
      if (step === 'mfa' && mfaToken) {
        const res = await apiFetch<{
          token: string
          user: { username: string; role: Role; displayName: string }
        }>('/api/auth/mfa/verify', {
          method: 'POST',
          body: JSON.stringify({ mfaToken, code: mfaCode }),
        })
        setSession(res.token, res.user)
        nav('/')
        return
      }
      const res = await apiFetch<{
        token?: string
        mfaRequired?: boolean
        mfaToken?: string
        enrollmentRequired?: boolean
        enrollmentToken?: string
        user: { username: string; role: Role; displayName: string }
      }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      if (res.enrollmentRequired && res.enrollmentToken) {
        setEnrollmentToken(res.enrollmentToken)
        setMfaUserLabel(res.user.displayName || res.user.username)
        setEnrollCode('')
        setEnrollQr(null)
        setEnrollSecret(null)
        setRecoveryCodes(null)
        setStep('enroll')
        return
      }
      if (res.mfaRequired && res.mfaToken) {
        setMfaToken(res.mfaToken)
        setMfaUserLabel(res.user.displayName || res.user.username)
        setMfaCode('')
        setStep('mfa')
        return
      }
      if (res.mfaRequired) {
        throw new Error('Two-factor sign-in is required but the server response was incomplete. Try again or contact your administrator.')
      }
      if (res.enrollmentRequired) {
        throw new Error('MFA enrollment is required but the server response was incomplete. Try again or contact your administrator.')
      }
      if (!res.token) {
        throw new Error(
          credentialStore === 'sqlite'
            ? 'Sign-in failed. This server uses SQLite accounts — use the password set by your administrator (not demo), or ask the lead to reset your account.'
            : 'Sign-in failed. The API responded without a session — is the command centre API running and reachable?'
        )
      }
      setSession(res.token, res.user)
      nav('/')
    } catch (e) {
      const msg = (e as Error).message
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        setErr(
          'Cannot reach the command centre API. Start it with npm run dev (local) or set VITE_API_URL to your hosted API (Vercel/production).'
        )
      } else if (/too many/i.test(msg)) {
        setErr('Too many failed attempts from this address. Please wait about fifteen minutes, then try again.')
      } else if (/invalid credentials/i.test(msg)) {
        setErr(
          credentialStore === 'sqlite'
            ? 'Invalid username or password. Demo password demo only works in demo mode — this server uses SQLite accounts.'
            : msg
        )
      } else {
        setErr(msg || 'Sign-in failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  function backToPassword() {
    setStep('password')
    setMfaToken(null)
    setEnrollmentToken(null)
    setMfaCode('')
    setEnrollCode('')
    setEnrollQr(null)
    setEnrollSecret(null)
    setRecoveryCodes(null)
    setMfaUserLabel(null)
    setErr(null)
  }

  function continueAfterEnrollment() {
    nav('/')
  }

  return (
    <div className="relative min-h-screen min-h-[100dvh] overflow-hidden bg-fo-black flex items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
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

        {apiOnline === false ? (
          <div role="alert" className="mt-6 rounded-md border border-fo-red/40 bg-fo-red/10 px-3 py-2 text-sm text-fo-red leading-relaxed">
            <strong className="text-fo-red">API offline.</strong> This site cannot reach{' '}
            <code className="text-fo-red/90">/api/health</code>.
            {typeof window !== 'undefined' &&
            !/localhost|127\.0\.0\.1/.test(window.location.hostname) ? (
              <>
                {' '}
                On Vercel, set <code className="text-fo-red/90">COMMAND_CENTRE_API_URL</code> to your hosted API (e.g.
                Render) and redeploy — see README “Going live”. Locally, run{' '}
                <code className="text-fo-red/90">npm run dev</code>.
              </>
            ) : (
              <>
                {' '}
                Run <code className="text-fo-red/90">npm run dev</code> from the project folder (API on 8787, UI on 5173).
              </>
            )}
          </div>
        ) : null}

        {credentialStore === 'demo' && apiOnline !== false ? (
          <div className="mt-8">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Quick sign-in (demo)</div>
            <div className="flex flex-wrap gap-2">
              {DEMO_ROLES.map((r) => (
                <button
                  key={r.username}
                  type="button"
                  onClick={() => {
                    setUsername(r.username)
                    setPassword('demo')
                    setErr(null)
                  }}
                  className={`btn-touch rounded-full border px-3 text-xs transition-colors focus-ring-inset ${
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
        ) : apiOnline !== false ? (
          <p className="mt-8 text-xs text-zinc-500 leading-relaxed">
            This server uses{' '}
            <strong className="text-zinc-400">
              {credentialStore === 'sqlite' ? 'SQLite-stored accounts' : 'environment-configured accounts'}
            </strong>
            . Enter the username and password issued by your administrator (demo quick-picks are hidden).
          </p>
        ) : null}

        {recoveryCodes ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-fo-amber">Save these recovery codes — each works once if you lose your phone.</p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-zinc-200">
              {recoveryCodes.map((c) => (
                <li key={c} className="rounded bg-fo-panel px-2 py-1">
                  {c}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={continueAfterEnrollment}
              className="btn-touch w-full rounded-md bg-fo-gold text-sm font-semibold text-fo-black"
            >
              Continue to command centre
            </button>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          {step === 'enroll' ? (
            <>
              <p className="text-sm text-zinc-400">
                <span className="text-white">{mfaUserLabel}</span> — set up two-factor authentication before you can use the
                portal.
              </p>
              {enrollQr ? (
                <img src={enrollQr} alt="Authenticator QR" className="mx-auto rounded border border-fo-border bg-white p-2 w-[180px]" />
              ) : null}
              {enrollSecret ? (
                <p className="text-xs text-zinc-500 break-all font-mono text-center">{enrollSecret}</p>
              ) : null}
              <div>
                <label htmlFor="login-enroll-code" className="mb-1.5 block text-xs font-medium text-zinc-400">
                  6-digit code from app
                </label>
                <input
                  id="login-enroll-code"
                  inputMode="numeric"
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2.5 text-sm text-white tracking-widest outline-none focus:border-fo-gold"
                />
              </div>
              <button type="button" onClick={backToPassword} className="text-xs text-zinc-500 hover:text-zinc-300">
                ← Use a different account
              </button>
            </>
          ) : step === 'mfa' ? (
            <>
              <p className="text-sm text-zinc-400">
                Two-factor sign-in for <span className="text-white">{mfaUserLabel}</span>. Enter the 6-digit code from your
                authenticator app, or a recovery code.
              </p>
              <div>
                <label htmlFor="login-mfa-code" className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Authenticator code
                </label>
                <input
                  id="login-mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2.5 text-sm text-white tracking-widest outline-none focus:border-fo-gold"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, '').slice(0, 12))}
                  disabled={loading}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={backToPassword}
                disabled={loading}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                ← Use a different account
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
          {err ? (
            <div role="alert" className="rounded-md border border-fo-red/40 bg-fo-red/10 px-3 py-2 text-sm text-fo-red">
              {err}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={
              loading ||
              (step === 'mfa' && mfaCode.length < 6) ||
              (step === 'enroll' && enrollCode.length !== 6)
            }
            className="btn-touch w-full rounded-md bg-fo-gold text-sm font-semibold text-fo-black transition-colors hover:bg-fo-gold-soft disabled:cursor-not-allowed disabled:opacity-50 focus-ring-inset"
          >
            {loading
              ? 'Signing in…'
              : step === 'enroll'
                ? 'Enable MFA and sign in'
                : step === 'mfa'
                  ? 'Verify and enter'
                  : 'Enter command centre'}
          </button>
        </form>
        )}

        <p className="mt-8 border-t border-fo-border pt-6 text-center text-[11px] leading-relaxed text-zinc-500">
          {credentialStore === 'demo' ? (
            <>
              Demo accounts use password <span className="font-mono text-fo-gold-soft">demo</span>. For production use{' '}
              <code className="text-zinc-600">FAMILY_OFFICE_AUTH=sqlite</code> (with seeded users) or{' '}
              <code className="text-zinc-600">FAMILY_OFFICE_USERS_JSON</code>.
            </>
          ) : credentialStore === 'sqlite' ? (
            <>Passwords are stored as scrypt hashes in the SQLite database.</>
          ) : (
            <>Passwords are verified with scrypt hashes from the server environment configuration.</>
          )}{' '}
          {serverVersion ? <span className="text-zinc-600">API release {serverVersion}.</span> : null}
        </p>
      </div>
    </div>
  )
}
