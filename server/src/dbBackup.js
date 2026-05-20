import fs from 'fs';
import path from 'path';
import { db, getDatabaseFilePath } from './db.js';
import { getVaultRoot } from './documentVault.js';

const MAX_BACKUPS = 8;
const MAX_SCHEDULED_BACKUPS = 14;

/**
 * Creates a consistent SQLite snapshot before destructive import.
 * Skips for :memory: or missing file paths.
 * @returns {{ ok: true, skipped?: boolean, path?: string, reason?: string }}
 */
export function backupDatabaseBeforeImport() {
  const dbPath = getDatabaseFilePath();
  if (!dbPath || dbPath === ':memory:') {
    return { ok: true, skipped: true, reason: 'memory_or_empty_path' };
  }
  if (!fs.existsSync(dbPath)) {
    return { ok: true, skipped: true, reason: 'db_file_missing' };
  }

  const backupDir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `pre-import-${stamp}.sqlite`);

  const sqlPath = dest.replace(/\\/g, '/').replace(/'/g, "''");
  db.exec(`VACUUM INTO '${sqlPath}'`);

  rotateOldBackups(backupDir, 'pre-import-', MAX_BACKUPS);

  return { ok: true, path: dest };
}

function rotateOldBackups(dir, prefix, keep) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.sqlite'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  for (let i = keep; i < files.length; i++) {
    try {
      fs.unlinkSync(path.join(dir, files[i].f));
    } catch {
      /* ignore */
    }
  }
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

/**
 * Full site backup: SQLite VACUUM INTO + vault directory copy.
 * @param {{ prefix?: string }} [opts]
 * @returns {{ ok: true, skipped?: boolean, reason?: string, databasePath?: string, vaultPath?: string, stamp?: string }}
 */
export function backupFullSite(opts = {}) {
  const prefix = opts.prefix || 'scheduled-';
  const dbPath = getDatabaseFilePath();
  if (!dbPath || dbPath === ':memory:') {
    return { ok: true, skipped: true, reason: 'memory_or_empty_path' };
  }
  if (!fs.existsSync(dbPath)) {
    return { ok: true, skipped: true, reason: 'db_file_missing' };
  }

  const backupDir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbDest = path.join(backupDir, `${prefix}${stamp}.sqlite`);
  const sqlPath = dbDest.replace(/\\/g, '/').replace(/'/g, "''");
  db.exec(`VACUUM INTO '${sqlPath}'`);
  rotateOldBackups(backupDir, prefix, MAX_SCHEDULED_BACKUPS);

  let vaultPath;
  const vaultRoot = getVaultRoot();
  if (fs.existsSync(vaultRoot)) {
    const vaultDest = path.join(backupDir, `${prefix}${stamp}-vault`);
    copyDirRecursive(vaultRoot, vaultDest);
    vaultPath = vaultDest;
    rotateOldVaultBackups(backupDir, `${prefix}`, MAX_SCHEDULED_BACKUPS);
  }

  return { ok: true, databasePath: dbDest, vaultPath, stamp };
}

function rotateOldVaultBackups(dir, prefix, keep) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('-vault'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  for (let i = keep; i < files.length; i++) {
    try {
      fs.rmSync(path.join(dir, files[i].f), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
