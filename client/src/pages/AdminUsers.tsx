import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { setDocumentTitle } from '../lib/documentTitle'

type AppUserRow = {
  id: number
  username: string
  displayName: string
  role: Role
  email?: string | null
  updatedAt: string
}

const ROLES: Role[] = ['chairman', 'lead', 'analyst', 'viewer']

export function AdminUsers() {
  const { token, user } = useAuth()
  const { show: notify } = useNotify()
  const [items, setItems] = useState<AppUserRow[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [newUsername, setNewUsername] = useState('')
  const [newDisplay, setNewDisplay] = useState('')
  const [newRole, setNewRole] = useState<Role>('analyst')
  const [newPassword, setNewPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [createAuditNote, setCreateAuditNote] = useState('')

  const [editing, setEditing] = useState<AppUserRow | null>(null)
  const [editDisplay, setEditDisplay] = useState('')
  const [editRole, setEditRole] = useState<Role>('analyst')
  const [editPassword, setEditPassword] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAuditNote, setEditAuditNote] = useState('')

  const [pendingDelete, setPendingDelete] = useState<AppUserRow | null>(null)
  const [deleteAuditNote, setDeleteAuditNote] = useState('')

  const load = useCallback(async () => {
    setLoadErr(null)
    try {
      const r = await apiFetch<{ items: AppUserRow[] }>('/api/admin/app-users', { token })
      setItems(r.items)
    } catch (e) {
      setLoadErr((e as Error).message)
      setItems([])
    }
  }, [token])

  useEffect(() => {
    setDocumentTitle('Team users')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await apiFetch('/api/admin/app-users', {
        method: 'POST',
        token,
        body: JSON.stringify({
          username: newUsername.trim(),
          displayName: newDisplay.trim() || newUsername.trim(),
          role: newRole,
          password: newPassword,
          email: newEmail.trim() || undefined,
          changeNote: createAuditNote.trim() || undefined,
        }),
      })
      notify('User created.', 'success')
      setNewUsername('')
      setNewDisplay('')
      setNewPassword('')
      setNewEmail('')
      setNewRole('analyst')
      setCreateAuditNote('')
      await load()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function confirmRemoveUser() {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await apiFetch(`/api/admin/app-users/${encodeURIComponent(pendingDelete.username)}`, {
        method: 'DELETE',
        token,
        body: JSON.stringify({ changeNote: deleteAuditNote.trim() || undefined }),
      })
      notify('User removed.', 'info')
      setPendingDelete(null)
      setDeleteAuditNote('')
      await load()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function openEdit(row: AppUserRow) {
    setEditing(row)
    setEditDisplay(row.displayName)
    setEditRole(row.role)
    setEditPassword('')
    setEditAuditNote('')
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    try {
      const body: { displayName: string; role: Role; password?: string; email?: string | null } = {
        displayName: editDisplay.trim(),
        role: editRole,
        email: editEmail.trim() || null,
      }
      if (editPassword.trim().length >= 10) body.password = editPassword.trim()
      await apiFetch(`/api/admin/app-users/${encodeURIComponent(editing.username)}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ ...body, changeNote: editAuditNote.trim() || undefined }),
      })
      notify('User updated.', 'success')
      setEditing(null)
      await load()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        eyebrow="Administration"
        title="Team users"
        description="Manage sign-in accounts stored in SQLite (family office lead only). Requires FAMILY_OFFICE_AUTH=sqlite on the server. Creates, edits, and removals are written to the audit trail with optional context you add below (for example principal name or onboarding ticket)."
        actions={
          <Link
            to="/audit"
            className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
          >
            Audit trail
          </Link>
        }
      />

      {loadErr ? (
        <div role="alert" className="rounded-xl border border-fo-amber/40 bg-fo-amber/10 px-4 py-3 text-sm text-zinc-200">
          {loadErr}
          <p className="mt-2 text-xs text-zinc-500">
            If you are not using SQLite auth, use the seed script or environment JSON instead — see README.
          </p>
        </div>
      ) : null}

      {!loadErr ? (
        <form onSubmit={submitCreate} className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 space-y-4">
          <h2 className="text-sm font-medium text-white">Add user</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500" htmlFor="nu-username">
                Username
              </label>
              <input
                id="nu-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500" htmlFor="nu-display">
                Display name
              </label>
              <input
                id="nu-display"
                value={newDisplay}
                onChange={(e) => setNewDisplay(e.target.value)}
                disabled={busy}
                placeholder="Defaults to username"
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500" htmlFor="nu-role">
                Role
              </label>
              <select
                id="nu-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                disabled={busy}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500" htmlFor="nu-pw">
                Initial password (10+ chars)
              </label>
              <input
                id="nu-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500" htmlFor="nu-email">
                Email (for task & communication alerts)
              </label>
              <input
                id="nu-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
                autoComplete="email"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500" htmlFor="nu-audit-note">
              Audit note (optional)
            </label>
            <textarea
              id="nu-audit-note"
              value={createAuditNote}
              onChange={(e) => setCreateAuditNote(e.target.value)}
              disabled={busy}
              rows={2}
              maxLength={500}
              placeholder="Shown in Audit trail with this change — e.g. who requested access and why."
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold resize-y min-h-[2.5rem]"
            />
          </div>
          <button
            type="submit"
            disabled={busy || newUsername.trim().length < 3 || newPassword.length < 10}
            className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:opacity-40 focus-ring-inset"
          >
            Create user
          </button>
        </form>
      ) : null}

      {!loadErr && items.length > 0 ? (
        <div className="rounded-2xl border border-fo-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-fo-panel text-left text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Display</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 hidden lg:table-cell">Email</th>
                <th className="px-4 py-3 hidden md:table-cell">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fo-border">
              {items.map((row) => (
                <tr key={row.id} className="bg-fo-graphite/30">
                  <td className="px-4 py-3 font-mono text-zinc-300">{row.username}</td>
                  <td className="px-4 py-3 text-white">{row.displayName}</td>
                  <td className="px-4 py-3 text-zinc-400 uppercase text-xs">{row.role}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">{row.email || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">{row.updatedAt}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEdit(row)}
                      className="text-xs text-fo-gold-soft hover:underline disabled:opacity-40"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy || row.username === user?.username}
                      title={row.username === user?.username ? 'Cannot remove your own account here' : undefined}
                      onClick={() => {
                        setPendingDelete(row)
                        setDeleteAuditNote('')
                      }}
                      className="text-xs text-fo-red/90 hover:underline disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal>
          <form
            onSubmit={submitEdit}
            className="w-full max-w-md rounded-2xl border border-fo-border bg-fo-graphite p-6 space-y-4 shadow-xl"
          >
            <div className="text-white font-medium">Edit {editing.username}</div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Display name</label>
              <input
                value={editDisplay}
                onChange={(e) => setEditDisplay(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as Role)}
                disabled={busy}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">New password (optional, 10+ chars)</label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                disabled={busy}
                placeholder="Leave blank to keep current"
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Audit note (optional)</label>
              <textarea
                value={editAuditNote}
                onChange={(e) => setEditAuditNote(e.target.value)}
                disabled={busy}
                rows={2}
                maxLength={500}
                placeholder="Stored with this update in Audit trail."
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold resize-y min-h-[2.5rem]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
                className="rounded-md border border-fo-border px-4 py-2 text-sm text-zinc-300 hover:bg-fo-panel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !editDisplay.trim()}
                className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-2xl border border-fo-border bg-fo-graphite p-6 space-y-4 shadow-xl">
            <div className="text-white font-medium">Remove user {pendingDelete.username}?</div>
            <p className="text-sm text-zinc-400">
              They will no longer be able to sign in. This is recorded in the audit trail with the details below.
            </p>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Audit note (optional)</label>
              <textarea
                value={deleteAuditNote}
                onChange={(e) => setDeleteAuditNote(e.target.value)}
                disabled={busy}
                rows={2}
                maxLength={500}
                placeholder="e.g. offboarding date or principal request."
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold resize-y min-h-[2.5rem]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPendingDelete(null)
                  setDeleteAuditNote('')
                }}
                className="rounded-md border border-fo-border px-4 py-2 text-sm text-zinc-300 hover:bg-fo-panel"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmRemoveUser()}
                className="rounded-md bg-fo-red/90 px-4 py-2 text-sm font-medium text-white hover:bg-fo-red disabled:opacity-40"
              >
                Remove user
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
