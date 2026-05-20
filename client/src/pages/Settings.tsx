import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { setDocumentTitle } from '../lib/documentTitle'
import { MfaSettings } from '../components/MfaSettings'

export function Settings() {
  const { token, user, canWrite, canViewAudit } = useAuth()
  const { show: notify } = useNotify()
  const [canChange, setCanChange] = useState(false)
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [canManageMfa, setCanManageMfa] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setDocumentTitle('Account')
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const r = await apiFetch<{ flags?: { canChangePassword?: boolean; canManageAppUsers?: boolean } }>('/api/me', { token })
        if (!c) {
          setCanChange(Boolean(r.flags?.canChangePassword))
          setCanManageUsers(Boolean(r.flags?.canManageAppUsers))
        }
      } catch {
        if (!c) {
          setCanChange(false)
          setCanManageUsers(false)
          setCanManageMfa(false)
        }
      }
    })()
    return () => {
      c = true
    }
  }, [token])

  async function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (newPassword !== confirmPassword) {
      setErr('New password and confirmation do not match.')
      return
    }
    setBusy(true)
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      notify('Password updated. Use your new password next time you sign in.', 'success')
    } catch (e) {
      setErr((e as Error).message || 'Could not update password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <PageHeader
        eyebrow="Signed in"
        title="Account"
        description="Session and password options for your user on this server."
      />

      <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6">
        <h2 className="text-sm font-medium text-white mb-2">Profile</h2>
        <p className="text-sm text-zinc-400">
          <span className="text-white">{user?.displayName}</span>
          <span className="text-zinc-500"> · </span>
          <span className="uppercase tracking-wider text-xs text-zinc-500">{user?.role}</span>
          <br />
          <span className="text-zinc-500 font-mono text-xs mt-1 inline-block">{user?.username}</span>
        </p>
        {canManageUsers ? (
          <p className="mt-3 text-sm">
            <Link to="/admin/users" className="text-fo-gold-soft hover:underline">
              Team users →
            </Link>
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6">
        <h2 className="text-sm font-medium text-white mb-2">Shortcuts</h2>
        <p className="text-xs text-zinc-500 mb-3">Jump back to common areas without opening the main menu.</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/" className="rounded-md border border-fo-border bg-fo-panel/50 px-3 py-1.5 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft">
            Command Centre
          </Link>
          <Link to="/help" className="rounded-md border border-fo-border bg-fo-panel/50 px-3 py-1.5 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft">
            Help
          </Link>
          <Link to="/reports" className="rounded-md border border-fo-border bg-fo-panel/50 px-3 py-1.5 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft">
            Reports
          </Link>
          <Link to="/search" className="rounded-md border border-fo-border bg-fo-panel/50 px-3 py-1.5 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft">
            Search
          </Link>
          {canWrite ? (
            <Link
              to="/import"
              className="rounded-md border border-fo-amber/25 bg-fo-amber/5 px-3 py-1.5 text-fo-amber hover:border-fo-gold/50"
            >
              Excel import
            </Link>
          ) : null}
          {canViewAudit ? (
            <Link to="/audit" className="rounded-md border border-fo-border bg-fo-panel/50 px-3 py-1.5 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft">
              Audit trail
            </Link>
          ) : null}
        </div>
      </div>

      {canManageMfa ? <MfaSettings /> : null}

      {canChange ? (
        <form onSubmit={submitPasswordChange} className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Change password</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            SQLite account store is active. Choose a strong password (at least 10 characters). You will need the new password after you sign
            out.
          </p>
          <div>
            <label htmlFor="cur-pw" className="mb-1 block text-xs text-zinc-500">
              Current password
            </label>
            <input
              id="cur-pw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold disabled:opacity-40"
            />
          </div>
          <div>
            <label htmlFor="new-pw" className="mb-1 block text-xs text-zinc-500">
              New password
            </label>
            <input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold disabled:opacity-40"
            />
          </div>
          <div>
            <label htmlFor="conf-pw" className="mb-1 block text-xs text-zinc-500">
              Confirm new password
            </label>
            <input
              id="conf-pw"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold disabled:opacity-40"
            />
          </div>
          {err ? (
            <p role="alert" className="text-sm text-fo-red">
              {err}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:opacity-40 focus-ring-inset"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-fo-border bg-fo-panel/30 p-5 text-sm text-zinc-400 leading-relaxed">
          Password changes from the app are only available when the server runs with{' '}
          <code className="text-zinc-500">FAMILY_OFFICE_AUTH=sqlite</code> and your account is stored in the{' '}
          <code className="text-zinc-500">app_users</code> table. Otherwise update credentials via your deployment configuration (JSON env or
          demo reset).
        </div>
      )}
    </div>
  )
}
