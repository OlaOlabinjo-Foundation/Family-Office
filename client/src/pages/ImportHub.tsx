import { useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'

export function ImportHub() {
  const { token, canWrite } = useAuth()
  const { show: notify } = useNotify()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<unknown>(null)
  const [phase, setPhase] = useState<null | 'preview' | 'confirm'>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const busy = phase !== null

  async function runPreview() {
    if (!file) return
    setPhase('preview')
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const j = await apiFetch<unknown>('/api/import/preview', { method: 'POST', body: fd, token })
      setPreview(j)
      notify('Preview ready — review the mapping summary below.', 'info')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setPhase(null)
    }
  }

  async function runConfirm() {
    if (!file || !canWrite) return
    setPhase('confirm')
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      type BackupInfo = { ok?: boolean; skipped?: boolean; path?: string; reason?: string }
      const res = await apiFetch<{ backup?: BackupInfo }>('/api/import/confirm', { method: 'POST', body: fd, token })
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

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Operations"
        title="Excel upload engine"
        description="Maps sheets: Master Asset Register, Cash & Banking, Real Estate, Public Securities, Operating Businesses, Private Investments, Liabilities, Advisors, Document Tracker — with duplicate detection on natural keys and full replace import on confirm."
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
            setFile(e.target.files?.[0] ?? null)
          }}
          className="text-sm disabled:opacity-40"
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!file || busy}
            aria-busy={phase === 'preview'}
            onClick={runPreview}
            className="rounded-md border border-fo-border bg-fo-panel px-4 py-2 text-sm hover:border-fo-gold disabled:cursor-not-allowed disabled:opacity-40 focus-ring-inset"
          >
            {phase === 'preview' ? 'Previewing…' : 'Preview mapping'}
          </button>
          <button
            type="button"
            disabled={!file || !canWrite || busy}
            aria-busy={phase === 'confirm'}
            onClick={runConfirm}
            className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:cursor-not-allowed disabled:opacity-40 focus-ring-inset"
          >
            {phase === 'confirm' ? 'Importing…' : 'Confirm import (replace)'}
          </button>
        </div>
        {!canWrite && <p className="text-xs text-fo-amber">Read-only role: preview only. Sign in as lead or analyst to confirm.</p>}
        {msg ? (
          <p role="alert" className="text-sm text-fo-red">
            {msg}
          </p>
        ) : null}
      </div>

      {preview != null ? (
        <pre className="text-xs bg-fo-panel border border-fo-border rounded-xl p-4 overflow-x-auto text-zinc-300 max-h-[480px] overflow-y-auto">
          {JSON.stringify(preview, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
