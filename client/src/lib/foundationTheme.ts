/**
 * Ola Olabinjo Investment — foundation brand palette (dark UI).
 * Harvest · Grove · Linen · Clay on black.
 */
export const FOUNDATION = {
  harvest: '#C8871A',
  grove: '#3B5E45',
  linen: '#F5EFE0',
  clay: '#A64E2A',
  black: '#000000',
} as const

/** RGB tuples for jsPDF / canvas */
export const FOUNDATION_RGB = {
  harvest: [200, 135, 36] as const,
  grove: [59, 94, 69] as const,
  linen: [245, 239, 224] as const,
  clay: [166, 78, 42] as const,
  ink: [20, 24, 21] as const,
  muted: [140, 132, 118] as const,
}

export const CHART_PRIMARY = FOUNDATION.harvest

/** Multi-series charts — foundation colours only */
export const CHART_PALETTE = [
  FOUNDATION.harvest,
  FOUNDATION.grove,
  FOUNDATION.clay,
  'rgba(200, 135, 36, 0.72)',
  'rgba(59, 94, 69, 0.85)',
  'rgba(166, 78, 42, 0.85)',
] as const

export const CHART_PALETTE_EXTENDED = [
  ...CHART_PALETTE,
  'rgba(200, 135, 36, 0.48)',
  'rgba(200, 135, 36, 0.32)',
  'rgba(59, 94, 69, 0.55)',
  'rgba(245, 239, 224, 0.35)',
] as const

export const CHART_TOOLTIP = {
  contentStyle: {
    background: '#0e100e',
    border: '1px solid rgba(59, 94, 69, 0.55)',
    borderRadius: 10,
    boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
  },
  labelStyle: { color: FOUNDATION.linen, fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: 'rgba(245, 239, 224, 0.88)' },
  wrapperStyle: { outline: 'none' as const },
}

export const CHART_AXIS = {
  grid: 'rgba(59, 94, 69, 0.35)',
  tick: 'rgba(245, 239, 224, 0.55)',
}
