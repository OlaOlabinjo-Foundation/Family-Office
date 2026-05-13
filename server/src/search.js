const SECTION_LIMIT = 24;

/**
 * Cross-register search (Master, Cash, Real Estate, Documents, Liabilities).
 * @param {import('better-sqlite3').Database} database
 * @param {string} rawQuery
 */
export function globalSearch(database, rawQuery) {
  const q = String(rawQuery || '').trim();
  if (q.length < 2) {
    return {
      query: q,
      maxPerSection: SECTION_LIMIT,
      master_assets: [],
      cash_banking: [],
      real_estate: [],
      documents: [],
      liabilities: []
    };
  }
  const safe = q.replace(/%/g, '').replace(/_/g, '');
  const pattern = `%${safe.toLowerCase()}%`;

  const master_assets = database
    .prepare(
      `SELECT id, asset_id, asset_name, asset_category, jurisdiction
       FROM master_assets
       WHERE lower(ifnull(asset_id,'')) LIKE ?
          OR lower(ifnull(asset_name,'')) LIKE ?
          OR lower(ifnull(legal_owner_entity,'')) LIKE ?
          OR lower(ifnull(asset_category,'')) LIKE ?
       LIMIT ?`
    )
    .all(pattern, pattern, pattern, pattern, SECTION_LIMIT);

  const cash_banking = database
    .prepare(
      `SELECT id, account_id, bank_name, account_name, owner_entity, currency, current_balance, last_reconciled_date, risk_level
       FROM cash_banking
       WHERE lower(ifnull(account_id,'')) LIKE ?
          OR lower(ifnull(bank_name,'')) LIKE ?
          OR lower(ifnull(account_name,'')) LIKE ?
          OR lower(ifnull(owner_entity,'')) LIKE ?
       LIMIT ?`
    )
    .all(pattern, pattern, pattern, pattern, SECTION_LIMIT);

  const real_estate = database
    .prepare(
      `SELECT id, property_id, name_address, country, owner_entity, current_value, currency
       FROM real_estate
       WHERE lower(ifnull(property_id,'')) LIKE ?
          OR lower(ifnull(name_address,'')) LIKE ?
          OR lower(ifnull(owner_entity,'')) LIKE ?
          OR lower(ifnull(country,'')) LIKE ?
       LIMIT ?`
    )
    .all(pattern, pattern, pattern, pattern, SECTION_LIMIT);

  const documents = database
    .prepare(
      `SELECT id, document_id, document_category, entity_asset, status, owner
       FROM documents
       WHERE lower(ifnull(document_category,'')) LIKE ?
          OR lower(ifnull(entity_asset,'')) LIKE ?
          OR lower(ifnull(document_id,'')) LIKE ?
          OR lower(ifnull(owner,'')) LIKE ?
       LIMIT ?`
    )
    .all(pattern, pattern, pattern, pattern, SECTION_LIMIT);

  const liabilities = database
    .prepare(
      `SELECT id, facility_id, lender, borrower_entity, facility_type, outstanding_balance, currency, maturity_date
       FROM liabilities
       WHERE lower(ifnull(facility_id,'')) LIKE ?
          OR lower(ifnull(lender,'')) LIKE ?
          OR lower(ifnull(borrower_entity,'')) LIKE ?
          OR lower(ifnull(facility_type,'')) LIKE ?
       LIMIT ?`
    )
    .all(pattern, pattern, pattern, pattern, SECTION_LIMIT);

  return {
    query: q,
    maxPerSection: SECTION_LIMIT,
    master_assets,
    cash_banking,
    real_estate,
    documents,
    liabilities
  };
}
