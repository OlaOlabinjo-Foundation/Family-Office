#!/usr/bin/env node
/**
 * Seed chairman, lead, analyst, viewer with one shared initial password.
 * Usage: node scripts/seed-all-users.mjs "YourPassword12+"
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const password = process.argv[2];

if (!password || password.length < 10) {
  console.error('Usage: node scripts/seed-all-users.mjs "<password at least 10 chars>"');
  process.exit(1);
}

const users = [
  ['chairman', 'Chairman / Principal', 'chairman'],
  ['lead', 'Family Office Lead', 'lead'],
  ['analyst', 'Analyst', 'analyst'],
  ['viewer', 'Viewer', 'viewer'],
];

for (const [username, displayName, role] of users) {
  const r = spawnSync(
    process.execPath,
    [path.join(root, 'server/scripts/seed-app-user.mjs'), username, displayName, role, password],
    { stdio: 'inherit', cwd: root, env: process.env }
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('\n[done] Seeded 4 users. Use these usernames with the password you provided.');
