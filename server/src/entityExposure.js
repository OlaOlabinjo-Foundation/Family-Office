import { db } from './db.js';
import { amountToNgn, masterBookValueNgn } from './currency.js';
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
      `SELECT legal_owner_entity, net_value, current_value, associated_debt, currency FROM master_assets WHERE 1=1${activeClause('master_assets')}`
    )
    .all();
  for (const m of master) {
    const b = bucket(m.legal_owner_entity);
    if (!b) continue;
    b.assets += masterBookValueNgn(m);
  }

  const cash = database
    .prepare(
      `SELECT owner_entity, current_balance, currency FROM cash_banking WHERE 1=1${activeClause('cash_banking')}`
    )
    .all();
  for (const c of cash) {
    const b = bucket(c.owner_entity);
    if (!b) continue;
    b.cash += amountToNgn(c.current_balance, c.currency);
  }

  const re = database
    .prepare(
      `SELECT owner_entity, current_value, currency FROM real_estate WHERE 1=1${activeClause('real_estate')}`
    )
    .all();
  for (const r of re) {
    const b = bucket(r.owner_entity);
    if (!b) continue;
    b.realEstate += amountToNgn(r.current_value, r.currency);
  }

  const sec = database
    .prepare(
      `SELECT owner_entity, market_value, currency FROM public_securities WHERE 1=1${activeClause('public_securities')}`
    )
    .all();
  for (const s of sec) {
    const b = bucket(s.owner_entity);
    if (!b) continue;
    b.securities += amountToNgn(s.market_value, s.currency);
  }

  const liab = database
    .prepare(
      `SELECT borrower_entity, outstanding_balance, currency FROM liabilities WHERE 1=1${activeClause('liabilities')}`
    )
    .all();
  for (const L of liab) {
    const b = bucket(L.borrower_entity);
    if (!b) continue;
    b.liabilities += amountToNgn(L.outstanding_balance, L.currency);
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
