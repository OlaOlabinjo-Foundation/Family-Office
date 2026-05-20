import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingBlock } from './ui/LoadingBlock'
import { apiFetch } from '../lib/api'
import {
  formatAuditAction,
  formatAuditMetaSummary,
  formatAuditTimestamp,
  type AuditRow,
} from '../lib/auditLabels'

const PAGE_SIZE = 30

export type RowHistoryTarget = {
  entityType: string
  entityId: string
  title: string
  subtitle?: string
}

type RowHistoryDrawerProps = {
  open: boolean
  target: RowHistoryTarget | null
  token: string
  onClose: () => void
}

export function RowHistoryDrawer({ open, target, token, onClose }: RowHistoryDrawerProps) {
  const titleId = useId()
  const [items, setItems] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!target) return
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      entity_type: target.entityType,
      entity_id: target.entityId,
    })
    const r = await apiFetch<{ items: AuditRow[]; total: number }>(`/api/audit?${qs.toString()}`, { token })
    setItems(r.items)
    setTotal(r.total)
  }, [token, target, offset])

  useEffect(() => {
    if (!open || !target) return
    setOffset(0)
  }, [open, target?.entityType, target?.entityId])

  useEffect(() => {
    if (!open || !target) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        await load()
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, target, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !target) return null

  const hasMore = offset + PAGE_SIZE < total
  const hasPrev = offset > 0

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        aria-label="Close history"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-fo-border bg-fo-graphite shadow-2xl"
      >
        <div className="shrink-0 border-b border-fo-border px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Row history</p>
          <h2 id={titleId} className="mt-1 font-display text-lg text-white">
            {target.title}
          </h2>
          {target.subtitle ? <p className="mt-1 text-xs text-zinc-500">{target.subtitle}</p> : null}
          <p className="mt-2 text-[11px] text-zinc-600">
            Portal actions logged for this row. Workbook-only edits via Excel import appear under import events on the{' '}
            <Link to="/audit" className="text-fo-gold-soft hover:underline" onClick={onClose}>
              audit trail
            </Link>
            .
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? <LoadingBlock label="Loading history…" /> : null}
          {err ? (
            <p role="alert" className="text-sm text-fo-red">
              {err}
            </p>
          ) : null}
          {!loading && !err && items.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No logged events for this row yet. Changes made in the portal from this release onward will appear here.
            </p>
          ) : null}
          {!loading && !err && items.length > 0 ? (
            <ul className="space-y-3">
              {items.map((row) => {
                const summary = formatAuditMetaSummary(row.meta)
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-fo-border bg-fo-panel/40 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-zinc-200">{formatAuditAction(row.action)}</span>
                      <time className="shrink-0 text-[10px] text-zinc-500 tabular-nums">
                        {formatAuditTimestamp(row.created_at)}
                      </time>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      by <span className="text-zinc-400">{row.actor}</span>
                    </p>
                    {summary ? <p className="mt-1.5 text-xs text-zinc-400 leading-snug">{summary}</p> : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 border-t border-fo-border px-5 py-3">
          <div className="text-[10px] text-zinc-500">
            {total > 0 ? (
              <>
                {Math.min(offset + 1, total)}–{Math.min(offset + items.length, total)} of {total}
              </>
            ) : (
              '0 events'
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!hasPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded border border-fo-border px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-400 disabled:opacity-30 hover:text-fo-gold-soft"
            >
              Newer
            </button>
            <button
              type="button"
              disabled={!hasMore || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded border border-fo-border px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-400 disabled:opacity-30 hover:text-fo-gold-soft"
            >
              Older
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-fo-gold/40 bg-fo-gold/10 px-3 py-1 text-[10px] uppercase tracking-wide text-fo-gold-soft hover:bg-fo-gold/20"
            >
              Close
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
