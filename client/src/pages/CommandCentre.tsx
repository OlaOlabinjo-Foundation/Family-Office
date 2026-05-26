import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import { DataQualityPanel, type DataQualityItem } from '../components/DataQualityPanel'
import { FamilyWelcomeHero } from '../components/FamilyWelcomeHero'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { TableScroll } from '../components/ui/TableScroll'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { CHART_AXIS, CHART_PALETTE_EXTENDED, CHART_PRIMARY, CHART_TOOLTIP } from '../lib/foundationTheme'
import { formatCompactNgn, formatCompactFx, formatMoneyCompact, formatNgn, formatPct } from '../lib/format'

type MonthlyMovement =
  | {
      basis: 'snapshot_delta'
      priorAsOf: string
      currentAsOf: string
      netPositionChange: number
      totalAssetsChange: number
      totalLiabilitiesChange: number
      cashPositionChange: number
    }
  | { basis: 'baseline'; message: string }
  | { basis: 'none'; message: string }

type NetWorthFx = {
  baseCurrency: string
  ratesIndicative: {
    ngnPerUsd: number
    ngnPerGbp: number
    ngnPerEur: number
    disclaimer: string
  }
  grossAssets: { ngn: number; usd: number; gbp: number; eur: number }
  totalLiabilities: { ngn: number; usd: number; gbp: number; eur: number }
  netWorth: { ngn: number; usd: number; gbp: number; eur: number }
}

type PropertyReturnRow = {
  id: number
  name: string
  country: string
  propertyType: string
  currency: string
  currentValue: number
  currentValueNgn: number
  purchasePrice: number | null
  purchasePriceNgn: number | null
  impliedReturnPct: number | null
  riskLevel: string
  propertyPurpose: string | null
}

type TopHoldingRow = {
  id: number
  kind: string
  name: string
  category: string
  currency: string
  valueNative: number
  valueNgn: number
  href: string
}

type ComplianceDigestItem = {
  id: number
  documentCategory: string
  entityAsset: string
  status: string
  dateRequested: string | null
  daysOpen: number | null
  riskLevel: string
}

type ComplianceDigest = {
  outstandingCount: number
  items: ComplianceDigestItem[]
}

type ComplianceCalendarDigest = {
  overdueCount: number
  dueNext30Count: number
  pendingCount: number
  items: {
    id: number
    title: string
    category: string
    entity: string | null
    dueDate: string
    daysUntil: number | null
    overdue: boolean
    owner: string | null
  }[]
}

type Summary = {
  brand: string
  /** Rows in master asset register (0 means empty book). */
  masterAssetRowCount?: number
  totalNetWorth: number
  totalAssets: number
  totalLiabilities: number
  netPosition: number
  cashPosition: number
  netWorthFX?: NetWorthFx
  topPropertyByReturn?: PropertyReturnRow[]
  topHoldingsByValue?: TopHoldingRow[]
  complianceDigest?: ComplianceDigest
  complianceCalendar?: ComplianceCalendarDigest
  monthlyPortfolioMovement?: MonthlyMovement | null
  liquidityRatio: number
  highRiskExposure: number
  pendingDecisions: number
  outstandingDocumentation: number
  portfolioHealthScore: number
  allocation: { name: string; value: number }[]
  countryExposure: { name: string; value: number }[]
  riskSignals: { id: string; category: string; title: string; detail: string; severity: number; level: string; ctaTo: string }[]
  recommendations: {
    id: string
    headline: string
    body: string
    priority: string
    category: string
    confidence: number
    ctaTo?: string
  }[]
  snapshotTrend: { at: string; netPosition: number; healthScore: number }[]
  dataQuality?: { items: DataQualityItem[]; allClear: boolean }
}

const PIE_COLORS = [...CHART_PALETTE_EXTENDED]

