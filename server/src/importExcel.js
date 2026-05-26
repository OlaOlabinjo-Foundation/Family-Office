import XLSX from 'xlsx';
import { normalizeCurrencyCode } from './currency.js';

export function normHeader(h) {
  return String(h ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Build header -> index map from first row */
export function headerMap(row) {
  const m = new Map();
  row.forEach((cell, i) => {
    const k = normHeader(cell);
    if (k) m.set(k, i);
  });
  return m;
}

export function getCell(row, map, ...aliases) {
  for (const a of aliases) {
    const idx = map.get(normHeader(a));
    if (idx !== undefined) return row[idx];
  }
  return '';
}

export function parseNumber(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseWorkbook(buffer) {
  return XLSX.read(buffer, { type: 'buffer', cellDates: true });
}

export function sheetRows(wb, sheetName) {
  const sh = wb.Sheets[sheetName];
  if (!sh) return [];
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false });
}

export function isBlankRow(row) {
  return row.every((c) => String(c).trim() === '');
}

const SHEETS = {
  'Master Asset Register': 'master_assets',
  'Cash & Banking': 'cash_banking',
  'Real Estate': 'real_estate',
  'Public Securities': 'public_securities',
  'Operating Businesses': 'operating_businesses',
  'Private Investments': 'private_investments',
  Liabilities: 'liabilities',
  Advisors: 'advisors',
  'Document Tracker': 'documents'
};

export function detectSupportedSheets(wb) {
  return wb.SheetNames.filter((n) => SHEETS[n]);
}

export function mapRowsToEntities(wb) {
  const out = {};
  for (const [sheet, entity] of Object.entries(SHEETS)) {
    const rows = sheetRows(wb, sheet);
    if (!rows.length) {
      out[entity] = [];
      continue;
    }
    const hdr = headerMap(rows[0]);
    const data = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (isBlankRow(row)) continue;
      const rec = rowToRecord(entity, row, hdr);
      if (rec && !rec._skip) data.push(rec);
    }
    out[entity] = data;
  }
  return out;
}

