import { formatCompactFx, formatCompactNgn } from './format'
import type { ChairmanBriefInput } from './chairmanNarrative'

export type ChairmanSpotlight = {
  kind: string
  id: number
  title: string
  subtitle: string
  currency?: string
  valueNative?: number
  valueNgn: number
  trendLabel: string
  href: string
  riskLevel: string
}

export type ChairmanRecommendation = {
  id?: string
  headline: string
  body: string
  priority: string
  category?: string
  confidence?: number
  ctaTo?: string
}

export type ChairmanPropertyReturn = {
  id: number
  name: string
  country: string
  currentValueNgn: number
  impliedReturnPct: number | null
}

export type ChairmanHolding = {
  id: number
  kind?: string
  name: string
  category: string
  valueNgn: number
  href?: string
  /** Source register (e.g. Real estate register, not “the only” asset type). */
  register?: string
  jurisdiction?: string | null
  currency?: string
  valueNative?: number
}

export type ChairmanExecutiveData = ChairmanBriefInput & {
  countryExposure?: { name: string; value: number }[]
  recommendations?: ChairmanRecommendation[]
  topPropertyByReturn?: ChairmanPropertyReturn[]
  topHoldingsByValue?: ChairmanHolding[]
  portfolioAssets?: ChairmanHolding[]
  snapshotTrend?: { at: string; netPosition: number; healthScore: number }[]
  chairmanSpotlights?: {
    property: ChairmanSpotlight | null
    privateEquity: ChairmanSpotlight | null
    liquidAccount: ChairmanSpotlight | null
  }
  netWorthFX?: {
    netWorth?: { ngn: number; usd: number }
  }
}

export function healthToRiskLabel(score: number): string {
  if (score >= 75) return 'Low'
  if (score >= 55) return 'Moderate'
  if (score >= 40) return 'Elevated'
  return 'High'
}

export function attentionCount(data: ChairmanExecutiveData): number {
  return (
    (data.outstandingDocumentation || 0) +
    (data.complianceCalendar?.overdueCount || 0) +
    (data.pendingDecisions || 0)
  )
}

export function portfolioStatusLine(data: ChairmanExecutiveData): string {
  const parts: string[] = []
  const risk = healthToRiskLabel(data.portfolioHealthScore)
  if (risk === 'Low' || risk === 'Moderate') parts.push('Portfolio stable')
  else parts.push('Portfolio requires attention')

  const topCountry = [...(data.countryExposure || [])].sort((a, b) => b.value - a.value)[0]
  if (topCountry?.name) {
    parts.push(`meaningful exposure in ${topCountry.name}`)
  }

  const liq = data.liquidityRatio
  if (liq >= 0.15) parts.push('liquidity is adequate')
  else if (liq > 0) parts.push('liquidity is tight relative to assets')
  else parts.push('liquidity data is limited')

  return parts.join('. ') + '.'
}

export function formatNetChange(data: ChairmanExecutiveData): { text: string; positive: boolean } | null {
  const mov = data.monthlyPortfolioMovement
  if (!mov || mov.basis !== 'snapshot_delta' || mov.netPositionChange == null) return null
  const positive = mov.netPositionChange >= 0
  const text = `${positive ? '+' : ''}${formatCompactNgn(mov.netPositionChange)}`
  return { text, positive }
}

export function formatUsdIndicative(ngn: number, usdRate?: number): string {
  if (!usdRate || usdRate <= 0) return formatCompactNgn(ngn)
  return formatCompactFx(ngn / usdRate, 'USD')
}

/** Chairman-safe deep link for an insight row (no /decisions or /actions). */
export function chairmanInsightHref(headline: string, body: string): string {
  const text = `${headline} ${body}`.toLowerCase()
  if (/vault|document|title|perfection|compliance|evidence/.test(text)) return '/documents?outstanding=1'
  if (/liquidity|treasury|cash|credit|buffer/.test(text)) return '/treasury'
  if (/concentrat|real estate|asset|diversif|exposure|hedg/.test(text)) return '/assets'
  return '/reports/monthly'
}
