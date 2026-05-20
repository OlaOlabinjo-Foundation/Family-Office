import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadExportCsv } from '../lib/downloadCsv'
import { formatCompactNgn, formatNgn } from '../lib/format'
import { setDocumentTitle } from '../lib/documentTitle'

type Snap = {
  id: number
  created_at: string
  total_assets: number
  total_liabilities: number
  net_position: number
  cash_position: number
  liquidity_ratio: number
  health_score: number
}

type SnapPoint = {
  id: number
  createdAt: string
  totalAssets: number
  totalLiabilities: number
  netPosition: number
  cashPosition: number
  liquidityRatio: number
  healthScore: number
}

type ComparePayload = {
  ok: true
  prior: SnapPoint
  current: SnapPoint
  delta: {
    netPosition: number
    totalAssets: number
    totalLiabilities: number
    cashPosition: number
    liquidityRatio: number
    healthScore: number
  }
}

function DeltaCell({ value, format }: { value: number; format?: 'ngn' | 'pct' | 'score' }) {
  const positive = value > 0
  const negative = value < 0
  const cls = positive ? 'text-emerald-400' : negative ? 'text-fo-red' : 'text-zinc-400'
  let text: string
  if (format === 'pct') text = `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)} pp`
  else if (format === 'score') text = `${value >= 0 ? '+' : ''}${value.toFixed(0)}`
  else text = `${value >= 0 ? '+' : ''}${formatNgn(value)}`
  return <span className={cls}>{text}</span>
}

