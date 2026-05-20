import { draftToBody, rowToDraft, validateRequired } from './registerFieldUtils'

export type RegisterFieldKey = string

export type RegisterFieldControl = 'text' | 'number' | 'select' | 'readonly'

export type RegisterFieldDef = {
  key: RegisterFieldKey
  label: string
  control: RegisterFieldControl
  required?: boolean
  placeholder?: string
  optionsKey?: string
}

export type RegisterColumn = {
  key: string
  label: string
  align?: 'right'
  format?: 'ngn' | 'compact'
}

export type RegisterSchema = {
  table: string
  documentTitle: string
  title: string
  eyebrow: string
  description: string
  addLabel: string
  editLabel: string
  createTitle: string
  editTitle: string
  entityType: string
  optionsPath: string
  highlightParam: string
  historyTitle: (row: Record<string, unknown>) => string
  historySubtitle?: (row: Record<string, unknown>) => string | undefined
  exportColumns: string[]
  listColumns: RegisterColumn[]
  fieldGroups: { title: string; fields: RegisterFieldDef[] }[]
  emptyDraft: Record<RegisterFieldKey, string>
  numericKeys: readonly string[]
  allFields: RegisterFieldDef[]
  rowToDraft: (row: Record<string, unknown>) => Record<RegisterFieldKey, string>
  draftToBody: (draft: Record<RegisterFieldKey, string>) => Record<string, unknown>
  validate: (draft: Record<RegisterFieldKey, string>, mode: 'create' | 'edit') => string | null
  softDelete?: boolean
  /** Analyst submits create/update/archive via approval queue (lead writes directly). */
  approvalQueue?: boolean
}

const CASH_NUMERIC = ['current_balance', 'average_monthly_outflow', 'minimum_required_balance'] as const

const CASH_FIELDS: RegisterFieldDef[] = [
  { key: 'account_id', label: 'Account ID', control: 'text', required: true },
  { key: 'bank_name', label: 'Bank name', control: 'text' },
  { key: 'account_name', label: 'Account name', control: 'text' },
  { key: 'owner_entity', label: 'Owner entity', control: 'text' },
  { key: 'account_type', label: 'Account type', control: 'select', optionsKey: 'accountTypes' },
  { key: 'currency', label: 'Currency', control: 'select', optionsKey: 'currencies' },
  { key: 'current_balance', label: 'Current balance', control: 'number' },
  { key: 'average_monthly_outflow', label: 'Average monthly outflow', control: 'number' },
  { key: 'minimum_required_balance', label: 'Minimum required balance', control: 'number' },
  { key: 'signatories', label: 'Signatories', control: 'text' },
  { key: 'dual_approval', label: 'Dual approval', control: 'text', placeholder: 'Yes / No' },
  { key: 'last_reconciled_date', label: 'Last reconciled date', control: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'risk_level', label: 'Risk level', control: 'select', optionsKey: 'riskLevels' },
  { key: 'notes', label: 'Notes', control: 'text' },
]

