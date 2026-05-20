/** Master register columns (matches SQLite `master_assets`). */
export const MASTER_ASSET_NUMERIC_KEYS = ['current_value', 'annual_income', 'associated_debt', 'net_value'] as const

export type MasterAssetFieldKey =
  | 'asset_id'
  | 'asset_name'
  | 'asset_category'
  | 'asset_sub_type'
  | 'legal_owner_entity'
  | 'ownership_structure'
  | 'jurisdiction'
  | 'current_value'
  | 'currency'
  | 'annual_income'
  | 'associated_debt'
  | 'net_value'
  | 'liquidity'
  | 'strategic_core'
  | 'manager_custodian'
  | 'last_valuation_date'
  | 'risk_level'
  | 'document_reference'

export type MasterAssetControl = 'text' | 'number' | 'select' | 'readonly'

export type MasterAssetFieldDef = {
  key: MasterAssetFieldKey
  label: string
  control: MasterAssetControl
  required?: boolean
  placeholder?: string
  /** When control is `select`, key into MasterAssetFieldOptions */
  optionsKey?: 'categories' | 'jurisdictions' | 'currencies'
}

export type MasterAssetFieldOptions = {
  categories: string[]
  jurisdictions: string[]
  currencies: string[]
}

export const MASTER_ASSET_FIELD_GROUPS: { title: string; fields: MasterAssetFieldDef[] }[] = [
  {
    title: 'Identity',
    fields: [
      {
        key: 'asset_id',
        label: 'Asset code',
        control: 'readonly',
        required: true,
        placeholder: 'Generated when you save',
      },
      { key: 'asset_name', label: 'Asset name', control: 'text', required: true },
      {
        key: 'asset_category',
        label: 'Category',
        control: 'select',
        optionsKey: 'categories',
        required: true,
      },
      { key: 'asset_sub_type', label: 'Sub-type', control: 'text' },
    ],
  },
  {
    title: 'Ownership',
    fields: [
      { key: 'legal_owner_entity', label: 'Legal owner / entity', control: 'text' },
      { key: 'ownership_structure', label: 'Ownership structure', control: 'text' },
      {
        key: 'jurisdiction',
        label: 'Jurisdiction',
        control: 'select',
        optionsKey: 'jurisdictions',
      },
      {
        key: 'manager_custodian',
        label: 'Manager / custodian',
        control: 'text',
        placeholder: 'e.g. bank, fund admin, custodian name',
      },
    ],
  },
  {
    title: 'Valuation (NGN book)',
    fields: [
      { key: 'current_value', label: 'Current value', control: 'number' },
      { key: 'currency', label: 'Currency', control: 'select', optionsKey: 'currencies' },
      { key: 'annual_income', label: 'Annual income', control: 'number' },
      { key: 'associated_debt', label: 'Associated debt', control: 'number' },
      { key: 'net_value', label: 'Net value', control: 'number' },
      { key: 'last_valuation_date', label: 'Last valuation date', control: 'text', placeholder: 'YYYY-MM-DD' },
    ],
  },
  {
    title: 'Classification',
    fields: [
      { key: 'liquidity', label: 'Liquidity', control: 'text', placeholder: 'Liquid / Illiquid' },
      { key: 'strategic_core', label: 'Strategic / core', control: 'text' },
      { key: 'risk_level', label: 'Risk level', control: 'text', placeholder: 'Low / Medium / High' },
      { key: 'document_reference', label: 'Document reference', control: 'text' },
    ],
  },
]

export const EMPTY_MASTER_ASSET_DRAFT: Record<MasterAssetFieldKey, string> = {
  asset_id: '',
  asset_name: '',
  asset_category: 'Other',
  asset_sub_type: '',
  legal_owner_entity: '',
  ownership_structure: '',
  jurisdiction: 'NG',
  current_value: '',
  currency: 'NGN',
  annual_income: '',
  associated_debt: '',
  net_value: '',
  liquidity: '',
  strategic_core: '',
  manager_custodian: '',
  last_valuation_date: '',
  risk_level: '',
  document_reference: '',
}

export function rowToMasterDraft(row: Record<string, unknown>): Record<MasterAssetFieldKey, string> {
  const d = { ...EMPTY_MASTER_ASSET_DRAFT }
  for (const key of Object.keys(d) as MasterAssetFieldKey[]) {
    const v = row[key]
    d[key] = v === null || v === undefined ? '' : String(v)
  }
  return d
}

export function draftToMasterBody(draft: Record<MasterAssetFieldKey, string>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const key of Object.keys(draft) as MasterAssetFieldKey[]) {
    const v = draft[key]
    if (MASTER_ASSET_NUMERIC_KEYS.includes(key as (typeof MASTER_ASSET_NUMERIC_KEYS)[number])) {
      const n = Number(String(v).replace(/,/g, ''))
      body[key] = v.trim() === '' || Number.isNaN(n) ? null : n
    } else {
      body[key] = v.trim() === '' ? null : v.trim()
    }
  }
  return body
}

export function validateMasterDraft(draft: Record<MasterAssetFieldKey, string>, mode: 'create' | 'edit'): string | null {
  if (mode === 'create' && !draft.asset_id.trim()) return 'Asset code is still generating — wait a moment or pick a category.'
  if (!draft.asset_name.trim()) return 'Asset name is required.'
  if (!draft.asset_category.trim()) return 'Category is required.'
  return null
}
