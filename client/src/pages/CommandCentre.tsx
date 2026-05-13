import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
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
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { formatCompactNgn, formatPct } from '../lib/format'

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

type Summary = {
  brand: string
  totalNetWorth: number
  totalAssets: number
  totalLiabilities: number
  netPosition: number
  cashPosition: number
  monthlyPortfolioMovement?: MonthlyMovement | null
  liquidityRatio: number
  highRiskExposure: number
  pendingDecisions: number
  outstandingDocumentation: number
  portfolioHealthScore: number
  allocation: { name: string; value: number }[]
  countryExposure: { name: string; value: number }[]
  riskSignals: { id: string; category: string; title: string; detail: string; severity: number; level: string }[]
  recommendations: { id: string; headline: string; body: string; priority: string; category: string; confidence: number }[]
  snapshotTrend: { at: string; netPosition: number; healthScore: number }[]
}

const PIE_COLORS = ['#D4AF37', '#F5D76E', '#8a7a3a', '#4b5563', '#1f2937', '#0f172a']

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-fo-border bg-gradient-to-br from-fo-graphite to-fo-black p-4 md:p-5">
      <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-2xl md:text-3xl text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
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
  const reduceMotion = useReducedMotion()
  const { token, canViewAudit } = useAuth()
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

  const topCountries = [...(data.countryExposure ?? [])].sort((a, b) => b.value - a.value).slice(0, 8)

  const mov: MonthlyMovement =
    data.monthlyPortfolioMovement ??
    ({
      basis: 'none',
      message: 'No portfolio movement block returned yet. Use Excel import or capture snapshots under Portfolio snapshots.',
    } satisfies MonthlyMovement)
  const trendData = (data.snapshotTrend ?? []).map((p) => ({
    label: String(p.at).replace('T', ' ').slice(0, 16),
    net: p.netPosition,
  }))

  return (
    <div className="space-y-8">
      <motion.div
        initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.35 }}
        className="space-y-2"
      >
        <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl text-white">{data.brand}</h1>
        <p className="text-sm text-zinc-400 max-w-3xl">
          Executive command surface aligned to your operational workbook: Master Asset Register, cash, real estate, liabilities, and
          documentation signals — distilled for principal clarity with analytical depth on demand.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi label="Total net worth (NGN)" value={formatCompactNgn(data.totalNetWorth)} hint="Assets − liabilities" />
        <Kpi label="Total assets" value={formatCompactNgn(data.totalAssets)} />
        <Kpi label="Total liabilities" value={formatCompactNgn(data.totalLiabilities)} />
        <Kpi label="Cash position" value={formatCompactNgn(data.cashPosition)} hint={`Liquidity ratio ${formatPct(data.liquidityRatio)}`} />
        <Kpi label="High-risk exposure (book)" value={formatCompactNgn(data.highRiskExposure)} />
        <Kpi label="Pending decisions" value={String(data.pendingDecisions)} />
        <Kpi label="Outstanding documentation" value={String(data.outstandingDocumentation)} />
        <Kpi
          label="Portfolio health score"
          value={`${data.portfolioHealthScore}`}
          hint="Composite of liquidity, concentration, debt, documents"
        />
      </div>

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
              Comparing latest snapshot ({String(mov.currentAsOf).slice(0, 16)}) to prior ({String(mov.priorAsOf).slice(0, 16)}). Capture
              more snapshots under Portfolio snapshots or via Excel import.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{mov.message}</p>
        )}
      </div>

      {trendData.length >= 2 && (
        <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-4 md:p-6">
          <div className="text-sm text-zinc-300 mb-1">Net position trend</div>
          <div className="text-xs text-zinc-600 mb-4">Chronological series from stored portfolio snapshots (up to 24 points).</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 9 }} interval="preserveStartEnd" height={36} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => formatCompactNgn(v as number)} width={72} />
                <Tooltip />
                <Line type="monotone" dataKey="net" name="Net (NGN)" stroke="#D4AF37" strokeWidth={2} dot={{ r: 2, fill: '#F5D76E' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
                <Tooltip />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={60} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => formatCompactNgn(v as number)} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#D4AF37"
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
                  <div className="text-white">{r.title}</div>
                  <div className="text-xs text-zinc-500">{r.detail}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 mt-1">
                    {r.category} · {r.level}
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
                <div className="text-[10px] text-zinc-600 mt-1">
                  {r.category} · confidence {Math.round((r.confidence || 0) * 100)}%
                </div>
              </li>
            ))}
            {!(data.recommendations ?? []).length ? (
              <li className="text-zinc-500 text-sm">No recommendations from the current rule engine.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  )
}
