import { db } from './db.js';
import { buildTaskInbox } from './taskInbox.js';
import { notifyTaskOwner } from './notifyMail.js';
import { getAppBaseUrl, resolveOwnerEmails } from './userEmails.js';

/**
 * @param {import('better-sqlite3').Database} database
 */
export function ensureTaskNotificationTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_notifications (
      task_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      notified_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Email owners for inbox tasks not yet notified (deduped by task id).
 * @param {import('better-sqlite3').Database} [database]
 */
export async function notifyNewInboxTasks(database = db) {
  ensureTaskNotificationTable(database);
  const inbox = buildTaskInbox(database);
  const baseUrl = getAppBaseUrl();
  const seen = database.prepare('SELECT task_key FROM task_notifications').all();
  const known = new Set(seen.map((r) => r.task_key));
  const insert = database.prepare(
    `INSERT OR IGNORE INTO task_notifications (task_key, owner, notified_at) VALUES (?, ?, datetime('now'))`
  );

  let sent = 0;
  for (const task of inbox.items) {
    if (known.has(task.id)) continue;
    const emails = resolveOwnerEmails(task.owner, database);
    if (!emails.length) continue;
    const result = await notifyTaskOwner({
      task,
      emails,
      baseUrl,
      reason: 'new_task',
    });
    if (result.sent) {
      insert.run(task.id, task.owner || '—');
      sent++;
    }
  }
  return { scanned: inbox.items.length, sent };
}

/**
 * Immediate notification for a single task (calendar item, assigned task, etc.).
 * @param {import('better-sqlite3').Database} [database]
 */
export async function notifyTaskOwnerNow(
  database,
  { taskKey, owner, title, detail, priority, dueDate, href, source }
) {
  ensureTaskNotificationTable(database);
  const existing = database.prepare('SELECT task_key FROM task_notifications WHERE task_key = ?').get(taskKey);
  if (existing) return { sent: false, reason: 'already_notified' };

  const emails = resolveOwnerEmails(owner, database);
  if (!emails.length) return { sent: false, reason: 'no_owner_email' };

  const task = {
    id: taskKey,
    owner: owner || '—',
    title,
    detail: detail || '',
    priority: priority || 'P2',
    dueDate: dueDate || null,
    href: href || '/actions',
    source: source || 'Family Office portal',
  };
  const result = await notifyTaskOwner({
    task,
    emails,
    baseUrl: getAppBaseUrl(),
    reason: 'assigned',
  });
  if (result.sent) {
    database
      .prepare(`INSERT OR IGNORE INTO task_notifications (task_key, owner, notified_at) VALUES (?, ?, datetime('now'))`)
      .run(taskKey, owner || '—');
  }
  return result;
}

export function scheduleInboxTaskNotifications(database = db) {
  notifyNewInboxTasks(database).catch((e) => {
    console.warn('[task-notify] inbox scan failed:', e.message);
  });
}
