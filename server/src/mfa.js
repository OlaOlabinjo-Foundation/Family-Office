import crypto from 'crypto';
import { db } from './db.js';
import { hashPasswordToScrypt, verifyScryptPassword } from './userCredentials.js';

const MFA_ROLES = new Set(['lead', 'analyst']);
const STEP_SECONDS = 30;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** @type {Map<string, { username: string; role: string; displayName: string; exp: number }>} */
const pendingChallenges = new Map();

/** @type {Map<string, { username: string; role: string; displayName: string; exp: number }>} */
const pendingEnrollments = new Map();

/** When sqlite auth: lead/analyst must enroll MFA before full access (set FAMILY_OFFICE_MFA_REQUIRED=0 to disable). */
export function isMfaEnrollmentRequired() {
  const flag = typeof process.env.FAMILY_OFFICE_MFA_REQUIRED === 'string'
    ? process.env.FAMILY_OFFICE_MFA_REQUIRED.trim().toLowerCase()
    : '';
  if (flag === '0' || flag === 'false' || flag === 'no') return false;
  return true;
}

function getEncryptionKey() {
  const raw =
    (typeof process.env.FAMILY_OFFICE_MFA_KEY === 'string' && process.env.FAMILY_OFFICE_MFA_KEY.trim()) ||
    (typeof process.env.JWT_SECRET === 'string' && process.env.JWT_SECRET.trim()) ||
    'family-office-mfa-dev-only';
  return crypto.createHash('sha256').update(raw).digest();
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str) {
  const cleaned = String(str || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, '0');
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/** Current 6-digit TOTP (for tests and setup confirmation). */
export function totpNow(secretBase32) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  return hotp(key, counter);
}

export function verifyTotpCode(secretBase32, code, windowSteps = 1) {
  const normalized = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let w = -windowSteps; w <= windowSteps; w++) {
    if (hotp(key, counter + w) === normalized) return true;
  }
  return false;
}

function encryptSecret(plain) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

function decryptSecret(blob) {
  const [ivB, tagB, dataB] = String(blob || '').split('.');
  if (!ivB || !tagB || !dataB) return null;
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function getUserRow(username) {
  return (
    db
      .prepare(
        `SELECT username, display_name, role, mfa_enabled, mfa_secret_enc, mfa_pending_secret_enc, mfa_recovery_hashes
         FROM app_users WHERE lower(username) = lower(?)`
      )
      .get(username) || null
  );
}

export function mfaPolicyApplies(role) {
  return MFA_ROLES.has(role);
}

export function isMfaEnabledForUser(username) {
  const row = getUserRow(username);
  return Boolean(row?.mfa_enabled);
}

export function getMfaStatus(username) {
  const row = getUserRow(username);
  if (!row) return { enabled: false, policyApplies: false };
  return {
    enabled: Boolean(row.mfa_enabled),
    policyApplies: mfaPolicyApplies(row.role),
  };
}

function readRecoveryHashes(row) {
  if (!row?.mfa_recovery_hashes) return [];
  try {
    const parsed = JSON.parse(row.mfa_recovery_hashes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateRecoveryCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const a = crypto.randomBytes(2).toString('hex').toUpperCase();
    const b = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`${a}-${b}`);
  }
  return codes;
}

function verifyAndConsumeRecovery(username, code) {
  const row = getUserRow(username);
  if (!row) return false;
  const entries = readRecoveryHashes(row);
  const normalized = String(code || '').trim().toUpperCase();
  let matched = -1;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.usedAt) continue;
    if (verifyScryptPassword(normalized, e.hash)) {
      matched = i;
      break;
    }
  }
  if (matched < 0) return false;
  entries[matched].usedAt = new Date().toISOString();
  db.prepare(`UPDATE app_users SET mfa_recovery_hashes = ?, updated_at = datetime('now') WHERE lower(username) = lower(?)`).run(
    JSON.stringify(entries),
    username
  );
  return true;
}

export function verifyMfaForUser(username, code) {
  const row = getUserRow(username);
  if (!row?.mfa_enabled || !row.mfa_secret_enc) return false;
  const secret = decryptSecret(row.mfa_secret_enc);
  if (!secret) return false;
  const normalized = String(code || '').replace(/\s/g, '');
  if (verifyTotpCode(secret, normalized)) return true;
  return verifyAndConsumeRecovery(username, normalized);
}

