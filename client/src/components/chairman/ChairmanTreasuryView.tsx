import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingBlock } from '../ui/LoadingBlock'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import { formatCompactNgn } from '../../lib/format'
import { ChairmanPageChrome } from './ChairmanPageChrome'

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

function MetricCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: string
  hint?: string
  warn?: boolean
}) {
  return (
    <article
      className={`chairman-card rounded-2xl border p-4 ${
        warn ? 'border-fo-amber/50 bg-fo-amber/5' : 'border-fo-border/80 bg-fo-graphite/50'
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-600">{hint}</p> : null}
    </article>
  )
}

function AccountCard({ row }: { row: CashRow }) {
  const f = row.flags
  const acct = String(row.account_id || '').trim()
  const balance = formatCompactNgn(row.current_balance as number | null)
  const currency = String(row.currency || 'NGN')

  return (
    <article
      {...(acct ? { 'data-treasury-account': acct } : {})}
      className={`chairman-card rounded-2xl border p-4 transition-colors ${
        f.belowMinimum
          ? 'border-fo-red/40 bg-fo-red/5'
          : f.reconciliationStale && f.tracked
            ? 'border-fo-amber/40 bg-fo-amber/5'
            : 'border-fo-border/80 bg-fo-graphite/40'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{String(row.owner_entity || 'Entity')}</p>
          <h3 className="mt-1 font-medium text-white truncate">{String(row.bank_name || 'Bank account')}</h3>
          {acct ? <p className="mt-0.5 text-xs text-zinc-500 font-mono">{acct}</p> : null}
        </div>
        <div className="text-right shrink-0">
          <p className="font-[family-name:var(--font-display)] text-xl text-fo-gold-soft">{balance}</p>
          <p className="text-[10px] text-zinc-500">{currency}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        {!f.tracked && (
          <span className="rounded-full border border-fo-border px-2 py-0.5 text-zinc-500">Template line</span>
        )}
        {f.belowMinimum && (
          <span className="rounded-full border border-fo-red/40 bg-fo-red/10 px-2 py-0.5 text-fo-red">Below minimum</span>
        )}
        {f.reconciliationStale && f.tracked && (
          <span className="rounded-full border border-fo-amber/40 bg-fo-amber/10 px-2 py-0.5 text-fo-amber">
            Reconcile overdue{f.reconciliationDaysSince != null ? ` · ${f.reconciliationDaysSince}d` : ''}
          </span>
        )}
        {f.tracked && !f.belowMinimum && !(f.reconciliationStale && f.tracked) && (
          <span className="rounded-full border border-emerald-900/50 bg-emerald-950/30 px-2 py-0.5 text-fo-green">On track</span>
        )}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Last reconciled: {String(row.last_reconciled_date || '—')}
        {row.risk_level ? ` · Risk ${String(row.risk_level)}` : ''}
      </p>
      {(f.belowMinimum || (f.reconciliationStale && f.tracked)) && row.ctaTo ? (
        <Link
          to={row.ctaTo}
          className="mt-3 inline-flex text-[11px] uppercase tracking-wider text-fo-gold-soft hover:text-fo-gold"
        >
          View follow-up →
        </Link>
      ) : null}
    </article>
  )
}

export function ChairmanTreasuryView() {
  const { token } = useAuth()
  const [searchParams] = useSearchParams()
  const highlightAccount = useMemo(() => (searchParams.get('highlight') || '').trim(), [searchParams])
  const [data, setData] = useState<TreasuryPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
    el.classList.add('ring-2', 'ring-fo-gold/50')
    const t = window.setTimeout(() => el.classList.remove('ring-2', 'ring-fo-gold/50'), 2600)
    return () => window.clearTimeout(t)
  }, [highlightAccount, loading, data?.items])

  const totals = data?.totals
  const issueCount = totals ? totals.belowMinimumCount + totals.staleReconciliationCount : 0
  const asOf = data?.asOf ? String(data.asOf).replace('T', ' ').slice(0, 19) : null

  const sortedItems = useMemo(() => {
    if (!data?.items) return []
    return [...data.items].sort((a, b) => {
      const av = Number(a.current_balance) || 0
      const bv = Number(b.current_balance) || 0
      return bv - av
    })
  }, [data?.items])

  if (loading) {
    return (
      <ChairmanPageChrome title="Treasury" subtitle="Liquidity and cash positions">
        <LoadingBlock label="Loading treasury…" />
      </ChairmanPageChrome>
    )
  }

  return (
    <ChairmanPageChrome
      title="Treasury"
      subtitle={asOf ? `Cash & banking · as of ${asOf} UTC` : 'Cash & banking across the family book'}
    >
      {err ? (
        <p role="alert" className="text-sm text-fo-red">
          {err}
        </p>
      ) : null}

      {totals ? (
        <>
          {issueCount > 0 ? (
            <div className="rounded-2xl border border-fo-amber/40 bg-fo-amber/5 px-4 py-3 text-sm text-zinc-300">
              <span className="text-fo-amber font-medium">{issueCount} attention item{issueCount === 1 ? '' : 's'}</span>
              {' — '}
              {totals.belowMinimumCount > 0
                ? `${totals.belowMinimumCount} below policy minimum`
                : null}
              {totals.belowMinimumCount > 0 && totals.staleReconciliationCount > 0 ? '; ' : null}
              {totals.staleReconciliationCount > 0
                ? `${totals.staleReconciliationCount} reconciliation overdue`
                : null}
              . Your family office team manages remediation.
            </div>
          ) : (
            <p className="text-sm text-zinc-400">All tracked accounts are within policy on reconciliation and minimum balances.</p>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total cash" value={formatCompactNgn(totals.totalBalance)} />
            <MetricCard label="Actively tracked" value={formatCompactNgn(totals.trackedBalance)} hint="Balances with policy or flows" />
            <MetricCard
              label="Below minimum"
              value={String(totals.belowMinimumCount)}
              warn={totals.belowMinimumCount > 0}
            />
            <MetricCard
              label="Reconcile overdue"
              value={String(totals.staleReconciliationCount)}
              warn={totals.staleReconciliationCount > 0}
            />
          </section>

          {highlightAccount && !highlightOnPage && totals.accountRows > 0 ? (
            <p className="text-xs text-fo-amber" role="status">
              No account matches &quot;{highlightAccount}&quot; in the current list.
            </p>
          ) : null}

          <section>
            <h2 className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">
              Accounts ({totals.accountRows})
            </h2>
            {sortedItems.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedItems.map((row) => (
                  <AccountCard key={row.id} row={row} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-fo-border bg-fo-panel/30 p-6 text-sm text-zinc-500">
                No cash accounts on the book yet. Import the workbook or ask your lead to populate Cash & Banking.
              </p>
            )}
          </section>

          <footer className="text-[11px] text-zinc-600 border-t border-fo-border/40 pt-6">
            Principal read-only view · figures in NGN unless noted on the account · policy flags mirror the operator treasury
            control.
          </footer>
        </>
      ) : null}
    </ChairmanPageChrome>
  )
}
