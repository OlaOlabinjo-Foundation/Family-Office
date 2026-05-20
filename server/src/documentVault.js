import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseFilePath } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VAULT_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.doc',
  '.docx',
  '.xlsx',
  '.xls',
  '.csv',
  '.txt',
]);

/** @returns {string} */
export function getVaultRoot() {
  const env = typeof process.env.FAMILY_OFFICE_VAULT_DIR === 'string' ? process.env.FAMILY_OFFICE_VAULT_DIR.trim() : '';
  if (env) return path.resolve(env);
  const dbFile = getDatabaseFilePath();
  if (dbFile === ':memory:') {
    return path.join(__dirname, '../data/vault');
  }
  return path.join(path.dirname(dbFile), 'vault');
}

export function ensureVaultRoot() {
  const root = getVaultRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'file')).replace(/[^\w.\- ()]/g, '_').slice(0, 180);
  return base || 'file';
}

/**
 * @param {{ originalname?: string; mimetype?: string; size?: number; buffer?: Buffer }} file
 */
export function validateVaultUpload(file) {
  if (!file?.buffer?.length) return { ok: false, error: 'No file provided' };
  const size = Number(file.size) || file.buffer.length;
  if (size > VAULT_MAX_BYTES) return { ok: false, error: 'File exceeds 25 MB limit' };
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, error: `File type not allowed (${ext || 'no extension'}). Use PDF, images, Office, or CSV.` };
  }
  return { ok: true };
}

export function getDocumentRow(database, documentRowId) {
  return database.prepare('SELECT * FROM documents WHERE id = ?').get(documentRowId) || null;
}

function rowToFile(r) {
  if (!r) return null;
  return {
    id: r.id,
    documentRowId: r.document_row_id,
    originalFilename: r.original_filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
    note: r.note,
  };
}

export function listVaultFiles(database, documentRowId) {
  const rows = database
    .prepare(
      `SELECT id, document_row_id, original_filename, mime_type, size_bytes, uploaded_by, uploaded_at, note
       FROM document_vault_files
       WHERE document_row_id = ? AND deleted_at IS NULL
       ORDER BY uploaded_at DESC, id DESC`
    )
    .all(documentRowId);
  return rows.map((r) => rowToFile(r));
}

export function getVaultFileById(database, fileId) {
  const r = database
    .prepare(`SELECT * FROM document_vault_files WHERE id = ? AND deleted_at IS NULL`)
    .get(fileId);
  return rowToFile(r);
}

export function attachVaultCounts(database, rows) {
  if (!rows?.length) return rows || [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const counts = database
    .prepare(
      `SELECT document_row_id, COUNT(*) as c FROM document_vault_files
       WHERE document_row_id IN (${placeholders}) AND deleted_at IS NULL
       GROUP BY document_row_id`
    )
    .all(...ids);
  const map = new Map(counts.map((c) => [c.document_row_id, c.c]));
  return rows.map((r) => ({ ...r, vault_file_count: map.get(r.id) || 0 }));
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {number} documentRowId
 * @param {{ originalname?: string; mimetype?: string; size?: number; buffer: Buffer }} file
 * @param {string} actor
 * @param {string | null | undefined} note
 */
export function uploadVaultFile(database, documentRowId, file, actor, note) {
  const doc = getDocumentRow(database, documentRowId);
  if (!doc) return { ok: false, status: 404, error: 'Document row not found' };

  const v = validateVaultUpload(file);
  if (!v.ok) return { ok: false, status: 400, error: v.error };

  const root = ensureVaultRoot();
  const storedName = `${crypto.randomUUID()}-${sanitizeFilename(file.originalname)}`;
  const relDir = String(documentRowId);
  const absDir = path.join(root, relDir);
  fs.mkdirSync(absDir, { recursive: true });
  const absPath = path.join(absDir, storedName);
  fs.writeFileSync(absPath, file.buffer);

  const mime = file.mimetype || 'application/octet-stream';
  const size = Number(file.size) || file.buffer.length;
  const noteTrim = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null;

  const ins = database
    .prepare(
      `INSERT INTO document_vault_files (
        document_row_id, original_filename, stored_name, mime_type, size_bytes, uploaded_by, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(documentRowId, file.originalname || storedName, storedName, mime, size, actor, noteTrim);

  return { ok: true, file: getVaultFileById(database, ins.lastInsertRowid), document: doc };
}

export function resolveVaultFilePath(database, fileId) {
  const row = database
    .prepare(`SELECT * FROM document_vault_files WHERE id = ? AND deleted_at IS NULL`)
    .get(fileId);
  if (!row) return null;
  const absPath = path.join(getVaultRoot(), String(row.document_row_id), row.stored_name);
  if (!fs.existsSync(absPath)) return null;
  return { row, absPath };
}

export function deleteVaultFile(database, fileId, actor) {
  const resolved = resolveVaultFilePath(database, fileId);
  if (!resolved) return { ok: false, status: 404, error: 'File not found' };
  try {
    fs.unlinkSync(resolved.absPath);
  } catch {
    /* file may already be removed from disk */
  }
  database
    .prepare(
      `UPDATE document_vault_files SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ?`
    )
    .run(actor, fileId);
  return { ok: true, row: resolved.row };
}

export function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
