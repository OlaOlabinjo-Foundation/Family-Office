import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChairmanReportsView } from '../components/chairman/ChairmanReportsView'
import { ReportHumanReadout } from '../components/reports/ReportHumanReadout'
import { ReportShareBar } from '../components/reports/ReportShareBar'
import { downloadReportJson, downloadReportExcel, downloadReportPdf } from '../lib/reportDownload'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'
import { useReportFromUrl } from '../hooks/useReportFromUrl'
import { apiFetch } from '../lib/api'
import { REPORT_CATALOG, reportPath, type ReportSlug } from '../lib/reportsCatalog'
import { setDocumentTitle } from '../lib/documentTitle'

const REPORTS = REPORT_CATALOG

function relatedViewsForReport(slug: ReportSlug): { to: string; label: string }[] {
  switch (slug) {
    case 'monthly':
      return [
        { to: '/', label: 'Command Centre' },
        { to: '/snapshots', label: 'Snapshots' },
        { to: '/actions', label: 'Next actions' },
      ]
    case 'net-worth':
      return [
        { to: '/', label: 'Command Centre' },
        { to: '/data/master', label: 'Master register' },
        { to: '/assets', label: 'Asset intelligence' },
      ]
    case 'liquidity':
      return [
        { to: '/treasury', label: 'Treasury' },
        { to: '/', label: 'Command Centre' },
        { to: '/risk', label: 'Risk' },
      ]
    case 'risk':
      return [
        { to: '/risk', label: 'Risk module' },
        { to: '/decisions', label: 'Decisions' },
        { to: '/actions', label: 'Next actions' },
      ]
    case 'property':
      return [
        { to: '/assets', label: 'Asset intelligence' },
        { to: '/search?q=' + encodeURIComponent('property'), label: 'Search' },
        { to: '/data/master', label: 'Master register' },
      ]
    case 'liability':
      return [
        { to: '/risk', label: 'Risk' },
        { to: '/treasury', label: 'Treasury' },
        { to: '/search?q=' + encodeURIComponent('debt'), label: 'Search' },
      ]
    case 'exposure':
      return [
        { to: '/assets', label: 'Asset intelligence' },
        { to: '/risk', label: 'Risk' },
        { to: '/', label: 'Command Centre' },
      ]
    case 'documents':
      return [
        { to: '/documents', label: 'Compliance tracker' },
        { to: '/decisions', label: 'Decisions' },
        { to: '/actions', label: 'Next actions' },
      ]
    default:
      return [{ to: '/', label: 'Command Centre' }]
  }
}

export function ReportingCentre() {
  const { user } = useAuth()
  if (user?.role === 'chairman') return <ChairmanReportsView />
  return <ReportingCentreOperator />
}

function ReportingCentreOperator() {
  const { token } = useAuth()
  const { show: notify } = useNotify()
  const { invalidSlug, last, lastSlug, reportBusy, reportErr, isDetailView } = useReportFromUrl(token)
  const [history, setHistory] = useState<{ id: number; filename: string; status: string; created_at: string }[]>([])
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

  useEffect(() => {
    setDocumentTitle('Reporting centre')
  }, [])

  function printReport() {
    window.print()
  }

  async function pdfReport() {
    if (!last) return
    setExportBusy('pdf')
    try {
      await downloadReportPdf(last)
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
      await downloadReportExcel(last)
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

      {invalidSlug ? (
        <div role="alert" className="print:hidden rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          Unknown report slug. Pick a report below or open the{' '}
          <Link to={reportPath('monthly')} className="text-fo-gold-soft underline">
            monthly pack
          </Link>
          .
        </div>
      ) : null}

      {reportErr ? (
        <div role="alert" className="print:hidden rounded-lg border border-fo-red/30 bg-fo-red/5 px-4 py-3 text-sm text-fo-red">
          {reportErr}
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        {REPORTS.map((r) => (
          <Link
            key={r.slug}
            to={reportPath(r.slug)}
            aria-busy={reportBusy === r.slug}
            className={`rounded-xl border bg-fo-graphite/50 px-4 py-3 text-left text-sm text-zinc-200 hover:border-fo-gold hover:text-white focus-ring-inset ${
              isDetailView && lastSlug === r.slug ? 'border-fo-gold text-white' : 'border-fo-border'
            } ${reportBusy === r.slug ? 'opacity-60' : ''}`}
          >
            {reportBusy === r.slug ? 'Loading\u2026' : r.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          type="button"
          disabled={!last || !lastSlug}
          onClick={() => last && lastSlug && downloadReportJson(last, lastSlug)}
          className="rounded-md border border-fo-border px-4 py-2 text-sm disabled:opacity-40"
        >
          Download JSON
        </button>
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
          {exportBusy === 'pdf' ? 'Preparing PDF\u2026' : 'Download PDF'}
        </button>
        <button
          type="button"
          disabled={!last || !!exportBusy}
          aria-busy={exportBusy === 'excel'}
          onClick={() => void excelReport()}
          className="rounded-md bg-fo-gold text-fo-black px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {exportBusy === 'excel' ? 'Preparing Excel\u2026' : 'Download Excel'}
        </button>
      </div>

      {last && lastSlug ? <ReportShareBar slug={lastSlug} /> : null}

      {last && lastSlug ? (
        <div className="print:hidden rounded-xl border border-fo-border bg-fo-graphite/40 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-2">Related views</div>
          <div className="flex flex-wrap gap-2">
            {relatedViewsForReport(lastSlug).map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-md border border-fo-border bg-fo-panel/60 px-3 py-1.5 text-xs text-zinc-200 hover:border-fo-gold/40 hover:text-fo-gold-soft"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {last && lastSlug ? (
        <>
          <div className="rounded-xl border border-fo-border bg-fo-panel/40 p-4 md:p-6 print:border-fo-border">
            <ReportHumanReadout data={last} slug={lastSlug} />
          </div>
          <details className="print:hidden group rounded-xl border border-fo-border bg-fo-graphite/30">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm text-fo-gold-soft marker:content-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
              <span>Technical detail (JSON)</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 group-open:hidden">Show</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 hidden group-open:inline">Hide</span>
            </summary>
            <pre className="text-xs border-t border-fo-border p-4 overflow-x-auto text-zinc-200 max-h-[560px] overflow-y-auto">
              {JSON.stringify(last, null, 2)}
            </pre>
          </details>
        </>
      ) : null}

      <div className="rounded-2xl border border-fo-border p-4 print:hidden">
        <div className="text-sm text-zinc-300 mb-2">Upload history</div>
        <ul className="text-xs text-zinc-500 space-y-1 max-h-40 overflow-y-auto">
          {history.map((h) => (
            <li key={h.id}>
              {h.created_at} ? {h.filename} ? {h.status}
            </li>
          ))}
          {!history.length && <li>No imports logged yet.</li>}
        </ul>
      </div>
    </div>
  )
}

