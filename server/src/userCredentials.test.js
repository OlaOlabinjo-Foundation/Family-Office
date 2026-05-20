import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyScryptPassword, hashPasswordToScrypt } from './userCredentials.js';

describe('userCredentials', () => {
  it('hashPasswordToScrypt round-trips via verifyScryptPassword', () => {
    const stored = hashPasswordToScrypt('my-secure-passphrase');
    expect(stored.startsWith('scrypt1$')).toBe(true);
    expect(verifyScryptPassword('my-secure-passphrase', stored)).toBe(true);
    expect(verifyScryptPassword('other', stored)).toBe(false);
  });
  it('verifyScryptPassword accepts hashes from scrypt1 format', () => {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync('test-password-ok', salt, 64);
    const stored = `scrypt1$${salt.toString('hex')}$${hash.toString('hex')}`;
    expect(verifyScryptPassword('test-password-ok', stored)).toBe(true);
    expect(verifyScryptPassword('wrong', stored)).toBe(false);
  });

  it('verifyScryptPassword rejects malformed strings', () => {
    expect(verifyScryptPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyScryptPassword('x', 'scrypt1$zz$aa')).toBe(false);
  });
});