export const CASH_BANKING_SCHEMA: RegisterSchema = {
  table: 'cash_banking',
  documentTitle: 'Cash & banking',
  title: 'Cash & banking register',
  eyebrow: 'Registers',
  description:
    'Treasury accounts from the Cash & Banking sheet. Add or edit rows in the portal; changes are audited and flow to Treasury & liquidity.',
  addLabel: 'Add account',
  editLabel: 'Edit details',
  createTitle: 'Add cash account',
  editTitle: 'Account details',
  entityType: 'cash_banking',
  optionsPath: '/api/data/cash_banking/options',
  highlightParam: 'account',
  historyTitle: (r) => String(r.account_id || `Row #${r.id}`),
  historySubtitle: (r) => {
    const parts = [r.bank_name, r.account_name].filter(Boolean).map(String)
    return parts.length ? parts.join(' · ') : undefined
  },
  exportColumns: ['id', 'account_id', 'bank_name', 'account_name', 'owner_entity', 'currency', 'current_balance'],
  listColumns: [
    { key: 'account_id', label: 'Account ID' },
    { key: 'bank_name', label: 'Bank' },
    { key: 'account_name', label: 'Account name' },
    { key: 'owner_entity', label: 'Owner' },
    { key: 'currency', label: 'CCY' },
    { key: 'current_balance', label: 'Balance', align: 'right', format: 'ngn' },
  ],
  fieldGroups: [
    { title: 'Account', fields: CASH_FIELDS.slice(0, 5) },
    { title: 'Balances', fields: CASH_FIELDS.slice(5, 9) },
    { title: 'Controls', fields: CASH_FIELDS.slice(9) },
  ],
  emptyDraft: Object.fromEntries(CASH_FIELDS.map((f) => [f.key, f.key === 'currency' ? 'NGN' : ''])),
  numericKeys: CASH_NUMERIC,
  allFields: CASH_FIELDS,
  rowToDraft: (row) => rowToDraft(row, CASH_BANKING_SCHEMA.emptyDraft),
  draftToBody: (draft) => draftToBody(draft, CASH_NUMERIC),
  validate: (draft, mode) => {
    if (mode === 'create' && !draft.account_id.trim()) return 'Account ID is required.'
    return validateRequired(draft, CASH_FIELDS)
  },
  softDelete: true,
  approvalQueue: true,
}

const RE_NUMERIC = ['purchase_price', 'current_value'] as const

const RE_FIELDS: RegisterFieldDef[] = [
  { key: 'property_id', label: 'Property ID', control: 'text', required: true },
  { key: 'asset_id', label: 'Linked asset ID', control: 'text', placeholder: 'Master register asset code' },
  { key: 'name_address', label: 'Name / address', control: 'text', required: true },
  { key: 'property_type', label: 'Property type', control: 'select', optionsKey: 'propertyTypes' },
  { key: 'country', label: 'Country', control: 'select', optionsKey: 'countries' },
  { key: 'owner_entity', label: 'Owner entity', control: 'text' },
  { key: 'property_purpose', label: 'Purpose', control: 'text' },
  { key: 'property_manager', label: 'Property manager', control: 'text' },
  { key: 'purchase_year', label: 'Purchase year', control: 'text' },
  { key: 'purchase_price', label: 'Purchase price', control: 'number' },
  { key: 'current_value', label: 'Current value', control: 'number' },
  { key: 'currency', label: 'Currency', control: 'select', optionsKey: 'currencies' },
  { key: 'mortgage_balance', label: 'Mortgage / payment balance', control: 'text' },
  { key: 'occupancy', label: 'Occupancy', control: 'text' },
  { key: 'title_held', label: 'Title held', control: 'select', optionsKey: 'titleHeld' },
  { key: 'type_of_title', label: 'Type of title', control: 'text' },
  { key: 'insurance_in_place', label: 'Insurance in place', control: 'text', placeholder: 'Yes / No' },
  { key: 'risk_level', label: 'Risk level', control: 'select', optionsKey: 'riskLevels' },
  { key: 'notes', label: 'Notes', control: 'text' },
]

export const REAL_ESTATE_SCHEMA: RegisterSchema = {
  table: 'real_estate',
  documentTitle: 'Real estate',
  title: 'Real estate register',
  eyebrow: 'Registers',
  description:
    'Properties from the Real Estate sheet. Lead edits apply immediately; analyst changes go through the approval queue.',
  addLabel: 'Add property',
  editLabel: 'Edit details',
  createTitle: 'Add property',
  editTitle: 'Property details',
  entityType: 'real_estate',
  optionsPath: '/api/data/real_estate/options',
  highlightParam: 'property',
  historyTitle: (r) => String(r.property_id || r.asset_id || `Row #${r.id}`),
  historySubtitle: (r) => String(r.name_address || '').trim() || undefined,
  exportColumns: ['id', 'property_id', 'asset_id', 'name_address', 'country', 'current_value', 'title_held'],
  listColumns: [
    { key: 'property_id', label: 'Property ID' },
    { key: 'name_address', label: 'Name / address' },
    { key: 'country', label: 'Country' },
    { key: 'current_value', label: 'Value', align: 'right', format: 'ngn' },
    { key: 'title_held', label: 'Title' },
  ],
  fieldGroups: [
    { title: 'Identity', fields: RE_FIELDS.slice(0, 5) },
    { title: 'Ownership', fields: RE_FIELDS.slice(5, 8) },
    { title: 'Valuation', fields: RE_FIELDS.slice(8, 13) },
    { title: 'Legal & risk', fields: RE_FIELDS.slice(13) },
  ],
  emptyDraft: Object.fromEntries(RE_FIELDS.map((f) => [f.key, f.key === 'currency' ? 'NGN' : ''])),
  numericKeys: RE_NUMERIC,
  allFields: RE_FIELDS,
  rowToDraft: (row) => rowToDraft(row, REAL_ESTATE_SCHEMA.emptyDraft),
  draftToBody: (draft) => draftToBody(draft, RE_NUMERIC),
  validate: (draft) => {
    if (!draft.property_id.trim()) return 'Property ID is required.'
    if (!draft.name_address.trim()) return 'Name / address is required.'
    return validateRequired(draft, RE_FIELDS)
  },
  softDelete: true,
  approvalQueue: true,
}

