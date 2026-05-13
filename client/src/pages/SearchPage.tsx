import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { formatCompactNgn } from '../lib/format'

type SearchPayload = {
  query: string
  maxPerSection: number
  master_assets: { id: number; asset_id: string; asset_name: string; asset_category: string; jurisdiction: string }[]
  cash_banking: {
    id: number
    account_id: string
    bank_name: string
    account_name: string
    owner_entity: string
    currency: string
    current_balance: number | null
  }[]
  real_estate: {
    id: number
    property_id: string
    name_address: string
    country: string
    owner_entity: string
    current_value: number | null
    currency: string
  }[]
  documents: { id: number; document_category: string; entity_asset: string; status: string }[]
  liabilities: {
    id: number
    lender: string
    borrower_entity: string
    facility_type: string
    outstanding_balance: number | null
    currency: string
  }[]
}

export function SearchPage() {
  const { token } = useAuth()
  const [params] = useSearchParams()
  const q = (params.get('q') || '').trim()
  const [data, setData] = useState<SearchPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let c = false
    ;(async () => {
      if (q.length < 2) {
        setData(null)
        setErr(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setErr(null)
      try {
        const r = await apiFetch<SearchPayload>(`/api/search?q=${encodeURIComponent(q)}`, { token })
        if (!c) setData(r)
      } catch (e) {
        if (!c) {
          setErr((e as Error).message)
          setData(null)
        }
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [token, q])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Registers"
        title="Global search"
        description="Searches the Master Asset Register, Cash & Banking, Real Estate, Document Tracker, and Liabilities. Each category returns at most 24 matches; use at least two characters in the header search box."
      />

      {q.length < 2 && (
        <p className="rounded-lg border border-fo-border bg-fo-graphite/40 px-4 py-3 text-sm text-zinc-400">
          Enter a query in the header search box (minimum 2 characters).
        </p>
      )}
      {loading && q.length >= 2 && <LoadingBlock label="Searching registers…" />}
      {err ? (
        <p role="alert" className="rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {err}
        </p>
      ) : null}

      {data && !loading && (
        <div className="space-y-10">
          <p className="text-sm text-zinc-400">
            Results for <span className="text-fo-gold-soft">{data.query}</span>
          </p>
          <p className="text-xs text-zinc-600">
            Each category shows at most {data.maxPerSection} rows. If a section is full, narrow your query for more specific matches.
          </p>

          <Section title="Master assets" empty={!data.master_assets.length}>
            <ul className="space-y-2">
              {data.master_assets.map((a) => (
                <li key={a.id} className="border border-fo-border rounded-lg p-3 text-sm hover:bg-fo-panel/50">
                  <Link to="/data/master" className="text-fo-gold-soft font-medium">
                    {a.asset_id}
                  </Link>
                  <span className="text-white"> · {a.asset_name}</span>
                  <div className="text-xs text-zinc-500 mt-1">
                    {a.asset_category} · {a.jurisdiction}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Cash & banking" empty={!data.cash_banking.length}>
            <ul className="space-y-2">
              {data.cash_banking.map((c) => (
                <li key={c.id} className="border border-fo-border rounded-lg p-3 text-sm">
                  <Link to="/treasury" className="text-fo-gold-soft">
                    {c.bank_name || 'Bank'}
                  </Link>
                  <span className="text-zinc-300"> · {c.account_name || c.account_id}</span>
                  <div className="text-xs text-zinc-500 mt-1">
                    {c.owner_entity} · {formatCompactNgn(c.current_balance)} {c.currency}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Real estate" empty={!data.real_estate.length}>
            <ul className="space-y-2">
              {data.real_estate.map((r) => (
                <li key={r.id} className="border border-fo-border rounded-lg p-3 text-sm">
                  <span className="text-white">{r.name_address}</span>
                  <div className="text-xs text-zinc-500 mt-1">
                    {r.property_id} · {r.country} · {formatCompactNgn(r.current_value)} {r.currency}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Documents" empty={!data.documents.length}>
            <ul className="space-y-2">
              {data.documents.map((d) => (
                <li key={d.id} className="border border-fo-border rounded-lg p-3 text-sm">
                  <Link to="/documents" className="text-fo-gold-soft">
                    {d.document_category || 'Document'}
                  </Link>
                  <div className="text-xs text-zinc-500 mt-1">{d.entity_asset}</div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Liabilities" empty={!data.liabilities.length}>
            <ul className="space-y-2">
              {data.liabilities.map((L) => (
                <li key={L.id} className="border border-fo-border rounded-lg p-3 text-sm">
                  <span className="text-white">{L.facility_type || 'Facility'}</span>
                  <div className="text-xs text-zinc-500 mt-1">
                    {L.lender} · {L.borrower_entity} · {formatCompactNgn(L.outstanding_balance)} {L.currency}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-3">{title}</h2>
      {empty ? <p className="text-xs text-zinc-600">No matches.</p> : children}
    </section>
  )
}
