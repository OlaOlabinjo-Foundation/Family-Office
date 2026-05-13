/**
 * Convert tabular rows to RFC-style CSV (UTF-8). First row = headers from object keys.
 * @param {Record<string, unknown>[]} rows
 */
export function rowsToCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => esc(row[c])).join(','));
  }
  return lines.join('\n');
}