function rowToRecord(entity, row, map) {
  switch (entity) {
    case 'master_assets': {
      const asset_id = String(getCell(row, map, 'Asset ID')).trim();
      if (!asset_id) return { _skip: true };
      return {
        asset_id,
        asset_name: String(getCell(row, map, 'Asset Name')),
        asset_category: String(getCell(row, map, 'Asset Category')),
        asset_sub_type: String(getCell(row, map, 'Asset Sub-Type', 'Asset Sub Type')),
        legal_owner_entity: String(getCell(row, map, 'Legal Owner / Entity', 'Legal Owner')),
        ownership_structure: String(getCell(row, map, 'Ownership Structure')),
        jurisdiction: String(getCell(row, map, 'Jurisdiction')),
        current_value: parseNumber(getCell(row, map, 'Current Value')),
        currency: normalizeCurrencyCode(getCell(row, map, 'Currency')),
        annual_income: parseNumber(getCell(row, map, 'Annual Income')),
        associated_debt: parseNumber(getCell(row, map, 'Associated Debt')),
        net_value: parseNumber(getCell(row, map, 'Net Value')),
        liquidity: String(getCell(row, map, 'Liquidity')),
        strategic_core: String(getCell(row, map, 'Strategic / Core', 'Strategic/Core')),
        manager_custodian: String(getCell(row, map, 'Manager / Custodian', 'Manager/Custodian')),
        last_valuation_date: excelDateToIso(getCell(row, map, 'Last Valuation Date')),
        risk_level: String(getCell(row, map, 'Risk Level')),
        document_reference: String(getCell(row, map, 'Document Reference'))
      };
    }
    case 'cash_banking': {
      const account_id = String(getCell(row, map, 'Account ID')).trim();
      if (!account_id) return { _skip: true };
      return {
        account_id,
        bank_name: String(getCell(row, map, 'Bank Name')),
        account_name: String(getCell(row, map, 'Account Name')),
        owner_entity: String(getCell(row, map, 'Owner Entity')),
        account_type: String(getCell(row, map, 'Account Type')),
        currency: normalizeCurrencyCode(getCell(row, map, 'Currency')),
        current_balance: parseNumber(getCell(row, map, 'Current Balance')),
        average_monthly_outflow: parseNumber(getCell(row, map, 'Average Monthly Outflow')),
        minimum_required_balance: parseNumber(getCell(row, map, 'Minimum Required Balance')),
        signatories: String(getCell(row, map, 'Signatories')),
        dual_approval: String(getCell(row, map, 'Dual Approval')),
        last_reconciled_date: excelDateToIso(getCell(row, map, 'Last Reconciled Date')),
        risk_level: String(getCell(row, map, 'Risk Level')),
        notes: String(getCell(row, map, 'Notes'))
      };
    }
    case 'real_estate': {
      const property_id = String(getCell(row, map, 'Property ID')).trim();
      const asset_id = String(getCell(row, map, 'Asset ID')).trim();
      if (!property_id && !asset_id) return { _skip: true };
      return {
        asset_id,
        property_id,
        name_address: String(getCell(row, map, 'Name / Address', 'Name/Address')),
        property_type: String(getCell(row, map, 'Property Type')),
        country: String(getCell(row, map, 'Country')),
        owner_entity: String(getCell(row, map, 'Owner Entity')),
        property_purpose: String(getCell(row, map, 'Property Purpose')),
        purchase_year: String(getCell(row, map, 'Purchase Year')),
        purchase_price: parseNumber(getCell(row, map, 'Purchase Price')),
        current_value: parseNumber(getCell(row, map, 'Current Value')),
        currency: normalizeCurrencyCode(getCell(row, map, 'Currency')),
        mortgage_balance: String(getCell(row, map, 'Mortgage/Payment  Balance', 'Mortgage Balance')),
        occupancy: String(getCell(row, map, 'Occupancy')),
        property_manager: String(getCell(row, map, 'Property Manager')),
        title_held: String(getCell(row, map, 'Title Held')),
        type_of_title: String(getCell(row, map, 'Type of Title')),
        insurance_in_place: String(getCell(row, map, 'Insurance In Place')),
        risk_level: String(getCell(row, map, 'Risk Level')),
        notes: String(getCell(row, map, 'Notes'))
      };
    }
    case 'public_securities': {
      const name = String(getCell(row, map, 'Investment Name')).trim();
      const ticker = String(getCell(row, map, 'Ticker')).trim();
      if (!name && !ticker) return { _skip: true };
      return {
        asset_id: String(getCell(row, map, 'Asset ID')),
        investment_name: String(getCell(row, map, 'Investment Name')),
        ticker: String(getCell(row, map, 'Ticker')),
        exchange: String(getCell(row, map, 'Exchange')),
        sector: String(getCell(row, map, 'Sector')),
        country: String(getCell(row, map, 'Country')),
        owner_entity: String(getCell(row, map, 'Owner Entity')),
        broker_custodian: String(getCell(row, map, 'Broker / Custodian', 'Broker/Custodian')),
        security_type: String(getCell(row, map, 'Security Type')),
        units_shares: parseNumber(getCell(row, map, 'Units / Shares', 'Units/Shares')),
        purchase_price: parseNumber(getCell(row, map, 'Purchase Price')),
        current_price: parseNumber(getCell(row, map, 'Current Price')),
        currency: normalizeCurrencyCode(getCell(row, map, 'Currency')),
        market_value: parseNumber(getCell(row, map, 'Market Value')),
        liquidity: String(getCell(row, map, 'Liquidity')),
        risk_level: String(getCell(row, map, 'Risk Level'))
      };
    }
    case 'operating_businesses': {
      const business_name = String(getCell(row, map, 'Business Name')).trim();
      if (!business_name) return { _skip: true };
      return {
        entity_id: String(getCell(row, map, 'Entity ID')),
        business_name,
        sector: String(getCell(row, map, 'Sector')),
        country: String(getCell(row, map, 'Country')),
        owner: String(getCell(row, map, 'Owner')),
        status: String(getCell(row, map, 'Status')),
        revenue: parseNumber(getCell(row, map, 'Revenue')),
        ebitda: parseNumber(getCell(row, map, 'EBITDA')),
        estimated_equity_value: parseNumber(getCell(row, map, 'Estimated Equity Value')),
        associated_debt: parseNumber(getCell(row, map, 'Associated Debt')),
        net_value: parseNumber(getCell(row, map, 'Net Value')),
        key_manager: String(getCell(row, map, 'Key Manager')),
        risk_level: String(getCell(row, map, 'Risk Level')),
        notes: String(getCell(row, map, 'Notes'))
      };
    }
    case 'private_investments': {
      const investment_name = String(getCell(row, map, 'Investment Name')).trim();
      if (!investment_name) return { _skip: true };
      return {
        asset_id: String(getCell(row, map, 'Asset ID')),
        investment_name,
        investment_type: String(getCell(row, map, 'Investment Type')),
        country: String(getCell(row, map, 'Country')),
        owner_entity: String(getCell(row, map, 'Owner Entity')),
        ownership_pct: parseNumber(getCell(row, map, 'Ownership %', 'Ownership')),
        board_seat: String(getCell(row, map, 'Board Seat')),
        cost_base: parseNumber(getCell(row, map, 'Cost Base')),
        latest_valuation: parseNumber(getCell(row, map, 'Latest Valuation')),
        currency: normalizeCurrencyCode(getCell(row, map, 'Currency')),
        associated_debt: parseNumber(getCell(row, map, 'Associated Debt')),
        net_value: parseNumber(getCell(row, map, 'Net Value')),
        exit_horizon: String(getCell(row, map, 'Exit Horizon')),
        risk_level: String(getCell(row, map, 'Risk Level')),
        notes: String(getCell(row, map, 'Notes'))
      };
    }
    case 'liabilities': {
      const facility_id = String(getCell(row, map, 'Facility ID')).trim();
      const outstanding = parseNumber(getCell(row, map, 'Outstanding Balance'));
      if (!facility_id && (outstanding === null || outstanding === 0)) return { _skip: true };
      return {
        facility_id,
        lender: String(getCell(row, map, 'Lender')),
        borrower_entity: String(getCell(row, map, 'Borrower Entity')),
        facility_type: String(getCell(row, map, 'Facility Type')),
        original_amount: parseNumber(getCell(row, map, 'Original Amount')),
        outstanding_balance: outstanding,
        currency: normalizeCurrencyCode(getCell(row, map, 'Currency')),
        interest_rate: String(getCell(row, map, 'Interest Rate')),
        maturity_date: excelDateToIso(getCell(row, map, 'Maturity Date')),
        security_collateral: String(getCell(row, map, 'Security / Collateral', 'Security/Collateral')),
        personal_guarantee: String(getCell(row, map, 'Personal Guarantee')),
        risk_level: String(getCell(row, map, 'Risk Level')),
        notes: String(getCell(row, map, 'Notes'))
      };
    }
    case 'advisors': {
      const name = String(getCell(row, map, 'Name')).trim();
      if (!name) return { _skip: true };
      return {
        advisor_id: String(getCell(row, map, 'Advisor ID')),
        name,
        firm: String(getCell(row, map, 'Firm')),
        role: String(getCell(row, map, 'Role')),
        email: String(getCell(row, map, 'Email')),
        phone: String(getCell(row, map, 'Phone')),
        entities_covered: String(getCell(row, map, 'Entities Covered')),
        primary_contact: String(getCell(row, map, 'Primary Contact')),
        start_date: excelDateToIso(getCell(row, map, 'Start Date')),
        status: String(getCell(row, map, 'Status')),
        notes: String(getCell(row, map, 'Notes'))
      };
    }
    case 'documents': {
      const docId = String(getCell(row, map, 'Document ID')).trim();
      const cat = String(getCell(row, map, 'Document Category')).trim();
      const entity = String(getCell(row, map, 'Entity / Asset', 'Entity/Asset')).trim();
      if (!docId && !cat && !entity) return { _skip: true };
      return {
        document_id: docId,
        document_category: cat,
        entity_asset: entity,
        available: String(getCell(row, map, 'Available')),
        requested_from: String(getCell(row, map, 'Requested From')),
        date_requested: excelDateToIso(getCell(row, map, 'Date Requested')),
        date_received: excelDateToIso(getCell(row, map, 'Date Received')),
        storage_link: String(getCell(row, map, 'Storage Location / Link', 'Storage Link')),
        owner: String(getCell(row, map, 'Owner')),
        status: String(getCell(row, map, 'Status')),
        risk_level: String(getCell(row, map, 'Risk Level')),
        notes: String(getCell(row, map, 'Notes'))
      };
    }
    default:
      return { _skip: true };
  }
}

function excelDateToIso(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const n = parseNumber(v);
  if (n !== null && n > 30000 && n < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + n * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

export function previewImport(buffer) {
  const wb = parseWorkbook(buffer);
  const entities = mapRowsToEntities(wb);
  const preview = {};
  for (const [k, rows] of Object.entries(entities)) {
    preview[k] = { count: rows.length, sample: rows.slice(0, 5) };
  }
  return { sheetNames: wb.SheetNames, supportedSheets: detectSupportedSheets(wb), preview };
}