function Kpi({
  label,
  value,
  hint,
  to,
}: {
  label: string
  value: string
  hint?: string
  /** When set, the value is clickable and navigates here. */
  to?: string
}) {
  const valueClass =
    'mt-2 font-[family-name:var(--font-display)] text-2xl md:text-3xl text-white transition-colors'
  const valueEl = to ? (
    <Link
      to={to}
      className={`${valueClass} block hover:text-fo-gold-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/50 rounded-sm`}
    >
      {value}
    </Link>
  ) : (
    <div className={valueClass}>{value}</div>
  )
  return (
    <div className="rounded-xl border border-fo-border bg-gradient-to-br from-fo-graphite to-fo-black p-4 md:p-5 shadow-sm shadow-black/25 ring-1 ring-white/[0.04] transition-[box-shadow,transform] duration-200 hover:ring-fo-gold/20 hover:shadow-md hover:shadow-black/40 motion-reduce:transition-none">
      <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
      {valueEl}
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  )
}

function SectionLabel({
  id,
  kicker,
  title,
  hint,
}: {
  id?: string
  kicker: string
  title: string
  hint?: string
}) {
  return (
    <div className="space-y-1 pb-3 border-b border-fo-border/70 mb-1">
      <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold/90">{kicker}</div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <h2 id={id} className="font-[family-name:var(--font-display)] text-xl md:text-2xl text-white tracking-tight">
          {title}
        </h2>
        {hint ? <p className="text-xs text-zinc-500 max-w-xl sm:text-right leading-relaxed">{hint}</p> : null}
      </div>
    </div>
  )
}

type AuditPreview = {
  id: number
  actor: string
  action: string
  entity_type: string | null
  created_at: string
}