export function Snapshots() {
  const { token, canWrite } = useAuth()
  const { show: notify } = useNotify()
  const [items, setItems] = useState<Snap[]>([])
  const [priorId, setPriorId] = useState<string>('')
  const [currentId, setCurrentId] = useState<string>('')
  const [compare, setCompare] = useState<ComparePayload | null>(null)
  const [compareErr, setCompareErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [compareBusy, setCompareBusy] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await apiFetch<{ items: Snap[] }>('/api/snapshots', { token })
    setItems(r.items)
    if (r.items.length >= 2) {
      setPriorId((prev) => prev || String(r.items[1].id))
      setCurrentId((prev) => prev || String(r.items[0].id))
    }
  }, [token])

  const loadCompare = useCallback(async () => {
    setCompareBusy(true)
    setCompareErr(null)
    try {
      const qs = new URLSearchParams()
      if (priorId && currentId) {
        qs.set('prior', priorId)
        qs.set('current', currentId)
      }
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      const r = await apiFetch<ComparePayload>(`/api/snapshots/compare${suffix}`, { token })
      setCompare(r)
    } catch (e) {
      setCompare(null)
      setCompareErr((e as Error).message)
    } finally {
      setCompareBusy(false)
    }
  }, [token, priorId, currentId])

  useEffect(() => {
    setDocumentTitle('Snapshots')
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setMsg(null)
      try {
        await load()
      } catch (e) {
        if (!c) setMsg((e as Error).message)
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [load])

  useEffect(() => {
    if (loading || items.length < 2) return
    void loadCompare()
  }, [loading, items.length, priorId, currentId, loadCompare])

  const priorOptions = useMemo(() => [...items].sort((a, b) => a.id - b.id), [items])
  const currentOptions = useMemo(() => [...items].sort((a, b) => b.id - a.id), [items])

  async function capture() {
    if (!canWrite) return
    setBusy(true)
    setMsg(null)
    try {
      await apiFetch('/api/snapshots/capture', { method: 'POST', token })
      setMsg('Snapshot captured.')
      notify('Portfolio snapshot saved', 'success')
      await load()
      await loadCompare()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="Portfolio snapshots"
        description="Point-in-time totals for net position, assets, liabilities, and health score. Compare any two captures below; the Command Centre uses the latest pair for movement."
        actions={
          <Link
            to="/"
            className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
          >
            Command centre
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canWrite || busy}
          onClick={() => void capture()}
          className="rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black disabled:cursor-not-allowed disabled:opacity-40 focus-ring-inset"
        >
          {busy ? 'Saving…' : 'Capture snapshot now'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setExportErr(null)
            try {
              await downloadExportCsv(token, 'portfolio_snapshots', {
                onSuccess: () => notify('Snapshot history exported as CSV', 'success'),
              })
            } catch (e) {
              setExportErr((e as Error).message)
            }
          }}
          className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold disabled:opacity-40 focus-ring-inset"
        >
          Export CSV
        </button>
        {!canWrite && <span className="text-xs text-fo-amber">Read-only: sign in as lead or analyst to capture.</span>}
        {msg && <span className="text-sm text-zinc-300">{msg}</span>}
        {exportErr && (
          <span role="alert" className="text-sm text-fo-red">
            {exportErr}
          </span>
        )}
      </div>

      {items.length >= 2 ? (
        <section className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 space-y-4">
          <h2 className="font-display text-lg text-white">Compare snapshots</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs text-zinc-500">
              Earlier (prior)
              <select
                value={priorId}
                onChange={(e) => setPriorId(e.target.value)}
                className="mt-1 w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm text-white"
              >
                {priorOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} · {String(s.created_at).replace('T', ' ').slice(0, 16)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-500">
              Later (current)
              <select
                value={currentId}
                onChange={(e) => setCurrentId(e.target.value)}
                className="mt-1 w-full rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-sm text-white"
              >
                {currentOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} · {String(s.created_at).replace('T', ' ').slice(0, 16)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end sm:col-span-2">
              <button
                type="button"
                disabled={compareBusy || !priorId || !currentId}
                onClick={() => void loadCompare()}
                className="rounded-md border border-fo-gold/40 bg-fo-gold/10 px-4 py-2 text-xs uppercase tracking-wider text-fo-gold-soft hover:bg-fo-gold/20 disabled:opacity-40"
              >
                {compareBusy ? 'Comparing…' : 'Refresh comparison'}
              </button>
            </div>
          </div>

          {compareErr ? (
            <p role="alert" className="text-sm text-fo-red">
              {compareErr}
            </p>
          ) : null}

          {compare && !compareBusy ? (
            <div className="overflow-x-auto rounded-xl border border-fo-border">
              <table className="min-w-full text-sm">
                <thead className="bg-fo-panel text-left text-[10px] uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Metric</th>
                    <th className="px-3 py-2 text-right">Prior</th>
                    <th className="px-3 py-2 text-right">Current</th>
                    <th className="px-3 py-2 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Net position', key: 'netPosition' as const, fmt: 'ngn' as const },
                    { label: 'Total assets', key: 'totalAssets' as const, fmt: 'ngn' as const },
                    { label: 'Total liabilities', key: 'totalLiabilities' as const, fmt: 'ngn' as const },
                    { label: 'Cash position', key: 'cashPosition' as const, fmt: 'ngn' as const },
                    { label: 'Liquidity ratio', key: 'liquidityRatio' as const, fmt: 'pct' as const },
                    { label: 'Health score', key: 'healthScore' as const, fmt: 'score' as const },
                  ].map((row) => (
                    <tr key={row.key} className="border-t border-fo-border">
                      <td className="px-3 py-2 text-zinc-300">{row.label}</td>
                      <td className="px-3 py-2 text-right text-zinc-400">
                        {row.fmt === 'pct'
                          ? `${(compare.prior[row.key] * 100).toFixed(1)}%`
                          : row.fmt === 'score'
                            ? compare.prior[row.key]
                            : formatCompactNgn(compare.prior[row.key])}
                      </td>
                      <td className="px-3 py-2 text-right text-fo-gold-soft">
                        {row.fmt === 'pct'
                          ? `${(compare.current[row.key] * 100).toFixed(1)}%`
                          : row.fmt === 'score'
                            ? compare.current[row.key]
                            : formatCompactNgn(compare.current[row.key])}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <DeltaCell value={compare.delta[row.key]} format={row.fmt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : compareBusy ? (
            <p className="text-sm text-zinc-500">Loading comparison…</p>
          ) : null}
        </section>
      ) : items.length === 1 ? (
        <p className="text-sm text-zinc-500">Capture one more snapshot to enable period-on-period comparison.</p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-fo-border px-4 py-12 text-center text-sm text-zinc-500">Loading snapshots…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-fo-border">
          <table className="min-w-full text-xs md:text-sm">
            <thead className="bg-fo-panel text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2" scope="col">
                  #
                </th>
                <th className="px-3 py-2" scope="col">
                  Captured
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Net position
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Assets
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Liabilities
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Cash
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Liq. ratio
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Health
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-fo-border hover:bg-fo-panel/40">
                  <td className="px-3 py-2 text-zinc-500">{s.id}</td>
                  <td className="whitespace-nowrap px-3 py-2">{s.created_at}</td>
                  <td className="px-3 py-2 text-right text-fo-gold-soft">{formatCompactNgn(s.net_position)}</td>
                  <td className="px-3 py-2 text-right">{formatCompactNgn(s.total_assets)}</td>
                  <td className="px-3 py-2 text-right">{formatCompactNgn(s.total_liabilities)}</td>
                  <td className="px-3 py-2 text-right">{formatCompactNgn(s.cash_position)}</td>
                  <td className="px-3 py-2 text-right">
                    {s.liquidity_ratio != null ? `${(Number(s.liquidity_ratio) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{s.health_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? (
            <div className="p-4 text-sm text-zinc-500">
              No snapshots yet. Import a workbook or capture one manually.
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

