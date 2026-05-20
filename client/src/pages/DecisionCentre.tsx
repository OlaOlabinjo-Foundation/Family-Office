import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'

type Decision = {
  id: string
  type: string
  priority: string
  title: string
  recommendation: string
  owner: string
  dueDate: string
  riskLevel: string
  notes: string
  status: string
  source: string
  resolvedAt?: string
  resolvedBy?: string
}

export function DecisionCentre() {
  const { token, canWrite } = useAuth()
  const [searchParams] = useSearchParams()
  const focusId = (searchParams.get('focus') || '').trim() || null
  const [items, setItems] = useState<Decision[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await apiFetch<{ items: Decision[] }>('/api/decisions', { token })
    setItems(r.items)
  }, [token])

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

  useEffect(() => {
    if (!focusId || loading) return
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(focusId) : focusId
    const el = document.querySelector(`[data-decision-id="${esc}"]`)
    if (!el || !(el instanceof HTMLElement)) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [focusId, loading, items])

  async function resolve(id: string) {
    setBusyId(id)
    try {
      await apiFetch(`/api/decisions/${encodeURIComponent(id)}/resolve`, { method: 'PATCH', token })
      await load()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function reopen(id: string) {
    setBusyId(id)
    try {
      await apiFetch(`/api/decisions/${encodeURIComponent(id)}/resolve`, { method: 'DELETE', token })
      await load()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const visible = showResolved ? items : items.filter((d) => d.status === 'open')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Decision required centre"
        description="Items are generated from register rules; resolving persists to the database so principals and analysts stay aligned. Re-open if a closed item becomes relevant again."
        actions={
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-xs text-zinc-300 focus-within:ring-2 focus-within:ring-fo-gold">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="rounded border-fo-border" />
            Show resolved
          </label>
        }
      />

      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}

      {loading ? <LoadingBlock label="Loading decisions…" /> : null}

      {!loading && !err ? (
        <div className="space-y-4">
        {visible.map((d) => (
          <div
            key={d.id}
            data-decision-id={d.id}
            className={`rounded-2xl border border-fo-border p-4 md:p-5 bg-fo-graphite/40 scroll-mt-4 ${
              d.status === 'resolved' ? 'opacity-70 border-zinc-700' : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                  {d.source} · {d.type}{' '}
                  {d.status === 'resolved' && (
                    <span className="text-fo-green ml-2">Resolved{d.resolvedBy ? ` · ${d.resolvedBy}` : ''}</span>
                  )}
                </div>
                <h2 className="text-lg text-white mt-1">{d.title}</h2>
                <p className="text-sm text-zinc-400 mt-2 max-w-3xl">{d.recommendation}</p>
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-zinc-500">
                  <span>Owner: {d.owner}</span>
                  <span>Due: {d.dueDate}</span>
                  <span>Risk: {d.riskLevel}</span>
                  <span>Priority: {d.priority}</span>
                </div>
                {d.notes && <div className="text-xs text-zinc-600 mt-2">Notes: {d.notes}</div>}
                {d.resolvedAt && <div className="text-[11px] text-zinc-600 mt-1">Closed at {d.resolvedAt}</div>}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {d.status === 'open' ? (
                  <button
                    type="button"
                    disabled={!canWrite || busyId === d.id}
                    onClick={() => resolve(d.id)}
                    className="rounded-md border border-fo-gold px-4 py-2 text-sm text-fo-gold-soft hover:bg-fo-gold/10 disabled:opacity-40"
                  >
                    {busyId === d.id ? '…' : 'Resolve'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canWrite || busyId === d.id}
                    onClick={() => reopen(d.id)}
                    className="rounded-md border border-fo-border px-4 py-2 text-sm text-zinc-300 hover:border-fo-gold disabled:opacity-40"
                  >
                    Re-open
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!visible.length ? (
          <div className="text-zinc-500 text-sm">{showResolved ? 'No decisions on file.' : 'No open decisions — excellent control posture.'}</div>
        ) : null}
        </div>
      ) : null}
    </div>
  )
}
