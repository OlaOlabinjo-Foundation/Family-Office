import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { setDocumentTitle } from '../lib/documentTitle'

type Heat = {
  levels: string[]
  cells: { id: string; axisX: string; axisY: string; value: number; level: string; ctaTo: string }[]
}

export function RiskModule() {
  const { token } = useAuth()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<Heat | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const focusId = useMemo(() => (searchParams.get('focus') || '').trim() || null, [searchParams])

  useEffect(() => {
    setDocumentTitle('Risk intelligence')
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const h = await apiFetch<Heat>('/api/dashboard/risk-heatmap', { token })
        if (!c) setData(h)
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

  useEffect(() => {
    if (!focusId || loading || !data?.cells.length) return
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(focusId) : focusId
    const el = document.querySelector(`[data-risk-cell="${esc}"]`)
    if (!el || !(el instanceof HTMLElement)) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [focusId, loading, data])

  const focusOnPage =
    focusId != null && Boolean(data?.cells.some((c) => c.id === focusId))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Controls"
        title="Risk intelligence"
        description="Heat map derived from workbook rules: concentration, liquidity, valuation ageing, reconciliations, debt maturity, and documentation gaps. Each cell links to the screen where you can review or remediate the signal. Deep-link a cell by adding ?focus= and the heat-map cell id to the URL (same pattern as Decisions and Next actions)."
      />

      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}
      {loading ? <LoadingBlock label="Loading risk intelligence…" /> : null}

      {!loading && !err && focusId != null && data && data.cells.length > 0 && !focusOnPage ? (
        <div role="status" className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-4 py-3 text-sm text-zinc-300">
          No heat cell matches id <span className="font-mono text-fo-gold-soft">{focusId}</span>. The map may have changed after import —{' '}
          <Link to="/risk" className="text-fo-gold-soft hover:underline">
            clear focus from the URL
          </Link>{' '}
          or open the related view from the dashboard risk list.
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-widest text-zinc-400">
            <span className="shrink-0 text-zinc-600">Scale ·</span>
            {['Low', 'Medium', 'High', 'Critical'].map((l) => (
              <span key={l} className="flex items-center gap-2 text-zinc-400">
                <span
                  className={`h-2.5 w-8 rounded ${
                    l === 'Critical'
                      ? 'bg-fo-crimson'
                      : l === 'High'
                        ? 'bg-fo-red'
                        : l === 'Medium'
                          ? 'bg-fo-amber'
                          : 'bg-fo-green'
                  }`}
                  aria-hidden
                />
                {l}
              </span>
            ))}
          </div>

          <div
            role="region"
            aria-label="Risk heat map cells"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {data.cells.map((cell) => (
              <div
                key={cell.id}
                data-risk-cell={cell.id}
                role="group"
                tabIndex={0}
                aria-label={`${cell.axisY}. ${cell.axisX}. Severity index ${cell.value}. Level ${cell.level}.`}
                className={`rounded-xl border border-fo-border p-4 outline-none focus-visible:ring-2 focus-visible:ring-fo-gold ${
                  cell.level === 'Critical'
                    ? 'bg-fo-crimson/20'
                    : cell.level === 'High'
                      ? 'bg-fo-red/15'
                      : cell.level === 'Medium'
                        ? 'bg-fo-amber/10'
                        : 'bg-fo-green/10'
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">{cell.axisX}</div>
                <div className="mt-1 text-sm leading-snug text-white">{cell.axisY}</div>
                <div className="mt-2 text-[11px] text-zinc-400">Severity index: {cell.value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">Level: {cell.level}</div>
                <Link
                  to={cell.ctaTo}
                  className="mt-3 inline-flex text-xs font-medium uppercase tracking-wider text-fo-gold-soft hover:text-fo-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/50 rounded-sm"
                >
                  Open related view<span className="ml-1" aria-hidden>→</span>
                </Link>
              </div>
            ))}
          </div>
          {!data.cells.length ? (
            <p className="rounded-lg border border-fo-border bg-fo-graphite/30 px-4 py-4 text-sm text-zinc-500">
              No risk heat cells for the current register — either controls are clean or underlying data is still sparse after import.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
