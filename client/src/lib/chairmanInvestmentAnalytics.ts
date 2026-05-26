import type { ChairmanExecutiveData } from './chairmanExecutive'

export type PropertyReturnRow = {
  id: number
  name: string
  impliedReturnPct: number | null
  currentValueNgn: number
  country: string
}

export type HoldingRow = {
  id: number
  kind: string
  name: string
  fullName: string
  category: string
  register: string
  valueNgn: number
  href: string
}

export type AllocationGapRow = {
  name: string
  currentPct: number
  targetPct: number
  gapPct: number
  value: number
}

const REGISTER_LABEL: Record<string, string> = {
  master: 'Master register',
  real_estate: 'Real estate register',
  securities: 'Public securities',
  private: 'Private investments',
  cash: 'Cash & banking',
}

function portfolioLines(data: ChairmanExecutiveData) {
  const lines = data.portfolioAssets?.length ? data.portfolioAssets : data.topHoldingsByValue || []
  return [...lines].filter((h) => h.valueNgn > 0).sort((a, b) => b.valueNgn - a.valueNgn)
}

/** Top assets by NGN book value across all registers (greatest values first). */
export function topHoldingsChartData(data: ChairmanExecutiveData, limit = 10): HoldingRow[] {
  return portfolioLines(data)
    .slice(0, limit)
    .map((h) => ({
      id: h.id,
      kind: h.kind || 'master',
      fullName: h.name,
      name: h.name.length > 28 ? `${h.name.slice(0, 26)}…` : h.name,
      category: h.category,
      register: h.register || REGISTER_LABEL[h.kind || ''] || 'Portfolio',
      valueNgn: h.valueNgn,
      href: h.href || '/assets',
    }))
}

export function propertyReturnChartData(data: ChairmanExecutiveData): PropertyReturnRow[] {
  return (data.topPropertyByReturn || [])
    .filter((p) => p.impliedReturnPct != null && Number.isFinite(p.impliedReturnPct))
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      name: p.name.length > 22 ? `${p.name.slice(0, 20)}…` : p.name,
      impliedReturnPct: p.impliedReturnPct as number,
      currentValueNgn: p.currentValueNgn,
      country: p.country,
    }))
}

/** Categories under a simple equal-weight target — positive gap = room to add. */
export function allocationGapChartData(data: ChairmanExecutiveData): AllocationGapRow[] {
  const alloc = [...(data.allocation || [])].filter((a) => a.value > 0)
  const total = alloc.reduce((s, a) => s + a.value, 0)
  if (total <= 0 || alloc.length < 2) return []

  const targetPct = 100 / alloc.length
  return alloc
    .map((a) => {
      const currentPct = (a.value / total) * 100
      const gapPct = Math.max(0, targetPct - currentPct)
      return { name: a.name, currentPct, targetPct, gapPct, value: a.value }
    })
    .filter((r) => r.gapPct >= 4)
    .sort((a, b) => b.gapPct - a.gapPct)
    .slice(0, 6)
}
