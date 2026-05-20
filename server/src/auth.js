/** @typedef {'chairman' | 'lead' | 'analyst' | 'viewer'} Role */

import crypto from 'crypto';
import { db } from './db.js';
import {
  getConfiguredCredentialUsers,
  verifyScryptPassword,
  hashPasswordToScrypt
} from './userCredentials.js';
import {
  createMfaChallenge,
  consumeMfaChallenge,
  peekMfaChallenge,
  verifyMfaForUser,
  isMfaEnabledForUser,
  mfaPolicyApplies,
  isMfaEnrollmentRequired,
  createEnrollmentToken,
  peekEnrollmentToken,
  consumeEnrollmentToken,
  confirmMfaSetup,
} from './mfa.js';

export { isMfaEnrollmentRequired };

const USERS = [
  { username: 'chairman', password: 'demo', role: 'chairman', displayName: 'Chairman / Principal' },
  { username: 'lead', password: 'demo', role: 'lead', displayName: 'Family Office Lead' },
  { username: 'analyst', password: 'demo', role: 'analyst', displayName: 'Analyst' },
  { username: 'viewer', password: 'demo', role: 'viewer', displayName: 'Viewer' }
];

const JWT_SECRET = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';

/** @type {Map<string, {username: string, role: Role, displayName: string, exp: number}>} */
const sessions = new Map();

/** @returns {'sqlite' | 'env' | 'demo'} */
export function getCredentialStore() {
  if (typeof process.env.FAMILY_OFFICE_AUTH === 'string' && process.env.FAMILY_OFFICE_AUTH.trim().toLowerCase() === 'sqlite') {
    return 'sqlite';
  }
  if (getConfiguredCredentialUsers()) return 'env';
  return 'demo';
}

function b64encode(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function b64decode(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function signJwtPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyJwtToken(token) {
  if (!JWT_SECRET || !token.includes('.')) return null;
  const dot = token.lastIndexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  if (sig.length !== expect.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || !payload.exp || payload.exp < Date.now()) return null;
  if (!payload.username || !payload.role) return null;
  return payload;
}

function matchSqliteUser(username, password) {
  const row = db
    .prepare('SELECT username, display_name, role, password_scrypt FROM app_users WHERE lower(username) = lower(?)')
    .get(username);
  if (!row) return null;
  if (!verifyScryptPassword(password, row.password_scrypt)) return null;
  return { username: row.username, role: row.role, displayName: row.display_name };
}

function matchUser(username, password) {
  if (getCredentialStore() === 'sqlite') {
    return matchSqliteUser(username, password);
  }
  const configured = getConfiguredCredentialUsers();
  if (configured) {
    const u = configured.find((x) => x.username === username);
    if (!u) return null;
    if (!verifyScryptPassword(password, u.passwordScrypt)) return null;
    return { username: u.username, role: u.role, displayName: u.displayName };
  }
  const legacy = USERS.find((x) => x.username === username && x.password === password);
  if (!legacy) return null;
  return { username: legacy.username, role: legacy.role, displayName: legacy.displayName };
}

function issueSession(u) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = { username: u.username, role: u.role, displayName: u.displayName, exp };
  const user = { username: u.username, role: u.role, displayName: u.displayName };
  if (JWT_SECRET) {
    const token = signJwtPayload(payload);
    return { token, user };
  }
  const token = b64encode(payload);
  sessions.set(token, payload);
  return { token, user };
}

export function login(username, password) {
  const u = matchUser(username, password);
  if (!u) return null;
  const user = { username: u.username, role: u.role, displayName: u.displayName };
  if (getCredentialStore() === 'sqlite' && mfaPolicyApplies(u.role)) {
    if (isMfaEnrollmentRequired() && !isMfaEnabledForUser(u.username)) {
      const enrollmentToken = createEnrollmentToken(u);
      return { enrollmentRequired: true, enrollmentToken, user };
    }
    if (isMfaEnabledForUser(u.username)) {
      const mfaToken = createMfaChallenge(u);
      return { mfaRequired: true, mfaToken, user };
    }
  }
  return issueSession(u);
}

export function completeMfaLogin(mfaToken, code) {
  const pending = peekMfaChallenge(mfaToken);
  if (!pending) return null;
  if (!verifyMfaForUser(pending.username, code)) return null;
  consumeMfaChallenge(mfaToken);
  return issueSession(pending);
}

export function completeEnrollmentLogin(enrollmentToken, code) {
  const pending = peekEnrollmentToken(enrollmentToken);
  if (!pending) return null;
  const result = confirmMfaSetup(pending.username, code);
  if (!result.ok) return { ok: false, error: result.error };
  consumeEnrollmentToken(enrollmentToken);
  return {
    ok: true,
    ...issueSession(pending),
    recoveryCodes: result.recoveryCodes,
  };
}

export function verifyToken(token) {
  if (!token) return null;
  if (JWT_SECRET) {
    const jwtUser = verifyJwtToken(token);
    if (jwtUser) return jwtUser;
  }
  const cached = sessions.get(token);
  if (cached && cached.exp > Date.now()) return cached;
  const decoded = b64decode(token);
  if (!decoded || !decoded.exp || decoded.exp < Date.now()) return null;
  return decoded;
}

/** Minimum role rank for route (higher = more access). viewer=1 analyst=2 lead=3 chairman=3 read */
const rank = { viewer: 1, analyst: 2, lead: 3, chairman: 3 };

export function requireAuth(minRole = 'viewer') {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
    const user = verifyToken(tok);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    if (rank[user.role] < rank[minRole]) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

export function listMockUsers() {
  if (getCredentialStore() === 'sqlite') {
    try {
      const rows = db.prepare('SELECT username, display_name, role FROM app_users ORDER BY username').all();
      return rows.map((r) => ({
        username: r.username,
        displayName: r.display_name || r.username,
        role: r.role
      }));
    } catch {
      return [];
    }
  }
  const configured = getConfiguredCredentialUsers();
  if (configured) {
    return configured.map((u) => ({ username: u.username, role: u.role, displayName: u.displayName }));
  }
  return USERS.map((u) => ({ username: u.username, role: u.role, displayName: u.displayName }));
}

/**
 * @param {string} username
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function changeUserPassword(username, currentPassword, newPassword) {
  if (getCredentialStore() !== 'sqlite') {
    return { ok: false, error: 'Password change is only available when FAMILY_OFFICE_AUTH=sqlite.' };
  }
  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return { ok: false, error: 'New password must be at least 10 characters.' };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: 'Choose a different new password.' };
  }
  const row = db
    .prepare('SELECT password_scrypt FROM app_users WHERE lower(username) = lower(?)')
    .get(username);
  if (!row) {
    return { ok: false, error: 'User not found.' };
  }
  if (!verifyScryptPassword(String(currentPassword || ''), row.password_scrypt)) {
    return { ok: false, error: 'Current password is incorrect.' };
  }
  const next = hashPasswordToScrypt(newPassword);
  db.prepare('UPDATE app_users SET password_scrypt = ?, updated_at = datetime(\'now\') WHERE lower(username) = lower(?)').run(
    next,
    username
  );
  return { ok: true };
}
