import fs from 'fs';
import path from 'path';
import { db, getDatabaseFilePath } from './db.js';

const MAX_BACKUPS = 8;

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
