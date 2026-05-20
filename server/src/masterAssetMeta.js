/** @param {import('better-sqlite3').Database} db */
export function distinctMasterValues(db, column) {
  const allowed = new Set(['asset_category', 'jurisdiction', 'currency', 'manager_custodian']);
  if (!allowed.has(column)) return [];
  const rows = db
    .prepare(
      `SELECT DISTINCT ${column} AS v FROM master_assets
       WHERE ${column} IS NOT NULL AND length(trim(${column})) > 0
       ORDER BY lower(trim(${column}))`
    )
    .all();
  return rows.map((r) => String(r.v).trim()).filter(Boolean);
}

export const DEFAULT_MASTER_CATEGORIES = [
  'Real Estate',
  'Cash & Banking',
  'Public Securities',
  'Private Investments',
  'Operating Businesses',
  'Alternative Investments',
  'Other',
];

export const DEFAULT_JURISDICTIONS = ['NG', 'UK', 'US', 'AE', 'CH', 'SG', 'ZA', 'KE', 'GH'];

export const DEFAULT_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];

export const DEFAULT_MANAGERS = [
  'Internal / Family office',
  'Custodian — to be assigned',
  'Private bank',
  'Fund administrator',
];

function mergeSorted(base, fromDb, extra) {
  const set = new Set();
  for (const v of base) if (v) set.add(v);
  for (const v of fromDb) if (v) set.add(v);
  if (extra && String(extra).trim()) set.add(String(extra).trim());
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** @param {import('better-sqlite3').Database} db */
export function getMasterAssetFieldOptions(db, { current } = {}) {
  return {
    categories: mergeSorted(DEFAULT_MASTER_CATEGORIES, distinctMasterValues(db, 'asset_category'), current?.asset_category),
    jurisdictions: mergeSorted(DEFAULT_JURISDICTIONS, distinctMasterValues(db, 'jurisdiction'), current?.jurisdiction),
    currencies: mergeSorted(DEFAULT_CURRENCIES, distinctMasterValues(db, 'currency'), current?.currency),
    managers: mergeSorted(DEFAULT_MANAGERS, distinctMasterValues(db, 'manager_custodian'), current?.manager_custodian),
  };
}

const CATEGORY_PREFIX = {
  'real estate': 'RE',
  'cash & banking': 'CB',
  'cash and banking': 'CB',
  'public securities': 'PS',
  'private investments': 'PI',
  'operating businesses': 'OB',
  'alternative investments': 'AI',
  other: 'OT',
};

export function categoryToAssetPrefix(category) {
  const k = String(category || '')
    .trim()
    .toLowerCase();
  if (CATEGORY_PREFIX[k]) return CATEGORY_PREFIX[k];
  const words = k.split(/\s+/).filter(Boolean);
  if (!words.length) return 'OT';
  if (words.length === 1) return words[0].replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'OT';
  return words
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

/** @param {import('better-sqlite3').Database} db */
export function nextMasterAssetId(db, category) {
  const prefix = categoryToAssetPrefix(category);
  const stem = `OOI-${prefix}-`;
  const rows = db.prepare(`SELECT asset_id FROM master_assets WHERE asset_id LIKE ?`).all(`${stem}%`);
  let max = 0;
  for (const r of rows) {
    const id = String(r.asset_id || '');
    if (!id.startsWith(stem)) continue;
    const tail = id.slice(stem.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `${stem}${String(max + 1).padStart(4, '0')}`;
}
