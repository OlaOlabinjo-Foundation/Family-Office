import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChairmanExecutiveData } from '../../lib/chairmanExecutive'
import {
  allocationGapChartData,
  propertyReturnChartData,
  topHoldingsChartData,
} from '../../lib/chairmanInvestmentAnalytics'
import { CHART_AXIS, CHART_PALETTE, CHART_PRIMARY, CHART_TOOLTIP, FOUNDATION } from '../../lib/foundationTheme'
import { formatCompactNgn, formatPct } from '../../lib/format'

type Props = { data: ChairmanExecutiveData }

function ChartCard({
  title,
  hint,
  children,
  className = '',
}: {
  title: string
  hint: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/50 p-4 md:p-5 ${className}`}>
      <h3 className="font-[family-name:var(--font-display)] text-base text-fo-linen md:text-lg">{title}</h3>
      <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{hint}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function ChairmanInvestmentAnalytics({ data }: Props) {
  const holdings = topHoldingsChartData(data, 10)
  const properties = propertyReturnChartData(data)
  const gaps = allocationGapChartData(data)
  const hasAny = holdings.length > 0 || properties.length > 0 || gaps.length > 0

  if (!hasAny) {
    return (
      <section className="rounded-2xl border border-dashed border-fo-border/60 bg-fo-panel/20 p-6 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-fo-linen">Investment analytics</h2>
        <p className="mt-2 text-sm text-zinc-500 max-w-lg mx-auto">
          Import the family workbook or add register rows to see your highest-value assets and portfolio charts here.
        </p>
      </section>
    )
  }

  const categoryCount = data.allocation?.filter((a) => a.value > 0).length ?? 0
  const holdingsTotal = holdings.reduce((s, h) => s + h.valueNgn, 0)

  return (
    <section className="space-y-4" aria-labelledby="chairman-investment-analytics">
      <div>
        <h2 id="chairman-investment-analytics" className="text-xs uppercase tracking-[0.35em] text-zinc-500">
          Investment analytics
        </h2>
        <p className="mt-2 text-sm text-zinc-400 max-w-3xl leading-relaxed">
          Highest-value assets on the book (NGN), plus property performance and diversification context. Figures are
          indicative from the live register.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {holdings.length > 0 ? (
          <ChartCard
            title="Highest value assets"
            hint="Largest positions across all registers (master, real estate, securities, private investments, cash) — real estate is one asset class among many."
            className="lg:col-span-2"
          >
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={holdings} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: CHART_AXIS.tick, fontSize: 10 }}
                    tickFormatter={(v) => formatCompactNgn(v as number)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fill: CHART_AXIS.tick, fontSize: 10 }}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP}
                    formatter={(value) => [formatCompactNgn(Number(value ?? 0)), 'Book value (NGN)']}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as (typeof holdings)[0] | undefined
                      return row ? `${row.fullName} · ${row.category} · ${row.register}` : ''
                    }}
                  />
                  <Bar dataKey="valueNgn" radius={[0, 4, 4, 0]} maxBarSize={26}>
                    {holdings.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? CHART_PRIMARY : CHART_PALETTE[(i + 1) % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 space-y-2 border-t border-fo-border/40 pt-4">
              {holdings.slice(0, 5).map((h, i) => (
                <li key={`${h.kind}-${h.id}`} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-fo-harvest font-medium w-4">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-zinc-200 font-medium truncate">{h.fullName}</p>
                      <p className="text-zinc-500">
                        {h.category}
                        <span className="text-zinc-600"> · {h.register}</span>
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-zinc-100 font-medium">{formatCompactNgn(h.valueNgn)}</p>
                    {holdingsTotal > 0 ? (
                      <p className="text-zinc-600">{((h.valueNgn / holdingsTotal) * 100).toFixed(1)}% of top {holdings.length}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <Link
              to="/assets"
              className="mt-4 inline-block text-[10px] uppercase tracking-wider text-fo-gold-soft hover:text-fo-harvest"
            >
              Full asset register →
            </Link>
          </ChartCard>
        ) : null}

        {properties.length > 0 ? (
          <ChartCard title="Real estate performance" hint="One asset class — implied return since purchase (real estate register only).">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={properties} margin={{ left: 4, right: 12, top: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: CHART_AXIS.tick, fontSize: 9 }}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis tick={{ fill: CHART_AXIS.tick, fontSize: 10 }} unit="%" width={40} />
                  <Tooltip
                    {...CHART_TOOLTIP}
                    formatter={(value, _name, item) => {
                      const row = item?.payload as (typeof properties)[0]
                      return [`${Number(value).toFixed(1)}%`, row ? formatCompactNgn(row.currentValueNgn) : 'Return']
                    }}
                  />
                  <Bar dataKey="impliedReturnPct" fill={FOUNDATION.grove} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}

        {gaps.length > 0 ? (
          <ChartCard title="Diversification gaps" hint="Categories below an equal-weight mix — room to add exposure.">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gaps} margin={{ left: 4, right: 12, top: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: CHART_AXIS.tick, fontSize: 9 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={44}
                  />
                  <YAxis tick={{ fill: CHART_AXIS.tick, fontSize: 10 }} unit="%" width={44} />
                  <Tooltip
                    {...CHART_TOOLTIP}
                    formatter={(value, name) => {
                      const pct = `${Number(value).toFixed(1)}%`
                      if (name === 'Gap') return [pct, 'Gap to balanced mix']
                      return [pct, 'Current weight']
                    }}
                  />
                  <Bar dataKey="currentPct" name="Current" fill="rgba(59, 94, 69, 0.55)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="gapPct" name="Gap" fill={FOUNDATION.clay} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">
              Target mix assumes equal weight across {categoryCount} categories.
            </p>
          </ChartCard>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-zinc-500 border border-fo-border/40 rounded-xl px-4 py-3 bg-fo-panel/30">
        <span>
          <span className="text-fo-harvest font-medium">Liquidity</span> {formatPct(data.liquidityRatio)}
        </span>
        <span>
          <span className="text-fo-grove font-medium">Cash</span> {formatCompactNgn(data.cashPosition)}
        </span>
        <span>
          <span className="text-fo-clay font-medium">Health</span> {data.portfolioHealthScore}/100
        </span>
      </div>
    </section>
  )
}
