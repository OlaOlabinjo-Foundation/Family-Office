import { Link } from 'react-router-dom'
import {
  attentionCount,
  chairmanInsightHref,
  formatNetChange,
  formatUsdIndicative,
  healthToRiskLabel,
  portfolioStatusLine,
  type ChairmanExecutiveData,
} from '../../lib/chairmanExecutive'
import { formatCompactNgn, formatPct } from '../../lib/format'
import {
  ChairmanIconBell,
  ChairmanIconCompliance,
  ChairmanIconHelp,
  ChairmanIconReports,
  ChairmanIconTreasury,
} from './ChairmanIcons'
import { CHART_PALETTE } from '../../lib/foundationTheme'
import { ChairmanInvestmentAnalytics } from './ChairmanInvestmentAnalytics'
import { ChairmanSpotlightCard } from './ChairmanSpotlightCard'

const ALLOC_COLORS = [...CHART_PALETTE]

function countryFlag(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('nigeria') || n === 'ng') return '🇳🇬'
  if (n.includes('south africa') || n === 'za') return '🇿🇦'
  if (n.includes('united kingdom') || n.includes('uk') || n === 'gb') return '🇬🇧'
  if (n.includes('united states') || n.includes('usa') || n === 'us') return '🇺🇸'
  if (n.includes('euro') || n.includes('eu')) return '🇪🇺'
  return '🌍'
}

function AllocationDonut({ allocation }: { allocation: { name: string; value: number }[] }) {
  const total = allocation.reduce((s, a) => s + a.value, 0)
  if (total <= 0) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-full border border-fo-border bg-fo-panel/50 text-xs text-zinc-500">
        No data
      </div>
    )
  }
  let acc = 0
  const stops = allocation.slice(0, 6).map((a, i) => {
    const pct = (a.value / total) * 100
    const start = acc
    acc += pct
    return `${ALLOC_COLORS[i % ALLOC_COLORS.length]} ${start}% ${acc}%`
  })
  return (
    <div
      className="h-28 w-28 shrink-0 rounded-full border border-fo-border/60 shadow-inner"
      style={{ background: `conic-gradient(${stops.join(', ')})` }}
      role="img"
      aria-label="Asset allocation chart"
    />
  )
}

type Props = {
  data: ChairmanExecutiveData
  onDownloadPdf?: () => void
  pdfBusy?: boolean
}

