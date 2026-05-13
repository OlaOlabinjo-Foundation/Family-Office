import { useCallback, useEffect, useState } from 'react'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { PaginationBar } from '../components/ui/PaginationBar'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadExportCsv } from '../lib/downloadCsv'

type Doc = {
  id: number
  document_id: string
  document_category: string
  entity_asset: string
  status: string
  owner: string
  risk_level: string
  storage_link: string
  date_requested: string
  date_received: string
}

const PAGE_SIZE = 25

export function ComplianceTracker() {
  const { token } = useAuth()
  const { show: notify } = useNotify()
  const [items, setItems] = useState<Doc[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportErr, setExportErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await apiFetch<{ items: Doc[]; total: number }>(
      `/api/documents/tracker?limit=${PAGE_SIZE}&offset=${offset}`,
      { token }
    )
    if (r.total === 0) {
      setItems([])
      setTotal(0)
      return
    }
    if (r.items.length === 0 && offset > 0) {
      const lastOffset = Math.max(0, (Math.ceil(r.total / PAGE_SIZE) - 1) * PAGE_SIZE)
      if (offset !== lastOffset) {
        setOffset(lastOffset)
        return
      }
    }
    setItems(r.items)
    setTotal(r.total)
  }, [token, offset])

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        await load()
      } catch (e) {
        if (!c) setErr((e as Error).message)
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controls"
        title="Document & compliance tracker"
        description={`Rows that have a document category or linked entity (${PAGE_SIZE} per page). Export CSV is the full documents table, not only this filtered view.`}
        actions={
          <button
            type="button"
            onClick={async () => {
              setExportErr(null)
              try {
                await downloadExportCsv(token, 'documents', {
                  onSuccess: () => notify('Full documents table exported as CSV', 'success'),
                })
              } catch (e) {
                setExportErr((e as Error).message)
              }
            }}
            className="rounded-lg border border-fo-border bg-fo-panel px-4 py-2 text-xs uppercase tracking-wider text-zinc-200 hover:border-fo-gold/50 hover:text-fo-gold focus-ring-inset"
          >
            Export CSV
          </button>
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
      {loading ? <LoadingBlock label="Loading document tracker…" /> : null}

      {!loading && !err ? (
        <div className="overflow-hidden rounded-2xl border border-fo-border">
          <div className="max-h-[min(70vh,560px)] overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-fo-panel text-left text-[10px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2" scope="col">
                    Category
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Entity / asset
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Status
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Owner
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Requested
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Received
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Risk
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} className="border-t border-fo-border hover:bg-fo-panel/50">
                    <td className="whitespace-nowrap px-3 py-2">{d.document_category}</td>
                    <td className="max-w-xs truncate px-3 py-2">{d.entity_asset}</td>
                    <td className="px-3 py-2">{d.status}</td>
                    <td className="px-3 py-2">{d.owner}</td>
                    <td className="whitespace-nowrap px-3 py-2">{d.date_requested}</td>
                    <td className="whitespace-nowrap px-3 py-2">{d.date_received}</td>
                    <td className="px-3 py-2">{d.risk_level}</td>
                    <td className="max-w-[140px] truncate px-3 py-2">
                      {d.storage_link ? (
                        <a className="text-fo-gold underline" href={d.storage_link} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length ? (
              <div className="p-4 text-sm text-zinc-500">No document rows with category or entity yet.</div>
            ) : null}
          </div>
          <PaginationBar offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
        </div>
      ) : null}
    </div>
  )
}
