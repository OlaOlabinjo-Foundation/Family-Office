import { hashPasswordToScrypt } from './userCredentials.js';

const ROLES = new Set(['chairman', 'lead', 'analyst', 'viewer']);

function normalizeUsername(u) {
  return String(u || '')
    .trim()
    .toLowerCase()
    .slice(0, 64);
}

function isValidUsername(raw) {
  const s = String(raw || '').trim();
  return /^[a-zA-Z0-9._-]{3,40}$/.test(s);
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function listAppUsers(database) {
  return database
    .prepare(
      'SELECT id, username, display_name as displayName, role, email, updated_at as updatedAt FROM app_users ORDER BY username ASC'
    )
    .all();
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {{ username: string, displayName: string, role: string, password: string }} input
 * @returns {{ ok: true, user: object } | { ok: false, error: string }}
 */
export function createAppUser(database, input) {
  const username = String(input.username || '').trim();
  const displayName = String(input.displayName || '').trim().slice(0, 200) || username;
  const role = String(input.role || '').trim();
  const password = String(input.password || '');

  if (!isValidUsername(username)) {
    return { ok: false, error: 'Username must be 3–40 characters: letters, digits, . _ -' };
  }
  if (!ROLES.has(role)) {
    return { ok: false, error: 'Invalid role.' };
  }
  if (password.length < 10) {
    return { ok: false, error: 'Password must be at least 10 characters.' };
  }

  const hash = hashPasswordToScrypt(password);
  try {
    database
      .prepare('INSERT INTO app_users (username, display_name, role, password_scrypt) VALUES (?, ?, ?, ?)')
      .run(username, displayName, role, hash);
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) {
      return { ok: false, error: 'That username is already in use.' };
    }
    return { ok: false, error: e.message || 'Could not create user.' };
  }
  const row = database
    .prepare(
      'SELECT id, username, display_name as displayName, role, email, updated_at as updatedAt FROM app_users WHERE lower(username) = lower(?)'
    )
    .get(username);
  return { ok: true, user: row };
}

function normalizeEmail(raw) {
  if (raw == null || raw === '') return null;
  const e = String(raw).trim();
  if (!e) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e.slice(0, 254);
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} targetUsername
 * @param {string} actorUsername
 */
export function deleteAppUser(database, targetUsername, actorUsername) {
  const target = String(targetUsername || '').trim();
  if (!target) return { ok: false, error: 'Username required.' };

  const n = database.prepare('SELECT COUNT(*) as c FROM app_users').get().c;
  if (n <= 1) {
    return { ok: false, error: 'Cannot remove the last application user.' };
  }
  if (normalizeUsername(target) === normalizeUsername(actorUsername)) {
    return { ok: false, error: 'Remove another user first — you cannot delete your own account here.' };
  }

  const info = database.prepare('DELETE FROM app_users WHERE lower(username) = lower(?)').run(target);
  if (info.changes === 0) return { ok: false, error: 'User not found.' };
  return { ok: true };
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} targetUsername
 * @param {{ displayName?: string, role?: string, password?: string, email?: string | null }} patch
 */
export function patchAppUser(database, targetUsername, patch) {
  const target = String(targetUsername || '').trim();
  if (!target) return { ok: false, error: 'Username required.' };

  const row = database.prepare('SELECT id FROM app_users WHERE lower(username) = lower(?)').get(target);
  if (!row) return { ok: false, error: 'User not found.' };

  const sets = [];
  const vals = [];

  if (patch.displayName !== undefined) {
    const d = String(patch.displayName || '').trim().slice(0, 200);
    if (!d) return { ok: false, error: 'Display name cannot be empty.' };
    sets.push('display_name = ?');
    vals.push(d);
  }
  if (patch.role !== undefined) {
    const r = String(patch.role || '').trim();
    if (!ROLES.has(r)) return { ok: false, error: 'Invalid role.' };
    sets.push('role = ?');
    vals.push(r);
  }
  if (patch.password !== undefined) {
    const p = String(patch.password || '');
    if (p.length < 10) return { ok: false, error: 'Password must be at least 10 characters.' };
    sets.push('password_scrypt = ?');
    vals.push(hashPasswordToScrypt(p));
  }
  if (patch.email !== undefined) {
    if (patch.email != null && patch.email !== '' && !normalizeEmail(patch.email)) {
      return { ok: false, error: 'Invalid email address.' };
    }
    sets.push('email = ?');
    vals.push(normalizeEmail(patch.email));
  }

  if (!sets.length) {
    return { ok: false, error: 'No changes supplied (displayName, role, email, or password).' };
  }

  vals.push(target);
  database
    .prepare(`UPDATE app_users SET ${sets.join(', ')}, updated_at = datetime('now') WHERE lower(username) = lower(?)`)
    .run(...vals);

  const out = database
    .prepare(
      'SELECT id, username, display_name as displayName, role, email, updated_at as updatedAt FROM app_users WHERE lower(username) = lower(?)'
    )
    .get(target);
  return { ok: true, user: out };
}
