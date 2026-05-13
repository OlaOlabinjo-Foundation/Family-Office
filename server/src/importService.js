import { db } from './db.js';
import { mapRowsToEntities, parseWorkbook } from './importExcel.js';

const INSERTS = {
  master_assets: `INSERT INTO master_assets (
    asset_id, asset_name, asset_category, asset_sub_type, legal_owner_entity, ownership_structure,
    jurisdiction, current_value, currency, annual_income, associated_debt, net_value, liquidity,
    strategic_core, manager_custodian, last_valuation_date, risk_level, document_reference
  ) VALUES (
    @asset_id, @asset_name, @asset_category, @asset_sub_type, @legal_owner_entity, @ownership_structure,
    @jurisdiction, @current_value, @currency, @annual_income, @associated_debt, @net_value, @liquidity,
    @strategic_core, @manager_custodian, @last_valuation_date, @risk_level, @document_reference
  )`,
  cash_banking: `INSERT INTO cash_banking (
    account_id, bank_name, account_name, owner_entity, account_type, currency, current_balance,
    average_monthly_outflow, minimum_required_balance, signatories, dual_approval, last_reconciled_date,
    risk_level, notes
  ) VALUES (
    @account_id, @bank_name, @account_name, @owner_entity, @account_type, @currency, @current_balance,
    @average_monthly_outflow, @minimum_required_balance, @signatories, @dual_approval, @last_reconciled_date,
    @risk_level, @notes
  )`,
  real_estate: `INSERT INTO real_estate (
    asset_id, property_id, name_address, property_type, country, owner_entity, property_purpose,
    purchase_year, purchase_price, current_value, currency, mortgage_balance, occupancy, property_manager,
    title_held, type_of_title, insurance_in_place, risk_level, notes
  ) VALUES (
    @asset_id, @property_id, @name_address, @property_type, @country, @owner_entity, @property_purpose,
    @purchase_year, @purchase_price, @current_value, @currency, @mortgage_balance, @occupancy, @property_manager,
    @title_held, @type_of_title, @insurance_in_place, @risk_level, @notes
  )`,
  public_securities: `INSERT INTO public_securities (
    asset_id, investment_name, ticker, exchange, sector, country, owner_entity, broker_custodian,
    security_type, units_shares, purchase_price, current_price, currency, market_value, liquidity, risk_level
  ) VALUES (
    @asset_id, @investment_name, @ticker, @exchange, @sector, @country, @owner_entity, @broker_custodian,
    @security_type, @units_shares, @purchase_price, @current_price, @currency, @market_value, @liquidity, @risk_level
  )`,
  operating_businesses: `INSERT INTO operating_businesses (
    entity_id, business_name, sector, country, owner, status, revenue, ebitda, estimated_equity_value,
    associated_debt, net_value, key_manager, risk_level, notes
  ) VALUES (
    @entity_id, @business_name, @sector, @country, @owner, @status, @revenue, @ebitda, @estimated_equity_value,
    @associated_debt, @net_value, @key_manager, @risk_level, @notes
  )`,
  private_investments: `INSERT INTO private_investments (
    asset_id, investment_name, investment_type, country, owner_entity, ownership_pct, board_seat,
    cost_base, latest_valuation, currency, associated_debt, net_value, exit_horizon, risk_level, notes
  ) VALUES (
    @asset_id, @investment_name, @investment_type, @country, @owner_entity, @ownership_pct, @board_seat,
    @cost_base, @latest_valuation, @currency, @associated_debt, @net_value, @exit_horizon, @risk_level, @notes
  )`,
  liabilities: `INSERT INTO liabilities (
    facility_id, lender, borrower_entity, facility_type, original_amount, outstanding_balance, currency,
    interest_rate, maturity_date, security_collateral, personal_guarantee, risk_level, notes
  ) VALUES (
    @facility_id, @lender, @borrower_entity, @facility_type, @original_amount, @outstanding_balance, @currency,
    @interest_rate, @maturity_date, @security_collateral, @personal_guarantee, @risk_level, @notes
  )`,
  advisors: `INSERT INTO advisors (
    advisor_id, name, firm, role, email, phone, entities_covered, primary_contact, start_date, status, notes
  ) VALUES (
    @advisor_id, @name, @firm, @role, @email, @phone, @entities_covered, @primary_contact, @start_date, @status, @notes
  )`,
  documents: `INSERT INTO documents (
    document_id, document_category, entity_asset, available, requested_from, date_requested, date_received,
    storage_link, owner, status, risk_level, notes
  ) VALUES (
    @document_id, @document_category, @entity_asset, @available, @requested_from, @date_requested, @date_received,
    @storage_link, @owner, @status, @risk_level, @notes
  )`
};

const TABLES = Object.keys(INSERTS);

export function clearOperationalTables() {
  const tx = db.transaction(() => {
    for (const t of TABLES) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
  });
  tx();
}

function nullify(row) {
  const o = { ...row };
  for (const k of Object.keys(o)) {
    if (o[k] === undefined) o[k] = null;
  }
  return o;
}

export function importEntities(entities, { replace = true } = {}) {
  if (replace) clearOperationalTables();

  const summary = {};
  const tx = db.transaction(() => {
    for (const table of TABLES) {
      const rows = entities[table] || [];
      const stmt = db.prepare(INSERTS[table]);
      let inserted = 0;
      let duplicates = 0;
      const seen = new Set();
      for (const row of rows) {
        const key = naturalKey(table, row);
        if (key && seen.has(key)) {
          duplicates++;
          continue;
        }
        if (key) seen.add(key);
        stmt.run(nullify(row));
        inserted++;
      }
      summary[table] = { inserted, duplicates };
    }
  });
  tx();
  return summary;
}

function naturalKey(table, row) {
  switch (table) {
    case 'master_assets':
      return row.asset_id || null;
    case 'cash_banking':
      return row.account_id || null;
    case 'real_estate':
      return row.property_id || row.asset_id || null;
    case 'public_securities':
      return `${row.ticker}|${row.investment_name}`;
    case 'operating_businesses':
      return row.business_name || null;
    case 'private_investments':
      return row.investment_name || null;
    case 'liabilities':
      return row.facility_id || `${row.lender}|${row.borrower_entity}`;
    case 'advisors':
      return row.name || null;
    case 'documents':
      return `${row.document_id}|${row.document_category}|${row.entity_asset}`;
    default:
      return null;
  }
}

export function importBuffer(buffer, options) {
  const wb = parseWorkbook(buffer);
  const entities = mapRowsToEntities(wb);
  const summary = importEntities(entities, options);
  return { summary, entities };
}

export function logImport(filename, status, message, rows_summary) {
  db.prepare(
    `INSERT INTO import_history (filename, status, message, rows_summary) VALUES (?, ?, ?, ?)`
  ).run(filename, status, message, JSON.stringify(rows_summary));
}
