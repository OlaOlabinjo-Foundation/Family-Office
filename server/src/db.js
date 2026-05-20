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

    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_scrypt TEXT NOT NULL,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret_enc TEXT,
      mfa_pending_secret_enc TEXT,
      mfa_recovery_hashes TEXT,
      mfa_enabled_at TEXT,
      email TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_by TEXT NOT NULL,
      party_a_name TEXT NOT NULL,
      party_b_name TEXT NOT NULL,
      party_a_email TEXT,
      party_b_email TEXT,
      channel TEXT NOT NULL DEFAULT 'email',
      subject TEXT,
      body TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      notify_party TEXT NOT NULL DEFAULT 'both',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_notifications (
      task_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      notified_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assigned_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      detail TEXT,
      owner TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'P2',
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      completed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS compliance_calendar_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      entity TEXT,
      due_date TEXT NOT NULL,
      recurrence TEXT NOT NULL DEFAULT 'none',
      status TEXT NOT NULL DEFAULT 'pending',
      owner TEXT,
      notes TEXT,
      completed_at TEXT,
      completed_by TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      row_id INTEGER,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      submitted_by TEXT NOT NULL,
      submitted_at TEXT DEFAULT (datetime('now')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_comment TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_master_asset_id ON master_assets(asset_id);
    CREATE INDEX IF NOT EXISTS idx_cash_account ON cash_banking(account_id);
    CREATE INDEX IF NOT EXISTS idx_docs_entity ON documents(entity_asset);
    CREATE INDEX IF NOT EXISTS idx_snapshots_created ON portfolio_snapshots(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);
    CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status, submitted_at);
    CREATE INDEX IF NOT EXISTS idx_compliance_calendar_due ON compliance_calendar_items(status, due_date);

    CREATE TABLE IF NOT EXISTS document_vault_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_row_id INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now')),
      note TEXT,
      deleted_at TEXT,
      deleted_by TEXT,
      FOREIGN KEY (document_row_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_vault_document ON document_vault_files(document_row_id);
    CREATE INDEX IF NOT EXISTS idx_communications_occurred ON communications(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_assigned_tasks_status ON assigned_tasks(status, due_date);
    CREATE INDEX IF NOT EXISTS idx_vault_active ON document_vault_files(document_row_id, deleted_at);
  `);
  migrateImportHistoryColumns();
  migrateDocumentsReviewerColumns();
  migrateSoftDeleteColumns();
  migrateAppUsersMfaColumns();
  migrateAppUsersEmailColumn();
  migrateCommunicationsTables();
  migrateSystemKvTable();
}

function migrateSystemKvTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function migrateAppUsersEmailColumn() {
  try {
    const cols = db.prepare(`PRAGMA table_info(app_users)`).all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('email')) {
      db.exec(`ALTER TABLE app_users ADD COLUMN email TEXT`);
    }
  } catch {
    /* ignore */
  }
}

function migrateCommunicationsTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_by TEXT NOT NULL,
      party_a_name TEXT NOT NULL,
      party_b_name TEXT NOT NULL,
      party_a_email TEXT,
      party_b_email TEXT,
      channel TEXT NOT NULL DEFAULT 'email',
      subject TEXT,
      body TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      notify_party TEXT NOT NULL DEFAULT 'both',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS task_notifications (
      task_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      notified_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS assigned_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      detail TEXT,
      owner TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'P2',
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      completed_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_communications_occurred ON communications(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_assigned_tasks_status ON assigned_tasks(status, due_date);
  `);
}

function migrateAppUsersMfaColumns() {
  try {
    const cols = db.prepare(`PRAGMA table_info(app_users)`).all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('mfa_enabled')) {
      db.exec(`ALTER TABLE app_users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0`);
    }
    if (!names.has('mfa_secret_enc')) {
      db.exec(`ALTER TABLE app_users ADD COLUMN mfa_secret_enc TEXT`);
    }
    if (!names.has('mfa_pending_secret_enc')) {
      db.exec(`ALTER TABLE app_users ADD COLUMN mfa_pending_secret_enc TEXT`);
    }
    if (!names.has('mfa_recovery_hashes')) {
      db.exec(`ALTER TABLE app_users ADD COLUMN mfa_recovery_hashes TEXT`);
    }
    if (!names.has('mfa_enabled_at')) {
      db.exec(`ALTER TABLE app_users ADD COLUMN mfa_enabled_at TEXT`);
    }
  } catch {
    /* app_users may not exist in exotic setups */
  }
}

function migrateSoftDeleteColumns() {
  const tables = ['master_assets', 'cash_banking', 'real_estate', 'public_securities', 'liabilities'];
  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((r) => r.name);
    if (!cols.includes('deleted_at')) {
      db.exec(`ALTER TABLE ${t} ADD COLUMN deleted_at TEXT`);
    }
    if (!cols.includes('deleted_by')) {
      db.exec(`ALTER TABLE ${t} ADD COLUMN deleted_by TEXT`);
    }
  }
}

function migrateImportHistoryColumns() {
  try {
    const cols = db.prepare(`PRAGMA table_info(import_history)`).all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('approved_by')) {
      db.exec(`ALTER TABLE import_history ADD COLUMN approved_by TEXT`);
    }
    if (!names.has('effective_date')) {
      db.exec(`ALTER TABLE import_history ADD COLUMN effective_date TEXT`);
    }
  } catch {
    /* import_history may not exist in exotic test setups */
  }
}

function migrateDocumentsReviewerColumns() {
  try {
    const cols = db.prepare(`PRAGMA table_info(documents)`).all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('reviewed_at')) {
      db.exec(`ALTER TABLE documents ADD COLUMN reviewed_at TEXT`);
    }
    if (!names.has('reviewed_by')) {
      db.exec(`ALTER TABLE documents ADD COLUMN reviewed_by TEXT`);
    }
  } catch {
    /* documents table missing in exotic setups */
  }
}
