import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingBlock } from '../ui/LoadingBlock'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import { formatCompactNgn, formatPct } from '../../lib/format'
import { setDocumentTitle } from '../../lib/documentTitle'
import { ChairmanPageChrome } from './ChairmanPageChrome'

const ALLOC_COLORS = ['#d4af37', '#5b8def', '#c45c26', '#3d9970', '#9b59b6', '#7f8c8d']

type MasterRow = {
  id: number
  asset_id: string
  asset_name: string
  asset_category: string
  jurisdiction: string
  net_value: number | null
  current_value: number | null
  liquidity: string
  risk_level: string
  country?: string | null
}

type Summary = {
  allocation: { name: string; value: number }[]
  countryExposure: { name: string; value: number }[]
  totalAssets: number
  liquidityRatio: number
}

function exposureBucket(r: MasterRow) {
  return (r.jurisdiction || r.country || 'Unknown').trim() || 'Unknown'
}

function assetValue(r: MasterRow) {
  return r.net_value ?? r.current_value ?? 0
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/50 p-4">
      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-600">{hint}</p> : null}
    </article>
  )
}

function AssetCard({ row }: { row: MasterRow }) {
  const value = assetValue(row)
  return (
    <article className="chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{row.asset_category || 'Asset'}</p>
          <h3 className="mt-1 font-medium text-white line-clamp-2">{row.asset_name || row.asset_id}</h3>
          <p className="mt-0.5 text-xs text-zinc-500 font-mono">{row.asset_id}</p>
        </div>
        <p className="shrink-0 font-[family-name:var(--font-display)] text-lg text-fo-gold-soft">
          {formatCompactNgn(value)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded-full border border-fo-border px-2 py-0.5 text-zinc-400">{exposureBucket(row)}</span>
        {row.liquidity ? (
          <span className="rounded-full border border-fo-border px-2 py-0.5 text-zinc-400">Liq {row.liquidity}</span>
        ) : null}
        {row.risk_level ? (
          <span className="rounded-full border border-fo-border/60 px-2 py-0.5 text-zinc-500">Risk {row.risk_level}</span>
        ) : null}
      </div>
    </article>
  )
}

export function ChairmanAssetsView() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [rows, setRows] = useState<MasterRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDocumentTitle('Assets')
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const [s, m] = await Promise.all([
          apiFetch<Summary>('/api/dashboard/summary', { token }),
          apiFetch<{ items: MasterRow[] }>('/api/data/master_assets', { token }),
        ])
        if (!c) {
          setSummary(s)
          setRows(m.items)
        }
      } catch (e) {
        if (!c) setErr((e as Error).message)
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [token])

  const categoryQ = searchParams.get('category')?.trim() ?? ''
  const countryQ = searchParams.get('country')?.trim() ?? ''

  const allocation = useMemo(
    () => [...(summary?.allocation || [])].filter((a) => a.value > 0).sort((a, b) => b.value - a.value),
    [summary]
  )
  const countries = useMemo(
    () => [...(summary?.countryExposure || [])].filter((c) => c.value > 0).sort((a, b) => b.value - a.value),
    [summary]
  )
  const allocTotal = allocation.reduce((s, a) => s + a.value, 0)

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (categoryQ && (r.asset_category || '') !== categoryQ) return false
      if (countryQ && exposureBucket(r) !== countryQ) return false
      return true
    })
  }, [rows, categoryQ, countryQ])

  const topAssets = useMemo(
    () => [...filteredRows].sort((a, b) => assetValue(b) - assetValue(a)).slice(0, 18),
    [filteredRows]
  )

  function setFilter(key: 'category' | 'country', value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  if (loading) {
    return (
      <ChairmanPageChrome title="Assets" subtitle="Master register and concentration">
        <LoadingBlock label="Loading assets…" />
      </ChairmanPageChrome>
    )
  }

  return (
    <ChairmanPageChrome
      title="Assets"
      subtitle="Book positions from the master register — category, jurisdiction, and risk at a glance"
      actions={
        <Link
          to="/reports"
          className="rounded-lg border border-fo-gold/40 px-3 py-2 text-[10px] uppercase tracking-wider text-fo-gold-soft hover:bg-fo-gold/10"
        >
          Reports
        </Link>
      }
    >
      {err ? (
        <p role="alert" className="text-sm text-fo-red">
          {err}
        </p>
      ) : null}

      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Gross assets" value={formatCompactNgn(summary.totalAssets)} />
            <MetricCard label="Liquidity ratio" value={formatPct(summary.liquidityRatio)} />
            <MetricCard
              label="Register lines"
              value={String(filteredRows.length)}
              hint={filteredRows.length !== rows.length ? `of ${rows.length} total` : undefined}
            />
            <MetricCard
              label="Categories"
              value={String(allocation.length)}
              hint="Active allocation buckets"
            />
          </section>

          {allocTotal > 0 ? (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-500">Allocation</h2>
              <div className="flex h-2 max-w-2xl overflow-hidden rounded-full bg-fo-panel">
                {allocation.slice(0, 6).map((a, i) => (
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
              <div className="mt-3 flex flex-wrap gap-2">
                {allocation.slice(0, 8).map((a, i) => (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => setFilter('category', categoryQ === a.name ? '' : a.name)}
                    className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                      categoryQ === a.name
                        ? 'border-fo-gold/60 bg-fo-gold/15 text-fo-gold-soft'
                        : 'border-fo-border/60 text-zinc-400 hover:border-fo-gold/40'
                    }`}
                  >
                    <span
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
                      aria-hidden
                    />
                    {a.name} · {formatCompactNgn(a.value)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {countries.length > 0 ? (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-500">Jurisdiction</h2>
              <div className="flex flex-wrap gap-2">
                {countries.slice(0, 10).map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setFilter('country', countryQ === c.name ? '' : c.name)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      countryQ === c.name
                        ? 'border-fo-gold/60 bg-fo-gold/15 text-fo-gold-soft'
                        : 'border-fo-border/60 text-zinc-300 hover:border-fo-gold/40'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {(categoryQ || countryQ) && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-fo-gold/30 bg-fo-gold/5 px-4 py-3 text-sm text-zinc-300">
              <span>
                Filtered view
                {categoryQ ? (
                  <>
                    {' '}
                    · <span className="text-fo-gold-soft">{categoryQ}</span>
                  </>
                ) : null}
                {countryQ ? (
                  <>
                    {' '}
                    · <span className="text-fo-gold-soft">{countryQ}</span>
                  </>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="ml-auto text-[10px] uppercase tracking-wider text-fo-gold-soft hover:text-fo-gold"
              >
                Clear filters
              </button>
            </div>
          )}

          <section>
            <h2 className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">
              Top positions{topAssets.length < filteredRows.length ? ` (top ${topAssets.length})` : ''}
            </h2>
            {topAssets.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {topAssets.map((r) => (
                  <AssetCard key={r.id} row={r} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-fo-border bg-fo-panel/30 p-6 text-sm text-zinc-500">
                No assets match the current filters. Import the workbook or clear filters to see the full register.
              </p>
            )}
          </section>

          <footer className="text-[11px] text-zinc-600 border-t border-fo-border/40 pt-6">
            Principal read-only view · values from master register · use Reports for formal packs and snapshots for
            point-in-time history.
          </footer>
        </>
      ) : null}
    </ChairmanPageChrome>
  )
}
