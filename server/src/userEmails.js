import { db } from './db.js';

/** @type {Record<string, string> | null} */
let cachedMap = null;

function loadEmailMap() {
  if (cachedMap) return cachedMap;
  const raw = typeof process.env.FAMILY_OFFICE_EMAIL_MAP === 'string' ? process.env.FAMILY_OFFICE_EMAIL_MAP.trim() : '';
  if (!raw) {
    cachedMap = {};
    return cachedMap;
  }
  try {
    const parsed = JSON.parse(raw);
    cachedMap =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [String(k).toLowerCase(), String(v).trim()])
          )
        : {};
  } catch {
    cachedMap = {};
  }
  return cachedMap;
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

/**
 * @param {import('better-sqlite3').Database} [database]
 */
export function getUserEmail(username, database = db) {
  const u = String(username || '').trim();
  if (!u) return null;
  try {
    const row = database.prepare('SELECT email FROM app_users WHERE lower(username) = lower(?)').get(u);
    const e = row?.email ? String(row.email).trim() : '';
    if (isEmail(e)) return e;
  } catch {
    /* email column may be absent in old DBs */
  }
  const mapped = loadEmailMap()[u.toLowerCase()];
  return mapped && isEmail(mapped) ? mapped : null;
}

/**
 * Resolve a display name, username, role label, or advisor name to an email.
 * @param {import('better-sqlite3').Database} [database]
 */
export function resolveContactEmail(label, database = db) {
  const raw = String(label || '').trim();
  if (!raw || raw === '—') return null;
  if (isEmail(raw)) return raw;

  const map = loadEmailMap();
  const key = raw.toLowerCase();
  if (map[key] && isEmail(map[key])) return map[key];

  try {
    const byUser = database
      .prepare(
        `SELECT email FROM app_users
         WHERE lower(username) = lower(?) OR lower(display_name) = lower(?)
         LIMIT 1`
      )
      .get(raw, raw);
    const ue = byUser?.email ? String(byUser.email).trim() : '';
    if (isEmail(ue)) return ue;
  } catch {
    /* ignore */
  }

  try {
    const adv = database
      .prepare(`SELECT email FROM advisors WHERE lower(name) = lower(?) OR lower(email) = lower(?) LIMIT 1`)
      .get(raw, raw);
    const ae = adv?.email ? String(adv.email).trim() : '';
    if (isEmail(ae)) return ae;
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * @param {import('better-sqlite3').Database} [database]
 */
export function resolveOwnerEmails(ownerLabel, database = db) {
  const label = String(ownerLabel || '').trim();
  if (!label || label === '—') return [];

  const emails = new Set();
  const direct = resolveContactEmail(label, database);
  if (direct) emails.add(direct);

  const lower = label.toLowerCase();
  const roleHints = ['chairman', 'lead', 'analyst', 'viewer'];
  for (const role of roleHints) {
    if (lower.includes(role)) {
      try {
        const rows = database.prepare(`SELECT username, email FROM app_users WHERE role = ?`).all(role);
        for (const row of rows) {
          const e = row.email ? String(row.email).trim() : getUserEmail(row.username, database);
          if (e && isEmail(e)) emails.add(e);
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!emails.size) {
    const fallback = typeof process.env.SMTP_TO === 'string' ? process.env.SMTP_TO.trim() : '';
    if (fallback && isEmail(fallback)) emails.add(fallback);
  }

  return [...emails];
}

export function getAppBaseUrl() {
  return (
    (typeof process.env.DIGEST_APP_BASE_URL === 'string' && process.env.DIGEST_APP_BASE_URL.trim()) ||
    (typeof process.env.APP_BASE_URL === 'string' && process.env.APP_BASE_URL.trim()) ||
    ''
  );
}