const PS_NUMERIC = ['units_shares', 'purchase_price', 'current_price', 'market_value'] as const

const PS_FIELDS: RegisterFieldDef[] = [
  { key: 'asset_id', label: 'Asset ID', control: 'text' },
  { key: 'investment_name', label: 'Investment name', control: 'text', required: true },
  { key: 'ticker', label: 'Ticker', control: 'text' },
  { key: 'exchange', label: 'Exchange', control: 'text' },
  { key: 'sector', label: 'Sector', control: 'text' },
  { key: 'country', label: 'Country', control: 'select', optionsKey: 'countries' },
  { key: 'owner_entity', label: 'Owner entity', control: 'text' },
  { key: 'broker_custodian', label: 'Broker / custodian', control: 'text' },
  { key: 'security_type', label: 'Security type', control: 'select', optionsKey: 'securityTypes' },
  { key: 'units_shares', label: 'Units / shares', control: 'number' },
  { key: 'purchase_price', label: 'Purchase price', control: 'number' },
  { key: 'current_price', label: 'Current price', control: 'number' },
  { key: 'currency', label: 'Currency', control: 'select', optionsKey: 'currencies' },
  { key: 'market_value', label: 'Market value', control: 'number' },
  { key: 'liquidity', label: 'Liquidity', control: 'text' },
  { key: 'risk_level', label: 'Risk level', control: 'select', optionsKey: 'riskLevels' },
]

export const PUBLIC_SECURITIES_SCHEMA: RegisterSchema = {
  table: 'public_securities',
  documentTitle: 'Public securities',
  title: 'Public securities register',
  eyebrow: 'Registers',
  description:
    'Listed and traded holdings from the Public Securities sheet. Lead edits apply immediately; analyst changes go through the approval queue.',
  addLabel: 'Add holding',
  editLabel: 'Edit details',
  createTitle: 'Add security',
  editTitle: 'Security details',
  entityType: 'public_securities',
  optionsPath: '/api/data/public_securities/options',
  highlightParam: 'ticker',
  historyTitle: (r) => String(r.ticker || r.investment_name || `Row #${r.id}`),
  historySubtitle: (r) => String(r.investment_name || '').trim() || undefined,
  exportColumns: ['id', 'asset_id', 'investment_name', 'ticker', 'market_value', 'owner_entity'],
  listColumns: [
    { key: 'ticker', label: 'Ticker' },
    { key: 'investment_name', label: 'Name' },
    { key: 'owner_entity', label: 'Owner' },
    { key: 'market_value', label: 'Market value', align: 'right', format: 'ngn' },
    { key: 'risk_level', label: 'Risk' },
  ],
  fieldGroups: [
    { title: 'Identity', fields: PS_FIELDS.slice(0, 7) },
    { title: 'Position', fields: PS_FIELDS.slice(7, 14) },
    { title: 'Risk', fields: PS_FIELDS.slice(14) },
  ],
  emptyDraft: Object.fromEntries(PS_FIELDS.map((f) => [f.key, f.key === 'currency' ? 'NGN' : ''])),
  numericKeys: PS_NUMERIC,
  allFields: PS_FIELDS,
  rowToDraft: (row) => rowToDraft(row, Object.fromEntries(PS_FIELDS.map((f) => [f.key, f.key === 'currency' ? 'NGN' : '']))),
  draftToBody: (draft) => draftToBody(draft, PS_NUMERIC),
  validate: (draft) => {
    if (!draft.investment_name.trim() && !draft.ticker.trim()) {
      return 'Investment name or ticker is required.'
    }
    return validateRequired(draft, PS_FIELDS)
  },
  softDelete: true,
  approvalQueue: true,
}

