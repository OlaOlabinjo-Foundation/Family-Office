#!/usr/bin/env node
/**
 * Full backup: SQLite database + document vault.
 *
 * Usage:
 *   node server/scripts/backup-full.mjs
 *   FAMILY_OFFICE_SQLITE=server/data/family-office.sqlite node server/scripts/backup-full.mjs
 *
 * Schedule (example cron, daily 02:00):
 *   0 2 * * * cd /path/to/repo && FAMILY_OFFICE_SQLITE=server/data/family-office.sqlite node server/scripts/backup-full.mjs
 */
import { migrate } from '../src/db.js';
import { backupFullSite } from '../src/dbBackup.js';

migrate();
const result = backupFullSite({ prefix: 'scheduled-' });

if (result.skipped) {
  console.log('[backup] Skipped:', result.reason);
  process.exit(0);
}

console.log('[backup] Database:', result.databasePath);
if (result.vaultPath) console.log('[backup] Vault:', result.vaultPath);
console.log('[backup] Done at', result.stamp);
