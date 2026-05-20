import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ImportConfirmModal, type ImportPreviewPayload } from '../components/ImportConfirmModal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'

const PREVIEW_TABLE_LABELS: Record<string, string> = {
  master_assets: 'Master asset register',
  cash_banking: 'Cash & banking',
  real_estate: 'Real estate',
  public_securities: 'Public securities',
  operating_businesses: 'Operating businesses',
  private_investments: 'Private investments',
  liabilities: 'Liabilities',
  advisors: 'Advisors',
  documents: 'Document tracker',
  portfolio_snapshots: 'Portfolio snapshots',
}

export function ImportHub() {
  const { token, canWrite } = useAuth()
  const { show: notify } = useNotify()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewPayload | null>(null)
  const [phase, setPhase] = useState<null | 'preview' | 'confirm'>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [approvedBy, setApprovedBy] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')

  const busy = phase !== null

  async function runPreview() {
    if (!file) return
    setPhase('preview')
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const j = await apiFetch<ImportPreviewPayload>('/api/import/preview', { method: 'POST', body: fd, token })
      setPreview(j)
      notify('Preview ready — review row counts below, then confirm when ready.', 'info')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setPhase(null)
    }
  }

  function openConfirmModal() {
    if (!file || !canWrite) return
    if (!preview) {
      notify('Run preview mapping first so you can see what will be imported.', 'info')
      return
    }
    setConfirmOpen(true)
  }

  async function runConfirm() {
    if (!file || !canWrite) return
    setPhase('confirm')
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (approvedBy.trim()) fd.append('approvedBy', approvedBy.trim())
      if (effectiveDate.trim()) fd.append('effectiveDate', effectiveDate.trim())
      type BackupInfo = { ok?: boolean; skipped?: boolean; path?: string; reason?: string }
      const res = await apiFetch<{ backup?: BackupInfo }>('/api/import/confirm', { method: 'POST', body: fd, token })
      setConfirmOpen(false)
      setMsg(null)
      const b = res.backup
      let safety = ''
      if (b?.skipped) {
        safety =
          b.reason === 'memory_or_empty_path'
            ? ' No on-disk backup (in-memory or unset DB path).'
            : ' No on-disk backup was created for this environment.'
      } else if (b?.path) {
        safety = ' A pre-import database snapshot was saved on the server.'
      }
      notify(`Import complete — dashboard data replaced from workbook.${safety}`, 'success')
      setPreview(null)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setPhase(null)
    }
  }

  const previewRows = preview?.preview
    ? Object.entries(preview.preview)
        .filter(([, v]) => v.count > 0)
        .sort((a, b) => b[1].count - a[1].count)
    : []

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Operations"
        title="Excel upload engine"
        description="Maps sheets: Master Asset Register, Cash & Banking, Real Estate, Public Securities, Operating Businesses, Private Investments, Liabilities, Advisors, Document Tracker — with duplicate detection on natural keys and full replace import on confirm."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className="rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Command centre
            </Link>
            <Link
              to="/snapshots"
              className="rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Snapshots
            </Link>
            <Link
              to="/audit"
              className="rounded-lg border border-fo-border bg-fo-panel px-3 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Audit trail
            </Link>
          </div>
        }
      />

      <div
        className="space-y-4 rounded-2xl border border-fo-border bg-fo-graphite/40 p-5"
        aria-busy={busy}
        aria-live={busy ? 'polite' : undefined}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          aria-label="Workbook file to import"
          disabled={busy}
          onChange={(e) => {
            setPreview(null)
            setConfirmOpen(false)
            setFile(e.target.files?.[0] ?? null)
          }}
          className="text-sm disabled:opacity-40"
        />
        {canWrite ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="import-approved-by" className="mb-1 block text-xs text-zinc-500">
                Approver / owner (optional)
              </label>
              <input
                id="import-approved-by"
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                disabled={busy}
                placeholder="e.g. Family office lead"
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold disabled:opacity-40"
              />
            </div>
            <div>
              <label htmlFor="import-effective-date" className="mb-1 block text-xs text-zinc-500">
                Effective date (optional)
              </label>
              <input
                id="import-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold disabled:opacity-40"
              />
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!file || busy}
            aria-busy={phase === 'preview'}
            onClick={() => void runPreview()}
            className="rounded-md border border-fo-border bg-fo-panel px-4 py-2 text-sm hover:border-fo-gold disabled:cursor-not-allowed disabled:opacity-40 focus-ring-inset"
          >
            {phase === 'preview' ? 'Previewing…' : 'Preview mapping'}
          </button>
          <button
            type="button"
            disabled={!file || !canWrite || busy || !preview}
            onClick={openConfirmModal}
            className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:cursor-not-allowed disabled:opacity-40 focus-ring-inset"
          >
            Confirm import (replace)
          </button>
        </div>
        {!canWrite && <p className="text-xs text-fo-amber">Read-only role: preview only. Sign in as lead or analyst to confirm.</p>}
        {canWrite && file && !preview ? (
          <p className="text-xs text-zinc-500">Preview the workbook first — confirm is enabled after you review row counts.</p>
        ) : null}
        {msg ? (
          <p role="alert" className="text-sm text-fo-red">
            {msg}
          </p>
        ) : null}
      </div>

      {preview != null ? (
        <section className="rounded-2xl border border-fo-border bg-fo-panel/30 p-5 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Preview</p>
            <h2 className="font-display text-lg text-white mt-1">{preview.filename ?? file?.name ?? 'Workbook'}</h2>
            {preview.supportedSheets?.length ? (
              <p className="text-xs text-zinc-500 mt-1">
                Mapped sheets: {preview.supportedSheets.join(', ')}
              </p>
            ) : null}
          </div>
          {previewRows.length ? (
            <ul className="space-y-1.5 text-sm">
              {previewRows.map(([key, v]) => (
                <li key={key} className="flex justify-between gap-2 rounded-md border border-fo-border/80 px-3 py-2">
                  <span className="text-zinc-300">{PREVIEW_TABLE_LABELS[key] ?? key}</span>
                  <span className="tabular-nums text-zinc-500">{v.count.toLocaleString()} rows</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fo-amber">No rows mapped from this file — check sheet names match the operational workbook.</p>
          )}
        </section>
      ) : null}

      <ImportConfirmModal
        open={confirmOpen}
        fileName={file?.name ?? preview?.filename ?? 'Workbook'}
        preview={preview ?? {}}
        busy={phase === 'confirm'}
        onClose={() => {
          if (phase !== 'confirm') setConfirmOpen(false)
        }}
        onConfirm={() => void runConfirm()}
      />
    </div>
  )
}
