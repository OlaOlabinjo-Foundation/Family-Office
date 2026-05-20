import { db } from './db.js';

/** Registers that support soft delete / restore in the portal. */
export const SOFT_DELETE_TABLES = new Set([
  'master_assets',
  'cash_banking',
  'real_estate',
  'public_securities',
  'liabilities',
]);

const migrated = new Set();

/** @param {import('better-sqlite3').Database} database */
export function ensureSoftDeleteColumns(database = db) {
  for (const t of SOFT_DELETE_TABLES) {
    if (migrated.has(t)) continue;
    const cols = database.prepare(`PRAGMA table_info(${t})`).all().map((r) => r.name);
    if (!cols.includes('deleted_at')) {
      database.exec(`ALTER TABLE ${t} ADD COLUMN deleted_at TEXT`);
    }
    if (!cols.includes('deleted_by')) {
      database.exec(`ALTER TABLE ${t} ADD COLUMN deleted_by TEXT`);
    }
    migrated.add(t);
  }
}

/** @param {import('better-sqlite3').Database} database */
export function supportsSoftDelete(database, table) {
  ensureSoftDeleteColumns(database);
  return SOFT_DELETE_TABLES.has(table);
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} table
 * @param {{ archivedOnly?: boolean; includeDeleted?: boolean }} [opts]
 */
export function rowVisibilityWhere(database, table, opts = {}) {
  if (!supportsSoftDelete(database, table)) return { sql: '1=1', params: [] };
  if (opts.includeDeleted) return { sql: '1=1', params: [] };
  if (opts.archivedOnly) return { sql: 'deleted_at IS NOT NULL', params: [] };
  return { sql: 'deleted_at IS NULL', params: [] };
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} table
 * @param {number} id
 * @param {string} actor
 */
export function softDeleteRow(database, table, id, actor) {
  ensureSoftDeleteColumns(database);
  if (!SOFT_DELETE_TABLES.has(table)) {
    database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return { mode: 'hard' };
  }
  database
    .prepare(
      `UPDATE ${table} SET deleted_at = datetime('now'), deleted_by = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(actor, id);
  return { mode: 'soft' };
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} table
 * @param {number} id
 */
export function restoreRow(database, table, id) {
  ensureSoftDeleteColumns(database);
  if (!SOFT_DELETE_TABLES.has(table)) {
    return { ok: false, error: 'Restore not supported for this table.' };
  }
  const row = database.prepare(`SELECT id, deleted_at FROM ${table} WHERE id = ?`).get(id);
  if (!row) return { ok: false, error: 'Row not found.' };
  if (!row.deleted_at) return { ok: false, error: 'Row is not archived.' };
  database
    .prepare(
      `UPDATE ${table} SET deleted_at = NULL, deleted_by = NULL, updated_at = datetime('now') WHERE id = ?`
    )
    .run(id);
  return { ok: true };
}
