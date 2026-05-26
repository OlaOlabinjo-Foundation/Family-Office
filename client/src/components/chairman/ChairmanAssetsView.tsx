import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingBlock } from '../ui/LoadingBlock'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import type { ChairmanExecutiveData, ChairmanHolding } from '../../lib/chairmanExecutive'
import { formatCompactNgn, formatPct } from '../../lib/format'
import { setDocumentTitle } from '../../lib/documentTitle'
import { CHART_PALETTE_EXTENDED } from '../../lib/foundationTheme'
import { ChairmanPageChrome } from './ChairmanPageChrome'

const ALLOC_COLORS = [...CHART_PALETTE_EXTENDED]

function exposureBucket(row: ChairmanHolding & { jurisdiction?: string | null }) {
  return (row.jurisdiction || 'Unknown').trim() || 'Unknown'
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

function AssetCard({ row }: { row: ChairmanHolding & { jurisdiction?: string | null } }) {
  return (
    <article className="chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-fo-harvest">{row.category}</p>
          <h3 className="mt-1 font-medium text-white line-clamp-2">{row.name}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{row.register || 'Portfolio'}</p>
        </div>
        <p className="shrink-0 font-[family-name:var(--font-display)] text-lg text-fo-gold text-right">
          {formatCompactNgn(row.valueNgn)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded-full border border-fo-border px-2 py-0.5 text-zinc-400">{exposureBucket(row)}</span>
      </div>
    </article>
  )
}

export function ChairmanAssetsView() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [summary, setSummary] = useState<ChairmanExecutiveData | null>(null)
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
        const s = await apiFetch<ChairmanExecutiveData>('/api/dashboard/summary', { token })
        if (!c) setSummary(s)
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

  const rows = useMemo(() => {
    const list = summary?.portfolioAssets?.length
      ? summary.portfolioAssets
      : summary?.topHoldingsByValue || []
    return list as (ChairmanHolding & { jurisdiction?: string | null })[]
  }, [summary])

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
      if (categoryQ && r.category !== categoryQ) return false
      if (countryQ && exposureBucket(r) !== countryQ) return false
      return true
    })
  }, [rows, categoryQ, countryQ])

  const topAssets = useMemo(
    () => [...filteredRows].sort((a, b) => b.valueNgn - a.valueNgn).slice(0, 18),
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
      <ChairmanPageChrome title="Assets" subtitle="Full portfolio across all registers">
        <LoadingBlock label="Loading assets…" />
      </ChairmanPageChrome>
    )
  }

  return (
    <ChairmanPageChrome
      title="Assets"
      subtitle="Principal portfolio — master register, real estate, securities, private investments, and cash (real estate is one asset class)"
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
            <MetricCard label="Gross assets (master)" value={formatCompactNgn(summary.totalAssets)} />
            <MetricCard label="Liquidity ratio" value={formatPct(summary.liquidityRatio)} />
            <MetricCard
              label="Portfolio lines"
              value={String(filteredRows.length)}
              hint={filteredRows.length !== rows.length ? `of ${rows.length} across registers` : 'All registers'}
            />
            <MetricCard label="Asset classes" value={String(allocation.length)} hint="Including real estate, cash, listed, private" />
          </section>

          {allocTotal > 0 ? (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-500">Allocation by asset class</h2>
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
                className="text-xs uppercase tracking-wider text-fo-gold-soft hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          <section>
            <h2 className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">
              {categoryQ || countryQ ? 'Matching assets' : 'Largest positions'}
            </h2>
            {topAssets.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {topAssets.map((row) => (
                  <AssetCard key={`${row.kind}-${row.id}`} row={row} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-fo-border bg-fo-panel/30 p-6 text-sm text-zinc-500">
                No assets match this filter. Clear filters or import additional registers (securities, cash, private
                investments).
              </p>
            )}
          </section>
        </>
      ) : null}
    </ChairmanPageChrome>
  )
}
