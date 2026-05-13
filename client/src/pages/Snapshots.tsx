import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadExportCsv } from '../lib/downloadCsv'
import { formatCompactNgn } from '../lib/format'

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

export function Snapshots() {
  const { token, canWrite } = useAuth()
  const { show: notify } = useNotify()
  const [items, setItems] = useState<Snap[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await apiFetch<{ items: Snap[] }>('/api/snapshots', { token })
    setItems(r.items)
  }, [token])

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

  async function capture() {
    if (!canWrite) return
    setBusy(true)
    setMsg(null)
    try {
      await apiFetch('/api/snapshots/capture', { method: 'POST', token })
      setMsg('Snapshot captured. Command centre movement will use the latest pair.')
      notify('Portfolio snapshot saved', 'success')
      await load()
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
        description="Point-in-time totals for net position, assets, liabilities, and health score. The executive dashboard compares the two most recent snapshots for period movement. A snapshot is also taken automatically on each confirmed Excel import."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canWrite || busy}
          onClick={capture}
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
            <div className="p-4 text-sm text-zinc-500">No snapshots yet. Import a workbook or capture one manually.</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
