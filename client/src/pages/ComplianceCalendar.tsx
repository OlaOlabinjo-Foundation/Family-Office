import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { setDocumentTitle } from '../lib/documentTitle'

type CalendarItem = {
  id: number
  title: string
  category: string
  entity: string | null
  dueDate: string
  recurrence: string
  status: string
  owner: string | null
  notes: string | null
  daysUntil: number | null
  overdue: boolean
  dueSoon: boolean
}

type ListPayload = {
  items: CalendarItem[]
  total: number
}

const CATEGORIES = ['KYC', 'Regulatory filing', 'Tax', 'Corporate', 'Other'] as const
const RECURRENCE = ['none', 'annual', 'quarterly'] as const

const EMPTY_DRAFT = {
  title: '',
  category: 'KYC' as (typeof CATEGORIES)[number],
  entity: '',
  dueDate: '',
  recurrence: 'annual' as (typeof RECURRENCE)[number],
  owner: '',
  notes: '',
}

export function ComplianceCalendar() {
  const { token, canWrite } = useAuth()
  const { show: notify } = useNotify()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') || 'all') as 'all' | 'overdue' | 'upcoming'
  const status = (searchParams.get('status') || 'pending') as 'pending' | 'completed' | 'all'
  const highlightId = useMemo(() => {
    const n = parseInt(searchParams.get('highlight') || '', 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [searchParams])

  const [items, setItems] = useState<CalendarItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDocumentTitle('Compliance calendar')
  }, [])

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ view, status, limit: '200', offset: '0' })
    const r = await apiFetch<ListPayload>(`/api/compliance/calendar?${qs.toString()}`, { token })
    setItems(r.items)
    setTotal(r.total)
  }, [token, view, status])

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        await load()
      } catch (e) {
        if (!c) setErr((e as Error).message)
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [load])

  function setFilter(nextView: typeof view, nextStatus: typeof status) {
    const p = new URLSearchParams(searchParams)
    if (nextView === 'all') p.delete('view')
    else p.set('view', nextView)
    if (nextStatus === 'pending') p.delete('status')
    else p.set('status', nextStatus)
    setSearchParams(p)
  }

  function openCreate() {
    setEditId(null)
    setDraft(EMPTY_DRAFT)
    setFormOpen(true)
  }

  function openEdit(item: CalendarItem) {
    setEditId(item.id)
    setDraft({
      title: item.title,
      category: (CATEGORIES.includes(item.category as (typeof CATEGORIES)[number])
        ? item.category
        : 'Other') as (typeof CATEGORIES)[number],
      entity: item.entity || '',
      dueDate: item.dueDate || '',
      recurrence: (RECURRENCE.includes(item.recurrence as (typeof RECURRENCE)[number])
        ? item.recurrence
        : 'none') as (typeof RECURRENCE)[number],
      owner: item.owner || '',
      notes: item.notes || '',
    })
    setFormOpen(true)
  }

  async function saveItem() {
    if (!canWrite) return
    setSaving(true)
    try {
      const body = {
        title: draft.title,
        category: draft.category,
        entity: draft.entity,
        dueDate: draft.dueDate,
        recurrence: draft.recurrence,
        owner: draft.owner,
        notes: draft.notes,
      }
      if (editId) {
        await apiFetch(`/api/compliance/calendar/${editId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(body),
        })
        notify('Calendar item updated.', 'success')
      } else {
        const created = await apiFetch<CalendarItem>('/api/compliance/calendar', {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        })
        notify('Calendar item added.', 'success')
        const p = new URLSearchParams(searchParams)
        p.set('highlight', String(created.id))
        setSearchParams(p)
      }
      setFormOpen(false)
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function completeItem(id: number) {
    if (!canWrite) return
    setBusyId(id)
    try {
      const updated = await apiFetch<CalendarItem>(`/api/compliance/calendar/${id}/complete`, {
        method: 'POST',
        token,
      })
      notify(
        updated.status === 'pending'
          ? 'Marked complete — next due date scheduled (recurring).'
          : 'Marked complete.',
        'success'
      )
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function reopenItem(id: number) {
    if (!canWrite) return
    setBusyId(id)
    try {
      await apiFetch(`/api/compliance/calendar/${id}/reopen`, { method: 'POST', token })
      notify('Item reopened.', 'success')
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteItem(id: number) {
    if (!canWrite) return
    if (!window.confirm('Delete this calendar item permanently?')) return
    setBusyId(id)
    try {
      await apiFetch(`/api/compliance/calendar/${id}`, { method: 'DELETE', token })
      notify('Item removed.', 'success')
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-6 max-w-5xl">
      <PageHeader
        eyebrow="Compliance"
        title="Compliance calendar"
        description="Recurring filings, KYC refresh, and attestations — separate from the document tracker. Overdue items surface on the Command Centre and task inbox."
        actions={
          <section className="flex flex-wrap gap-2">
            {canWrite ? (
              <button
                type="button"
                onClick={openCreate}
                disabled={formOpen}
                className="rounded-lg bg-fo-gold px-4 py-2 text-xs font-medium uppercase tracking-wider text-fo-black hover:opacity-90 disabled:opacity-40 focus-ring-inset"
              >
                Add item
              </button>
            ) : null}
            <Link
              to="/documents"
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Document tracker
            </Link>
          </section>
        }
      />

      <section className="flex flex-wrap gap-2 text-sm">
        {(['all', 'overdue', 'upcoming'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v, status)}
            className={`rounded-lg px-3 py-1.5 capitalize ${view === v ? 'bg-fo-gold/20 text-fo-gold-soft' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {v === 'all' ? 'All pending window' : v}
          </button>
        ))}
        <span className="text-zinc-600 px-1">|</span>
        {(['pending', 'completed', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(view, s)}
            className={`rounded-lg px-3 py-1.5 capitalize ${status === s ? 'bg-fo-panel text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {s}
          </button>
        ))}
      </section>

      {!canWrite ? (
        <p role="status" className="text-sm text-zinc-500">
          Read-only — lead or analyst can add and complete calendar items.
        </p>
      ) : null}

      {formOpen ? (
        <section className="rounded-xl border border-fo-gold/30 bg-fo-gold/5 p-4 space-y-3">
          <h2 className="text-sm font-medium text-fo-gold-soft">
            {editId ? 'Edit item' : 'New calendar item'}
          </h2>
          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Title *
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Category
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, category: e.target.value as (typeof CATEGORIES)[number] }))
                }
                className="mt-1 w-full rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-sm text-zinc-100"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Due date *
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Entity
              <input
                value={draft.entity}
                onChange={(e) => setDraft((d) => ({ ...d, entity: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Recurrence
              <select
                value={draft.recurrence}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, recurrence: e.target.value as (typeof RECURRENCE)[number] }))
                }
                className="mt-1 w-full rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-sm text-zinc-100"
              >
                {RECURRENCE.map((r) => (
                  <option key={r} value={r}>
                    {r === 'none' ? 'One-off' : r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Owner
              <input
                value={draft.owner}
                onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Notes
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          </section>
          <section className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={saveItem}
              className="rounded-lg bg-fo-gold px-4 py-2 text-xs uppercase tracking-wider text-fo-black disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-fo-border px-4 py-2 text-xs uppercase tracking-wider text-zinc-400"
            >
              Cancel
            </button>
          </section>
        </section>
      ) : null}

      {loading ? <LoadingBlock label="Loading calendar…" /> : null}
      {err ? (
        <p role="alert" className="text-sm text-fo-red">
          {err}
        </p>
      ) : null}

      {!loading && !err ? (
        <p className="text-sm text-zinc-500">
          Showing <strong className="text-zinc-300">{items.length}</strong> of {total} items
        </p>
      ) : null}

      {!loading && !err ? (
        <section className="overflow-x-auto rounded-xl border border-fo-border bg-fo-panel">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-fo-border ${highlightId === item.id ? 'bg-fo-gold/10' : ''}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={item.overdue ? 'text-fo-red font-medium' : item.dueSoon ? 'text-fo-amber' : ''}>
                      {item.dueDate}
                    </span>
                    {item.status === 'pending' && item.daysUntil != null ? (
                      <span className="block text-[10px] text-zinc-500">
                        {item.daysUntil < 0
                          ? `${Math.abs(item.daysUntil)}d overdue`
                          : item.daysUntil === 0
                            ? 'Due today'
                            : `In ${item.daysUntil}d`}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-medium text-zinc-100">{item.title}</td>
                  <td className="px-3 py-2 text-zinc-400">{item.category}</td>
                  <td className="px-3 py-2 text-zinc-400">{item.entity || '—'}</td>
                  <td className="px-3 py-2 text-zinc-400">{item.owner || '—'}</td>
                  <td className="px-3 py-2 capitalize text-zinc-400">{item.status}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <section className="flex flex-wrap gap-2">
                      {canWrite && item.status === 'pending' ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          className="text-xs text-emerald-400 hover:underline disabled:opacity-40"
                          onClick={() => completeItem(item.id)}
                        >
                          Complete
                        </button>
                      ) : null}
                      {canWrite && item.status === 'completed' ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          className="text-xs text-fo-gold hover:underline disabled:opacity-40"
                          onClick={() => reopenItem(item.id)}
                        >
                          Reopen
                        </button>
                      ) : null}
                      {canWrite ? (
                        <button
                          type="button"
                          disabled={busyId === item.id || formOpen}
                          className="text-xs text-zinc-500 hover:text-fo-gold-soft disabled:opacity-40"
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {canWrite ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          className="text-xs text-zinc-600 hover:text-fo-red disabled:opacity-40"
                          onClick={() => deleteItem(item.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </section>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                    No items in this view.{' '}
                    {canWrite ? (
                      <button type="button" className="text-fo-gold-soft underline" onClick={openCreate}>
                        Add the first item
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </section>
  )
}
