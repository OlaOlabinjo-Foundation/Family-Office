import { db } from './db.js';
import { ensureSoftDeleteColumns, SOFT_DELETE_TABLES } from './registerData.js';

function activeClause(table) {
  if (!SOFT_DELETE_TABLES.has(table)) return '';
  ensureSoftDeleteColumns(db);
  return ' AND deleted_at IS NULL';
}

/**
 * @param {import('better-sqlite3').Database} database
 */
export function buildEntityExposure(database = db) {
  ensureSoftDeleteColumns(database);
  /** @type {Map<string, { name: string; assets: number; cash: number; realEstate: number; securities: number; liabilities: number }>} */
  const map = new Map();

  function bucket(name) {
    const n = String(name || '').trim();
    if (!n) return null;
    if (!map.has(n)) {
      map.set(n, { name: n, assets: 0, cash: 0, realEstate: 0, securities: 0, liabilities: 0 });
    }
    return map.get(n);
  }

  const master = database
    .prepare(
      `SELECT legal_owner_entity, net_value, current_value, associated_debt FROM master_assets WHERE 1=1${activeClause('master_assets')}`
    )
    .all();
  for (const m of master) {
    const b = bucket(m.legal_owner_entity);
    if (!b) continue;
    const nv =
      m.net_value ??
      (m.current_value != null ? Number(m.current_value) - (Number(m.associated_debt) || 0) : 0);
    b.assets += Number(nv) || 0;
  }

  const cash = database
    .prepare(`SELECT owner_entity, current_balance FROM cash_banking WHERE 1=1${activeClause('cash_banking')}`)
    .all();
  for (const c of cash) {
    const b = bucket(c.owner_entity);
    if (!b) continue;
    b.cash += Number(c.current_balance) || 0;
  }

  const re = database
    .prepare(`SELECT owner_entity, current_value FROM real_estate WHERE 1=1${activeClause('real_estate')}`)
    .all();
  for (const r of re) {
    const b = bucket(r.owner_entity);
    if (!b) continue;
    b.realEstate += Number(r.current_value) || 0;
  }

  const sec = database
    .prepare(`SELECT owner_entity, market_value FROM public_securities WHERE 1=1${activeClause('public_securities')}`)
    .all();
  for (const s of sec) {
    const b = bucket(s.owner_entity);
    if (!b) continue;
    b.securities += Number(s.market_value) || 0;
  }

  const liab = database
    .prepare(
      `SELECT borrower_entity, outstanding_balance FROM liabilities WHERE 1=1${activeClause('liabilities')}`
    )
    .all();
  for (const L of liab) {
    const b = bucket(L.borrower_entity);
    if (!b) continue;
    b.liabilities += Number(L.outstanding_balance) || 0;
  }

  const items = [...map.values()]
    .map((e) => {
      const grossAssets = e.assets + e.cash + e.realEstate + e.securities;
      const netPosition = grossAssets - e.liabilities;
      return { ...e, grossAssets, netPosition };
    })
    .sort((a, b) => Math.abs(b.netPosition) - Math.abs(a.netPosition));

  return {
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    items,
  };
}
