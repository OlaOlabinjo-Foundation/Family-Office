import { useEffect, useState } from 'react'

import { Link } from 'react-router-dom'

import { LoadingBlock } from '../ui/LoadingBlock'

import { useAuth } from '../../context/AuthContext'

import { useNotify } from '../../context/NotificationContext'

import { useReportFromUrl } from '../../hooks/useReportFromUrl'

import { CHAIRMAN_REPORT_GROUPS, chairmanRelatedViews } from '../../lib/chairmanReports'

import { REPORT_CATALOG, reportLabel, reportPath, type ReportSlug } from '../../lib/reportsCatalog'

import { setDocumentTitle } from '../../lib/documentTitle'

import { ReportHumanReadout } from '../reports/ReportHumanReadout'
import { ReportShareBar } from '../reports/ReportShareBar'
import { downloadReportJson, downloadReportPdf } from '../../lib/reportDownload'
import { ChairmanPageChrome } from './ChairmanPageChrome'



export function ChairmanReportsView() {

  const { token } = useAuth()

  const { show: notify } = useNotify()

  const { invalidSlug, last, lastSlug, reportBusy, reportErr, closeReport, isDetailView } = useReportFromUrl(token)

  const [exportBusy, setExportBusy] = useState(false)



  useEffect(() => {

    setDocumentTitle(isDetailView && lastSlug ? reportLabel(lastSlug) : 'Reports')

  }, [isDetailView, lastSlug])



  async function pdfReport() {
    if (!last) return
    setExportBusy(true)
    try {
      await downloadReportPdf(last)
      notify('Report PDF downloaded', 'success')
    } catch (e) {
      notify((e as Error).message || 'PDF export failed', 'error')
    } finally {
      setExportBusy(false)
    }
  }



  const catalogBySlug = Object.fromEntries(REPORT_CATALOG.map((r) => [r.slug, r])) as Record<

    ReportSlug,

    (typeof REPORT_CATALOG)[number]

  >



  return (

    <ChairmanPageChrome

      title="Reports"

      subtitle="Structured packs from the live book — for board circulation and principal review"

      actions={

        last ? (

          <>

            <button

              type="button"

              onClick={() => window.print()}

              className="rounded-lg border border-fo-border px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-300"

            >

              Print

            </button>

            <button
              type="button"
              disabled={!lastSlug}
              onClick={() => lastSlug && last && downloadReportJson(last, lastSlug)}
              className="rounded-lg border border-fo-border px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-300"
            >
              JSON file
            </button>
            <button
              type="button"
              disabled={exportBusy}
              onClick={() => void pdfReport()}
              className="rounded-lg bg-gradient-to-r from-fo-gold to-amber-600 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-fo-black disabled:opacity-50"
            >
              {exportBusy ? 'PDF…' : 'Download PDF'}
            </button>
          </>

        ) : null

      }

    >

      {invalidSlug ? (

        <p role="alert" className="text-sm text-fo-red">

          Unknown report. Choose a pack from the list below or open the{' '}

          <Link to={reportPath('monthly')} className="text-fo-gold-soft underline">

            monthly pack

          </Link>

          .

        </p>

      ) : null}



      {reportErr ? (

        <p role="alert" className="text-sm text-fo-red">

          {reportErr}

        </p>

      ) : null}



      {!isDetailView ? (

        <>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Each pack has its own address — for example{' '}
            <span className="font-mono text-fo-gold-soft/90">{reportPath('monthly')}</span> — so you can bookmark or
            return to it after signing in.
          </p>

          <section className="chairman-card rounded-2xl border border-fo-gold/30 bg-gradient-to-br from-fo-gold/10 via-fo-graphite/50 to-fo-black p-6">

            <p className="text-[10px] uppercase tracking-[0.35em] text-fo-gold-soft">Featured</p>

            <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl text-white">

              {reportLabel('monthly')}

            </h2>

            <p className="mt-2 max-w-xl text-sm text-zinc-400 leading-relaxed">

              Consolidated monthly view of net position, liquidity, risk signals, and recommended focus areas.

            </p>

            <Link

              to={reportPath('monthly')}

              className="mt-4 inline-block rounded-lg bg-fo-gold px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-fo-black"

            >

              Open monthly pack

            </Link>

          </section>



          {CHAIRMAN_REPORT_GROUPS.map((group) => (

            <section key={group.title}>

              <h2 className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">{group.title}</h2>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                {group.slugs.map((slug) => {

                  const meta = catalogBySlug[slug]

                  if (!meta) return null

                  return (

                    <Link

                      key={slug}

                      to={reportPath(slug)}

                      className="chairman-card rounded-xl border border-fo-border/80 bg-fo-graphite/40 px-4 py-4 text-left hover:border-fo-gold/50"

                    >

                      <p className="text-sm font-medium text-zinc-100">{meta.label}</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">{reportPath(slug)}</p>
                      <p className="mt-2 text-[10px] uppercase tracking-wider text-fo-gold-soft">Open report →</p>

                    </Link>

                  )

                })}

              </div>

            </section>

          ))}

        </>

      ) : (

        <>

          <button

            type="button"

            onClick={closeReport}

            className="text-xs uppercase tracking-wider text-zinc-500 hover:text-fo-gold-soft"

          >

            ← All reports

          </button>

          {lastSlug ? <ReportShareBar slug={lastSlug} /> : null}

          {lastSlug ? (

            <div className="flex flex-wrap gap-2">

              {chairmanRelatedViews(lastSlug).map((l) => (

                <Link

                  key={l.to}

                  to={l.to}

                  className="rounded-full border border-fo-border/60 bg-fo-panel/40 px-3 py-1 text-[11px] text-zinc-300 hover:border-fo-gold/50"

                >

                  {l.label}

                </Link>

              ))}

            </div>

          ) : null}



          {reportBusy ? <LoadingBlock label="Loading report…" /> : null}



          {last && lastSlug && !reportBusy ? (

            <>

              <div className="chairman-card rounded-2xl border border-fo-border/80 bg-fo-graphite/40 p-5 md:p-8 print:border-zinc-300 print:bg-white">

                <ReportHumanReadout data={last} slug={lastSlug} />

              </div>

              <footer className="text-[11px] text-zinc-600 border-t border-fo-border/40 pt-6">

                Generated from the live family office book · not investment advice · share via print or PDF for board

                packs.

              </footer>

            </>

          ) : null}

        </>

      )}

    </ChairmanPageChrome>

  )

}

