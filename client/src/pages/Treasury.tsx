import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChairmanTreasuryView } from '../components/chairman/ChairmanTreasuryView'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { TableScroll } from '../components/ui/TableScroll'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadApiCsv, downloadExportCsv } from '../lib/downloadCsv'
import { formatCompactNgn, formatMoneyCompact } from '../lib/format'

type CashRow = Record<string, unknown> & {
  id: number
  ctaTo: string
  flags: {
    tracked: boolean
    belowMinimum: boolean
    reconciliationStale: boolean
    reconciliationDaysSince: number | null
  }
}

type TreasuryPayload = {
  asOf: string
  totals: {
    totalBalance: number
    trackedBalance: number
    accountRows: number
    belowMinimumCount: number
    staleReconciliationCount: number
  }
  items: CashRow[]
}

export function Treasury() {
  const { user } = useAuth()
  if (user?.role === 'chairman') return <ChairmanTreasuryView />
  return <TreasuryOperator />
}

function TreasuryOperator() {
  const { token } = useAuth()
  const { show: notify } = useNotify()
  const [searchParams] = useSearchParams()
  const highlightAccount = useMemo(() => (searchParams.get('highlight') || '').trim(), [searchParams])
  const [data, setData] = useState<TreasuryPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportErr, setExportErr] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await apiFetch<TreasuryPayload>('/api/treasury', { token })
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

  const highlightOnPage =
    highlightAccount.length > 0 &&
    (data?.items.some((row) => String(row.account_id || '').trim() === highlightAccount) ?? false)

  useEffect(() => {
    if (!highlightAccount || loading || !data?.items.length) return
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(highlightAccount) : highlightAccount
    const el = document.querySelector(`[data-treasury-account="${esc}"]`)
    if (!el || !(el instanceof HTMLElement)) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-fo-gold/50', 'bg-fo-gold/5')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [highlightAccount, loading, data?.items])

  const totals = data?.totals

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Liquidity"
        title="Treasury & liquidity"
        description="Consolidated view of Cash & Banking with policy flags: tracked vs template lines, balances below minimum, and reconciliation ageing (same 30-day control used in the risk engine). Account IDs link to search, decisions (stale reconcile), or risk (below minimum). Use ?highlight=<account id> to scroll to a row when it is in the table."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/data/cash"
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Edit cash register
            </Link>
            <button
              type="button"
              onClick={async () => {
                setExportErr(null)
                try {
                  await downloadExportCsv(token, 'cash_banking', {
                    onSuccess: () => notify('Raw cash & banking table exported', 'success'),
                  })
                } catch (e) {
                  setExportErr((e as Error).message)
                }
              }}
              className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
            >
              Export raw CSV
            </button>
            <button
              type="button"
              onClick={async () => {
                setExportErr(null)
                try {
                  await downloadApiCsv(token, '/api/export/treasury-flags', 'treasury_cash_with_flags.csv', {
                    onSuccess: () => notify('Treasury export with policy flags downloaded', 'success'),
                  })
                } catch (e) {
                  setExportErr((e as Error).message)
                }
              }}
              className="rounded-lg border border-fo-gold/40 bg-fo-graphite px-4 py-2 text-xs uppercase tracking-wider text-fo-gold-soft hover:bg-fo-panel focus-ring-inset"
            >
              Export with flags
            </button>
          </div>
        }
      />
      {exportErr ? (
        <div role="alert" className="text-sm text-fo-red">
          {exportErr}
        </div>
      ) : null}
      {err ? (
        <div role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </div>
      ) : null}
      {loading ? <LoadingBlock label="Loading treasury view…" /> : null}

      {!loading && data && totals && highlightAccount && !highlightOnPage && totals.accountRows > 0 ? (
        <p className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-4 py-2 text-xs text-fo-amber" role="status">
          No cash row matches account &quot;{highlightAccount}&quot; on this page.
        </p>
      ) : null}

      {!loading && data && totals ? (
        <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Total booked cash" value={formatCompactNgn(totals.totalBalance)} />
        <Stat label="Tracked cash" value={formatCompactNgn(totals.trackedBalance)} hint="Rows with balance, policy, flows, or reconcile date" />
        <Stat label="Accounts" value={String(totals.accountRows)} />
        <Stat label="Below minimum" value={String(totals.belowMinimumCount)} warn={totals.belowMinimumCount > 0} />
        <Stat label="Reconcile &gt; 30d" value={String(totals.staleReconciliationCount)} warn={totals.staleReconciliationCount > 0} />
      </div>

      <TableScroll>
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-fo-panel text-left text-zinc-400 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-2" scope="col">
                Account
              </th>
              <th className="px-3 py-2" scope="col">
                Bank
              </th>
              <th className="px-3 py-2" scope="col">
                Owner
              </th>
              <th className="px-3 py-2 text-right" scope="col">
                Balance
              </th>
              <th className="px-3 py-2" scope="col">
                Reconciled
              </th>
              <th className="px-3 py-2" scope="col">
                Risk
              </th>
              <th className="px-3 py-2" scope="col">
                Flags
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => {
              const f = row.flags
              const acct = String(row.account_id || '').trim()
              return (
                <tr
                  key={row.id}
                  {...(acct ? { 'data-treasury-account': acct } : {})}
                  className={`border-t border-fo-border scroll-mt-2 ${
                    f.belowMinimum ? 'bg-fo-red/10' : f.reconciliationStale && f.tracked ? 'bg-fo-amber/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      to={row.ctaTo}
                      className="text-fo-gold-soft hover:text-fo-gold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/50 rounded-sm"
                    >
                      {String(row.account_id) || '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 max-w-[140px] truncate">{String(row.bank_name)}</td>
                  <td className="px-3 py-2 max-w-[120px] truncate">{String(row.owner_entity)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatMoneyCompact(row.current_balance as number | null, row.currency as string)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-400">{String(row.last_reconciled_date || '—')}</td>
                  <td className="px-3 py-2">{String(row.risk_level || '—')}</td>
                  <td className="px-3 py-2 text-[11px] text-zinc-500">
                    {!f.tracked && <span className="text-zinc-600">Template / sparse · </span>}
                    {f.belowMinimum && <span className="text-fo-red">Below min · </span>}
                    {f.reconciliationStale && f.tracked && <span className="text-fo-amber">Reconcile · </span>}
                    {f.reconciliationDaysSince != null && <span>{f.reconciliationDaysSince}d</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableScroll>

      <p className="text-xs text-zinc-600">
        Edit underlying rows in the workbook import or via{' '}
        <Link to="/data/master" className="text-fo-gold underline">
          Master Register
        </Link>{' '}
        for linked assets; dedicated cash editing can be added in a later release.
      </p>
        </>
      ) : null}
    </div>
  )
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warn ? 'border-fo-amber bg-fo-amber/5' : 'border-fo-border bg-fo-graphite/40'
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="text-lg text-white mt-1">{value}</div>
      {hint && <div className="text-[10px] text-zinc-600 mt-1">{hint}</div>}
    </div>
  )
}
