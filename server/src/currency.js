import { FX_NGN_PER_EUR, FX_NGN_PER_GBP, FX_NGN_PER_USD } from './config.js';

/** @typedef {'NGN' | 'USD' | 'GBP' | 'EUR'} BookCurrency */

/**
 * Normalise workbook / form currency labels to ISO codes.
 * @param {unknown} raw
 * @returns {BookCurrency}
 */
export function normalizeCurrencyCode(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z£$€₦]/g, '');
  if (!s) return 'NGN';
  if (s === 'NGN' || s === 'NAIRA' || s === '₦' || s === 'N') return 'NGN';
  if (s === 'USD' || s === 'DOLLAR' || s === 'US' || s === '$') return 'USD';
  if (s === 'GBP' || s === 'POUND' || s === 'POUNDS' || s === 'STERLING' || s === '£' || s === 'UK') return 'GBP';
  if (s === 'EUR' || s === 'EURO' || s === '€') return 'EUR';
  if (s.startsWith('GBP') || s.includes('POUND')) return 'GBP';
  if (s.startsWith('USD')) return 'USD';
  if (s.startsWith('EUR')) return 'EUR';
  if (s.startsWith('NGN') || s.includes('NAIRA')) return 'NGN';
  return 'NGN';
}

/**
 * Convert an amount in its native currency to NGN book (for aggregation).
 * @param {number | null | undefined} amount
 * @param {unknown} currency
 */
export function amountToNgn(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const code = normalizeCurrencyCode(currency);
  if (code === 'NGN') return n;
  if (code === 'USD') return n * FX_NGN_PER_USD;
  if (code === 'GBP') return n * FX_NGN_PER_GBP;
  if (code === 'EUR') return n * FX_NGN_PER_EUR;
  return n;
}

/**
 * @param {{ net_value?: number | null, current_value?: number | null, associated_debt?: number | null, currency?: unknown }} row
 */
export function masterBookValueNative(row) {
  const nv =
    row.net_value ??
    (row.current_value != null ? Number(row.current_value) - (Number(row.associated_debt) || 0) : null);
  const n = Number(nv);
  return Number.isFinite(n) ? n : 0;
}

/** @param {{ net_value?: number | null, current_value?: number | null, associated_debt?: number | null, currency?: unknown }} row */
export function masterBookValueNgn(row) {
  return amountToNgn(masterBookValueNative(row), row.currency);
}
