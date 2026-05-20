import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'

type MfaStatus = { available: boolean; enabled: boolean; policyApplies: boolean }

type SetupPayload = {
  secret: string
  otpauthUrl: string
  qrUrl: string
  issuer: string
  accountName: string
}

export function MfaSettings() {
  const { token } = useAuth()
  const { show: notify } = useNotify()
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [setup, setSetup] = useState<SetupPayload | null>(null)
  const [confirmCode, setConfirmCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function loadStatus() {
    try {
      const r = await apiFetch<MfaStatus>('/api/auth/mfa/status', { token })
      setStatus(r)
    } catch {
      setStatus({ available: false, enabled: false, policyApplies: false })
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [token])

  async function startSetup() {
    setErr(null)
    setRecoveryCodes(null)
    setBusy(true)
    try {
      const r = await apiFetch<SetupPayload>('/api/auth/mfa/setup', { method: 'POST', token })
      setSetup(r)
      setConfirmCode('')
    } catch (e) {
      setErr((e as Error).message || 'Could not start MFA setup.')
    } finally {
      setBusy(false)
    }
  }

  async function enableMfa(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const r = await apiFetch<{ ok: boolean; recoveryCodes: string[] }>('/api/auth/mfa/enable', {
        method: 'POST',
        token,
        body: JSON.stringify({ code: confirmCode }),
      })
      setRecoveryCodes(r.recoveryCodes)
      setSetup(null)
      setConfirmCode('')
      await loadStatus()
      notify('Two-factor authentication is now enabled.', 'success')
    } catch (e) {
      setErr((e as Error).message || 'Could not enable MFA.')
    } finally {
      setBusy(false)
    }
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await apiFetch('/api/auth/mfa/disable', {
        method: 'POST',
        token,
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      })
      setDisablePassword('')
      setDisableCode('')
      setSetup(null)
      setRecoveryCodes(null)
      await loadStatus()
      notify('Two-factor authentication has been turned off.', 'success')
    } catch (e) {
      setErr((e as Error).message || 'Could not disable MFA.')
    } finally {
      setBusy(false)
    }
  }

  if (!status?.available) {
    return (
      <div className="rounded-2xl border border-fo-border bg-fo-panel/30 p-5 text-sm text-zinc-400 leading-relaxed">
        Two-factor authentication is available for lead and analyst accounts when the server uses{' '}
        <code className="text-zinc-500">FAMILY_OFFICE_AUTH=sqlite</code>.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-white">Two-factor authentication</h2>
        <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
          Protect sign-in with a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, etc.).
          Required at login once enabled.
        </p>
      </div>

      {status.enabled ? (
        <p className="text-sm text-fo-gold-soft">MFA is enabled on your account.</p>
      ) : (
        <p className="text-sm text-zinc-400">MFA is not enabled yet.</p>
      )}

      {recoveryCodes ? (
        <div className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 p-4 space-y-2">
          <p className="text-sm font-medium text-fo-amber">Save these recovery codes</p>
          <p className="text-xs text-zinc-500">
            Each code works once if you lose your phone. Store them securely offline — they will not be shown again.
          </p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-zinc-200">
            {recoveryCodes.map((c) => (
              <li key={c} className="rounded bg-fo-panel px-2 py-1">
                {c}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-xs text-fo-gold-soft hover:underline"
            onClick={() => setRecoveryCodes(null)}
          >
            I have saved these codes
          </button>
        </div>
      ) : null}

      {setup && !status.enabled ? (
        <form onSubmit={enableMfa} className="space-y-4 border-t border-fo-border pt-4">
          <p className="text-xs text-zinc-500">Scan the QR code or enter the secret manually, then confirm with a live code.</p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <img src={setup.qrUrl} alt="Authenticator QR code" className="rounded-md border border-fo-border bg-white p-2 w-[200px] h-[200px]" />
            <div className="min-w-0 flex-1 space-y-2 text-xs">
              <p className="text-zinc-500">Manual entry</p>
              <p className="font-mono text-sm text-zinc-200 break-all select-all">{setup.secret}</p>
              <p className="text-zinc-600">
                {setup.issuer} · {setup.accountName}
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="mfa-enable-code" className="mb-1 block text-xs text-zinc-500">
              6-digit code from app
            </label>
            <input
              id="mfa-enable-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={busy}
              className="w-full max-w-xs rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm tracking-widest outline-none focus:border-fo-gold disabled:opacity-40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || confirmCode.length !== 6}
              className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:opacity-40 focus-ring-inset"
            >
              {busy ? 'Enabling…' : 'Enable MFA'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setSetup(null)}
              className="rounded-md border border-fo-border px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {!setup && !status.enabled ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void startSetup()}
          className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:opacity-40 focus-ring-inset"
        >
          {busy ? 'Starting…' : 'Set up authenticator'}
        </button>
      ) : null}

      {status.enabled ? (
        <form onSubmit={disableMfa} className="space-y-3 border-t border-fo-border pt-4">
          <p className="text-xs text-zinc-500">Disable MFA with your password and a current authenticator or recovery code.</p>
          <div>
            <label htmlFor="mfa-disable-pw" className="mb-1 block text-xs text-zinc-500">
              Password
            </label>
            <input
              id="mfa-disable-pw"
              type="password"
              autoComplete="current-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold disabled:opacity-40"
            />
          </div>
          <div>
            <label htmlFor="mfa-disable-code" className="mb-1 block text-xs text-zinc-500">
              Authenticator or recovery code
            </label>
            <input
              id="mfa-disable-code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              disabled={busy}
              className="w-full max-w-xs rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold disabled:opacity-40"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !disablePassword || !disableCode}
            className="rounded-md border border-fo-red/40 px-4 py-2 text-sm text-fo-red hover:bg-fo-red/10 disabled:opacity-40"
          >
            {busy ? 'Disabling…' : 'Disable MFA'}
          </button>
        </form>
      ) : null}

      {err ? (
        <p role="alert" className="text-sm text-fo-red">
          {err}
        </p>
      ) : null}
    </div>
  )
}
