import type { ReportSlug } from './reportsCatalog'

export const CHAIRMAN_REPORT_GROUPS: { title: string; slugs: ReportSlug[] }[] = [
  { title: 'Portfolio', slugs: ['net-worth', 'exposure'] },
  { title: 'Liquidity & risk', slugs: ['liquidity', 'risk', 'liability'] },
  { title: 'Assets & compliance', slugs: ['property', 'documents'] },
]

export function chairmanRelatedViews(slug: ReportSlug): { to: string; label: string }[] {
  switch (slug) {
    case 'monthly':
      return [
        { to: '/', label: 'Overview' },
        { to: '/treasury', label: 'Treasury' },
        { to: '/assets', label: 'Assets' },
      ]
    case 'net-worth':
      return [
        { to: '/', label: 'Overview' },
        { to: '/assets', label: 'Assets' },
        { to: '/reports', label: 'Reports' },
      ]
    case 'liquidity':
      return [
        { to: '/treasury', label: 'Treasury' },
        { to: '/', label: 'Overview' },
        { to: '/reports', label: 'Reports' },
      ]
    case 'risk':
      return [
        { to: '/assets', label: 'Assets' },
        { to: '/treasury', label: 'Treasury' },
        { to: '/documents', label: 'Compliance' },
      ]
    case 'property':
      return [
        { to: '/assets', label: 'Assets' },
        { to: '/', label: 'Overview' },
        { to: '/reports', label: 'Reports' },
      ]
    case 'liability':
      return [
        { to: '/treasury', label: 'Treasury' },
        { to: '/', label: 'Overview' },
        { to: '/reports', label: 'Reports' },
      ]
    case 'exposure':
      return [
        { to: '/assets', label: 'Assets' },
        { to: '/', label: 'Overview' },
        { to: '/treasury', label: 'Treasury' },
      ]
    case 'documents':
      return [
        { to: '/documents', label: 'Compliance' },
        { to: '/', label: 'Overview' },
        { to: '/audit', label: 'Audit trail' },
      ]
    default:
      return [{ to: '/', label: 'Overview' }]
  }
}
