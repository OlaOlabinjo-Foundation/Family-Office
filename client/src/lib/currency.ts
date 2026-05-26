export type BookCurrency = 'NGN' | 'USD' | 'GBP' | 'EUR'

export function normalizeCurrency(code: string | null | undefined): BookCurrency {
  const s = String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z£$€₦]/g, '')
  if (!s) return 'NGN'
  if (s === 'NGN' || s === 'NAIRA' || s === '₦') return 'NGN'
  if (s === 'USD' || s === '$') return 'USD'
  if (s === 'GBP' || s === 'POUND' || s === 'POUNDS' || s === '£' || s.includes('POUND')) return 'GBP'
  if (s === 'EUR' || s === '€') return 'EUR'
  return 'NGN'
}

const LOCALE: Record<BookCurrency, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
}

/** Format in the line's native currency (not NGN unless currency is NGN). */
export function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const c = normalizeCurrency(currency)
  try {
    return new Intl.NumberFormat(LOCALE[c], {
      style: 'currency',
      currency: c,
      maximumFractionDigits: c === 'NGN' ? 0 : 2,
    }).format(value)
  } catch {
    return `${c} ${value.toLocaleString()}`
  }
}

/** Default NGN per unit — keep in sync with server `config.js` / `.env.example`. */
const FX_NGN_PER_USD = 1600
const FX_NGN_PER_GBP = 2050
const FX_NGN_PER_EUR = 1750

/** Convert native amount to NGN book (for ranking / secondary labels). */
export function amountToBookNgn(value: number | null | undefined, currency?: string | null) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const c = normalizeCurrency(currency)
  if (c === 'NGN') return n
  if (c === 'USD') return n * FX_NGN_PER_USD
  if (c === 'GBP') return n * FX_NGN_PER_GBP
  if (c === 'EUR') return n * FX_NGN_PER_EUR
  return n
}

export function formatMoneyCompact(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const c = normalizeCurrency(currency)
  try {
    return new Intl.NumberFormat(LOCALE[c], {
      style: 'currency',
      currency: c,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return formatMoney(value, c)
  }
}
