import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { LoadingBlock } from './ui/LoadingBlock'
import { apiFetch } from '../lib/api'
import { downloadVaultFile, formatFileBytes, openVaultFileInTab } from '../lib/downloadVault'

export type VaultDrawerTarget = {
  documentRowId: number
  title: string
  subtitle?: string
}

type VaultFile = {
  id: number
  documentRowId: number
  originalFilename: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
  note: string | null
}

type VaultDrawerProps = {
  open: boolean
  target: VaultDrawerTarget | null
  token: string
  canWrite: boolean
  onClose: () => void
  onFilesChanged?: () => void
}

const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xlsx,.xls,.csv,.txt,application/pdf,image/*'

export function DocumentVaultDrawer({
  open,
  target,
  token,
  canWrite,
  onClose,
  onFilesChanged,
}: VaultDrawerProps) {
  const titleId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    if (!target) return
    const r = await apiFetch<{ files: VaultFile[] }>(`/api/documents/${target.documentRowId}/vault`, { token })
    setFiles(r.files)
  }, [token, target])

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

  async function onPickFile(file: File | null) {
    if (!file || !target || !canWrite) return
    setUploadBusy(true)
    setErr(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (note.trim()) fd.append('note', note.trim())
      await apiFetch(`/api/documents/${target.documentRowId}/vault`, {
        method: 'POST',
        body: fd,
        token,
      })
      setNote('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
      onFilesChanged?.()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setUploadBusy(false)
    }
  }

  async function onDelete(file: VaultFile) {
    if (!canWrite || !window.confirm(`Remove “${file.originalFilename}” from the vault?`)) return
    setDeleteBusyId(file.id)
    setErr(null)
    try {
      await apiFetch(`/api/vault/files/${file.id}`, { method: 'DELETE', token })
      await load()
      onFilesChanged?.()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setDeleteBusyId(null)
    }
  }

  if (!open || !target) return null

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        aria-label="Close document vault"
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
          <p className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Document vault</p>
          <h2 id={titleId} className="mt-1 font-[family-name:var(--font-display)] text-lg text-white">
            {target.title}
          </h2>
          {target.subtitle ? <p className="mt-1 text-xs text-zinc-500">{target.subtitle}</p> : null}
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
            Secure copies linked to this compliance row — title deeds, KYC packs, signed agreements. Files stay on the
            family office server, not in the Excel workbook.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {canWrite ? (
            <section className="rounded-xl border border-fo-border bg-fo-panel/40 p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-300">Upload evidence</p>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500" htmlFor="vault-note">
                Note (optional)
              </label>
              <input
                id="vault-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={uploadBusy}
                placeholder="e.g. Certified copy received from counsel"
                className="w-full min-h-11 rounded-lg border border-fo-border bg-fo-black px-3 text-base outline-none focus:border-fo-gold md:text-sm"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                disabled={uploadBusy}
                className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-fo-gold file:px-3 file:py-2 file:text-sm file:font-medium file:text-fo-black"
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[10px] text-zinc-600">PDF, images, Office, CSV · max 25 MB</p>
            </section>
          ) : (
            <p className="text-xs text-zinc-500">Read-only — ask lead or analyst to upload files.</p>
          )}

          {loading ? <LoadingBlock label="Loading vault…" /> : null}
          {err ? (
            <p role="alert" className="text-sm text-fo-red">
              {err}
            </p>
          ) : null}

          {!loading && !err && files.length === 0 ? (
            <p className="text-sm text-zinc-500">No files stored for this row yet.</p>
          ) : null}

          {!loading && files.length > 0 ? (
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="rounded-lg border border-fo-border bg-fo-panel/40 px-3 py-3 text-sm"
                >
                  <p className="font-medium text-zinc-200 break-words">{f.originalFilename}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {formatFileBytes(f.sizeBytes)} · {f.uploadedBy} ·{' '}
                    {String(f.uploadedAt).replace('T', ' ').slice(0, 16)}
                  </p>
                  {f.note ? <p className="mt-1.5 text-xs text-zinc-400 leading-snug">{f.note}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-touch rounded border border-fo-border px-3 text-[10px] uppercase tracking-wide text-zinc-300 hover:border-fo-gold/50"
                      onClick={() =>
                        void openVaultFileInTab(token, f.id).catch((e) => setErr((e as Error).message))
                      }
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="btn-touch rounded border border-fo-gold/40 bg-fo-gold/10 px-3 text-[10px] uppercase tracking-wide text-fo-gold-soft hover:bg-fo-gold/20"
                      onClick={() =>
                        void downloadVaultFile(token, f.id, f.originalFilename).catch((e) =>
                          setErr((e as Error).message)
                        )
                      }
                    >
                      Download
                    </button>
                    {canWrite ? (
                      <button
                        type="button"
                        disabled={deleteBusyId === f.id}
                        className="btn-touch rounded border border-fo-border px-3 text-[10px] uppercase tracking-wide text-zinc-400 hover:text-fo-red disabled:opacity-40"
                        onClick={() => void onDelete(f)}
                      >
                        {deleteBusyId === f.id ? '…' : 'Remove'}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-fo-border px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-touch rounded border border-fo-gold/40 bg-fo-gold/10 px-4 text-[10px] uppercase tracking-wide text-fo-gold-soft hover:bg-fo-gold/20"
          >
            Close
          </button>
        </div>
      </aside>
    </div>
  )
}
