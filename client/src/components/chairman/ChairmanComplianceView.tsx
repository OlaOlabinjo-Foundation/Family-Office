import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DocumentVaultDrawer, type VaultDrawerTarget } from '../DocumentVaultDrawer'
import { LoadingBlock } from '../ui/LoadingBlock'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import { setDocumentTitle } from '../../lib/documentTitle'
import { ExternalFileLink } from '../ui/ExternalFileLink'
import { ChairmanPageChrome } from './ChairmanPageChrome'

type Doc = {
  id: number
  document_id: string
  document_category: string
  entity_asset: string
  status: string
  owner: string
  risk_level: string
  date_requested: string
  date_received: string
  reviewed_at?: string | null
  vault_file_count?: number
  storage_link?: string
}

type DashboardCompliance = {
  outstandingDocumentation: number
  complianceCalendar?: { overdueCount: number; dueNext30Count?: number }
}

const PAGE_SIZE = 30

function isOutstandingStatus(status: string) {
  const s = status.toLowerCase()
  return !['complete', 'completed', 'received', 'closed'].some((ok) => s.includes(ok))
}

function statusTone(status: string): 'warn' | 'ok' | 'neutral' {
  if (isOutstandingStatus(status)) return 'warn'
  if (/complete|received/i.test(status)) return 'ok'
  return 'neutral'
}

