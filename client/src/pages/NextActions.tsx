import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { setDocumentTitle } from '../lib/documentTitle'

type TaskKind = 'decision' | 'compliance' | 'data_quality' | 'approval' | 'assigned'

type TaskItem = {
  id: string
  kind: TaskKind
  priority: string
  title: string
  detail: string
  owner: string
  dueDate: string | null
  href: string
  source: string
  decisionId?: string
  documentId?: number
  needsPortalReview?: boolean
  canResolve?: boolean
  count?: number
  assignedTaskId?: number
}

type InboxPayload = {
  generatedAt: string
  summary: {
    total: number
    openDecisions: number
    outstandingDocs: number
    byKind: { decision: number; compliance: number; data_quality: number }
  }
  items: TaskItem[]
}

const KIND_LABELS: Record<TaskKind, string> = {
  decision: 'Decisions',
  compliance: 'Compliance',
  data_quality: 'Data quality',
  approval: 'Approvals',
  assigned: 'Assigned',
}

const FILTER_ALL = 'all'

export function NextActions() {
  const { token, canWrite, user } = useAuth()
  const { show: notify } = useNotify()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<InboxPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [digestBusy, setDigestBusy] = useState(false)
  const [digestPreview, setDigestPreview] = useState<string | null>(null)

  const filter = (searchParams.get('kind') || FILTER_ALL) as TaskKind | typeof FILTER_ALL
  const focusId = useMemo(() => (searchParams.get('focus') || '').trim() || null, [searchParams])

  const load = useCallback(async () => {
    const r = await apiFetch<InboxPayload>('/api/tasks/inbox', { token })
    setData(r)
  }, [token])

  useEffect(() => {
    setDocumentTitle('Task inbox')
  }, [])

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

  const visible = useMemo(() => {
    if (!data) return []
    if (filter === FILTER_ALL) return data.items
    return data.items.filter((t) => t.kind === filter)
  }, [data, filter])

  useEffect(() => {
    if (!focusId || loading) return
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(focusId) : focusId
    const el = document.querySelector(`[data-task-id="${esc}"]`)
    if (!el || !(el instanceof HTMLElement)) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [focusId, loading, visible])

  async function completeAssignedTask(taskId: number) {
    const key = `task-assigned-${taskId}`
    setBusyId(key)
    try {
      await apiFetch(`/api/tasks/assigned/${taskId}/complete`, { method: 'POST', token })
      notify('Task marked complete.', 'success')
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function resolveDecision(decisionId: string) {
    setBusyId(decisionId)
    try {
      await apiFetch(`/api/decisions/${encodeURIComponent(decisionId)}/resolve`, { method: 'PATCH', token })
      notify('Decision marked resolved.', 'success')
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function previewDigest() {
    setDigestBusy(true)
    try {
      const r = await apiFetch<{ text: string }>('/api/tasks/digest/preview', { token })
      setDigestPreview(r.text)
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setDigestBusy(false)
    }
  }

  async function sendDigest() {
    setDigestBusy(true)
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      await apiFetch('/api/tasks/digest/send', {
        method: 'POST',
        token,
        body: JSON.stringify({ baseUrl }),
      })
      notify('Weekly digest email sent (if SMTP is configured).', 'success')
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setDigestBusy(false)
    }
  }

  const isLead = user?.role === 'lead'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Task inbox"
        description="One queue for open decisions, compliance verification, and data-quality follow-ups — sorted by priority. Resolve decisions here or jump to the register screen for each item."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/decisions"
              className="rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold"
            >
              Decision centre
            </Link>
            <Link
              to="/documents?outstanding=1"
              className="rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold"
            >
              Compliance
            </Link>
          </div>
        }
      />

      {data && !loading ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Open tasks</p>
            <p className="text-2xl font-display text-white tabular-nums">{data.summary.total}</p>
          </div>
          <div className="rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Decisions</p>
            <p className="text-2xl font-display text-fo-gold-soft tabular-nums">{data.summary.byKind.decision}</p>
          </div>
          <div className="rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Compliance</p>
            <p className="text-2xl font-display text-fo-amber tabular-nums">{data.summary.byKind.compliance}</p>
          </div>
          <div className="rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Data quality</p>
            <p className="text-2xl font-display text-zinc-300 tabular-nums">{data.summary.byKind.data_quality}</p>
          </div>
        </div>
      ) : null}

      <div
        className="inline-flex flex-wrap rounded-lg border border-fo-border bg-fo-black/40 p-0.5"
        role="tablist"
        aria-label="Filter tasks"
      >
        {[FILTER_ALL, 'decision', 'compliance', 'data_quality', 'approval', 'assigned'].map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={filter === k}
            onClick={() =>
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev)
                  if (k === FILTER_ALL) next.delete('kind')
                  else next.set('kind', k)
                  return next
                },
                { replace: true }
              )
            }
            className={`rounded-md px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
              filter === k ? 'bg-fo-panel text-fo-gold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {k === FILTER_ALL ? 'All' : KIND_LABELS[k as TaskKind]}
          </button>
        ))}
      </div>

      {canWrite ? (
        <AssignTaskForm token={token} onCreated={load} notify={notify} />
      ) : null}

      {isLead ? (
        <section className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-4 space-y-3">
          <h2 className="text-sm font-medium text-white">Weekly digest email</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Sends a plain-text summary of open tasks via SMTP. Configure <code className="text-zinc-400">SMTP_URL</code>,{' '}
            <code className="text-zinc-400">SMTP_FROM</code>, and <code className="text-zinc-400">SMTP_TO</code> or{' '}
            <code className="text-zinc-400">SMTP_DIGEST_TO</code> on the server. Optional:{' '}
            <code className="text-zinc-400">DIGEST_APP_BASE_URL</code> for clickable links.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={digestBusy}
              onClick={() => void previewDigest()}
              className="rounded border border-fo-border px-3 py-1.5 text-xs uppercase tracking-wide text-zinc-300 hover:text-fo-gold-soft disabled:opacity-40"
            >
              Preview text
            </button>
            <button
              type="button"
              disabled={digestBusy}
              onClick={() => void sendDigest()}
              className="rounded border border-fo-gold/40 bg-fo-gold/10 px-3 py-1.5 text-xs uppercase tracking-wide text-fo-gold-soft hover:bg-fo-gold/20 disabled:opacity-40"
            >
              {digestBusy ? '…' : 'Send digest now'}
            </button>
          </div>
          {digestPreview ? (
            <pre className="max-h-48 overflow-auto rounded-lg border border-fo-border bg-fo-black/50 p-3 text-[11px] text-zinc-400 whitespace-pre-wrap">
              {digestPreview}
            </pre>
          ) : null}
        </section>
      ) : null}

      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}
      {loading ? <LoadingBlock label="Loading task inbox…" /> : null}

      {!loading && !err && visible.length === 0 ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-8 text-center text-sm text-zinc-300">
          No open tasks in this view — checks are clear or filtered out.
        </p>
      ) : null}

      {!loading && !err && visible.length > 0 ? (
        <ul className="space-y-3">
          {visible.map((t) => (
            <li
              key={t.id}
              data-task-id={t.decisionId || t.id}
              className="rounded-2xl border border-fo-border bg-fo-graphite/50 p-4 md:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
                    <span className="rounded border border-fo-border px-1.5 py-0.5 text-zinc-500">{t.priority}</span>
                    <span className="text-fo-gold">{KIND_LABELS[t.kind]}</span>
                    <span className="text-zinc-600">{t.source}</span>
                  </div>
                  <h3 className="mt-2 font-medium text-white">{t.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{t.detail}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Owner: <span className="text-zinc-400">{t.owner}</span>
                    {t.dueDate ? (
                      <>
                        {' '}
                        · Due <span className="text-zinc-400">{t.dueDate}</span>
                      </>
                    ) : null}
                    {t.needsPortalReview ? (
                      <span className="ml-2 text-fo-amber">· Portal review pending</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    to={t.href}
                    className="rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-xs uppercase tracking-wider text-fo-gold-soft hover:border-fo-gold/50"
                  >
                    Open
                  </Link>
                  {canWrite && t.kind === 'assigned' && t.assignedTaskId ? (
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => void completeAssignedTask(t.assignedTaskId!)}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      {busyId === t.id ? '…' : 'Complete'}
                    </button>
                  ) : null}
                  {canWrite && t.canResolve && t.decisionId ? (
                    <button
                      type="button"
                      disabled={busyId === t.decisionId}
                      onClick={() => void resolveDecision(t.decisionId!)}
                      className="rounded-lg border border-fo-gold/40 bg-fo-gold/10 px-3 py-2 text-xs uppercase tracking-wider text-fo-gold-soft hover:bg-fo-gold/20 disabled:opacity-40"
                    >
                      {busyId === t.decisionId ? '…' : 'Resolve'}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function AssignTaskForm({
  token,
  onCreated,
  notify,
}: {
  token: string | null
  onCreated: () => Promise<void>
  notify: (message: string, variant: 'success' | 'error' | 'info') => void
}) {
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('Lead')
  const [detail, setDetail] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await apiFetch<{ item: { id: number }; mail: { sent: boolean } }>('/api/tasks/assigned', {
        method: 'POST',
        token,
        body: JSON.stringify({
          title: title.trim(),
          owner: owner.trim(),
          detail: detail.trim() || undefined,
          dueDate: dueDate || undefined,
          priority: 'P2',
        }),
      })
      setTitle('')
      setDetail('')
      setDueDate('')
      await onCreated()
      notify(
        r.mail.sent
          ? 'Task assigned and owner notified by email.'
          : 'Task assigned (email not sent — set owner email on team users or SMTP).',
        r.mail.sent ? 'success' : 'info'
      )
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-4 space-y-3 max-w-xl">
      <h2 className="text-sm font-medium text-white">Assign a task</h2>
      <p className="text-xs text-zinc-500">
        Creates a task in this inbox and emails the owner when SMTP and their email are configured.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Task title"
          className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          required
          placeholder="Owner (e.g. Lead, analyst username)"
          className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
        />
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Details (optional)"
          className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:opacity-40"
        >
          {busy ? 'Assigning…' : 'Assign & notify owner'}
        </button>
      </form>
    </section>
  )
}