export function createMfaChallenge(user) {
  const token = crypto.randomBytes(24).toString('base64url');
  pendingChallenges.set(token, {
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    exp: Date.now() + 5 * 60 * 1000,
  });
  return token;
}

export function peekMfaChallenge(token) {
  const entry = pendingChallenges.get(token);
  if (!entry || entry.exp < Date.now()) return null;
  return entry;
}

export function consumeMfaChallenge(token) {
  const entry = peekMfaChallenge(token);
  if (!entry) return null;
  pendingChallenges.delete(token);
  return entry;
}

export function createEnrollmentToken(user) {
  const token = crypto.randomBytes(24).toString('base64url');
  pendingEnrollments.set(token, {
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    exp: Date.now() + 30 * 60 * 1000,
  });
  return token;
}

export function peekEnrollmentToken(token) {
  const entry = pendingEnrollments.get(token);
  if (!entry || entry.exp < Date.now()) return null;
  return entry;
}

export function consumeEnrollmentToken(token) {
  const entry = peekEnrollmentToken(token);
  if (!entry) return null;
  pendingEnrollments.delete(token);
  return entry;
}

export function beginMfaSetup(username) {
  const row = getUserRow(username);
  if (!row) return { ok: false, error: 'User not found.' };
  if (!mfaPolicyApplies(row.role)) {
    return { ok: false, error: 'MFA is only available for lead and analyst accounts.' };
  }
  const secret = generateTotpSecret();
  const pendingEnc = encryptSecret(secret);
  db.prepare(
    `UPDATE app_users SET mfa_pending_secret_enc = ?, updated_at = datetime('now') WHERE lower(username) = lower(?)`
  ).run(pendingEnc, username);
  const issuer = encodeURIComponent('Ola Olabinjo Investment');
  const label = encodeURIComponent(`OOI:${row.username}`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
  return {
    ok: true,
    secret,
    otpauthUrl,
    issuer: 'Ola Olabinjo Investment',
    accountName: row.username,
  };
}

export function confirmMfaSetup(username, code) {
  const row = getUserRow(username);
  if (!row?.mfa_pending_secret_enc) {
    return { ok: false, error: 'No MFA setup in progress. Start setup again from Account settings.' };
  }
  const secret = decryptSecret(row.mfa_pending_secret_enc);
  if (!secret || !verifyTotpCode(secret, code)) {
    return { ok: false, error: 'Invalid authenticator code. Check the 6-digit code and try again.' };
  }
  const recoveryCodes = generateRecoveryCodes();
  const hashes = recoveryCodes.map((c) => ({ hash: hashPasswordToScrypt(c), usedAt: null }));
  db.prepare(
    `UPDATE app_users SET mfa_enabled = 1, mfa_secret_enc = ?, mfa_pending_secret_enc = NULL,
     mfa_recovery_hashes = ?, mfa_enabled_at = datetime('now'), updated_at = datetime('now')
     WHERE lower(username) = lower(?)`
  ).run(encryptSecret(secret), JSON.stringify(hashes), username);
  return { ok: true, recoveryCodes };
}

export function disableMfa(username, password, code) {
  const row = db
    .prepare('SELECT password_scrypt, mfa_enabled, mfa_secret_enc FROM app_users WHERE lower(username) = lower(?)')
    .get(username);
  if (!row) return { ok: false, error: 'User not found.' };
  if (!verifyScryptPassword(password, row.password_scrypt)) {
    return { ok: false, error: 'Password is incorrect.' };
  }
  if (!row.mfa_enabled) return { ok: false, error: 'MFA is not enabled on this account.' };
  if (!verifyMfaForUser(username, code)) {
    return { ok: false, error: 'Invalid authenticator or recovery code.' };
  }
  db.prepare(
    `UPDATE app_users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_pending_secret_enc = NULL,
     mfa_recovery_hashes = NULL, mfa_enabled_at = NULL, updated_at = datetime('now')
     WHERE lower(username) = lower(?)`
  ).run(username);
  return { ok: true };
}

export function buildOtpAuthQrUrl(otpauthUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
}
