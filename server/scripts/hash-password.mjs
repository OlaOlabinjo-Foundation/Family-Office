#!/usr/bin/env node
/**
 * Generate a scrypt password line for FAMILY_OFFICE_USERS_JSON.
 *
 * Usage: node server/scripts/hash-password.mjs "Your-Strong-Password"
 *
 * Output: paste the `scrypt1$...` string into the passwordScrypt field.
 */
import crypto from 'crypto';

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error('Usage: node server/scripts/hash-password.mjs "<password at least 8 chars>"');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(pw, salt, 64);
const line = `scrypt1$${salt.toString('hex')}$${hash.toString('hex')}`;
console.log(line);
