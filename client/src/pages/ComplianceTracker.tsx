import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChairmanComplianceView } from '../components/chairman/ChairmanComplianceView'
import { DocumentVaultDrawer, type VaultDrawerTarget } from '../components/DocumentVaultDrawer'
import { RowHistoryDrawer, type RowHistoryTarget } from '../components/RowHistoryDrawer'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { PaginationBar } from '../components/ui/PaginationBar'
import { TableScroll } from '../components/ui/TableScroll'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadApiCsv, downloadExportCsv } from '../lib/downloadCsv'
import { setDocumentTitle } from '../lib/documentTitle'

type Doc = {
  id: number
  document_id: string
  document_category: string
  entity_asset: string
  status: string
  owner: string
  risk_level: string
  storage_link: string
  date_requested: string
  date_received: string
  reviewed_at?: string | null
  reviewed_by?: string | null
  vault_file_count?: number
}

const PAGE_SIZE = 25

function parseOutstanding(sp: URLSearchParams): boolean {
  const v = sp.get('outstanding')?.toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function parseSort(sp: URLSearchParams): 'id' | 'oldest_requested' {
  return sp.get('sort') === 'oldest_requested' ? 'oldest_requested' : 'id'
}

export function ComplianceTracker() {
  const { user } = useAuth()
  if (user?.role === 'chairman') return <ChairmanComplianceView />
  return <ComplianceTrackerOperator />
}

function ComplianceTrackerOperator() {
  const { token, canWrite, canViewAudit } = useAuth()
  const { show: notify } = useNotify()
  const [searchParams, setSearchParams] = useSearchParams()
  const outstandingOnly = parseOutstanding(searchParams)
  const sortOrder = parseSort(searchParams)

  const [items, setItems] = useState<Doc[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportErr, setExportErr] = useState<string | null>(null)
  const [reviewBusyId, setReviewBusyId] = useState<number | null>(null)
  const [history, setHistory] = useState<RowHistoryTarget | null>(null)
  const [vault, setVault] = useState<VaultDrawerTarget | null>(null)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    setDocumentTitle('Compliance')
  }, [])

  const outstandingKey = searchParams.get('outstanding') ?? ''
  const sortKey = searchParams.get('sort') ?? ''
  const highlightRaw = searchParams.get('highlight') ?? ''
  const highlightId = useMemo(() => {
    const n = parseInt(String(highlightRaw), 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [highlightRaw])

  useEffect(() => {
    setOffset(0)
    setSelected(new Set())
  }, [outstandingKey, sortKey])

  useEffect(() => {
    setSelected(new Set())
  }, [offset])

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (outstandingOnly) qs.set('outstanding', '1')
    else if (sortOrder === 'oldest_requested') qs.set('sort', 'oldest_requested')
    const r = await apiFetch<{ items: Doc[]; total: number; outstandingOnly?: boolean }>(
      `/api/documents/tracker?${qs.toString()}`,
      { token }
    )
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
  }, [token, offset, outstandingOnly, sortOrder])

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

  const highlightOnPage = highlightId != null && items.some((d) => d.id === highlightId)

  useEffect(() => {
    if (loading || highlightId == null) return
    const el = document.getElementById(`doc-row-${highlightId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [loading, highlightId, items])

  const pageIds = useMemo(() => items.map((d) => d.id), [items])
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectPage() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const id of pageIds) next.delete(id)
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const id of pageIds) next.add(id)
        return next
      })
    }
  }

  async function bulkSetReview(reviewed: boolean) {
    if (!canWrite || selected.size === 0) return
    setBulkBusy(true)
    try {
      const ids = [...selected]
      let ok = 0
      for (const id of ids) {
        await apiFetch(`/api/documents/${id}/review`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ reviewed }),
        })
        ok++
      }
      notify(
        reviewed ? `Marked ${ok} row(s) as reviewed.` : `Cleared review on ${ok} row(s).`,
        'success'
      )
      setSelected(new Set())
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  async function setRowReview(row: Doc, reviewed: boolean) {
    setReviewBusyId(row.id)
    try {
      await apiFetch(`/api/documents/${row.id}/review`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ reviewed }),
      })
      notify(reviewed ? 'Marked as reviewed (portal only).' : 'Review mark cleared.', 'success')
      await load()
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setReviewBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controls"
        title="Document & compliance tracker"
        description={
          outstandingOnly
            ? `Outstanding only: missing / pending / requested / open (not complete or received). Oldest request first. ${PAGE_SIZE} per page. Add ?highlight=<row id> to scroll to a row when it appears on this page. Lead and analyst can mark rows as reviewed (who/when) without changing workbook status.`
            : sortOrder === 'oldest_requested'
              ? `All tracked rows (${PAGE_SIZE} per page), oldest request first. URL: ?sort=oldest_requested`
              : `All tracked rows (${PAGE_SIZE} per page). Use the vault to attach PDFs and evidence per row. Optional: ?highlight=<id> scrolls to that row when it is on the current page. Review column: portal-only verification for lead/analyst.`
        }
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div
              className="inline-flex rounded-lg border border-fo-border bg-fo-black/40 p-0.5"
              role="group"
              aria-label="Tracker scope"
            >
              <button
                type="button"
                onClick={() => {
                  setOffset(0)
                  setSearchParams(
                    (prev) => {
                      const next = new URLSearchParams(prev)
                      next.delete('outstanding')
                      return next
                    },
                    { replace: true }
                  )
                }}
                className={`rounded-md px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                  !outstandingOnly
                    ? 'bg-fo-panel text-fo-gold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All tracked
              </button>
              <button
                type="button"
                onClick={() => {
                  setOffset(0)
                  setSearchParams(
                    (prev) => {
                      const next = new URLSearchParams(prev)
                      next.set('outstanding', '1')
                      next.delete('sort')
                      return next
                    },
                    { replace: true }
                  )
                }}
                className={`rounded-md px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                  outstandingOnly
                    ? 'bg-fo-amber/20 text-fo-amber'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Outstanding
              </button>
            </div>
            {!outstandingOnly ? (
              <div
                className="inline-flex rounded-lg border border-fo-border bg-fo-black/40 p-0.5"
                role="group"
                aria-label="Row order (all tracked)"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOffset(0)
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev)
                        next.delete('sort')
                        return next
                      },
                      { replace: true }
                    )
                  }}
                  className={`rounded-md px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                    sortOrder === 'id'
                      ? 'bg-fo-panel text-fo-gold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sheet order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOffset(0)
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev)
                        next.set('sort', 'oldest_requested')
                        return next
                      },
                      { replace: true }
                    )
                  }}
                  className={`rounded-md px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                    sortOrder === 'oldest_requested'
                      ? 'bg-fo-panel text-fo-gold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Oldest request
                </button>
              </div>
            ) : null}
            <Link
              to="/compliance/calendar"
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset text-center"
            >
              Compliance calendar
            </Link>
            <button
              type="button"
              onClick={async () => {
                setExportErr(null)
                try {
                  await downloadExportCsv(token, 'documents', {
                    onSuccess: () => notify('Full documents table exported as CSV', 'success'),
                  })
                } catch (e) {
                  setExportErr((e as Error).message)
                }
              }}
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Export full table
            </button>
            <button
              type="button"
              onClick={async () => {
                setExportErr(null)
                try {
                  const exportQs = new URLSearchParams()
                  if (outstandingOnly) exportQs.set('outstanding', '1')
                  else if (sortOrder === 'oldest_requested') exportQs.set('sort', 'oldest_requested')
                  const exportSuffix = exportQs.toString() ? `?${exportQs.toString()}` : ''
                  await downloadApiCsv(
                    token,
                    `/api/export/documents-tracker${exportSuffix}`,
                    outstandingOnly ? 'documents_tracker_outstanding.csv' : 'documents_tracker_all.csv',
                    {
                      onSuccess: () =>
                        notify(
                          outstandingOnly
                            ? 'Outstanding tracker rows exported as CSV'
                            : 'Tracked rows exported as CSV',
                          'success'
                        ),
                    }
                  )
                } catch (e) {
                  setExportErr((e as Error).message)
                }
              }}
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Export this view
            </button>
          </div>
        }
      />

      {!canWrite ? (
        <div
          role="status"
          className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-4 py-3 text-sm text-zinc-200 leading-relaxed"
        >
          <span className="font-medium text-fo-amber">Read-only.</span> You can browse and export this tracker; marking rows as reviewed or
          changing statuses in the book requires a <strong className="text-zinc-100">lead</strong> or{' '}
          <strong className="text-zinc-100">analyst</strong>. See{' '}
          <Link to="/maintenance" className="text-fo-gold-soft hover:underline">
            Data maintenance
          </Link>{' '}
          for where updates happen.
        </div>
      ) : null}

      {exportErr ? (
        <div role="alert" className="text-sm text-fo-red">
          {exportErr}
        </div>
      ) : null}

      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}
      {loading ? <LoadingBlock label="Loading document tracker…" /> : null}

      {!loading && !err && highlightId != null && !highlightOnPage && total > 0 ? (
        <p className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-4 py-2 text-xs text-fo-amber" role="status">
          Row #{highlightId} is not on this page. Use pagination or clear the highlight from the URL to locate it.
        </p>
      ) : null}

      {someSelected ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-fo-gold/30 bg-fo-gold/5 px-4 py-3 text-sm"
        >
          <span className="text-zinc-300">
            <strong className="text-fo-gold-soft">{selected.size}</strong> selected on this page
          </span>
          {canWrite ? (
            <>
              <button
                type="button"
                disabled={bulkBusy || reviewBusyId != null}
                onClick={() => void bulkSetReview(true)}
                className="rounded border border-fo-gold/40 bg-fo-gold/10 px-3 py-1 text-[10px] uppercase tracking-wide text-fo-gold-soft hover:bg-fo-gold/20 disabled:opacity-40"
              >
                Mark reviewed
              </button>
              <button
                type="button"
                disabled={bulkBusy || reviewBusyId != null}
                onClick={() => void bulkSetReview(false)}
                className="rounded border border-fo-border px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-400 hover:text-fo-gold-soft disabled:opacity-40"
              >
                Clear review
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {!loading && !err ? (
        <div>
          <TableScroll maxHeight="max-h-[min(70vh,560px)]">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-fo-panel text-left text-[10px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="w-10 px-2 py-2" scope="col">
                    <span className="sr-only">Select</span>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      disabled={!items.length || bulkBusy}
                      aria-label={allOnPageSelected ? 'Deselect all on page' : 'Select all on page'}
                      onChange={toggleSelectPage}
                      className="rounded border-fo-border bg-fo-black accent-fo-gold"
                    />
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Category
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Entity / asset
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Status
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Owner
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Requested
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Received
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Risk
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Link
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Vault
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr
                    key={d.id}
                    id={`doc-row-${d.id}`}
                    className={`border-t border-fo-border hover:bg-fo-panel/50 scroll-mt-2 ${selected.has(d.id) ? 'bg-fo-gold/5' : ''}`}
                  >
                    <td className="px-2 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        disabled={bulkBusy}
                        aria-label={`Select row ${d.id}`}
                        onChange={() => toggleSelect(d.id)}
                        className="rounded border-fo-border bg-fo-black accent-fo-gold"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{d.document_category}</td>
                    <td className="max-w-xs truncate px-3 py-2">{d.entity_asset}</td>
                    <td className="px-3 py-2">{d.status}</td>
                    <td className="px-3 py-2">{d.owner}</td>
                    <td className="whitespace-nowrap px-3 py-2">{d.date_requested}</td>
                    <td className="whitespace-nowrap px-3 py-2">{d.date_received}</td>
                    <td className="px-3 py-2">{d.risk_level}</td>
                    <td className="max-w-[140px] truncate px-3 py-2">
                      {d.storage_link ? (
                        <a className="text-fo-gold underline" href={d.storage_link} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <button
                        type="button"
                        className="btn-touch rounded border border-fo-border px-2 text-[10px] uppercase tracking-wide text-zinc-300 hover:border-fo-gold/50 hover:text-fo-gold-soft"
                        onClick={() =>
                          setVault({
                            documentRowId: d.id,
                            title: d.document_id || `Document #${d.id}`,
                            subtitle: [d.document_category, d.entity_asset].filter(Boolean).join(' · ') || undefined,
                          })
                        }
                      >
                        Vault
                        {(d.vault_file_count ?? 0) > 0 ? (
                          <span className="ml-1 rounded-full bg-fo-gold/20 px-1.5 py-0.5 text-fo-gold-soft tabular-nums">
                            {d.vault_file_count}
                          </span>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {d.reviewed_at ? (
                        <div className="text-[10px] text-zinc-500 mb-1 whitespace-normal text-left max-w-[10rem] ml-auto">
                          {String(d.reviewed_at).replace('T', ' ').slice(0, 16)}
                          {d.reviewed_by ? <span className="text-zinc-600"> · {d.reviewed_by}</span> : null}
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-600 mb-1">Not reviewed</div>
                      )}
                      <div className="flex flex-wrap justify-end gap-1">
                        {canWrite ? (
                          <>
                            {d.reviewed_at ? (
                              <button
                                type="button"
                                disabled={reviewBusyId === d.id}
                                onClick={() => void setRowReview(d, false)}
                                className="rounded border border-fo-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400 hover:text-fo-gold-soft disabled:opacity-40"
                              >
                                Clear
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={reviewBusyId === d.id}
                                onClick={() => void setRowReview(d, true)}
                                className="rounded border border-fo-gold/40 bg-fo-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-fo-gold-soft hover:bg-fo-gold/20 disabled:opacity-40"
                              >
                                {reviewBusyId === d.id ? '…' : 'Mark reviewed'}
                              </button>
                            )}
                          </>
                        ) : null}
                        {canViewAudit ? (
                          <button
                            type="button"
                            className="rounded border border-fo-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 hover:text-fo-gold-soft"
                            onClick={() =>
                              setHistory({
                                entityType: 'document',
                                entityId: String(d.id),
                                title: d.document_id || `Document #${d.id}`,
                                subtitle: [d.document_category, d.entity_asset].filter(Boolean).join(' · ') || undefined,
                              })
                            }
                          >
                            History
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length ? (
              <div className="p-4 text-sm text-zinc-500">
                {outstandingOnly
                  ? 'No outstanding document rows — statuses look complete or received, or nothing is tracked yet.'
                  : 'No document rows with category or entity yet.'}
              </div>
            ) : null}
          </TableScroll>
          <PaginationBar offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
        </div>
      ) : null}

      <RowHistoryDrawer
        key={history ? `${history.entityType}:${history.entityId}` : 'closed'}
        open={history !== null}
        target={history}
        token={token ?? ''}
        onClose={() => setHistory(null)}
      />

      <DocumentVaultDrawer
        key={vault ? `vault:${vault.documentRowId}` : 'vault-closed'}
        open={vault !== null}
        target={vault}
        token={token ?? ''}
        canWrite={canWrite}
        onClose={() => setVault(null)}
        onFilesChanged={() => void load().catch(() => {})}
      />
    </div>
  )
}