function DocCard({
  doc,
  onVault,
}: {
  doc: Doc
  onVault: () => void
}) {
  const tone = statusTone(doc.status)
  const border =
    tone === 'warn' ? 'border-fo-amber/40 bg-fo-amber/5' : tone === 'ok' ? 'border-emerald-900/40 bg-emerald-950/20' : 'border-fo-border/80 bg-fo-graphite/40'

  return (
    <article id={`doc-row-${doc.id}`} className={`chairman-card rounded-2xl border p-4 scroll-mt-24 ${border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{doc.document_category || 'Document'}</p>
          <h3 className="mt-1 font-medium text-white">{doc.entity_asset || doc.document_id}</h3>
          <p className="mt-0.5 text-xs text-zinc-500 font-mono">{doc.document_id}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
            tone === 'warn'
              ? 'border-fo-amber/50 text-fo-amber'
              : tone === 'ok'
                ? 'border-emerald-800/50 text-fo-green'
                : 'border-fo-border text-zinc-400'
          }`}
        >
          {doc.status || '—'}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <dt className="text-zinc-600">Owner</dt>
          <dd className="text-zinc-300">{doc.owner || '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Risk</dt>
          <dd className="text-zinc-300">{doc.risk_level || '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Requested</dt>
          <dd className="text-zinc-300">{doc.date_requested || '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Received</dt>
          <dd className="text-zinc-300">{doc.date_received || '—'}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(doc.vault_file_count ?? 0) > 0 ? (
          <button
            type="button"
            onClick={onVault}
            className="text-[11px] uppercase tracking-wider text-fo-gold-soft hover:text-fo-gold"
          >
            View files ({doc.vault_file_count})
          </button>
        ) : (
          <span className="text-[11px] text-zinc-600">No vault files attached</span>
        )}
        <ExternalFileLink href={doc.storage_link} />
        {doc.reviewed_at ? (
          <span className="text-[10px] text-zinc-500">Reviewed {String(doc.reviewed_at).slice(0, 10)}</span>
        ) : null}
      </div>
    </article>
  )
}

export function ChairmanComplianceView() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const outstandingOnly = ['1', 'true', 'yes'].includes((searchParams.get('outstanding') || '').toLowerCase())

  const [summary, setSummary] = useState<DashboardCompliance | null>(null)
  const [items, setItems] = useState<Doc[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [vault, setVault] = useState<VaultDrawerTarget | null>(null)

  const highlightRaw = searchParams.get('highlight') ?? ''
  const highlightId = useMemo(() => {
    const n = parseInt(String(highlightRaw), 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [highlightRaw])

  useEffect(() => {
    setDocumentTitle('Compliance')
  }, [])

  useEffect(() => {
    setOffset(0)
  }, [searchParams.get('outstanding')])

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (outstandingOnly) qs.set('outstanding', '1')
    else qs.set('sort', 'oldest_requested')
    const r = await apiFetch<{ items: Doc[]; total: number }>(`/api/documents/tracker?${qs.toString()}`, { token })
    if (r.total === 0) {
      setItems([])
      setTotal(0)
      return
    }
    if (r.items.length === 0 && offset > 0) {
      const lastOffset = Math.max(0, (Math.ceil(r.total / PAGE_SIZE) - 1) * PAGE_SIZE)
      if (offset !== lastOffset) {
        setOffset(lastOffset)
        return
      }
    }
    setItems(r.items)
    setTotal(r.total)
  }, [token, offset, outstandingOnly])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const s = await apiFetch<DashboardCompliance>('/api/dashboard/summary', { token })
        if (!c) setSummary(s)
      } catch (e) {
        if (!c) setErr((e as Error).message)
      }
    })()
    return () => {
      c = true
    }
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

  const openVaultFromUrl = ['1', 'true', 'yes'].includes((searchParams.get('vault') || '').toLowerCase())

  useEffect(() => {
    if (loading || highlightId == null) return
    const el = document.getElementById(`doc-row-${highlightId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('ring-2', 'ring-fo-gold/50')
    const t = window.setTimeout(() => el.classList.remove('ring-2', 'ring-fo-gold/50'), 2600)
    return () => window.clearTimeout(t)
  }, [loading, highlightId, items])

  useEffect(() => {
    if (!openVaultFromUrl || highlightId == null || loading) return
    const doc = items.find((d) => d.id === highlightId)
    if (!doc) return
    setVault({
      documentRowId: doc.id,
      title: doc.entity_asset || doc.document_id,
      subtitle: doc.document_category,
    })
  }, [openVaultFromUrl, highlightId, items, loading])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageIndex = Math.floor(offset / PAGE_SIZE) + 1
  const overdue = summary?.complianceCalendar?.overdueCount ?? 0

  if (loading && !items.length) {
    return (
      <ChairmanPageChrome title="Compliance" subtitle="Document tracker and obligations">
        <LoadingBlock label="Loading compliance…" />
      </ChairmanPageChrome>
    )
  }

  return (
    <ChairmanPageChrome
      title="Compliance"
      subtitle="Document tracker — outstanding items and vault evidence"
      actions={
        <Link
          to="/reports"
          className="rounded-lg border border-fo-gold/40 px-3 py-2 text-[10px] uppercase tracking-wider text-fo-gold-soft hover:bg-fo-gold/10"
        >
          Reports
        </Link>
      }
    >
      {err ? (
        <p role="alert" className="text-sm text-fo-red">
          {err}
        </p>
      ) : null}

      {summary ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <article className="chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/50 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Outstanding docs</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-white">
              {summary.outstandingDocumentation}
            </p>
          </article>
          <article
            className={`chairman-card rounded-2xl border p-4 ${
              overdue > 0 ? 'border-fo-amber/50 bg-fo-amber/5' : 'border-fo-border/80 bg-fo-graphite/50'
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Calendar overdue</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-white">{overdue}</p>
          </article>
          <article className="chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/50 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">In this view</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-white">{total}</p>
            <p className="mt-1 text-xs text-zinc-600">{outstandingOnly ? 'Outstanding only' : 'All tracked'}</p>
          </article>
        </section>
      ) : null}

      <div className="inline-flex rounded-lg border border-fo-border bg-fo-black/40 p-0.5" role="group" aria-label="Tracker scope">
        <button
          type="button"
          onClick={() =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.delete('outstanding')
              return next
            })
          }
          className={`rounded-md px-4 py-2 text-[10px] uppercase tracking-wider ${
            !outstandingOnly ? 'bg-fo-panel text-fo-gold-soft' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          All tracked
        </button>
        <button
          type="button"
          onClick={() =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.set('outstanding', '1')
              return next
            })
          }
          className={`rounded-md px-4 py-2 text-[10px] uppercase tracking-wider ${
            outstandingOnly ? 'bg-fo-amber/20 text-fo-amber' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Outstanding
        </button>
      </div>

      {highlightId != null && !items.some((d) => d.id === highlightId) && total > 0 ? (
        <p className="text-xs text-fo-amber" role="status">
          Row #{highlightId} is not on this page — try another page or clear the highlight.
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {items.map((doc) => (
          <DocCard
            key={doc.id}
            doc={doc}
            onVault={() =>
              setVault({
                documentRowId: doc.id,
                title: doc.entity_asset || doc.document_id,
                subtitle: doc.document_category,
              })
            }
          />
        ))}
      </section>

      {!items.length && !loading ? (
        <p className="rounded-xl border border-fo-border bg-fo-panel/30 p-6 text-sm text-zinc-500">
          {outstandingOnly ? 'No outstanding document tracker rows on the current book.' : 'No tracked documents yet.'}
        </p>
      ) : null}

      {total > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fo-border/40 pt-4">
          <p className="text-xs text-zinc-500">
            Page {pageIndex} of {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset <= 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded-lg border border-fo-border px-3 py-2 text-xs text-zinc-300 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded-lg border border-fo-border px-3 py-2 text-xs text-zinc-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <footer className="text-[11px] text-zinc-600 border-t border-fo-border/40 pt-6">
        Read-only principal view · you can download vault files · status changes are handled by your family office team.
      </footer>

      {token ? (
        <DocumentVaultDrawer
          open={vault != null}
          target={vault}
          token={token}
          canWrite={false}
          onClose={() => setVault(null)}
        />
      ) : null}
    </ChairmanPageChrome>
  )
}
