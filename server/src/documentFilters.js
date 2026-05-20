/**
 * Shared rules for the document tracker and dashboard compliance digest.
 * Keep JS predicates aligned with SQL fragments used in server routes.
 */

/** @param {Record<string, unknown>} d */
export function isTrackedDocumentRow(d) {
  const cat = String(d.document_category ?? '').trim();
  const ent = String(d.entity_asset ?? '').trim();
  return cat.length > 0 || ent.length > 0;
}

/** @param {Record<string, unknown>} d */
export function isOutstandingDocumentRow(d) {
  if (!isTrackedDocumentRow(d)) return false;
  const st = String(d.status || '').toLowerCase();
  if (st.includes('complete') || st.includes('received')) return false;
  return st.includes('missing') || st.includes('pending') || st.includes('requested') || st === 'open';
}

/** Parenthesised SQL: rows that appear in GET /api/documents/tracker (all). */
export const TRACKED_DOC_WHERE = `(
  (document_category IS NOT NULL AND length(trim(document_category)) > 0)
  OR (entity_asset IS NOT NULL AND length(trim(entity_asset)) > 0)
)`;

/**
 * SQL fragment (parenthesised) for “open / incomplete” statuses.
 * Combine with tracked: WHERE ${TRACKED_DOC_WHERE} AND ${OUTSTANDING_DOC_STATUS_WHERE}
 */
export const OUTSTANDING_DOC_STATUS_WHERE = `(
  lower(trim(ifnull(status,''))) NOT LIKE '%complete%'
  AND lower(trim(ifnull(status,''))) NOT LIKE '%received%'
  AND (
    lower(trim(ifnull(status,''))) LIKE '%missing%'
    OR lower(trim(ifnull(status,''))) LIKE '%pending%'
    OR lower(trim(ifnull(status,''))) LIKE '%requested%'
    OR lower(trim(ifnull(status,''))) = 'open'
  )
)`;

export const TRACKER_SORT_OLDEST_REQUESTED = `CASE WHEN date_requested IS NULL OR trim(COALESCE(date_requested,'')) = '' THEN 1 ELSE 0 END ASC, date_requested ASC, id ASC`;
