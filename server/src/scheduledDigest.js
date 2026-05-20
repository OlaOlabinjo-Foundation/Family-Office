import { db } from './db.js';
import { notifyWeeklyDigest } from './notifyMail.js';
import { logAudit } from './audit.js';

const KV_KEY = 'digest_cron_last_sent';

function ensureKvTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS system_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function readLastSent(database) {
  ensureKvTable(database);
  const row = database.prepare('SELECT value FROM system_kv WHERE key = ?').get(KV_KEY);
  return row?.value ? String(row.value) : null;
}

function writeLastSent(database, iso) {
  ensureKvTable(database);
  database
    .prepare(
      `INSERT INTO system_kv (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(KV_KEY, iso);
}

function cronEnabled() {
  const v = typeof process.env.FAMILY_OFFICE_DIGEST_CRON === 'string'
    ? process.env.FAMILY_OFFICE_DIGEST_CRON.trim().toLowerCase()
    : '';
  return v === '1' || v === 'true' || v === 'yes';
}

function parseCronConfig() {
  const hour = Math.min(23, Math.max(0, Number(process.env.DIGEST_CRON_HOUR) || 8));
  const dow = Math.min(6, Math.max(0, Number(process.env.DIGEST_CRON_DOW) || 1));
  return { hour, dow };
}

function shouldRunNow(now = new Date(), lastSentIso) {
  const { hour, dow } = parseCronConfig();
  if (now.getDay() !== dow) return false;
  if (now.getHours() !== hour) return false;
  if (now.getMinutes() > 10) return false;
  if (lastSentIso) {
    const last = new Date(lastSentIso);
    if (!Number.isNaN(last.getTime()) && now.getTime() - last.getTime() < 20 * 60 * 60 * 1000) {
      return false;
    }
  }
  return true;
}

/**
 * @param {import('better-sqlite3').Database} [database]
 */
export async function runScheduledDigestIfDue(database = db) {
  if (!cronEnabled()) return { ran: false, reason: 'cron_disabled' };
  const last = readLastSent(database);
  const now = new Date();
  if (!shouldRunNow(now, last)) return { ran: false, reason: 'not_due' };

  const baseUrl =
    (typeof process.env.DIGEST_APP_BASE_URL === 'string' && process.env.DIGEST_APP_BASE_URL.trim()) ||
    (typeof process.env.APP_BASE_URL === 'string' && process.env.APP_BASE_URL.trim()) ||
    '';

  const mail = await notifyWeeklyDigest(database, { baseUrl });
  const sentAt = now.toISOString();
  if (mail.sent) {
    writeLastSent(database, sentAt);
    logAudit(database, {
      actor: 'system',
      action: 'digest.send',
      entityType: 'digest',
      entityId: 'cron',
      meta: { sent: true, to: mail.to || null, scheduled: true },
    });
  }
  return { ran: true, sent: mail.sent, reason: mail.reason || null, at: sentAt };
}

/**
 * @param {import('better-sqlite3').Database} [database]
 */
export function startScheduledDigest(database = db) {
  if (!cronEnabled()) {
    console.log('[digest-cron] Disabled (set FAMILY_OFFICE_DIGEST_CRON=1 to enable).');
    return;
  }
  const { hour, dow } = parseCronConfig();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  console.log(`[digest-cron] Watching for weekly send ${days[dow]} at ${String(hour).padStart(2, '0')}:00 (server local time).`);

  const tick = () => {
    runScheduledDigestIfDue(database).catch((e) => {
      console.warn('[digest-cron] run failed:', e.message);
    });
  };

  tick();
  setInterval(tick, 60_000);
}
