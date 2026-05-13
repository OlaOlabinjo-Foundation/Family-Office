import { useCallback, useEffect, useState } from 'react'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { PageHeader } from '../components/ui/PageHeader'
import { PaginationBar } from '../components/ui/PaginationBar'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'
import { downloadExportCsv } from '../lib/downloadCsv'
import { formatCompactNgn } from '../lib/format'

type Row = Record<string, unknown> & { id: number }

const PAGE_SIZE = 30

export function MasterData() {
  const { token, canWrite } = useAuth()
  const { show: notify } = useNotify()
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [exportErr, setExportErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await apiFetch<{ items: Row[]; total: number }>(
      `/api/data/master_assets?limit=${PAGE_SIZE}&offset=${offset}`,
      { token }
    )
    if (r.total === 0) {
      setRows([])
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
    setRows(r.items)
    setTotal(r.total)
  }, [token, offset])

  useEffect(() => {
    setEditing(null)
  }, [offset])

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

  function startEdit(row: Row) {
    setEditing(row.id)
    const d: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      if (k === 'id' || k === 'updated_at') continue
      d[k] = v === null || v === undefined ? '' : String(v)
    }
    setDraft(d)
  }

  async function save(id: number) {
    const body: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(draft)) {
      if (['current_value', 'annual_income', 'associated_debt', 'net_value'].includes(k)) {
        const n = Number(String(v).replace(/,/g, ''))
        body[k] = v === '' || Number.isNaN(n) ? null : n
      } else {
        body[k] = v
      }
    }
    await apiFetch(`/api/data/master_assets/${id}`, { method: 'PUT', token, body: JSON.stringify(body) })
    setEditing(null)
    await load()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Registers"
        title="Master asset register"
        description={`Manual updates write directly to SQLite (structured for a future PostgreSQL cutover). The table loads ${PAGE_SIZE} rows per page; export CSV is always the full register.${canWrite ? '' : ' Read-only profile.'}`}
        actions={
          <button
            type="button"
            onClick={async () => {
              setExportErr(null)
              try {
                await downloadExportCsv(token, 'master_assets', {
                  onSuccess: () => notify('Master register downloaded as CSV', 'success'),
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
      {loading ? <LoadingBlock label="Loading master register…" /> : null}

      {!loading && !err ? (
        <div className="overflow-hidden rounded-2xl border border-fo-border">
          <div className="max-h-[560px] overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-xs">
          <thead className="bg-fo-panel sticky top-0 text-left text-zinc-400 uppercase text-[10px]">
            <tr>
              <th className="px-2 py-2" scope="col">
                ID
              </th>
              <th className="px-2 py-2" scope="col">
                Asset ID
              </th>
              <th className="px-2 py-2" scope="col">
                Name
              </th>
              <th className="px-2 py-2" scope="col">
                Category
              </th>
              <th className="px-2 py-2" scope="col">
                Jurisdiction
              </th>
              <th className="px-2 py-2 text-right" scope="col">
                Net value
              </th>
              <th className="px-2 py-2" scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-fo-border">
                <td className="px-2 py-1">{r.id}</td>
                {editing === r.id ? (
                  <>
                    <td className="px-2 py-1">
                      <input
                        className="w-24 bg-fo-panel border border-fo-border rounded px-1"
                        value={draft.asset_id}
                        onChange={(e) => setDraft((d) => ({ ...d, asset_id: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-48 bg-fo-panel border border-fo-border rounded px-1"
                        value={draft.asset_name}
                        onChange={(e) => setDraft((d) => ({ ...d, asset_name: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-32 bg-fo-panel border border-fo-border rounded px-1"
                        value={draft.asset_category}
                        onChange={(e) => setDraft((d) => ({ ...d, asset_category: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-28 bg-fo-panel border border-fo-border rounded px-1"
                        value={draft.jurisdiction}
                        onChange={(e) => setDraft((d) => ({ ...d, jurisdiction: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        className="w-28 bg-fo-panel border border-fo-border rounded px-1 text-right"
                        value={draft.net_value}
                        onChange={(e) => setDraft((d) => ({ ...d, net_value: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <button type="button" className="text-fo-gold mr-2" onClick={() => save(r.id)}>
                        Save
                      </button>
                      <button type="button" className="text-zinc-500" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-1 text-fo-gold-soft whitespace-nowrap">{String(r.asset_id)}</td>
                    <td className="px-2 py-1 max-w-xs truncate">{String(r.asset_name)}</td>
                    <td className="px-2 py-1">{String(r.asset_category)}</td>
                    <td className="px-2 py-1">{String(r.jurisdiction)}</td>
                    <td className="px-2 py-1 text-right">{formatCompactNgn(r.net_value as number | null)}</td>
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        disabled={!canWrite}
                        className="text-xs text-fo-gold disabled:opacity-30"
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
          </div>
          <PaginationBar
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            disabled={editing !== null}
            onOffsetChange={setOffset}
          />
        </div>
      ) : null}
    </div>
  )
}
