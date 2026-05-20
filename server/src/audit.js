/**
 * Append-only activity log for governance and operational traceability.
 * @param {import('better-sqlite3').Database} database
 * @param {{ actor: string; action: string; entityType?: string; entityId?: string; meta?: Record<string, unknown> }} entry
 */
export function logAudit(database, { actor, action, entityType = null, entityId = null, meta = null }) {
  try {
    database
      .prepare(
        `INSERT INTO audit_log (actor, action, entity_type, entity_id, meta_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(actor, action, entityType, entityId, meta ? JSON.stringify(meta) : null);
  } catch (e) {
    console.warn('[audit] log failed:', e.message);
  }
}

/** Optional human context from operators (e.g. lead explaining an access change). Max 500 chars, single-line. */
export function sanitizeAuditNote(note) {
  if (note == null) return undefined;
  if (typeof note !== 'string') return undefined;
  const s = note.trim().replace(/\s+/g, ' ').slice(0, 500);
  return s.length ? s : undefined;
}
