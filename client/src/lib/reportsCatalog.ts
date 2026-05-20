export const REPORT_CATALOG = [
  { slug: 'monthly', label: 'Monthly family office report' },
  { slug: 'net-worth', label: 'Net worth report' },
  { slug: 'liquidity', label: 'Liquidity report' },
  { slug: 'risk', label: 'Risk report' },
  { slug: 'property', label: 'Property report' },
  { slug: 'liability', label: 'Liability report' },
  { slug: 'exposure', label: 'Investment exposure report' },
  { slug: 'documents', label: 'Document compliance report' },
] as const

export type ReportSlug = (typeof REPORT_CATALOG)[number]['slug']

export function reportLabel(slug: ReportSlug): string {
  return REPORT_CATALOG.find((r) => r.slug === slug)?.label ?? slug
}

export function isReportSlug(value: string | undefined): value is ReportSlug {
  return !!value && REPORT_CATALOG.some((r) => r.slug === value)
}

/** Shareable path for a report pack (e.g. `/reports/monthly`). */
export function reportPath(slug: ReportSlug): string {
  return `/reports/${slug}`
}
