import { amountToNgn } from './currency.js';

const MS_DAY = 86400000;

function parseIsoDate(s) {
  if (!s || typeof s !== 'string') return null;
  const d = new Date(s.slice(0, 10) + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / MS_DAY);
}

function cashTreasuryTracked(c) {
  return (
    c.current_balance != null ||
    c.minimum_required_balance != null ||
    (c.average_monthly_outflow != null && Number(c.average_monthly_outflow) > 0) ||
    (c.last_reconciled_date != null && String(c.last_reconciled_date).trim() !== '')
  );
}

/** Best-effort deep link for a cash row (aligns with decision ids like DEC-REC-<account_id>). */
function treasuryRowCta(c, flags) {
  const aid = String(c.account_id || '').trim();
  if (flags.reconciliationStale && flags.tracked && aid) {
    return `/decisions?focus=${encodeURIComponent(`DEC-REC-${aid}`)}`;
  }
  if (flags.belowMinimum && aid) {
    return '/risk';
  }
  if (aid) {
    return `/search?q=${encodeURIComponent(aid)}`;
  }
  const bank = String(c.bank_name || '').trim().slice(0, 120);
  if (bank) {
    return `/search?q=${encodeURIComponent(bank)}`;
  }
  return '/treasury';
}

/**
 * Cash & banking intelligence aligned to workbook + risk engine rules.
 * @param {import('better-sqlite3').Database} database
 */
export function getTreasuryOverview(database) {
  const now = new Date();
  const rows = database.prepare('SELECT * FROM cash_banking ORDER BY id ASC').all();

  let totalBalance = 0;
  let trackedBalance = 0;
  let belowMinimumCount = 0;
  let staleReconciliationCount = 0;

  const items = rows.map((c) => {
    const tracked = cashTreasuryTracked(c);
    const bal = c.current_balance;
    if (bal != null && Number.isFinite(bal)) {
      const balNgn = amountToNgn(bal, c.currency);
      totalBalance += balNgn;
      if (tracked) trackedBalance += balNgn;
    }

    let belowMinimum = false;
    const minb = c.minimum_required_balance;
    if (minb != null && bal != null && bal < minb) {
      belowMinimum = true;
      belowMinimumCount++;
    }

    const rec = parseIsoDate(c.last_reconciled_date);
    let reconciliationStale = false;
    let reconciliationDaysSince = null;
    if (tracked) {
      const days = rec ? daysBetween(now, rec) : 9999;
      reconciliationDaysSince = rec ? days : null;
      if (!rec || days > 30) {
        reconciliationStale = true;
        staleReconciliationCount++;
      }
    }

    return {
      ...c,
      flags: {
        tracked,
        belowMinimum,
        reconciliationStale,
        reconciliationDaysSince
      },
      ctaTo: treasuryRowCta(c, {
        tracked,
        belowMinimum,
        reconciliationStale,
        reconciliationDaysSince
      })
    };
  });

  return {
    asOf: now.toISOString(),
    totals: {
      totalBalance,
      trackedBalance,
      accountRows: rows.length,
      belowMinimumCount,
      staleReconciliationCount
    },
    items
  };
}

/**
 * Flat rows for CSV export (cash columns + computed policy flags).
 * @param {import('better-sqlite3').Database} database
 * @returns {Record<string, unknown>[]}
 */
export function getTreasuryExportFlatRows(database) {
  const { items } = getTreasuryOverview(database);
  return items.map((row) => {
    const { flags, ...rest } = row;
    return {
      ...rest,
      flag_tracked: flags.tracked ? 1 : 0,
      flag_below_minimum: flags.belowMinimum ? 1 : 0,
      flag_reconciliation_stale: flags.reconciliationStale ? 1 : 0,
      flag_reconciliation_days_since:
        flags.reconciliationDaysSince === null || flags.reconciliationDaysSince === undefined
          ? ''
          : flags.reconciliationDaysSince
    };
  });
}