export function ChairmanExecutiveView({ data, onDownloadPdf, pdfBusy }: Props) {
  const spotlights = data.chairmanSpotlights
  const cards = [spotlights?.property, spotlights?.privateEquity, spotlights?.liquidAccount].filter(Boolean)
  const netChange = formatNetChange(data)
  const attention = attentionCount(data)
  const nw = data.netWorthFX?.netWorth
  const usdRate = nw?.usd && nw.usd > 0 && nw.ngn ? nw.ngn / nw.usd : undefined
  const allocation = [...(data.allocation || [])].filter((a) => a.value > 0).sort((a, b) => b.value - a.value)
  const countries = [...(data.countryExposure || [])].filter((c) => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 5)
  const insights = (data.recommendations || []).slice(0, 4)
  const allocTotal = allocation.reduce((s, a) => s + a.value, 0)

  return (
    <div className="chairman-executive-shell chairman-executive w-full min-w-0">
      <header className="chairman-topbar sticky top-0 z-30 border-b border-fo-border/80 bg-fo-black/90 backdrop-blur-md no-print">
        <div className="flex flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-display)] text-lg text-fo-gold sm:text-xl">{data.brand}</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Family Office · Principal view</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Net position</p>
              <p className="font-[family-name:var(--font-display)] text-xl text-white sm:text-2xl">
                {formatUsdIndicative(data.netPosition, usdRate)}
              </p>
              <p className="text-[10px] text-zinc-600">{formatCompactNgn(data.netPosition)}</p>
            </div>
            {netChange ? (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Since last snapshot</p>
                <p className={`text-lg font-medium ${netChange.positive ? 'text-fo-green' : 'text-fo-red'}`}>{netChange.text}</p>
              </div>
            ) : null}
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Risk index</p>
              <p className="text-sm font-medium text-fo-gold-soft">{healthToRiskLabel(data.portfolioHealthScore)}</p>
            </div>
            {attention > 0 ? (
              <Link
                to="/documents?outstanding=1"
                className="relative col-span-1 flex h-10 w-10 items-center justify-center rounded-full border border-fo-border bg-fo-panel text-fo-gold-soft sm:col-auto"
                aria-label={`${attention} items need attention`}
              >
                <ChairmanIconBell />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fo-red px-1 text-[10px] font-bold text-white">
                  {attention > 9 ? '9+' : attention}
                </span>
              </Link>
            ) : null}
            {onDownloadPdf ? (
              <button
                type="button"
                disabled={pdfBusy}
                onClick={onDownloadPdf}
                className="col-span-2 rounded-lg bg-fo-gold px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-fo-black hover:bg-fo-gold/90 disabled:opacity-50 sm:col-auto"
              >
                {pdfBusy ? 'PDF…' : 'Board pack PDF'}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Hero band */}
      <section className="chairman-hero relative overflow-hidden border-b border-fo-border/60 px-4 py-8 sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(200,135,36,0.12), transparent), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3E%3Cg fill=\'%23C8871A\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M0 0h30v30H0zm30 30h30v30H30z\'/%3E%3C/g%3E%3C/svg%3E")',
          }}
          aria-hidden
        />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-white sm:text-3xl">Portfolio overview</h1>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Total assets </span>
                <span className="text-white font-medium">{formatCompactNgn(data.totalAssets)}</span>
              </div>
              <div>
                <span className="text-zinc-500">Liquid </span>
                <span className="text-white font-medium">{formatCompactNgn(data.cashPosition)}</span>
              </div>
              <div>
                <span className="text-zinc-500">Debt </span>
                <span className="text-white font-medium">{formatCompactNgn(data.totalLiabilities)}</span>
              </div>
              <div>
                <span className="text-zinc-500">Liquidity ratio </span>
                <span className="text-white font-medium">{formatPct(data.liquidityRatio)}</span>
              </div>
            </div>
            {allocTotal > 0 ? (
              <div className="mt-4 flex h-2 max-w-xl overflow-hidden rounded-full bg-fo-panel">
                {allocation.slice(0, 5).map((a, i) => (
                  <div
                    key={a.name}
                    className="h-full min-w-[2px]"
                    style={{
                      width: `${(a.value / allocTotal) * 100}%`,
                      backgroundColor: ALLOC_COLORS[i % ALLOC_COLORS.length],
                    }}
                    title={`${a.name}: ${formatCompactNgn(a.value)}`}
                  />
                ))}
              </div>
            ) : null}
            <p className="mt-4 max-w-2xl text-sm text-zinc-400 leading-relaxed">{portfolioStatusLine(data)}</p>
          </div>
          {countries.length > 0 ? (
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
              {countries.map((c) => (
                <span
                  key={c.name}
                  className="inline-flex items-center gap-2 rounded-full border border-fo-border/60 bg-fo-panel/50 px-3 py-1.5 text-xs text-zinc-300"
                >
                  <span aria-hidden>{countryFlag(c.name)}</span>
                  {c.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <ChairmanInvestmentAnalytics data={data} />

        {/* Spotlight cards */}
        <section>
          <h2 className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">Book highlights</h2>
          {cards.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((c) => (
                <ChairmanSpotlightCard key={`${c!.kind}-${c!.id}`} item={c!} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-fo-border bg-fo-panel/30 p-6 text-sm text-zinc-500">
              Import the family workbook or add register rows to see property, investment, and liquidity highlights here.
            </p>
          )}
        </section>

        {/* Insights row */}
        <section className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/50 p-5 md:p-6">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-white">Insights</h2>
            <p className="mt-1 text-xs text-zinc-500">Generated from the live book — for awareness, not investment advice.</p>
            <ul className="mt-5 space-y-4">
              {insights.length > 0 ? (
                insights.map((r) => (
                  <li key={r.headline} className="flex gap-3 border-b border-fo-border/40 pb-4 last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-100">
                        <span className="text-fo-gold-soft">[{r.priority}]</span> {r.headline}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{r.body}</p>
                    </div>
                    <Link
                      to={chairmanInsightHref(r.headline, r.body)}
                      className="shrink-0 self-start rounded-md border border-fo-border px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400 hover:border-fo-gold/50 hover:text-fo-gold-soft"
                    >
                      Open
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-sm text-zinc-500">No open recommendations on the current book.</li>
              )}
            </ul>
          </div>
          <div className="chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/50 p-5 flex flex-col items-center">
            <h3 className="text-xs uppercase tracking-widest text-zinc-500 w-full text-left">Allocation by asset class</h3>
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row lg:flex-col lg:items-center">
              <AllocationDonut allocation={allocation} />
              <ul className="w-full space-y-2 text-xs">
                {allocation.slice(0, 5).map((a, i) => (
                  <li key={a.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-zinc-400 truncate">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
                      />
                      {a.name}
                    </span>
                    <span className="text-zinc-200 shrink-0">{formatCompactNgn(a.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="no-print">
          <h2 className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link
              to="/reports"
              className="chairman-action flex flex-col items-center gap-2 rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-5 text-center text-fo-gold-soft hover:border-fo-gold/50"
            >
              <ChairmanIconReports />
              <span className="text-xs uppercase tracking-wider text-zinc-300">Reports</span>
            </Link>
            <Link
              to="/treasury"
              className="chairman-action flex flex-col items-center gap-2 rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-5 text-center text-fo-gold-soft hover:border-fo-gold/50"
            >
              <ChairmanIconTreasury />
              <span className="text-xs uppercase tracking-wider text-zinc-300">Treasury</span>
            </Link>
            <Link
              to="/documents?outstanding=1"
              className="chairman-action flex flex-col items-center gap-2 rounded-xl border border-fo-border bg-fo-panel/40 px-4 py-5 text-center text-fo-gold-soft hover:border-fo-gold/50"
            >
              <ChairmanIconCompliance />
              <span className="text-xs uppercase tracking-wider text-zinc-300">Compliance</span>
            </Link>
            <Link
              to="/help"
              className="chairman-action flex flex-col items-center gap-2 rounded-xl border border-fo-gold/30 bg-fo-gold/10 px-4 py-5 text-center text-fo-gold-soft hover:border-fo-gold/50"
            >
              <ChairmanIconHelp />
              <span className="text-xs uppercase tracking-wider text-fo-gold-soft">Contact office</span>
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 sm:hidden">
            {onDownloadPdf ? (
              <button
                type="button"
                disabled={pdfBusy}
                onClick={onDownloadPdf}
                className="rounded-lg border border-fo-gold/40 px-4 py-2 text-xs text-fo-gold-soft"
              >
                Download PDF
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-fo-border px-4 py-2 text-xs text-zinc-400"
            >
              Print overview
            </button>
          </div>
        </section>

        <footer className="text-[11px] text-zinc-600 border-t border-fo-border/40 pt-6 pb-8">
          Read-only principal view · figures in NGN unless noted · indicative USD uses configured FX rates ·{' '}
          {data.asOf ? `As of ${String(data.asOf).replace('T', ' ').slice(0, 19)} UTC` : 'Live book'}
        </footer>
      </div>
    </div>
  )
}
