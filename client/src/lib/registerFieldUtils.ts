import type { RegisterFieldDef, RegisterFieldKey } from './registerSchemas'

export function rowToDraft(
  row: Record<string, unknown>,
  empty: Record<RegisterFieldKey, string>
): Record<RegisterFieldKey, string> {
  const d = { ...empty }
  for (const key of Object.keys(d) as RegisterFieldKey[]) {
    const v = row[key]
    d[key] = v === null || v === undefined ? '' : String(v)
  }
  return d
}

export function draftToBody(
  draft: Record<RegisterFieldKey, string>,
  numericKeys: readonly string[]
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const key of Object.keys(draft) as RegisterFieldKey[]) {
    const v = draft[key]
    if (numericKeys.includes(key)) {
      const n = Number(String(v).replace(/,/g, ''))
      body[key] = v.trim() === '' || Number.isNaN(n) ? null : n
    } else {
      body[key] = v.trim() === '' ? null : v.trim()
    }
  }
  return body
}

export function validateRequired(
  draft: Record<RegisterFieldKey, string>,
  fields: RegisterFieldDef[]
): string | null {
  for (const f of fields) {
    if (f.required && !String(draft[f.key] ?? '').trim()) {
      return `${f.label} is required.`
    }
  }
  return null
}
