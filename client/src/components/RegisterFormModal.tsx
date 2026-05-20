import { useCallback, useEffect, useId, useState } from 'react'
import type { RegisterFieldKey, RegisterSchema } from '../lib/registerSchemas'
import { apiFetch } from '../lib/api'

const inputClass =
  'w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm text-white outline-none focus:border-fo-gold disabled:opacity-50'

type RegisterFormModalProps = {
  schema: RegisterSchema
  open: boolean
  mode: 'create' | 'edit'
  initialDraft: Record<RegisterFieldKey, string>
  token: string
  busy?: boolean
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => Promise<void>
}

export function RegisterFormModal({
  schema,
  open,
  mode,
  initialDraft,
  token,
  busy,
  onClose,
  onSubmit,
}: RegisterFormModalProps) {
  const titleId = useId()
  const [draft, setDraft] = useState(initialDraft)
  const [fieldErr, setFieldErr] = useState<string | null>(null)
  const [options, setOptions] = useState<Record<string, string[]>>({})

  const loadOptions = useCallback(async () => {
    const qs = new URLSearchParams()
    for (const f of schema.allFields) {
      if (f.control === 'select' && f.optionsKey && draft[f.key]) {
        qs.set(f.key, draft[f.key])
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const r = await apiFetch<Record<string, string[]>>(`${schema.optionsPath}${suffix}`, { token })
    setOptions(r)
  }, [token, schema, draft])

  useEffect(() => {
    if (open) {
      setDraft(initialDraft)
      setFieldErr(null)
    }
  }, [open, initialDraft])

  useEffect(() => {
    if (!open) return
    void loadOptions().catch(() => setOptions({}))
  }, [open, loadOptions])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  function setField(key: RegisterFieldKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = schema.validate(draft, mode)
    if (v) {
      setFieldErr(v)
      return
    }
    setFieldErr(null)
    await onSubmit(schema.draftToBody(draft))
  }

  function selectOptions(list: string[] | undefined, current: string) {
    const out = [...(list ?? [])]
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
            <h2 id={titleId} className="mt-1 font-display text-2xl text-white">
              {mode === 'create' ? schema.createTitle : schema.editTitle}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 md:px-6 space-y-6">
            {fieldErr ? (
              <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-3 py-2 text-sm text-fo-red">
                {fieldErr}
              </div>
            ) : null}

            {schema.fieldGroups.map((group) => (
              <fieldset key={group.title} className="space-y-3">
                <legend className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{group.title}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields.map((f) => {
                    const list = f.optionsKey ? options[f.optionsKey] : undefined
                    return (
                      <label key={f.key} className="block space-y-1 sm:col-span-1">
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
                        ) : (
                          <input
                            type="text"
                            inputMode={f.control === 'number' ? 'decimal' : undefined}
                            value={draft[f.key]}
                            placeholder={f.placeholder}
                            disabled={busy || f.control === 'readonly'}
                            readOnly={f.control === 'readonly'}
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
              disabled={busy}
              className="rounded-lg bg-fo-gold px-5 py-2 text-sm font-medium text-fo-black hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : mode === 'create' ? schema.addLabel : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
