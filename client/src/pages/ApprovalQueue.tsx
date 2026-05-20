import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import type { ChangeRequest } from '../lib/changeRequests'
import { setDocumentTitle } from '../lib/documentTitle'

type ListPayload = {
  items: ChangeRequest[]
  total: number
  limit: number
  offset: number
}

const TABLE_LINKS: Record<string, string> = {
  master_assets: '/data/master',
  cash_banking: '/data/cash',
  real_estate: '/data/real-estate',
  public_securities: '/data/securities',
  liabilities: '/data/liabilities',
}

const TABLE_LABELS: Record<string, string> = {
  master_assets: 'Master register',
  cash_banking: 'Cash & banking',
  real_estate: 'Real estate',
  public_securities: 'Public securities',
  liabilities: 'Liabilities',
}

export function ApprovalQueue() {
  const { token, user } = useAuth()
  const { show: notify } = useNotify()
  const isLead = user?.role === 'lead'
  const isAnalyst = user?.role === 'analyst'
  const [status, setStatus] = useState<'pending' | 'all'>('pending')
  const [data, setData] = useState<ListPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [reviewId, setReviewId] = useState<number | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = useState('')

  useEffect(() => {
    setDocumentTitle('Approval queue')
  }, [])

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ status, limit: '50', offset: '0' })
    const r = await apiFetch<ListPayload>(`/api/change-requests?${qs.toString()}`, { token })
    setData(r)
  }, [token, status])

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

  function openReview(id: number, action: 'approve' | 'reject') {
    setReviewId(id)
    setReviewAction(action)
    setComment('')
  }

  function closeReview() {
    if (busyId !== null) return
    setReviewId(null)
    setReviewAction(null)
    setComment('')
  }

  async function submitReview() {
    if (reviewId === null || !reviewAction) return
    setBusyId(reviewId)
    try {
      await apiFetch(`/api/change-requests/${reviewId}/${reviewAction}`, {
        method: 'POST',
        token,
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      })
      notify(reviewAction === 'approve' ? 'Change approved and applied.' : 'Change rejected.', 'success')
      closeReview()
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (!isLead && !isAnalyst) {
    return (
      <section className="space-y-4">
        <PageHeader
          eyebrow="Governance"
          title="Approval queue"
          description="Register change requests from analysts are reviewed by the lead."
        />
        <p className="text-sm text-zinc-500">This screen is for lead and analyst roles only.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Governance"
        title="Approval queue"
        description={
          isLead
            ? 'Review analyst-submitted register changes (master, cash, real estate, securities, liabilities) before they apply to the book.'
            : 'Your submitted register changes appear here until the lead approves or rejects them.'
        }
        actions={
          <Link
            to="/actions"
            className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
          >
            Task inbox
          </Link>
        }
      />

      <section className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => setStatus('pending')}
          className={`rounded-lg px-3 py-1.5 ${status === 'pending' ? 'bg-fo-gold/20 text-fo-gold-soft' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => setStatus('all')}
          className={`rounded-lg px-3 py-1.5 ${status === 'all' ? 'bg-fo-gold/20 text-fo-gold-soft' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          All
        </button>
      </section>

      {loading ? <LoadingBlock label="Loading requests…" /> : null}
      {err ? (
        <p role="alert" className="text-sm text-fo-red">
          {err}
        </p>
      ) : null}

      {!loading && !err && data ? (
        <ul className="space-y-3">
          {data.items.map((req) => (
            <li
              key={req.id}
              className="rounded-xl border border-fo-border bg-fo-panel px-4 py-3 text-sm space-y-2"
            >
              <section className="flex flex-wrap items-start justify-between gap-2">
                <section>
                  <p className="font-medium text-zinc-100">{req.summary}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    #{req.id} · {req.operation} · {TABLE_LABELS[req.table] ?? req.table} · submitted{' '}
                    {req.submittedBy}{' '}
                    {req.submittedAt ? `· ${String(req.submittedAt).replace('T', ' ').slice(0, 16)}` : ''}
                  </p>
                </section>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                    req.status === 'pending'
                      ? 'bg-fo-amber/20 text-fo-amber'
                      : req.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {req.status}
                </span>
              </section>
              {req.reviewComment ? (
                <p className="text-xs text-zinc-400">
                  Review: {req.reviewComment}
                  {req.reviewedBy ? ` (${req.reviewedBy})` : ''}
                </p>
              ) : null}
              <section className="flex flex-wrap gap-2">
                {TABLE_LINKS[req.table] ? (
                  <Link
                    to={TABLE_LINKS[req.table]}
                    className="text-xs text-fo-gold-soft hover:underline"
                  >
                    Open register
                  </Link>
                ) : null}
                {isLead && req.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      className="rounded border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-wide text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
                      onClick={() => openReview(req.id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      className="rounded border border-fo-red/40 px-3 py-1 text-[10px] uppercase tracking-wide text-fo-red hover:bg-fo-red/10 disabled:opacity-40"
                      onClick={() => openReview(req.id, 'reject')}
                    >
                      Reject
                    </button>
                  </>
                ) : null}
              </section>
            </li>
          ))}
          {data.items.length === 0 ? (
            <li className="rounded-xl border border-fo-border px-4 py-10 text-center text-zinc-500 text-sm">
              {status === 'pending' ? 'No pending requests.' : 'No requests in this view.'}
            </li>
          ) : null}
        </ul>
      ) : null}

      {reviewId !== null && reviewAction ? (
        <section
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-title"
        >
          <section className="w-full max-w-md rounded-xl border border-fo-border bg-fo-black p-5 space-y-4">
            <h2 id="review-title" className="text-lg font-medium text-zinc-100">
              {reviewAction === 'approve' ? 'Approve change' : 'Reject change'}
            </h2>
            <label className="block text-sm text-zinc-400">
              Comment (optional)
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-sm text-zinc-100"
                placeholder="Reason or instruction for the analyst"
              />
            </label>
            <section className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busyId !== null}
                onClick={closeReview}
                className="rounded-lg border border-fo-border px-4 py-2 text-xs uppercase tracking-wider text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={submitReview}
                className={`rounded-lg px-4 py-2 text-xs uppercase tracking-wider ${
                  reviewAction === 'approve'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-fo-red text-white'
                }`}
              >
                {busyId !== null ? 'Saving…' : reviewAction === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </section>
          </section>
        </section>
      ) : null}
    </section>
  )
}
