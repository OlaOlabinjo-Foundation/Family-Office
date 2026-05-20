import { softDeleteRow } from './registerData.js';

/**
 * Insert a register row (shared by direct API and approval apply).
 * @param {import('better-sqlite3').Database} database
 * @param {string} table
 * @param {Record<string, unknown>} body
 */
export function insertDataRow(database, table, body) {
  const cols = database
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((r) => r.name)
    .filter((n) => n !== 'id' && n !== 'updated_at' && n !== 'deleted_at' && n !== 'deleted_by');
  const insertCols = cols.filter((c) => body[c] !== undefined);
  if (!insertCols.length) return { ok: false, error: 'Provide at least one field' };
  const placeholders = insertCols.map((c) => `@${c}`).join(', ');
  const named = {};
  for (const c of insertCols) named[c] = body[c] ?? null;
  const sql = `INSERT INTO ${table} (${insertCols.join(', ')}, updated_at) VALUES (${placeholders}, datetime('now'))`;
  const info = database.prepare(sql).run(named);
  const created = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
  return { ok: true, row: created, insertCols };
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} table
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export function updateDataRow(database, table, id, patch) {
  const row = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!row) return { ok: false, error: 'Not found' };
  const cols = Object.keys(row).filter(
    (k) => k !== 'id' && k !== 'updated_at' && k !== 'deleted_at' && k !== 'deleted_by'
  );
  const updates = cols.filter((c) => Object.prototype.hasOwnProperty.call(patch, c));
  if (!updates.length) return { ok: false, error: 'No valid fields' };
  const sets = updates.map((c) => `${c} = @${c}`).join(', ');
  const params = { id, ...patch };
  for (const c of cols) if (params[c] === undefined) params[c] = row[c];
  database.prepare(`UPDATE ${table} SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
  const next = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return { ok: true, row: next, updates };
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} table
 * @param {number} id
 * @param {string} actor
 */
export function archiveDataRow(database, table, id, actor) {
  const row = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!row) return { ok: false, error: 'Not found' };
  const result = softDeleteRow(database, table, id, actor);
  return { ok: true, mode: result.mode };
}
