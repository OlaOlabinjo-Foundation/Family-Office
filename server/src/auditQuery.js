/**
 * Entity-scoped audit filters (row history drawer).
 * Maps logical register keys to entity_type values stored in audit_log.
 */
const ENTITY_TYPE_ALIASES = {
  master_assets: ['master_assets'],
  document: ['document', 'documents'],
  documents: ['document', 'documents'],
};

/**
 * @param {string} entityType
 * @returns {string[]}
 */
export function auditEntityTypesForFilter(entityType) {
  const key = String(entityType || '')
    .trim()
    .toLowerCase();
  if (!key) return [];
  return ENTITY_TYPE_ALIASES[key] ?? [key];
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {{ entityType: string; entityId: string; limit?: number; offset?: number }} opts
 */
export function queryAuditForEntity(database, { entityType, entityId, limit = 50, offset = 0 }) {
  const types = auditEntityTypesForFilter(entityType);
  const id = String(entityId ?? '').trim();
  if (!types.length || !id) {
    return { items: [], total: 0, limit, offset };
  }

  const placeholders = types.map(() => '?').join(', ');
  const where = `entity_type IN (${placeholders}) AND entity_id = ?`;
  const params = [...types, id];

  const totalRow = database.prepare(`SELECT COUNT(*) as c FROM audit_log WHERE ${where}`).get(...params);
  const total = totalRow?.c ?? 0;

  const rows = database
    .prepare(`SELECT * FROM audit_log WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  const items = rows.map((r) => {
    let meta = null;
    if (r.meta_json) {
      try {
        meta = JSON.parse(r.meta_json);
      } catch {
        meta = { raw: r.meta_json };
      }
    }
    const { meta_json, ...rest } = r;
    return { ...rest, meta };
  });

  return { items, total, limit, offset };
}
