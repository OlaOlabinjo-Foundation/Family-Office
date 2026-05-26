import { describe, it, expect } from 'vitest';
import { amountToNgn, normalizeCurrencyCode, masterBookValueNgn } from './currency.js';

describe('currency', () => {
  it('normalises GBP labels from workbook', () => {
    expect(normalizeCurrencyCode('Pounds')).toBe('GBP');
    expect(normalizeCurrencyCode('GBP')).toBe('GBP');
    expect(normalizeCurrencyCode('£')).toBe('GBP');
  });

  it('converts GBP amounts to NGN book using FX rate', () => {
    const ngn = amountToNgn(1_000_000, 'GBP');
    expect(ngn).toBeGreaterThan(1_000_000);
  });

  it('does not treat GBP face value as NGN in master book', () => {
    const ngn = masterBookValueNgn({
      current_value: 1_000_000,
      associated_debt: 0,
      currency: 'GBP',
    });
    expect(ngn).toBe(amountToNgn(1_000_000, 'GBP'));
    expect(ngn).not.toBe(1_000_000);
  });
});
