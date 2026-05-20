import { db } from './db.js';

export const CALENDAR_CATEGORIES = ['KYC', 'Regulatory filing', 'Tax', 'Corporate', 'Other'];
export const CALENDAR_RECURRENCE = ['none', 'annual', 'quarterly'];

function parseDateOnly(iso) {
  const s = String(iso || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function daysUntil(dueDate, now = new Date()) {
  const due = parseDateOnly(dueDate);
  if (!due) return null;
  const today = now.toISOString().slice(0, 10);
  const a = new Date(`${today}T12:00:00`);
  const b = new Date(`${due}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

function advanceDueDate(dueDate, recurrence) {
  const d = parseDateOnly(dueDate);
  if (!d) return d;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  if (recurrence === 'annual') dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  else if (recurrence === 'quarterly') dt.setUTCMonth(dt.getUTCMonth() + 3);
  else return d;
  return dt.toISOString().slice(0, 10);
}

function rowToItem(r) {
  const due = parseDateOnly(r.due_date);
  const pending = r.status === 'pending';
  const days = pending && due ? daysUntil(due) : null;
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    entity: r.entity,
    dueDate: due,
    recurrence: r.recurrence || 'none',
    status: r.status,
    owner: r.owner,
    notes: r.notes,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    daysUntil: days,
    overdue: pending && days != null && days < 0,
    dueSoon: pending && days != null && days >= 0 && days <= 30,
  };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function buildComplianceCalendarDigest(database = db, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const in30 = new Date(now);
  in30.setUTCDate(in30.getUTCDate() + 30);
  const horizon = in30.toISOString().slice(0, 10);

  const overdueCount = database
    .prepare(
      `SELECT COUNT(*) AS c FROM compliance_calendar_items
       WHERE status = 'pending' AND due_date < ?`
    )
    .get(today).c;

  const dueNext30Count = database
    .prepare(
      `SELECT COUNT(*) AS c FROM compliance_calendar_items
       WHERE status = 'pending' AND due_date >= ? AND due_date <= ?`
    )
    .get(today, horizon).c;

  const rows = database
    .prepare(
      `SELECT * FROM compliance_calendar_items
       WHERE status = 'pending'
       ORDER BY due_date ASC
       LIMIT 8`
    )
    .all();

  const items = rows.map(rowToItem);
  return {
    overdueCount,
    dueNext30Count,
    pendingCount: database
      .prepare(`SELECT COUNT(*) AS c FROM compliance_calendar_items WHERE status = 'pending'`)
      .get().c,
    items,
  };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function listComplianceCalendarItems(
  database = db,
  { view = 'all', status = 'pending', limit = 100, offset = 0 } = {}
) {
  const clauses = [];
  const params = [];

  if (status !== 'all') {
    clauses.push('status = ?');
    params.push(status);
  }

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setUTCDate(in30.getUTCDate() + 30);
  const horizon = in30.toISOString().slice(0, 10);

  if (view === 'overdue') {
    clauses.push("status = 'pending' AND due_date < ?");
    params.push(today);
  } else if (view === 'upcoming') {
    clauses.push("status = 'pending' AND due_date >= ? AND due_date <= ?");
    params.push(today, horizon);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = database.prepare(`SELECT COUNT(*) AS c FROM compliance_calendar_items ${where}`).get(...params).c;
  const rows = database
    .prepare(
      `SELECT * FROM compliance_calendar_items ${where}
       ORDER BY
         CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
         due_date ASC,
         id ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { items: rows.map(rowToItem), total, limit, offset, view, status };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function createComplianceCalendarItem(database, body, actor) {
  const title = String(body.title || '').trim();
  const dueDate = parseDateOnly(body.dueDate ?? body.due_date);
  if (!title) return { ok: false, error: 'Title is required.' };
  if (!dueDate) return { ok: false, error: 'Due date is required (YYYY-MM-DD).' };

  const category = CALENDAR_CATEGORIES.includes(body.category) ? body.category : 'Other';
  const recurrence = CALENDAR_RECURRENCE.includes(body.recurrence) ? body.recurrence : 'none';

  const info = database
    .prepare(
      `INSERT INTO compliance_calendar_items (
        title, category, entity, due_date, recurrence, status, owner, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'))`
    )
    .run(
      title,
      category,
      String(body.entity || '').trim() || null,
      dueDate,
      recurrence,
      String(body.owner || '').trim() || null,
      String(body.notes || '').trim() || null
    );

  const row = database.prepare(`SELECT * FROM compliance_calendar_items WHERE id = ?`).get(info.lastInsertRowid);
  return { ok: true, item: rowToItem(row), actor };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function updateComplianceCalendarItem(database, id, body) {
  const row = database.prepare(`SELECT * FROM compliance_calendar_items WHERE id = ?`).get(id);
  if (!row) return { ok: false, error: 'Not found.' };

  const title = body.title != null ? String(body.title).trim() : row.title;
  const dueDate = body.dueDate != null || body.due_date != null ? parseDateOnly(body.dueDate ?? body.due_date) : row.due_date;
  if (!title) return { ok: false, error: 'Title is required.' };
  if (!dueDate) return { ok: false, error: 'Due date is required (YYYY-MM-DD).' };

  const category =
    body.category != null && CALENDAR_CATEGORIES.includes(body.category) ? body.category : row.category;
  const recurrence =
    body.recurrence != null && CALENDAR_RECURRENCE.includes(body.recurrence) ? body.recurrence : row.recurrence;

  database
    .prepare(
      `UPDATE compliance_calendar_items SET
        title = ?, category = ?, entity = ?, due_date = ?, recurrence = ?,
        owner = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      title,
      category,
      body.entity != null ? String(body.entity).trim() || null : row.entity,
      dueDate,
      recurrence,
      body.owner != null ? String(body.owner).trim() || null : row.owner,
      body.notes != null ? String(body.notes).trim() || null : row.notes,
      id
    );

  const next = database.prepare(`SELECT * FROM compliance_calendar_items WHERE id = ?`).get(id);
  return { ok: true, item: rowToItem(next) };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function completeComplianceCalendarItem(database, id, actor) {
  const row = database.prepare(`SELECT * FROM compliance_calendar_items WHERE id = ?`).get(id);
  if (!row) return { ok: false, error: 'Not found.' };
  if (row.status !== 'pending') return { ok: false, error: 'Item is not pending.' };

  const recurrence = row.recurrence || 'none';
  if (recurrence === 'annual' || recurrence === 'quarterly') {
    const nextDue = advanceDueDate(row.due_date, recurrence);
    database
      .prepare(
        `UPDATE compliance_calendar_items SET
          due_date = ?, completed_at = datetime('now'), completed_by = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(nextDue, actor, id);
  } else {
    database
      .prepare(
        `UPDATE compliance_calendar_items SET
          status = 'completed', completed_at = datetime('now'), completed_by = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(actor, id);
  }

  const next = database.prepare(`SELECT * FROM compliance_calendar_items WHERE id = ?`).get(id);
  return { ok: true, item: rowToItem(next), rolledForward: recurrence !== 'none' };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function reopenComplianceCalendarItem(database, id) {
  const row = database.prepare(`SELECT * FROM compliance_calendar_items WHERE id = ?`).get(id);
  if (!row) return { ok: false, error: 'Not found.' };
  database
    .prepare(
      `UPDATE compliance_calendar_items SET
        status = 'pending', completed_at = NULL, completed_by = NULL, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(id);
  const next = database.prepare(`SELECT * FROM compliance_calendar_items WHERE id = ?`).get(id);
  return { ok: true, item: rowToItem(next) };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function deleteComplianceCalendarItem(database, id) {
  const row = database.prepare(`SELECT * FROM compliance_calendar_items WHERE id = ?`).get(id);
  if (!row) return { ok: false, error: 'Not found.' };
  database.prepare(`DELETE FROM compliance_calendar_items WHERE id = ?`).run(id);
  return { ok: true };
}

export function countOverdueCalendarItems(database = db) {
  const today = new Date().toISOString().slice(0, 10);
  return database
    .prepare(
      `SELECT COUNT(*) AS c FROM compliance_calendar_items WHERE status = 'pending' AND due_date < ?`
    )
    .get(today).c;
}
