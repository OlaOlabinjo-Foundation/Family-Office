#!/usr/bin/env node
/**
 * Upsert a user into app_users (SQLite auth). Requires FAMILY_OFFICE_AUTH=sqlite on the server
 * for these credentials to be used at login.
 *
 * Usage (from repo root):
 *   set FAMILY_OFFICE_SQLITE=path\to\family-office.sqlite   (optional; defaults to server/data/family-office.sqlite)
 *   node server/scripts/seed-app-user.mjs <username> "<Display Name>" <role> "<password>"
 *
 * role: chairman | lead | analyst | viewer
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPasswordToScrypt } from '../src/userCredentials.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');

if (!process.env.FAMILY_OFFICE_SQLITE) {
  process.env.FAMILY_OFFICE_SQLITE = path.join(serverRoot, 'data', 'family-office.sqlite');
}

const [, , username, displayName, role, password] = process.argv;
if (!username || !displayName || !role || !password || password.length < 10) {
  console.error('Usage: node server/scripts/seed-app-user.mjs <username> "<Display Name>" <role> "<password 10+ chars>"');
  process.exit(1);
}

const roles = new Set(['chairman', 'lead', 'analyst', 'viewer']);
if (!roles.has(role)) {
  console.error('Invalid role. Use: chairman | lead | analyst | viewer');
  process.exit(1);
}

const { migrate, db } = await import('../src/db.js');
migrate();

const hash = hashPasswordToScrypt(password);
const existing = db.prepare('SELECT id FROM app_users WHERE lower(username) = lower(?)').get(username);
if (existing) {
  db.prepare(
    'UPDATE app_users SET display_name = ?, role = ?, password_scrypt = ?, updated_at = datetime(\'now\') WHERE lower(username) = lower(?)'
  ).run(displayName, role, hash, username);
  console.log('Updated user:', username);
} else {
  db.prepare(
    'INSERT INTO app_users (username, display_name, role, password_scrypt) VALUES (?, ?, ?, ?)'
  ).run(username, displayName, role, hash);
  console.log('Created user:', username);
}
console.log('Set FAMILY_OFFICE_AUTH=sqlite on the server to use SQLite logins.');
