import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const envPath = typeof process.env.FAMILY_OFFICE_SQLITE === 'string' ? process.env.FAMILY_OFFICE_SQLITE.trim() : '';
const dbPath = envPath || path.join(dataDir, 'family-office.sqlite');

export function getDatabaseFilePath() {
  return dbPath;
}

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT,
      asset_name TEXT,
      asset_category TEXT,
      asset_sub_type TEXT,
      legal_owner_entity TEXT,
      ownership_structure TEXT,
      jurisdiction TEXT,
      current_value REAL,
      currency TEXT,
      annual_income REAL,
      associated_debt REAL,
      net_value REAL,
      liquidity TEXT,
      strategic_core TEXT,
      manager_custodian TEXT,
      last_valuation_date TEXT,
      risk_level TEXT,
      document_reference TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cash_banking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT,
      bank_name TEXT,
      account_name TEXT,
      owner_entity TEXT,
      account_type TEXT,
      currency TEXT,
      current_balance REAL,
      average_monthly_outflow REAL,
      minimum_required_balance REAL,
      signatories TEXT,
      dual_approval TEXT,
      last_reconciled_date TEXT,
      risk_level TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS real_estate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT,
      property_id TEXT,
      name_address TEXT,
      property_type TEXT,
      country TEXT,
      owner_entity TEXT,
      property_purpose TEXT,
      purchase_year TEXT,
      purchase_price REAL,
      current_value REAL,
      currency TEXT,
      mortgage_balance TEXT,
      occupancy TEXT,
      property_manager TEXT,
      title_held TEXT,
      type_of_title TEXT,
      insurance_in_place TEXT,
      risk_level TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS public_securities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT,
      investment_name TEXT,
      ticker TEXT,
      exchange TEXT,
      sector TEXT,
      country TEXT,
      owner_entity TEXT,
      broker_custodian TEXT,
      security_type TEXT,
      units_shares REAL,
      purchase_price REAL,
      current_price REAL,
      currency TEXT,
      market_value REAL,
      liquidity TEXT,
      risk_level TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS operating_businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id TEXT,
      business_name TEXT,
      sector TEXT,
      country TEXT,
      owner TEXT,
      status TEXT,
      revenue REAL,
      ebitda REAL,
      estimated_equity_value REAL,
      associated_debt REAL,
      net_value REAL,
      key_manager TEXT,
      risk_level TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS private_investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT,
      investment_name TEXT,
      investment_type TEXT,
      country TEXT,
      owner_entity TEXT,
      ownership_pct REAL,
      board_seat TEXT,
      cost_base REAL,
      latest_valuation REAL,
      currency TEXT,
      associated_debt REAL,
      net_value REAL,
      exit_horizon TEXT,
      risk_level TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS liabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT,
      lender TEXT,
      borrower_entity TEXT,
      facility_type TEXT,
      original_amount REAL,
      outstanding_balance REAL,
      currency TEXT,
      interest_rate TEXT,
      maturity_date TEXT,
      security_collateral TEXT,
      personal_guarantee TEXT,
      risk_level TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS advisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      advisor_id TEXT,
      name TEXT,
      firm TEXT,
      role TEXT,
      email TEXT,
      phone TEXT,
      entities_covered TEXT,
      primary_contact TEXT,
      start_date TEXT,
      status TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT,
      document_category TEXT,
      entity_asset TEXT,
      available TEXT,
      requested_from TEXT,
      date_requested TEXT,
      date_received TEXT,
      storage_link TEXT,
      owner TEXT,
      status TEXT,
      risk_level TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      status TEXT,
      message TEXT,
      rows_summary TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_assets REAL,
      total_liabilities REAL,
      net_position REAL,
      cash_position REAL,
      liquidity_ratio REAL,
      health_score INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decision_actions (
      decision_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'resolved',
      resolved_at TEXT,
      resolved_by TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      meta_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_master_asset_id ON master_assets(asset_id);
    CREATE INDEX IF NOT EXISTS idx_cash_account ON cash_banking(account_id);
    CREATE INDEX IF NOT EXISTS idx_docs_entity ON documents(entity_asset);
    CREATE INDEX IF NOT EXISTS idx_snapshots_created ON portfolio_snapshots(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
  `);
}
