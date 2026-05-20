import { DEFAULT_CURRENCIES } from './masterAssetMeta.js';

function distinct(db, table, column) {
  const rows = db
    .prepare(
      `SELECT DISTINCT ${column} AS v FROM ${table}
       WHERE ${column} IS NOT NULL AND length(trim(${column})) > 0
       ORDER BY lower(trim(${column}))`
    )
    .all();
  return rows.map((r) => String(r.v).trim()).filter(Boolean);
}

function merge(base, fromDb, extra) {
  const set = new Set();
  for (const v of base) if (v) set.add(v);
  for (const v of fromDb) if (v) set.add(v);
  if (extra && String(extra).trim()) set.add(String(extra).trim());
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

const DEFAULT_ACCOUNT_TYPES = ['Current', 'Savings', 'Call', 'Fixed deposit', 'Brokerage', 'Other'];
const DEFAULT_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];
const DEFAULT_COUNTRIES = ['NG', 'UK', 'US', 'AE', 'GH', 'KE', 'ZA'];
const DEFAULT_PROPERTY_TYPES = ['Residential', 'Commercial', 'Land', 'Mixed use', 'Hospitality', 'Other'];
const DEFAULT_TITLE_HELD = ['Yes', 'No', 'In progress'];

/** @param {import('better-sqlite3').Database} db */
export function getCashBankingFieldOptions(db, { current } = {}) {
  return {
    currencies: merge(DEFAULT_CURRENCIES, distinct(db, 'cash_banking', 'currency'), current?.currency),
    accountTypes: merge(DEFAULT_ACCOUNT_TYPES, distinct(db, 'cash_banking', 'account_type'), current?.account_type),
    riskLevels: merge(DEFAULT_RISK_LEVELS, distinct(db, 'cash_banking', 'risk_level'), current?.risk_level),
  };
}

/** @param {import('better-sqlite3').Database} db */
export function getRealEstateFieldOptions(db, { current } = {}) {
  return {
    currencies: merge(DEFAULT_CURRENCIES, distinct(db, 'real_estate', 'currency'), current?.currency),
    countries: merge(DEFAULT_COUNTRIES, distinct(db, 'real_estate', 'country'), current?.country),
    propertyTypes: merge(DEFAULT_PROPERTY_TYPES, distinct(db, 'real_estate', 'property_type'), current?.property_type),
    riskLevels: merge(DEFAULT_RISK_LEVELS, distinct(db, 'real_estate', 'risk_level'), current?.risk_level),
    titleHeld: merge(DEFAULT_TITLE_HELD, distinct(db, 'real_estate', 'title_held'), current?.title_held),
  };
}

const DEFAULT_SECURITY_TYPES = ['Equity', 'Bond', 'ETF', 'Fund', 'Note', 'Other'];
const DEFAULT_FACILITY_TYPES = ['Term loan', 'Revolving credit', 'Mortgage', 'Bond', 'Other'];

/** @param {import('better-sqlite3').Database} db */
export function getPublicSecuritiesFieldOptions(db, { current } = {}) {
  return {
    currencies: merge(DEFAULT_CURRENCIES, distinct(db, 'public_securities', 'currency'), current?.currency),
    countries: merge(DEFAULT_COUNTRIES, distinct(db, 'public_securities', 'country'), current?.country),
    securityTypes: merge(
      DEFAULT_SECURITY_TYPES,
      distinct(db, 'public_securities', 'security_type'),
      current?.security_type
    ),
    riskLevels: merge(DEFAULT_RISK_LEVELS, distinct(db, 'public_securities', 'risk_level'), current?.risk_level),
  };
}

/** @param {import('better-sqlite3').Database} db */
export function getLiabilitiesFieldOptions(db, { current } = {}) {
  return {
    currencies: merge(DEFAULT_CURRENCIES, distinct(db, 'liabilities', 'currency'), current?.currency),
    facilityTypes: merge(
      DEFAULT_FACILITY_TYPES,
      distinct(db, 'liabilities', 'facility_type'),
      current?.facility_type
    ),
    riskLevels: merge(DEFAULT_RISK_LEVELS, distinct(db, 'liabilities', 'risk_level'), current?.risk_level),
  };
}
