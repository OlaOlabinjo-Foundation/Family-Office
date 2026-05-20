import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RegisterFormModal } from '../components/RegisterFormModal'
import { RowHistoryDrawer, type RowHistoryTarget } from '../components/RowHistoryDrawer'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { PaginationBar } from '../components/ui/PaginationBar'
import { TableScroll } from '../components/ui/TableScroll'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadExportCsv, downloadTextCsv, rowsToCsv } from '../lib/downloadCsv'
import { formatCompactNgn } from '../lib/format'
import { submitChangeRequest } from '../lib/changeRequests'
import type { RegisterFieldKey, RegisterSchema } from '../lib/registerSchemas'
import { setDocumentTitle } from '../lib/documentTitle'

type Row = Record<string, unknown> & { id: number }

type FormMode =
  | null
  | { kind: 'create' }
  | { kind: 'edit'; id: number; draft: Record<RegisterFieldKey, string> }

const PAGE_SIZE = 30

function formatCell(row: Row, key: string, format?: 'ngn' | 'compact') {
  const v = row[key]
  if (format === 'ngn') return formatCompactNgn(v as number | null)
  return String(v ?? '—')
}

type RegisterCrudPageProps = {
  schema: RegisterSchema
}

export function RegisterCrudPage({ schema }: RegisterCrudPageProps) {
  const { token, canWrite, canViewAudit, user } = useAuth()
  const usesApprovalQueue = schema.approvalQueue === true && user?.role === 'analyst'
  const { show: notify } = useNotify()
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightKey = useMemo(
    () => (searchParams.get(schema.highlightParam) || '').trim(),
    [searchParams, schema.highlightParam]
  )
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

  const softDeleteEnabled = schema.softDelete !== false

  useEffect(() => {
    setDocumentTitle(schema.documentTitle)
  }, [schema.documentTitle])

  useEffect(() => {
    setSelected(new Set())
  }, [offset, showArchived])

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (showArchived && softDeleteEnabled) qs.set('archived', '1')
    const r = await apiFetch<{ items: Row[]; total: number }>(
      `/api/data/${schema.table}?${qs.toString()}`,
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
  }, [token, offset, schema.table, showArchived, softDeleteEnabled])

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

  const highlightColumn =
    schema.table === 'cash_banking'
      ? 'account_id'
      : schema.table === 'real_estate'
        ? 'property_id'
        : schema.table === 'public_securities'
          ? 'ticker'
          : schema.table === 'liabilities'
            ? 'facility_id'
            : 'id'

  async function archiveRow(row: Row) {
    if (!canWrite || !softDeleteEnabled) return
    const label = String(row[highlightColumn] || row.id)
    if (!window.confirm(`Archive row "${label}"? It will be hidden from active lists but can be restored.`)) return
    setArchiveBusyId(Number(row.id))
    try {
      if (usesApprovalQueue) {
        await submitChangeRequest(token ?? '', {
          table: schema.table,
          operation: 'archive',
          rowId: Number(row.id),
        })
        notify('Archive request submitted for lead approval.', 'success')
      } else {
        await apiFetch(`/api/data/${schema.table}/${row.id}`, { method: 'DELETE', token })
        notify('Row archived.', 'success')
        await load()
      }
    } catch (e) {
      notify((e as Error).message, 'error')
    } finally {
      setArchiveBusyId(null)
    }
  }

  async function restoreRow(row: Row) {
    if (!canWrite || !softDeleteEnabled) return
    setArchiveBusyId(Number(row.id))
    try {
      await apiFetch(`/api/data/${schema.table}/${row.id}/restore`, { method: 'POST', token })
      notify('Row restored to the active register.', 'success')
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

  const highlightOnPage =
    highlightKey.length > 0 && rows.some((r) => String(r[highlightColumn] || '').trim() === highlightKey)

  useEffect(() => {
    if (!highlightKey || loading || !rows.length) return
    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(highlightKey) : highlightKey
    const el = document.querySelector(`[data-register-row="${esc}"]`)
    if (!el || !(el instanceof HTMLElement)) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [highlightKey, loading, rows])

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
    const csv = rowsToCsv(picked as Record<string, unknown>[], schema.exportColumns)
    downloadTextCsv(`${schema.table}_selected.csv`, csv, {
      onSuccess: () => notify(`Exported ${picked.length} row(s) as CSV`, 'success'),
    })
  }

  function openCreate() {
    setForm({ kind: 'create' })
  }

  function openEdit(row: Row) {
    setForm({ kind: 'edit', id: row.id, draft: schema.rowToDraft(row) })
  }

  function closeForm() {
    if (!saving) setForm(null)
  }

  async function submitForm(body: Record<string, unknown>) {
    setSaving(true)
    try {
      if (usesApprovalQueue) {
        const operation = form?.kind === 'create' ? 'create' : 'update'
        await submitChangeRequest(token ?? '', {
          table: schema.table,
          operation,
          rowId: form?.kind === 'edit' ? form.id : undefined,
          payload: body,
        })
        notify('Change submitted for lead approval.', 'success')
        setForm(null)
        return
      }
      if (form?.kind === 'create') {
        const created = await apiFetch<Row>(`/api/data/${schema.table}`, {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        })
        notify('Row added.', 'success')
        setForm(null)
        const hl = String(created[highlightColumn] || '').trim()
        if (hl) setSearchParams({ [schema.highlightParam]: hl })
        setOffset(0)
        await load()
      } else if (form?.kind === 'edit') {
        await apiFetch(`/api/data/${schema.table}/${form.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(body),
        })
        notify('Row updated.', 'success')
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
    form?.kind === 'create' ? schema.emptyDraft : form?.kind === 'edit' ? form.draft : schema.emptyDraft

  const colSpan = schema.listColumns.length + 2

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={schema.eyebrow}
        title={schema.title}
        description={schema.description}
        actions={
          <div className="flex flex-wrap gap-2">
            {canWrite && !showArchived ? (
              <button
                type="button"
                onClick={openCreate}
                disabled={formOpen}
                className="rounded-lg bg-fo-gold px-4 py-2 text-xs font-medium uppercase tracking-wider text-fo-black hover:opacity-90 disabled:opacity-40 focus-ring-inset"
              >
                {schema.addLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                setExportErr(null)
                try {
                  await downloadExportCsv(token, schema.table, {
                    onSuccess: () => notify('Full register downloaded as CSV', 'success'),
                  })
                } catch (e) {
                  setExportErr((e as Error).message)
                }
              }}
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Export CSV
            </button>
            {schema.table === 'cash_banking' ? (
              <Link
                to="/treasury"
                className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
              >
                Treasury view
              </Link>
            ) : null}
            {['cash_banking', 'real_estate', 'public_securities', 'liabilities'].includes(schema.table) ? (
              <Link
                to="/entities"
                className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
              >
                Entity exposure
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

      {softDeleteEnabled ? (
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
          <span className="font-medium text-fo-amber">Read-only.</span> Your role can browse and export; adding or editing
          requires <strong className="text-zinc-100">lead</strong> or <strong className="text-zinc-100">analyst</strong>.{' '}
          <Link to="/maintenance" className="text-fo-gold-soft hover:underline">
            Data maintenance
          </Link>
          .
        </div>
      ) : null}

      {exportErr ? (
        <p role="alert" className="text-sm text-fo-red">
          {exportErr}
        </p>
      ) : null}
      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}
      {loading ? <LoadingBlock label={`Loading ${schema.documentTitle.toLowerCase()}…`} /> : null}

      {!loading && !err && highlightKey && !highlightOnPage && total > 0 ? (
        <p className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-4 py-2 text-xs text-fo-amber" role="status">
          No row matches &quot;{highlightKey}&quot; on this page — try another page or clear the URL filter.
        </p>
      ) : null}

      {someSelected ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-fo-gold/30 bg-fo-gold/5 px-4 py-3 text-sm"
        >
          <span className="text-zinc-300">
            <strong className="text-fo-gold-soft">{selected.size}</strong> selected
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
                  {schema.listColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-2 py-2 ${col.align === 'right' ? 'text-right' : ''}`}
                      scope="col"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-2 py-2" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rowKey = String(r[highlightColumn] || r.id).trim()
                  return (
                    <tr
                      key={r.id}
                      {...(rowKey ? { 'data-register-row': rowKey } : {})}
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
                      {schema.listColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-2 py-1 ${col.align === 'right' ? 'text-right' : ''} ${col.key === highlightColumn ? 'text-fo-gold-soft whitespace-nowrap' : ''} ${col.key === 'name_address' ? 'max-w-xs truncate' : ''}`}
                        >
                          {formatCell(r, col.key, col.format)}
                        </td>
                      ))}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-2">
                          {canWrite && !showArchived ? (
                            <button
                              type="button"
                              disabled={formOpen || archiveBusyId === Number(r.id)}
                              className="text-xs text-fo-gold disabled:opacity-30"
                              onClick={() => openEdit(r)}
                            >
                              {schema.editLabel}
                            </button>
                          ) : null}
                          {canWrite && softDeleteEnabled && !showArchived ? (
                            <button
                              type="button"
                              disabled={formOpen || archiveBusyId === Number(r.id)}
                              className="text-xs text-zinc-500 hover:text-fo-amber disabled:opacity-30"
                              onClick={() => archiveRow(r)}
                            >
                              Archive
                            </button>
                          ) : null}
                          {canWrite && softDeleteEnabled && showArchived ? (
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
                                  entityType: schema.entityType,
                                  entityId: String(r.id),
                                  title: schema.historyTitle(r),
                                  subtitle: schema.historySubtitle?.(r),
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
                    <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No rows yet.{' '}
                      {canWrite ? (
                        <button type="button" className="text-fo-gold-soft underline" onClick={openCreate}>
                          Add the first row
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

      <RegisterFormModal
        schema={schema}
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
