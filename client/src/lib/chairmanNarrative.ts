import { formatCompactNgn, formatNgn, formatPct } from './format'

export type ChairmanMovement =
  | {
      basis: 'snapshot_delta'
      netPositionChange: number
      priorAsOf: string
      currentAsOf: string
    }
  | { basis: 'baseline' | 'none'; message?: string }

export type ChairmanBriefInput = {
  brand: string
  asOf?: string
  netPosition: number
  totalAssets: number
  totalLiabilities: number
  cashPosition: number
  liquidityRatio: number
  portfolioHealthScore: number
  pendingDecisions: number
  outstandingDocumentation: number
  monthlyPortfolioMovement?: ChairmanMovement | null
  complianceCalendar?: {
    overdueCount: number
    dueNext30Count?: number
  }
  allocation?: { name: string; value: number }[]
}

export function buildChairmanNarrative(data: ChairmanBriefInput): string[] {
  const paragraphs: string[] = []

  paragraphs.push(
    `As of this view, ${data.brand} reports total assets of ${formatNgn(data.totalAssets)}, liabilities of ${formatNgn(data.totalLiabilities)}, and a net position of ${formatNgn(data.netPosition)}. Cash and near-cash balances stand at ${formatNgn(data.cashPosition)} with a liquidity ratio of ${formatPct(data.liquidityRatio)}. The portfolio health indicator is ${data.portfolioHealthScore} out of 100.`
  )

  const mov = data.monthlyPortfolioMovement
  if (mov && mov.basis === 'snapshot_delta') {
    const dir = mov.netPositionChange >= 0 ? 'increased' : 'decreased'
    paragraphs.push(
      `Compared with the prior snapshot (${String(mov.priorAsOf).slice(0, 10)}), net position has ${dir} by ${formatNgn(Math.abs(mov.netPositionChange))} to the current book date (${String(mov.currentAsOf).slice(0, 10)}).`
    )
  } else if (mov?.basis === 'baseline' && mov.message) {
    paragraphs.push(mov.message)
  }

  const attention: string[] = []
  if (data.outstandingDocumentation > 0) {
    attention.push(
      `${data.outstandingDocumentation} compliance document${data.outstandingDocumentation === 1 ? '' : 's'} remain outstanding in the tracker`
    )
  }
  if (data.complianceCalendar?.overdueCount) {
    attention.push(
      `${data.complianceCalendar.overdueCount} calendar item${data.complianceCalendar.overdueCount === 1 ? '' : 's'} past due (filings, KYC, or attestations)`
    )
  }
  if (data.complianceCalendar?.dueNext30Count) {
    attention.push(
      `${data.complianceCalendar.dueNext30Count} calendar item${data.complianceCalendar.dueNext30Count === 1 ? '' : 's'} due within the next 30 days`
    )
  }
  if (data.pendingDecisions > 0) {
    attention.push(
      `${data.pendingDecisions} open decision${data.pendingDecisions === 1 ? '' : 's'} awaiting family office action`
    )
  }

  if (attention.length) {
    paragraphs.push(`Items requiring attention: ${attention.join('; ')}.`)
  } else {
    paragraphs.push('No material compliance or decision backlog is flagged on the current book.')
  }

  const topAlloc = [...(data.allocation ?? [])]
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
  if (topAlloc.length) {
    const mix = topAlloc.map((a) => `${a.name} (${formatCompactNgn(a.value)})`).join(', ')
    paragraphs.push(`Largest asset categories by value: ${mix}.`)
  }

  return paragraphs
}
