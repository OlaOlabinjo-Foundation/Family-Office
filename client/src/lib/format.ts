export function formatCompactNgn(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return String(value)
  }
}

export function formatNgn(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)
}

export function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

/** Compact foreign currency (book is NGN; amounts already converted on server). */
export function formatCompactFx(value: number | null | undefined, currency: 'USD' | 'GBP' | 'EUR') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return String(value)
  }
}
