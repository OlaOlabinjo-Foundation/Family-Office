import { db } from './db.js';
import { logAudit } from './audit.js';
import { archiveDataRow, insertDataRow, updateDataRow } from './dataMutations.js';
import { SOFT_DELETE_TABLES } from './registerData.js';

/** Registers where analyst writes go through approval (lead applies directly). */
export const APPROVAL_TABLES = SOFT_DELETE_TABLES;

const VALID_OPS = new Set(['create', 'update', 'archive']);

function rowToRequest(r) {
  let payload = {};
  try {
    payload = r.payload_json ? JSON.parse(r.payload_json) : {};
  } catch {
    payload = {};
  }
  return {
    id: r.id,
    table: r.table_name,
    operation: r.operation,
    rowId: r.row_id,
    payload,
    status: r.status,
    submittedBy: r.submitted_by,
    submittedAt: r.submitted_at,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    reviewComment: r.review_comment,
    summary: summarizeRequest(r.table_name, r.operation, payload, r.row_id),
  };
}

function summarizeRequest(table, operation, payload, rowId) {
  if (table === 'master_assets') {
    const label = payload.asset_id || payload.asset_name || (rowId ? `row #${rowId}` : 'new asset');
    if (operation === 'archive') return `Archive master asset: ${label}`;
    if (operation === 'create') return `Add master asset: ${label}`;
    return `Update master asset: ${label}`;
  }
  if (table === 'cash_banking') {
    const label = payload.account_id || payload.bank_name || (rowId ? `row #${rowId}` : 'new account');
    if (operation === 'archive') return `Archive cash account: ${label}`;
    if (operation === 'create') return `Add cash account: ${label}`;
    return `Update cash account: ${label}`;
  }
  if (table === 'real_estate') {
    const label = payload.property_id || payload.name_address || (rowId ? `row #${rowId}` : 'new property');
    if (operation === 'archive') return `Archive property: ${label}`;
    if (operation === 'create') return `Add property: ${label}`;
    return `Update property: ${label}`;
  }
  if (table === 'public_securities') {
    const label =
      payload.ticker || payload.investment_name || (rowId ? `row #${rowId}` : 'new holding');
    if (operation === 'archive') return `Archive security: ${label}`;
    if (operation === 'create') return `Add security: ${label}`;
    return `Update security: ${label}`;
  }
  if (table === 'liabilities') {
    const label = payload.facility_id || payload.lender || (rowId ? `row #${rowId}` : 'new facility');
    if (operation === 'archive') return `Archive liability: ${label}`;
    if (operation === 'create') return `Add liability: ${label}`;
    return `Update liability: ${label}`;
  }
  return `${operation} on ${table}`;
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function submitChangeRequest(
  database,
  { table, operation, rowId = null, payload = {}, submittedBy }
) {
  if (!APPROVAL_TABLES.has(table)) {
    return { ok: false, error: 'This register does not use the approval queue.' };
  }
  if (!VALID_OPS.has(operation)) {
    return { ok: false, error: 'Invalid operation.' };
  }
  if ((operation === 'update' || operation === 'archive') && !rowId) {
    return { ok: false, error: 'rowId is required for update and archive.' };
  }
  if (operation === 'create' && rowId) {
    return { ok: false, error: 'rowId must not be set for create.' };
  }
  if (operation !== 'archive' && (!payload || typeof payload !== 'object')) {
    return { ok: false, error: 'Payload is required.' };
  }
  if (rowId) {
    const exists = database.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(rowId);
    if (!exists) return { ok: false, error: 'Target row not found.' };
  }

  const info = database
    .prepare(
      `INSERT INTO change_requests (table_name, operation, row_id, payload_json, status, submitted_by)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    )
    .run(table, operation, rowId, JSON.stringify(payload || {}), submittedBy);

  const created = database.prepare(`SELECT * FROM change_requests WHERE id = ?`).get(info.lastInsertRowid);
  logAudit(database, {
    actor: submittedBy,
    action: 'change_request.submit',
    entityType: 'change_request',
    entityId: String(created.id),
    meta: { table, operation, rowId, summary: summarizeRequest(table, operation, payload, rowId) },
  });

  return { ok: true, request: rowToRequest(created), notifyTasks: true };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function listChangeRequests(
  database,
  { status = 'pending', limit = 50, offset = 0, submittedBy = null } = {}
) {
  const filterAll = status === 'all';
  const bySubmitter = submittedBy ? ' AND submitted_by = ?' : '';
  const submitArgs = submittedBy ? [submittedBy] : [];

  const total = filterAll
    ? database.prepare(`SELECT COUNT(*) AS c FROM change_requests WHERE 1=1${bySubmitter}`).get(...submitArgs).c
    : database
        .prepare(`SELECT COUNT(*) AS c FROM change_requests WHERE status = ?${bySubmitter}`)
        .get(status, ...submitArgs).c;

  const rows = filterAll
    ? database
        .prepare(
          `SELECT * FROM change_requests WHERE 1=1${bySubmitter} ORDER BY submitted_at DESC LIMIT ? OFFSET ?`
        )
        .all(...submitArgs, limit, offset)
    : database
        .prepare(
          `SELECT * FROM change_requests WHERE status = ?${bySubmitter} ORDER BY submitted_at DESC LIMIT ? OFFSET ?`
        )
        .all(status, ...submitArgs, limit, offset);

  return { items: rows.map(rowToRequest), total, limit, offset };
}

function applyRequest(database, req, actor) {
  const payload = req.payload || {};
  const table = req.table;
  const via = { viaRequest: req.id };

  if (req.operation === 'create') {
    const result = insertDataRow(database, table, payload);
    if (!result.ok) return result;
    logAudit(database, {
      actor,
      action: 'data.create',
      entityType: table,
      entityId: String(result.row.id),
      meta: { keys: result.insertCols, ...via },
    });
    return { ok: true, row: result.row };
  }

  if (req.operation === 'update') {
    const result = updateDataRow(database, table, req.rowId, payload);
    if (!result.ok) return result;
    logAudit(database, {
      actor,
      action: 'data.update',
      entityType: table,
      entityId: String(req.rowId),
      meta: { fields: result.updates, ...via },
    });
    return { ok: true, row: result.row };
  }

  if (req.operation === 'archive') {
    const result = archiveDataRow(database, table, req.rowId, actor);
    if (!result.ok) return result;
    logAudit(database, {
      actor,
      action: result.mode === 'soft' ? 'data.soft_delete' : 'data.delete',
      entityType: table,
      entityId: String(req.rowId),
      meta: via,
    });
    return { ok: true };
  }

  return { ok: false, error: 'Unknown operation' };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function approveChangeRequest(database, id, reviewer, comment = '') {
  const raw = database.prepare(`SELECT * FROM change_requests WHERE id = ?`).get(id);
  if (!raw) return { ok: false, error: 'Request not found.' };
  if (raw.status !== 'pending') return { ok: false, error: 'Request is no longer pending.' };

  const req = rowToRequest(raw);
  const applied = applyRequest(database, req, reviewer);
  if (!applied.ok) return applied;

  database
    .prepare(
      `UPDATE change_requests
       SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), review_comment = ?
       WHERE id = ?`
    )
    .run(reviewer, comment || null, id);

  logAudit(database, {
    actor: reviewer,
    action: 'change_request.approve',
    entityType: 'change_request',
    entityId: String(id),
    meta: { comment: comment || undefined, table: req.table, operation: req.operation },
  });

  return { ok: true, request: rowToRequest(database.prepare(`SELECT * FROM change_requests WHERE id = ?`).get(id)) };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function rejectChangeRequest(database, id, reviewer, comment = '') {
  const raw = database.prepare(`SELECT * FROM change_requests WHERE id = ?`).get(id);
  if (!raw) return { ok: false, error: 'Request not found.' };
  if (raw.status !== 'pending') return { ok: false, error: 'Request is no longer pending.' };

  database
    .prepare(
      `UPDATE change_requests
       SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_comment = ?
       WHERE id = ?`
    )
    .run(reviewer, comment || null, id);

  logAudit(database, {
    actor: reviewer,
    action: 'change_request.reject',
    entityType: 'change_request',
    entityId: String(id),
    meta: { comment: comment || undefined },
  });

  return { ok: true, request: rowToRequest(database.prepare(`SELECT * FROM change_requests WHERE id = ?`).get(id)) };
}

export function countPendingChangeRequests(database = db) {
  return database.prepare(`SELECT COUNT(*) AS c FROM change_requests WHERE status = 'pending'`).get().c;
}
