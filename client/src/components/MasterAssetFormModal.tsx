import { useCallback, useEffect, useId, useState } from 'react'
import {
  MASTER_ASSET_FIELD_GROUPS,
  type MasterAssetFieldKey,
  type MasterAssetFieldOptions,
  draftToMasterBody,
  validateMasterDraft,
} from '../lib/masterAssetFields'
import { apiFetch } from '../lib/api'

const EMPTY_OPTIONS: MasterAssetFieldOptions = {
  categories: [],
  jurisdictions: [],
  currencies: [],
}

const inputClass =
  'w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm text-white outline-none focus:border-fo-gold disabled:opacity-50'

type MasterAssetFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  initialDraft: Record<MasterAssetFieldKey, string>
  token: string
  busy?: boolean
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => Promise<void>
}

export function MasterAssetFormModal({
  open,
  mode,
  initialDraft,
  token,
  busy,
  onClose,
  onSubmit,
}: MasterAssetFormModalProps) {
  const titleId = useId()
  const [draft, setDraft] = useState(initialDraft)
  const [fieldErr, setFieldErr] = useState<string | null>(null)
  const [options, setOptions] = useState<MasterAssetFieldOptions>(EMPTY_OPTIONS)
  const [idLoading, setIdLoading] = useState(false)

  const loadOptions = useCallback(async () => {
    const qs = new URLSearchParams()
    if (draft.asset_category) qs.set('asset_category', draft.asset_category)
    if (draft.jurisdiction) qs.set('jurisdiction', draft.jurisdiction)
    if (draft.currency) qs.set('currency', draft.currency)
    if (draft.manager_custodian) qs.set('manager_custodian', draft.manager_custodian)
    const r = await apiFetch<MasterAssetFieldOptions>(`/api/data/master_assets/options?${qs.toString()}`, { token })
    setOptions(r)
  }, [token, draft.asset_category, draft.jurisdiction, draft.currency, draft.manager_custodian])

  const fetchNextAssetId = useCallback(
    async (category: string) => {
      setIdLoading(true)
      try {
        const qs = category ? `?category=${encodeURIComponent(category)}` : ''
        const r = await apiFetch<{ asset_id: string }>(`/api/data/master_assets/next-asset-id${qs}`, { token })
        setDraft((d) => ({ ...d, asset_id: r.asset_id }))
      } catch {
        /* keep prior code if API fails */
      } finally {
        setIdLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (open) {
      setDraft(initialDraft)
      setFieldErr(null)
    }
  }, [open, initialDraft])

  useEffect(() => {
    if (!open) return
    void loadOptions().catch(() => setOptions(EMPTY_OPTIONS))
  }, [open, loadOptions])

  useEffect(() => {
    if (!open || mode !== 'create') return
    void fetchNextAssetId(draft.asset_category || 'Other')
  }, [open, mode, draft.asset_category, fetchNextAssetId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  function setField(key: MasterAssetFieldKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validateMasterDraft(draft, mode)
    if (v) {
      setFieldErr(v)
      return
    }
    setFieldErr(null)
    await onSubmit(draftToMasterBody(draft))
  }

  function selectOptions(list: string[], current: string) {
    const out = [...list]
    if (current && !out.includes(current)) out.unshift(current)
    return out
  }

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
        className="relative z-10 flex w-full max-w-2xl flex-col max-h-[min(90vh,52rem)] rounded-t-2xl sm:rounded-2xl border border-fo-border bg-fo-graphite shadow-2xl"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-fo-border px-5 py-4 md:px-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">
              {mode === 'create' ? 'New register row' : 'Edit register row'}
            </p>
            <h2 id={titleId} className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
              {mode === 'create' ? 'Add master asset' : 'Asset details'}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {mode === 'create'
                ? 'Asset code is generated from category (e.g. OOI-RE-0001). Pick lists where shown; other fields stay free text.'
                : 'Asset code is fixed for this row. Update dropdowns or text fields as needed.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 md:px-6 space-y-6">
            {fieldErr ? (
              <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-3 py-2 text-sm text-fo-red">
                {fieldErr}
              </div>
            ) : null}

            {MASTER_ASSET_FIELD_GROUPS.map((group) => (
              <fieldset key={group.title} className="space-y-3">
                <legend className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{group.title}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields.map((f) => {
                    const list =
                      f.optionsKey === 'categories'
                        ? options.categories
                        : f.optionsKey === 'jurisdictions'
                          ? options.jurisdictions
                          : f.optionsKey === 'currencies'
                            ? options.currencies
                            : []

                    const readOnlyCode = f.key === 'asset_id'

                    return (
                      <label key={f.key} className="block space-y-1">
                        <span className="text-xs text-zinc-400">
                          {f.label}
                          {f.required ? <span className="text-fo-amber"> *</span> : null}
                        </span>
                        {f.control === 'select' ? (
                          <select
                            value={draft[f.key]}
                            disabled={busy}
                            onChange={(e) => setField(f.key, e.target.value)}
                            className={inputClass}
                          >
                            <option value="">— Select —</option>
                            {selectOptions(list, draft[f.key]).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : readOnlyCode ? (
                          <div
                            className={`${inputClass} bg-fo-black/40 text-fo-gold-soft font-mono text-xs tracking-wide`}
                            aria-readonly="true"
                          >
                            {idLoading && mode === 'create' ? 'Generating…' : draft[f.key] || '—'}
                          </div>
                        ) : (
                          <input
                            type="text"
                            inputMode={f.control === 'number' ? 'decimal' : undefined}
                            value={draft[f.key]}
                            placeholder={f.placeholder}
                            disabled={busy}
                            onChange={(e) => setField(f.key, e.target.value)}
                            className={inputClass}
                          />
                        )}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-fo-border px-5 py-4 md:px-6 bg-fo-graphite/80">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-fo-border px-4 py-2 text-sm text-zinc-300 hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (mode === 'create' && idLoading)}
              className="rounded-lg bg-fo-gold px-5 py-2 text-sm font-medium text-fo-black hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : mode === 'create' ? 'Add asset' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