const LIAB_NUMERIC = ['original_amount', 'outstanding_balance'] as const

const LIAB_FIELDS: RegisterFieldDef[] = [
  { key: 'facility_id', label: 'Facility ID', control: 'text', required: true },
  { key: 'lender', label: 'Lender', control: 'text' },
  { key: 'borrower_entity', label: 'Borrower entity', control: 'text' },
  { key: 'facility_type', label: 'Facility type', control: 'select', optionsKey: 'facilityTypes' },
  { key: 'original_amount', label: 'Original amount', control: 'number' },
  { key: 'outstanding_balance', label: 'Outstanding balance', control: 'number' },
  { key: 'currency', label: 'Currency', control: 'select', optionsKey: 'currencies' },
  { key: 'interest_rate', label: 'Interest rate', control: 'text' },
  { key: 'maturity_date', label: 'Maturity date', control: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'security_collateral', label: 'Security / collateral', control: 'text' },
  { key: 'personal_guarantee', label: 'Personal guarantee', control: 'text' },
  { key: 'risk_level', label: 'Risk level', control: 'select', optionsKey: 'riskLevels' },
  { key: 'notes', label: 'Notes', control: 'text' },
]

export const LIABILITIES_SCHEMA: RegisterSchema = {
  table: 'liabilities',
  documentTitle: 'Liabilities',
  title: 'Liabilities register',
  eyebrow: 'Registers',
  description:
    'Debt facilities from the Liabilities sheet. Lead edits apply immediately; analyst changes go through the approval queue.',
  addLabel: 'Add facility',
  editLabel: 'Edit details',
  createTitle: 'Add liability',
  editTitle: 'Facility details',
  entityType: 'liabilities',
  optionsPath: '/api/data/liabilities/options',
  highlightParam: 'facility',
  historyTitle: (r) => String(r.facility_id || `Row #${r.id}`),
  historySubtitle: (r) => String(r.lender || '').trim() || undefined,
  exportColumns: ['id', 'facility_id', 'lender', 'borrower_entity', 'outstanding_balance', 'maturity_date'],
  listColumns: [
    { key: 'facility_id', label: 'Facility ID' },
    { key: 'lender', label: 'Lender' },
    { key: 'borrower_entity', label: 'Borrower' },
    { key: 'outstanding_balance', label: 'Outstanding', align: 'right', format: 'ngn' },
    { key: 'maturity_date', label: 'Maturity' },
  ],
  fieldGroups: [
    { title: 'Facility', fields: LIAB_FIELDS.slice(0, 4) },
    { title: 'Terms', fields: LIAB_FIELDS.slice(4, 9) },
    { title: 'Security & notes', fields: LIAB_FIELDS.slice(9) },
  ],
  emptyDraft: Object.fromEntries(LIAB_FIELDS.map((f) => [f.key, f.key === 'currency' ? 'NGN' : ''])),
  numericKeys: LIAB_NUMERIC,
  allFields: LIAB_FIELDS,
  rowToDraft: (row) => rowToDraft(row, Object.fromEntries(LIAB_FIELDS.map((f) => [f.key, f.key === 'currency' ? 'NGN' : '']))),
  draftToBody: (draft) => draftToBody(draft, LIAB_NUMERIC),
  validate: (draft) => {
    if (!draft.facility_id.trim()) return 'Facility ID is required.'
    return validateRequired(draft, LIAB_FIELDS)
  },
  softDelete: true,
  approvalQueue: true,
}
