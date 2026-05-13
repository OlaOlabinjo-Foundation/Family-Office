import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { apiFetch } from '../lib/api'

const REPORTS = [
  { slug: 'monthly', label: 'Monthly family office report' },
  { slug: 'net-worth', label: 'Net worth report' },
  { slug: 'liquidity', label: 'Liquidity report' },
  { slug: 'risk', label: 'Risk report' },
  { slug: 'property', label: 'Property report' },
  { slug: 'liability', label: 'Liability report' },
  { slug: 'exposure', label: 'Investment exposure report' },
  { slug: 'documents', label: 'Document compliance report' },
] as const

export function ReportingCentre() {
  const { token } = useAuth()
  const { show: notify } = useNotify()
  const [history, setHistory] = useState<{ id: number; filename: string; status: string; created_at: string }[]>([])
  const [last, setLast] = useState<Record<string, unknown> | null>(null)
  const [reportBusy, setReportBusy] = useState<string | null>(null)
  const [reportErr, setReportErr] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState<'pdf' | 'excel' | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const h = await apiFetch<{ items: typeof history }>('/api/import/history', { token })
        if (!c) setHistory(h.items)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      c = true
    }
  }, [token])

  async function openReport(slug: string) {
    setReportErr(null)
    setReportBusy(slug)
    try {
      const data = await apiFetch<Record<string, unknown>>(`/api/reports/${slug}`, { token })
      setLast(data)
    } catch (e) {
      setReportErr((e as Error).message)
    } finally {
      setReportBusy(null)
    }
  }

  function printReport() {
    window.print()
  }

  async function pdfReport() {
    if (!last) return
    setExportBusy('pdf')
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 48
      let y = margin
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(212, 175, 55)
      doc.text(String(last.title ?? 'Ola Olabinjo Investment — Report'), margin, y)
      y += 28
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(35, 35, 35)
      const rows = flattenReportRows(last)
      const lineHeight = 11
      const maxY = 780
      for (const row of rows) {
        const text = `${row.key}: ${String(row.value)}`
        const chunks = doc.splitTextToSize(text, 500)
        for (const chunk of chunks) {
          if (y > maxY) {
            doc.addPage()
            y = margin
          }
          doc.text(chunk, margin, y)
          y += lineHeight
        }
      }
      doc.save(`OOI-report-${Date.now()}.pdf`)
      notify('PDF report downloaded', 'success')
    } catch (e) {
      notify((e as Error).message || 'PDF export failed', 'error')
    } finally {
      setExportBusy(null)
    }
  }

  async function excelReport() {
    if (!last) return
    setExportBusy('excel')
    try {
      const XLSX = await import('xlsx')
      const rows = flattenReportRows(last)
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Report')
      XLSX.writeFile(wb, `OOI-report-${Date.now()}.xlsx`)
      notify('Excel report downloaded', 'success')
    } catch (e) {
      notify((e as Error).message || 'Excel export failed', 'error')
    } finally {
      setExportBusy(null)
    }
  }

  return (
    <div className="space-y-8 print:max-w-none">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Outputs"
          title="Reporting centre"
          description="Structured report packs. Export to Excel, download a lightweight PDF, or print to PDF from the browser for board circulation."
        />
      </div>

      {reportErr ? (
        <div role="alert" className="print:hidden rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {reportErr}
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        {REPORTS.map((r) => (
          <button
            key={r.slug}
            type="button"
            disabled={!!reportBusy}
            aria-busy={reportBusy === r.slug}
            onClick={() => openReport(r.slug)}
            className="rounded-xl border border-fo-border bg-fo-graphite/50 px-4 py-3 text-left text-sm text-zinc-200 hover:border-fo-gold hover:text-white disabled:cursor-wait disabled:opacity-60 focus-ring-inset"
          >
            {reportBusy === r.slug ? 'Loading…' : r.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          type="button"
          disabled={!last}
          onClick={printReport}
          className="rounded-md border border-fo-border px-4 py-2 text-sm disabled:opacity-40"
        >
          Print-friendly view
        </button>
        <button
          type="button"
          disabled={!last || !!exportBusy}
          aria-busy={exportBusy === 'pdf'}
          onClick={() => void pdfReport()}
          className="rounded-md border border-fo-gold text-fo-gold-soft px-4 py-2 text-sm disabled:opacity-40"
        >
          {exportBusy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        <button
          type="button"
          disabled={!last || !!exportBusy}
          aria-busy={exportBusy === 'excel'}
          onClick={() => void excelReport()}
          className="rounded-md bg-fo-gold text-fo-black px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {exportBusy === 'excel' ? 'Preparing Excel…' : 'Download Excel'}
        </button>
      </div>

      {last ? (
        <pre className="text-xs bg-fo-panel border border-fo-border rounded-xl p-4 overflow-x-auto text-zinc-200 max-h-[560px] overflow-y-auto">
          {JSON.stringify(last, null, 2)}
        </pre>
      ) : null}

      <div className="rounded-2xl border border-fo-border p-4 print:hidden">
        <div className="text-sm text-zinc-300 mb-2">Upload history</div>
        <ul className="text-xs text-zinc-500 space-y-1 max-h-40 overflow-y-auto">
          {history.map((h) => (
            <li key={h.id}>
              {h.created_at} — {h.filename} — {h.status}
            </li>
          ))}
          {!history.length && <li>No imports logged yet.</li>}
        </ul>
      </div>
    </div>
  )
}

function flattenReportRows(data: Record<string, unknown>) {
  const rows: Record<string, unknown>[] = []
  const walk = (obj: unknown, prefix = '') => {
    if (obj === null || obj === undefined) return
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${prefix}[${i}]`))
      return
    }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const key = prefix ? `${prefix}.${k}` : k
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) walk(v, key)
        else if (Array.isArray(v)) rows.push({ key, value: JSON.stringify(v) })
        else rows.push({ key, value: v as unknown })
      }
    } else {
      rows.push({ key: prefix, value: obj })
    }
  }
  walk(data)
  return rows.length ? rows : [{ key: 'payload', value: JSON.stringify(data) }]
}
