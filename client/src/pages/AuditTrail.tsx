import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { PaginationBar } from '../components/ui/PaginationBar'
import { TableScroll } from '../components/ui/TableScroll'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadApiCsv } from '../lib/downloadCsv'

type AuditRow = {
  id: number
  actor: string
  action: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
  meta: Record<string, unknown> | null
}

const PAGE_SIZE = 40

function AuditMetaDetail({ meta }: { meta: Record<string, unknown> | null }) {
  if (!meta) return <>—</>
  const rawNote = meta.note
  const note = typeof rawNote === 'string' && rawNote.trim() ? rawNote.trim() : null
  const { note: _omit, ...rest } = meta
  const hasRest = Object.keys(rest).length > 0
  return (
    <div className="max-w-md">
      {note ? (
        <div className="mb-1 text-[11px] font-sans text-zinc-300 leading-snug whitespace-normal">
          <span className="text-[9px] uppercase tracking-wide text-zinc-500">Note </span>
          {note}
        </div>
      ) : null}
      {hasRest ? (
        <div className="truncate font-mono text-[10px] text-zinc-500" title={JSON.stringify(rest)}>
          {JSON.stringify(rest)}
        </div>
      ) : !note ? (
        '—'
      ) : null}
    </div>
  )
}

/** Optional screen to open for common audit actions (best-effort). */
function auditEventRelatedRoute(row: AuditRow): string | null {
  const act = (row.action || '').toLowerCase()
  const et = (row.entity_type || '').toLowerCase()
  if (act.startsWith('import.')) return '/import'
  if (act.startsWith('auth.')) return '/settings'
  if (act.startsWith('admin.')) return '/admin/users'
  if (act.startsWith('decision.')) return '/decisions'
  if (act.startsWith('snapshot.')) return '/snapshots'
  if (act.startsWith('documents.review')) return '/documents'
  if (act.startsWith('data.')) {
    if (et === 'master_assets') return '/data/master'
    if (et === 'documents') return '/documents'
    if (et === 'cash_banking') return '/treasury'
    if (et === 'liabilities') return '/risk'
    return null
  }
  if (et === 'app_user') return '/admin/users'
  if (et === 'user') return '/settings'
  if (et === 'document' || act.includes('document')) return '/documents?outstanding=1'
  return null
}

export function AuditTrail() {
  const { token } = useAuth()
  const { show: notify } = useNotify()
  const [items, setItems] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportErr, setExportErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await apiFetch<{ items: AuditRow[]; total: number }>(
      `/api/audit?limit=${PAGE_SIZE}&offset=${offset}`,
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
        eyebrow="Governance"
        title="Audit trail"
        description={`Append-only log of material actions (newest first). Team user changes may include an operator note plus before/after role and display name. The Related column links to the screen most often needed for that event (imports, account security, team users, compliance). This screen loads ${PAGE_SIZE} events per page; CSV export can include up to 2,000 rows.`}
        actions={
          <button
            type="button"
            onClick={async () => {
              setExportErr(null)
              try {
                await downloadApiCsv(token, '/api/export/audit?limit=2000', 'audit_log.csv', {
                  onSuccess: () => notify('Audit log exported (up to 2,000 events)', 'success'),
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
      {loading ? <LoadingBlock label="Loading audit trail…" /> : null}

      {!loading && !err ? (
        <div>
          <TableScroll maxHeight="max-h-[70vh]">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="sticky top-0 z-10 bg-fo-panel text-left text-[10px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2" scope="col">
                    Time
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Actor
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Action
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Entity
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Detail
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Related
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const related = auditEventRelatedRoute(a)
                  return (
                  <tr key={a.id} className="border-t border-fo-border hover:bg-fo-panel/30">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{a.created_at}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-fo-gold-soft">{a.actor}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{a.action}</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {a.entity_type || '—'}
                      {a.entity_id ? <span className="text-zinc-600"> · {a.entity_id}</span> : null}
                    </td>
                    <td className="max-w-md px-3 py-2 text-[10px] text-zinc-500">
                      <AuditMetaDetail meta={a.meta} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {related ? (
                        <Link
                          to={related}
                          className="text-xs text-fo-gold-soft hover:text-fo-gold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fo-gold/50 rounded-sm"
                        >
                          Open
                        </Link>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            {!items.length ? (
              <div className="p-4 text-sm text-zinc-500">No audit events yet. Actions are logged from this release onward.</div>
            ) : null}
          </TableScroll>
          <PaginationBar offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
        </div>
      ) : null}
    </div>
  )
}
