import { useEffect, useState } from 'react'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'

type Heat = {
  levels: string[]
  cells: { id: string; axisX: string; axisY: string; value: number; level: string }[]
}

export function RiskModule() {
  const { token } = useAuth()
  const [data, setData] = useState<Heat | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Controls"
        title="Risk intelligence"
        description="Heat map derived from workbook rules: concentration, liquidity, valuation ageing, reconciliations, debt maturity, and documentation gaps."
      />

      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}
      {loading ? <LoadingBlock label="Loading risk intelligence…" /> : null}

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
