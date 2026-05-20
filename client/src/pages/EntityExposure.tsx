import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { setDocumentTitle } from '../lib/documentTitle'
import { formatCompactNgn } from '../lib/format'

type ExposureItem = {
  name: string
  assets: number
  cash: number
  realEstate: number
  securities: number
  liabilities: number
  grossAssets: number
  netPosition: number
}

type ExposurePayload = {
  generatedAt: string
  itemCount: number
  items: ExposureItem[]
}

function Money({ value }: { value: number }) {
  return <span className="tabular-nums">{formatCompactNgn(value)}</span>
}

export function EntityExposure() {
  const { token } = useAuth()
  const [data, setData] = useState<ExposurePayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDocumentTitle('Entity exposure')
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await apiFetch<ExposurePayload>('/api/entities/exposure', { token })
        if (!c) setData(r)
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

  const asOf = data?.generatedAt ? String(data.generatedAt).replace('T', ' ').slice(0, 19) : null

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Registers"
        title="Entity exposure"
        description="Consolidated view by legal owner / borrower entity across master assets, cash, real estate, public securities, and liabilities. Archived register rows are excluded."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/data/master"
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Master register
            </Link>
            <Link
              to="/maintenance"
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Data maintenance
            </Link>
          </div>
        }
      />

      {loading ? <LoadingBlock label="Building exposure view…" /> : null}
      {err ? (
        <p role="alert" className="text-sm text-fo-red">
          {err}
        </p>
      ) : null}

      {!loading && !err && data ? (
        <>
          <p className="text-sm text-zinc-500">
            {data.itemCount} entit{data.itemCount === 1 ? 'y' : 'ies'}
            {asOf ? ` · as of ${asOf} UTC` : null}
          </p>

          <div className="overflow-x-auto rounded-xl border border-fo-border bg-fo-panel">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2" scope="col">
                    Entity
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Master
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Cash
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Real estate
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Securities
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Gross assets
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Liabilities
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Net position
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.name} className="border-t border-fo-border">
                    <td className="px-3 py-2 font-medium text-fo-gold-soft">{row.name}</td>
                    <td className="px-3 py-2 text-right">
                      <Money value={row.assets} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={row.cash} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={row.realEstate} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={row.securities} />
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-200">
                      <Money value={row.grossAssets} />
                    </td>
                    <td className="px-3 py-2 text-right text-fo-amber">
                      <Money value={row.liabilities} />
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${row.netPosition >= 0 ? 'text-emerald-400/90' : 'text-fo-red'}`}
                    >
                      <Money value={row.netPosition} />
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                      No entity names found on active register rows. Add owner / borrower fields on{' '}
                      <Link to="/data/master" className="text-fo-gold-soft underline">
                        master
                      </Link>
                      ,{' '}
                      <Link to="/data/cash" className="text-fo-gold-soft underline">
                        cash
                      </Link>
                      , or other registers.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