export function CommandCentre() {
  const navigate = useNavigate()
  const { token, canViewAudit, canWrite } = useAuth()
  const [data, setData] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [auditFeed, setAuditFeed] = useState<AuditPreview[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await apiFetch<Summary>('/api/dashboard/summary', { token })
        if (!cancelled) setData(s)
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!canViewAudit || !token) return
    let c = false
    ;(async () => {
      try {
        const r = await apiFetch<{ items: AuditPreview[] }>('/api/audit?limit=8', { token })
        if (!c) setAuditFeed(r.items)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      c = true
    }
  }, [token, canViewAudit])

  if (err) {
    return (
      <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
        {err}
      </div>
    )
  }
  if (!data) {
    return <LoadingBlock label="Loading institutional dashboard…" />
  }

  const pieData = (data.allocation ?? [])
    .filter((a) => a.value > 0)
    .map((a) => ({ name: a.name, value: a.value }))
  const pieTotal = pieData.reduce((acc, row) => acc + row.value, 0)

  const topCountries = [...(data.countryExposure ?? [])].sort((a, b) => b.value - a.value).slice(0, 8)

  const mov: MonthlyMovement =
    data.monthlyPortfolioMovement ??
    ({
      basis: 'none',
      message: canWrite
        ? 'No portfolio movement block returned yet. Use Excel import or capture snapshots under Portfolio snapshots.'
        : 'No portfolio movement block returned yet. Capture snapshots under Portfolio snapshots, or ask your family office analyst for an updated workbook import.',
    } satisfies MonthlyMovement)
  const trendData = (data.snapshotTrend ?? []).map((p) => ({
    label: String(p.at).replace('T', ' ').slice(0, 16),
    net: p.netPosition,
  }))

  return (
    <div className="space-y-10">
      <FamilyWelcomeHero
        title={data.brand}
        subtitle="A single calm view of the book: liquidity, concentration, obligations, and documentation — aligned to your Excel registers, with deeper analytics one click away."
      />

      {data.dataQuality ? (
        <DataQualityPanel items={data.dataQuality.items} allClear={data.dataQuality.allClear} />
      ) : null}

      {(data.masterAssetRowCount ?? 0) === 0 && (
        <div
          role="status"
          className="rounded-2xl border border-fo-amber/35 bg-fo-amber/10 px-5 py-4 text-sm text-zinc-200 leading-relaxed"
        >
          <div className="font-medium text-fo-amber mb-1">No master assets loaded yet</div>
          <p className="text-zinc-400">
            {canWrite ? (
              <>
                The portfolio register is empty. If you use the operational Excel workbook, run a full import from{' '}
                <Link to="/import" className="text-fo-gold-soft underline">
                  Excel Import
                </Link>
                . Your server may also bootstrap from a configured master file on startup — check with your administrator.
              </>
            ) : (
              <>
                The portfolio register is empty. Ask your family office <strong className="text-zinc-300">lead</strong> or{' '}
                <strong className="text-zinc-300">analyst</strong> to confirm a workbook import, or review{' '}
                <Link to="/snapshots" className="text-fo-gold-soft underline">
                  Snapshots
                </Link>{' '}
                if the book was loaded outside this session. Your server may bootstrap from a configured master file on startup — check with
                your administrator.
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Need orientation? Open <Link to="/help" className="text-fo-gold-soft underline">Help & quick start</Link>.
          </p>
        </div>
      )}

      {data.netWorthFX ? (
        <div className="rounded-2xl border border-fo-border bg-gradient-to-br from-fo-graphite/90 to-fo-black p-5 md:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Family position (book)</div>
              <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
                Each line uses its <strong className="text-zinc-300">Currency</strong> column (GBP, USD, EUR, NGN), converted to NGN book for
                totals. USD / GBP / EUR columns below are indicative FX only.
              </p>
            </div>
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            Rates: 1 USD = {data.netWorthFX.ratesIndicative.ngnPerUsd.toLocaleString()} NGN · 1 GBP ={' '}
            {data.netWorthFX.ratesIndicative.ngnPerGbp.toLocaleString()} NGN · 1 EUR ={' '}
            {data.netWorthFX.ratesIndicative.ngnPerEur.toLocaleString()} NGN
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Net worth (assets − liabilities)</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-3">
                <div className="text-[10px] text-zinc-500">NGN</div>
                <div className="mt-1 font-[family-name:var(--font-display)] text-xl text-white">{formatNgn(data.netWorthFX.netWorth.ngn)}</div>
              </div>
              <div className="rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-3">
                <div className="text-[10px] text-zinc-500">USD</div>
                <div className="mt-1 font-[family-name:var(--font-display)] text-xl text-white">
                  {formatCompactFx(data.netWorthFX.netWorth.usd, 'USD')}
                </div>
              </div>
              <div className="rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-3">
                <div className="text-[10px] text-zinc-500">GBP</div>
                <div className="mt-1 font-[family-name:var(--font-display)] text-xl text-white">
                  {formatCompactFx(data.netWorthFX.netWorth.gbp, 'GBP')}
                </div>
              </div>
              <div className="rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-3">
                <div className="text-[10px] text-zinc-500">EUR</div>
                <div className="mt-1 font-[family-name:var(--font-display)] text-xl text-white">
                  {formatCompactFx(data.netWorthFX.netWorth.eur, 'EUR')}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Gross assets (same book, indicative FX)</div>
            <div className="grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-zinc-500">NGN:</span> {formatCompactNgn(data.netWorthFX.grossAssets.ngn)}
              </div>
              <div>
                <span className="text-zinc-500">USD:</span> {formatCompactFx(data.netWorthFX.grossAssets.usd, 'USD')}
              </div>
              <div>
                <span className="text-zinc-500">GBP:</span> {formatCompactFx(data.netWorthFX.grossAssets.gbp, 'GBP')}
              </div>
              <div>
                <span className="text-zinc-500">EUR:</span> {formatCompactFx(data.netWorthFX.grossAssets.eur, 'EUR')}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-600 leading-relaxed border-t border-fo-border pt-3">{data.netWorthFX.ratesIndicative.disclaimer}</p>
        </div>
      ) : null}

      {data.topHoldingsByValue && data.topHoldingsByValue.length > 0 ? (
        <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold mb-1">Largest investments (by book value)</div>
          <p className="text-xs text-zinc-500 mb-4 max-w-3xl">
            Ranked by NGN-equivalent value after FX conversion. Native currency shown for each line — ensure the master sheet{' '}
            <strong className="text-zinc-400">Currency</strong> column is set to GBP for pound investments.
          </p>
          <TableScroll maxHeight="max-h-[min(60vh,420px)]">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-fo-border">
                <tr>
                  <th className="py-2 pr-3">Investment</th>
                  <th className="py-2 pr-3 hidden sm:table-cell">Category</th>
                  <th className="py-2 pr-3 text-right">Book value</th>
                  <th className="py-2 text-right hidden md:table-cell">NGN equivalent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fo-border/80">
                {data.topHoldingsByValue.map((h) => (
                  <tr key={`${h.kind}-${h.id}`} className="text-zinc-300">
                    <td className="py-2.5 pr-3 text-white max-w-[220px]">
                      <Link to={h.href} className="hover:text-fo-gold-soft underline-offset-2 hover:underline">
                        {h.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 hidden sm:table-cell text-zinc-500">{h.category}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs whitespace-nowrap">
                      {formatMoneyCompact(h.valueNative, h.currency)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-zinc-500 hidden md:table-cell">
                      {formatCompactNgn(h.valueNgn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      ) : null}

      {data.topPropertyByReturn && data.topPropertyByReturn.length > 0 ? (
        <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold mb-1">Top property — implied return</div>
          <p className="text-xs text-zinc-500 mb-4 max-w-3xl">
            From the <strong className="text-zinc-400">Real Estate</strong> sheet: ranked by uplift of current book value over purchase price
            where purchase is recorded; otherwise by book value. Not a forecast — a workbook-based summary.
          </p>
          <TableScroll maxHeight="max-h-[min(60vh,420px)]">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-fo-border">
                <tr>
                  <th className="py-2 pr-3">Property</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3 hidden sm:table-cell">Type</th>
                  <th className="py-2 pr-3 text-right">Book value</th>
                  <th className="py-2 pr-3 text-right hidden md:table-cell">Purchase</th>
                  <th className="py-2 text-right">Implied uplift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fo-border/80">
                {data.topPropertyByReturn.map((p) => (
                  <tr key={p.id} className="text-zinc-300">
                    <td className="py-2.5 pr-3 text-white max-w-[200px]">
                      <button
                        type="button"
                        onClick={() => navigate(`/search?q=${encodeURIComponent(p.name)}`)}
                        className="text-left hover:text-fo-gold-soft underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </button>
                      {p.propertyPurpose ? (
                        <div className="text-[10px] text-zinc-600 font-normal mt-0.5">{p.propertyPurpose}</div>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{p.country}</td>
                    <td className="py-2.5 pr-3 hidden sm:table-cell text-zinc-500">{p.propertyType}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs">
                      {formatMoneyCompact(p.currentValue, p.currency)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs hidden md:table-cell">
                      {p.purchasePrice != null ? formatMoneyCompact(p.purchasePrice, p.currency) : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      {p.impliedReturnPct != null ? (
                        <span className={p.impliedReturnPct >= 0 ? 'text-fo-green' : 'text-fo-amber'}>
                          {p.impliedReturnPct >= 0 ? '+' : ''}
                          {p.impliedReturnPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                      <div className="text-[10px] text-zinc-600">{p.riskLevel}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      ) : null}

      {data.complianceDigest ? (
        <div
          className={`rounded-2xl border p-5 md:p-6 ${
            data.complianceDigest.outstandingCount > 0
              ? 'border-fo-amber/35 bg-fo-amber/5'
              : 'border-fo-border bg-fo-graphite/30'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Compliance attention</div>
              <p className="text-sm text-zinc-400 mt-1">
                Document tracker rows that look open or incomplete (missing / pending / requested).{' '}
                <span className="text-white font-medium tabular-nums">{data.complianceDigest.outstandingCount}</span> outstanding
                {data.complianceDigest.outstandingCount > data.complianceDigest.items.length
                  ? ` · showing longest-waiting ${data.complianceDigest.items.length}`
                  : null}
                .
              </p>
            </div>
            <Link
              to={data.complianceDigest.outstandingCount > 0 ? '/documents?outstanding=1' : '/documents'}
              className="text-sm text-fo-gold-soft hover:underline shrink-0"
            >
              Open compliance →
            </Link>
          </div>
          {data.complianceDigest.items.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {data.complianceDigest.items.map((c) => (
                <li key={c.id} className="border-b border-fo-border/40 pb-3 last:border-0 last:pb-0">
                  <Link
                    to={`/documents?outstanding=1&highlight=${c.id}`}
                    className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm rounded-lg -mx-2 px-2 py-1.5 -my-0.5 transition-colors hover:bg-fo-panel/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/60"
                  >
                    <span className="text-white font-medium group-hover:text-fo-gold-soft">{c.documentCategory}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-300">{c.entityAsset}</span>
                    <span className="text-zinc-600 text-xs uppercase">{c.status}</span>
                    {c.daysOpen != null ? (
                      <span className={`text-xs ml-auto ${c.daysOpen > 30 ? 'text-fo-amber' : 'text-zinc-500'}`}>
                        {c.daysOpen}d since requested
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600 ml-auto">No request date</span>
                    )}
                    {c.dateRequested ? (
                      <span className="w-full text-[11px] text-zinc-600">
                        Requested: {String(c.dateRequested).slice(0, 10)} · Risk: {c.riskLevel}
                      </span>
                    ) : (
                      <span className="w-full text-[11px] text-zinc-600">Risk: {c.riskLevel}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : data.complianceDigest.outstandingCount === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No outstanding items in the document tracker filter — good standing.</p>
          ) : null}
        </div>
      ) : null}

      {data.complianceCalendar &&
      (data.complianceCalendar.overdueCount > 0 || data.complianceCalendar.items.length > 0) ? (
        <section
          className={`rounded-2xl border p-5 md:p-6 ${
            data.complianceCalendar.overdueCount > 0
              ? 'border-fo-red/35 bg-fo-red/5'
              : 'border-fo-border bg-fo-graphite/30'
          }`}
        >
          <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <section>
              <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Compliance calendar</div>
              <p className="text-sm text-zinc-400 mt-1">
                Filings, KYC, and attestations by due date.{' '}
                {data.complianceCalendar.overdueCount > 0 ? (
                  <span className="text-fo-red font-medium tabular-nums">
                    {data.complianceCalendar.overdueCount} overdue
                  </span>
                ) : (
                  <span className="text-zinc-300">None overdue</span>
                )}
                {data.complianceCalendar.dueNext30Count > 0 ? (
                  <>
                    {' '}
                    ·{' '}
                    <span className="text-fo-amber tabular-nums">
                      {data.complianceCalendar.dueNext30Count} due in 30 days
                    </span>
                  </>
                ) : null}
              </p>
            </section>
            <Link
              to={
                data.complianceCalendar.overdueCount > 0
                  ? '/compliance/calendar?view=overdue'
                  : '/compliance/calendar'
              }
              className="text-sm text-fo-gold-soft hover:underline shrink-0"
            >
              Open calendar →
            </Link>
          </section>
          {data.complianceCalendar.items.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {data.complianceCalendar.items.map((c) => (
                <li key={c.id} className="border-b border-fo-border/40 pb-3 last:border-0 last:pb-0">
                  <Link
                    to={`/compliance/calendar?highlight=${c.id}`}
                    className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm rounded-lg -mx-2 px-2 py-1.5 -my-0.5 transition-colors hover:bg-fo-panel/40"
                  >
                    <span className="text-white font-medium group-hover:text-fo-gold-soft">{c.title}</span>
                    <span className="text-zinc-500 text-xs">{c.category}</span>
                    {c.entity ? <span className="text-zinc-400 text-xs">{c.entity}</span> : null}
                    <span
                      className={`text-xs ml-auto tabular-nums ${c.overdue ? 'text-fo-red' : 'text-zinc-500'}`}
                    >
                      {c.dueDate}
                      {c.daysUntil != null
                        ? c.daysUntil < 0
                          ? ` · ${Math.abs(c.daysUntil)}d overdue`
                          : c.daysUntil === 0
                            ? ' · today'
                            : ` · in ${c.daysUntil}d`
                        : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4" aria-labelledby="kpi-heading">
        <SectionLabel
          id="kpi-heading"
          kicker="Pulse"
          title="Key metrics"
          hint="Figures are from the live book in NGN unless noted. Click a value where highlighted to open the related workspace."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
        <Kpi label="Total net worth (NGN)" value={formatCompactNgn(data.totalNetWorth)} hint="Assets − liabilities" />
        <Kpi label="Total assets" value={formatCompactNgn(data.totalAssets)} />
        <Kpi label="Total liabilities" value={formatCompactNgn(data.totalLiabilities)} />
        <Kpi label="Cash position" value={formatCompactNgn(data.cashPosition)} hint={`Liquidity ratio ${formatPct(data.liquidityRatio)}`} to="/treasury" />
        <Kpi label="High-risk exposure (book)" value={formatCompactNgn(data.highRiskExposure)} to="/risk" />
        <Kpi label="Pending decisions" value={String(data.pendingDecisions)} to="/decisions" />
        <Kpi
          label="Outstanding documentation"
          value={String(data.outstandingDocumentation)}
          to={data.outstandingDocumentation > 0 ? '/documents?outstanding=1' : '/documents'}
        />
        <Kpi
          label="Portfolio health score"
          value={`${data.portfolioHealthScore}`}
          hint="Composite of liquidity, concentration, debt, documents"
        />
      </div>
      </section>

      {canViewAudit && auditFeed.length > 0 && (
        <div className="rounded-2xl border border-fo-border bg-fo-graphite/30 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Recent activity</div>
            <Link to="/audit" className="text-xs text-zinc-400 hover:text-fo-gold">
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {auditFeed.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-zinc-400 border-b border-fo-border/50 pb-2 last:border-0"
              >
                <span className="text-zinc-600 whitespace-nowrap">{a.created_at}</span>
                <span className="text-white">{a.actor}</span>
                <span className="font-mono text-fo-gold-soft">{a.action}</span>
                {a.entity_type ? <span className="text-zinc-500">{a.entity_type}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-fo-border bg-gradient-to-r from-fo-graphite/80 to-fo-black px-5 py-4 md:px-6 md:py-5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Period movement</div>
        {mov.basis === 'snapshot_delta' ? (
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-zinc-500 text-xs">Net position Δ</div>
              <div className="text-xl text-white font-[family-name:var(--font-display)]">{formatCompactNgn(mov.netPositionChange)}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Assets Δ</div>
              <div className="text-lg text-zinc-200">{formatCompactNgn(mov.totalAssetsChange)}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Liabilities Δ</div>
              <div className="text-lg text-zinc-200">{formatCompactNgn(mov.totalLiabilitiesChange)}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Cash Δ</div>
              <div className="text-lg text-zinc-200">{formatCompactNgn(mov.cashPositionChange)}</div>
            </div>
            <p className="sm:col-span-2 lg:col-span-4 text-xs text-zinc-500">
              Comparing latest snapshot ({String(mov.currentAsOf).slice(0, 16)}) to prior ({String(mov.priorAsOf).slice(0, 16)}). Capture more
              snapshots under <Link to="/snapshots">Portfolio snapshots</Link>
              {canWrite ? <> or via Excel import.</> : <>.</>}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{mov.message}</p>
        )}
      </div>

      {trendData.length >= 2 && (
        <section className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-4 md:p-6 space-y-4" aria-labelledby="trend-heading">
          <SectionLabel
            id="trend-heading"
            kicker="Momentum"
            title="Net position trend"
            hint="Chronological series from stored portfolio snapshots (up to 24 points). Hover points for exact book values."
          />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} />
                <XAxis dataKey="label" tick={{ fill: CHART_AXIS.tick, fontSize: 9 }} interval="preserveStartEnd" height={36} />
                <YAxis tick={{ fill: CHART_AXIS.tick, fontSize: 10 }} tickFormatter={(v) => formatCompactNgn(v as number)} width={72} />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value) => [formatCompactNgn(Number(value ?? 0)), 'Net position']}
                  labelFormatter={(label) => String(label)}
                />
                <Line type="monotone" dataKey="net" name="Net (NGN)" stroke={CHART_PRIMARY} strokeWidth={2} dot={{ r: 2, fill: CHART_PRIMARY }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="analytics-heading">
        <SectionLabel
          id="analytics-heading"
          kicker="Composition"
          title="Allocation & geography"
          hint="Donut shows category mix; bars show NGN exposure by jurisdiction. Click a segment or bar to open Asset Intelligence with filters applied."
        />
        <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-4 md:p-6">
          <div className="text-sm text-zinc-300 mb-1">Asset allocation</div>
          <div className="text-xs text-zinc-600 mb-3">Click a segment to open the register filtered by category.</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  data={pieData}
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  style={{ cursor: pieData.length ? 'pointer' : 'default' }}
                  onClick={(d: { name?: string }) => {
                    const name = d?.name
                    if (name) navigate(`/assets?category=${encodeURIComponent(String(name))}`)
                  }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value, name) => {
                    const v = Number(value ?? 0)
                    const pct = pieTotal > 0 ? (100 * v) / pieTotal : 0
                    return [`${formatCompactNgn(v)} (${pct.toFixed(1)}% book)`, String(name ?? '')]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-4 md:p-6">
          <div className="text-sm text-zinc-300 mb-1">Country exposure (NGN book)</div>
          <div className="text-xs text-zinc-600 mb-3">Click a bar to drill into assets by jurisdiction bucket.</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCountries} margin={{ left: 8, right: 8, top: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} />
                <XAxis dataKey="name" tick={{ fill: CHART_AXIS.tick, fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={60} />
                <YAxis tick={{ fill: CHART_AXIS.tick, fontSize: 10 }} tickFormatter={(v) => formatCompactNgn(v as number)} />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value) => [formatCompactNgn(Number(value ?? 0)), 'Exposure']}
                  labelFormatter={(label) => String(label)}
                />
                <Bar
                  dataKey="value"
                  fill={CHART_PRIMARY}
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: topCountries.length ? 'pointer' : 'default' }}
                  onClick={(d: { name?: string }) => {
                    const name = d?.name
                    if (name) navigate(`/assets?country=${encodeURIComponent(String(name))}`)
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </section>

      <section className="space-y-4" aria-labelledby="guidance-heading">
        <SectionLabel
          id="guidance-heading"
          kicker="Guidance"
          title="Risk & recommendations"
          hint="Prioritised signals from the current book and rule engine."
        />
        <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-4 md:p-6">
          <div className="text-sm text-zinc-300 mb-3">Risk & control alerts</div>
          <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {(data.riskSignals ?? []).slice(0, 12).map((r) => (
              <li key={r.id} className="flex gap-3 text-sm border-b border-fo-border/60 pb-3 last:border-0">
                <span
                  className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                    r.severity >= 4 ? 'bg-fo-crimson' : r.severity >= 3 ? 'bg-fo-red' : r.severity >= 2 ? 'bg-fo-amber' : 'bg-fo-green'
                  }`}
                />
                <div>
                  <Link
                    to={r.ctaTo}
                    className="text-white hover:text-fo-gold-soft font-medium leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/50 rounded-sm"
                  >
                    {r.title}
                  </Link>
                  <div className="text-xs text-zinc-500">{r.detail}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {r.category} · {r.level}
                    </span>
                    <Link
                      to={`/risk?focus=${encodeURIComponent(r.id)}`}
                      className="text-fo-gold-soft hover:text-fo-gold normal-case tracking-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/50 rounded-sm"
                    >
                      On Risk map
                    </Link>
                  </div>
                </div>
              </li>
            ))}
            {!(data.riskSignals ?? []).length && <li className="text-zinc-500 text-sm">No active risk flags from current data.</li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-4 md:p-6">
          <div className="text-sm text-zinc-300 mb-3">Advisor-style recommendations</div>
          <ul className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {(data.recommendations ?? []).slice(0, 8).map((r) => (
              <li key={r.id} className="text-sm border-b border-fo-border/60 pb-3 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-fo-gold-soft font-medium">{r.headline}</div>
                  <span className="text-[10px] text-zinc-500">{r.priority}</span>
                </div>
                <p className="text-zinc-400 mt-1 leading-relaxed">{r.body}</p>
                <div className="text-[10px] text-zinc-600 mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {r.category} · confidence {Math.round((r.confidence || 0) * 100)}%
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-end">
                    <Link
                      to={`/actions?focus=${encodeURIComponent(r.id)}`}
                      className="text-fo-gold-soft hover:text-fo-gold uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/50 rounded-sm"
                    >
                      On Next actions
                    </Link>
                    {r.ctaTo ? (
                      <Link
                        to={r.ctaTo}
                        className="text-fo-gold-soft hover:text-fo-gold uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/50 rounded-sm"
                      >
                        Open related →
                      </Link>
                    ) : null}
                  </span>
                </div>
              </li>
            ))}
            {!(data.recommendations ?? []).length ? (
              <li className="text-zinc-500 text-sm">No recommendations from the current rule engine.</li>
            ) : null}
          </ul>
        </div>
        </div>
      </section>
    </div>
  )
}
