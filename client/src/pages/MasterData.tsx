import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MasterAssetFormModal } from '../components/MasterAssetFormModal'
import { RowHistoryDrawer, type RowHistoryTarget } from '../components/RowHistoryDrawer'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { PaginationBar } from '../components/ui/PaginationBar'
import { TableScroll } from '../components/ui/TableScroll'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadExportCsv, downloadTextCsv, rowsToCsv } from '../lib/downloadCsv'
import { formatMoneyCompact } from '../lib/format'
import {
  EMPTY_MASTER_ASSET_DRAFT,
  rowToMasterDraft,
  type MasterAssetFieldKey,
} from '../lib/masterAssetFields'
import { submitChangeRequest } from '../lib/changeRequests'
import { setDocumentTitle } from '../lib/documentTitle'

type Row = Record<string, unknown> & { id: number }

type FormMode = null | { kind: 'create' } | { kind: 'edit'; id: number; draft: Record<MasterAssetFieldKey, string> }

const PAGE_SIZE = 30

export function MasterData() {
  const { token, canWrite, canViewAudit, user } = useAuth()
  const usesApprovalQueue = user?.role === 'analyst'
  const { show: notify } = useNotify()
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightAsset = useMemo(() => (searchParams.get('highlight') || '').trim(), [searchParams])
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportErr, setExportErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormMode>(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<RowHistoryTarget | null>(null)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [archiveBusyId, setArchiveBusyId] = useState<number | null>(null)

  useEffect(() => {
    setSelected(new Set())
  }, [offset, showArchived])

  useEffect(() => {
    setDocumentTitle('Master register')
  }, [])

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (showArchived) qs.set('archived', '1')
    const r = await apiFetch<{ items: Row[]; total: number }>(
      `/api/data/master_assets?${qs.toString()}`,
      { token }
    )
    if (r.total === 0) {
      setRows([])
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
    setRows(r.items)
    setTotal(r.total)
  }, [token, offset, showArchived])

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

  const highlightOnPage =
    highlightAsset.length > 0 && rows.some((r) => String(r.asset_id || '').trim() === highlightAsset)

  const pageIds = useMemo(() => rows.map((r) => Number(r.id)), [rows])
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

  function exportSelected() {
    const picked = rows.filter((r) => selected.has(Number(r.id)))
    if (!picked.length) return
    const cols = ['id', 'asset_id', 'asset_name', 'asset_category', 'jurisdiction', 'net_value', 'currency']
    const csv = rowsToCsv(picked as Record<string, unknown>[], cols)
    downloadTextCsv('master_assets_selected.csv', csv, {
      onSuccess: () => notify(`Exported ${picked.length} row(s) as CSV`, 'success'),
    })
  }

  useEffect(() => {
    if (!highlightAsset || loading || !rows.length) return
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(highlightAsset) : highlightAsset
    const el = document.querySelector(`[data-master-asset="${esc}"]`)
    if (!el || !(el instanceof HTMLElement)) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [highlightAsset, loading, rows])

  function openCreate() {
    setForm({ kind: 'create' })
  }

  function openEdit(row: Row) {
    setForm({ kind: 'edit', id: row.id, draft: rowToMasterDraft(row) })
  }

  function closeForm() {
    if (!saving) setForm(null)
  }

  async function archiveRow(row: Row) {
    if (!canWrite) return
    const label = String(row.asset_id || row.id)
    if (!window.confirm(`Archive asset "${label}"? It will be hidden from active lists but can be restored.`)) return
    setArchiveBusyId(Number(row.id))
    try {
      if (usesApprovalQueue) {
        await submitChangeRequest(token ?? '', {
          table: 'master_assets',
          operation: 'archive',
          rowId: Number(row.id),
        })
        notify('Archive request submitted for lead approval.', 'success')
      } else {
        await apiFetch(`/api/data/master_assets/${row.id}`, { method: 'DELETE', token })
        notify('Asset archived.', 'success')
        await load()
      }
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setArchiveBusyId(null)
    }
  }

  async function restoreRow(row: Row) {
    if (!canWrite) return
    setArchiveBusyId(Number(row.id))
    try {
      await apiFetch(`/api/data/master_assets/${row.id}/restore`, { method: 'POST', token })
      notify('Asset restored to the active register.', 'success')
      if (showArchived) {
        setShowArchived(false)
        setOffset(0)
      } else {
        await load()
      }
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setArchiveBusyId(null)
    }
  }

  async function submitForm(body: Record<string, unknown>) {
    setSaving(true)
    try {
      if (usesApprovalQueue) {
        const operation = form?.kind === 'create' ? 'create' : 'update'
        await submitChangeRequest(token ?? '', {
          table: 'master_assets',
          operation,
          rowId: form?.kind === 'edit' ? form.id : undefined,
          payload: body,
        })
        notify('Change submitted for lead approval.', 'success')
        setForm(null)
        return
      }
      if (form?.kind === 'create') {
        const created = await apiFetch<Row>('/api/data/master_assets', {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        })
        notify('Asset added to the master register.', 'success')
        setForm(null)
        const aid = String(created.asset_id || '').trim()
        if (aid) setSearchParams({ highlight: aid })
        setOffset(0)
      } else if (form?.kind === 'edit') {
        await apiFetch(`/api/data/master_assets/${form.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(body),
        })
        notify('Asset updated.', 'success')
        setForm(null)
        await load()
      }
    } catch (e) {
      notify((e as Error).message, 'error')
      throw e
    } finally {
      setSaving(false)
    }
  }

  const formOpen = form !== null
  const formMode = form?.kind === 'create' ? 'create' : 'edit'
  const formDraft =
    form?.kind === 'create' ? EMPTY_MASTER_ASSET_DRAFT : form?.kind === 'edit' ? form.draft : EMPTY_MASTER_ASSET_DRAFT

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Registers"
        title="Master asset register"
        description={`Add or edit assets in the portal (lead and analyst). Changes are audited and appear on the Command Centre without Excel. ${PAGE_SIZE} rows per page; export CSV is the full register. Deep-link with ?highlight=<asset id>.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canWrite && !showArchived ? (
              <button
                type="button"
                onClick={openCreate}
                disabled={formOpen}
                className="rounded-lg bg-fo-gold px-4 py-2 text-xs font-medium uppercase tracking-wider text-fo-black hover:opacity-90 disabled:opacity-40 focus-ring-inset"
              >
                Add asset
              </button>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                setExportErr(null)
                try {
                  await downloadExportCsv(token, 'master_assets', {
                    onSuccess: () => notify('Master register downloaded as CSV', 'success'),
                  })
                } catch (e) {
                  setExportErr((e as Error).message)
                }
              }}
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Export CSV
            </button>
            <Link
              to="/entities"
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Entity exposure
            </Link>
            {user?.role === 'lead' ? (
              <Link
                to="/approvals"
                className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
              >
                Approval queue
              </Link>
            ) : null}
          </div>
        }
      />

      {usesApprovalQueue ? (
        <p
          role="status"
          className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-4 py-3 text-sm text-zinc-200 leading-relaxed"
        >
          <span className="font-medium text-fo-amber">Approval required.</span> Your edits are submitted to the{' '}
          <Link to="/approvals" className="text-fo-gold-soft hover:underline">
            approval queue
          </Link>{' '}
          for lead sign-off before they apply.
        </p>
      ) : null}

      {canWrite ? (
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked)
              setOffset(0)
            }}
            className="rounded border-fo-border bg-fo-black accent-fo-gold"
          />
          Show archived rows only
        </label>
      ) : null}

      {!canWrite ? (
        <div
          role="status"
          className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-4 py-3 text-sm text-zinc-200 leading-relaxed"
        >
          <span className="font-medium text-fo-amber">Read-only.</span> Your role can browse and export this register; adding or
          editing assets requires a <strong className="text-zinc-100">lead</strong> or <strong className="text-zinc-100">analyst</strong>.
          See{' '}
          <Link to="/maintenance" className="text-fo-gold-soft hover:underline">
            Data maintenance
          </Link>
          .
        </div>
      ) : (
        <p className="text-sm text-zinc-500 leading-relaxed" role="status">
          Use <strong className="text-zinc-300">Add asset</strong> for a new row, or <strong className="text-zinc-300">Edit details</strong>{' '}
          for the full register fields. Bulk updates can still use{' '}
          <Link to="/import" className="text-fo-gold-soft hover:underline">
            Excel import
          </Link>
          .
        </p>
      )}

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
      {loading ? <LoadingBlock label="Loading master register…" /> : null}

      {!loading && !err && highlightAsset && !highlightOnPage && total > 0 ? (
        <p className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-4 py-2 text-xs text-fo-amber" role="status">
          No row matches asset id &quot;{highlightAsset}&quot; on this page — try another page or clear the filter from the URL.
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
          <button
            type="button"
            onClick={exportSelected}
            className="rounded border border-fo-border px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-300 hover:text-fo-gold-soft"
          >
            Export selected CSV
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {!loading && !err ? (
        <div>
          <TableScroll maxHeight="max-h-[560px]">
            <table className="min-w-full text-xs">
              <thead className="bg-fo-panel sticky top-0 text-left text-zinc-400 uppercase text-[10px]">
                <tr>
                  <th className="w-8 px-1 py-2" scope="col">
                    <span className="sr-only">Select</span>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      disabled={!rows.length || formOpen}
                      aria-label={allOnPageSelected ? 'Deselect all on page' : 'Select all on page'}
                      onChange={toggleSelectPage}
                      className="rounded border-fo-border bg-fo-black accent-fo-gold"
                    />
                  </th>
                  <th className="px-2 py-2" scope="col">
                    ID
                  </th>
                  <th className="px-2 py-2" scope="col">
                    Asset ID
                  </th>
                  <th className="px-2 py-2" scope="col">
                    Name
                  </th>
                  <th className="px-2 py-2" scope="col">
                    Category
                  </th>
                  <th className="px-2 py-2" scope="col">
                    Jurisdiction
                  </th>
                  <th className="px-2 py-2" scope="col">
                    CCY
                  </th>
                  <th className="px-2 py-2 text-right" scope="col">
                    Net value
                  </th>
                  <th className="px-2 py-2" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const aid = String(r.asset_id || '').trim()
                  return (
                    <tr
                      key={r.id}
                      {...(aid ? { 'data-master-asset': aid } : {})}
                      className={`border-t border-fo-border scroll-mt-2 ${selected.has(Number(r.id)) ? 'bg-fo-gold/5' : ''}`}
                    >
                      <td className="px-1 py-1">
                        <input
                          type="checkbox"
                          checked={selected.has(Number(r.id))}
                          disabled={formOpen}
                          aria-label={`Select row ${r.id}`}
                          onChange={() => toggleSelect(Number(r.id))}
                          className="rounded border-fo-border bg-fo-black accent-fo-gold"
                        />
                      </td>
                      <td className="px-2 py-1">{r.id}</td>
                      <td className="px-2 py-1 text-fo-gold-soft whitespace-nowrap">{String(r.asset_id)}</td>
                      <td className="px-2 py-1 max-w-xs truncate">{String(r.asset_name)}</td>
                      <td className="px-2 py-1">{String(r.asset_category)}</td>
                      <td className="px-2 py-1">{String(r.jurisdiction)}</td>
                      <td className="px-2 py-1 text-zinc-400">{String(r.currency || 'NGN')}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">
                        {formatMoneyCompact((r.net_value ?? r.current_value) as number | null, r.currency as string)}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-2">
                          {canWrite && !showArchived ? (
                            <button
                              type="button"
                              disabled={formOpen || archiveBusyId === Number(r.id)}
                              className="text-xs text-fo-gold disabled:opacity-30"
                              onClick={() => openEdit(r)}
                            >
                              Edit details
                            </button>
                          ) : null}
                          {canWrite && !showArchived ? (
                            <button
                              type="button"
                              disabled={formOpen || archiveBusyId === Number(r.id)}
                              className="text-xs text-zinc-500 hover:text-fo-amber disabled:opacity-30"
                              onClick={() => archiveRow(r)}
                            >
                              Archive
                            </button>
                          ) : null}
                          {canWrite && showArchived ? (
                            <button
                              type="button"
                              disabled={archiveBusyId === Number(r.id)}
                              className="text-xs text-fo-gold disabled:opacity-30"
                              onClick={() => restoreRow(r)}
                            >
                              Restore
                            </button>
                          ) : null}
                          {canViewAudit ? (
                            <button
                              type="button"
                              className="text-xs text-zinc-500 hover:text-fo-gold-soft"
                              onClick={() =>
                                setHistory({
                                  entityType: 'master_assets',
                                  entityId: String(r.id),
                                  title: aid || `Row #${r.id}`,
                                  subtitle: String(r.asset_name || '').trim() || undefined,
                                })
                              }
                            >
                              History
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No assets yet.{' '}
                      {canWrite ? (
                        <button type="button" className="text-fo-gold-soft underline" onClick={openCreate}>
                          Add your first asset
                        </button>
                      ) : (
                        'Ask lead or analyst to add rows or run an import.'
                      )}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableScroll>
          <PaginationBar
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            disabled={formOpen}
            onOffsetChange={setOffset}
          />
        </div>
      ) : null}

      <MasterAssetFormModal
        open={formOpen}
        mode={formMode}
        initialDraft={formDraft}
        token={token ?? ''}
        busy={saving}
        onClose={closeForm}
        onSubmit={submitForm}
      />

      <RowHistoryDrawer
        key={history ? `${history.entityType}:${history.entityId}` : 'closed'}
        open={history !== null}
        target={history}
        token={token ?? ''}
        onClose={() => setHistory(null)}
      />
    </div>
  )
}
