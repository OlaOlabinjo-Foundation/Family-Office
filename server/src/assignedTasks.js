import { db } from './db.js';
import { logAudit } from './audit.js';
import { notifyTaskOwnerNow } from './taskNotify.js';

const PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);

function rowToTask(r) {
  return {
    id: r.id,
    title: r.title,
    detail: r.detail,
    owner: r.owner,
    priority: r.priority,
    dueDate: r.due_date,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
  };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function listOpenAssignedTasks(database = db) {
  return database
    .prepare(`SELECT * FROM assigned_tasks WHERE status = 'open' ORDER BY due_date ASC, id ASC`)
    .all()
    .map(rowToTask);
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function createAssignedTask(database, body, actor) {
  const title = String(body.title || '').trim();
  const owner = String(body.owner || '').trim();
  const priority = PRIORITIES.has(String(body.priority || '').toUpperCase())
    ? String(body.priority).toUpperCase()
    : 'P2';
  const detail = String(body.detail || '').trim() || null;
  const dueDate = body.dueDate != null ? String(body.dueDate).trim().slice(0, 10) || null : null;

  if (!title) return { ok: false, error: 'Title is required.' };
  if (!owner) return { ok: false, error: 'Task owner is required.' };

  const info = database
    .prepare(
      `INSERT INTO assigned_tasks (title, detail, owner, priority, due_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`
    )
    .run(title, detail, owner, priority, dueDate, actor);

  const row = database.prepare('SELECT * FROM assigned_tasks WHERE id = ?').get(info.lastInsertRowid);
  const item = rowToTask(row);

  logAudit(database, {
    actor,
    action: 'assigned_task.create',
    entityType: 'assigned_task',
    entityId: String(item.id),
    meta: { owner, priority, title },
  });

  return { ok: true, item };
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function completeAssignedTask(database, id, actor) {
  const row = database.prepare('SELECT * FROM assigned_tasks WHERE id = ?').get(id);
  if (!row) return { ok: false, error: 'Not found.' };
  if (row.status !== 'open') return { ok: false, error: 'Task is not open.' };
  database
    .prepare(
      `UPDATE assigned_tasks SET status = 'completed', completed_at = datetime('now'), completed_by = ? WHERE id = ?`
    )
    .run(actor, id);
  const next = database.prepare('SELECT * FROM assigned_tasks WHERE id = ?').get(id);
  logAudit(database, {
    actor,
    action: 'assigned_task.complete',
    entityType: 'assigned_task',
    entityId: String(id),
    meta: {},
  });
  return { ok: true, item: rowToTask(next) };
}
