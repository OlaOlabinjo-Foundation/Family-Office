#!/usr/bin/env node
/**
 * One-off: normalise Currency column on all register tables (GBP, USD, etc.).
 * Run: node server/scripts/normalize-currencies.mjs
 */
import { migrate, db } from '../src/db.js';
import { normalizeCurrencyCode } from '../src/currency.js';

const TABLES = ['master_assets', 'cash_banking', 'real_estate', 'public_securities', 'liabilities'];

migrate();

let total = 0;
for (const table of TABLES) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
  if (!cols.includes('currency')) continue;
  const rows = db.prepare(`SELECT id, currency FROM ${table}`).all();
  const upd = db.prepare(`UPDATE ${table} SET currency = ? WHERE id = ?`);
  for (const row of rows) {
    const next = normalizeCurrencyCode(row.currency);
    if (next !== row.currency) {
      upd.run(next, row.id);
      total += 1;
    }
  }
  console.log(`[${table}] checked ${rows.length} rows`);
}

console.log(`[done] Normalised ${total} currency value(s). Re-open Command Centre to refresh totals.`);
