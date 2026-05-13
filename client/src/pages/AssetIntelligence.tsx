import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { formatCompactNgn } from '../lib/format'

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
}

type Summary = {
  allocation: { name: string; value: number }[]
  countryExposure: { name: string; value: number }[]
  totalAssets: number
  liquidityRatio: number
}

function exposureBucket(r: MasterRow & { country?: string | null }) {
  return (r.jurisdiction || r.country || 'Unknown').trim() || 'Unknown'
}

export function AssetIntelligence() {
  const { token } = useAuth()
  const [searchParams] = useSearchParams()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [rows, setRows] = useState<MasterRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const ext = r as MasterRow & { country?: string | null }
      if (categoryQ && (r.asset_category || '') !== categoryQ) return false
      if (countryQ && exposureBucket(ext) !== countryQ) return false
      return true
    })
  }, [rows, categoryQ, countryQ])

  const treemapData = filteredRows
    .filter((r) => (r.net_value || r.current_value || 0) > 0)
    .slice(0, 40)
    .map((r) => ({
      name: (r.asset_name || r.asset_id).slice(0, 28),
      size: r.net_value ?? r.current_value ?? 0,
    }))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Analytics"
        title="Asset intelligence engine"
        description="Centralised view of the Master Asset Register with concentration, liquidity, and jurisdiction lenses — mirroring Portfolio Analytics logic from the workbook."
      />

      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}
      {loading ? <LoadingBlock label="Loading asset intelligence…" /> : null}

      {!loading && summary ? (
        <>
        <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-fo-border p-4 bg-fo-graphite/40">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Gross assets (book)</div>
          <div className="text-2xl text-fo-gold-soft mt-1">{formatCompactNgn(summary.totalAssets)}</div>
        </div>
        <div className="rounded-xl border border-fo-border p-4 bg-fo-graphite/40">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Liquidity ratio</div>
          <div className="text-2xl text-white mt-1">{(summary.liquidityRatio * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border border-fo-border p-4 bg-fo-graphite/40">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Lines in register</div>
          <div className="text-2xl text-white mt-1">{filteredRows.length}</div>
          {filteredRows.length !== rows.length ? (
            <div className="text-[10px] text-zinc-500 mt-1">of {rows.length} total (filtered)</div>
          ) : null}
        </div>
        </div>

      {(categoryQ || countryQ) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-fo-gold/30 bg-fo-graphite/50 px-4 py-3 text-sm">
          <span className="text-zinc-300">
            Showing filtered view
            {categoryQ ? (
              <>
                {' '}
                · category <span className="text-fo-gold-soft font-medium">{categoryQ}</span>
              </>
            ) : null}
            {countryQ ? (
              <>
                {' '}
                · jurisdiction <span className="text-fo-gold-soft font-medium">{countryQ}</span>
              </>
            ) : null}
          </span>
          <Link to="/assets" className="ml-auto text-xs uppercase tracking-wider text-fo-gold hover:text-fo-gold-soft">
            Clear filters
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-fo-border bg-fo-graphite/30 p-4 md:p-6">
        <div className="text-sm text-zinc-300 mb-4">Top positions (treemap by net / current value)</div>
        <div className="h-80">
          {treemapData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={treemapData} dataKey="size" aspectRatio={4 / 3} stroke="#050505" fill="#D4AF37">
                <Tooltip />
              </Treemap>
            </ResponsiveContainer>
          ) : (
            <div className="text-zinc-500 text-sm">No positive values to chart yet.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-fo-border overflow-hidden">
        <div className="px-4 py-3 border-b border-fo-border text-sm text-zinc-300">Master Asset Register (live)</div>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="min-w-full text-xs md:text-sm">
            <thead className="bg-fo-panel sticky top-0 z-10 text-left text-zinc-400 uppercase tracking-wider text-[10px]">
              <tr>
              <th className="px-3 py-2" scope="col">
                Asset ID
              </th>
              <th className="px-3 py-2" scope="col">
                Name
              </th>
              <th className="px-3 py-2" scope="col">
                Category
              </th>
              <th className="px-3 py-2" scope="col">
                Jurisdiction
              </th>
              <th className="px-3 py-2 text-right" scope="col">
                Net / value
              </th>
              <th className="px-3 py-2" scope="col">
                Liquidity
              </th>
              <th className="px-3 py-2" scope="col">
                Risk
              </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-zinc-500 text-sm">
                    No assets match this filter.{' '}
                    <Link to="/assets" className="text-fo-gold hover:underline">
                      Clear filters
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="border-t border-fo-border hover:bg-fo-panel/60">
                    <td className="px-3 py-2 text-fo-gold-soft whitespace-nowrap">{r.asset_id}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{r.asset_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.asset_category}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.jurisdiction}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatCompactNgn(r.net_value ?? r.current_value)}</td>
                    <td className="px-3 py-2">{r.liquidity}</td>
                    <td className="px-3 py-2">{r.risk_level}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : null}
    </div>
  )
}
