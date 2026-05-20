import crypto from 'crypto';

/** @typedef {'chairman' | 'lead' | 'analyst' | 'viewer'} Role */

/**
 * @typedef {{ username: string, displayName: string, role: Role, passwordScrypt: string }} ConfiguredUser
 */

let cachedJson = /** @type {string | null} */ (null);
/** @type {ConfiguredUser[] | null} */
let cachedUsers = null;

/**
 * When `FAMILY_OFFICE_USERS_JSON` is set, returns parsed users (with password hashes).
 * Otherwise returns `null` and the app falls back to built-in demo users.
 * @returns {ConfiguredUser[] | null}
 */
export function getConfiguredCredentialUsers() {
  const raw = typeof process.env.FAMILY_OFFICE_USERS_JSON === 'string' ? process.env.FAMILY_OFFICE_USERS_JSON.trim() : '';
  if (!raw) {
    cachedJson = null;
    cachedUsers = null;
    return null;
  }
  if (raw === cachedJson && cachedUsers) return cachedUsers;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('[auth] FAMILY_OFFICE_USERS_JSON is not valid JSON:', e.message);
    cachedJson = raw;
    cachedUsers = null;
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error('[auth] FAMILY_OFFICE_USERS_JSON must be a non-empty JSON array.');
    cachedJson = raw;
    cachedUsers = null;
    return null;
  }
  /** @type {ConfiguredUser[]} */
  const out = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const username = typeof row.username === 'string' ? row.username.trim() : '';
    const displayName = typeof row.displayName === 'string' ? row.displayName.trim() : username;
    const role = row.role;
    const passwordScrypt = typeof row.passwordScrypt === 'string' ? row.passwordScrypt.trim() : '';
    if (!username || !passwordScrypt || !isRole(role)) {
      console.error('[auth] Skipping invalid user entry (need username, role, passwordScrypt):', row);
      continue;
    }
    out.push({ username, displayName: displayName || username, role, passwordScrypt });
  }
  if (!out.length) {
    console.error('[auth] FAMILY_OFFICE_USERS_JSON contained no valid user rows.');
    cachedJson = raw;
    cachedUsers = null;
    return null;
  }
  cachedJson = raw;
  cachedUsers = out;
  return out;
}

/** @param {unknown} r */
function isRole(r) {
  return r === 'chairman' || r === 'lead' || r === 'analyst' || r === 'viewer';
}

/**
 * @param {string} plain
 * @param {string} stored format `scrypt1$<salt_hex>$<hash_hex>`
 */
export function verifyScryptPassword(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;
  const m = stored.match(/^scrypt1\$([0-9a-f]+)\$([0-9a-f]+)$/i);
  if (!m) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(m[1], 'hex');
    expected = Buffer.from(m[2], 'hex');
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 32) return false;
  let derived;
  try {
    derived = crypto.scryptSync(plain, salt, expected.length);
  } catch {
    return false;
  }
  try {
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** @param {string} plain */
export function hashPasswordToScrypt(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 64);
  return `scrypt1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
