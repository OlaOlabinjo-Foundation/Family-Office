import { useEffect, useId, useState } from 'react'

const CONFIRM_WORD = 'IMPORT'

const TABLE_LABELS: Record<string, string> = {
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

export type ImportPreviewPayload = {
  filename?: string
  sheetNames?: string[]
  supportedSheets?: string[]
  preview?: Record<string, { count: number }>
}

type ImportConfirmModalProps = {
  open: boolean
  fileName: string
  preview: ImportPreviewPayload
  busy?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ImportConfirmModal({
  open,
  fileName,
  preview,
  busy,
  onClose,
  onConfirm,
}: ImportConfirmModalProps) {
  const titleId = useId()
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const rows = Object.entries(preview.preview ?? {})
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
  const totalRows = rows.reduce((acc, [, v]) => acc + v.count, 0)
  const canConfirm = typed.trim().toUpperCase() === CONFIRM_WORD && !busy

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/70"
        disabled={busy}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-fo-border bg-fo-graphite shadow-2xl"
      >
        <div className="border-b border-fo-border px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-fo-amber">Destructive action</p>
          <h2 id={titleId} className="mt-1 font-display text-lg text-white">
            Confirm workbook replace
          </h2>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            <span className="text-zinc-200">{fileName}</span> will replace all register data in the portal. A database
            backup is attempted on the server before rows are written.
          </p>
        </div>

        <div className="max-h-[min(50vh,20rem)] overflow-y-auto px-5 py-4 space-y-4">
          {rows.length ? (
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
                Rows to load ({totalRows.toLocaleString()} total)
              </p>
              <ul className="space-y-1.5 text-sm">
                {rows.map(([key, v]) => (
                  <li key={key} className="flex justify-between gap-2 rounded-md border border-fo-border/80 bg-fo-panel/30 px-3 py-2">
                    <span className="text-zinc-300">{TABLE_LABELS[key] ?? key}</span>
                    <span className="tabular-nums text-zinc-500">{v.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-fo-amber">No mapped rows in preview — run preview again or check the workbook sheets.</p>
          )}

          <div>
            <label htmlFor="import-confirm-word" className="mb-1 block text-xs text-zinc-500">
              Type <span className="font-mono text-fo-gold-soft">{CONFIRM_WORD}</span> to proceed
            </label>
            <input
              id="import-confirm-word"
              type="text"
              value={typed}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-fo-gold disabled:opacity-40"
              placeholder={CONFIRM_WORD}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-fo-border px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-md border border-fo-border px-4 py-2 text-sm text-zinc-300 hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Importing…' : 'Replace book from workbook'}
          </button>
        </div>
      </div>
    </div>
  )
}
